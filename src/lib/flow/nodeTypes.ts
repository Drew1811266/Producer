import type { NodeTypes } from '@xyflow/react';

import {
  ProducerCanvasNode,
  ProducerPlaceholderCanvasNode,
} from '../../canvas/ProducerCanvasNode';

export const producerNodeTypes = {
  'producer-node': ProducerCanvasNode,
  'producer-placeholder': ProducerPlaceholderCanvasNode,
} satisfies NodeTypes;
