import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

import type { GraphNodeSummary, ProjectGraphSummary } from '../bridge/contracts';
import { DEFAULT_CAMERA } from './camera';
import { CanvasStage } from './CanvasStage';

const mockRendererResize = vi.fn();
const mockApplicationInit = vi.fn();
const mockApplicationDestroy = vi.fn();
const mockMatchMedia = vi.fn();

let currentDevicePixelRatio = 2;
let mediaQueryListeners = new Set<() => void>();

class MockContainer {
  children: ReactNode[] = [];
  cursor = 'default';
  eventMode = 'passive';
  position = {
    x: 0,
    y: 0,
    set: (x: number, y = x) => {
      this.position.x = x;
      this.position.y = y;
    },
  };
  scale = {
    x: 1,
    y: 1,
    set: (x: number, y = x) => {
      this.scale.x = x;
      this.scale.y = y;
    },
  };

  addChild(...children: ReactNode[]) {
    this.children.push(...children);

    return children[0];
  }

  removeChildren() {
    const removed = [...this.children];

    this.children = [];

    return removed;
  }

  on() {
    return this;
  }

  destroy() {
    return undefined;
  }
}

class MockGraphics extends MockContainer {
  clear() {
    return this;
  }

  rect() {
    return this;
  }

  roundRect() {
    return this;
  }

  circle() {
    return this;
  }

  moveTo() {
    return this;
  }

  lineTo() {
    return this;
  }

  fill() {
    return this;
  }

  stroke() {
    return this;
  }
}

class MockTextStyle {
  value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }
}

class MockText extends MockContainer {
  anchor = {
    set: vi.fn(),
  };
  height = 16;
  text = '';
  width = 64;

  constructor(options: { text: string }) {
    super();
    this.text = options.text;
  }
}

class MockApplication {
  static latest: MockApplication | null = null;

  canvas = document.createElement('canvas');
  renderer = {
    resize: mockRendererResize,
    resolution: 1,
  };
  stage = new MockContainer();

  constructor() {
    MockApplication.latest = this;
  }

  async init(options: Record<string, unknown>) {
    mockApplicationInit(options);
    this.renderer.resolution = Number(options.resolution ?? 1);
  }

  destroy() {
    mockApplicationDestroy();
  }
}

vi.mock('pixi.js', () => ({
  Application: MockApplication,
  Container: MockContainer,
  Graphics: MockGraphics,
  Text: MockText,
  TextStyle: MockTextStyle,
}));

function buildGraph(overrides: Partial<ProjectGraphSummary> = {}): ProjectGraphSummary {
  return {
    id: 'graph-root',
    name: 'Root Story',
    layerType: 'story',
    isRoot: true,
    ...overrides,
  };
}

function buildNode(overrides: Partial<GraphNodeSummary> = {}): GraphNodeSummary {
  return {
    id: 'node-1',
    graphId: 'graph-root',
    title: 'Opening Brief',
    nodeType: 'brief',
    storedAssetCount: 0,
    canEnterChildGraph: false,
    layout: {
      x: 0,
      y: 0,
      width: 208,
      height: 128,
    },
    ...overrides,
  };
}

function emitDevicePixelRatioChange(nextDpr: number) {
  currentDevicePixelRatio = nextDpr;
  mediaQueryListeners.forEach((listener) => listener());
}

beforeEach(() => {
  currentDevicePixelRatio = 2;
  MockApplication.latest = null;
  mediaQueryListeners = new Set();
  mockRendererResize.mockReset();
  mockApplicationInit.mockReset();
  mockApplicationDestroy.mockReset();
  mockMatchMedia.mockReset();

  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get: () => currentDevicePixelRatio,
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => {
      mockMatchMedia(query);

      return {
        addEventListener: (_event: string, listener: () => void) => {
          mediaQueryListeners.add(listener);
        },
        removeEventListener: (_event: string, listener: () => void) => {
          mediaQueryListeners.delete(listener);
        },
      };
    },
  });

  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('initializes Pixi with DPR-aware options and separate geometry/text layers', async () => {
  render(
    <CanvasStage
      graph={buildGraph()}
      camera={DEFAULT_CAMERA}
      nodes={[]}
      selectedNodeId={null}
      onCameraChange={() => undefined}
      onSelectedNodeChange={() => undefined}
    />,
  );

  const host = screen.getByTestId('canvas-stage-host');

  await waitFor(() => {
    expect(mockApplicationInit).toHaveBeenCalled();
  });

  expect(mockApplicationInit).toHaveBeenCalledWith(
    expect.objectContaining({
      antialias: true,
      autoDensity: true,
      resizeTo: host,
      resolution: 2,
    }),
  );
  expect(mockApplicationInit.mock.calls[0]?.[0]).not.toHaveProperty('width');
  expect(mockApplicationInit.mock.calls[0]?.[0]).not.toHaveProperty('height');
  expect(MockApplication.latest?.stage.children).toHaveLength(5);
});

