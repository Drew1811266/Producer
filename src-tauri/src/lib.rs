pub mod commands;
pub mod domain;

#[cfg(feature = "tauri-app")]
pub fn run() -> Result<(), tauri::Error> {
    use commands::{
        activate_graph, bind_node_asset, create_graph_edge, create_graph_node, create_project,
        delete_graph_edge, delete_graph_node, get_graph_node_detail,
        get_project_media_index_summary, get_project_session, list_available_templates, list_graph_edges,
        list_graph_node_type_options, list_graph_nodes, list_graph_relation_type_options,
        list_project_assets, open_node_child_graph, open_project, refresh_project_media_index,
        unbind_node_asset, update_graph_node_payload, update_graph_node_position,
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_available_templates,
            create_project,
            open_project,
            get_project_session,
            get_project_media_index_summary,
            refresh_project_media_index,
            list_project_assets,
            bind_node_asset,
            unbind_node_asset,
            activate_graph,
            open_node_child_graph,
            list_graph_nodes,
            list_graph_node_type_options,
            list_graph_edges,
            list_graph_relation_type_options,
            create_graph_node,
            create_graph_edge,
            get_graph_node_detail,
            update_graph_node_payload,
            update_graph_node_position,
            delete_graph_node,
            delete_graph_edge
        ])
        .run(tauri::generate_context!())?;

    Ok(())
}

#[cfg(not(feature = "tauri-app"))]
pub fn run() -> Result<(), domain::project::BackendError> {
    Err(domain::project::BackendError::new(
        "tauri_runtime_disabled",
        "enable the tauri-app feature to run the desktop application",
    ))
}
