import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../eventBus';

describe('eventBus (smeMaster in-process pub/sub + replay)', () => {
  beforeEach(() => {
    // Reset singleton state between tests (clears handlers + replay buffer).
    eventBus.destroy();
  });

  it('delivers a payload to a registered handler', () => {
    const cb = vi.fn();
    eventBus.on('composer:open', cb);
    eventBus.emit('composer:open', { kind: 'composer:open', mode: 'reply' });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(
      { kind: 'composer:open', mode: 'reply' },
      'composer:open',
    );
  });

  it('stops delivery after unsubscribe', () => {
    const cb = vi.fn();
    const off = eventBus.on('composer:open', cb);
    off();
    eventBus.emit('composer:open', { kind: 'composer:open', mode: 'x' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('invokes multiple handlers for the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    eventBus.on('sync:complete', a);
    eventBus.on('sync:complete', b);
    eventBus.emit('sync:complete', { kind: 'sync:complete', new_count: 3 });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('does not cross-fire between different events', () => {
    const a = vi.fn();
    const b = vi.fn();
    eventBus.on('sync:started', a);
    eventBus.on('sync:complete', b);
    eventBus.emit('sync:started', { kind: 'sync:started' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
  });

  it('stores the last event in the replay buffer (getLastEvent)', () => {
    const payload = { kind: 'share:received', uri: 'content://x', text: 'hi' };
    eventBus.emit('share:received', payload);
    expect(eventBus.getLastEvent('share:received')).toEqual(payload);
  });

  it('lets a late subscriber catch up via getLastEvent', () => {
    const payload = { kind: 'notification:received', title: 't', body: 'b' };
    eventBus.emit('notification:received', payload);

    // Late subscriber registers after the event fired.
    const cb = vi.fn();
    eventBus.on('notification:received', cb);
    expect(cb).not.toHaveBeenCalled();

    // It can catch up via the replay buffer.
    expect(eventBus.getLastEvent('notification:received')).toEqual(payload);
  });

  it('replay buffer keeps only the most recent payload per kind', () => {
    eventBus.emit('sync:complete', { kind: 'sync:complete', new_count: 1 });
    eventBus.emit('sync:complete', { kind: 'sync:complete', new_count: 2 });
    expect(eventBus.getLastEvent('sync:complete')).toEqual({
      kind: 'sync:complete',
      new_count: 2,
    });
  });
});
