import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import type { GraphNodePosition, GraphNodeSummary } from '../bridge/contracts';
import {
  buildCanvasEdgePath,
  buildCanvasEdgePolyline,
  resolveCanvasEdgeLabelPoint,
  resolveVisibleCanvasEdges,
  type CanvasEdge,
} from './canvasEdges';
import type { CameraState, ViewportSize } from './camera';
import { buildNodePresentation, withHexAlpha } from './nodePresentation';
import { formatNodeTypeLabel, projectGraphNodes } from './nodeProjection';

type CanvasNodeLayerProps = {
  camera: CameraState;
  edges?: CanvasEdge[];
  nodes: GraphNodeSummary[];
  selectedNodeId: string | null;
  showCardChrome: boolean;
  viewport: ViewportSize;
  onEnterNode(nodeId: string): void;
  onNodeDragStateChange?(nodeId: string | null): void;
  onNodePositionCommit?(nodeId: string, position: GraphNodePosition): void;
  onNodePositionPreview?(nodeId: string, position: GraphNodePosition): void;
  onSelectedNodeChange(nodeId: string | null): void;
};

const CANVAS_FONT_STACK = 'SF Pro Display, Avenir Next, Segoe UI, sans-serif';
const NODE_DRAG_THRESHOLD_PX = 4;

type NodeDragOffset = {
  x: number;
  y: number;
};

type ActiveNodeDrag = {
  dragging: boolean;
  nodeId: string;
  originX: number;
  originY: number;
  lastPositionX: number;
  lastPositionY: number;
  pointerId?: number;
  startClientX: number;
  startClientY: number;
};

function approximateEdgeLabelWidth(labelText: string): number {
  return Math.max(52, labelText.length * 7.4 + 18);
}

function buildEdgePathStyle(
  strokeColor: string,
  strokeAlpha: number,
  strokeWidth: number,
): CSSProperties {
  return {
    fill: 'none',
    stroke: withHexAlpha(strokeColor, strokeAlpha),
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function buildNodeChromeStyle(
  left: number,
  top: number,
  width: number,
  height: number,
  presentation: ReturnType<typeof buildNodePresentation>,
  dragging: boolean,
): CSSProperties {
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'visible',
    padding: `${presentation.bodyPaddingTop}px ${presentation.bodyPaddingX}px`,
    borderRadius: `${presentation.cornerRadius}px`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor: presentation.palette.border,
    background: presentation.palette.surface,
    color: presentation.palette.title,
    textAlign: 'left',
    appearance: 'none',
    cursor: dragging ? 'grabbing' : presentation.interactive ? 'grab' : 'default',
    pointerEvents: 'auto',
    touchAction: 'none',
    ['--canvas-node-border-color' as string]: presentation.palette.border,
    ['--canvas-node-border-hover-color' as string]:
      presentation.ornamentStyle === 'port-grid'
        ? withHexAlpha(presentation.palette.border, 0.88)
        : withHexAlpha(presentation.palette.border, 0.18),
    ['--canvas-node-selection-ring-color' as string]: withHexAlpha(presentation.palette.selection, 0.92),
  };
}

function buildTypeLabelStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    color: withHexAlpha(presentation.palette.accent, 0.9),
    fontFamily: CANVAS_FONT_STACK,
    fontSize: `${presentation.typeFontSize}px`,
    fontWeight: 600,
    letterSpacing: '0.04em',
    lineHeight: 1,
    textTransform: 'uppercase',
  };
}

function buildTitleStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    color:
      presentation.ornamentStyle === 'port-grid'
        ? presentation.palette.title
        : presentation.palette.title,
    fontFamily: CANVAS_FONT_STACK,
    fontSize: `${presentation.titleFontSize}px`,
    fontWeight: presentation.ornamentStyle === 'port-grid' ? 500 : 600,
    letterSpacing: '-0.012em',
    lineHeight: 1.15,
  };
}

