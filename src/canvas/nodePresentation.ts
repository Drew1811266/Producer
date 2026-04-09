import { formatNodeTypeLabelZh } from '../copy/zh-CN';
import { formatNodeTypeLabel, type ProjectedGraphNode } from './nodeProjection';
import {
  resolveNodeMasterSize,
  resolveNodeScaleFactor,
  resolveNodeSemanticType,
  usesPortGridShell,
} from './nodeTemplate';

export type NodePresentationShape = 'card' | 'chip' | 'silhouette';
export type NodePresentationChrome = NodePresentationShape | 'anchor';
export type NodePresentationVariant = 'node' | 'anchor';
export type NodePresentationAccentStyle = 'bar' | 'dot' | 'rail' | 'none';
export type NodePresentationContentMode = 'text' | 'media' | 'status' | 'asset-grid';
export type NodePresentationOrnamentStyle = 'standard' | 'panel' | 'port-grid';

export type NodePresentationPalette = {
  surface: string;
  surfaceRaised: string;
  border: string;
  accent: string;
  title: string;
  secondary: string;
  silhouette: string;
  selection: string;
  shadow: string;
};

export type NodePresentation = {
  lod: ProjectedGraphNode['lod'];
  chrome: NodePresentationChrome;
  shape: NodePresentationShape;
  variant: NodePresentationVariant;
  interactive: boolean;
  selected: boolean;
  enterable: boolean;
  borderWidth: number;
  cornerRadius: number;
  accentStyle: NodePresentationAccentStyle;
  showTypeLabel: boolean;
  showTitle: boolean;
  showStatus: boolean;
  typeText: string | null;
  titleText: string | null;
  statusText: string | null;
  contentMode: NodePresentationContentMode;
  ornamentStyle: NodePresentationOrnamentStyle;
  scaleFactor: number;
  typeFontSize: number;
  titleFontSize: number;
  statusFontSize: number;
  headerHeight: number;
  bodyPaddingX: number;
  bodyPaddingTop: number;
  contentTopOffset: number;
  keylineHeight: number;
  keylineInset: number;
  headerPanelWidth: number;
  headerPanelHeight: number;
  headerPanelPaddingX: number;
  headerPanelPaddingTop: number;
  hasActionDot: boolean;
  actionDotDiameter: number;
  actionDotOffsetX: number;
  actionDotOffsetY: number;
  hasConnector: boolean;
  connectorWidth: number;
  connectorHeight: number;
  connectorOffsetY: number;
  hasInputPort: boolean;
  inputPortWidth: number;
  inputPortHeight: number;
  inputPortOffsetY: number;
  hasOutputPort: boolean;
  outputPortWidth: number;
  outputPortHeight: number;
  outputPortOffsetY: number;
  dividerOffsetY: number;
  dividerInsetX: number;
  fileGridRows: number;
  fileGridColumns: number;
  fileGridCapacity: number;
  fileGridActiveCount: number;
  fileGridInsetX: number;
  fileGridInsetBottom: number;
  fileGridInsetTop: number;
  fileGridGap: number;
  fileGridCellRadius: number;
  showAccessoryBlocks: boolean;
  accessoryBlockWidth: number;
  accessoryBlockHeight: number;
  accessoryBlockGap: number;
  accessoryBlockInsetRight: number;
  accessoryBlockBottomOffset: number;
  selectionRingWidth: number;
  selectionRingGap: number;
  thumbnailRadius: number;
  palette: NodePresentationPalette;
};

type ThemeMode = 'light' | 'dark';

type ThemePalette = Omit<NodePresentationPalette, 'accent'>;

const THEME_PALETTES: Record<ThemeMode, ThemePalette> = {
  light: {
    surface: '#fcfdfe',
    surfaceRaised: '#fcfdfe',
    border: '#111318',
    title: '#1b1f26',
    secondary: '#707887',
    silhouette: '#cdd4dd',
    selection: '#5b84ff',
    shadow: 'rgba(17, 19, 24, 0.06)',
  },
  dark: {
    surface: '#1b222d',
    surfaceRaised: '#1b222d',
    border: '#d6deea',
    title: '#eef3f8',
    secondary: '#aab5c1',
    silhouette: '#919bab',
    selection: '#7ea0ff',
    shadow: 'rgba(0, 0, 0, 0.16)',
  },
};

const PORT_GRID_BENCHMARK_TOKENS = {
  titleFontSize: 14,
  titlePaddingX: 10,
  titlePaddingTop: 9,
  portWidth: 42,
  portHeight: 14,
  portOffsetY: 28,
  dividerOffsetRatio: 0.695,
  fileGridInsetX: 9,
  fileGridInsetTop: 8,
  fileGridInsetBottom: 8,
  fileGridGap: 6,
  fileGridCellRadius: 4,
  accessoryBlockSize: 30,
  accessoryBlockGap: 5,
  accessoryBlockInsetRight: 12,
  accessoryBlockBottomOffset: 11,
};

