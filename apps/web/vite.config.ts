import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  build: {
    // TASK-063: dependencies live in a dedicated vendor chunk so application
    // code stays tiny (~49 kB). The vendor chunk is dominated by MapLibre GL JS
    // (~970 kB raw / ~273 kB gzip); the raised warning limit documents that
    // this size is a known, accepted property of the map library.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
