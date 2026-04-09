import { convertFileSrc } from '@tauri-apps/api/core';

export function toAssetPreviewUrl(filePath?: string | null): string | null {
  if (!filePath) {
    return null;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    return `file://${filePath}`;
  }
}
