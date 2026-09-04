import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@mhfps/shared": "/app/shared/index.js"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 8080,
    allowedHosts: true
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173
  }
});
