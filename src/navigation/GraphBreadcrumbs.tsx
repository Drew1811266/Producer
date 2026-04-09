import type { GraphContextTrailItem } from '../bridge/contracts';
import { formatGraphTrailLabelZh } from '../copy/zh-CN';

type GraphBreadcrumbsProps = {
  pendingNavigation: boolean;
  trail: GraphContextTrailItem[];
  onActivateGraph(graphId: string): void;
};

function resolveTrailLabel(item: GraphContextTrailItem): string {
  return formatGraphTrailLabelZh(item);
}

export function GraphBreadcrumbs({
  pendingNavigation,
  trail,
  onActivateGraph,
}: GraphBreadcrumbsProps) {
  return (
    <nav aria-label="画布层级路径" className="graph-breadcrumbs">
      <ol className="graph-breadcrumbs-list">
        {trail.map((item, index) => {
          const isCurrent = index === trail.length - 1;
          const label = resolveTrailLabel(item);

          return (
            <li key={`${item.graphId}:${index}`} className="graph-breadcrumbs-item">
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="graph-breadcrumbs-current"
                  data-graph-id={item.graphId}
                >
                  <span className="graph-breadcrumbs-label-text">{label}</span>
                </span>
              ) : (
                <button
                  className="graph-breadcrumbs-button"
                  data-graph-id={item.graphId}
                  disabled={pendingNavigation}
                  type="button"
                  onClick={() => onActivateGraph(item.graphId)}
                >
                  <span className="graph-breadcrumbs-label-text">{label}</span>
                </button>
              )}

              {!isCurrent ? (
                <span aria-hidden="true" className="graph-breadcrumbs-separator">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
