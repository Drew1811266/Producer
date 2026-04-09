import { useEffect, useRef } from 'react';

import type {
  GraphEdgeSummary,
  GraphNodeAssetBinding,
  GraphNodeSummary,
  GraphRelationTypeOption,
  NodeAssetRole,
  NodeAssetRoleOption,
  ProjectAssetSummary,
  ProjectGraphSummary,
} from '../bridge/contracts';
import {
  formatAssetRoleLabelZh,
  formatAssetStatusLabelZh,
  formatAttachmentPreviewLabelZh,
  formatBindAssetAriaLabelZh,
  formatGraphSummaryLabelZh,
  formatLayerLabelZh,
  formatNodeTypeLabelZh,
  formatRelationDeleteAriaLabelZh,
  formatUnbindAssetAriaLabelZh,
  zhCN,
} from '../copy/zh-CN';
import { toAssetPreviewUrl } from '../preview/filePreview';
import { formatFieldLabel, formatRelationTypeLabel, getDrawerFieldSpecs } from './nodeFields';
import {
  formatReadonlyJson,
  isEditableScalarValue,
  toEditableString,
  type GraphNodeDraft,
  updateBriefDescriptionDraft,
  updateGraphNodeDraftValue,
} from './nodeDraft';

type AssetBindingLike =
  | GraphNodeAssetBinding
  | {
      id?: string;
      role: string;
      roleLabel?: string;
      assetId?: string | null;
      assetTitle?: string | null;
      assetMediaType?: string | null;
      assetStatus?: string | null;
      assetDetail?: string | null;
      asset?: ProjectAssetSummary | null;
    };

type AssetRoleOptionLike =
  | NodeAssetRoleOption
  | {
      value: string;
      label: string;
    };

type AssetSearchResultLike =
  | ProjectAssetSummary
  | {
      id: string;
      title: string;
      mediaType?: string | null;
      status?: string | null;
      detail?: string | null;
      relativePath?: string;
    };

type RelationLike =
  | GraphEdgeSummary
  | {
      id: string;
      direction?: 'incoming' | 'outgoing';
      relationType?: string;
      edgeType?: string;
      nodeId?: string;
      nodeTitle?: string;
      sourceNodeId?: string;
      targetNodeId?: string;
    };

type RelationTypeOptionLike =
  | GraphRelationTypeOption
  | {
      value: string;
      label: string;
    };

type RelationTargetOptionLike =
  | {
      nodeId: string;
      label: string;
    }
  | {
      id: string;
      title: string;
    };

type RelationCreateStateLike = {
  relationType: string;
  targetNodeId: string;
  targetOptions: RelationTargetOptionLike[];
  status?: 'idle' | 'saving' | 'error';
  error?: string | null;
};

type RelationDeleteStateLike = {
  pendingRelationId: string | null;
  error?: string | null;
};

type GraphNodeDrawerProps = {
  assetBindings?: AssetBindingLike[];
  assetRoleOptions?: AssetRoleOptionLike[];
  attachmentSearchError?: string | null;
  attachmentSearchQuery?: string;
  attachmentSearchResults?: AssetSearchResultLike[];
  attachmentSearchStatus?: 'idle' | 'loading' | 'ready' | 'error';
  attachmentSelectedRole?: NodeAssetRole | '';
  assetSearchError?: string | null;
  assetSearchQuery?: string;
  assetSearchResults?: AssetSearchResultLike[];
  assetSearchStatus?: 'idle' | 'loading' | 'ready' | 'error';
  autoFocusFieldKey?: string | null;
  detailError?: string | null;
  detailStatus: 'loading' | 'ready' | 'error';
  draft: GraphNodeDraft | null;
  graph: ProjectGraphSummary;
  node: GraphNodeSummary;
  onAssetRoleChange?(role: string): void;
  onAssetSearchQueryChange?(query: string): void;
  onBindAsset?(assetId: string): void;
  onClose(): void;
  onCreateRelation?(): void;
  onDeleteRelation?(edgeId: string): void;
  onDraftChange(nextDraft: GraphNodeDraft): void;
  onRelationTargetChange?(targetNodeId: string): void;
  onRelationTypeChange?(edgeType: string): void;
  onUnbindAsset?(binding: AssetBindingLike): void;
  onAttachmentRoleChange?(role: NodeAssetRole): void;
  onAttachmentSearchQueryChange?(query: string): void;
  relationCreateError?: string | null;
  relationCreatePending?: boolean;
  relationCreateState?: RelationCreateStateLike;
  relationDeleteError?: string | null;
  relationDeletePendingEdgeId?: string | null;
  relationDeleteState?: RelationDeleteStateLike;
  relationIncoming?: RelationLike[];
  relationOutgoing?: RelationLike[];
  relationSelectedTargetNodeId?: string;
  relationSelectedType?: string;
  relationTargetOptions?: RelationTargetOptionLike[];
  relationTypeOptions?: RelationTypeOptionLike[];
  relations?:
    | RelationLike[]
    | {
        incoming?: RelationLike[];
        outgoing?: RelationLike[];
      };
  saveStatus: 'idle' | 'saving' | 'error';
  selectedAssetPreview?: AssetBindingLike | null;
  selectedAssetRole?: string;
  width: number;
};

