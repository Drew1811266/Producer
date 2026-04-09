import type { GraphNodeDetail, GraphNodeSummary } from '../bridge/contracts';
import { formatFieldLabelZh, formatNodeDefaultTitleZh } from '../copy/zh-CN';

const SUMMARY_KEYS = new Set([
  'id',
  'graphId',
  'title',
  'nodeType',
  'status',
  'layout',
  'payload',
  'assetBindings',
  'assetRoleOptions',
]);

export type GraphNodeDraft = Record<string, unknown>;

const BRIEF_LEGACY_DESCRIPTION_KEYS = [
  'product',
  'objective',
  'audience',
  'key_message',
  'constraints',
  'tone',
] as const;
const BRIEF_TITLE_MAX_LENGTH = 40;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractGraphNodePayload(detail: GraphNodeDetail | Record<string, unknown>): GraphNodeDraft {
  const payload = isPlainRecord(detail.payload)
    ? { ...detail.payload }
    : Object.fromEntries(Object.entries(detail).filter(([key]) => !SUMMARY_KEYS.has(key)));

  if (detail.nodeType === 'brief') {
    return extractBriefNodePayload(detail, payload);
  }

  if (typeof detail.title === 'string' && detail.title.trim() && !payload.title) {
    payload.title = detail.title;
  }

  if (typeof detail.status === 'string' && detail.status.trim() && !payload.status) {
    payload.status = detail.status;
  }

  return payload;
}

function extractBriefNodePayload(
  detail: GraphNodeDetail | Record<string, unknown>,
  payload: Record<string, unknown>,
): GraphNodeDraft {
  const description = resolveBriefDescription(payload);
  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : typeof detail.title === 'string' && detail.title.trim()
        ? detail.title.trim()
        : deriveBriefTitle(description);
  const status =
    typeof payload.status === 'string' && payload.status.trim()
      ? payload.status
      : typeof detail.status === 'string' && detail.status.trim()
        ? detail.status
        : null;

  return {
    ...(status ? { status } : {}),
    title,
    description,
  };
}

function resolveBriefDescription(payload: Record<string, unknown>): string {
  const legacyDescription = BRIEF_LEGACY_DESCRIPTION_KEYS.map((key) => {
    const value = payload[key];

    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    return `${formatFieldLabelZh(key)}：${value.trim()}`;
  })
    .filter((line): line is string => line !== null)
    .join('\n');

  if (typeof payload.description === 'string' && payload.description.trim()) {
    return payload.description;
  }

  if (legacyDescription) {
    return legacyDescription;
  }

  if (typeof payload.description === 'string') {
    return payload.description;
  }

  return '';
}

export function deriveBriefTitle(description: string, fallback = formatNodeDefaultTitleZh('brief')): string {
  const firstMeaningfulLine = description
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .find((line) => line.length > 0);

  if (!firstMeaningfulLine) {
    return fallback;
  }

  if (firstMeaningfulLine.length <= BRIEF_TITLE_MAX_LENGTH) {
    return firstMeaningfulLine;
  }

  return `${firstMeaningfulLine.slice(0, BRIEF_TITLE_MAX_LENGTH).trimEnd()}…`;
}

export function updateBriefDescriptionDraft(draft: GraphNodeDraft, description: string): GraphNodeDraft {
  return {
    ...(typeof draft.status === 'string' && draft.status.trim() ? { status: draft.status } : {}),
    title: deriveBriefTitle(description),
    description,
  };
}

export function isEditableScalarValue(value: unknown): boolean {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function toEditableString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

export function updateGraphNodeDraftValue(
  draft: GraphNodeDraft,
  key: string,
  value: string,
): GraphNodeDraft {
  return {
    ...draft,
    [key]: value,
  };
}

export function projectGraphNodeSummaryWithDraft(
  node: GraphNodeSummary,
  draft: GraphNodeDraft | null | undefined,
): GraphNodeSummary {
  if (!draft) {
    return node;
  }

  const draftedTitle = typeof draft.title === 'string' && draft.title.trim() ? draft.title : null;
  const draftedStatus =
    typeof draft.status === 'string' && draft.status.trim()
      ? draft.status
      : typeof draft.decision === 'string' && draft.decision.trim()
        ? draft.decision
        : null;

  return {
    ...node,
    title: draftedTitle ?? node.title,
    status: draftedStatus ?? node.status,
  };
}

export function formatReadonlyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
