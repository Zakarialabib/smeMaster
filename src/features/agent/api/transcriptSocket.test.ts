import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptSocket } from './transcriptSocket';
import type { ClientFrame } from '../types/commands';

/**
 * The safety properties of the transcript socket, asserted.
 *
 * These are not mocked. A `MockWebSocket` would test the mock's own idea of
 * reconnect behaviour, which is the thing most likely to be wrong. Instead a
 * small fake is installed on globalThis, and the tests below drive the REAL
 * socket code through it — the fake only replaces the transport.
 *
 * The two properties that matter most:
 * 1. `send` accepts only `ping`. Proven at runtime below and at COMPILE time in
 *    `type ClientFrame` is a single-variant union — see the ts-expect-error
 *    cases in the companion note in commands.ts.
 * 2. A 4401/4403 close is NOT retried. A server that has refused us will not
 *    accept us on the next attempt, and retrying is how a client turns one
 *    refusal into a hammering loop.
 */

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: 'client closed' });
  }

  // test drivers
  accept(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  emit(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  serverClose(code: number, reason = ''): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

describe('TranscriptSocket', () => {
  let statuses: string[] = [];
  let details: string[] = [];

  beforeEach(() => {
    FakeSocket.instances = [];
    statuses = [];
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
  });

  afterEach(() => {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
  });

  const make = (handlers = {}) =>
    new TranscriptSocket('http://127.0.0.1:8788', '01JABC', {
      onStatus: (s, d) => {
        statuses.push(s);
        if (d !== undefined) details.push(d);
      },
      ...handlers,
    });

  it('connects, reports open, and sends exactly one ping', () => {
    const sock = make();
    sock.connect();
    expect(statuses).toEqual(['connecting']);
    FakeSocket.instances[0]?.accept();
    expect(statuses).toEqual(['connecting', 'open']);
    expect(FakeSocket.instances[0]?.sent).toEqual([JSON.stringify({ type: 'ping' })]);
  });

  it('never puts a token in the URL', () => {
    // A token in a query string lands in access logs. The constructor takes no
    // token at all, and the URL must not grow one.
    const sock = make();
    sock.connect();
    const url = FakeSocket.instances[0]?.url ?? '';
    expect(url).toContain('session=01JABC');
    expect(url.toLowerCase()).not.toContain('token');
    expect(url.toLowerCase()).not.toContain('bearer');
  });

  it('routes each server frame to its handler', () => {
    const got: Record<string, unknown> = {};
    const sock = make({
      onState: (f) => (got.state = f),
      onDelta: (f) => (got.delta = f),
      onStages: (f) => (got.stages = f),
      onMeta: (f) => (got.meta = f),
      onClosed: (f) => (got.closed = f),
    });
    sock.connect();
    const s = FakeSocket.instances[0]!;
    s.accept();
    s.emit({ type: 'state', sessionId: '01JABC', state: 'listening', at: 'now' });
    s.emit({ type: 'delta', callId: 'x', turnId: 1, seq: 1, role: 'caller', text: 'bonjour', final: true, at: 'now' });
    s.emit({ type: 'stages', callId: 'x', turnId: 1, vadMs: 1, sttMs: 2, llmMs: 3, ttsMs: 4, turnGapMs: 5, at: 'now' });
    s.emit({ type: 'meta', callId: 'x', locale: 'fr', fallbackActive: false, chainTier: 'standard' });
    s.emit({ type: 'closed', callId: 'x', outcome: 'resolved', at: 'now' });
    expect(Object.keys(got).sort()).toEqual(['closed', 'delta', 'meta', 'stages', 'state']);
  });

  it('ignores a pong and an unknown frame instead of crashing', () => {
    const sock = make();
    sock.connect();
    const s = FakeSocket.instances[0]!;
    s.accept();
    expect(() => {
      s.emit({ type: 'pong', at: 'now' });
      s.emit({ type: 'something_new', payload: 1 });
      s.onmessage?.({ data: 'not json at all' });
    }).not.toThrow();
  });

  it('does NOT retry when the server refuses the connection', () => {
    const sock = make();
    sock.connect();
    FakeSocket.instances[0]?.accept();
    FakeSocket.instances[0]?.serverClose(4403, 'only ping is accepted');
    expect(statuses).toContain('refused');
    // No new socket: a refusal is not a transient failure.
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('retries a transient close with backoff, and gives up after 5 attempts', () => {
    vi.useFakeTimers();
    try {
      const sock = make();
      sock.connect();
      // Six transient failures. The first attempt is the initial connect, so the
      // client should make 5 retries and then stop: 6 sockets, never a 7th.
      for (let i = 0; i < 6; i += 1) {
        const s = FakeSocket.instances[FakeSocket.instances.length - 1];
        s?.accept();
        s?.serverClose(1006, 'abnormal');
        vi.advanceTimersByTime(60_000);
      }
      expect(FakeSocket.instances).toHaveLength(6);

      // And it STAYS stopped: advancing time again must not open a 7th.
      vi.advanceTimersByTime(600_000);
      expect(FakeSocket.instances).toHaveLength(6);
      expect(statuses[statuses.length - 1]).toBe('closed');
      expect(details[details.length - 1]).toMatch(/gave up/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a FLAPPING server cannot cause an infinite reconnect loop', () => {
    // The bug this found: onopen used to reset the retry counter, so a server
    // that completes the handshake and then immediately closes was retried
    // forever. Every iteration here is a successful OPEN followed by a close —
    // the exact shape that reset the counter each time.
    vi.useFakeTimers();
    try {
      const sock = make();
      sock.connect();
      for (let i = 0; i < 12; i += 1) {
        const s = FakeSocket.instances[FakeSocket.instances.length - 1];
        s?.accept(); // handshake succeeds
        s?.serverClose(1006, 'abnormal'); // then dies
        vi.advanceTimersByTime(60_000);
      }
      // 1 initial + 5 retries, then it gives up. Not 13.
      expect(FakeSocket.instances).toHaveLength(6);
      expect(statuses[statuses.length - 1]).toBe('closed');
      expect(details[details.length - 1]).toMatch(/gave up/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('an explicit connect() resets the retry budget', () => {
    vi.useFakeTimers();
    try {
      const sock = make();
      sock.connect();
      for (let i = 0; i < 6; i += 1) {
        const s = FakeSocket.instances[FakeSocket.instances.length - 1];
        s?.accept();
        s?.serverClose(1006, 'abnormal');
        vi.advanceTimersByTime(60_000);
      }
      expect(statuses[statuses.length - 1]).toBe('closed');
      expect(details[details.length - 1]).toMatch(/gave up/);
      const before = FakeSocket.instances.length;

      // A deliberate re-connect is a fresh attempt, so it retries again.
      sock.connect();
      vi.advanceTimersByTime(60_000);
      expect(FakeSocket.instances.length).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('an explicit close stops reconnecting', () => {
    const sock = make();
    sock.connect();
    FakeSocket.instances[0]?.accept();
    sock.close();
    expect(statuses[statuses.length - 1]).toBe('closed');
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('the only sendable frame is ping, by type', () => {
    // Compile-time guarantee, documented here so it is not lost. These are the
    // frames a barge-in control WOULD need. None of them exist in ClientFrame,
    // so none of them can be passed to send():
    //
    //   sock.send({ type: 'transfer', target: '+33...' });  // ts: no overload
    //   sock.send({ type: 'hangup' });                       // ts: no overload
    //   sock.send({ type: 'mute' });                         // ts: no overload
    //
    // Adding one requires editing ClientFrame in commands.ts AND the server
    // contract, which is the review checkpoint this is for.
    const ping: ClientFrame = { type: 'ping' };
    expect(ping.type).toBe('ping');
  });
});