function buildStatusStyle(presentation: ReturnType<typeof buildNodePresentation>): CSSProperties {
  return {
    color: withHexAlpha(presentation.palette.secondary, 0.92),
    fontFamily: CANVAS_FONT_STACK,
    fontSize: `${presentation.statusFontSize}px`,
    fontWeight: 500,
    lineHeight: 1.2,
  };
}

function buildHeaderTagStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    width: `${presentation.headerPanelWidth}px`,
    height: `${presentation.headerPanelHeight}px`,
    padding: `${presentation.headerPanelPaddingTop}px ${presentation.headerPanelPaddingX}px 0`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor: withHexAlpha(presentation.palette.border, 0.18),
    borderRadius: `${presentation.cornerRadius}px 0 ${presentation.cornerRadius * 1.2857}px 0`,
    background: withHexAlpha(presentation.palette.accent, 0.12),
  };
}

function buildActionDotStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    top: `${presentation.actionDotOffsetY}px`,
    right: `${presentation.actionDotOffsetX}px`,
    width: `${presentation.actionDotDiameter}px`,
    height: `${presentation.actionDotDiameter}px`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor: withHexAlpha(presentation.palette.border, 0.18),
  };
}

function buildConnectorStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    bottom: `-${presentation.connectorOffsetY}px`,
    width: `${presentation.connectorWidth}px`,
    height: `${presentation.connectorHeight}px`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor: withHexAlpha(presentation.palette.border, 0.18),
  };
}

function buildPortStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
  direction: 'input' | 'output',
): CSSProperties {
  const isInput = direction === 'input';
  const width = isInput ? presentation.inputPortWidth : presentation.outputPortWidth;
  const height = isInput ? presentation.inputPortHeight : presentation.outputPortHeight;
  const offset = isInput ? presentation.inputPortOffsetY : presentation.outputPortOffsetY;

  return {
    left: '50%',
    width: `${width}px`,
    height: `${height}px`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor:
      presentation.ornamentStyle === 'port-grid'
        ? presentation.palette.border
        : withHexAlpha(presentation.palette.border, 0.2),
    background: presentation.palette.surface,
    transform: 'translateX(-50%)',
    [isInput ? 'top' : 'bottom']: `-${offset}px`,
  };
}

function buildDividerStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    left: `${presentation.dividerInsetX}px`,
    right: `${presentation.dividerInsetX}px`,
    top: `${presentation.dividerOffsetY}px`,
    background:
      presentation.ornamentStyle === 'port-grid'
        ? withHexAlpha(presentation.palette.border, 0.58)
        : withHexAlpha(presentation.palette.border, 0.14),
  };
}

function buildFileGridStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    left: `${presentation.fileGridInsetX}px`,
    right: `${presentation.fileGridInsetX}px`,
    bottom: `${presentation.fileGridInsetBottom}px`,
    top: `${presentation.dividerOffsetY + presentation.fileGridInsetTop}px`,
    gap: `${presentation.fileGridGap}px`,
    gridTemplateColumns: `repeat(${presentation.fileGridColumns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${presentation.fileGridRows}, minmax(0, 1fr))`,
  };
}

function buildFileGridPanelStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    left: '0px',
    right: '0px',
    top: `${presentation.dividerOffsetY}px`,
    bottom: '0px',
    background:
      presentation.ornamentStyle === 'port-grid'
        ? withHexAlpha(presentation.palette.border, 0.16)
        : withHexAlpha(presentation.palette.border, 0.035),
  };
}

function buildFileGridCellStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
  filled: boolean,
): CSSProperties {
  const isPortGrid = presentation.ornamentStyle === 'port-grid';

  return {
    borderRadius: `${presentation.fileGridCellRadius}px`,
    borderWidth: `${Math.max(0.75, presentation.borderWidth)}px`,
    borderColor: filled
      ? withHexAlpha('#5eb773', 0.72)
      : isPortGrid
        ? '#bcc9d9'
        : withHexAlpha(presentation.palette.border, 0.14),
    background: filled
      ? '#5eb773'
      : isPortGrid
        ? '#e4ebf3'
        : withHexAlpha(presentation.palette.border, 0.04),
  };
}

function buildAccessoryBlockStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
  index: number,
): CSSProperties {
  return {
    width: `${presentation.accessoryBlockWidth}px`,
    height: `${presentation.accessoryBlockHeight}px`,
    right: `${presentation.accessoryBlockInsetRight + index * (presentation.accessoryBlockWidth + presentation.accessoryBlockGap)}px`,
    bottom: `${presentation.accessoryBlockBottomOffset + presentation.fileGridInsetBottom + presentation.outputPortOffsetY}px`,
    borderWidth: `${presentation.borderWidth}px`,
    borderColor: withHexAlpha(presentation.palette.border, 0.72),
    background: withHexAlpha(presentation.palette.surfaceRaised, 0.84),
  };
}

function buildContentStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  if (presentation.ornamentStyle === 'port-grid') {
    return {
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: `${Math.max(2, presentation.scaleFactor * 6)}px`,
      minWidth: 0,
      paddingTop: '0px',
    };
  }

  return {
    paddingTop:
      presentation.ornamentStyle === 'panel'
        ? `${Math.max(presentation.contentTopOffset - presentation.bodyPaddingTop, 0)}px`
        : '0px',
    gap: `${Math.max(2, presentation.scaleFactor * 6)}px`,
  };
}

function buildHeaderStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  return {
    gap: `${Math.max(2, presentation.scaleFactor * 4)}px`,
  };
}

function buildSelectionRingStyle(
  presentation: ReturnType<typeof buildNodePresentation>,
): CSSProperties {
  const ringInset = presentation.selectionRingGap + presentation.selectionRingWidth;

  return {
    inset: `-${ringInset}px`,
    borderWidth: `${presentation.selectionRingWidth}px`,
    borderRadius: `${presentation.cornerRadius + ringInset}px`,
  };
}

