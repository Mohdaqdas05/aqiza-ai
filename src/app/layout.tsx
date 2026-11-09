import type { Metadata, Viewport } from "next";
import "highlight.js/styles/github-dark.css";
import "@/app/globals.css";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";

export const metadata: Metadata = {
  title: { default: "AqizaAI — Developer chat", template: "%s · AqizaAI" },
  description: "A focused AI workspace for developers. Switch models, keep your conversations, and work with code in context.",
  applicationName: "AqizaAI",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "AqizaAI",
    title: "AqizaAI — Developer chat",
    description: "A focused AI workspace for developers. Switch models, keep your conversations, and work with code in context.",
  },
  twitter: {
    card: "summary",
    title: "AqizaAI — Developer chat",
    description: "A focused AI workspace for developers. Switch models, keep your conversations, and work with code in context.",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body><AuthSessionProvider>{children}</AuthSessionProvider></body>
    </html>
  );
}
