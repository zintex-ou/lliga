import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amics del futbol amateur", short_name: "Amics del futbol", description: "Lliga de veterans — classificació, resultats i calendari",
    start_url: "/", display: "standalone", background_color: "#F6F5F2", theme_color: "#17181C", lang: "ca",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
