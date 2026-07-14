/**
 * Review Dashboard — Interviewers review candidates, view scores/flags, make decisions.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Candidate {
  session_id: string;
  candidate_email: string;
  candidate_name: string | null;
  status: string;
  score: number | null;
  total_flags: number;
  critical_flags: number;
  high_flags: number;
  decision: string | null;
}

interface CandidateDetail {
  session_id: string;
  candidate_email: string;
  candidate_name: string | null;
  composite_score: number | null;
  code_submissions: any[];
  proctoring: { total_flags: number; integrity_score: number; flags: any[] };
  interview_responses: any[];
  decision: any | null;
}

export default function Review() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (assessmentId) loadCandidates();
  }, [assessmentId]);

  // Auto-select candidate if session_id is in URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    if (sessionId && candidates.length > 0) {
      loadCandidateDetail(sessionId);
    }
  }, [candidates]);

  const loadCandidates = async () => {
    try {
      const res = await api.get(`/api/v1/reviews/assessments/${assessmentId}/candidates`);
      setCandidates(res.data.candidates);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load candidates");
    }
  };

  const loadCandidateDetail = async (sessionId: string) => {
    try {
      const res = await api.get(`/api/v1/reviews/candidates/${sessionId}`);
      setSelectedCandidate(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load candidate detail");
    }
  };

  const makeDecision = async (decision: string) => {
    if (!selectedCandidate) return;
    try {
      await api.post(`/api/v1/reviews/candidates/${selectedCandidate.session_id}/decision`, {
        decision,
        notes: decisionNotes || undefined,
      });
      setDecisionNotes("");
      loadCandidates();
      loadCandidateDetail(selectedCandidate.session_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to record decision");
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    if (!decision) return null;
    const styles: Record<string, string> = {
      select: "bg-green-900 text-green-300",
      reject: "bg-red-900 text-red-300",
      hold: "bg-yellow-900 text-yellow-300",
    };
    return <span className={`text-xs px-2 py-0.5 rounded ${styles[decision]}`}>{decision}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-xl font-bold">📊 Review Dashboard</h1>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
          {error}
          <button onClick={() => setError("")} className="float-right text-red-400">×</button>
        </div>
      )}

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Candidate List */}
        <div className="w-[35%]">
          <h2 className="text-lg font-semibold mb-3">{candidates.length} Candidates</h2>
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.session_id}
                onClick={() => loadCandidateDetail(c.session_id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  selectedCandidate?.session_id === c.session_id
                    ? "bg-blue-900/50 border border-blue-500"
                    : "bg-gray-800 hover:bg-gray-750 border border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{c.candidate_name || c.candidate_email}</span>
                  {getDecisionBadge(c.decision)}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {c.score !== null && (
                    <span className={`font-bold ${c.score >= 70 ? "text-green-400" : c.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                      {c.score.toFixed(0)}%
                    </span>
                  )}
                  {c.total_flags > 0 && (
                    <span className="text-red-400 text-xs">🚨 {c.total_flags} flags</span>
                  )}
                  <span className="text-gray-500 text-xs">{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Candidate Detail */}
        <div className="flex-1">
          {selectedCandidate ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedCandidate.candidate_name || selectedCandidate.candidate_email}</h2>
                    <p className="text-gray-400 text-sm">{selectedCandidate.candidate_email}</p>
                  </div>
                  <div className="text-right">
                    {selectedCandidate.composite_score !== null && (
                      <div className="text-3xl font-bold text-blue-400">{selectedCandidate.composite_score.toFixed(0)}%</div>
                    )}
                    <div className="text-sm text-gray-400">Integrity: {selectedCandidate.proctoring.integrity_score}/100</div>
                  </div>
                </div>
              </div>

              {/* Code Submissions */}
              {selectedCandidate.code_submissions.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">💻 Code Submissions</h3>
                  {selectedCandidate.code_submissions.map((sub) => (
                    <div key={sub.id} className="border border-gray-700 rounded p-3 mb-2">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">{sub.language}</span>
                        <span className={sub.score >= 70 ? "text-green-400" : "text-red-400"}>
                          {sub.tests_passed}/{sub.tests_total} passed ({sub.score?.toFixed(0)}%)
                        </span>
                      </div>
                      <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
                        {sub.source_code}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Interview Responses */}
              {selectedCandidate.interview_responses.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">🎬 Interview Responses ({selectedCandidate.interview_responses.length})</h3>
                  {selectedCandidate.interview_responses.map((resp: any) => (
                    <div key={resp.id} className="border border-gray-700 rounded p-3 mb-2">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Question: {resp.question_id?.substring(0, 8)}...</span>
                        <span className="text-gray-500">{new Date(resp.submitted_at).toLocaleString()}</span>
                      </div>
                      {resp.transcription && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">📝 Transcription:</p>
                          <p className="text-sm text-gray-300 bg-gray-900 p-2 rounded">{resp.transcription}</p>
                        </div>
                      )}
                      {resp.ai_score && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400">AI Score: <span className="text-blue-400 font-bold">{resp.ai_score}%</span></p>
                        </div>
                      )}
                      {!resp.transcription && (
                        <p className="text-xs text-yellow-400 mt-1">⏳ Transcription processing...</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Proctoring */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">
                  🛡️ Proctoring ({selectedCandidate.proctoring.total_flags} flags)
                </h3>
                {selectedCandidate.proctoring.flags.length === 0 ? (
                  <p className="text-green-400 text-sm">✅ No suspicious activity detected</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedCandidate.proctoring.flags.map((flag: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm py-1 border-b border-gray-700/50">
                        <span className={`w-2 h-2 rounded-full ${
                          flag.severity === "critical" ? "bg-red-500" :
                          flag.severity === "high" ? "bg-orange-500" :
                          flag.severity === "medium" ? "bg-yellow-500" : "bg-gray-500"
                        }`} />
                        <span className="text-gray-400 text-xs w-16">{flag.severity}</span>
                        <span className="text-gray-300 flex-1">{flag.description}</span>
                        <span className="text-gray-500 text-xs">{new Date(flag.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Decision Panel */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">📋 Decision</h3>
                {selectedCandidate.decision ? (
                  <div className="flex items-center gap-3">
                    {getDecisionBadge(selectedCandidate.decision.decision)}
                    <span className="text-gray-300 text-sm">{selectedCandidate.decision.notes}</span>
                    <span className="text-gray-500 text-xs ml-auto">by {selectedCandidate.decision.reviewer_email}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      placeholder="Notes (optional) — why this decision?"
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => makeDecision("select")}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium text-sm"
                      >
                        ✅ Select
                      </button>
                      <button
                        onClick={() => makeDecision("hold")}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-medium text-sm"
                      >
                        ⏸ Hold
                      </button>
                      <button
                        onClick={() => makeDecision("reject")}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium text-sm"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">Select a candidate to review</p>
              <p className="text-sm mt-2">View their code, proctoring flags, and make a decision</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
