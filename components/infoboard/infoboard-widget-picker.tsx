'use client';

import type { DashboardLayout, InfoboardWidgetId } from '@/lib/infoboard/types';
import { WIDGET_REGISTRY } from '@/lib/infoboard/widgets';

type Props = {
  layout: DashboardLayout;
  allowedWidgetIds: InfoboardWidgetId[];
  onToggle: (widgetId: InfoboardWidgetId, visible: boolean) => void;
};

export function InfoboardWidgetPicker({ layout, allowedWidgetIds, onToggle }: Props) {
  const visibleIds = new Set(layout.items.filter((item) => item.visible).map((item) => item.id));

  return (
    <aside className="infoboard-widget-picker panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Anpassen</span>
          <h2>Widgets</h2>
        </div>
      </div>
      <ul className="infoboard-picker-list">
        {allowedWidgetIds.map((id) => {
          const def = WIDGET_REGISTRY[id];
          const checked = visibleIds.has(id);
          const isLocked = def.locked === true;
          const categoryLabel =
            def.category === 'metric' ? 'Metrik' : def.category === 'panel' ? 'Panel' : 'Hinweis';
          return (
            <li key={id}>
              <label className={`infoboard-picker-item${isLocked ? ' infoboard-picker-item--locked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLocked}
                  onChange={(event) => onToggle(id, event.target.checked)}
                />
                <span>
                  <strong>{def.label}</strong>
                  <small>
                    {isLocked ? 'Pflicht-Widget' : categoryLabel}
                  </small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
