import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplatePicker } from "./TemplatePicker";
import type { DbTemplate } from "@features/mail/db/templates";

vi.mock("@shared/components/ui/Modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal">{children}</div>,
}));

vi.mock("@features/mail/components/templates/TemplateGallery", () => ({
  TemplateGallery: ({ onSelect, isOpen }: { onSelect?: (t: Record<string, unknown>) => void; isOpen?: boolean }) =>
    isOpen === false ? null : (
      <div data-testid="template-gallery">
        <button
          data-testid="select-template-btn"
          onClick={() => onSelect?.({ id: "t1", name: "Welcome Email", body_html: "<p>Welcome!</p>", subject: "Welcome!", template_type: "email", origin: "user_created" })}
        >
          Select Welcome
        </button>
      </div>
    ),
}));

const accountState = { activeAccountId: "acc-1" };
vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      return selector ? selector(accountState) : accountState;
    },
    { getState: () => accountState },
  ),
}));

const composerState = { mode: "new", subject: "", setSubject: vi.fn(), getState: () => composerState };
vi.mock("@features/mail/stores/composerStore", () => ({
  useComposerStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      return selector ? selector(composerState) : composerState;
    },
    { getState: () => composerState },
  ),
}));

vi.mock("@features/mail/db/templates", () => ({
  getTemplatesForAccount: vi.fn(() => Promise.resolve([])),
  getFavorites: vi.fn(() => Promise.resolve([])),
  getMostUsed: vi.fn(() => Promise.resolve([])),
  getCategories: vi.fn(() => Promise.resolve([])),
  upsertCategory: vi.fn(),
  incrementTemplateUsage: vi.fn(),
  getTemplatesByType: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "composer.templates": "Templates",
        "composer.openTemplatePicker": "Open template picker",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("TemplatePicker", () => {
  it("renders TemplateGallery inside modal when open", () => {
    render(<TemplatePicker editor={null} isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByTestId("template-gallery")).toBeTruthy();
  });

  it("does not render gallery when closed", () => {
    render(<TemplatePicker editor={null} isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByTestId("template-gallery")).toBeNull();
  });

  it("fires onSelect when template is chosen in gallery", async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker editor={null} isOpen={true} onClose={vi.fn()} onSelect={onSelect} />);
    const selectBtn = await screen.findByTestId("select-template-btn");
    fireEvent.click(selectBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("renders with editor null without crashing", () => {
    render(<TemplatePicker editor={null} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("template-gallery")).toBeTruthy();
  });
});

