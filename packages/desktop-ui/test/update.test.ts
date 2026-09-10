import { describe, it, expect, beforeEach } from "vitest";
import { useUpdateStore, compareSemVer } from "../src/store/update-store.js";

describe("Update System - SemVer Comparison", () => {
  it("correctly compares basic semantic versions", () => {
    expect(compareSemVer("0.2.0", "0.1.0")).toBe(1);
    expect(compareSemVer("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemVer("0.1.0", "0.1.0")).toBe(0);
  });

  it("handles 'v' prefixes transparently", () => {
    expect(compareSemVer("v0.2.0", "0.1.0")).toBe(1);
    expect(compareSemVer("0.1.0", "v0.1.0")).toBe(0);
    expect(compareSemVer("v1.0.0", "v0.9.9")).toBe(1);
  });

  it("handles multi-digit version numbers accurately", () => {
    expect(compareSemVer("0.10.0", "0.9.0")).toBe(1);
    expect(compareSemVer("0.1.15", "0.1.9")).toBe(1);
    expect(compareSemVer("1.0.0", "0.99.99")).toBe(1);
  });
});

describe("Update System - Store State Machine", () => {
  beforeEach(() => {
    useUpdateStore.setState({
      status: "idle",
      currentVersion: "0.1.0",
      availableVersion: null,
      releaseNotes: null,
      releaseDate: null,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: null,
      lastCheckedAt: null,
      isModalOpen: false,
      dismissedVersion: null,
      isManualCheck: false,
    });
  });

  it("starts in idle state with correct current version", () => {
    const state = useUpdateStore.getState();
    expect(state.status).toBe("idle");
    expect(state.currentVersion).toBe("0.1.0");
    expect(state.isModalOpen).toBe(false);
  });

  it("manages modal open and close states", () => {
    const { openModal, closeModal } = useUpdateStore.getState();
    openModal();
    expect(useUpdateStore.getState().isModalOpen).toBe(true);

    closeModal();
    expect(useUpdateStore.getState().isModalOpen).toBe(false);
  });

  it("stores dismissed version and closes modal when dismissUpdate is called", () => {
    useUpdateStore.setState({
      status: "available",
      availableVersion: "0.2.0",
      isModalOpen: true,
    });

    useUpdateStore.getState().dismissUpdate();
    const state = useUpdateStore.getState();
    expect(state.dismissedVersion).toBe("0.2.0");
    expect(state.isModalOpen).toBe(false);
  });

  it("resets status and error via resetStatus", () => {
    useUpdateStore.setState({
      status: "error",
      error: "Network failure",
    });

    useUpdateStore.getState().resetStatus();
    const state = useUpdateStore.getState();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
  });
});