function resolveThemeMode(): ThemeMode {
  if (typeof document !== 'undefined') {
    const explicitTheme = document.documentElement.dataset.theme;

    if (explicitTheme === 'light' || explicitTheme === 'dark') {
      return explicitTheme;
    }
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

function resolveAccentNodeType(node: ProjectedGraphNode): string {
  return resolveNodeSemanticType(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });
}

function resolveNodeAccent(nodeType: string): string {
  switch (nodeType) {
    case 'brief':
      return '#5b84ff';
    case 'storyboard_shot':
      return '#6f8fad';
    case 'still':
      return '#86a285';
    case 'video':
      return '#7697ac';
    case 'reference':
      return '#7e9f90';
    case 'review':
      return '#a08d74';
    case 'result':
      return '#759681';
    case 'prompt':
      return '#b88f57';
    default:
      return '#8f9baa';
  }
}

function resolveContentMode(node: ProjectedGraphNode): NodePresentationContentMode {
  const semanticType = resolveAccentNodeType(node);

  switch (semanticType) {
    case 'still':
    case 'video':
      return 'asset-grid';
    case 'review':
    case 'result':
      return 'status';
    default:
      return 'text';
  }
}

function scaleToken(value: number, scaleFactor: number): number {
  return Number((value * scaleFactor).toFixed(3));
}

function buildNodePalette(node: ProjectedGraphNode): NodePresentationPalette {
  const themeMode = resolveThemeMode();
  const isPortGrid = usesPortGridShell(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });
  const theme = THEME_PALETTES[themeMode];

  if (isPortGrid) {
    if (themeMode === 'dark') {
      return {
        ...theme,
        surface: '#202834',
        surfaceRaised: '#232d39',
        border: '#9aa9bd',
        accent: '#9aa9bd',
        title: '#b7c4d5',
        secondary: '#b7c4d5',
      };
    }

    return {
      ...theme,
      surface: '#ffffff',
      surfaceRaised: '#ffffff',
      border: '#a9b7c9',
      accent: '#a9b7c9',
      title: '#9aa7bb',
      secondary: '#9aa7bb',
    };
  }

  return {
    ...theme,
    accent: resolveNodeAccent(resolveAccentNodeType(node)),
  };
}

