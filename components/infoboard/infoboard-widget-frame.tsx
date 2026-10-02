'use client';

import { GripVertical, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { WIDGET_REGISTRY } from '@/lib/infoboard/widgets';
import type { InfoboardWidgetId } from '@/lib/infoboard/types';

type Props = {
  widgetId: InfoboardWidgetId;
  showEditChrome: boolean;
  onRemove: () => void;
  children: ReactNode;
};

export function InfoboardWidgetFrame({ widgetId, showEditChrome, onRemove, children }: Props) {
  const def = WIDGET_REGISTRY[widgetId];
  const label = def.label;
  const isLocked = def.locked === true;

  return (
    <div
      className={`infoboard-widget-frame${showEditChrome ? ' infoboard-widget-frame-editing' : ''}${!showEditChrome ? ' infoboard-widget-frame-stack' : ''}`}
    >
      {showEditChrome && (
        <div className="infoboard-widget-chrome">
          <span className="infoboard-drag-handle" aria-label={`${label} verschieben`}>
            <GripVertical size={16} />
            {label}
            {isLocked && <small className="infoboard-widget-locked-hint">Pflicht</small>}
          </span>
          {!isLocked && (
            <button
              type="button"
              className="infoboard-widget-remove"
              aria-label={`${label} ausblenden`}
              onClick={onRemove}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      <div
        className={`infoboard-widget-body${showEditChrome ? ' infoboard-widget-body-editing' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
