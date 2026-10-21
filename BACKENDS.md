# Pointing the frontend at a backend

This frontend works with either backend, from the same build:

| Backend | Folder | Live updates and chat use |
| --- | --- | --- |
| .NET (production today) | `../predictors-backend` | SignalR, at `/api/hubs/chat` |
| NestJS (the rewrite) | `../predictors-nest` | Socket.IO, at `/api/hubs/socket` |

Both serve the same `/api/...` routes and JSON. The one difference, the live connection, the app
works out for itself: before connecting it asks `GET /api/public/realtime`. The NestJS backend
answers `{"transport":"socketio"}`; the .NET backend has no such route and answers 404, which
means SignalR. While the backend can't answer yet (asleep, waking, offline) it asks again, the
same way the connection itself retries. See `src/lib/realtime.ts`.

**So the only thing to set is where `/api` goes.**

The browser always calls `/api/...` on the frontend's own origin (`VITE_API_URL` is left empty).
Whatever serves the frontend forwards those calls to the backend: Vite in development, nginx in
Docker, the Cloudflare Worker in production.

## Where to set it

### Local development (`npm run dev`)

In `.env.local` (gitignored). Restart `npm run dev` after changing it: Vite reads it on start.

```sh
VITE_API_URL=

# .NET backend run with `dotnet run` (its launch port):
BACKEND_URL=http://localhost:63487
# .NET backend's Docker stack (../predictors-backend):
# BACKEND_URL=http://localhost:5000
# NestJS backend's Docker stack (../predictors-nest):
# BACKEND_URL=http://localhost:3001
```

`BACKEND_URL` is only read by the dev server's proxy (`vite.config.ts`), never sent to the
browser. Unset, it falls back to `http://localhost:63487`.

### Docker

Nothing to set: each backend's compose file builds this frontend and points nginx at its own API
(`nginx.conf` forwards `/api/` to the container named `api`).

| Backend | Start it | Open |
| --- | --- | --- |
| NestJS | `docker compose up -d --build` in `../predictors-nest` | http://localhost:8090 |

### Production (Cloudflare Worker)

`BACKEND_URL` in `wrangler.jsonc` (`vars`), the backend's public URL with no trailing slash:

| .NET backend | NestJS backend |
| --- | --- |
| `https://predictors-backend.onrender.com` (today's value) | the NestJS server's public URL |

Then `npx wrangler deploy`. No rebuild is needed to switch: the same build works against both.
For `wrangler dev`, `.dev.vars` (gitignored) overrides `BACKEND_URL`.

## What else a switch affects

- **Everyone is signed out.** Each backend signs its own tokens, so one's are refused by the
  other and players sign in again. To avoid it, give the NestJS backend the same key the .NET
  API uses (`JWT_KEY` there, `Jwt__Key` here) and the same database.
- **Data.** The NestJS stack uses its own local database, a copy of Supabase
  (`node scripts/copy-supabase.mjs` in `../predictors-nest` refreshes it). For production it
  would need `DATABASE_URL` pointed at Supabase instead. **Run only one backend against a
  database at a time**: both scrape scores and would overwrite each other's fixtures. The admin
  Scraper Health page warns when it sees this.
- **Push notifications** are off on the NestJS stack (`PUSH_DELIVERY: "off"`), because its
  database copy holds players' real phone subscriptions. Turn it on only once it's the live
  backend.
- **Not on NestJS yet** (its phase 5): the wallet, fingerprint/face sign-in, emails and
  WhatsApp/SMS reminders. Those pages show errors while the frontend points at NestJS.

## Quick check after switching

1. Sign in, and open a page with live data (Predict, Leaderboard).
2. Open the browser's dev tools, Network tab:
   - the request to `/api/public/realtime` answers 404 (.NET) or 200 with `socketio` (NestJS);
   - filter by "WS": a connection to `/api/hubs/chat` (SignalR, .NET) or `/api/hubs/socket`
     (Socket.IO, NestJS).
3. Send yourself a chat message from another account: it should appear without reloading.

If chat shows "Reconnecting…" and never connects, check that `/api` really reaches the backend
you meant: the answer to `/api/public/realtime` says which one it is.
