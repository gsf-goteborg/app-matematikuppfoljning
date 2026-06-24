import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path is "/" for local dev/build, and "/<repo>/" for GitHub Pages
// (set VITE_BASE in the Pages workflow). Keeps local previews working at root.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: { port: 5173 },
});
