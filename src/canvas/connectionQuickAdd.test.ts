import { DEFAULT_CAMERA } from './camera';
import { resolveQuickAddRequestFromConnectEnd } from './connectionQuickAdd';

const VIEWPORT_SIZE = {
  width: 1280,
  height: 720,
};

const VIEWPORT_BOUNDS = {
  left: 100,
  top: 40,
};

test('returns a quick-add request when a source-handle drag ends on blank canvas', () => {
  const result = resolveQuickAddRequestFromConnectEnd({
    camera: DEFAULT_CAMERA,
    connectionStart: {
      handleId: 'out',
      handleType: 'source',
      nodeId: 'node-1',
    },
    connectionState: {
      isValid: null,
      toHandle: null,
      toNode: null,
    },
    event: new MouseEvent('mouseup', {
      clientX: 420,
      clientY: 280,
    }),
    viewportBounds: VIEWPORT_BOUNDS,
    viewportSize: VIEWPORT_SIZE,
  });

  expect(result).toEqual({
    anchor: {
      screenX: 320,
      screenY: 240,
      worldX: -320,
      worldY: -120,
    },
    pendingConnection: {
      sourceHandleId: 'out',
      sourceHandleType: 'source',
      sourceNodeId: 'node-1',
    },
  });
});

test('returns a quick-add request for touch-end releases using the tracked handle context', () => {
  const result = resolveQuickAddRequestFromConnectEnd({
    camera: DEFAULT_CAMERA,
    connectionStart: {
      handleId: 'in',
      handleType: 'target',
      nodeId: 'node-2',
    },
    connectionState: {
      isValid: null,
      toHandle: null,
      toNode: null,
    },
    event: {
      changedTouches: [
        {
          clientX: 500,
          clientY: 400,
        },
      ],
    } as unknown as TouchEvent,
    viewportBounds: VIEWPORT_BOUNDS,
    viewportSize: VIEWPORT_SIZE,
  });

  expect(result).toEqual({
    anchor: {
      screenX: 400,
      screenY: 360,
      worldX: -240,
      worldY: 0,
    },
    pendingConnection: {
      sourceHandleId: 'in',
      sourceHandleType: 'target',
      sourceNodeId: 'node-2',
    },
  });
});

test('does not open quick add when the drag finishes on a valid target handle', () => {
  const result = resolveQuickAddRequestFromConnectEnd({
    camera: DEFAULT_CAMERA,
    connectionStart: {
      handleId: 'out',
      handleType: 'source',
      nodeId: 'node-1',
    },
    connectionState: {
      isValid: true,
      toHandle: {
        id: 'in',
      },
      toNode: {
        id: 'node-2',
      },
    },
    event: new MouseEvent('mouseup', {
      clientX: 420,
      clientY: 280,
    }),
    viewportBounds: VIEWPORT_BOUNDS,
    viewportSize: VIEWPORT_SIZE,
  });

  expect(result).toBeNull();
});

test('does not open quick add when the drag finishes on a node body or invalid handle', () => {
  const nodeBodyResult = resolveQuickAddRequestFromConnectEnd({
    camera: DEFAULT_CAMERA,
    connectionStart: {
      handleId: 'out',
      handleType: 'source',
      nodeId: 'node-1',
    },
    connectionState: {
      isValid: false,
      toHandle: null,
      toNode: {
        id: 'node-2',
      },
    },
    event: new MouseEvent('mouseup', {
      clientX: 420,
      clientY: 280,
    }),
    viewportBounds: VIEWPORT_BOUNDS,
    viewportSize: VIEWPORT_SIZE,
  });
  const invalidHandleResult = resolveQuickAddRequestFromConnectEnd({
    camera: DEFAULT_CAMERA,
    connectionStart: {
      handleId: 'out',
      handleType: 'source',
      nodeId: 'node-1',
    },
    connectionState: {
      isValid: false,
      toHandle: {
        id: 'in',
      },
      toNode: {
        id: 'node-2',
      },
    },
    event: new MouseEvent('mouseup', {
      clientX: 420,
      clientY: 280,
    }),
    viewportBounds: VIEWPORT_BOUNDS,
    viewportSize: VIEWPORT_SIZE,
  });

  expect(nodeBodyResult).toBeNull();
  expect(invalidHandleResult).toBeNull();
});
