type PageLoadingSkeletonProps = {
  tall?: boolean;
};

export function PageLoadingSkeleton({ tall = false }: PageLoadingSkeletonProps) {
  return (
    <div className={`page-loading-skeleton${tall ? ' page-loading-skeleton--tall' : ''}`} aria-hidden="true">
      <div className="page-loading-skeleton__title" />
      <div className="page-loading-skeleton__panel">
        <div className="page-loading-skeleton__line page-loading-skeleton__line--wide" />
        <div className="page-loading-skeleton__line" />
        <div className="page-loading-skeleton__line page-loading-skeleton__line--short" />
      </div>
      <div className="page-loading-skeleton__panel">
        <div className="page-loading-skeleton__line page-loading-skeleton__line--wide" />
        <div className="page-loading-skeleton__line" />
      </div>
    </div>
  );
}
