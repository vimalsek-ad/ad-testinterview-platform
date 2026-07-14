/**
 * Video Recorder Component — records webcam + audio for interview responses.
 * Uses RecordRTC for cross-browser WebM recording.
 */

import { useState, useRef, useEffect } from "react";

interface VideoRecorderProps {
  maxDurationSeconds: number;
  maxAttempts: number;
  onSubmit: (blob: Blob) => void;
}

export default function VideoRecorder({ maxDurationSeconds, maxAttempts, onSubmit }: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Request camera on mount
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: true,
        });
        setStream(mediaStream);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError("Camera/microphone access denied. Please allow access to record your response.");
      }
    }
    setupCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (!stream) return;
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      setAttemptCount((c) => c + 1);
    };

    mediaRecorder.start(1000); // 1-second chunks
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);

    // Duration timer
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);
      if (elapsed >= maxDurationSeconds) {
        stopRecording();
      }
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
  };

  const submitRecording = () => {
    if (recordedBlob) {
      onSubmit(recordedBlob);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera Preview / Playback */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video max-w-lg mx-auto">
        {!recordedUrl ? (
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoPlaybackRef}
            src={recordedUrl}
            controls
            className="w-full h-full object-cover"
          />
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1 rounded">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-sm font-mono">
              {formatTime(duration)} / {formatTime(maxDurationSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!isRecording && !recordedUrl && (
          <button
            onClick={startRecording}
            disabled={attemptCount >= maxAttempts}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            🎬 Start Recording
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center gap-2"
          >
            ⏹ Stop Recording
          </button>
        )}

        {recordedUrl && !isRecording && (
          <>
            {attemptCount < maxAttempts && (
              <button
                onClick={discardRecording}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
              >
                🗑 Re-record
              </button>
            )}
            <button
              onClick={submitRecording}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              ✅ Submit Response
            </button>
          </>
        )}
      </div>

      {/* Attempt counter */}
      <p className="text-center text-sm text-gray-400">
        Attempts: {attemptCount} / {maxAttempts}
        {attemptCount >= maxAttempts && !recordedUrl && (
          <span className="text-red-400 ml-2">No attempts remaining</span>
        )}
      </p>
    </div>
  );
}
