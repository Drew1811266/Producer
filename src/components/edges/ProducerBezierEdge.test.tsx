import { fireEvent, render, screen } from '@testing-library/react';
import { Position } from '@xyflow/react';

import { ProducerBezierEdge } from './ProducerBezierEdge';
import { clampProducerBezierCurvature } from './producerBezierEdgeMath';

test('clamps producer bezier curvature into the allowed tuning range', () => {
  expect(clampProducerBezierCurvature(undefined)).toBe(0.2);
  expect(clampProducerBezierCurvature(0.1)).toBe(0.18);
  expect(clampProducerBezierCurvature(0.2)).toBe(0.2);
  expect(clampProducerBezierCurvature(0.4)).toBe(0.22);
});

test('renders a custom bezier edge with thin default styling, wider interaction hit area, and hover feedback', () => {
  render(
    <svg>
      <ProducerBezierEdge
        data={{ relationType: 'references' }}
        id="edge-1"
        interactionWidth={16}
        source="node-a"
        sourcePosition={Position.Bottom}
        sourceX={20}
        sourceY={40}
        target="node-b"
        targetPosition={Position.Top}
        targetX={160}
        targetY={220}
      />
    </svg>,
  );

  const edge = screen.getByTestId('producer-bezier-edge-edge-1');
  const visiblePath = edge.querySelector('.react-flow__edge-path') as SVGPathElement;
  const interactionPath = edge.querySelector('.react-flow__edge-interaction') as SVGPathElement;

  expect(edge).toHaveAttribute('data-edge-type', 'producer-bezier');
  expect(visiblePath).toHaveStyle({
    stroke: 'rgba(17, 19, 24, 0.22)',
    strokeWidth: '1.5',
  });
  expect(interactionPath).toHaveAttribute('stroke-width', '16');

  fireEvent.mouseEnter(edge);

  expect(visiblePath).toHaveStyle({
    stroke: 'rgba(17, 19, 24, 0.34)',
    strokeWidth: '1.75',
  });
});

test('renders the selected producer bezier edge state with the accent stroke', () => {
  render(
    <svg>
      <ProducerBezierEdge
        data={{ relationType: 'approved_from' }}
        id="edge-selected"
        interactionWidth={20}
        markerEnd="url(#producer-bezier-arrow)"
        selected
        source="node-a"
        sourcePosition={Position.Bottom}
        sourceX={40}
        sourceY={32}
        target="node-b"
        targetPosition={Position.Top}
        targetX={200}
        targetY={240}
      />
    </svg>,
  );

  const edge = screen.getByTestId('producer-bezier-edge-edge-selected');
  const visiblePath = edge.querySelector('.react-flow__edge-path') as SVGPathElement;

  expect(edge).toHaveAttribute('data-edge-state', 'selected');
  expect(visiblePath).toHaveStyle({
    stroke: '#5B84FF',
    strokeWidth: '2',
  });
  expect(visiblePath).toHaveAttribute('marker-end', 'url(#producer-bezier-arrow)');
});
