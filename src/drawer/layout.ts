export function resolveDrawerWidth(viewportWidth: number): number {
  return Math.min(460, Math.max(360, viewportWidth * 0.3));
}
