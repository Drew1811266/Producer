import { StrictMode } from 'react';
import { render } from '@testing-library/react';

import { BootVisibilityBridge } from './BootVisibilityBridge';
import { installBootFallback } from './runtime';

afterEach(() => {
  document.documentElement.innerHTML = '<head></head><body></body>';
});

test('buffers boot errors until the fallback error node exists', () => {
  document.documentElement.innerHTML = '<head></head><body></body>';

  installBootFallback({
    timeoutMs: 60_000,
  });

  window.__PRODUCER_RENDER_BOOT_ERROR__?.('主入口加载失败：boom');

  expect(document.body.dataset.appMounted).not.toBe('true');

  document.body.innerHTML = '<div id="boot-fallback-error"></div>';
  document.dispatchEvent(new Event('DOMContentLoaded'));

  expect(document.getElementById('boot-fallback-error')).toHaveTextContent('主入口加载失败：boom');
});

test('marks the app as mounted after the first React commit and resets on unmount', () => {
  document.documentElement.innerHTML = '<head></head><body><div id="root"></div></body>';

  const view = render(
    <StrictMode>
      <BootVisibilityBridge>
        <main>ready</main>
      </BootVisibilityBridge>
    </StrictMode>,
    {
      container: document.getElementById('root')!,
    },
  );

  expect(document.body.dataset.appMounted).toBe('true');

  view.unmount();

  expect(document.body.dataset.appMounted).toBe('false');
});
