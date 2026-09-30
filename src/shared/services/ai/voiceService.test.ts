import { describe, it, expect } from "vitest";
import { getVoiceConfig, getVoiceCapabilities, isBrowserVoiceSupported, speakWithBrowser } from "../voiceService";
import type { VoiceConfig } from "../voiceService";

describe("voice service", () => {
  it("getVoiceConfig returns default config", async () => {
    const config = await getVoiceConfig();
    expect(config).toBeDefined();
    expect(config.provider).toBeDefined();
    expect(config.baseUrl).toBeDefined();
    expect(config.ttsVoice).toBeDefined();
    expect(config.sttModel).toBeDefined();
  });

  it("getVoiceCapabilities returns correct capabilities for browser", () => {
    const config: VoiceConfig = {
      provider: "browser",
      baseUrl: "",
      apiKey: "",
      ttsVoice: "alloy",
      sttModel: "whisper-1",
      ttsEnabled: true,
      sttEnabled: false,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(false);
  });

  it("getVoiceCapabilities returns correct capabilities for openai", () => {
    const config: VoiceConfig = {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      ttsVoice: "alloy",
      sttModel: "whisper-1",
      ttsEnabled: true,
      sttEnabled: true,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
  });

  it("getVoiceCapabilities returns correct capabilities for agent-core", () => {
    const config: VoiceConfig = {
      provider: "agent-core",
      baseUrl: "http://localhost:8000",
      apiKey: "",
      ttsVoice: "alloy",
      sttModel: "whisper-1",
      ttsEnabled: true,
      sttEnabled: true,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
  });

  it("isBrowserVoiceSupported returns boolean", () => {
    const result = isBrowserVoiceSupported();
    expect(typeof result).toBe("boolean");
  });
});
