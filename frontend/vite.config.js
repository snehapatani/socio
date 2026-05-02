import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth":       "http://localhost:8000",
      "/businesses": "http://localhost:8000",
      "/posts":      "http://localhost:8000",
      "/approve":    "http://localhost:8000"
    },
  },
});
