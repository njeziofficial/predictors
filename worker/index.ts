// Mirrors nginx.conf: serve the SPA from static assets and forward /api/* to the backend,
// so the browser only ever talks to one origin (no CORS, VITE_API_URL stays "").
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (!env.BACKEND_URL) {
        return Response.json(
          { message: "Backend not configured: set BACKEND_URL on the Cloudflare Worker.", code: "backend_not_configured" },
          { status: 503 },
        );
      }
      const target = new URL(url.pathname + url.search, env.BACKEND_URL);
      const proxied = new Request(target, request);
      proxied.headers.set("X-Forwarded-Host", url.host);
      proxied.headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
      // Backend is exposed through ngrok's free tier, which otherwise answers browser-like
      // requests with an HTML interstitial; harmless when BACKEND_URL isn't ngrok.
      proxied.headers.set("ngrok-skip-browser-warning", "true");
      const ip = request.headers.get("CF-Connecting-IP");
      if (ip) {
        proxied.headers.set("X-Real-IP", ip);
        proxied.headers.set("X-Forwarded-For", ip);
      }
      return fetch(proxied);
    }

    return env.ASSETS.fetch(request);
  },
};
