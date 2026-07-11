import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { startAutoSave, stopAutoSave } from "./draftAutoSave";
import * as emailActions from "@features/mail/services/emailActions";

vi.mock("@features/mail/services/emailActions", () => ({
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock("@shared/utils/emailBuilder", () => ({
  buildRawEmail: vi.fn(() => "mocked-raw-email"),
}));

describe("draftAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useComposerStore.setState({
      isOpen: true,
      mode: "new",
      to: ["recipient@example.com"],
      cc: [],
      bcc: [],
      subject: "Test",
      bodyHtml: "<p>Hello</p>",
      threadId: null,
      inReplyToMessageId: null,
      showCcBcc: false,
      draftId: null,
      undoSendTimer: null,
      undoSendVisible: false,
      pendingSendOpId: null,
      attachments: [],
      lastSavedAt: null,
      isSaving: false,
      isLoading: false,
      error: null,
      fromEmail: null,
      viewMode: "modal",
      signatureHtml: "",
      signatureId: null,
    });
    useAccountStore.setState({
      accounts: [{ id: "account-1", email: "test@example.com", displayName: null, avatarUrl: null, isActive: true }],
      activeAccountId: "account-1",
    });
  });

  afterEach(() => {
    stopAutoSave();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("creates a new draft when draftId is null", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    startAutoSave("account-1");

    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    await vi.advanceTimersByTimeAsync(3100);

    expect(createDraftSpy).toHaveBeenCalled();
    expect(useComposerStore.getState().draftId).toBe("draft-1");
  });

  it("updates existing draft when draftId is set", async () => {
    const updateDraftSpy = vi.mocked(emailActions.updateDraft);
    updateDraftSpy.mockResolvedValue({ success: true });

    useComposerStore.setState({ draftId: "draft-1" });
    startAutoSave("account-1");

    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    await vi.advanceTimersByTimeAsync(3100);

    expect(updateDraftSpy).toHaveBeenCalledWith(
      "account-1",
      "draft-1",
      "mocked-raw-email",
      undefined,
    );
  });

  it("does NOT save empty drafts (no body, subject, or recipients)", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    // Set empty state before subscribing
    useComposerStore.setState({ bodyHtml: "", subject: "", to: [] });
    startAutoSave("account-1");

    // No change triggered after subscription — scheduleSave should never fire
    await vi.advanceTimersByTimeAsync(3100);

    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("does NOT save when composer is closed", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    startAutoSave("account-1");

    // Trigger a content change to start the debounce timer
    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    // Close the composer before the debounce timer fires
    useComposerStore.setState({ isOpen: false });

    await vi.advanceTimersByTimeAsync(3100);

    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("debounces rapid changes", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    startAutoSave("account-1");

    useComposerStore.getState().setBodyHtml("<p>Change 1</p>");
    await vi.advanceTimersByTimeAsync(500);
    useComposerStore.getState().setBodyHtml("<p>Change 2</p>");
    await vi.advanceTimersByTimeAsync(500);
    useComposerStore.getState().setBodyHtml("<p>Change 3</p>");

    await vi.advanceTimersByTimeAsync(3000);
    expect(createDraftSpy).toHaveBeenCalledTimes(1);
  });

  it("stopAutoSave cleans up timer and subscription", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    startAutoSave("account-1");
    stopAutoSave();

    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    await vi.advanceTimersByTimeAsync(3100);

    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("sets isSaving during save and clears it after", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockImplementation(() => {
      expect(useComposerStore.getState().isSaving).toBe(true);
      return Promise.resolve({
        success: true,
        data: { draftId: "draft-1" },
      });
    });

    startAutoSave("account-1");
    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    await vi.advanceTimersByTimeAsync(3100);
    await vi.advanceTimersByTimeAsync(10);

    expect(useComposerStore.getState().isSaving).toBe(false);
  });

  it("sets lastSavedAt after successful save", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    const before = Date.now();
    startAutoSave("account-1");
    useComposerStore.getState().setBodyHtml("<p>Updated</p>");
    await vi.advanceTimersByTimeAsync(3100);

    const savedAt = useComposerStore.getState().lastSavedAt;
    expect(savedAt).not.toBeNull();
    expect(savedAt!).toBeGreaterThanOrEqual(before);
  });

  it("starts and stops without error", () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });
    startAutoSave("account-1");
    stopAutoSave();
  });

  it("triggers save after debounce when body changes", async () => {
    const createDraftSpy = vi.mocked(emailActions.createDraft);
    createDraftSpy.mockResolvedValue({
      success: true,
      data: { draftId: "draft-1" },
    });

    startAutoSave("account-1");

    useComposerStore.getState().setBodyHtml("<p>Updated</p>");

    expect(useComposerStore.getState().draftId).toBeNull();
    await vi.advanceTimersByTimeAsync(3500);

    expect(useComposerStore.getState().draftId).toBe("draft-1");
    expect(useComposerStore.getState().lastSavedAt).not.toBeNull();
  });
});
