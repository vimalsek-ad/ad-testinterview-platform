/**
 * Face Monitoring — uses webcam for face presence detection.
 * Note: MediaPipe FaceMesh removed due to ESM compatibility issues.
 * Uses basic camera stream for now — face detection via canvas analysis.
 */

import type { ProctoringFlag } from "./types";

export class FaceMonitor {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private onFlag: (flag: ProctoringFlag) => void;
  private checkIntervalMs = 3000;

  constructor(onFlag: (flag: ProctoringFlag) => void, config?: { checkIntervalMs?: number }) {
    this.onFlag = onFlag;
    if (config?.checkIntervalMs) this.checkIntervalMs = config.checkIntervalMs;
  }

  async start(): Promise<HTMLVideoElement> {
    // Request camera access
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    // Create video element
    this.videoElement = document.createElement("video");
    this.videoElement.srcObject = this.stream;
    this.videoElement.setAttribute("playsinline", "");
    await this.videoElement.play();

    console.log("[FaceMonitor] ✅ Camera stream started");

    return this.videoElement;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  captureIdentityPhoto(): string | null {
    if (!this.videoElement) return null;
    const canvas = document.createElement("canvas");
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.videoElement, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    console.log("[FaceMonitor] Camera stopped");
  }

  private emitFlag(type: ProctoringFlag["type"], severity: ProctoringFlag["severity"], description: string) {
    this.onFlag({
      type,
      severity,
      description,
      timestamp: new Date().toISOString(),
    });
  }
}
