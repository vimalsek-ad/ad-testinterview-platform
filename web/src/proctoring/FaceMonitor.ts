/**
 * Face & Gaze Monitoring using MediaPipe Face Mesh.
 * Detects: face absent, multiple faces, gaze away from screen.
 * Runs client-side in the browser — no server round-trips needed.
 */

import { FaceMesh, Results } from "@mediapipe/face_mesh";
import { ProctoringFlag } from "./types";

export class FaceMonitor {
  private faceMesh: FaceMesh | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private onFlag: (flag: ProctoringFlag) => void;

  // State tracking
  private faceAbsentSince: number | null = null;
  private gazeAwaySince: number | null = null;
  private lastFaceCount = 1;
  private identityDescriptor: number[] | null = null;

  // Thresholds
  private faceAbsentThresholdMs = 5000;
  private gazeAwayThresholdMs = 10000;
  private checkIntervalMs = 2000;

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

    // Initialize MediaPipe Face Mesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 3,        // Detect up to 3 faces (for multi-face detection)
      refineLandmarks: true, // Enable iris tracking for gaze
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.faceMesh.onResults((results) => this.processResults(results));

    // Start periodic face checks
    this.intervalId = window.setInterval(() => this.captureAndAnalyze(), this.checkIntervalMs);

    return this.videoElement;
  }

  private async captureAndAnalyze() {
    if (!this.faceMesh || !this.videoElement) return;
    try {
      await this.faceMesh.send({ image: this.videoElement });
    } catch (err) {
      console.warn("Face detection frame error:", err);
    }
  }

  private processResults(results: Results) {
    const faces = results.multiFaceLandmarks || [];
    const now = Date.now();

    // --- Face Absent Detection ---
    if (faces.length === 0) {
      if (!this.faceAbsentSince) {
        this.faceAbsentSince = now;
      } else if (now - this.faceAbsentSince > this.faceAbsentThresholdMs) {
        this.emitFlag("face_absent", "high", `No face detected for ${Math.round((now - this.faceAbsentSince) / 1000)}s`);
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

    // --- Gaze Direction (using iris landmarks) ---
    if (faces.length === 1) {
      const face = faces[0];
      const isLookingAway = this.detectGazeAway(face);

      if (isLookingAway) {
        if (!this.gazeAwaySince) {
          this.gazeAwaySince = now;
        } else if (now - this.gazeAwaySince > this.gazeAwayThresholdMs) {
          this.emitFlag("gaze_away", "medium", `Gaze directed away from screen for ${Math.round((now - this.gazeAwaySince) / 1000)}s`);
          this.gazeAwaySince = now; // Reset
        }
      } else {
        this.gazeAwaySince = null;
      }
    }
  }

  private detectGazeAway(landmarks: { x: number; y: number; z: number }[]): boolean {
    /**
     * Gaze detection using head pose estimation from face landmarks.
     * If nose tip (landmark 1) is significantly offset from face center,
     * the person is looking away.
     *
     * Landmarks used:
     * - 1: Nose tip
     * - 33: Left eye outer corner
     * - 263: Right eye outer corner
     * - 10: Forehead center
     * - 152: Chin
     */
    if (landmarks.length < 468) return false;

    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    // Calculate face center (between eyes)
    const faceCenterX = (leftEye.x + rightEye.x) / 2;

    // If nose is significantly left/right of center → looking sideways
    const horizontalOffset = Math.abs(noseTip.x - faceCenterX);

    // If nose Z is too far forward/back relative to eyes → looking up/down
    const eyeZ = (leftEye.z + rightEye.z) / 2;
    const verticalOffset = Math.abs(noseTip.z - eyeZ);

    // Thresholds (calibrated for typical webcam distance)
    return horizontalOffset > 0.06 || verticalOffset > 0.08;
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

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
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
    if (this.faceMesh) {
      this.faceMesh.close();
      this.faceMesh = null;
    }
  }

  private emitFlag(type: ProctoringFlag["type"], severity: ProctoringFlag["severity"], description: string, metadata?: Record<string, unknown>) {
    this.onFlag({
      type,
      severity,
      description,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }
}
