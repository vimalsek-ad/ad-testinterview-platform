/**
 * Proctoring SDK — orchestrates all monitoring layers.
 *
 * Usage:
 *   const sdk = new ProctoringSDK({ sessionId, level: "full", onFlag, onWarning });
 *   await sdk.start();
 *   // ... during assessment ...
 *   sdk.stop();
 */

import { BrowserMonitor } from "./BrowserMonitor";
import { FaceMonitor } from "./FaceMonitor";
import { AudioMonitor } from "./AudioMonitor";
import { ProctoringConfig, ProctoringFlag } from "./types";
import { api } from "../lib/api";

export class ProctoringSDK {
  private config: ProctoringConfig;
  private browserMonitor: BrowserMonitor;
  private faceMonitor: FaceMonitor | null = null;
  private audioMonitor: AudioMonitor | null = null;
  private flagBuffer: ProctoringFlag[] = [];
  private flushIntervalId: number | null = null;
  private totalFlags = 0;
  private warningThreshold = 5;

  constructor(config: ProctoringConfig) {
    this.config = config;

    // Browser monitor is always active (even in "basic" level)
    this.browserMonitor = new BrowserMonitor((flag) => this.handleFlag(flag));
  }

  async start(): Promise<HTMLVideoElement | null> {
    let videoElement: HTMLVideoElement | null = null;

    // Layer 1: Browser monitoring (always)
    this.browserMonitor.start();
    console.log("[Proctoring] ✅ Browser monitoring started (tab switch, paste, fullscreen)");

    if (this.config.level === "full") {
      // Fullscreen lockdown
      this.browserMonitor.startFullscreenLockdown();
    }

    if (this.config.level === "basic" || this.config.level === "full") {
      // Layer 2: Face + Gaze monitoring
      this.faceMonitor = new FaceMonitor(
        (flag) => this.handleFlag(flag),
        { checkIntervalMs: this.config.faceCheckIntervalMs || 3000 }
      );
      try {
        videoElement = await this.faceMonitor.start();
        console.log("[Proctoring] ✅ Face monitoring started");
      } catch (err) {
        console.warn("[Proctoring] ⚠️ Camera access denied — face monitoring disabled", err);
      }

      // Layer 3: Audio monitoring
      this.audioMonitor = new AudioMonitor(
        (flag) => this.handleFlag(flag),
        { speechThresholdMs: this.config.speechThresholdMs || 5000 }
      );
      try {
        await this.audioMonitor.start();
        console.log("[Proctoring] ✅ Audio monitoring started");
      } catch (err) {
        console.warn("[Proctoring] ⚠️ Microphone access denied — audio monitoring disabled", err);
      }
    }

    // Batch-send flags to backend every 3 seconds
    this.flushIntervalId = window.setInterval(() => this.flushFlags(), 3000);

    return videoElement;
  }

  captureIdentityPhoto(): string | null {
    return this.faceMonitor?.captureIdentityPhoto() || null;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.faceMonitor?.getVideoElement() || null;
  }

  getFlags(): ProctoringFlag[] {
    return [...this.flagBuffer];
  }

  getTotalFlagCount(): number {
    return this.totalFlags;
  }

  stop() {
    this.browserMonitor.stop();
    this.faceMonitor?.stop();
    this.audioMonitor?.stop();

    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }

    // Send remaining flags
    this.flushFlags();
  }

  private handleFlag(flag: ProctoringFlag) {
    this.flagBuffer.push(flag);
    this.totalFlags++;

    // Notify UI
    this.config.onFlag?.(flag);

    // Check warning threshold
    if (this.totalFlags === this.warningThreshold) {
      this.config.onWarning?.("⚠️ Monitoring has detected suspicious activity. Please stay focused on your assessment.");
    }

    console.log(`[Proctoring] ${flag.severity.toUpperCase()}: ${flag.description}`);
  }

  private async flushFlags() {
    if (this.flagBuffer.length === 0) return;

    const flags = [...this.flagBuffer];
    this.flagBuffer = [];

    try {
      await api.post(`/api/v1/sessions/${this.config.sessionId}/proctoring/flags`, { flags });
    } catch (err) {
      // If backend fails, re-add flags to buffer for next flush
      this.flagBuffer.unshift(...flags);
      console.warn("Failed to send proctoring flags to backend:", err);
    }
  }
}

export { ProctoringFlag, ProctoringConfig } from "./types";
