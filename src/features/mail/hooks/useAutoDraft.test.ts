import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoDraft } from "./useAutoDraft";

vi.mock("@shared/services/ai/writingStyleService", () => ({
  isAutoDraftEnabled: vi.fn(),
  generateAutoDraft: vi.fn(),
  regenerateAutoDraft: vi.fn(),
}));

import {
  isAutoDraftEnabled,
  generateAutoDraft,
  regenerateAutoDraft,
} from "@shared/services/ai/writingStyleService";

const mockIsEnabled = vi.mocked(isAutoDraftEnabled);
const mockGenerate = vi.mocked(generateAutoDraft);
const mockRegenerate = vi.mocked(regenerateAutoDraft);

interface FakeEditor {
  isEmpty: boolean;
  commands: { setContent: (html: string) => void };
  handlers: Map<string, Set<() => void>>;
  on: (event: "update", cb: () => void) => void;
  off: (event: "update", cb: () => void) => void;
  emit: (event: "update") => void;
}

function makeEditor(isEmpty = true): FakeEditor {
  const setContent = vi.fn();
  const handlers = new Map<string, Set<() => void>>();
  return {
    isEmpty,
    commands: { setContent: setContent as unknown as (html: string) => void },
    handlers,
    on: (event, cb) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb);
    },
    off: (event, cb) => {
      handlers.get(event)?.delete(cb);
    },
    emit: (event) => {
      handlers.get(event)?.forEach((cb) => cb());
    },
  };
}

describe("useAutoDraft", () => {
  beforeEach(() => {
    mockIsEnabled.mockReset();
    mockGenerate.mockReset();
    mockRegenerate.mockReset();
  });

  it("is a no-op when editor is null", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockResolvedValue("<p>hi</p>");

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor: null,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("skips generation when isAutoDraftEnabled returns false", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(editor.commands.setContent).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it("generates a draft and inserts it when editor is empty", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockResolvedValue("<p>AI reply</p>");
    const editor = makeEditor(true);

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(mockGenerate).toHaveBeenCalledWith("t1", "a1", [], "reply");
    expect(editor.commands.setContent).toHaveBeenCalledWith("<p>AI reply</p>");
    expect(result.current.hasDraft).toBe(true);
  });

  it("does not insert the draft when editor already has content", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockResolvedValue("<p>AI reply</p>");
    const editor = makeEditor(false);

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(editor.commands.setContent).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it("calls regenerateAutoDraft when regenerate is invoked", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockRegenerate.mockResolvedValue("<p>Fresh draft</p>");
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    await act(async () => {
      await result.current.regenerate("replyAll");
    });

    expect(mockRegenerate).toHaveBeenCalledWith("t1", "a1", [], "replyAll");
    expect(editor.commands.setContent).toHaveBeenCalledWith("<p>Fresh draft</p>");
  });

  it("uses a custom acceptDraft predicate to gate insertion", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockResolvedValue("<p>AI reply</p>");
    const editor = makeEditor();
    const acceptDraft = vi.fn(() => true);

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
        acceptDraft,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(acceptDraft).toHaveBeenCalledWith("<p>AI reply</p>");
    expect(editor.commands.setContent).toHaveBeenCalledWith("<p>AI reply</p>");
  });

  it("respects acceptDraft returning false", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockResolvedValue("<p>AI reply</p>");
    const editor = makeEditor();
    const acceptDraft = vi.fn(() => false);

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
        acceptDraft,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(editor.commands.setContent).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it("aborts the in-flight draft when the user starts typing (editor update)", async () => {
    mockIsEnabled.mockResolvedValue(true);
    let resolveGenerate!: (v: string) => void;
    mockGenerate.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    // Kick off the load (it will be pending).
    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load("reply");
    });
    expect(result.current.loading).toBe(true);

    // Simulate the user typing → editor fires "update".
    act(() => {
      editor.emit("update");
    });

    // Now the generator resolves — the result must be ignored.
    await act(async () => {
      resolveGenerate("<p>stale</p>");
      await loadPromise;
    });

    expect(editor.commands.setContent).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it("clear() aborts in-flight draft, clears hasDraft, and empties the editor", async () => {
    mockIsEnabled.mockResolvedValue(true);
    let resolveGenerate!: (v: string) => void;
    mockGenerate.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load("reply");
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.hasDraft).toBe(false);
    expect(editor.commands.setContent).toHaveBeenCalledWith("");

    await act(async () => {
      resolveGenerate("<p>stale</p>");
      await loadPromise;
    });

    // setContent should only have been called with "" by clear()
    expect(editor.commands.setContent).toHaveBeenCalledTimes(1);
    expect(editor.commands.setContent).toHaveBeenCalledWith("");
  });

  it("sets loading=true during the call and false after", async () => {
    mockIsEnabled.mockResolvedValue(true);
    let resolveGenerate!: (v: string) => void;
    mockGenerate.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    let loadPromise!: Promise<void>;
    act(() => {
      loadPromise = result.current.load("reply");
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveGenerate("<p>x</p>");
      await loadPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("swallows generator errors and still ends in loading=false", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockGenerate.mockRejectedValue(new Error("AI down"));
    const editor = makeEditor();

    const { result } = renderHook(() =>
      useAutoDraft({
        threadId: "t1",
        accountId: "a1",
        messages: [],
        editor,
      }),
    );

    await act(async () => {
      await result.current.load("reply");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.hasDraft).toBe(false);
  });
});
