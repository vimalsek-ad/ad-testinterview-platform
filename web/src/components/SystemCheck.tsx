/**
 * System Check — Pre-assessment gate that verifies camera, microphone, and environment.
 * Candidate must pass all checks and acknowledge rules before starting the assessment.
 */

import { useState, useEffect } from "react";

interface SystemCheckProps {
  assessmentTitle: string;
  timeLimit: number;
  onReady: () => void;
}

export default function SystemCheck({ assessmentTitle, timeLimit, onReady }: SystemCheckProps) {
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  const runChecks = async () => {
    setChecking(true);
    setError("");

    // Check Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraOk(true);
      setMicOk(true);
      setCameraStream(stream);

      // Show preview for 2 seconds then stop
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
      }, 3000);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera and microphone access DENIED. Please allow access in your browser settings and try again.");
        setCameraOk(false);
        setMicOk(false);
      } else if (err.name === "NotFoundError") {
        setError("No camera or microphone found on this device. Please connect a webcam.");
        setCameraOk(false);
        setMicOk(false);
      } else {
        setError(`Device error: ${err.message}`);
        setCameraOk(false);
        setMicOk(false);
      }
    }

    setChecking(false);
  };

  const allChecksPassed = cameraOk === true && micOk === true && acknowledged;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-lg w-full">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-2 text-center">🛡️ Pre-Assessment System Check</h1>
        <p className="text-gray-400 text-center mb-6">
          Please complete the following checks before starting your assessment.
        </p>

        {/* Assessment Info */}
        <div className="bg-gray-700 rounded p-4 mb-6">
          <h2 className="font-semibold text-lg">{assessmentTitle}</h2>
          <p className="text-gray-400 text-sm mt-1">Duration: {timeLimit} minutes</p>
        </div>

        {/* Requirements List */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase">Requirements</h3>
          
          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
            <span className="text-xl">{cameraOk === true ? "✅" : cameraOk === false ? "❌" : "📷"}</span>
            <div className="flex-1">
              <p className="font-medium">Camera Access</p>
              <p className="text-xs text-gray-400">Webcam must be enabled for proctoring</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
            <span className="text-xl">{micOk === true ? "✅" : micOk === false ? "❌" : "🎤"}</span>
            <div className="flex-1">
              <p className="font-medium">Microphone Access</p>
              <p className="text-xs text-gray-400">Audio monitoring for proctoring</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
            <span className="text-xl">🖥️</span>
            <div className="flex-1">
              <p className="font-medium">Close Other Applications</p>
              <p className="text-xs text-gray-400">Close all messaging apps, AI assistants, and unnecessary tabs</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
            <span className="text-xl">🔇</span>
            <div className="flex-1">
              <p className="font-medium">Quiet Environment</p>
              <p className="text-xs text-gray-400">Ensure you are in a quiet room with no other people</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded">
            <span className="text-xl">🌐</span>
            <div className="flex-1">
              <p className="font-medium">Stable Internet Connection</p>
              <p className="text-xs text-gray-400">Ensure reliable internet for code execution</p>
            </div>
          </div>
        </div>

        {/* Check Button */}
        {cameraOk === null && (
          <button
            onClick={runChecks}
            disabled={checking}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded mb-4"
          >
            {checking ? "Checking..." : "🔍 Run System Check"}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
            <p className="font-medium">⚠️ Check Failed</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={runChecks}
              className="mt-2 text-sm text-red-400 underline hover:text-red-300"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success + Acknowledgment */}
        {cameraOk === true && micOk === true && (
          <>
            <div className="bg-green-900/50 border border-green-500 text-green-300 px-4 py-3 rounded mb-4">
              ✅ Camera and microphone working. You're ready!
            </div>

            {/* Rules Acknowledgment */}
            <label className="flex items-start gap-3 p-3 bg-gray-700 rounded mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="w-5 h-5 mt-0.5"
              />
              <span className="text-sm text-gray-300">
                I understand that this assessment is <strong>proctored</strong>. My camera, microphone, 
                and screen activity will be monitored. Tab switching, external paste, and suspicious 
                behavior will be flagged. I will not use AI assistants, search engines, or receive 
                help from others during this assessment.
              </span>
            </label>

            {/* Start Button */}
            <button
              onClick={onReady}
              disabled={!allChecksPassed}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded text-lg"
            >
              {allChecksPassed ? "🚀 Start Assessment" : "Please acknowledge the rules above"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
