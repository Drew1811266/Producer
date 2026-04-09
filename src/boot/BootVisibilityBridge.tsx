import { useLayoutEffect, type ReactNode } from 'react';

import { setAppMounted } from './runtime';

type BootVisibilityBridgeProps = {
  children: ReactNode;
};

export function BootVisibilityBridge({ children }: BootVisibilityBridgeProps) {
  useLayoutEffect(() => {
    setAppMounted(true);

    return () => {
      setAppMounted(false);
    };
  }, []);

  return <>{children}</>;
}
