import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home Screen"): opens full screen with the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cornell dining, filtered",
    short_name: "Dining",
    description: "See what you can eat in each Cornell dining hall, by allergen and diet.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#b31b1b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
