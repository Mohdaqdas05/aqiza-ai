"use client";

import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0d0d0d", color: "#ececec", fontFamily: "IBM Plex Sans, Segoe UI, sans-serif" }}>
        <main style={{ boxSizing: "border-box", display: "grid", minHeight: "100vh", placeItems: "center", padding: 24 }}>
          <section style={{ boxSizing: "border-box", width: "min(100%, 480px)", padding: 32, background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: 14 }}>
            <p style={{ color: "#10a37f", fontSize: 11, fontWeight: 700, letterSpacing: ".12em" }}>AQIZAAI · WORKSPACE</p>
            <h1 style={{ margin: "18px 0 8px", fontSize: 30, lineHeight: 1.2 }}>AqizaAI needs to restart.</h1>
            <p style={{ color: "#c0b8ad", lineHeight: 1.7 }}>The workspace could not finish loading. Try again, or return to the home page.</p>
            {error.digest && <p style={{ color: "#958c80", fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</p>}
            <button type="button" onClick={reset} style={{ marginTop: 12, padding: "10px 14px", color: "#05231b", background: "#10a37f", border: 0, borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>Restart workspace</button>
            <Link href="/" style={{ display: "inline-block", marginLeft: 12, color: "#c0b8ad", fontSize: 13 }}>Home</Link>
          </section>
        </main>
      </body>
    </html>
  );
}
