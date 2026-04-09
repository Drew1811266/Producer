import { describe, expect, test } from 'vitest';

import { DEFAULT_VIEWPORT_SIZE, measureViewport } from './camera';

describe('measureViewport', () => {
  test('uses the provided fallback when the element is missing', () => {
    expect(measureViewport(null)).toEqual(DEFAULT_VIEWPORT_SIZE);
    expect(measureViewport(null, { width: 960, height: 540 })).toEqual({
      width: 960,
      height: 540,
    });
  });

  test('keeps the last known viewport size when a real element reports zero', () => {
    expect(
      measureViewport(
        {
          clientWidth: 0,
          clientHeight: 0,
        } as Pick<HTMLElement, 'clientWidth' | 'clientHeight'>,
        { width: 1440, height: 900 },
      ),
    ).toEqual({
      width: 1440,
      height: 900,
    });
  });

  test('prefers real measured dimensions over the fallback', () => {
    expect(
      measureViewport(
        {
          clientWidth: 1180,
          clientHeight: 760,
        } as Pick<HTMLElement, 'clientWidth' | 'clientHeight'>,
        { width: 1440, height: 900 },
      ),
    ).toEqual({
      width: 1180,
      height: 760,
    });
  });
});
