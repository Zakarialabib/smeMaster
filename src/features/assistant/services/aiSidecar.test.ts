import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAiSidecarStore } from "@features/assistant/stores/aiSidecarStore";
import { useRagStore } from "@features/assistant/stores/ragStore";
import { activateAiSidecar, ensureAiSidecar, isAiSidecarActive } from "@features/assistant/services/aiSidecar";
import { aiDownloadModel, aiLoadEmbeddingModel } from "@shared/services/db/invoke/rag";

// Mock the external dependencies
vi.mock("@shared/services/db/invoke/rag", () => ({
  aiDownloadModel: vi.fn(),
  aiLoadEmbeddingModel: vi.fn(),
}));

vi.mock("@features/assistant/stores/ragStore");
vi.mock("@features/assistant/stores/aiSidecarStore");

describe("aiSidecar service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to initial state
    useAiSidecarStore.setState({
      active: false,
      modelPath: null,
      status: "idle",
      error: null,
    });
    useRagStore.setState({
      modelPath: null,
      tokenizerPath: null,
      modelStatus: "idle",
    });
  });

  describe("lazy loading behavior", () => {
    it("does not initialize engine on import", () => {
      // Verify that LocalEngine is not constructed during import
      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });

    it("engine is created on first activation", async () => {
      // Mock successful model download and load
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      // Activate the sidecar
      const result = await activateAiSidecar();

      // Verify engine initialization
      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiLoadEmbeddingModel).toHaveBeenCalledWith(mockModelPath, mockTokenizerPath);
      expect(result).toBe(mockModelPath);
    });
  });

  describe("activation with existing model", () => {
    it("activates successfully when model already exists", async () => {
      // Setup existing model paths
      useRagStore.setState({
        modelPath: "/existing/model.safetensors",
        tokenizerPath: "/existing/tokenizer.json",
        modelStatus: "loaded",
      });
      useAiSidecarStore.setState({
        active: true,
        modelPath: "/existing/model.safetensors",
        status: "ready",
      });

      const result = await activateAiSidecar();

      // Should not download anything
      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
      expect(result).toBe("/existing/model.safetensors");
    });
  });

  describe("model download and load flow", () => {
    it("downloads model when not present", async () => {
      const mockModelPath = "/downloaded/model.safetensors";
      const mockTokenizerPath = "/downloaded/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result = await activateAiSidecar();

      // Verify download flow
      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiDownloadModel).toHaveBeenCalledWith(
        "BAAI/bge-small-en-v1.5",
        "model.safetensors"
      );
      expect(aiDownloadModel).toHaveBeenCalledWith(
        "BAAI/bge-small-en-v1.5",
        "tokenizer.json"
      );
      expect(aiLoadEmbeddingModel).toHaveBeenCalledWith(mockModelPath, mockTokenizerPath);
    });

    it("handles download errors gracefully", async () => {
      const error = new Error("Download failed");
      (aiDownloadModel as vi.Mock).mockRejectedValue(error);

      await expect(activateAiSidecar()).rejects.toThrow(error);
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("handles model load errors", async () => {
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      const loadError = new Error("Load failed");
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockRejectedValue(loadError);

      await expect(activateAiSidecar()).rejects.toThrow(loadError);
      expect(useAiSidecarStore.getState().status).toBe("error");
      expect(useAiSidecarStore.getState().error).toContain("Load failed");
    });

    it("handles activation errors gracefully", async () => {
      const error = new Error("Activation failed");
      (aiDownloadModel as vi.Mock).mockRejectedValue(error);

      await expect(activateAiSidecar()).rejects.toThrow(error);
      expect(useAiSidecarStore.getState().status).toBe("error");
    });
  });

  describe("state management", () => {
    it("updates store state correctly", async () => {
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      await activateAiSidecar();

      // Verify store state updates
      expect(useAiSidecarStore.getState().active).toBe(true);
      expect(useAiSidecarStore.getState().modelPath).toBe(mockModelPath);
      expect(useAiSidecarStore.getState().status).toBe("ready");
      expect(useAiSidecarStore.getState().error).toBeNull();
    });

    it("maintains consistent state across multiple calls", async () => {
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      // First activation
      const result1 = await activateAiSidecar();
      const stateAfterFirst = useAiSidecarStore.getState();

      // Second activation (should return existing model)
      const result2 = await activateAiSidecar();
      const stateAfterSecond = useAiSidecarStore.getState();

      // State should be consistent
      expect(stateAfterFirst).toEqual(stateAfterSecond);
      expect(result1).toBe(result2);
    });
  });

  describe("ensureAiSidecar function", () => {
    it("returns existing model path when active", async () => {
      useAiSidecarStore.setState({
        active: true,
        modelPath: "/existing/model.safetensors",
        status: "ready",
      });

      const result = await ensureAiSidecar();
      expect(result).toBe("/existing/model.safetensors");
      expect(aiDownloadModel).not.toHaveBeenCalled();
      expect(aiLoadEmbeddingModel).not.toHaveBeenCalled();
    });

    it("activates sidecar when not ready", async () => {
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result = await ensureAiSidecar();

      expect(result).toBe(mockModelPath);
      expect(useAiSidecarStore.getState().active).toBe(true);
    });
  });

  describe("isAiSidecarActive function", () => {
    it("returns true when sidecar is active and ready", () => {
      useAiSidecarStore.setState({
        active: true,
        modelPath: "/model.safetensors",
        status: "ready",
      });

      expect(isAiSidecarActive()).toBe(true);
    });

    it("returns false when sidecar is not active", () => {
      useAiSidecarStore.setState({
        active: false,
        modelPath: null,
        status: "idle",
      });

      expect(isAiSidecarActive()).toBe(false);
    });

    it("returns false when sidecar is loading", () => {
      useAiSidecarStore.setState({
        active: true,
        modelPath: null,
        status: "loading",
      });

      expect(isAiSidecarActive()).toBe(false);
    });

    it("returns false when sidecar has error", () => {
      useAiSidecarStore.setState({
        active: true,
        modelPath: null,
        status: "error",
      });

      expect(isAiSidecarActive()).toBe(false);
    });
  });

  describe("idempotency", () => {
    it("multiple calls with same parameters return same result", async () => {
      const mockModelPath = "/fake/path/model.safetensors";
      const mockTokenizerPath = "/fake/path/tokenizer.json";
      
      (aiDownloadModel as vi.Mock)
        .mockResolvedValueOnce(mockModelPath)
        .mockResolvedValueOnce(mockTokenizerPath);
      (aiLoadEmbeddingModel as vi.Mock).mockResolvedValue(undefined);

      const result1 = await activateAiSidecar();
      const result2 = await activateAiSidecar();

      expect(result1).toBe(result2);
      expect(aiDownloadModel).toHaveBeenCalledTimes(2);
      expect(aiLoadEmbeddingModel).toHaveBeenCalledTimes(1);
    });
  });
});
