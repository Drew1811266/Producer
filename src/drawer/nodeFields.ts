import { formatFieldLabelZh, formatRelationTypeLabelZh } from '../copy/zh-CN';

export type DrawerFieldSpec = {
  key: string;
  label: string;
  multiline?: boolean;
};

const MULTILINE_FIELDS = new Set([
  'description',
  'objective',
  'audience',
  'key_message',
  'constraints',
  'shot_goal',
  'visual_subject',
  'action',
  'notes',
  'prompt_text',
  'negative_prompt',
  'selection_reason',
  'timeline_notes',
  'excerpt',
  'feedback',
  'summary',
]);

const FIELD_KEYS_BY_NODE_TYPE: Record<string, string[]> = {
  brief: ['description'],
  storyboard_shot: ['title', 'shot_goal', 'visual_subject', 'camera', 'action', 'duration_ms', 'notes'],
  prompt: ['title', 'prompt_text', 'negative_prompt', 'model_hint', 'seed_hint'],
  still: ['title', 'status', 'selection_reason'],
  video: ['title', 'status', 'timeline_notes'],
  reference: ['title', 'reference_type', 'source', 'excerpt'],
  review: ['title', 'decision', 'feedback', 'reviewer', 'reviewed_at'],
  result: ['title', 'result_type', 'export_preset', 'summary'],
};

export function formatFieldLabel(key: string): string {
  return formatFieldLabelZh(key);
}

export function formatRelationTypeLabel(edgeType: string): string {
  return formatRelationTypeLabelZh(edgeType);
}

export function getDrawerFieldSpecs(nodeType: string): DrawerFieldSpec[] {
  const keys = FIELD_KEYS_BY_NODE_TYPE[nodeType] ?? ['title'];

  return keys.map((key) => ({
    key,
    label: formatFieldLabel(key),
    multiline: MULTILINE_FIELDS.has(key),
  }));
}
