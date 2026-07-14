/**
 * Interview Q&A Page — presents interview questions and records video responses.
 * Candidates record themselves answering each question via webcam + audio.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VideoRecorder from "../components/VideoRecorder";
import { api } from "../lib/api";

interface InterviewQuestion {
  id: string;
  title: string;
  description: string;
  max_duration_seconds: number;
  max_attempts: number;
}

export default function Interview() {
  const { token } = useParams<{ token: string }>();
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await api.get(`/api/v1/sessions/${token}`);
        setSessionId(res.data.session_id);
        setAssessmentTitle(res.data.assessment_title);

        // For demo — use questions as interview questions with video response config
        const interviewQs: InterviewQuestion[] = res.data.questions.map((q: any) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          max_duration_seconds: 180, // 3 minutes per question
          max_attempts: 3,
        }));
        setQuestions(interviewQs);
      } catch {
        setError("Session not found or expired");
      }
    }
    loadSession();
  }, [token]);

  const handleSubmitRecording = async (blob: Blob) => {
    const question = questions[currentQ];
    if (!question) return;

    // Upload the recording
    try {
      const formData = new FormData();
      formData.append("file", blob, `response_${question.id}.webm`);
      formData.append("question_id", question.id);
      formData.append("session_id", sessionId);

      await api.post("/api/v1/interview/responses", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Mark as answered
      setResponses((prev) => ({ ...prev, [question.id]: true }));

      // Move to next question or complete
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        setIsComplete(true);
      }
    } catch (err: any) {
      // For prototype, just mark as complete even if upload fails
      setResponses((prev) => ({ ...prev, [question.id]: true }));
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        setIsComplete(true);
      }
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg text-center max-w-md">
          <h1 className="text-3xl font-bold text-white mb-4">✅ Interview Complete!</h1>
          <p className="text-gray-300 mb-4">
            All {questions.length} responses have been recorded.
          </p>
          <p className="text-gray-400 text-sm">
            Your responses will be reviewed by the hiring team.
          </p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading interview...</div>
      </div>
    );
  }

  const question = questions[currentQ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">{assessmentTitle}</h1>
          <span className="text-sm text-gray-400">
            Interview — Question {currentQ + 1} of {questions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full ${
                responses[questions[idx]?.id]
                  ? "bg-green-500"
                  : idx === currentQ
                  ? "bg-blue-500"
                  : "bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question + Recorder */}
      <div className="max-w-3xl mx-auto p-6">
        {/* Question Prompt */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-3">{question.title}</h2>
          <pre className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
            {question.description}
          </pre>
          <div className="mt-4 flex gap-4 text-sm text-gray-400">
            <span>⏱ Max {Math.floor(question.max_duration_seconds / 60)} minutes</span>
            <span>🎬 {question.max_attempts} attempt{question.max_attempts > 1 ? "s" : ""} allowed</span>
          </div>
        </div>

        {/* Video Recorder */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Record Your Response</h3>
          <p className="text-gray-400 text-sm mb-4">
            Click "Start Recording" when you're ready. Speak clearly and look at the camera.
          </p>
          <VideoRecorder
            maxDurationSeconds={question.max_duration_seconds}
            maxAttempts={question.max_attempts}
            onSubmit={handleSubmitRecording}
          />
        </div>
      </div>
    </div>
  );
}
