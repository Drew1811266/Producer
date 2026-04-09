declare global {
  interface Window {
    __PRODUCER_RENDER_BOOT_ERROR__?: (message: string) => void;
  }
}

type InstallBootFallbackOptions = {
  document?: Document;
  timeoutMs?: number;
  window?: Window;
};

const DEFAULT_BOOT_TIMEOUT_MS = 4_000;
const BOOT_TIMEOUT_MESSAGE = '界面初始化超时，且应用尚未完成首帧渲染。请查看开发终端日志。';

let pendingBootErrorMessage = '';

function flushBootFallbackError(targetDocument: Document) {
  const errorNode = targetDocument.getElementById('boot-fallback-error');

  if (errorNode) {
    errorNode.textContent = pendingBootErrorMessage;
  }
}

function setBootFallbackError(message: string, targetDocument: Document) {
  pendingBootErrorMessage = message;
  flushBootFallbackError(targetDocument);
}

export function setAppMounted(
  mounted: boolean,
  targetDocument: Document = document,
) {
  if (!targetDocument.body) {
    return;
  }

  targetDocument.body.dataset.appMounted = mounted ? 'true' : 'false';
}

export function installBootFallback({
  document: targetDocument = document,
  timeoutMs = DEFAULT_BOOT_TIMEOUT_MS,
  window: targetWindow = window,
}: InstallBootFallbackOptions = {}) {
  const renderBootError = (message: string) => {
    setBootFallbackError(message, targetDocument);
  };

  const handleWindowError = (event: ErrorEvent) => {
    renderBootError(`启动失败：${event.message || '未知错误'}`);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason =
      typeof event.reason === 'string'
        ? event.reason
        : event.reason?.message || '未知 Promise 错误';

    renderBootError(`启动失败：${reason}`);
  };

  const handleDomReady = () => {
    flushBootFallbackError(targetDocument);
  };

  targetWindow.__PRODUCER_RENDER_BOOT_ERROR__ = renderBootError;
  targetWindow.addEventListener('error', handleWindowError);
  targetWindow.addEventListener('unhandledrejection', handleUnhandledRejection);
  targetDocument.addEventListener('DOMContentLoaded', handleDomReady, { once: true });

  flushBootFallbackError(targetDocument);

  const timeoutId = targetWindow.setTimeout(() => {
    if (targetDocument.body?.dataset.appMounted === 'true') {
      return;
    }

    renderBootError(BOOT_TIMEOUT_MESSAGE);
  }, timeoutMs);

  return () => {
    targetWindow.clearTimeout(timeoutId);
    targetWindow.removeEventListener('error', handleWindowError);
    targetWindow.removeEventListener('unhandledrejection', handleUnhandledRejection);
    targetDocument.removeEventListener('DOMContentLoaded', handleDomReady);

    if (targetWindow.__PRODUCER_RENDER_BOOT_ERROR__ === renderBootError) {
      delete targetWindow.__PRODUCER_RENDER_BOOT_ERROR__;
    }
  };
}
