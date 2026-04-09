import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/base.css';
import App from './App';
import { BootVisibilityBridge } from './boot/BootVisibilityBridge';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootVisibilityBridge>
      <App />
    </BootVisibilityBridge>
  </StrictMode>,
);
