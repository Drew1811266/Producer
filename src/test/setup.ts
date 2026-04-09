import '@testing-library/jest-dom/vitest';

class ResizeObserverMock implements ResizeObserver {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const width = target instanceof HTMLElement ? measureElementAxis(target, 'width') : 1280;
    const height = target instanceof HTMLElement ? measureElementAxis(target, 'height') : 720;
    const entry = {
      borderBoxSize: [],
      contentBoxSize: [],
      contentRect: {
        bottom: height,
        height,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      },
      devicePixelContentBoxSize: [],
      target,
    } as ResizeObserverEntry;

    this.callback([entry], this);
  }

  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

class DOMMatrixReadOnlyMock {
  m22: number;

  constructor(transform = 'none') {
    const normalizedTransform = typeof transform === 'string' ? transform : 'none';
    const matrixMatch = normalizedTransform.match(/matrix\(([^)]+)\)/);
    const scaleMatch = normalizedTransform.match(/scale\(([^)]+)\)/);

    if (matrixMatch) {
      const values = matrixMatch[1]?.split(',').map((value) => Number.parseFloat(value.trim())) ?? [];
      this.m22 = Number.isFinite(values[3]) ? values[3] : 1;
      return;
    }

    if (scaleMatch) {
      const scale = Number.parseFloat(scaleMatch[1] ?? '1');
      this.m22 = Number.isFinite(scale) ? scale : 1;
      return;
    }

    this.m22 = 1;
  }
}

if (typeof window !== 'undefined' && typeof window.DOMMatrixReadOnly === 'undefined') {
  window.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as typeof DOMMatrixReadOnly;
}

function parseCssLength(value: string | null | undefined): number | null {
  if (!value || value === 'auto') {
    return null;
  }

  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (value.endsWith('rem')) {
    const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize ?? '16');

    return numericValue * (Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16);
  }

  return numericValue;
}

function measureElementAxis(element: HTMLElement, axis: 'width' | 'height'): number {
  const computedStyle = window.getComputedStyle(element);
  const computedValue = parseCssLength(computedStyle[axis]);
  const inlineValue = parseCssLength(element.style[axis as 'width' | 'height']);
  const minValue =
    axis === 'width'
      ? parseCssLength(computedStyle.minWidth) ?? parseCssLength(element.style.minWidth)
      : parseCssLength(computedStyle.minHeight) ?? parseCssLength(element.style.minHeight);

  if (computedValue) {
    return computedValue;
  }

  if (inlineValue) {
    return inlineValue;
  }

  if (minValue) {
    return minValue;
  }

  return axis === 'width' ? 1280 : 720;
}

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return measureElementAxis(this, 'width');
  },
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return measureElementAxis(this, 'height');
  },
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  writable: true,
  value() {
    const computedStyle = window.getComputedStyle(this);
    const width = measureElementAxis(this, 'width');
    const height = measureElementAxis(this, 'height');
    const transform = this.style.transform ?? '';
    const translateMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const left = translateMatch
      ? Number.parseFloat(translateMatch[1] ?? '0')
      : parseCssLength(computedStyle.left) ?? 0;
    const top = translateMatch
      ? Number.parseFloat(translateMatch[2] ?? '0')
      : parseCssLength(computedStyle.top) ?? 0;

    return {
      bottom: top + height,
      height,
      left,
      right: left + width,
      toJSON() {
        return this;
      },
      top,
      width,
      x: left,
      y: top,
    };
  },
});

function installViewFallback(target: { prototype: Event }) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, 'view');
  const originalGet = descriptor?.get;

  Object.defineProperty(target.prototype, 'view', {
    configurable: true,
    get() {
      return originalGet?.call(this) ?? window;
    },
  });
}

installViewFallback(window.UIEvent);
installViewFallback(window.MouseEvent);

if (window.PointerEvent) {
  installViewFallback(window.PointerEvent);
}

const originalDispatchEvent = EventTarget.prototype.dispatchEvent;

Object.defineProperty(EventTarget.prototype, 'dispatchEvent', {
  configurable: true,
  writable: true,
  value(event: Event) {
    if (event instanceof window.UIEvent && event.view == null) {
      try {
        Object.defineProperty(event, 'view', {
          configurable: true,
          value: window,
        });
      } catch {
        // Ignore events whose view property cannot be redefined.
      }
    }

    return originalDispatchEvent.call(this, event);
  },
});
