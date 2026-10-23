'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatInfoboardPostDate } from '@/components/infoboard/infoboard-posts-list';
import type { InfoboardPostRow } from '@/lib/infoboard/types';

const ROTATE_MS = 4500;

type Props = {
  unreadPosts: InfoboardPostRow[];
  onOpen: () => void;
};

export function InfoboardPostBanner({ unreadPosts, onOpen }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = unreadPosts.length;
  const activePost = unreadPosts[activeIndex] ?? unreadPosts[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [unreadPosts]);

  useEffect(() => {
    if (reduceMotion || count <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reduceMotion, unreadPosts]);

  if (!activePost) return null;

  const countLabel =
    count === 1 ? 'Neuer Beitrag' : `${count} neue Beiträge`;

  return (
    <button
      type="button"
      className="infoboard-post-banner"
      onClick={onOpen}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={`${countLabel}: ${activePost.title}. Alle Beiträge anzeigen.`}
    >
      <span className="infoboard-post-banner-icon" aria-hidden="true">
        <Megaphone size={20} />
      </span>
      <span className="infoboard-post-banner-body">
        <span className="infoboard-post-banner-meta">
          <span className="infoboard-post-unread-label">Neu</span>
          <span className="infoboard-post-banner-eyebrow">{countLabel}</span>
          {count > 1 && (
            <span className="infoboard-post-banner-rotate-index" aria-hidden="true">
              {activeIndex + 1}/{count}
            </span>
          )}
        </span>
        <span className="infoboard-post-banner-title-wrap" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={activePost.id}
              className="infoboard-post-banner-title-motion"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
            >
              <strong className="infoboard-post-banner-title">{activePost.title}</strong>
              <small className="infoboard-post-banner-date">
                {formatInfoboardPostDate(activePost.publishedAt ?? activePost.createdAt)}
              </small>
            </motion.span>
          </AnimatePresence>
        </span>
        {count > 1 && (
          <span className="infoboard-post-banner-dots" aria-hidden="true">
            {unreadPosts.map((post, index) => (
              <span
                key={post.id}
                className={`infoboard-post-banner-dot${index === activeIndex ? ' infoboard-post-banner-dot--active' : ''}`}
              />
            ))}
          </span>
        )}
      </span>
      <ChevronRight size={20} className="infoboard-post-banner-chevron" aria-hidden="true" />
    </button>
  );
}
