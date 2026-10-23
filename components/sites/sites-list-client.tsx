'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { reorderSitesAction } from '@/lib/actions/site-appearance';
import { formatSiteAddress } from '@/lib/sites/format-address';
import { resolveSiteCover, type SiteCoverSource } from '@/lib/sites/resolve-site-cover';
import { SiteListPreview } from '@/components/sites/site-list-preview';

export type SiteListRow = SiteCoverSource & {
  name: string;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  address: string | null;
};

type Props = {
  activeSites: SiteListRow[];
  archivedSites: SiteListRow[];
  signedUrls: Record<string, string>;
  documentPathById: Record<string, string>;
  canReorder: boolean;
  showArchived: boolean;
};

function SortableSiteRow({
  site,
  cover,
  canReorder,
}: {
  site: SiteListRow;
  cover: ReturnType<typeof resolveSiteCover>;
  canReorder: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: site.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'site-list-row site-list-row--sortable site-list-row--dragging document-card'
          : 'site-list-row site-list-row--sortable document-card'
      }
    >
      <button
        type="button"
        className="site-list-drag-handle"
        aria-label={`Reihenfolge: ${site.name}`}
        {...attributes}
        {...listeners}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical size={18} aria-hidden />
      </button>
      <Link href={`/app/baustellen/${site.id}`} className="site-list-card-link">
        <SiteListPreview cover={cover} />
        <div className="site-list-card-copy">
          <strong>{site.name}</strong>
          <small>{formatSiteAddress(site) ?? 'Keine Adresse'}</small>
        </div>
      </Link>
    </div>
  );
}

function StaticSiteRow({
  site,
  cover,
  archived,
}: {
  site: SiteListRow;
  cover: ReturnType<typeof resolveSiteCover>;
  archived?: boolean;
}) {
  return (
    <div className="site-list-row document-card">
      <Link href={`/app/baustellen/${site.id}`} className="site-list-card-link">
        <SiteListPreview cover={cover} />
        <div className="site-list-card-copy">
          {archived ? <span className="site-list-card-badge">Abgeschlossen</span> : null}
          <strong>{site.name}</strong>
          <small>{formatSiteAddress(site) ?? 'Keine Adresse'}</small>
        </div>
      </Link>
    </div>
  );
}

export function SitesListClient({
  activeSites,
  archivedSites,
  signedUrls,
  documentPathById,
  canReorder,
  showArchived,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(activeSites);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const signedMap = useMemo(() => new Map(Object.entries(signedUrls)), [signedUrls]);
  const docPathMap = useMemo(() => new Map(Object.entries(documentPathById)), [documentPathById]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setItems(activeSites);
  }, [activeSites]);

  const ids = useMemo(() => items.map((s) => s.id), [items]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderSitesAction(next.map((s) => s.id));
      if (!result.ok) {
        setError(result.error);
        setItems(activeSites);
      } else {
        router.refresh();
      }
    });
  }

  if (activeSites.length === 0 && !(showArchived && archivedSites.length > 0)) {
    return <p className="muted" style={{ marginTop: 16 }}>Noch keine aktiven Baustellen.</p>;
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      {items.length > 0 ? (
        canReorder ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className={`sites-list${pending ? ' sites-list--pending' : ''}`}>
                {items.map((site) => (
                  <SortableSiteRow
                    key={site.id}
                    site={site}
                    canReorder
                    cover={resolveSiteCover(site, signedMap, docPathMap)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="sites-list">
            {items.map((site) => (
              <StaticSiteRow
                key={site.id}
                site={site}
                cover={resolveSiteCover(site, signedMap, docPathMap)}
              />
            ))}
          </div>
        )
      ) : null}

      {showArchived && (
        <>
          <h2 className="sites-list-archived-heading">Abgeschlossen</h2>
          {archivedSites.length === 0 ? (
            <p className="muted">Keine abgeschlossenen Baustellen.</p>
          ) : (
            <div className="sites-list">
              {archivedSites.map((site) => (
                <StaticSiteRow
                  key={site.id}
                  site={site}
                  archived
                  cover={resolveSiteCover(site, signedMap, docPathMap)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
