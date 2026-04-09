export type ScreenPoint = {
  x: number;
  y: number;
};

export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DevicePixelRatioChangeListener = () => void;
type Cleanup = () => void;

type MediaQueryLike = {
  addEventListener?(event: 'change', listener: DevicePixelRatioChangeListener): void;
  removeEventListener?(event: 'change', listener: DevicePixelRatioChangeListener): void;
  addListener?(listener: DevicePixelRatioChangeListener): void;
  removeListener?(listener: DevicePixelRatioChangeListener): void;
};

type DevicePixelRatioSubscriptionOptions = {
  addWindowResizeListener?(listener: DevicePixelRatioChangeListener): Cleanup;
  getDevicePixelRatio?(): number;
  matchMedia?(query: string): MediaQueryLike;
};

function snapToDevicePixel(value: number, resolution: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * resolution) / resolution;
}

function normalizePositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function addMediaQueryChangeListener(
  mediaQuery: MediaQueryLike,
  listener: DevicePixelRatioChangeListener,
): Cleanup {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener?.('change', listener);
    };
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener);

    return () => {
      mediaQuery.removeListener?.(listener);
    };
  }

  return () => {};
}

export function resolveCanvasResolution(rawDpr = 1): number {
  return normalizePositiveNumber(rawDpr, 1);
}

export function alignScreenLine(
  value: number,
  lineWidth = 1,
  resolution = 1,
): number {
  const safeResolution = resolveCanvasResolution(resolution);
  const safeLineWidth = normalizePositiveNumber(lineWidth, 1);
  const deviceLineWidth = Math.max(1, Math.round(safeLineWidth * safeResolution));
  const base = snapToDevicePixel(value, safeResolution);

  return deviceLineWidth % 2 === 0 ? base : base + 0.5 / safeResolution;
}

export function snapScreenPoint(
  point: ScreenPoint,
  resolution = 1,
): ScreenPoint {
  const safeResolution = resolveCanvasResolution(resolution);

  return {
    x: snapToDevicePixel(point.x, safeResolution),
    y: snapToDevicePixel(point.y, safeResolution),
  };
}

export function snapScreenRect(
  rect: ScreenRect,
  resolution = 1,
): ScreenRect {
  const safeResolution = resolveCanvasResolution(resolution);
  const x = snapToDevicePixel(rect.x, safeResolution);
  const y = snapToDevicePixel(rect.y, safeResolution);
  const right = snapToDevicePixel(rect.x + rect.width, safeResolution);
  const bottom = snapToDevicePixel(rect.y + rect.height, safeResolution);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

export function subscribeToDevicePixelRatioChanges(
  onChange: (nextDpr: number) => void,
  options: DevicePixelRatioSubscriptionOptions = {},
): Cleanup {
  const getDevicePixelRatio =
    options.getDevicePixelRatio ??
    (() => (typeof window !== 'undefined' ? window.devicePixelRatio : 1));
  const matchMedia =
    options.matchMedia ??
    ((query: string) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return undefined;
      }

      return window.matchMedia(query);
    });
  const addWindowResizeListener =
    options.addWindowResizeListener ??
    ((listener: DevicePixelRatioChangeListener) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      window.addEventListener('resize', listener);

      return () => {
        window.removeEventListener('resize', listener);
      };
    });

  let currentDpr = resolveCanvasResolution(getDevicePixelRatio());
  let detachMediaQueryListener: Cleanup = () => {};

  const handlePotentialChange = () => {
    const nextDpr = resolveCanvasResolution(getDevicePixelRatio());

    if (nextDpr === currentDpr) {
      return;
    }

    detachMediaQueryListener();
    currentDpr = nextDpr;
    onChange(nextDpr);
    bindMediaQuery();
  };

  const bindMediaQuery = () => {
    const mediaQuery = matchMedia(`(resolution: ${currentDpr}dppx)`);

    if (!mediaQuery) {
      detachMediaQueryListener = () => {};

      return;
    }

    detachMediaQueryListener = addMediaQueryChangeListener(mediaQuery, handlePotentialChange);
  };

  bindMediaQuery();
  const detachResizeListener = addWindowResizeListener(handlePotentialChange);

  return () => {
    detachMediaQueryListener();
    detachResizeListener();
  };
}
