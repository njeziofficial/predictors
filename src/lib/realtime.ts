import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { API_BASE_URL, CHAT_HUB_URL } from "@/lib/api";

// The one live connection every signed-in tab holds: chat messages, typing, presence and the
// server's DataChanged notices. Two transports carry the same events with the same names:
//   - SignalR, for the .NET backend;
//   - Socket.IO, for the NestJS backend.
// Which one is asked of the backend before connecting (detectTransport), so one build works
// against either: pointing the app at a backend is all it takes. ChatContext only sees this
// interface, so it works the same against both.

export type RealtimeStatus = "offline" | "connecting" | "connected" | "reconnecting";

export interface RealtimeConnection {
  on(event: string, handler: (...args: never[]) => void): void;
  /** Fire and forget; dropped while not connected. */
  send(method: string, ...args: unknown[]): void;
  isConnected(): boolean;
  start(): void;
  stop(): void;
}

export interface RealtimeOptions {
  /** A usable access token, refreshed first if it's about to expire. */
  getToken: () => Promise<string>;
  onStatus: (status: RealtimeStatus) => void;
  /** Connected: the first time (false), or again after a drop (true), when anything may have been missed. */
  onConnected: (reconnected: boolean) => void;
}

export type RealtimeTransport = "signalr" | "socketio";

// Reconnect quickly at first, then keep trying every 30s for as long as the tab is open.
const RETRY_DELAYS = [0, 2000, 5000, 10000];
const retryDelay = (attempt: number) => RETRY_DELAYS[attempt] ?? 30_000;

// The NestJS backend answers here with its transport; the .NET backend has no such route.
export const REALTIME_INFO_PATH = "/api/public/realtime";

/**
 * Which live connection the backend speaks: "socketio" when it says so, "signalr" when it has no
 * such route (404, the .NET backend), or null when this answer can't tell (the backend is asleep
 * or waking, offline, or a proxy answered with a page of its own). Null is asked again later.
 */
