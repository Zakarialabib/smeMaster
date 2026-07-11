import { describe, it, expect } from "vitest";
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  getThemeById,
} from "./themes";

describe("themes", () => {
  it("all themes have unique IDs", () => {
    const ids = COLOR_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all themes have complete light and dark color sets", () => {
    const requiredKeys = ["accent", "accentHover", "accentLight", "bgSelected", "sidebarActive"];
    for (const theme of COLOR_THEMES) {
      for (const key of requiredKeys) {
        expect(theme.light).toHaveProperty(key);
        expect(theme.light[key as keyof typeof theme.light]).toBeTruthy();
        expect(theme.dark).toHaveProperty(key);
        expect(theme.dark[key as keyof typeof theme.dark]).toBeTruthy();
      }
    }
  });

  it("DEFAULT_COLOR_THEME is frost", () => {
    expect(DEFAULT_COLOR_THEME).toBe("frost");
  });

  it("getThemeById returns correct theme", () => {
    const rose = getThemeById("rose");
    expect(rose.id).toBe("rose");
    expect(rose.name).toBe("Rose");

    const emerald = getThemeById("emerald");
    expect(emerald.id).toBe("emerald");

    const frost = getThemeById("frost");
    expect(frost.id).toBe("frost");
    expect(frost.name).toBe("Frosted Glass");
    expect(frost.light.accent).toBe("#0B57D0");
  });

  it("getThemeById falls back to frost for unknown ID", () => {
    const fallback = getThemeById("nonexistent");
    expect(fallback.id).toBe("frost");
  });
});
