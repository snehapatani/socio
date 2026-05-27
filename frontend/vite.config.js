import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.js"],
  },
  server: {
    port: 5173,
    proxy: {
      "/auth":       "http://localhost:8000",
      "/businesses": "http://localhost:8000",
      "/posts":      "http://localhost:8000",
      "/approve": {
        target: "http://localhost:8000",
        bypass(req) {
          // Result pages are handled by the React app, not the backend
          const resultPages = ["/approve/success", "/approve/invalid", "/approve/expired", "/approve/already-used"];
          if (resultPages.some(p => req.url.startsWith(p))) return req.url;
        },
      }
    },
  },
});
