import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Where the dev proxy sends /api. Set BACKEND_URL in .env.local (gitignored) to point at a
  // tunnel such as ngrok; unset, it falls back to a backend running on this machine.
  // Not VITE_-prefixed, so it stays in this config and never reaches the browser bundle.
  const backendUrl = loadEnv(mode, process.cwd(), "").BACKEND_URL || "http://localhost:63487";

  return {
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
          target: backendUrl,
          changeOrigin: true,
          // ngrok's free tier answers browser-like requests with an HTML warning page unless
          // this is set; harmless for any other backend.
          headers: { "ngrok-skip-browser-warning": "true" },
          // The chat hub (/api/hubs/chat) upgrades to a WebSocket.
          ws: true,
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
  };
});
