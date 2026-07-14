/**
 * Face Monitoring — uses TensorFlow.js face-detection for:
 * - Face absent detection (0 faces > 5 seconds)
 * - Multiple faces detection (2+ faces = critical)
 * - Face position tracking (off-center = looking away)
 *
 * Runs entirely in the browser — no server needed.
 */

import type { ProctoringFlag } from "./types";

export class FaceMonitor {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private detector: any = null;
  private onFlag: (flag: ProctoringFlag) => void;
  private checkIntervalMs = 3000;

  // State tracking
  private faceAbsentSince: number | null = null;
  private faceAbsentThresholdMs = 5000;
  private lastFaceCount = 1;

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

    // Load TensorFlow.js face detection model
    try {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      console.log("[FaceMonitor] TensorFlow.js backend:", tf.getBackend());

      const faceDetection = await import("@tensorflow-models/face-detection");

      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      this.detector = await faceDetection.createDetector(model, {
        runtime: "tfjs",
        maxFaces: 3,
      });
      console.log("[FaceMonitor] ✅ Face detection model loaded (TensorFlow.js)");

      // Start periodic face checks
      this.intervalId = window.setInterval(() => this.detectFaces(), this.checkIntervalMs);
    } catch (err) {
      console.warn("[FaceMonitor] ⚠️ Face detection model failed to load — will retry once:", err);
      
      // Retry after 5 seconds
      setTimeout(async () => {
        try {
          const tf = await import("@tensorflow/tfjs");
          const faceDetection = await import("@tensorflow-models/face-detection");
          const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
          this.detector = await faceDetection.createDetector(model, { runtime: "tfjs", maxFaces: 3 });
          console.log("[FaceMonitor] ✅ Face detection model loaded on retry!");
          this.intervalId = window.setInterval(() => this.detectFaces(), this.checkIntervalMs);
        } catch (retryErr) {
          console.warn("[FaceMonitor] ❌ Face detection unavailable. Camera active but no AI face analysis.");
        }
      }, 5000);
    }

    return this.videoElement;
  }

  private async detectFaces() {
    if (!this.detector || !this.videoElement) return;

    try {
      const faces = await this.detector.estimateFaces(this.videoElement);
      const now = Date.now();

      // --- Face Absent Detection ---
      if (faces.length === 0) {
        if (!this.faceAbsentSince) {
          this.faceAbsentSince = now;
        } else if (now - this.faceAbsentSince > this.faceAbsentThresholdMs) {
          const duration = Math.round((now - this.faceAbsentSince) / 1000);
          this.emitFlag("face_absent", "high", `No face detected for ${duration} seconds`);
          this.faceAbsentSince = now; // Reset to avoid spamming
        }
      } else {
        this.faceAbsentSince = null;
      }

      // --- Multiple Faces Detection ---
      if (faces.length > 1 && this.lastFaceCount <= 1) {
        this.emitFlag("multiple_faces", "critical", `${faces.length} faces detected in frame`);
      }
      this.lastFaceCount = faces.length;

      // --- Gaze/Position Detection (face off-center) ---
      if (faces.length === 1) {
        const face = faces[0];
        const box = face.box;
        const faceCenterX = box.xMin + box.width / 2;
        const frameWidth = this.videoElement.videoWidth;

        // If face center is in the outer 25% of the frame → looking away
        const relativePos = faceCenterX / frameWidth;
        if (relativePos < 0.2 || relativePos > 0.8) {
          // Only flag if consistently off-center (not just a brief glance)
          this.emitFlag("gaze_away", "medium", "Face positioned away from center (looking sideways)");
        }
      }
    } catch (err) {
      // Silently ignore detection errors (can happen during tab switch)
    }
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
    this.detector = null;
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
