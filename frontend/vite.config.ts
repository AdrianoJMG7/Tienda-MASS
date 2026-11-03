import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// En desarrollo, /api y /media (fotos de productos) se redirigen al backend de Django.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192x192.svg", "icon-512x512.svg"],
      manifest: {
        name: "Mass - Tienda Online",
        short_name: "Mass",
        description: "Página web de compra online con recojo en tienda de Tiendas Mass",
        theme_color: "#FFD101",
        background_color: "#f5f6fa",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000", "/media": "http://127.0.0.1:8000" },
  },
});
