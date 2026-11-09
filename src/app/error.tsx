"use client";

import Link from "next/link";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="status-page" role="alert">
      <section className="status-card" aria-labelledby="error-title">
        <p className="status-kicker">AQIZAAI · WORKSPACE</p>
        <h1 id="error-title">This page hit a snag.</h1>
        <p className="status-description">
          A temporary error interrupted this page. Try again, or return to your workspace.
        </p>
        {error.digest && <p className="status-reference">Reference: {error.digest}</p>}
        <div className="status-actions">
          <button className="status-primary" type="button" onClick={reset}>Try again</button>
          <Link className="status-secondary" href="/">Return to workspace</Link>
        </div>
      </section>
    </main>
  );
}