test('updates renderer resolution after a devicePixelRatio change', async () => {
  render(
    <CanvasStage
      graph={buildGraph()}
      camera={DEFAULT_CAMERA}
      nodes={[]}
      selectedNodeId={null}
      onCameraChange={() => undefined}
      onSelectedNodeChange={() => undefined}
    />,
  );

  await waitFor(() => {
    expect(mockApplicationInit).toHaveBeenCalled();
  });

  emitDevicePixelRatioChange(1.5);

  await waitFor(() => {
    expect(MockApplication.latest?.renderer.resolution).toBe(1.5);
  });
});

test('selects a node on pointer up without requiring a drag gesture', async () => {
  const onSelectedNodeChange = vi.fn();

  render(
    <CanvasStage
      graph={buildGraph()}
      camera={DEFAULT_CAMERA}
      nodes={[buildNode()]}
      selectedNodeId={null}
      onCameraChange={() => undefined}
      onSelectedNodeChange={onSelectedNodeChange}
    />,
  );

  const host = screen.getByTestId('canvas-stage-host');
  Object.defineProperty(host, 'clientWidth', {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(host, 'clientHeight', {
    configurable: true,
    value: 720,
  });
  host.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  await waitFor(() => {
    expect(mockApplicationInit).toHaveBeenCalled();
  });

  fireEvent.pointerDown(host, {
    button: 0,
    clientX: 650,
    clientY: 370,
    pointerId: 7,
  });
  fireEvent.pointerUp(host, {
    button: 0,
    clientX: 650,
    clientY: 370,
    pointerId: 7,
  });

  expect(onSelectedNodeChange).toHaveBeenCalledWith('node-1');
});

test('clears the selection when the user blank-clicks with minor pointer jitter', async () => {
  const onSelectedNodeChange = vi.fn();

  render(
    <CanvasStage
      graph={buildGraph()}
      camera={DEFAULT_CAMERA}
      nodes={[buildNode()]}
      selectedNodeId="node-1"
      onCameraChange={() => undefined}
      onSelectedNodeChange={onSelectedNodeChange}
    />,
  );

  const host = screen.getByTestId('canvas-stage-host');
  Object.defineProperty(host, 'clientWidth', {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(host, 'clientHeight', {
    configurable: true,
    value: 720,
  });
  host.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  await waitFor(() => {
    expect(mockApplicationInit).toHaveBeenCalled();
  });

  fireEvent.pointerDown(host, {
    button: 0,
    clientX: 80,
    clientY: 80,
    pointerId: 9,
  });
  fireEvent.pointerMove(host, {
    clientX: 81,
    clientY: 81,
    pointerId: 9,
  });
  fireEvent.pointerUp(host, {
    button: 0,
    clientX: 81,
    clientY: 81,
    pointerId: 9,
  });

  expect(onSelectedNodeChange).toHaveBeenCalledWith(null);
});

test('enters a child graph on double click for enterable nodes', async () => {
  const onEnterNode = vi.fn();

  render(
    <CanvasStage
      graph={buildGraph()}
      camera={DEFAULT_CAMERA}
      nodes={[
        buildNode({
          id: 'node-brief',
          title: 'Campaign Brief',
          canEnterChildGraph: true,
        }),
      ]}
      selectedNodeId={null}
      onCameraChange={() => undefined}
      onEnterNode={onEnterNode}
      onSelectedNodeChange={() => undefined}
    />,
  );

  const host = screen.getByTestId('canvas-stage-host');
  Object.defineProperty(host, 'clientWidth', {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(host, 'clientHeight', {
    configurable: true,
    value: 720,
  });
  host.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  await waitFor(() => {
    expect(mockApplicationInit).toHaveBeenCalled();
  });

  fireEvent.doubleClick(host, {
    clientX: 650,
    clientY: 370,
  });

  expect(onEnterNode).toHaveBeenCalledWith('node-brief');
});
