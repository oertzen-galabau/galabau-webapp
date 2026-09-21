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
          return (
            <li key={id}>
              <label className="infoboard-picker-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onToggle(id, event.target.checked)}
                />
                <span>
                  <strong>{def.label}</strong>
                  <small>{def.category === 'metric' ? 'Metrik' : def.category === 'panel' ? 'Panel' : 'Hinweis'}</small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
