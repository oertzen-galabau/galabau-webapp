'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { SchedulePlanningClient } from '@/components/schedule/schedule-planning-client';

const SchedulePlanningClientLazy = dynamic(
  () => import('@/components/schedule/schedule-planning-client').then((m) => m.SchedulePlanningClient),
  {
    ssr: false,
    loading: () => <p className="muted">Einsatzplanung wird geladen…</p>,
  },
);

type Props = ComponentProps<typeof SchedulePlanningClient>;

export function SchedulePlanningLoader(props: Props) {
  return <SchedulePlanningClientLazy {...props} />;
}
