export type FlagSeverity = "low" | "medium" | "high" | "critical";

export type FlagType =
  | "tab_switch"
  | "window_blur"
  | "fullscreen_exit"
  | "external_paste"
  | "rapid_input"
  | "face_absent"
  | "multiple_faces"
  | "gaze_away"
  | "speech_detected"
  | "face_substitution";

export interface ProctoringFlag {
  type: FlagType;
  severity: FlagSeverity;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ProctoringConfig {
  sessionId: string;
  level: "none" | "basic" | "full";
  faceCheckIntervalMs: number;       // default: 5000
  gazeAwayThresholdMs: number;       // default: 10000
  speechThresholdMs: number;         // default: 5000
  onFlag?: (flag: ProctoringFlag) => void;
  onWarning?: (message: string) => void;
}
