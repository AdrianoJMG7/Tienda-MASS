import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api y /media (fotos de productos) se redirigen al backend de Django.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000", "/media": "http://127.0.0.1:8000" },
  },
});
