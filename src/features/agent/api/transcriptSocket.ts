import type { ClientFrame, StateFrame, TranscriptDelta, StagesFrame, MetaFrame, ClosedFrame } from '../types/commands';

/**
 * The transcript/live-call WebSocket.
 *
 * This is the most safety-sensitive file in the console, so the constraints are
 * stated as types rather than as comments:
 *
 * 1. **It can only send `ping`.** `send` takes a `ClientFrame`, and
 *    `ClientFrame` has exactly one variant — `ping`. There is no code path from
 *    a UI event to "transfer this call" or "hang up", because the type that would
 *    carry it does not exist. A barge-in control cannot be added by accident; it
 *    needs a contract change on both sides and a review of the wire type.
 * 2. **The socket is read-only from the UI.** `on*` callbacks deliver frames;
 *    nothing returns a handle that can act on a call.
 * 3. **Reconnect is bounded and visible.** `onStatus` reports `reconnecting`, so
 *    the console can show "reconnecting" instead of silently showing stale
 *    transcript data as if it were live.
 *
 * The server closes with 4403 on any non-ping frame. This client therefore never
 * sends one, and treats a 4403 as a hard stop rather than reconnecting — a
 * server that refuses us is not going to accept us on retry.
 */

export type WsStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'refused';

export interface TranscriptHandlers {
  onState?: (f: StateFrame) => void;
  onDelta?: (f: TranscriptDelta) => void;
  onStages?: (f: StagesFrame) => void;
  onMeta?: (f: MetaFrame) => void;
  onClosed?: (f: ClosedFrame) => void;
  onStatus?: (s: WsStatus, detail?: string) => void;
}

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000, 10_000] as const;
const MAX_ATTEMPTS = RECONNECT_DELAYS_MS.length;

/**
 * Build the WS URL. Deliberately takes NO token.
 *
 * The obvious signature is `(base, sessionId, token)`, and an earlier draft had
 * exactly that with a `void token` inside — a parameter that exists, is passed
 * a secret, and is then discarded. It would have looked like auth was handled
 * and was not.
 *
 * The real constraint: a token must travel in a HEADER, never a query string,
 * because query strings land in access logs and a token in an access log is a
 * leaked token. A browser `WebSocket` cannot set headers. That is not a gap to
 * paper over with a parameter, it is the reason the DESKTOP path goes through
 * Rust (`src-tauri/src/agent/client.rs`), which can set headers. This class is
 * the dev/browser path and is loopback-only until real auth lands.
 */
function wsUrlFor(base: string, sessionId: string): string {
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/transcript';
  url.searchParams.set('session', sessionId);
  return url.toString();
}

export class TranscriptSocket {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private closedByUs = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param baseUrl   agent-core origin, e.g. http://127.0.0.1:8788
   * @param sessionId from POST /session
   *
   * There is NO token parameter. See `wsUrlFor` for why: a browser WebSocket
   * cannot send an auth header, and the tempting workaround — a token in the
   * query string — leaks it into access logs. Taking the token as an argument
   * here would imply the problem is solved; it is not, and the honest answer is
   * that this path is loopback-only and the desktop goes through Rust.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly sessionId: string,
    private readonly handlers: TranscriptHandlers = {},
  ) {}

  connect(): void {
    this.closedByUs = false;
    // A caller-initiated connect is a fresh attempt, so the retry budget resets
    // HERE and only here.
    this.attempt = 0;
    this.open();
  }

  private open(): void {
    this.handlers.onStatus?.(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrlFor(this.baseUrl, this.sessionId));
    } catch (e) {
      this.handlers.onStatus?.('refused', (e as Error).message);
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      // DELIBERATELY does not reset `this.attempt`.
      //
      // It used to, and that made the retry cap meaningless: a server that
      // accepts the handshake and then immediately closes (a flapping proxy, a
      // crash-looping agent-core) reset the counter on every open, so it was
      // retried indefinitely. The cap only bounds CONSECUTIVE FAILURES BEFORE A
      // SUCCESSFUL OPEN, which a flapping server never has.
      //
      // The counter is reset in `connect()` — a fresh, deliberate attempt by
      // the caller — and nowhere else.
      this.handlers.onStatus?.('open');
      this.sendPing();
    };

    socket.onmessage = (ev: MessageEvent<string>) => {
      let frame: { type?: string };
      try {
        frame = JSON.parse(ev.data) as { type?: string };
      } catch {
        return; // unparseable frame: ignore rather than crash the live view
      }
      // `pong` is the only thing we sent, so it is the only thing we expect back
      // unprompted; everything else is a server frame with a matching handler.
      if (frame.type === 'pong') return;
      this.dispatch(frame as unknown);
    };

    socket.onerror = () => {
      // onclose always follows; let it handle the retry so there is one place
      // that decides what happens after a failure.
    };

    socket.onclose = (ev: CloseEvent) => {
      this.socket = null;
      if (this.closedByUs) {
        this.handlers.onStatus?.('closed');
        return;
      }
      // 4401 = no/invalid token, 4403 = we sent something illegal. Neither gets
      // better by retrying, so a retry loop here would hammer the server.
      if (ev.code === 4401 || ev.code === 4403) {
        this.handlers.onStatus?.('refused', `server closed ${ev.code}: ${ev.reason}`);
        return;
      }
      if (this.attempt >= MAX_ATTEMPTS) {
        this.handlers.onStatus?.('closed', 'gave up after 5 attempts');
        return;
      }
      const delay = RECONNECT_DELAYS_MS[this.attempt] ?? 10_000;
      this.attempt += 1;
      this.timer = setTimeout(() => this.open(), delay);
    };
  }

  private dispatch(frame: unknown): void {
    const f = frame as { type?: string };
    switch (f.type) {
      case 'state':
        this.handlers.onState?.(f as unknown as StateFrame);
        break;
      case 'delta':
        this.handlers.onDelta?.(f as unknown as TranscriptDelta);
        break;
      case 'stages':
        this.handlers.onStages?.(f as unknown as StagesFrame);
        break;
      case 'meta':
        this.handlers.onMeta?.(f as unknown as MetaFrame);
        break;
      case 'closed':
        this.handlers.onClosed?.(f as unknown as ClosedFrame);
        break;
      default:
        break; // unknown frame types are ignored, not fatal
    }
  }

  /**
   * The ONLY thing this client can send.
   *
   * The parameter type is `ClientFrame`, whose sole variant is `ping`. If a
   * barge-in or transfer control is ever needed, it has to be added to the
   * contract in `commands.ts` AND to the server, and this signature will refuse
   * to compile until someone does both on purpose.
   */
  send(frame: ClientFrame): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    }
  }

  private sendPing(): void {
    this.send({ type: 'ping' });
  }

  close(): void {
    this.closedByUs = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}
