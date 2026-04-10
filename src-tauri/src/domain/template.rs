use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::domain::project::BackendError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanvasLayerKind {
    Brief,
    Storyboard,
    ShotLab,
}

impl CanvasLayerKind {
    pub fn is_known(value: &str) -> bool {
        matches!(value, "brief" | "storyboard" | "shot_lab")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Brief,
    StoryboardShot,
    Prompt,
    Still,
    Video,
    Reference,
    Review,
    Result,
}

impl NodeKind {
    pub fn is_known(value: &str) -> bool {
        matches!(
            value,
            "brief"
                | "storyboard_shot"
                | "prompt"
                | "still"
                | "video"
                | "reference"
                | "review"
                | "result"
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationKind {
    Contains,
    References,
    VariantOf,
    ApprovedFrom,
    AlternativeTo,
    Reuses,
}

impl RelationKind {
    pub fn is_known(value: &str) -> bool {
        matches!(
            value,
            "contains"
                | "references"
                | "variant_of"
                | "approved_from"
                | "alternative_to"
                | "reuses"
        )
    }
}

pub type AllowedNodeKindsByLayer = BTreeMap<String, Vec<String>>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SystemAnchorSpec {
    pub title: String,
    pub source_node_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LayerSpec {
    pub layer_type: String,
    pub display_name: String,
    pub allowed_node_types: Vec<String>,
    #[serde(default)]
    pub system_anchor: Option<SystemAnchorSpec>,
    #[serde(default)]
    pub child_canvas_for: Option<String>,
    #[serde(default)]
    pub default_relations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RootGraphSeed {
    pub layer_type: String,
    pub graph_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TemplateManifest {
    pub id: String,
    pub version: u32,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub recommended: bool,
    pub layer_specs: Vec<LayerSpec>,
    pub root_graph_seed: RootGraphSeed,
}

impl TemplateManifest {
    pub fn validate(&self) -> Result<(), BackendError> {
        if self.id.trim().is_empty() || self.name.trim().is_empty() {
            return Err(BackendError::new(
                "invalid_template_manifest",
                "template id and name must be present",
            ));
        }

        if self.layer_specs.is_empty() {
            return Err(BackendError::new(
                "invalid_template_manifest",
                "template must declare at least one layer spec",
            ));
        }

        let mut layer_types = HashSet::new();
        for spec in &self.layer_specs {
            if spec.layer_type.trim().is_empty()
                || spec.display_name.trim().is_empty()
                || spec.allowed_node_types.is_empty()
            {
                return Err(BackendError::new(
                    "invalid_template_manifest",
                    "layer specs must include a type, display name, and allowed node types",
                ));
            }

            if !CanvasLayerKind::is_known(&spec.layer_type) {
                return Err(BackendError::new(
                    "invalid_template_manifest",
                    format!("unknown layer type {}", spec.layer_type),
                ));
            }

            if !layer_types.insert(spec.layer_type.clone()) {
                return Err(BackendError::new(
                    "invalid_template_manifest",
                    format!("duplicate layer type {}", spec.layer_type),
                ));
            }

            for node_type in &spec.allowed_node_types {
                if !NodeKind::is_known(node_type) {
                    return Err(BackendError::new(
                        "invalid_template_manifest",
                        format!("unknown node type {node_type} in layer {}", spec.layer_type),
                    ));
                }
            }

            if let Some(child_canvas_for) = &spec.child_canvas_for {
                if !spec
                    .allowed_node_types
                    .iter()
                    .any(|node_type| node_type == child_canvas_for)
                {
                    return Err(BackendError::new(
                        "invalid_template_manifest",
                        format!(
                            "child canvas source {child_canvas_for} must be whitelisted in layer {}",
                            spec.layer_type
                        ),
                    ));
                }
            }

            if let Some(anchor) = &spec.system_anchor {
                if anchor.title.trim().is_empty() || !NodeKind::is_known(&anchor.source_node_type) {
                    return Err(BackendError::new(
                        "invalid_template_manifest",
                        format!("layer {} has an invalid system anchor", spec.layer_type),
                    ));
                }
            }

            for relation in &spec.default_relations {
                if !RelationKind::is_known(relation) {
                    return Err(BackendError::new(
                        "invalid_template_manifest",
                        format!(
                            "unknown relation type {relation} in layer {}",
                            spec.layer_type
                        ),
                    ));
                }
            }
        }

        if self.root_graph_seed.graph_name.trim().is_empty() {
            return Err(BackendError::new(
                "invalid_template_manifest",
                "root graph seed must include a graph name",
            ));
        }

        self.validate_layer_type(&self.root_graph_seed.layer_type)
    }

    pub fn validate_layer_type(&self, layer_type: &str) -> Result<(), BackendError> {
        if self
            .layer_specs
            .iter()
            .any(|spec| spec.layer_type == layer_type)
        {
            return Ok(());
        }

        Err(BackendError::new(
            "invalid_template_manifest",
            format!("unknown layer type {layer_type}"),
        ))
    }

    pub fn layer_types(&self) -> Vec<String> {
        self.layer_specs
            .iter()
            .map(|spec| spec.layer_type.clone())
            .collect()
    }

    pub fn allowed_node_kinds_by_layer(&self) -> AllowedNodeKindsByLayer {
        self.layer_specs
            .iter()
            .map(|spec| (spec.layer_type.clone(), spec.allowed_node_types.clone()))
            .collect()
    }
}

#[derive(Debug, Clone)]
pub struct TemplateRegistry {
    templates: BTreeMap<String, TemplateManifest>,
}

impl TemplateRegistry {
    pub fn load_embedded() -> Result<Self, BackendError> {
        let manifest: TemplateManifest = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/resources/templates/ecommerce_ad_v1.json"
        )))
        .map_err(|error| {
            BackendError::new(
                "invalid_template_manifest",
                format!("failed to parse embedded template manifest: {error}"),
            )
        })?;

        manifest.validate()?;

        let mut templates = BTreeMap::new();
        templates.insert(manifest.id.clone(), manifest);

        Ok(Self { templates })
    }

    pub fn all(&self) -> Vec<TemplateManifest> {
        self.templates.values().cloned().collect()
    }

    pub fn template(&self, template_id: &str) -> Result<TemplateManifest, BackendError> {
        self.templates.get(template_id).cloned().ok_or_else(|| {
            BackendError::new(
                "template_not_found",
                format!("unknown template {template_id}"),
            )
        })
    }
}
