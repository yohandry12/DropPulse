import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api and /auth to the Express backend so the browser stays same-origin
// in dev (no CORS config needed on the backend).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
