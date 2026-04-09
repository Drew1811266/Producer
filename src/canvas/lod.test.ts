import { createNodeLodMetrics, resolveNodeLod } from './lod';

test('classifies node lod bands by master-size scale ratio instead of raw projected area', () => {
  expect(resolveNodeLod(createNodeLodMetrics(208, 128, 208, 128))).toBe('detail');
  expect(resolveNodeLod(createNodeLodMetrics(104, 64, 208, 128))).toBe('summary');
  expect(resolveNodeLod(createNodeLodMetrics(83.2, 51.2, 208, 128))).toBe('summary');
  expect(resolveNodeLod(createNodeLodMetrics(41.6, 25.6, 208, 128))).toBe('chip');
  expect(resolveNodeLod(createNodeLodMetrics(40, 24, 208, 128))).toBe('silhouette');
});

test('uses identical lod for nodes that share the same master-relative scale', () => {
  const largeWorldNodeMetrics = createNodeLodMetrics(104, 64, 208, 128);
  const smallWorldNodeMetrics = createNodeLodMetrics(88, 52, 176, 104);

  expect(resolveNodeLod(largeWorldNodeMetrics)).toBe('summary');
  expect(resolveNodeLod(smallWorldNodeMetrics)).toBe('summary');
});

test('stays stable around fractional master-scale threshold boundaries', () => {
  expect(resolveNodeLod(createNodeLodMetrics(83.3, 51.25, 208, 128))).toBe('summary');
  expect(resolveNodeLod(createNodeLodMetrics(41.7, 25.7, 208, 128))).toBe('chip');
});

test('treats invalid projected sizes as the lowest detail band', () => {
  expect(resolveNodeLod(createNodeLodMetrics(Number.NaN, 48, 208, 128))).toBe('silhouette');
  expect(resolveNodeLod(createNodeLodMetrics(-12, 48, 208, 128))).toBe('silhouette');
});
