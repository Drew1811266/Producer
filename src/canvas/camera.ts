export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

export type ViewportPoint = {
  x: number;
  y: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export const DEFAULT_VIEWPORT_SIZE: ViewportSize = {
  width: 1280,
  height: 720,
};

export const MIN_CAMERA_ZOOM = 0.5;
export const MAX_CAMERA_ZOOM = 1.5;
export const DEFAULT_CAMERA: CameraState = {
  x: 0,
  y: 0,
  zoom: 1,
};

function resolveViewportAxis(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function measureViewport(
  element: Pick<HTMLElement, 'clientWidth' | 'clientHeight'> | null,
  fallback: ViewportSize = DEFAULT_VIEWPORT_SIZE,
): ViewportSize {
  return {
    width: resolveViewportAxis(element?.clientWidth ?? 0, fallback.width),
    height: resolveViewportAxis(element?.clientHeight ?? 0, fallback.height),
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function clampZoom(value: number): number {
  if (!isFiniteNumber(value)) {
    return DEFAULT_CAMERA.zoom;
  }

  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, value));
}

export function sanitizeCamera(camera: CameraState): CameraState {
  return {
    x: isFiniteNumber(camera.x) ? camera.x : DEFAULT_CAMERA.x,
    y: isFiniteNumber(camera.y) ? camera.y : DEFAULT_CAMERA.y,
    zoom: clampZoom(camera.zoom),
  };
}

export function panCamera(camera: CameraState, deltaX: number, deltaY: number): CameraState {
  if (!isFiniteNumber(deltaX) || !isFiniteNumber(deltaY)) {
    return sanitizeCamera(camera);
  }

  const current = sanitizeCamera(camera);

  return {
    x: current.x + deltaX,
    y: current.y + deltaY,
    zoom: current.zoom,
  };
}

export function zoomCameraAroundPoint(
  camera: CameraState,
  nextZoomValue: number,
  point: ViewportPoint,
  viewport: ViewportSize,
): CameraState {
  if (
    !isFiniteNumber(nextZoomValue) ||
    !isFiniteNumber(point.x) ||
    !isFiniteNumber(point.y) ||
    !isFiniteNumber(viewport.width) ||
    !isFiniteNumber(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return sanitizeCamera(camera);
  }

  const current = sanitizeCamera(camera);
  const nextZoom = clampZoom(nextZoomValue);

  if (nextZoom === current.zoom) {
    return current;
  }

  const originX = viewport.width / 2 + current.x;
  const originY = viewport.height / 2 + current.y;
  const worldX = (point.x - originX) / current.zoom;
  const worldY = (point.y - originY) / current.zoom;

  return {
    x: point.x - viewport.width / 2 - worldX * nextZoom,
    y: point.y - viewport.height / 2 - worldY * nextZoom,
    zoom: nextZoom,
  };
}

export function viewportCenterPoint(viewport: ViewportSize): ViewportPoint {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2,
  };
}

export function viewportPointToWorldPoint(
  camera: CameraState,
  point: ViewportPoint,
  viewport: ViewportSize,
): ViewportPoint {
  if (
    !isFiniteNumber(point.x) ||
    !isFiniteNumber(point.y) ||
    !isFiniteNumber(viewport.width) ||
    !isFiniteNumber(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return {
      x: 0,
      y: 0,
    };
  }

  const current = sanitizeCamera(camera);
  const originX = viewport.width / 2 + current.x;
  const originY = viewport.height / 2 + current.y;

  return {
    x: (point.x - originX) / current.zoom,
    y: (point.y - originY) / current.zoom,
  };
}
