export default function Loading() {
  return (
    <main className="route-loading" aria-label="Loading AqizaAI" aria-busy="true">
      <div className="route-loading-inner">
        <div className="route-loading-heading"><span className="route-skeleton route-skeleton-label" /><span className="route-skeleton route-skeleton-title" /></div>
        <div className="route-loading-message route-loading-user"><span className="route-skeleton route-skeleton-line" /><span className="route-skeleton route-skeleton-short" /></div>
        <div className="route-loading-message"><span className="route-skeleton route-skeleton-line" /><span className="route-skeleton route-skeleton-line" /><span className="route-skeleton route-skeleton-medium" /></div>
      </div>
    </main>
  );
}
