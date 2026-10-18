'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import GridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { InfoboardEditToolbar } from '@/components/infoboard/infoboard-edit-toolbar';
import { InfoboardWidgetFrame } from '@/components/infoboard/infoboard-widget-frame';
import { InfoboardWidgetPicker } from '@/components/infoboard/infoboard-widget-picker';
import { RenderWidget } from '@/components/infoboard/render-widget';
import { saveDashboardLayout } from '@/lib/actions/infoboard';
import {
  compactDashboardLayout,
  layoutForTabletDisplay,
  layoutToGridLayout,
  mergeGridLayoutChange,
  setWidgetVisibility,
} from '@/lib/infoboard/layout';
import { useInfoboardMobile } from '@/lib/infoboard/use-infoboard-mobile';
import { useInfoboardTablet } from '@/lib/infoboard/use-infoboard-tablet';
import type {
  DashboardLayout,
  InfoboardWidgetData,
  InfoboardWidgetId,
} from '@/lib/infoboard/types';
import { isWidgetLocked } from '@/lib/infoboard/layout';
import {
  INFOBOARD_GRID_COLS,
  INFOBOARD_ROW_HEIGHT,
  INFOBOARD_TABLET_COLS,
} from '@/lib/infoboard/widgets';

type Props = {
  initialLayout: DashboardLayout;
  widgetData: InfoboardWidgetData;
  allowedWidgetIds: InfoboardWidgetId[];
  canCustomize: boolean;
};

