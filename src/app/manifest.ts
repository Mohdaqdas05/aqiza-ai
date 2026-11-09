import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AqizaAI — Developer chat",
    short_name: "AqizaAI",
    description: "A focused AI workspace for developers.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    lang: "en",
  };
}
