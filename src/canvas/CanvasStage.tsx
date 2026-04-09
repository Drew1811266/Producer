import { useCallback, useEffect, useRef, useState } from 'react';
import type { Application, Container, Graphics } from 'pixi.js';

import type {
  GraphNodePosition,
  GraphNodeSummary,
  ProjectGraphSummary,
} from '../bridge/contracts';
import {
  buildCanvasEdgePolyline,
  resolveCanvasEdgeLabelPoint,
  resolveVisibleCanvasEdges,
  type CanvasEdge,
} from './canvasEdges';
import { CanvasNodeLayer } from './CanvasNodeLayer';
import type { CameraState, ViewportPoint, ViewportSize } from './camera';
import {
  DEFAULT_VIEWPORT_SIZE,
  measureViewport,
  panCamera,
  sanitizeCamera,
  zoomCameraAroundPoint,
} from './camera';
import { buildNodePresentation, hexToNumber } from './nodePresentation';
import { formatNodeTypeLabel, projectGraphNodes } from './nodeProjection';
import {
  alignScreenLine,
  resolveCanvasResolution,
  snapScreenPoint,
  snapScreenRect,
  subscribeToDevicePixelRatioChanges,
} from './rendering';

const NODE_DRAG_THRESHOLD_PX = 4;
const CANVAS_PAN_THRESHOLD_PX = 4;
const CANVAS_FONT_STACK = 'SF Pro Display, Avenir Next, Segoe UI, sans-serif';

type StagePalette = {
  background: string;
  gridMajor: string;
  gridMinor: string;
};

