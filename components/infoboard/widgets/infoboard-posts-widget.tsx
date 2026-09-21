import type { InfoboardPostRow } from '@/lib/infoboard/types';

type Props = {
  posts: InfoboardPostRow[];
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

export function InfoboardPostsWidget({ posts }: Props) {
  return (
    <section className="panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Infoboard</span>
          <h2>Beiträge</h2>
        </div>
      </div>
      <div className="infoboard-post-list">
        {posts.map((post) => (
          <article className="infoboard-post-item" key={post.id}>
            <header>
              <strong>{post.title}</strong>
              <small>{formatDate(post.publishedAt ?? post.createdAt)}</small>
            </header>
            <p>{post.content}</p>
            {post.postType && <span className="status-badge planned">{post.postType}</span>}
          </article>
        ))}
        {!posts.length && <p className="muted">Noch keine Beiträge veröffentlicht.</p>}
      </div>
    </section>
  );
}
