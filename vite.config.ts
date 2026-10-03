import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Vite rejects requests whose Host header it doesn't recognize by default — a tunnel
    // (ngrok, etc.) arrives with a random generated hostname, so allow any host here.
    allowedHosts: true,
    // Lets the app be reached through a single tunneled origin (this dev server) without
    // exposing the backend itself: the browser calls same-origin "/api/...", and Vite
    // forwards that server-side to the backend running on localhost — see README/chat for
    // the VITE_API_URL="" pairing this requires.
    proxy: {
      "/api": {
        target: "http://localhost:63487",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