type NormalizedAssetBinding = {
  asset: ProjectAssetSummary | null;
  assetDetail: string | null;
  assetId: string | null;
  assetStatus: string | null;
  assetTitle: string | null;
  key: string;
  role: string;
  roleLabel: string;
  original: AssetBindingLike;
};

type NormalizedAssetRoleOption = {
  label: string;
  value: string;
};

type NormalizedAssetSearchResult = {
  detail: string | null;
  id: string;
  mediaType: string | null;
  status: string | null;
  title: string;
};

type NormalizedRelationSummary = {
  direction: 'incoming' | 'outgoing';
  id: string;
  nodeTitle: string;
  relationType: string;
};

type NormalizedRelationTypeOption = {
  label: string;
  value: string;
};

type NormalizedRelationTargetOption = {
  id: string;
  title: string;
};

type BriefMediaRole = 'product_image' | 'example_video';

type BriefMediaSlot = {
  binding: NormalizedAssetBinding | null;
  emptyMessage: string;
  label: string;
  mediaType: 'image' | 'video';
  placeholder: string;
  previewLabel: string;
  previewUrl: string | null;
  role: BriefMediaRole;
  searchLabel: string;
  searchResults: NormalizedAssetSearchResult[];
};

export function GraphNodeDrawer({
  assetBindings = [],
  assetRoleOptions = [],
  attachmentSearchError = null,
  attachmentSearchQuery,
  attachmentSearchResults,
  attachmentSearchStatus,
  attachmentSelectedRole = '',
  assetSearchError = null,
  assetSearchQuery,
  assetSearchResults,
  assetSearchStatus,
  autoFocusFieldKey = null,
  detailError = null,
  detailStatus,
  draft,
  graph,
  node,
  onAssetRoleChange,
  onAssetSearchQueryChange,
  onBindAsset = () => undefined,
  onClose,
  onCreateRelation = () => undefined,
  onDeleteRelation = () => undefined,
  onDraftChange,
  onRelationTargetChange = () => undefined,
  onRelationTypeChange = () => undefined,
  onUnbindAsset = () => undefined,
  onAttachmentRoleChange,
  onAttachmentSearchQueryChange,
  relationCreateError = null,
  relationCreatePending = false,
  relationCreateState,
  relationDeleteError = null,
  relationDeletePendingEdgeId = null,
  relationDeleteState,
  relationIncoming = [],
  relationOutgoing = [],
  relationSelectedTargetNodeId = '',
  relationSelectedType = '',
  relationTargetOptions = [],
  relationTypeOptions = [],
  relations,
  saveStatus,
  selectedAssetPreview = null,
  selectedAssetRole,
  width,
}: GraphNodeDrawerProps) {
  const autoFocusInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const payload = draft ?? {};
  const isBriefDrawer = node.nodeType === 'brief';
  const fieldSpecs = getDrawerFieldSpecs(node.nodeType);
  const knownKeys = new Set(fieldSpecs.map((field) => field.key));
  const extras = Object.entries(payload).filter(([key]) => !knownKeys.has(key) && key !== 'asset_refs');
  const title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title : node.title;
  const nodeTypeLabel = formatNodeTypeLabelZh(node.nodeType);
  const nodeStatus = typeof node.status === 'string' && node.status.trim() ? node.status : null;
  const graphLabel = formatGraphSummaryLabelZh(graph);
  const graphLayerLabel = formatLayerLabelZh(graph.layerType);
  const normalizedBindings = assetBindings.map(normalizeAssetBinding);
  const normalizedRoleOptions = assetRoleOptions.map(normalizeAssetRoleOption);
  const normalizedSearchResults = (assetSearchResults ?? attachmentSearchResults ?? []).map(
    normalizeAssetSearchResult,
  );
  const resolvedAssetSearchError = assetSearchError ?? attachmentSearchError;
  const resolvedAssetSearchQuery = assetSearchQuery ?? attachmentSearchQuery ?? '';
  const resolvedAssetSearchStatus = assetSearchStatus ?? attachmentSearchStatus ?? 'idle';
  const resolvedSelectedAssetRole = selectedAssetRole ?? attachmentSelectedRole ?? '';
  const previewBinding =
    (selectedAssetPreview ? normalizeAssetBinding(selectedAssetPreview) : null) ??
    normalizedBindings.find((binding) => binding.assetId) ??
    null;
  const previewUrl = toAssetPreviewUrl(
    previewBinding?.asset?.thumbnailPath ?? previewBinding?.asset?.filePath,
  );
  const previewLabel = formatAttachmentPreviewLabelZh(title);
  const normalizedTargetOptions = (
    relationCreateState?.targetOptions ?? relationTargetOptions
  ).map(normalizeRelationTargetOption);
  const targetLabels = new Map(normalizedTargetOptions.map((option) => [option.id, option.title]));
  const normalizedRelations = normalizeRelationLists(
    relations,
    relationIncoming,
    relationOutgoing,
    targetLabels,
  );
  const normalizedRelationTypeOptions = relationTypeOptions.map(normalizeRelationTypeOption);
  const relationTypeLabels = new Map(
    normalizedRelationTypeOptions.map((option) => [option.value, option.label]),
  );
  const resolvedRelationCreateState = relationCreateState ?? {
    relationType: relationSelectedType,
    targetNodeId: relationSelectedTargetNodeId,
    targetOptions: relationTargetOptions,
    status: relationCreatePending ? 'saving' : relationCreateError ? 'error' : 'idle',
    error: relationCreateError,
  };
  const resolvedRelationDeleteState = relationDeleteState ?? {
    pendingRelationId: relationDeletePendingEdgeId,
    error: relationDeleteError,
  };
  const isRelationCreateDisabled =
    resolvedRelationCreateState.status === 'saving' ||
    !resolvedRelationCreateState.relationType ||
    !resolvedRelationCreateState.targetNodeId;
  const briefSlots = isBriefDrawer
    ? buildBriefMediaSlots({
        bindings: normalizedBindings,
        query: resolvedAssetSearchQuery,
        searchResults: normalizedSearchResults,
        selectedRole: resolvedSelectedAssetRole,
      })
    : [];

  useEffect(() => {
    if (detailStatus !== 'ready' || !autoFocusFieldKey) {
      return;
    }

    autoFocusInputRef.current?.focus();
    autoFocusInputRef.current?.select?.();
  }, [autoFocusFieldKey, detailStatus, node.id]);

  const footerMessage =
    saveStatus === 'saving'
      ? zhCN.drawer.saveSaving
      : saveStatus === 'error'
        ? zhCN.drawer.saveError
        : zhCN.drawer.saveReady;
  const footerTone = saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'saving' : 'ready';

  return (
    <aside
      aria-label={zhCN.drawer.ariaLabel}
      className="graph-node-drawer"
      data-testid="graph-node-drawer"
      style={{ width: `${width}px` }}
    >
      <header className="graph-node-drawer-header">
        {isBriefDrawer ? <div /> : (
          <div className="graph-node-drawer-meta">
            <div className="graph-node-drawer-meta-row">
              <span className="graph-node-drawer-badge">{nodeTypeLabel}</span>
              {nodeStatus ? (
                <span className="graph-node-drawer-badge graph-node-drawer-badge-status">
                  {nodeStatus}
                </span>
              ) : null}
            </div>
            <h2 className="graph-node-drawer-title">{title}</h2>
            <div className="graph-node-drawer-subtitle">
              <span>{graphLabel}</span>
              {graphLabel !== graphLayerLabel ? <span aria-hidden="true">·</span> : null}
              {graphLabel !== graphLayerLabel ? <span>{graphLayerLabel}</span> : null}
            </div>
          </div>
        )}
        <button
          aria-label={zhCN.drawer.closeAriaLabel}
          className="graph-node-drawer-close"
          type="button"
          onClick={onClose}
        >
          {zhCN.drawer.close}
        </button>
      </header>

      <div className="graph-node-drawer-body">
        {detailStatus === 'loading' ? (
          <section className="graph-node-drawer-state" role="status">
            <div className="graph-node-drawer-section-head">
              <span className="overlay-label">{zhCN.drawer.nodeState}</span>
              <strong>{zhCN.drawer.loadingNodeDetail}</strong>
            </div>
            <p>{zhCN.drawer.loadingNodeDetailDescription}</p>
          </section>
        ) : null}

        {detailStatus === 'error' ? (
          <section className="graph-node-drawer-state">
            <div className="graph-node-drawer-section-head">
              <span className="overlay-label">{zhCN.drawer.nodeState}</span>
              <strong>{zhCN.drawer.nodeDetailErrorTitle}</strong>
            </div>
            <p>{detailError ?? zhCN.drawer.nodeDetailErrorDescription}</p>
          </section>
        ) : null}

        {detailStatus === 'ready' && draft ? (
          isBriefDrawer ? (
            <>
              <section className="graph-node-drawer-section">
                <div className="graph-node-drawer-section-head">
                  <h3>{zhCN.drawer.briefDescription}</h3>
                </div>

                <label className="graph-node-field">
                  <span className="graph-node-field-label">{zhCN.drawer.briefDescription}</span>
                  <textarea
                    aria-label={zhCN.drawer.briefDescription}
                    ref={
                      autoFocusFieldKey === 'description'
                        ? (element) => {
                            autoFocusInputRef.current = element;
                          }
                        : undefined
                    }
                    rows={8}
                    value={toEditableString(payload.description)}
                    onChange={(event) => onDraftChange(updateBriefDescriptionDraft(draft, event.target.value))}
                  />
                </label>
              </section>

              {briefSlots.map((slot) => (
                <section key={slot.role} className="graph-node-drawer-section">
                  <div className="graph-node-drawer-section-head">
                    <h3>{slot.label}</h3>
                  </div>

                  <div className="graph-node-drawer-stack">
                    {slot.binding ? (
                      <div className="graph-node-drawer-attachment-preview">
                        {slot.previewUrl ? (
                          <img
                            alt={slot.previewLabel}
                            className="graph-node-drawer-attachment-preview-image"
                            src={slot.previewUrl}
                          />
                        ) : (
                          <div
                            className="graph-node-drawer-attachment-preview-placeholder"
                            role="img"
                            aria-label={slot.previewLabel}
                          >
                            {slot.binding.assetTitle ?? slot.emptyMessage}
                          </div>
                        )}

                        <div className="graph-node-drawer-list-copy">
                          <strong>{slot.binding.assetTitle ?? slot.emptyMessage}</strong>
                          {slot.binding.assetDetail ? <span>{slot.binding.assetDetail}</span> : null}
                          {slot.binding.assetStatus ? <span>{slot.binding.assetStatus}</span> : null}
                        </div>

                        <button
                          type="button"
                          className="graph-node-drawer-inline-action"
                          aria-label={formatUnbindAssetAriaLabelZh(slot.label)}
                          disabled={!slot.binding.assetId}
                          onClick={() => onUnbindAsset(slot.binding.original)}
                        >
                          {zhCN.drawer.removeAction}
                        </button>
                      </div>
                    ) : (
                      <p className="graph-node-drawer-empty">{slot.emptyMessage}</p>
                    )}

                    <label className="graph-node-field">
                      <span className="graph-node-field-label">{slot.searchLabel}</span>
                      <input
                        aria-label={slot.searchLabel}
                        placeholder={slot.placeholder}
                        type="search"
                        value={resolvedSelectedAssetRole === slot.role ? resolvedAssetSearchQuery : ''}
                        onChange={(event) => {
                          handleAssetRoleChange(slot.role);
                          handleAssetSearchQueryChange(event.target.value);
                        }}
                      />
                    </label>

                    {resolvedSelectedAssetRole === slot.role && resolvedAssetSearchStatus === 'loading' ? (
                      <p className="graph-node-drawer-empty">{zhCN.drawer.searchAssetsLoading}</p>
                    ) : null}

                    {resolvedSelectedAssetRole === slot.role && resolvedAssetSearchStatus === 'error' ? (
                      <p className="graph-node-drawer-empty graph-node-drawer-empty-error">
                        {resolvedAssetSearchError ?? zhCN.drawer.searchAssetsError}
                      </p>
                    ) : null}

                    {resolvedSelectedAssetRole === slot.role && slot.searchResults.length > 0 ? (
                      <ul className="graph-node-drawer-list" aria-label={slot.label}>
                        {slot.searchResults.map((asset) => (
                          <li key={asset.id} className="graph-node-drawer-list-item">
                            <div className="graph-node-drawer-list-copy">
                              <strong>{asset.title}</strong>
                              {asset.detail ? <span>{asset.detail}</span> : null}
                              {asset.status ? <span>{asset.status}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="graph-node-drawer-inline-action"
                              aria-label={formatBindAssetAriaLabelZh(asset.title)}
                              onClick={() => {
                                handleAssetRoleChange(slot.role);
                                onBindAsset(asset.id);
                              }}
                            >
                              {zhCN.drawer.attachAction}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {resolvedSelectedAssetRole === slot.role &&
                    resolvedAssetSearchStatus === 'ready' &&
                    resolvedAssetSearchQuery.trim() &&
                    slot.searchResults.length === 0 ? (
                      <p className="graph-node-drawer-empty">{zhCN.drawer.noMatchingAssets}</p>
                    ) : null}
                  </div>
                </section>
              ))}
            </>
          ) : (
          <>
            <section className="graph-node-drawer-section">
              <div className="graph-node-drawer-section-head">
                <h3>{zhCN.drawer.sectionDetails}</h3>
              </div>

              {fieldSpecs.map((field) => {
                const value = payload[field.key];

                if (!isEditableScalarValue(value)) {
                  return (
                    <div key={field.key} className="graph-node-field graph-node-field-readonly">
                      <span className="graph-node-field-label">{field.label}</span>
                      <pre>{formatReadonlyJson(value)}</pre>
                    </div>
                  );
                }

                return (
                  <label key={field.key} className="graph-node-field">
                    <span className="graph-node-field-label">{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        aria-label={field.label}
                        ref={
                          autoFocusFieldKey === field.key
                            ? (element) => {
                                autoFocusInputRef.current = element;
                              }
                            : undefined
                        }
                        rows={4}
                        value={toEditableString(value)}
                        onChange={(event) =>
                          onDraftChange(updateGraphNodeDraftValue(draft, field.key, event.target.value))
                        }
                      />
                    ) : (
                      <input
                        aria-label={field.label}
                        ref={
                          autoFocusFieldKey === field.key
                            ? (element) => {
                                autoFocusInputRef.current = element;
                              }
                            : undefined
                        }
                        type="text"
                        value={toEditableString(value)}
                        onChange={(event) =>
                          onDraftChange(updateGraphNodeDraftValue(draft, field.key, event.target.value))
                        }
                      />
                    )}
                  </label>
                );
              })}
            </section>

            <section className="graph-node-drawer-section">
              <div className="graph-node-drawer-section-head">
                <h3>{zhCN.drawer.sectionAttachments}</h3>
              </div>

              <div className="graph-node-drawer-stack">
                <div className="graph-node-drawer-subsection">
                  <h4>{zhCN.drawer.preview}</h4>

                  {previewBinding ? (
                    <div className="graph-node-drawer-attachment-preview">
                      {previewBinding.asset?.mediaType === 'image' && previewUrl ? (
                        <img
                          alt={previewLabel}
                          className="graph-node-drawer-attachment-preview-image"
                          src={previewUrl}
                        />
                      ) : (
                        <div
                          className="graph-node-drawer-attachment-preview-placeholder"
                          role="img"
                          aria-label={previewLabel}
                        >
                          {previewBinding.assetTitle ?? zhCN.drawer.attachmentPreviewFallback}
                        </div>
                      )}

                      <div className="graph-node-drawer-list-copy">
                        <strong>{previewBinding.assetTitle ?? '未命名素材'}</strong>
                        {previewBinding.assetDetail ? <span>{previewBinding.assetDetail}</span> : null}
                        {previewBinding.assetStatus ? <span>{previewBinding.assetStatus}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <p className="graph-node-drawer-empty">{zhCN.drawer.noAttachmentsBound}</p>
                  )}
                </div>

                <div className="graph-node-drawer-utility-grid">
                  <div className="graph-node-drawer-subsection">
                    <h4>{zhCN.drawer.attached}</h4>
                    <ul className="graph-node-drawer-list">
                      {normalizedBindings.length > 0 ? (
                        normalizedBindings.map((binding) => (
                          <li key={binding.key} className="graph-node-drawer-list-item">
                            <div className="graph-node-drawer-list-copy">
                              <strong>{binding.roleLabel}</strong>
                              <span>{binding.assetTitle ?? zhCN.drawer.noAttachmentsBound}</span>
                              {binding.assetStatus ? <span>{binding.assetStatus}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="graph-node-drawer-inline-action"
                              aria-label={formatUnbindAssetAriaLabelZh(binding.roleLabel)}
                              disabled={!binding.assetId}
                              onClick={() => onUnbindAsset(binding.original)}
                            >
                              {zhCN.drawer.removeAction}
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="graph-node-drawer-list-item graph-node-drawer-list-item-empty">
                          <span className="graph-node-drawer-empty">
                            {zhCN.drawer.noAssetRolesConfigured}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="graph-node-drawer-subsection">
                    <h4>{zhCN.drawer.attachAsset}</h4>

                    <div className="graph-node-drawer-controls">
                      <label className="graph-node-field">
                        <span className="graph-node-field-label">{zhCN.drawer.attachmentRole}</span>
                        <select
                          aria-label={zhCN.drawer.attachmentRole}
                          value={resolvedSelectedAssetRole}
                          onChange={(event) => handleAssetRoleChange(event.target.value)}
                        >
                          <option value="">{zhCN.drawer.selectRole}</option>
                          {normalizedRoleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="graph-node-field">
                        <span className="graph-node-field-label">{zhCN.drawer.searchAssets}</span>
                        <input
                          aria-label={zhCN.drawer.searchAssets}
                          placeholder={zhCN.drawer.searchAssetsPlaceholder}
                          type="search"
                          value={resolvedAssetSearchQuery}
                          onChange={(event) => handleAssetSearchQueryChange(event.target.value)}
                        />
                      </label>
                    </div>

                    {resolvedAssetSearchStatus === 'loading' ? (
                      <p className="graph-node-drawer-empty">{zhCN.drawer.searchAssetsLoading}</p>
                    ) : null}

                    {resolvedAssetSearchStatus === 'error' ? (
                      <p className="graph-node-drawer-empty graph-node-drawer-empty-error">
                        {resolvedAssetSearchError ?? zhCN.drawer.searchAssetsError}
                      </p>
                    ) : null}

                    {normalizedSearchResults.length > 0 ? (
                      <ul className="graph-node-drawer-list" aria-label={zhCN.drawer.availableAttachments}>
                        {normalizedSearchResults.map((asset) => (
                          <li key={asset.id} className="graph-node-drawer-list-item">
                            <div className="graph-node-drawer-list-copy">
                              <strong>{asset.title}</strong>
                              {asset.detail ? <span>{asset.detail}</span> : null}
                              {asset.status ? <span>{asset.status}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="graph-node-drawer-inline-action"
                              aria-label={formatBindAssetAriaLabelZh(asset.title)}
                              disabled={!resolvedSelectedAssetRole}
                              onClick={() => onBindAsset(asset.id)}
                            >
                              {zhCN.drawer.attachAction}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {resolvedAssetSearchStatus === 'ready' && normalizedSearchResults.length === 0 ? (
                      <p className="graph-node-drawer-empty">{zhCN.drawer.noMatchingAssets}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="graph-node-drawer-section">
              <div className="graph-node-drawer-section-head">
                <h3>{zhCN.drawer.sectionRelations}</h3>
              </div>

              <div className="graph-node-drawer-stack">
                {normalizedRelations.incoming.length === 0 && normalizedRelations.outgoing.length === 0 ? (
                  <p className="graph-node-drawer-empty">{zhCN.drawer.noRelations}</p>
                ) : (
                  <div className="graph-node-drawer-relations-grid">
                    <section className="graph-node-drawer-subsection">
                      <h4>{zhCN.drawer.outgoing}</h4>
                      <ul className="graph-node-drawer-list">
                        {normalizedRelations.outgoing.length > 0 ? (
                          normalizedRelations.outgoing.map((relation) => (
                            <li key={relation.id} className="graph-node-drawer-list-item">
                              <div className="graph-node-drawer-list-copy">
                                <strong>
                                  {relationTypeLabels.get(relation.relationType) ??
                                    formatRelationTypeLabel(relation.relationType)}
                                  {' → '}
                                  {relation.nodeTitle}
                                </strong>
                              </div>
                              <button
                                type="button"
                                className="graph-node-drawer-inline-action"
                                aria-label={formatRelationDeleteAriaLabelZh(
                                  relation.id,
                                  formatRelationTypeText(relation, relationTypeLabels),
                                  relation.nodeTitle,
                                  'outgoing',
                                )}
                                disabled={resolvedRelationDeleteState.pendingRelationId === relation.id}
                                onClick={() => onDeleteRelation(relation.id)}
                              >
                                {zhCN.drawer.deleteRelation}
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="graph-node-drawer-list-item graph-node-drawer-list-item-empty">
                            <span className="graph-node-drawer-empty">{zhCN.drawer.noOutgoingRelations}</span>
                          </li>
                        )}
                      </ul>
                    </section>

                    <section className="graph-node-drawer-subsection">
                      <h4>{zhCN.drawer.incoming}</h4>
                      <ul className="graph-node-drawer-list">
                        {normalizedRelations.incoming.length > 0 ? (
                          normalizedRelations.incoming.map((relation) => (
                            <li key={relation.id} className="graph-node-drawer-list-item">
                              <div className="graph-node-drawer-list-copy">
                                <strong>
                                  {relation.nodeTitle}
                                  {' → '}
                                  {relationTypeLabels.get(relation.relationType) ??
                                    formatRelationTypeLabel(relation.relationType)}
                                </strong>
                              </div>
                              <button
                                type="button"
                                className="graph-node-drawer-inline-action"
                                aria-label={formatRelationDeleteAriaLabelZh(
                                  relation.id,
                                  formatRelationTypeText(relation, relationTypeLabels),
                                  relation.nodeTitle,
                                  'incoming',
                                )}
                                disabled={resolvedRelationDeleteState.pendingRelationId === relation.id}
                                onClick={() => onDeleteRelation(relation.id)}
                              >
                                {zhCN.drawer.deleteRelation}
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="graph-node-drawer-list-item graph-node-drawer-list-item-empty">
                            <span className="graph-node-drawer-empty">{zhCN.drawer.noIncomingRelations}</span>
                          </li>
                        )}
                      </ul>
                    </section>
                  </div>
                )}

                <div className="graph-node-drawer-subsection">
                  <h4>{zhCN.drawer.addRelation}</h4>

                  <div className="graph-node-drawer-controls">
                    <label className="graph-node-field">
                      <span className="graph-node-field-label">{zhCN.drawer.relationType}</span>
                      <select
                        aria-label={zhCN.drawer.relationType}
                        value={resolvedRelationCreateState.relationType}
                        onChange={(event) => onRelationTypeChange(event.target.value)}
                      >
                        <option value="">{zhCN.drawer.selectRelation}</option>
                        {normalizedRelationTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="graph-node-field">
                      <span className="graph-node-field-label">{zhCN.drawer.targetNode}</span>
                      <select
                        aria-label={zhCN.drawer.targetNode}
                        value={resolvedRelationCreateState.targetNodeId}
                        onChange={(event) => onRelationTargetChange(event.target.value)}
                      >
                        <option value="">{zhCN.drawer.selectTargetNode}</option>
                        {normalizedTargetOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="graph-node-drawer-primary-action"
                    disabled={isRelationCreateDisabled}
                    onClick={() => onCreateRelation()}
                  >
                    {resolvedRelationCreateState.status === 'saving'
                      ? zhCN.drawer.addingRelation
                      : zhCN.drawer.addRelation}
                  </button>

                  {resolvedRelationCreateState.error ? (
                    <p className="graph-node-drawer-empty graph-node-drawer-empty-error">
                      {resolvedRelationCreateState.error}
                    </p>
                  ) : null}
                  {resolvedRelationDeleteState.error ? (
                    <p className="graph-node-drawer-empty graph-node-drawer-empty-error">
                      {resolvedRelationDeleteState.error}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            {extras.length > 0 ? (
              <section className="graph-node-drawer-section">
                <div className="graph-node-drawer-section-head">
                  <h3>{zhCN.drawer.sectionExtras}</h3>
                </div>

                {extras.map(([key, value]) => {
                  if (!isEditableScalarValue(value)) {
                    return (
                      <div key={key} className="graph-node-field graph-node-field-readonly">
                        <span className="graph-node-field-label">{formatFieldLabel(key)}</span>
                        <pre>{formatReadonlyJson(value)}</pre>
                      </div>
                    );
                  }

                  return (
                    <label key={key} className="graph-node-field">
                      <span className="graph-node-field-label">{formatFieldLabel(key)}</span>
                      <input
                        aria-label={formatFieldLabel(key)}
                        type="text"
                        value={toEditableString(value)}
                        onChange={(event) =>
                          onDraftChange(updateGraphNodeDraftValue(draft, key, event.target.value))
                        }
                      />
                    </label>
                  );
                })}
              </section>
            ) : null}
          </>
          )
        ) : null}
      </div>

      {isBriefDrawer ? null : (
        <footer aria-live="polite" className="graph-node-drawer-footer">
          <span
            aria-hidden="true"
            className={`graph-node-drawer-footer-indicator graph-node-drawer-footer-indicator-${footerTone}`}
          />
          <span>{footerMessage}</span>
        </footer>
      )}
    </aside>
  );

  function handleAssetRoleChange(nextRole: string) {
    onAssetRoleChange?.(nextRole);

    if (!onAssetRoleChange) {
      onAttachmentRoleChange?.(nextRole as NodeAssetRole);
    }
  }

  function handleAssetSearchQueryChange(nextQuery: string) {
    onAssetSearchQueryChange?.(nextQuery);

    if (!onAssetSearchQueryChange) {
      onAttachmentSearchQueryChange?.(nextQuery);
    }
  }
}

function buildBriefMediaSlots({
  bindings,
  query,
  searchResults,
  selectedRole,
}: {
  bindings: NormalizedAssetBinding[];
  query: string;
  searchResults: NormalizedAssetSearchResult[];
  selectedRole: string;
}): BriefMediaSlot[] {
  return [
    createBriefMediaSlot({
      bindings,
      emptyMessage: zhCN.drawer.briefNoProductImage,
      label: zhCN.drawer.briefProductImage,
      mediaType: 'image',
      placeholder: zhCN.drawer.briefSearchProductImagePlaceholder,
      previewLabel: zhCN.drawer.briefProductImage,
      query,
      role: 'product_image',
      searchLabel: zhCN.drawer.briefProductImageSearch,
      searchResults,
      selectedRole,
    }),
    createBriefMediaSlot({
      bindings,
      emptyMessage: zhCN.drawer.briefNoExampleVideo,
      label: zhCN.drawer.briefExampleVideo,
      mediaType: 'video',
      placeholder: zhCN.drawer.briefSearchExampleVideoPlaceholder,
      previewLabel: zhCN.drawer.briefExampleVideo,
      query,
      role: 'example_video',
      searchLabel: zhCN.drawer.briefExampleVideoSearch,
      searchResults,
      selectedRole,
    }),
  ];
}

function createBriefMediaSlot({
  bindings,
  emptyMessage,
  label,
  mediaType,
  placeholder,
  previewLabel,
  query,
  role,
  searchLabel,
  searchResults,
  selectedRole,
}: {
  bindings: NormalizedAssetBinding[];
  emptyMessage: string;
  label: string;
  mediaType: 'image' | 'video';
  placeholder: string;
  previewLabel: string;
  query: string;
  role: BriefMediaRole;
  searchLabel: string;
  searchResults: NormalizedAssetSearchResult[];
  selectedRole: string;
}): BriefMediaSlot {
  const binding = findBriefMediaBinding(bindings, role, mediaType);

  return {
    binding,
    emptyMessage,
    label,
    mediaType,
    placeholder,
    previewLabel,
    previewUrl: toAssetPreviewUrl(binding?.asset?.thumbnailPath ?? binding?.asset?.filePath),
    role,
    searchLabel,
    searchResults:
      selectedRole === role && query.trim()
        ? searchResults.filter((asset) => asset.mediaType === mediaType)
        : [],
  };
}

function findBriefMediaBinding(
  bindings: NormalizedAssetBinding[],
  role: BriefMediaRole,
  mediaType: 'image' | 'video',
): NormalizedAssetBinding | null {
  const explicitBinding = bindings.find((binding) => binding.role === role && binding.assetId);

  if (explicitBinding) {
    return explicitBinding;
  }

  return (
    bindings.find(
      (binding) => binding.role === 'reference' && binding.asset?.mediaType === mediaType && binding.assetId,
    ) ?? null
  );
}

function normalizeAssetBinding(binding: AssetBindingLike, index = 0): NormalizedAssetBinding {
  const asset = 'asset' in binding ? binding.asset ?? null : null;
  const assetTitle =
    'assetTitle' in binding && binding.assetTitle != null
      ? binding.assetTitle
      : asset?.relativePath.split('/').at(-1) ?? null;
  const assetDetail =
    'assetDetail' in binding && binding.assetDetail != null
      ? binding.assetDetail
      : asset?.relativePath ?? null;
  const assetStatus =
    'assetStatus' in binding && binding.assetStatus != null
      ? binding.assetStatus
      : asset?.missing
        ? 'missing'
        : null;
  const assetId = 'assetId' in binding ? binding.assetId ?? asset?.id ?? null : asset?.id ?? null;
  const role = binding.role;
  const roleLabel = formatAssetRoleLabelZh(
    'roleLabel' in binding && binding.roleLabel ? binding.roleLabel : role,
  );

  return {
    asset,
    assetDetail,
    assetId,
    assetStatus: formatAssetStatusLabelZh(assetStatus),
    assetTitle,
    key: 'id' in binding && binding.id ? binding.id : `${assetId ?? 'asset'}:${role}:${index}`,
    role,
    roleLabel,
    original: binding,
  };
}

function normalizeAssetRoleOption(option: AssetRoleOptionLike): NormalizedAssetRoleOption {
  return {
    label: formatAssetRoleLabelZh('role' in option ? option.role : option.value),
    value: 'role' in option ? option.role : option.value,
  };
}

function normalizeAssetSearchResult(result: AssetSearchResultLike): NormalizedAssetSearchResult {
  if ('relativePath' in result && typeof result.relativePath === 'string') {
    return {
      detail: result.relativePath,
      id: result.id,
      mediaType: result.mediaType ?? null,
      status: formatAssetStatusLabelZh(
        ('thumbnailStatus' in result ? result.thumbnailStatus : null) ??
          (('missing' in result && result.missing) ? 'missing' : null),
      ),
      title: result.relativePath.split('/').at(-1) ?? result.relativePath,
    };
  }

  return {
    detail: ('detail' in result ? result.detail : null) ?? null,
    id: result.id,
    mediaType: result.mediaType ?? null,
    status: formatAssetStatusLabelZh(('status' in result ? result.status : null) ?? null),
    title: ('title' in result ? result.title : result.id) ?? result.id,
  };
}

function normalizeRelationLists(
  relations: GraphNodeDrawerProps['relations'],
  relationIncoming: RelationLike[],
  relationOutgoing: RelationLike[],
  targetLabels: Map<string, string>,
): {
  incoming: NormalizedRelationSummary[];
  outgoing: NormalizedRelationSummary[];
} {
  if (Array.isArray(relations)) {
    return {
      incoming: relations
        .filter((relation) => 'direction' in relation && relation.direction === 'incoming')
        .map((relation) => normalizeRelationSummary(relation, 'incoming', targetLabels)),
      outgoing: relations
        .filter((relation) => !('direction' in relation) || relation.direction !== 'incoming')
        .map((relation) => normalizeRelationSummary(relation, 'outgoing', targetLabels)),
    };
  }

  if (relations) {
    return {
      incoming: (relations.incoming ?? []).map((relation) =>
        normalizeRelationSummary(relation, 'incoming', targetLabels),
      ),
      outgoing: (relations.outgoing ?? []).map((relation) =>
        normalizeRelationSummary(relation, 'outgoing', targetLabels),
      ),
    };
  }

  return {
    incoming: relationIncoming.map((relation) =>
      normalizeRelationSummary(relation, 'incoming', targetLabels),
    ),
    outgoing: relationOutgoing.map((relation) =>
      normalizeRelationSummary(relation, 'outgoing', targetLabels),
    ),
  };
}

function normalizeRelationSummary(
  relation: RelationLike,
  direction: 'incoming' | 'outgoing',
  targetLabels: Map<string, string>,
): NormalizedRelationSummary {
  const relationType =
    ('edgeType' in relation ? relation.edgeType : relation.relationType) ?? '';
  const nodeId =
    'nodeId' in relation && relation.nodeId
      ? relation.nodeId
      : direction === 'incoming'
        ? relation.sourceNodeId
        : relation.targetNodeId;
  const nodeTitle =
    'nodeTitle' in relation && relation.nodeTitle
      ? relation.nodeTitle
      : nodeId
        ? targetLabels.get(nodeId) ?? nodeId
        : zhCN.drawer.unknownNode;

  return {
    direction,
    id: relation.id,
    nodeTitle,
    relationType,
  };
}

function normalizeRelationTypeOption(
  option: RelationTypeOptionLike,
): NormalizedRelationTypeOption {
  const edgeType = 'edgeType' in option ? option.edgeType : option.value;

  return {
    label: formatRelationTypeLabel(edgeType),
    value: edgeType,
  };
}

function normalizeRelationTargetOption(
  option: RelationTargetOptionLike,
): NormalizedRelationTargetOption {
  return {
    id: 'nodeId' in option ? option.nodeId : option.id,
    title: 'label' in option ? option.label : option.title,
  };
}

function formatRelationTypeText(
  relation: NormalizedRelationSummary,
  relationTypeLabels: Map<string, string>,
): string {
  return relationTypeLabels.get(relation.relationType) ?? formatRelationTypeLabel(relation.relationType);
}