export function InfoboardDashboard({
  initialLayout,
  widgetData,
  allowedWidgetIds,
  canCustomize,
}: Props) {
  const isMobile = useInfoboardMobile();
  const isTablet = useInfoboardTablet();
  const { width, containerRef } = useContainerWidth({ initialWidth: 1280 });
  const [savedLayout, setSavedLayout] = useState(initialLayout);
  const [draftLayout, setDraftLayout] = useState(initialLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  const activeLayout = isEditing ? draftLayout : savedLayout;
  const gridCols = isTablet ? INFOBOARD_TABLET_COLS : INFOBOARD_GRID_COLS;

  const displayLayout = useMemo(
    () => (isTablet ? layoutForTabletDisplay(activeLayout) : activeLayout),
    [activeLayout, isTablet],
  );

  const gridLayout = useMemo(
    () => layoutToGridLayout(displayLayout.items, gridCols),
    [displayLayout, gridCols],
  );

  const stackItems = useMemo(
    () =>
      activeLayout.items
        .filter((item) => item.visible)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    [activeLayout],
  );

  const showEditChrome = isEditing && !isMobile;

  const applyGridLayout = useCallback(
    (nextLayout: Layout, compact: boolean) => {
      setDraftLayout((current) => {
        const merged = mergeGridLayoutChange(
          current,
          nextLayout.map((item) => ({
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          })),
        );
        return compact ? compactDashboardLayout(merged) : merged;
      });
    },
    [],
  );

  const handleLayoutChange = useCallback(
    (nextLayout: Layout) => {
      if (!isEditing || isMobile || isTablet) return;
      applyGridLayout(nextLayout, false);
    },
    [isEditing, isMobile, isTablet, applyGridLayout],
  );

  const handleInteractionStop = useCallback(
    (nextLayout: Layout) => {
      if (!isEditing || isMobile || isTablet) return;
      applyGridLayout(nextLayout, true);
    },
    [isEditing, isMobile, isTablet, applyGridLayout],
  );

  const handleToggleWidget = useCallback((widgetId: InfoboardWidgetId, visible: boolean) => {
    setDraftLayout((current) => setWidgetVisibility(current, widgetId, visible));
  }, []);

  const handleRemoveWidget = useCallback((widgetId: InfoboardWidgetId) => {
    if (isWidgetLocked(widgetId)) return;
    setDraftLayout((current) => setWidgetVisibility(current, widgetId, false));
  }, []);

  const handleStartEdit = () => {
    setSaveMessage(null);
    setDraftLayout(savedLayout);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftLayout(savedLayout);
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleSave = () => {
    startSaveTransition(async () => {
      const result = await saveDashboardLayout(draftLayout);
      if (!result.ok) {
        setSaveMessage(result.error);
        return;
      }
      setSavedLayout(draftLayout);
      setIsEditing(false);
      setSaveMessage('Layout gespeichert.');
    });
  };

  const emptyHint =
    stackItems.length === 0
      ? isEditing
        ? isMobile
          ? 'Wähle oben Widgets aus, um sie auf dem Infoboard anzuzeigen.'
          : 'Wähle links Widgets aus, um sie auf dem Infoboard anzuzeigen.'
        : 'Keine Widgets sichtbar. Passe dein Infoboard an, um Inhalte hinzuzufügen.'
      : null;

  return (
    <>
      <div className={`page-heading${isMobile ? ' page-heading--stack' : ''}`}>
        <div>
          <span className="eyebrow">Büro · Live-Status</span>
          <h1>{widgetData.greeting}, {widgetData.firstName}.</h1>
          <p>{widgetData.subtitle}</p>
        </div>
        {canCustomize && !isMobile && (
          <InfoboardEditToolbar
            isEditing={isEditing}
            isSaving={isSaving}
            saveMessage={saveMessage}
            onStartEdit={handleStartEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            variant="inline"
          />
        )}
        {canCustomize && isMobile && !isEditing && (
          <InfoboardEditToolbar
            isEditing={false}
            isSaving={isSaving}
            saveMessage={saveMessage}
            onStartEdit={handleStartEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            variant="inline"
          />
        )}
      </div>

      <div
        className={`infoboard-shell${isEditing ? ' infoboard-shell-editing' : ''}${isMobile ? ' infoboard-shell-mobile' : ''}${isEditing && isMobile ? ' infoboard-shell-mobile-editing' : ''}`}
      >
        {isEditing && (
          <InfoboardWidgetPicker
            layout={draftLayout}
            allowedWidgetIds={allowedWidgetIds}
            onToggle={handleToggleWidget}
          />
        )}

        <div className="infoboard-grid-wrap" ref={containerRef}>
          {isMobile && stackItems.length > 0 && (
            <div className="infoboard-stack">
              {stackItems.map((item) => (
                <InfoboardWidgetFrame
                  key={item.id}
                  widgetId={item.id}
                  showEditChrome={showEditChrome}
                  onRemove={() => handleRemoveWidget(item.id)}
                >
                  <RenderWidget widgetId={item.id} data={widgetData} />
                </InfoboardWidgetFrame>
              ))}
            </div>
          )}

          {!isMobile && gridLayout.length > 0 && (
            <GridLayout
              className="infoboard-grid"
              width={width}
              layout={gridLayout}
              compactor={verticalCompactor}
              gridConfig={{
                cols: gridCols,
                rowHeight: INFOBOARD_ROW_HEIGHT,
                margin: [12, 12] as const,
                containerPadding: [0, 0] as const,
              }}
              dragConfig={{
                enabled: isEditing && !isTablet,
                handle: '.infoboard-widget-chrome',
                cancel: '.infoboard-widget-remove',
                bounded: true,
              }}
              resizeConfig={{
                enabled: isEditing && !isTablet,
                handles: ['se'] as const,
              }}
              onLayoutChange={handleLayoutChange}
              onDragStop={handleInteractionStop}
              onResizeStop={handleInteractionStop}
            >
              {gridLayout.map((item) => (
                <div key={item.i}>
                  <InfoboardWidgetFrame
                    widgetId={item.i as InfoboardWidgetId}
                    showEditChrome={showEditChrome}
                    onRemove={() => handleRemoveWidget(item.i as InfoboardWidgetId)}
                  >
                    <RenderWidget
                      widgetId={item.i as InfoboardWidgetId}
                      data={widgetData}
                    />
                  </InfoboardWidgetFrame>
                </div>
              ))}
            </GridLayout>
          )}

          {emptyHint && (
            <div className="panel infoboard-empty-state">
              <p className="muted">{emptyHint}</p>
            </div>
          )}
        </div>
      </div>

      {canCustomize && isMobile && isEditing && (
        <InfoboardEditToolbar
          isEditing
          isSaving={isSaving}
          saveMessage={saveMessage}
          onStartEdit={handleStartEdit}
          onCancel={handleCancel}
          onSave={handleSave}
          variant="sticky"
        />
      )}
    </>
  );
}