export function withHexAlpha(color: string, alpha: number): string {
  const normalizedColor = color.trim();
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  if (!normalizedColor.startsWith('#')) {
    return normalizedColor;
  }

  const hex = normalizedColor.slice(1);
  const value = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex;

  if (value.length !== 6) {
    return normalizedColor;
  }

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function hexToNumber(color: string): number {
  const normalizedColor = color.trim();

  if (!normalizedColor.startsWith('#')) {
    return 0;
  }

  const hex = normalizedColor.slice(1);
  const value = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex;

  return Number.parseInt(value, 16);
}

function buildCardPresentation(
  node: ProjectedGraphNode,
  isSelected: boolean,
  overrides: Partial<NodePresentation>,
): NodePresentation {
  const isAnchor = Boolean(node.isSystem);
  const palette = buildNodePalette(node);
  const ornamentStyle: NodePresentationOrnamentStyle =
    node.lod === 'detail' || node.lod === 'summary' ? 'panel' : 'standard';
  const masterSize = resolveNodeMasterSize(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });
  const scaleFactor = Number((
    node.scaleFactor ??
    resolveNodeScaleFactor(node.screenWidth, node.screenHeight, masterSize)
  ).toFixed(3));
  const usesFullTemplate = ornamentStyle === 'panel';
  const headerHeight = scaleToken(26, scaleFactor);
  const bodyPaddingX = scaleToken(14, scaleFactor);
  const bodyPaddingTop = scaleToken(14, scaleFactor);
  const headerPanelHeight = usesFullTemplate ? scaleToken(34, scaleFactor) : 0;
  const headerPanelWidth = usesFullTemplate
    ? scaleToken(masterSize.width * (124 / 208), scaleFactor)
    : 0;
  const headerPanelPaddingX = usesFullTemplate ? scaleToken(14, scaleFactor) : 0;
  const headerPanelPaddingTop = usesFullTemplate ? scaleToken(10, scaleFactor) : 0;
  const contentTopOffset = usesFullTemplate
    ? Math.max(
        bodyPaddingTop + headerHeight,
        headerPanelHeight + scaleToken(10, scaleFactor),
      )
    : bodyPaddingTop;

  return {
    lod: node.lod,
    chrome: 'card',
    shape: 'card',
    variant: isAnchor ? 'anchor' : 'node',
    interactive: !isAnchor,
    selected: isSelected,
    enterable: Boolean(node.canEnterChildGraph) && !isAnchor,
    borderWidth: scaleToken(1, scaleFactor),
    cornerRadius: scaleToken(14, scaleFactor),
    accentStyle: 'none',
    showTypeLabel: usesFullTemplate,
    showTitle: true,
    showStatus: usesFullTemplate && Boolean(node.status),
    typeText: isAnchor ? formatNodeTypeLabelZh('system_anchor') : formatNodeTypeLabel(node.nodeType),
    titleText: node.title,
    statusText: usesFullTemplate ? node.status ?? null : null,
    contentMode: resolveContentMode(node),
    ornamentStyle,
    scaleFactor,
    typeFontSize: usesFullTemplate ? scaleToken(11, scaleFactor) : 0,
    titleFontSize: usesFullTemplate
      ? scaleToken(16, scaleFactor)
      : node.lod === 'chip'
        ? Math.max(scaleToken(13, scaleFactor), 10)
        : 0,
    statusFontSize: usesFullTemplate ? scaleToken(12, scaleFactor) : 0,
    headerHeight,
    bodyPaddingX,
    bodyPaddingTop,
    contentTopOffset,
    keylineHeight: 0,
    keylineInset: 0,
    headerPanelWidth,
    headerPanelHeight,
    headerPanelPaddingX,
    headerPanelPaddingTop,
    hasActionDot: usesFullTemplate,
    actionDotDiameter: usesFullTemplate ? scaleToken(20, scaleFactor) : 0,
    actionDotOffsetX: usesFullTemplate ? scaleToken(18, scaleFactor) : 0,
    actionDotOffsetY: usesFullTemplate ? scaleToken(16, scaleFactor) : 0,
    hasConnector: usesFullTemplate,
    connectorWidth: usesFullTemplate ? scaleToken(28, scaleFactor) : 0,
    connectorHeight: usesFullTemplate ? scaleToken(12, scaleFactor) : 0,
    connectorOffsetY: usesFullTemplate ? scaleToken(22, scaleFactor) : 0,
    hasInputPort: false,
    inputPortWidth: 0,
    inputPortHeight: 0,
    inputPortOffsetY: 0,
    hasOutputPort: false,
    outputPortWidth: 0,
    outputPortHeight: 0,
    outputPortOffsetY: 0,
    dividerOffsetY: 0,
    dividerInsetX: 0,
    fileGridRows: 0,
    fileGridColumns: 0,
    fileGridCapacity: 0,
    fileGridActiveCount: 0,
    fileGridInsetX: 0,
    fileGridInsetBottom: 0,
    fileGridInsetTop: 0,
    fileGridGap: 0,
    fileGridCellRadius: 0,
    showAccessoryBlocks: false,
    accessoryBlockWidth: 0,
    accessoryBlockHeight: 0,
    accessoryBlockGap: 0,
    accessoryBlockInsetRight: 0,
    accessoryBlockBottomOffset: 0,
    selectionRingWidth: scaleToken(2, scaleFactor),
    selectionRingGap: scaleToken(3, scaleFactor),
    thumbnailRadius: scaleToken(10, scaleFactor),
    palette,
    ...overrides,
  };
}