function renderNodeCardContent(
  node: GraphNodeSummary,
  presentation: ReturnType<typeof buildNodePresentation>,
  isSelected: boolean,
) {
  if (presentation.ornamentStyle === 'port-grid') {
    return (
      <>
        {isSelected ? (
          <span
            aria-hidden="true"
            className="canvas-node-selection-ring"
            data-node-selection-ring="true"
            style={buildSelectionRingStyle(presentation)}
          />
        ) : null}
        {presentation.hasInputPort ? (
          <span
            aria-hidden="true"
            className="canvas-node-input-port"
            style={buildPortStyle(presentation, 'input')}
          />
        ) : null}
        {presentation.hasOutputPort ? (
          <span
            aria-hidden="true"
            className="canvas-node-output-port"
            style={buildPortStyle(presentation, 'output')}
          />
        ) : null}
        <span
          aria-hidden="true"
          className="canvas-node-file-grid-panel"
          style={buildFileGridPanelStyle(presentation)}
        />
        {presentation.showAccessoryBlocks
          ? [1, 0].map((index) => (
              <span
                key={`${node.id}-accessory-${index}`}
                aria-hidden="true"
                className="canvas-node-accessory-block"
                style={buildAccessoryBlockStyle(presentation, index)}
              />
            ))
          : null}
        <div className="canvas-node-card-content canvas-node-card-content-port-grid" style={buildContentStyle(presentation)}>
          <div className="canvas-node-card-header" style={buildHeaderStyle(presentation)}>
            {presentation.showTitle && presentation.titleText ? (
              <strong className="canvas-node-card-title" style={buildTitleStyle(presentation)}>
                {presentation.titleText}
              </strong>
            ) : null}
            {presentation.showStatus && presentation.statusText ? (
              <div className="canvas-node-card-body">
                <span
                  className="canvas-node-card-status"
                  style={buildStatusStyle(presentation)}
                >
                  {presentation.statusText}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="canvas-node-file-grid-divider"
          style={buildDividerStyle(presentation)}
        />
        <div
          aria-hidden="true"
          className="canvas-node-file-grid"
          style={buildFileGridStyle(presentation)}
        >
          {Array.from({ length: presentation.fileGridCapacity }, (_, index) => {
            const filled = index < presentation.fileGridActiveCount;

            return (
              <span
                key={`${node.id}-file-grid-${index}`}
                className="canvas-node-file-grid-cell"
                data-filled={filled ? 'true' : 'false'}
                style={buildFileGridCellStyle(presentation, filled)}
              />
            );
          })}
        </div>
      </>
    );
  }

  const showHeaderTag =
    presentation.ornamentStyle === 'panel' &&
    presentation.headerPanelWidth > 0 &&
    presentation.headerPanelHeight > 0;

  return (
    <>
      {isSelected ? (
        <span
          aria-hidden="true"
          className="canvas-node-selection-ring"
          data-node-selection-ring="true"
          style={buildSelectionRingStyle(presentation)}
        />
      ) : null}
      {showHeaderTag ? (
        <>
          <span aria-hidden="true" className="canvas-node-header-tag" style={buildHeaderTagStyle(presentation)}>
            {presentation.showTypeLabel && presentation.typeText ? (
              <span
                className="canvas-node-card-type canvas-node-card-type-tag"
                style={buildTypeLabelStyle(presentation)}
              >
                {presentation.typeText ?? formatNodeTypeLabel(node.nodeType)}
              </span>
            ) : null}
          </span>
          {presentation.hasActionDot ? (
            <span aria-hidden="true" className="canvas-node-action-dot" style={buildActionDotStyle(presentation)} />
          ) : null}
          {presentation.hasConnector ? (
            <span aria-hidden="true" className="canvas-node-connector" style={buildConnectorStyle(presentation)} />
          ) : null}
        </>
      ) : null}
      <div className="canvas-node-card-content" style={buildContentStyle(presentation)}>
        <div className="canvas-node-card-header" style={buildHeaderStyle(presentation)}>
          {!showHeaderTag && presentation.showTypeLabel && presentation.typeText ? (
            <span
              className="canvas-node-card-type"
              style={buildTypeLabelStyle(presentation)}
            >
              {presentation.typeText ?? formatNodeTypeLabel(node.nodeType)}
            </span>
          ) : null}
          {presentation.showTitle && presentation.titleText ? (
            <strong className="canvas-node-card-title" style={buildTitleStyle(presentation)}>
              {presentation.titleText}
            </strong>
          ) : null}
        </div>
        {presentation.showStatus && presentation.statusText ? (
          <div className="canvas-node-card-body">
            <span
              className="canvas-node-card-status"
              style={buildStatusStyle(presentation)}
            >
              {presentation.statusText}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function CanvasNodeLayer({
  camera,
  edges = [],
  nodes,
  selectedNodeId,
  showCardChrome,
  viewport,
  onEnterNode,
  onNodeDragStateChange = () => undefined,
  onNodePositionCommit = () => undefined,
  onNodePositionPreview,
  onSelectedNodeChange,
}: CanvasNodeLayerProps) {
  const [nodeDragOffsetById, setNodeDragOffsetById] = useState<Record<string, NodeDragOffset>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragOffsetByIdRef = useRef(nodeDragOffsetById);
  const activeDragRef = useRef<ActiveNodeDrag | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    nodeDragOffsetByIdRef.current = nodeDragOffsetById;
  }, [nodeDragOffsetById]);

  const shouldUseLocalOffsets = !onNodePositionPreview;
  const adjustedNodes = nodes.map((node) => {
    const offset = nodeDragOffsetById[node.id];

    if (!shouldUseLocalOffsets || !offset) {
      return node;
    }

    return {
      ...node,
      layout: {
        ...node.layout,
        x: node.layout.x + offset.x,
        y: node.layout.y + offset.y,
      },
    };
  });
  const projectedNodes = projectGraphNodes(adjustedNodes, camera, viewport);
  const visibleEdges = resolveVisibleCanvasEdges(edges, projectedNodes, selectedNodeId);
  const visibleEdgeShapes = visibleEdges.map((edge) => {
    const polyline = buildCanvasEdgePolyline(edge.sourceNode, edge.targetNode, 'screen');

    return {
      ...edge,
      polyline,
      path: buildCanvasEdgePath(polyline),
      labelPoint: resolveCanvasEdgeLabelPoint(polyline),
    };
  });

  function clearActiveDrag(pointerId?: number) {
    const activeDrag = activeDragRef.current;

    if (
      activeDrag?.pointerId !== undefined &&
      pointerId !== undefined &&
      activeDrag.pointerId !== pointerId
    ) {
      return;
    }

    activeDragRef.current = null;
    setDraggingNodeId(null);
  }

  function beginNodeDrag(
    node: GraphNodeSummary,
    isSystem: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (event.button !== 0 || isSystem) {
      return;
    }

    event.stopPropagation();
    suppressClickRef.current = false;

    activeDragRef.current = {
      dragging: false,
      nodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: node.layout.x,
      originY: node.layout.y,
      lastPositionX: node.layout.x,
      lastPositionY: node.layout.y,
    };

    if (event.pointerId !== undefined) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }

  function moveNodeDrag(
    node: GraphNodeSummary,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || activeDrag.nodeId !== node.id) {
      return;
    }

    event.stopPropagation();

    const deltaX = event.clientX - activeDrag.startClientX;
    const deltaY = event.clientY - activeDrag.startClientY;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));

    if (!activeDrag.dragging) {
      if (distance < NODE_DRAG_THRESHOLD_PX) {
        return;
      }

      activeDrag.dragging = true;
      suppressClickRef.current = true;
      onSelectedNodeChange(node.id);
      onNodeDragStateChange(node.id);
      setDraggingNodeId(node.id);
    }

    const zoom = camera.zoom || 1;
    const nextPosition = {
      x: activeDrag.originX + deltaX / zoom,
      y: activeDrag.originY + deltaY / zoom,
    };

    activeDrag.lastPositionX = nextPosition.x;
    activeDrag.lastPositionY = nextPosition.y;

    if (onNodePositionPreview) {
      onNodePositionPreview(node.id, nextPosition);
      return;
    }

    setNodeDragOffsetById((current) => {
      const currentOffset = current[node.id];
      const nextOffset = {
        x: nextPosition.x - node.layout.x,
        y: nextPosition.y - node.layout.y,
      };

      if (currentOffset?.x === nextOffset.x && currentOffset?.y === nextOffset.y) {
        return current;
      }

      return {
        ...current,
        [node.id]: nextOffset,
      };
    });
  }

  function endNodeDrag(
    node: GraphNodeSummary,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || activeDrag.nodeId !== node.id) {
      return;
    }

    if (event.pointerId !== undefined) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } else if (activeDrag.pointerId !== undefined) {
      event.currentTarget.releasePointerCapture?.(activeDrag.pointerId);
    }

    if (activeDrag.dragging) {
      suppressClickRef.current = true;
      onNodeDragStateChange(null);
      onNodePositionCommit(node.id, {
        x: activeDrag.lastPositionX,
        y: activeDrag.lastPositionY,
      });
    }

    clearActiveDrag(event.pointerId);
  }

  return (
    <div
      className={`canvas-node-layer${showCardChrome ? ' canvas-node-layer-fallback' : ' canvas-node-layer-hit-targets'}`}
      aria-label="当前画布节点"
    >
      {showCardChrome && edges.length > 0 ? (
        <div className="canvas-edge-overlay" data-testid="canvas-edge-overlay">
          <svg
            className="canvas-edge-layer"
            data-testid="canvas-edge-layer"
            viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {visibleEdgeShapes.map((edge) => {
              const labelWidth = edge.labelText ? approximateEdgeLabelWidth(edge.labelText) : 0;

              return (
                <g key={edge.id}>
                  <path
                    className={`canvas-edge${edge.selected ? ' canvas-edge-selected' : ''}`}
                    data-testid={`canvas-edge-${edge.id}`}
                    data-edge-selected={edge.selected ? 'true' : 'false'}
                    data-edge-emphasis={edge.emphasis}
                    d={edge.path}
                    style={buildEdgePathStyle(edge.strokeColor, edge.strokeAlpha, edge.strokeWidth)}
                  />
                  {edge.showLabel && edge.labelText ? (
                    <g
                      data-testid={`canvas-edge-label-${edge.id}`}
                      transform={`translate(${edge.labelPoint.x}, ${edge.labelPoint.y})`}
                    >
                      <rect
                        x={-labelWidth / 2}
                        y={-10}
                        width={labelWidth}
                        height={20}
                        rx={10}
                        fill={withHexAlpha(edge.labelBackground, 0.92)}
                        stroke={withHexAlpha(edge.strokeColor, 0.24)}
                        strokeWidth={0.75}
                      />
                      <text
                        fill={edge.labelColor}
                        fontFamily={CANVAS_FONT_STACK}
                        fontSize={11}
                        fontWeight={600}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {edge.labelText}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      ) : null}

      {projectedNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isSystem = Boolean(node.isSystem);
        const canEnterChildGraph = Boolean(node.canEnterChildGraph);
        const presentation = buildNodePresentation(node, isSelected);
        const label = canEnterChildGraph && !isSystem ? `可进入子画布：${node.title}` : node.title;
        const isDragging = draggingNodeId === node.id;

        if (isSystem) {
          return (
            <div
              key={node.id}
              className={`canvas-node-card canvas-node-card-lod-${presentation.lod} canvas-node-card-system${
                presentation.ornamentStyle === 'panel' ? ' canvas-node-card-panel' : ''
              }${
                isSelected ? ' canvas-node-card-selected' : ''
              }`}
              data-node-id={node.id}
              data-node-variant={presentation.variant}
              data-node-chrome={presentation.chrome}
              data-node-accent={presentation.accentStyle}
              data-node-ornament={presentation.ornamentStyle}
              data-node-lod={presentation.lod}
              data-node-dragging={isDragging ? 'true' : 'false'}
              data-node-world-x={node.layout.x}
              data-node-world-y={node.layout.y}
              style={buildNodeChromeStyle(
                node.screenX,
                node.screenY,
                node.screenWidth,
                node.screenHeight,
                presentation,
                isDragging,
              )}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {renderNodeCardContent(node, presentation, isSelected)}
            </div>
          );
        }

        return (
          <button
            key={node.id}
            className={`canvas-node-card canvas-node-card-lod-${presentation.lod}${
              presentation.ornamentStyle === 'panel' ? ' canvas-node-card-panel' : ''
            }${isSelected ? ' canvas-node-card-selected' : ''}`}
            data-node-id={node.id}
            data-node-variant={presentation.variant}
            data-node-chrome={presentation.chrome}
            data-node-accent={presentation.accentStyle}
            data-node-ornament={presentation.ornamentStyle}
            data-node-lod={presentation.lod}
            data-node-dragging={isDragging ? 'true' : 'false'}
            data-node-world-x={node.layout.x}
            data-node-world-y={node.layout.y}
            type="button"
            aria-label={label}
            style={buildNodeChromeStyle(
              node.screenX,
              node.screenY,
              node.screenWidth,
              node.screenHeight,
              presentation,
              isDragging,
            )}
            onPointerDown={(event) => {
              beginNodeDrag(node, isSystem, event);
            }}
            onPointerMove={(event) => {
              moveNodeDrag(node, event);
            }}
            onPointerUp={(event) => {
              endNodeDrag(node, event);
            }}
            onPointerCancel={(event) => {
              endNodeDrag(node, event);
            }}
            onClick={(event) => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                event.stopPropagation();
                event.preventDefault();

                return;
              }

              event.stopPropagation();

              if (canEnterChildGraph) {
                if (event.detail > 1) {
                  return;
                }

                onSelectedNodeChange(node.id);

                return;
              }

              onSelectedNodeChange(node.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();

              if (suppressClickRef.current) {
                suppressClickRef.current = false;

                return;
              }

              if (!canEnterChildGraph) {
                return;
              }

              onEnterNode(node.id);
            }}
          >
            {renderNodeCardContent(node, presentation, isSelected)}
          </button>
        );
      })}
    </div>
  );
}
