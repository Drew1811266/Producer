import {
  alignScreenLine,
  resolveCanvasResolution,
  snapScreenPoint,
  snapScreenRect,
  subscribeToDevicePixelRatioChanges,
} from './rendering';

test('resolveCanvasResolution normalizes invalid DPR values', () => {
  expect(resolveCanvasResolution()).toBe(1);
  expect(resolveCanvasResolution(Number.NaN)).toBe(1);
  expect(resolveCanvasResolution(-2)).toBe(1);
  expect(resolveCanvasResolution(0)).toBe(1);
  expect(resolveCanvasResolution(1.25)).toBe(1.25);
  expect(resolveCanvasResolution(2)).toBe(2);
});

test('alignScreenLine aligns odd-width strokes to half pixels', () => {
  expect(alignScreenLine(10, 1)).toBe(10.5);
  expect(alignScreenLine(10.2, 1)).toBe(10.5);
  expect(alignScreenLine(10.2, 2)).toBe(10);
});

test('snapScreenPoint rounds to the device pixel grid', () => {
  expect(snapScreenPoint({ x: 10.24, y: 20.76 }, 1)).toEqual({
    x: 10,
    y: 21,
  });
  expect(snapScreenPoint({ x: 10.24, y: 20.76 }, 2)).toEqual({
    x: 10,
    y: 21,
  });
  expect(snapScreenPoint({ x: 10.24, y: 20.76 }, 1.25)).toEqual({
    x: 10.4,
    y: 20.8,
  });
});

test('snapScreenRect preserves positive size while aligning edges to the device pixel grid', () => {
  expect(
    snapScreenRect(
      {
        x: 10.24,
        y: 20.76,
        width: 99.2,
        height: 40.2,
      },
      2,
    ),
  ).toEqual({
    x: 10,
    y: 21,
    width: 99.5,
    height: 40,
  });
});

test('subscribeToDevicePixelRatioChanges rebinds matchMedia when DPR changes', () => {
  const listeners = new Map<string, Set<() => void>>();
  const observedQueries: string[] = [];
  const removedQueries: string[] = [];
  let currentDpr = 1;

  const unsubscribe = subscribeToDevicePixelRatioChanges(
    (nextDpr) => {
      currentDpr = nextDpr;
    },
    {
      getDevicePixelRatio: () => currentDpr,
      matchMedia: (query) => {
        observedQueries.push(query);

        return {
          addEventListener: (_event, listener) => {
            const group = listeners.get(query) ?? new Set<() => void>();
            group.add(listener);
            listeners.set(query, group);
          },
          removeEventListener: (_event, listener) => {
            removedQueries.push(query);
            listeners.get(query)?.delete(listener);
          },
        };
      },
      addWindowResizeListener: () => () => undefined,
    },
  );

  currentDpr = 2;
  listeners.get('(resolution: 1dppx)')?.forEach((listener) => listener());

  expect(observedQueries).toEqual(['(resolution: 1dppx)', '(resolution: 2dppx)']);
  expect(removedQueries).toContain('(resolution: 1dppx)');

  unsubscribe();
});
