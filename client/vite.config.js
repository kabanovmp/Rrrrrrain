import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mhfps/shared": path.resolve(__dirname, "../shared/index.js")
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
