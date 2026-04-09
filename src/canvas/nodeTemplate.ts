export type NodeMasterSize = {
  width: number;
  height: number;
};

const DEFAULT_MASTER_SIZE: NodeMasterSize = {
  width: 176,
  height: 104,
};

const NODE_MASTER_SIZES: Record<string, NodeMasterSize> = {
  brief: {
    width: 208,
    height: 128,
  },
  storyboard_shot: {
    width: 220,
    height: 200,
  },
  prompt: {
    width: 220,
    height: 200,
  },
  reference: {
    width: 220,
    height: 200,
  },
  still: {
    width: 220,
    height: 200,
  },
  video: {
    width: 220,
    height: 200,
  },
  review: {
    width: 220,
    height: 200,
  },
  result: {
    width: 220,
    height: 200,
  },
};

export function resolveNodeSemanticType(
  nodeType: string,
  options: {
    isSystem?: boolean;
    sourceNodeType?: string;
  } = {},
): string {
  if (options.isSystem && options.sourceNodeType) {
    return options.sourceNodeType;
  }

  return nodeType;
}

export function usesPortGridShell(
  nodeType: string,
  options: {
    isSystem?: boolean;
    sourceNodeType?: string;
  } = {},
): boolean {
  if (options.isSystem) {
    return false;
  }

  return resolveNodeSemanticType(nodeType, options) !== 'brief';
}

export function resolveNodeMasterSize(
  nodeType: string,
  options: {
    isSystem?: boolean;
    sourceNodeType?: string;
  } = {},
): NodeMasterSize {
  const semanticType = resolveNodeSemanticType(nodeType, options);

  return NODE_MASTER_SIZES[semanticType] ?? DEFAULT_MASTER_SIZE;
}

export function resolveNodeScaleFactor(
  projectedWidth: number,
  projectedHeight: number,
  masterSize: NodeMasterSize,
): number {
  const safeProjectedWidth =
    Number.isFinite(projectedWidth) && projectedWidth > 0 ? projectedWidth : 0;
  const safeProjectedHeight =
    Number.isFinite(projectedHeight) && projectedHeight > 0 ? projectedHeight : 0;
  const safeMasterWidth =
    Number.isFinite(masterSize.width) && masterSize.width > 0 ? masterSize.width : DEFAULT_MASTER_SIZE.width;
  const safeMasterHeight =
    Number.isFinite(masterSize.height) && masterSize.height > 0 ? masterSize.height : DEFAULT_MASTER_SIZE.height;

  if (safeProjectedWidth === 0 || safeProjectedHeight === 0) {
    return 0;
  }

  return Math.min(safeProjectedWidth / safeMasterWidth, safeProjectedHeight / safeMasterHeight);
}
