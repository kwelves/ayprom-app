import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), tailwind()],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    // The renderer CSP allows fonts and images from 'self' only, so every
    // asset ships as a file instead of an inline data: URI.
    assetsInlineLimit: 0,
  },
});