function buildPortGridPresentation(
  node: ProjectedGraphNode,
  isSelected: boolean,
  overrides: Partial<NodePresentation>,
): NodePresentation {
  const palette = buildNodePalette(node);
  const masterSize = resolveNodeMasterSize(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });
  const scaleFactor = Number((
    node.scaleFactor ??
    resolveNodeScaleFactor(node.screenWidth, node.screenHeight, masterSize)
  ).toFixed(3));
  const fileGridCapacity = 30;

  return {
    lod: node.lod,
    chrome: 'card',
    shape: 'card',
    variant: 'node',
    interactive: true,
    selected: isSelected,
    enterable: Boolean(node.canEnterChildGraph),
    borderWidth: scaleToken(1, scaleFactor),
    cornerRadius: scaleToken(14, scaleFactor),
    accentStyle: 'none',
    showTypeLabel: false,
    showTitle: true,
    showStatus: false,
    typeText: formatNodeTypeLabel(node.nodeType),
    titleText: node.title,
    statusText: node.status ?? null,
    contentMode: resolveContentMode(node),
    ornamentStyle: 'port-grid',
    scaleFactor,
    typeFontSize: 0,
    titleFontSize: scaleToken(PORT_GRID_BENCHMARK_TOKENS.titleFontSize, scaleFactor),
    statusFontSize: scaleToken(12, scaleFactor),
    headerHeight: 0,
    bodyPaddingX: scaleToken(PORT_GRID_BENCHMARK_TOKENS.titlePaddingX, scaleFactor),
    bodyPaddingTop: scaleToken(PORT_GRID_BENCHMARK_TOKENS.titlePaddingTop, scaleFactor),
    contentTopOffset: scaleToken(PORT_GRID_BENCHMARK_TOKENS.titlePaddingTop, scaleFactor),
    keylineHeight: 0,
    keylineInset: 0,
    headerPanelWidth: 0,
    headerPanelHeight: 0,
    headerPanelPaddingX: 0,
    headerPanelPaddingTop: 0,
    hasActionDot: false,
    actionDotDiameter: 0,
    actionDotOffsetX: 0,
    actionDotOffsetY: 0,
    hasConnector: false,
    connectorWidth: 0,
    connectorHeight: 0,
    connectorOffsetY: 0,
    hasInputPort: true,
    inputPortWidth: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portWidth, scaleFactor),
    inputPortHeight: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portHeight, scaleFactor),
    inputPortOffsetY: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portOffsetY, scaleFactor),
    hasOutputPort: true,
    outputPortWidth: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portWidth, scaleFactor),
    outputPortHeight: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portHeight, scaleFactor),
    outputPortOffsetY: scaleToken(PORT_GRID_BENCHMARK_TOKENS.portOffsetY, scaleFactor),
    dividerOffsetY: scaleToken(
      masterSize.height * PORT_GRID_BENCHMARK_TOKENS.dividerOffsetRatio,
      scaleFactor,
    ),
    dividerInsetX: 0,
    fileGridRows: 3,
    fileGridColumns: 10,
    fileGridCapacity,
    fileGridActiveCount: Math.min(node.storedAssetCount ?? 0, fileGridCapacity),
    fileGridInsetX: scaleToken(PORT_GRID_BENCHMARK_TOKENS.fileGridInsetX, scaleFactor),
    fileGridInsetBottom: scaleToken(PORT_GRID_BENCHMARK_TOKENS.fileGridInsetBottom, scaleFactor),
    fileGridInsetTop: scaleToken(PORT_GRID_BENCHMARK_TOKENS.fileGridInsetTop, scaleFactor),
    fileGridGap: scaleToken(PORT_GRID_BENCHMARK_TOKENS.fileGridGap, scaleFactor),
    fileGridCellRadius: scaleToken(PORT_GRID_BENCHMARK_TOKENS.fileGridCellRadius, scaleFactor),
    showAccessoryBlocks: true,
    accessoryBlockWidth: scaleToken(PORT_GRID_BENCHMARK_TOKENS.accessoryBlockSize, scaleFactor),
    accessoryBlockHeight: scaleToken(PORT_GRID_BENCHMARK_TOKENS.accessoryBlockSize, scaleFactor),
    accessoryBlockGap: scaleToken(PORT_GRID_BENCHMARK_TOKENS.accessoryBlockGap, scaleFactor),
    accessoryBlockInsetRight: scaleToken(
      PORT_GRID_BENCHMARK_TOKENS.accessoryBlockInsetRight,
      scaleFactor,
    ),
    accessoryBlockBottomOffset: scaleToken(
      PORT_GRID_BENCHMARK_TOKENS.accessoryBlockBottomOffset,
      scaleFactor,
    ),
    selectionRingWidth: scaleToken(2, scaleFactor),
    selectionRingGap: scaleToken(3, scaleFactor),
    thumbnailRadius: scaleToken(10, scaleFactor),
    palette,
    ...overrides,
  };
}

export function buildNodePresentation(
  node: ProjectedGraphNode,
  isSelected: boolean,
): NodePresentation {
  const shouldUsePortGrid = usesPortGridShell(node.nodeType, {
    isSystem: node.isSystem,
    sourceNodeType: node.sourceNodeType,
  });

  if (shouldUsePortGrid && (node.lod === 'detail' || node.lod === 'summary')) {
    return buildPortGridPresentation(node, isSelected, {});
  }

  switch (node.lod) {
    case 'detail':
      return buildCardPresentation(node, isSelected, {
        showTypeLabel: true,
        showTitle: true,
        showStatus: Boolean(node.status),
        statusText: node.status ?? null,
      });
    case 'summary':
      return buildCardPresentation(node, isSelected, {
        showTypeLabel: true,
        showTitle: true,
        showStatus: Boolean(node.status),
        statusText: node.status ?? null,
      });
    case 'chip':
      return buildCardPresentation(node, isSelected, {
        showTypeLabel: false,
        showTitle: true,
        showStatus: false,
        statusText: null,
        ornamentStyle: 'standard',
        hasActionDot: false,
        hasConnector: false,
      });
    case 'silhouette':
    default:
      return buildCardPresentation(node, isSelected, {
        lod: 'silhouette',
        showTypeLabel: false,
        showTitle: false,
        showStatus: false,
        titleText: null,
        statusText: null,
        ornamentStyle: 'standard',
        hasActionDot: false,
        hasConnector: false,
      });
  }
}