function resolveThemeMode(): 'light' | 'dark' {
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

function resolveStagePalette(): StagePalette {
  if (resolveThemeMode() === 'dark') {
    return {
      background: '#151b23',
      gridMajor: '#d3deea',
      gridMinor: '#d3deea',
    };
  }

  return {
    background: '#f6f7f9',
    gridMajor: '#111318',
    gridMinor: '#111318',
  };
}

function resolveHostCanvasBackground(): string {
  return resolveStagePalette().background;
}

type CanvasStageProps = {
  graph: ProjectGraphSummary;
  camera: CameraState;
  edges?: CanvasEdge[];
  nodes: GraphNodeSummary[];
  selectedNodeId: string | null;
  onCanvasPointerChange?(point: ViewportPoint): void;
  onCameraChange(camera: CameraState): void;
  onEnterNode?(nodeId: string): void;
  onNodeDragStateChange?(nodeId: string | null): void;
  onNodePositionCommit?(nodeId: string, position: GraphNodePosition): void;
  onNodePositionPreview?(nodeId: string, position: GraphNodePosition): void;
  onQuickAddRequest?(): void;
  onSelectedNodeChange(nodeId: string | null): void;
};

type StageScene = {
  app: Application;
  background: Graphics;
  grid: Graphics;
  edgeLayer: Container;
  nodeGeometryLayer: Container;
  nodeTextLayer: Container;
  redraw(): void;
  destroy(): void;
};

type CanvasPanDragState = {
  kind: 'canvas-pan';
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  pointerId?: number;
  moved: boolean;
};

type NodeDragState = {
  kind: 'node-drag';
  nodeId: string;
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  pointerId?: number;
  dragging: boolean;
};

type DragState = CanvasPanDragState | NodeDragState;

function isJsdomEnvironment(): boolean {
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
}

function getViewportSize(host: HTMLDivElement, fallback: ViewportSize = DEFAULT_VIEWPORT_SIZE): ViewportSize {
  return measureViewport(host, fallback);
}

function toViewportPoint(
  host: HTMLDivElement,
  clientX: number,
  clientY: number,
): ViewportPoint {
  const bounds = host.getBoundingClientRect();

  return {
    x: clientX - bounds.left,
    y: clientY - bounds.top,
  };
}

function approximateEdgeLabelWidth(labelText: string): number {
  return Math.max(52, labelText.length * 7.4 + 18);
}

function scaleToken(value: number, scaleFactor: number): number {
  return value * scaleFactor;
}

function resolveInteractiveNodeAtPoint(
  nodes: GraphNodeSummary[],
  camera: CameraState,
  viewport: ViewportSize,
  point: ViewportPoint,
) {
  const projectedNodes = projectGraphNodes(nodes, camera, viewport);

  return [...projectedNodes]
    .reverse()
    .find(
      (node) =>
        !node.isSystem &&
        point.x >= node.screenX &&
        point.x <= node.screenX + node.screenWidth &&
        point.y >= node.screenY &&
        point.y <= node.screenY + node.screenHeight,
    ) ?? null;
}

function drawGrid(
  grid: Graphics,
  viewport: ViewportSize,
  camera: CameraState,
  resolution: number,
) {
  const palette = resolveStagePalette();
  const darkMode = resolveThemeMode() === 'dark';
  const safeCamera = sanitizeCamera(camera);
  const originX = viewport.width / 2 + safeCamera.x;
  const originY = viewport.height / 2 + safeCamera.y;
  const worldLeft = (-originX) / safeCamera.zoom;
  const worldRight = (viewport.width - originX) / safeCamera.zoom;
  const worldTop = (-originY) / safeCamera.zoom;
  const worldBottom = (viewport.height - originY) / safeCamera.zoom;
  const startWorldX = Math.floor(worldLeft / 48) * 48;
  const startWorldY = Math.floor(worldTop / 48) * 48;

  grid.clear();

  for (let x = startWorldX; x <= worldRight; x += 48) {
    const lineX = alignScreenLine(originX + x * safeCamera.zoom, 1, resolution);

    grid.moveTo(lineX, 0).lineTo(lineX, viewport.height).stroke({
      width: 1,
      color: hexToNumber(x % 192 === 0 ? palette.gridMajor : palette.gridMinor),
      alpha: x % 192 === 0 ? (darkMode ? 0.12 : 0.035) : darkMode ? 0.06 : 0.018,
    });
  }

  for (let y = startWorldY; y <= worldBottom; y += 48) {
    const lineY = alignScreenLine(originY + y * safeCamera.zoom, 1, resolution);

    grid.moveTo(0, lineY).lineTo(viewport.width, lineY).stroke({
      width: 1,
      color: hexToNumber(y % 192 === 0 ? palette.gridMajor : palette.gridMinor),
      alpha: y % 192 === 0 ? (darkMode ? 0.12 : 0.035) : darkMode ? 0.06 : 0.018,
    });
  }
}

function syncScene(
  scene: StageScene,
  host: HTMLDivElement,
  camera: CameraState,
) {
  const viewport = getViewportSize(host);
  const palette = resolveStagePalette();

  scene.app.renderer.resize(viewport.width, viewport.height);
  scene.background.clear().rect(0, 0, viewport.width, viewport.height).fill({
    color: hexToNumber(palette.background),
    alpha: 1,
  });
  drawGrid(
    scene.grid,
    viewport,
    camera,
    resolveCanvasResolution(scene.app.renderer.resolution),
  );
}

export function CanvasStage({
  graph,
  camera,
  edges = [],
  nodes,
  selectedNodeId,
  onCanvasPointerChange = () => undefined,
  onCameraChange,
  onEnterNode = () => undefined,
  onNodeDragStateChange = () => undefined,
  onNodePositionCommit,
  onNodePositionPreview,
  onQuickAddRequest = () => undefined,
  onSelectedNodeChange,
}: CanvasStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<StageScene | null>(null);
  const cameraRef = useRef(camera);
  const edgesRef = useRef(edges);
  const nodesRef = useRef(nodes);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const onCanvasPointerChangeRef = useRef(onCanvasPointerChange);
  const onEnterNodeRef = useRef(onEnterNode);
  const onNodeDragStateChangeRef = useRef(onNodeDragStateChange);
  const onNodePositionCommitRef = useRef(onNodePositionCommit ?? (() => undefined));
  const onNodePositionPreviewRef = useRef(onNodePositionPreview ?? (() => undefined));
  const onQuickAddRequestRef = useRef(onQuickAddRequest);
  const onSelectedNodeChangeRef = useRef(onSelectedNodeChange);
  const dragRef = useRef<DragState | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const suppressSelectionClickRef = useRef(false);
  const [rendererStatus, setRendererStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [viewportSize, setViewportSize] = useState<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
  const handleNodeTap = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((entry) => entry.id === nodeId);

    if (!node || node.isSystem) {
      return;
    }

    onSelectedNodeChangeRef.current(node.id);
  }, []);
  const setHoveredNodeId = useCallback((nextNodeId: string | null) => {
    if (hoveredNodeIdRef.current === nextNodeId) {
      return;
    }

    hoveredNodeIdRef.current = nextNodeId;
    sceneRef.current?.redraw();
  }, []);
  const syncHoveredNode = useCallback((
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
  ) => {
    const interactiveNode = resolveInteractiveNodeAtPoint(
      nodesRef.current,
      cameraRef.current,
      getViewportSize(host),
      toViewportPoint(host, clientX, clientY),
    );

    setHoveredNodeId(interactiveNode?.id ?? null);
  }, [setHoveredNodeId]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    onCanvasPointerChangeRef.current = onCanvasPointerChange;
  }, [onCanvasPointerChange]);

  useEffect(() => {
    onEnterNodeRef.current = onEnterNode;
  }, [onEnterNode]);

  useEffect(() => {
    onNodeDragStateChangeRef.current = onNodeDragStateChange;
  }, [onNodeDragStateChange]);

  useEffect(() => {
    onNodePositionCommitRef.current = onNodePositionCommit ?? (() => undefined);
  }, [onNodePositionCommit]);

  useEffect(() => {
    onNodePositionPreviewRef.current = onNodePositionPreview ?? (() => undefined);
  }, [onNodePositionPreview]);

  useEffect(() => {
    onQuickAddRequestRef.current = onQuickAddRequest;
  }, [onQuickAddRequest]);

  useEffect(() => {
    onSelectedNodeChangeRef.current = onSelectedNodeChange;
  }, [onSelectedNodeChange]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const syncViewportSize = () => {
      setViewportSize((current) => {
        const nextViewport = getViewportSize(host, current);

        return current.width === nextViewport.width && current.height === nextViewport.height
          ? current
          : nextViewport;
      });
      sceneRef.current?.redraw();
    };

    syncViewportSize();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncViewportSize) : null;

    resizeObserver?.observe(host);
    window.addEventListener('resize', syncViewportSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncViewportSize);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    if (isJsdomEnvironment()) {
      setRendererStatus('fallback');

      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const pixi = await import('pixi.js');
        const { Application, Container, Graphics, Text, TextStyle } = pixi;
        const app = new Application();
        const initialResolution = resolveCanvasResolution(window.devicePixelRatio);

        await app.init({
          antialias: true,
          autoDensity: true,
          backgroundAlpha: 0,
          resizeTo: host,
          resolution: initialResolution,
          roundPixels: true,
        });

        if (disposed) {
          app.destroy();

          return;
        }

        app.canvas.classList.add('canvas-stage-surface');

        const background = new Graphics();
        const grid = new Graphics();
        const edgeLayer = new Container();
        const nodeGeometryLayer = new Container();
        const nodeTextLayer = new Container();
        app.stage.addChild(background);
        app.stage.addChild(grid);
        app.stage.addChild(edgeLayer);
        app.stage.addChild(nodeGeometryLayer);
        app.stage.addChild(nodeTextLayer);
        host.appendChild(app.canvas);

        const scene: StageScene = {
          app,
          background,
          grid,
          edgeLayer,
          nodeGeometryLayer,
          nodeTextLayer,
          redraw() {
            syncScene(scene, host, cameraRef.current);
            const viewport = getViewportSize(host);
            const resolution = resolveCanvasResolution(scene.app.renderer.resolution);
            const projectedNodes = projectGraphNodes(
              nodesRef.current,
              cameraRef.current,
              viewport,
            );
            const activeDraggedNodeId =
              dragRef.current?.kind === 'node-drag' ? dragRef.current.nodeId : null;
            const orderedProjectedNodes = activeDraggedNodeId
              ? [
                  ...projectedNodes.filter((node) => node.id !== activeDraggedNodeId),
                  ...projectedNodes.filter((node) => node.id === activeDraggedNodeId),
                ]
              : projectedNodes;
            const visibleEdges = resolveVisibleCanvasEdges(
              edgesRef.current,
              projectedNodes,
              selectedNodeIdRef.current,
            );
            const removedEdges = scene.edgeLayer.removeChildren();
            removedEdges.forEach((child) => {
              child.destroy({ children: true });
            });
            const removedGeometry = scene.nodeGeometryLayer.removeChildren();
            const removedText = scene.nodeTextLayer.removeChildren();
            removedGeometry.forEach((child) => {
              child.destroy({ children: true });
            });
            removedText.forEach((child) => {
              child.destroy({ children: true });
            });

            visibleEdges.forEach((edge) => {
              const edgeGroup = new Container();
              const edgeGraphic = new Graphics();
              const strokeWidth = Math.max(1, Math.round(edge.strokeWidth));
              const points = buildCanvasEdgePolyline(edge.sourceNode, edge.targetNode, 'screen').map(
                (point) => ({
                  x: alignScreenLine(point.x, strokeWidth, resolution),
                  y: alignScreenLine(point.y, strokeWidth, resolution),
                }),
              );

              edgeGraphic.moveTo(points[0].x, points[0].y);
              points.slice(1).forEach((point) => {
                edgeGraphic.lineTo(point.x, point.y);
              });
              edgeGraphic.stroke({
                width: strokeWidth,
                color: hexToNumber(edge.strokeColor),
                alpha: edge.strokeAlpha,
                cap: 'round',
                join: 'round',
              });
              edgeGroup.addChild(edgeGraphic);

              if (edge.showLabel && edge.labelText) {
                const labelPoint = snapScreenPoint(
                  resolveCanvasEdgeLabelPoint(points),
                  resolution,
                );
                const labelWidth = approximateEdgeLabelWidth(edge.labelText);
                const labelContainer = new Container();
                const labelBackground = new Graphics();
                const labelText = new Text({
                  text: edge.labelText,
                  style: new TextStyle({
                    fill: edge.labelColor,
                    fontFamily: CANVAS_FONT_STACK,
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 0.1,
                  }),
                });

                labelBackground.roundRect(-labelWidth / 2, -10, labelWidth, 20, 10).fill({
                  color: hexToNumber(edge.labelBackground),
                  alpha: 0.92,
                });
                labelBackground.roundRect(-labelWidth / 2, -10, labelWidth, 20, 10).stroke({
                  color: hexToNumber(edge.strokeColor),
                  alpha: 0.24,
                  width: 1,
                });
                labelText.anchor.set(0.5);
                labelContainer.position.set(labelPoint.x, labelPoint.y);
                labelContainer.addChild(labelBackground);
                labelContainer.addChild(labelText);
                edgeGroup.addChild(labelContainer);
              }

              scene.edgeLayer.addChild(edgeGroup);
            });

            orderedProjectedNodes.forEach((node) => {
              const geometry = new Container();
              const textGroup = new Container();
              const body = new Graphics();
              const isSystem = Boolean(node.isSystem);
              const isSelected = node.id === selectedNodeIdRef.current;
              const isHovered = node.id === hoveredNodeIdRef.current;
              const isDragging = node.id === activeDraggedNodeId;
              const presentation = buildNodePresentation(node, isSelected);
              const isPortGrid = presentation.ornamentStyle === 'port-grid';
              const showHeaderTag =
                presentation.ornamentStyle === 'panel' &&
                presentation.headerPanelWidth > 0 &&
                presentation.headerPanelHeight > 0;
              const showActionControls =
                !isPortGrid &&
                (isSelected || isHovered) &&
                presentation.hasActionDot &&
                presentation.hasConnector;
              const borderColor = presentation.palette.border;
              const isDarkTheme = resolveThemeMode() === 'dark';
              const borderAlpha = isPortGrid ? 1 : isDarkTheme ? 0.16 : 0.08;
              const ornamentBorderAlpha = isPortGrid ? 1 : isDarkTheme ? 0.22 : 0.18;
              const headerTagFillAlpha = resolveThemeMode() === 'dark' ? 0.18 : 0.12;
              const fillAlpha = 1;
              const contentInsetLeft = presentation.bodyPaddingX;
              const snappedRect = snapScreenRect(
                {
                  x: node.screenX,
                  y: node.screenY,
                  width: node.screenWidth,
                  height: node.screenHeight,
                },
                resolution,
              );
              const bodyTop = presentation.contentTopOffset;
              const headerTagWidth = showHeaderTag
                ? Math.max(Math.min(presentation.headerPanelWidth, snappedRect.width - presentation.bodyPaddingX * 2), 40)
                : 0;

              geometry.position.set(snappedRect.x, snappedRect.y);
              geometry.eventMode = 'static';
              geometry.cursor = isDragging ? 'grabbing' : presentation.interactive ? 'pointer' : 'default';
              body.roundRect(0, 0, snappedRect.width, snappedRect.height, presentation.cornerRadius).fill({
                color: hexToNumber(presentation.palette.surface),
                alpha: fillAlpha,
              });
              body.roundRect(0, 0, snappedRect.width, snappedRect.height, presentation.cornerRadius).stroke({
                color: hexToNumber(borderColor),
                alpha: borderAlpha,
                width: presentation.borderWidth,
              });
              geometry.addChild(body);

              if (showHeaderTag) {
                const headerTag = new Graphics();
                headerTag.roundRect(
                  0,
                  0,
                  headerTagWidth,
                  presentation.headerPanelHeight,
                  presentation.cornerRadius,
                ).fill({
                  color: hexToNumber(presentation.palette.accent),
                  alpha: headerTagFillAlpha,
                });
                headerTag.roundRect(
                  0,
                  0,
                  headerTagWidth,
                  presentation.headerPanelHeight,
                  presentation.cornerRadius,
                ).stroke({
                  color: hexToNumber(borderColor),
                  alpha: ornamentBorderAlpha,
                  width: 1,
                });
                geometry.addChild(headerTag);
              }

              if (isSelected) {
                const selectionRing = new Graphics();
                const ringInset = presentation.selectionRingGap + presentation.selectionRingWidth / 2;
                selectionRing.roundRect(
                  -ringInset,
                  -ringInset,
                  snappedRect.width + ringInset * 2,
                  snappedRect.height + ringInset * 2,
                  presentation.cornerRadius + ringInset,
                ).stroke({
                  color: hexToNumber(presentation.palette.selection),
                  alpha: 0.9,
                  width: presentation.selectionRingWidth,
                });
                geometry.addChild(selectionRing);
              }

              if (isPortGrid) {
                const ornamentStrokeWidth = Math.max(presentation.borderWidth, 0.75);
                if (presentation.hasInputPort) {
                  const inputPort = new Graphics();
                  const portX = (snappedRect.width - presentation.inputPortWidth) / 2;
                  const portY = -presentation.inputPortOffsetY;

                  inputPort.roundRect(
                    portX,
                    portY,
                    presentation.inputPortWidth,
                    presentation.inputPortHeight,
                    presentation.inputPortHeight / 2,
                  ).fill({
                    color: hexToNumber(presentation.palette.surface),
                    alpha: fillAlpha,
                  });
                  inputPort.roundRect(
                    portX,
                    portY,
                    presentation.inputPortWidth,
                    presentation.inputPortHeight,
                    presentation.inputPortHeight / 2,
                  ).stroke({
                    color: hexToNumber(borderColor),
                    alpha: ornamentBorderAlpha,
                    width: ornamentStrokeWidth,
                  });
                  geometry.addChild(inputPort);
                }

                if (presentation.hasOutputPort) {
                  const outputPort = new Graphics();
                  const portX = (snappedRect.width - presentation.outputPortWidth) / 2;
                  const portY = snappedRect.height + Math.max(
                    presentation.outputPortOffsetY - presentation.outputPortHeight,
                    0,
                  );

                  outputPort.roundRect(
                    portX,
                    portY,
                    presentation.outputPortWidth,
                    presentation.outputPortHeight,
                    presentation.outputPortHeight / 2,
                  ).fill({
                    color: hexToNumber(presentation.palette.surface),
                    alpha: fillAlpha,
                  });
                  outputPort.roundRect(
                    portX,
                    portY,
                    presentation.outputPortWidth,
                    presentation.outputPortHeight,
                    presentation.outputPortHeight / 2,
                  ).stroke({
                    color: hexToNumber(borderColor),
                    alpha: ornamentBorderAlpha,
                    width: ornamentStrokeWidth,
                  });
                  geometry.addChild(outputPort);
                }

                const dividerY = Math.min(
                  Math.max(presentation.dividerOffsetY, presentation.bodyPaddingTop + scaleToken(20, presentation.scaleFactor)),
                  snappedRect.height - presentation.fileGridInsetBottom - scaleToken(18, presentation.scaleFactor),
                );
                const gridPanel = new Graphics();
                gridPanel.rect(
                  0,
                  dividerY,
                  snappedRect.width,
                  Math.max(snappedRect.height - dividerY, 1),
                ).fill({
                  color: hexToNumber(isDarkTheme ? '#2a3441' : '#f3f6f9'),
                  alpha: 1,
                });
                geometry.addChild(gridPanel);
                const divider = new Graphics();
                divider.rect(
                  presentation.dividerInsetX,
                  dividerY,
                  Math.max(snappedRect.width - presentation.dividerInsetX * 2, 1),
                  1,
                ).fill({
                  color: hexToNumber(borderColor),
                  alpha: isDarkTheme ? 0.72 : 0.58,
                });
                geometry.addChild(divider);

                if (presentation.showAccessoryBlocks) {
                  for (let index = 1; index >= 0; index -= 1) {
                    const accessory = new Graphics();
                    const accessoryX =
                      snappedRect.width -
                      presentation.accessoryBlockInsetRight -
                      presentation.accessoryBlockWidth -
                      index * (presentation.accessoryBlockWidth + presentation.accessoryBlockGap);
                    const accessoryY =
                      dividerY -
                      presentation.accessoryBlockBottomOffset -
                      presentation.accessoryBlockHeight;

                    accessory.roundRect(
                      accessoryX,
                      accessoryY,
                      presentation.accessoryBlockWidth,
                      presentation.accessoryBlockHeight,
                      Math.min(presentation.cornerRadius * 0.7, presentation.accessoryBlockHeight / 2),
                    ).fill({
                      color: hexToNumber(presentation.palette.surfaceRaised),
                      alpha: 0.88,
                    });
                    accessory.roundRect(
                      accessoryX,
                      accessoryY,
                      presentation.accessoryBlockWidth,
                      presentation.accessoryBlockHeight,
                      Math.min(presentation.cornerRadius * 0.7, presentation.accessoryBlockHeight / 2),
                    ).stroke({
                      color: hexToNumber(borderColor),
                      alpha: isDarkTheme ? 0.8 : 0.72,
                      width: ornamentStrokeWidth,
                    });
                    geometry.addChild(accessory);
                  }
                }

                const gridLeft = presentation.fileGridInsetX;
                const gridTop = dividerY + presentation.fileGridInsetTop;
                const gridWidth = Math.max(snappedRect.width - presentation.fileGridInsetX * 2, 12);
                const gridHeight = Math.max(
                  snappedRect.height - gridTop - presentation.fileGridInsetBottom,
                  12,
                );
                const horizontalGapTotal =
                  presentation.fileGridGap * (presentation.fileGridColumns - 1);
                const verticalGapTotal =
                  presentation.fileGridGap * (presentation.fileGridRows - 1);
                const cellSize = Math.max(
                  Math.min(
                    (gridWidth - horizontalGapTotal) / presentation.fileGridColumns,
                    (gridHeight - verticalGapTotal) / presentation.fileGridRows,
                  ),
                  2,
                );
                const actualGridWidth =
                  cellSize * presentation.fileGridColumns + horizontalGapTotal;
                const actualGridHeight =
                  cellSize * presentation.fileGridRows + verticalGapTotal;
                const gridStartX = gridLeft + Math.max((gridWidth - actualGridWidth) / 2, 0);
                const gridStartY = gridTop + Math.max((gridHeight - actualGridHeight) / 2, 0);
                const fileGrid = new Graphics();

                for (let index = 0; index < presentation.fileGridCapacity; index += 1) {
                  const column = index % presentation.fileGridColumns;
                  const row = Math.floor(index / presentation.fileGridColumns);
                  const cellX = gridStartX + column * (cellSize + presentation.fileGridGap);
                  const cellY = gridStartY + row * (cellSize + presentation.fileGridGap);
                  const filled = index < presentation.fileGridActiveCount;

                  fileGrid.roundRect(
                    cellX,
                    cellY,
                    cellSize,
                    cellSize,
                    Math.min(presentation.fileGridCellRadius, cellSize / 2),
                  ).fill({
                    color: filled
                      ? hexToNumber('#5eb773')
                      : hexToNumber(isDarkTheme ? '#314050' : '#e4ebf3'),
                    alpha: 1,
                  });
                  fileGrid.roundRect(
                    cellX,
                    cellY,
                    cellSize,
                    cellSize,
                    Math.min(presentation.fileGridCellRadius, cellSize / 2),
                  ).stroke({
                    color: hexToNumber(filled ? '#5eb773' : isDarkTheme ? '#8ea0b6' : '#bcc9d9'),
                    alpha: filled ? 0.72 : 1,
                    width: Math.max(0.75, presentation.borderWidth),
                  });
                }

                geometry.addChild(fileGrid);
              }

              if (showActionControls) {
                const actionDot = new Graphics();
                const actionRadius = presentation.actionDotDiameter / 2;
                const actionCenterX = Math.max(
                  snappedRect.width - actionRadius - presentation.actionDotOffsetX,
                  headerTagWidth + actionRadius + presentation.bodyPaddingX,
                );
                const actionCenterY = presentation.actionDotOffsetY + actionRadius;

                actionDot.circle(actionCenterX, actionCenterY, actionRadius).stroke({
                  color: hexToNumber(borderColor),
                  alpha: ornamentBorderAlpha,
                  width: Math.max(presentation.borderWidth, 0.75),
                });
                geometry.addChild(actionDot);

                const connector = new Graphics();
                const connectorX = (snappedRect.width - presentation.connectorWidth) / 2;
                const connectorY = snappedRect.height + Math.max(presentation.connectorOffsetY - presentation.connectorHeight, 0);

                connector.roundRect(
                  connectorX,
                  connectorY,
                  presentation.connectorWidth,
                  presentation.connectorHeight,
                  presentation.connectorHeight / 2,
                ).fill({
                  color: hexToNumber(presentation.palette.surface),
                  alpha: fillAlpha,
                });
                connector.roundRect(
                  connectorX,
                  connectorY,
                  presentation.connectorWidth,
                  presentation.connectorHeight,
                  presentation.connectorHeight / 2,
                ).stroke({
                  color: hexToNumber(borderColor),
                  alpha: ornamentBorderAlpha,
                  width: Math.max(presentation.borderWidth, 0.75),
                });
                geometry.addChild(connector);
              }

              if (
                !isPortGrid &&
                presentation.contentMode === 'media' &&
                presentation.lod !== 'silhouette'
              ) {
                const thumbnailSlot = new Graphics();
                const slotX = presentation.bodyPaddingX;
                const slotY = presentation.contentTopOffset;
                const slotWidth = Math.max(snappedRect.width - presentation.bodyPaddingX * 2, 12);
                const slotHeight = Math.max(
                  Math.min(snappedRect.height * 0.42, snappedRect.height - slotY - scaleToken(28, presentation.scaleFactor)),
                  18,
                );
                thumbnailSlot.roundRect(
                  slotX,
                  slotY,
                  slotWidth,
                  slotHeight,
                  presentation.thumbnailRadius,
                ).fill({
                  color: hexToNumber(presentation.palette.accent),
                  alpha: resolveThemeMode() === 'dark' ? 0.1 : 0.08,
                });
                thumbnailSlot.roundRect(
                  slotX,
                  slotY,
                  slotWidth,
                  slotHeight,
                  presentation.thumbnailRadius,
                ).stroke({
                  color: hexToNumber(presentation.palette.border),
                  alpha: resolveThemeMode() === 'dark' ? 0.14 : 0.08,
                  width: 1,
                });
                geometry.addChild(thumbnailSlot);
              }

              textGroup.position.set(snappedRect.x, snappedRect.y);
              textGroup.eventMode = 'none';

              if (presentation.showTypeLabel && presentation.typeText) {
                const typeLabel = new Text({
                  text:
                    presentation.typeText ??
                    (isSystem ? '上下文锚点' : formatNodeTypeLabel(node.nodeType)),
                  style: new TextStyle({
                    fill: presentation.palette.accent,
                    fontFamily: CANVAS_FONT_STACK,
                    fontSize: presentation.typeFontSize,
                    fontWeight: '500',
                    letterSpacing: 0.3,
                  }),
                });
                const typePosition = snapScreenPoint(
                  {
                    x: contentInsetLeft,
                    y: showHeaderTag ? presentation.headerPanelPaddingTop : presentation.bodyPaddingTop,
                  },
                  resolution,
                );

                typeLabel.position.set(typePosition.x, typePosition.y);
                textGroup.addChild(typeLabel);
              }

              if (presentation.showTitle && presentation.titleText) {
                const isCompactTitle = presentation.lod === 'chip';
                const titleWrapWidth = Math.max(
                  snappedRect.width - presentation.bodyPaddingX * 2,
                  48,
                );
                const title = new Text({
                  text: presentation.titleText,
                  style: new TextStyle({
                    align: isCompactTitle ? 'center' : 'left',
                    fill: isPortGrid ? presentation.palette.title : presentation.palette.title,
                    fontFamily: CANVAS_FONT_STACK,
                    fontSize: isCompactTitle ? presentation.titleFontSize : presentation.titleFontSize,
                    fontWeight: isPortGrid ? '500' : '600',
                    letterSpacing: -0.24,
                    wordWrap: !isCompactTitle,
                    wordWrapWidth: titleWrapWidth,
                  }),
                });

                if (isCompactTitle) {
                  title.position.set(
                    Math.max((snappedRect.width - title.width) / 2, 8),
                    Math.max((snappedRect.height - title.height) / 2, 6),
                  );
                } else if (isPortGrid) {
                  const titlePosition = snapScreenPoint(
                    {
                      x: contentInsetLeft,
                      y: presentation.bodyPaddingTop,
                    },
                    resolution,
                  );

                  title.position.set(titlePosition.x, titlePosition.y);
                } else {
                  const titleY = presentation.contentMode === 'media'
                    ? Math.max(snappedRect.height - title.height - 30, bodyTop)
                    : bodyTop;
                  const titlePosition = snapScreenPoint(
                    {
                      x: contentInsetLeft,
                      y: titleY,
                    },
                    resolution,
                  );

                  title.position.set(titlePosition.x, titlePosition.y);
                }
                textGroup.addChild(title);
              }

              if (presentation.showStatus && presentation.statusText) {
                const status = new Text({
                  text: presentation.statusText,
                  style: new TextStyle({
                    fill: presentation.palette.secondary,
                    fontFamily: CANVAS_FONT_STACK,
                    fontSize: presentation.statusFontSize,
                    fontWeight: '400',
                  }),
                });
                const statusY = isPortGrid
                  ? presentation.bodyPaddingTop + scaleToken(26, presentation.scaleFactor)
                  : presentation.contentMode === 'media'
                    ? snappedRect.height - scaleToken(20, presentation.scaleFactor)
                    : bodyTop + scaleToken(24, presentation.scaleFactor);
                const statusPosition = snapScreenPoint(
                  {
                    x: contentInsetLeft,
                    y: statusY,
                  },
                  resolution,
                );

                status.position.set(statusPosition.x, statusPosition.y);
                textGroup.addChild(status);
              }

              scene.nodeGeometryLayer.addChild(geometry);
              scene.nodeTextLayer.addChild(textGroup);
            });
          },
          destroy() {
            if (host.contains(app.canvas)) {
              host.removeChild(app.canvas);
            }

            app.destroy();
          },
        };

        sceneRef.current = scene;
        const detachDprListener = subscribeToDevicePixelRatioChanges((nextResolution) => {
          app.renderer.resolution = nextResolution;
          scene.redraw();
        });
        scene.redraw();
        setRendererStatus('ready');

        if (disposed) {
          detachDprListener();
        }

        const originalDestroy = scene.destroy.bind(scene);
        scene.destroy = () => {
          detachDprListener();
          originalDestroy();
        };
      } catch {
        setRendererStatus('fallback');
      }
    })();

    return () => {
      disposed = true;
      dragRef.current = null;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [handleNodeTap]);

  useEffect(() => {
    sceneRef.current?.redraw();
  }, [camera, edges, graph, nodes, selectedNodeId]);

  function endDrag(host?: HTMLDivElement | null) {
    if (dragRef.current?.kind === 'node-drag' && dragRef.current.dragging) {
      onNodeDragStateChangeRef.current(null);
    }

    if (host && dragRef.current?.pointerId !== undefined) {
      host.releasePointerCapture?.(dragRef.current.pointerId);
    }

    dragRef.current = null;
    sceneRef.current?.redraw();
  }

  function beginNodeDrag(
    host: HTMLDivElement,
    nodeId: string,
    clientX: number,
    clientY: number,
    pointerId?: number,
  ) {
    const node = nodesRef.current.find((entry) => entry.id === nodeId && !entry.isSystem);

    if (!node) {
      return false;
    }

    suppressSelectionClickRef.current = true;
    dragRef.current = {
      kind: 'node-drag',
      nodeId,
      originX: node.layout.x,
      originY: node.layout.y,
      clientX,
      clientY,
      pointerId,
      dragging: false,
    };

    if (pointerId !== undefined) {
      host.setPointerCapture?.(pointerId);
    }

    sceneRef.current?.redraw();

    return true;
  }

  return (
    <div
      ref={hostRef}
      className="canvas-stage"
      data-graph-id={graph.id}
      data-pixi-status={rendererStatus}
      data-testid="canvas-stage-host"
      style={{
        background: resolveHostCanvasBackground(),
      }}
      tabIndex={0}
      onClick={() => {
        if (suppressSelectionClickRef.current) {
          suppressSelectionClickRef.current = false;

          return;
        }

        onSelectedNodeChange(null);
      }}
      onDoubleClick={(event) => {
        const host = event.currentTarget;
        const pointerPoint = toViewportPoint(host, event.clientX, event.clientY);
        const interactiveNode = resolveInteractiveNodeAtPoint(
          nodesRef.current,
          cameraRef.current,
          getViewportSize(host, viewportSize),
          pointerPoint,
        );

        if (!interactiveNode?.canEnterChildGraph) {
          return;
        }

        suppressSelectionClickRef.current = true;
        onEnterNodeRef.current(interactiveNode.id);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        const host = event.currentTarget;
        const pointerPoint = toViewportPoint(host, event.clientX, event.clientY);

        host.focus();
        onCanvasPointerChangeRef.current(
          pointerPoint,
        );

        const interactiveNode = resolveInteractiveNodeAtPoint(
          nodesRef.current,
          cameraRef.current,
          getViewportSize(host),
          pointerPoint,
        );

        if (
          rendererStatus === 'ready' &&
          interactiveNode &&
          beginNodeDrag(host, interactiveNode.id, event.clientX, event.clientY, event.pointerId)
        ) {
          setHoveredNodeId(interactiveNode.id);
          return;
        }

        setHoveredNodeId(null);
        suppressSelectionClickRef.current = false;
        dragRef.current = {
          kind: 'canvas-pan',
          startClientX: event.clientX,
          startClientY: event.clientY,
          clientX: event.clientX,
          clientY: event.clientY,
          pointerId: event.pointerId,
          moved: false,
        };

        if (event.pointerId !== undefined) {
          host.setPointerCapture?.(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        onCanvasPointerChangeRef.current(
          toViewportPoint(event.currentTarget, event.clientX, event.clientY),
        );

        const dragState = dragRef.current;

        if (!dragState) {
          if (rendererStatus === 'ready') {
            syncHoveredNode(event.currentTarget, event.clientX, event.clientY);
          }
          return;
        }

        if (dragState.kind === 'canvas-pan') {
          setHoveredNodeId(null);
          const distance = Math.max(
            Math.abs(event.clientX - dragState.startClientX),
            Math.abs(event.clientY - dragState.startClientY),
          );
          const deltaX = event.clientX - dragState.clientX;
          const deltaY = event.clientY - dragState.clientY;

          if (!dragState.moved && distance < CANVAS_PAN_THRESHOLD_PX) {
            return;
          }

          dragRef.current = {
            kind: 'canvas-pan',
            startClientX: dragState.startClientX,
            startClientY: dragState.startClientY,
            clientX: event.clientX,
            clientY: event.clientY,
            pointerId: dragState.pointerId,
            moved: true,
          };
          suppressSelectionClickRef.current = true;
          onCameraChange(panCamera(cameraRef.current, deltaX, deltaY));

          return;
        }

        setHoveredNodeId(dragState.nodeId);
        const deltaX = event.clientX - dragState.clientX;
        const deltaY = event.clientY - dragState.clientY;
        const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));

        if (!dragState.dragging && distance < NODE_DRAG_THRESHOLD_PX) {
          return;
        }

        if (!dragState.dragging) {
          dragRef.current = {
            ...dragState,
            dragging: true,
          };
          onSelectedNodeChangeRef.current(dragState.nodeId);
          onNodeDragStateChangeRef.current(dragState.nodeId);
          sceneRef.current?.redraw();
        }

        suppressSelectionClickRef.current = true;
        const zoom = sanitizeCamera(cameraRef.current).zoom;
        onNodePositionPreviewRef.current(dragState.nodeId, {
          x: dragState.originX + deltaX / zoom,
          y: dragState.originY + deltaY / zoom,
        });
      }}
      onPointerUp={(event) => {
        const dragState = dragRef.current;

        if (dragState?.kind === 'canvas-pan' && !dragState.moved) {
          suppressSelectionClickRef.current = true;
          onSelectedNodeChangeRef.current(null);
        }

        if (dragState?.kind === 'node-drag') {
          if (dragState.dragging) {
            const deltaX = event.clientX - dragState.clientX;
            const deltaY = event.clientY - dragState.clientY;
            const zoom = sanitizeCamera(cameraRef.current).zoom;

            suppressSelectionClickRef.current = true;
            onNodePositionCommitRef.current(dragState.nodeId, {
              x: dragState.originX + deltaX / zoom,
              y: dragState.originY + deltaY / zoom,
            });
          } else {
            suppressSelectionClickRef.current = true;
            handleNodeTap(dragState.nodeId);
          }
        }

        setHoveredNodeId(null);
        endDrag(event.currentTarget);
      }}
      onPointerCancel={(event) => {
        setHoveredNodeId(null);
        endDrag(event.currentTarget);
      }}
      onPointerLeave={() => {
        if (!dragRef.current) {
          setHoveredNodeId(null);
        }
      }}
      onWheel={(event) => {
        event.preventDefault();

        const host = hostRef.current;

        if (!host) {
          return;
        }

        const bounds = host.getBoundingClientRect();
        const nextZoom = cameraRef.current.zoom * Math.exp(-event.deltaY * 0.001);
        const nextCamera = zoomCameraAroundPoint(
          cameraRef.current,
          nextZoom,
          {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          },
          getViewportSize(host),
        );

        onCameraChange(nextCamera);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();
          onQuickAddRequestRef.current();
        }
      }}
    >
      <CanvasNodeLayer
        camera={camera}
        edges={edges}
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        showCardChrome={rendererStatus !== 'ready'}
        viewport={viewportSize}
        onEnterNode={onEnterNode}
        onNodeDragStateChange={onNodeDragStateChange}
        onNodePositionCommit={onNodePositionCommit}
        onNodePositionPreview={onNodePositionPreview}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    </div>
  );
}
