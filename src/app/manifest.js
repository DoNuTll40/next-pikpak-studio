export default function manifest() {
  return {
    id: "/library",
    name: "PikPak Studio",
    short_name: "PikPak Studio",
    description: "คลังส่วนตัวของ PikPak Studio",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#111522",
    theme_color: "#111522",
    lang: "th",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
