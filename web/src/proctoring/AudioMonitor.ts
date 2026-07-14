/**
 * Audio Monitoring — detects speech using Web Audio API energy analysis.
 * Flags when someone is talking for more than 5 seconds continuously.
 */

import type { ProctoringFlag } from "./types";

export class AudioMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private onFlag: (flag: ProctoringFlag) => void;

  // State
  private speechStartTime: number | null = null;
  private speechThresholdMs = 5000;
  private energyThreshold = 25; // Audio energy level that indicates speech

  constructor(onFlag: (flag: ProctoringFlag) => void, config?: { speechThresholdMs?: number }) {
    this.onFlag = onFlag;
    if (config?.speechThresholdMs) this.speechThresholdMs = config.speechThresholdMs;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.intervalId = window.setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average energy
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      const now = Date.now();

      if (average > this.energyThreshold) {
        // Speech detected
        if (!this.speechStartTime) {
          this.speechStartTime = now;
        } else if (now - this.speechStartTime > this.speechThresholdMs) {
          const duration = Math.round((now - this.speechStartTime) / 1000);
          this.emitFlag("speech_detected", "medium", `Speech detected for ${duration} seconds (possible communication with another person)`);
          this.speechStartTime = now; // Reset to avoid rapid-fire flags
        }
      } else {
        // Silence — reset counter
        this.speechStartTime = null;
      }
    }, 500); // Check every 500ms
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
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
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
