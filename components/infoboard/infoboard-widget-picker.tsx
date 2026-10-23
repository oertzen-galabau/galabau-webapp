'use client';

import { useMemo } from 'react';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/infoboard/layout';
import type { DashboardLayout, InfoboardWidgetId } from '@/lib/infoboard/types';
import { WIDGET_REGISTRY } from '@/lib/infoboard/widgets';

function sortWidgetsForPicker(ids: InfoboardWidgetId[]): InfoboardWidgetId[] {
  const rank = new Map(DEFAULT_DASHBOARD_LAYOUT.items.map((item, index) => [item.id, index]));
  return [...ids].sort((a, b) => {
    const ra = rank.get(a) ?? 1000;
    const rb = rank.get(b) ?? 1000;
    if (ra !== rb) return ra - rb;
    return WIDGET_REGISTRY[a].label.localeCompare(WIDGET_REGISTRY[b].label, 'de');
  });
}

type Props = {
  layout: DashboardLayout;
  allowedWidgetIds: InfoboardWidgetId[];
  onToggle: (widgetId: InfoboardWidgetId, visible: boolean) => void;
};

export function InfoboardWidgetPicker({ layout, allowedWidgetIds, onToggle }: Props) {
  const visibleIds = new Set(layout.items.filter((item) => item.visible).map((item) => item.id));
  const pickerIds = useMemo(() => sortWidgetsForPicker(allowedWidgetIds), [allowedWidgetIds]);

  return (
    <aside className="infoboard-widget-picker panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Anpassen</span>
          <h2>Widgets</h2>
        </div>
      </div>
      <ul className="infoboard-picker-list">
        {pickerIds.map((id) => {
          const def = WIDGET_REGISTRY[id];
          const checked = visibleIds.has(id);
          const isLocked = def.locked === true;
          return (
            <li key={id}>
              <label
                className={`infoboard-picker-item${isLocked ? ' infoboard-picker-item--locked' : ''}`}
                title={isLocked ? 'Pflicht-Widget — immer sichtbar' : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLocked}
                  aria-label={isLocked ? `${def.label} (Pflicht-Widget)` : def.label}
                  onChange={(event) => onToggle(id, event.target.checked)}
                />
                <strong>{def.label}</strong>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
