import { defineConfig } from "vite";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  root: ".",
  server: { host: "0.0.0.0", port: 5173 },
  resolve: {
    alias: {
      "@mhfps/shared": fileURLToPath(new URL("../shared/index.js", import.meta.url)),
    },
  },
});
