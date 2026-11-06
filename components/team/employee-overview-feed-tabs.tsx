'use client';

import { useState, type ReactNode } from 'react';

type FeedTabId = 'time' | 'leave';

type Props = {
  timeContent: ReactNode;
  leaveContent: ReactNode;
};

export function EmployeeOverviewFeedTabs({ timeContent, leaveContent }: Props) {
  const [active, setActive] = useState<FeedTabId>('time');

  return (
    <section className="employee-feed-tabs" aria-label="Letzte Aktivitäten">
      <div className="schedule-entry-tabs employee-feed-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          id="employee-feed-tab-time"
          aria-selected={active === 'time'}
          aria-controls="employee-feed-panel-time"
          className={active === 'time' ? 'active' : undefined}
          onClick={() => setActive('time')}
        >
          Zeiteinträge
        </button>
        <button
          type="button"
          role="tab"
          id="employee-feed-tab-leave"
          aria-selected={active === 'leave'}
          aria-controls="employee-feed-panel-leave"
          className={active === 'leave' ? 'active' : undefined}
          onClick={() => setActive('leave')}
        >
          Urlaubsanträge
        </button>
      </div>
      <div
        id="employee-feed-panel-time"
        role="tabpanel"
        aria-labelledby="employee-feed-tab-time"
        hidden={active !== 'time'}
        className="employee-feed-tab-panel"
      >
        {timeContent}
      </div>
      <div
        id="employee-feed-panel-leave"
        role="tabpanel"
        aria-labelledby="employee-feed-tab-leave"
        hidden={active !== 'leave'}
        className="employee-feed-tab-panel"
      >
        {leaveContent}
      </div>
    </section>
  );
}
