import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the site under /banking-empire/, so built asset paths
  // need that prefix. Local `vite dev` and `vite preview` both honor this.
  base: "/banking-empire/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