export async function askTransport(fetchImpl: typeof fetch = fetch): Promise<RealtimeTransport | null> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE_URL}${REALTIME_INFO_PATH}`, { headers: { Accept: "application/json" } });
  } catch {
    return null;
  }
  if (res.status === 404) return "signalr";
  if (!res.ok) return null;
  try {
    const body = (await res.json()) as { transport?: unknown };
    return body.transport === "socketio" ? "socketio" : body.transport === "signalr" ? "signalr" : null;
  } catch {
    return null;
  }
}

// Known once per page load: the backend doesn't change under an open app (a deploy that moves it
// reloads the page, see lib/appVersion).
let detected: Promise<RealtimeTransport> | null = null;

/**
 * Asks the backend which transport it speaks, retrying while the answer can't tell, and remembers
 * it. Resolves only on a definite answer.
 */
export function detectTransport(signal: { stopped: boolean }, ask: () => Promise<RealtimeTransport | null> = () => askTransport()): Promise<RealtimeTransport> {
  if (detected) return detected;
  const attempt = async (n: number): Promise<RealtimeTransport> => {
    const answer = await ask();
    if (answer) return answer;
    if (signal.stopped) throw new Error("Stopped before the backend answered.");
    await new Promise((r) => setTimeout(r, retryDelay(n + 1)));
    return attempt(n + 1);
  };
  const run = attempt(0);
  detected = run;
  // A failed or abandoned detection is forgotten, so the next connection asks again.
  run.catch(() => {
    if (detected === run) detected = null;
  });
  return run;
}

/** Forgets the detected transport (tests). */
export const resetDetectedTransport = () => {
  detected = null;
};

/**
 * The live connection, over whichever transport the backend speaks. Handlers can be added before
 * start(); they're handed to the real connection once the transport is known.
 */
export function createRealtimeConnection(options: RealtimeOptions): RealtimeConnection {
  const handlers: [string, (...args: never[]) => void][] = [];
  const state = { stopped: false };
  let inner: RealtimeConnection | null = null;

  return {
    on: (event, handler) => {
      handlers.push([event, handler]);
      inner?.on(event, handler);
    },
    send: (method, ...args) => inner?.send(method, ...args),
    isConnected: () => inner?.isConnected() === true,
    start: () => {
      options.onStatus("connecting");
      detectTransport(state)
        .then((transport) => {
          if (state.stopped) return;
          inner = transport === "socketio" ? socketIoConnection(options) : signalRConnection(options);
          for (const [event, handler] of handlers) inner.on(event, handler);
          inner.start();
        })
        .catch(() => {
          // Stopped while still asking: nothing to start.
        });
    },
    stop: () => {
      state.stopped = true;
      inner?.stop();
    },
  };
}

function signalRConnection({ getToken, onStatus, onConnected }: RealtimeOptions): RealtimeConnection {
  const connection = new HubConnectionBuilder()
    .withUrl(CHAT_HUB_URL, {
      accessTokenFactory: getToken,
      // Auth is the bearer token, not cookies, so the hub needs no credentialed CORS.
      withCredentials: false,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => retryDelay(ctx.previousRetryCount) })
    .configureLogging(LogLevel.Warning)
    .build();

  connection.onreconnecting(() => onStatus("reconnecting"));
  connection.onreconnected(() => {
    onStatus("connected");
    onConnected(true);
  });
  connection.onclose(() => onStatus("offline"));

  let stopped = false;
  const start = async (attempt = 0) => {
    if (stopped) return;
    onStatus("connecting");
    try {
      await connection.start();
      if (stopped) return;
      onStatus("connected");
      onConnected(false);
    } catch {
      // withAutomaticReconnect only covers drops after a successful start.
      if (stopped) return;
      onStatus("reconnecting");
      setTimeout(() => start(attempt + 1), retryDelay(attempt + 1));
    }
  };

  return {
    on: (event, handler) => connection.on(event, handler as (...args: unknown[]) => void),
    send: (method, ...args) => {
      if (connection.state === HubConnectionState.Connected) connection.invoke(method, ...args).catch(() => {});
    },
    isConnected: () => connection.state === HubConnectionState.Connected,
    start: () => void start(),
    stop: () => {
      stopped = true;
      connection.stop().catch(() => {});
    },
  };
}

function socketIoConnection({ getToken, onStatus, onConnected }: RealtimeOptions): RealtimeConnection {
  // Loaded only in a Socket.IO build, so the SignalR build doesn't carry it.
  type Socket = import("socket.io-client").Socket;
  let socket: Socket | null = null;
  let stopped = false;
  let everConnected = false;
  const handlers: [string, (...args: never[]) => void][] = [];

  const start = async () => {
    onStatus("connecting");
    const { io } = await import("socket.io-client");
    if (stopped) return;
    socket = io(API_BASE_URL || undefined, {
      path: "/api/hubs/socket",
      // Asked for again on every (re)connection attempt, so it's always fresh.
      auth: (cb) => {
        getToken()
          .then((token) => cb({ token }))
          .catch(() => cb({}));
      },
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30_000,
    });
    for (const [event, handler] of handlers) socket.on(event, handler as (...args: unknown[]) => void);

    socket.on("connect", () => {
      onStatus("connected");
      onConnected(everConnected);
      everConnected = true;
    });
    socket.on("connect_error", () => onStatus("reconnecting"));
    socket.on("disconnect", (reason) => {
      // The server closed it (account disabled, or a token it wouldn't take): Socket.IO doesn't
      // retry those on its own.
      if (reason === "io server disconnect") onStatus("offline");
      else if (reason !== "io client disconnect") onStatus("reconnecting");
    });
    // The token was refused (it expired between fetching and connecting): try again with a new one.
    socket.on("Unauthorized", () => {
      setTimeout(() => {
        if (!stopped) socket?.connect();
      }, 5000);
    });
  };

  return {
    on: (event, handler) => {
      handlers.push([event, handler]);
      socket?.on(event, handler as (...args: unknown[]) => void);
    },
    send: (method, ...args) => {
      if (socket?.connected) socket.emit(method, ...args);
    },
    isConnected: () => socket?.connected === true,
    start: () => void start(),
    stop: () => {
      stopped = true;
      socket?.disconnect();
    },
  };
}
