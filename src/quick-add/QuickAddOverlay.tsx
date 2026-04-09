import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { GraphNodeTypeOption } from '../bridge/contracts';
import { formatNodeDefaultTitleZh, formatNodeTypeLabelZh, zhCN } from '../copy/zh-CN';
import type { CanvasQuickAddAnchor, CachedNodeTypeOptions } from './types';

type QuickAddOverlayProps = {
  anchor: CanvasQuickAddAnchor;
  createError?: string | null;
  isCreating?: boolean;
  optionsState: CachedNodeTypeOptions;
  onClose(): void;
  onCreate(option: GraphNodeTypeOption): void;
};

const QUICK_ADD_OVERLAY_Z_INDEX = 4;

function matchesOption(option: GraphNodeTypeOption, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const label = formatNodeTypeLabelZh(option.nodeType, option.label).toLowerCase();
  const hint = formatNodeDefaultTitleZh(option.nodeType, option.label).toLowerCase();

  return (
    label.includes(normalizedQuery) ||
    hint.includes(normalizedQuery) ||
    option.label.toLowerCase().includes(normalizedQuery) ||
    option.nodeType.replace(/_/g, ' ').toLowerCase().includes(normalizedQuery)
  );
}

function clampPopoverPosition(anchor: CanvasQuickAddAnchor): {
  left: number;
  top: number;
} {
  const inset = 24;
  const estimatedWidth = 320;
  const estimatedHeight = 360;

  if (typeof window === 'undefined') {
    return {
      left: anchor.screenX,
      top: anchor.screenY,
    };
  }

  return {
    left: Math.max(inset, Math.min(anchor.screenX, window.innerWidth - estimatedWidth - inset)),
    top: Math.max(inset, Math.min(anchor.screenY, window.innerHeight - estimatedHeight - inset)),
  };
}

export function QuickAddOverlay({
  anchor,
  createError = null,
  isCreating = false,
  optionsState,
  onClose,
  onCreate,
}: QuickAddOverlayProps) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listboxId = useId();
  const filteredOptions = optionsState.options.filter((option) => matchesOption(option, query));
  const activeIndex = filteredOptions.length === 0 ? -1 : Math.min(highlightedIndex, filteredOptions.length - 1);
  const activeOption = activeIndex >= 0 ? filteredOptions[activeIndex] : null;
  const activeOptionId = activeOption ? `${listboxId}-${activeOption.nodeType}` : undefined;
  const position = clampPopoverPosition(anchor);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();

      return;
    }

    if (isCreating || optionsState.status !== 'ready' || filteredOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex((current) => (current + 1) % filteredOptions.length);

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex((current) => (current - 1 + filteredOptions.length) % filteredOptions.length);

      return;
    }

    if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      event.stopPropagation();
      onCreate(activeOption);
    }
  }

  return (
    <section
      aria-label={zhCN.quickAdd.dialogLabel}
      className="quick-add-overlay"
      role="dialog"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: QUICK_ADD_OVERLAY_Z_INDEX,
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="quick-add-header">
        <div className="quick-add-copy">
          <span className="overlay-label">{zhCN.quickAdd.eyebrow}</span>
          <strong>{zhCN.quickAdd.title}</strong>
          <p className="quick-add-description">{zhCN.quickAdd.description}</p>
        </div>

        <span aria-hidden="true" className="quick-add-keyboard-hint">
          Esc
        </span>
      </div>

      <label className="quick-add-search">
        <span className="overlay-label">{zhCN.quickAdd.searchLabel}</span>
        <input
          aria-activedescendant={activeOptionId}
          aria-controls={listboxId}
          aria-label={zhCN.quickAdd.searchAriaLabel}
          autoFocus
          className="quick-add-search-input"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
          }}
        />
      </label>

      {createError ? <div className="quick-add-state quick-add-state-error">{createError}</div> : null}

      {optionsState.status === 'loading' ? (
        <div className="quick-add-state" role="status">
          {zhCN.quickAdd.loading}
        </div>
      ) : null}

      {optionsState.status === 'error' ? (
        <div className="quick-add-state quick-add-state-error">
          {optionsState.error ?? zhCN.quickAdd.loadError}
        </div>
      ) : null}

      {optionsState.status === 'ready' ? (
        filteredOptions.length > 0 ? (
          <ul
            aria-label={zhCN.quickAdd.optionsAriaLabel}
            className="quick-add-option-list"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.map((option, index) => {
              const isSelected = index === activeIndex;
              const optionLabel = formatNodeTypeLabelZh(option.nodeType);
              const optionHint = formatNodeDefaultTitleZh(option.nodeType, option.label);

              return (
                <li key={option.nodeType}>
                  <button
                    aria-selected={isSelected}
                    className={`quick-add-option${isSelected ? ' quick-add-option-selected' : ''}`}
                    id={`${listboxId}-${option.nodeType}`}
                    role="option"
                    type="button"
                    disabled={isCreating}
                    onClick={() => {
                      onCreate(option);
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(index);
                    }}
                  >
                    <span className="quick-add-option-copy">
                      <strong>{optionLabel}</strong>
                      <span>{optionHint}</span>
                    </span>
                    <span aria-hidden="true" className="quick-add-option-hint">
                      {isSelected ? zhCN.quickAdd.confirmHint : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="quick-add-state">{zhCN.quickAdd.empty}</div>
        )
      ) : null}
    </section>
  );
}
