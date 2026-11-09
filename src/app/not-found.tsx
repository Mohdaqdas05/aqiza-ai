import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <section className="status-card" aria-labelledby="not-found-title">
        <p className="status-kicker">404 · NOT FOUND</p>
        <h1 id="not-found-title">This conversation isn’t here.</h1>
        <p className="status-description">It may have been deleted, or the address may be incomplete.</p>
        <div className="status-actions">
          <Link className="status-primary status-link-primary" href="/">Open workspace</Link>
        </div>
      </section>
    </main>
  );
}
