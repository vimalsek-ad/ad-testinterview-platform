/**
 * Review Dashboard — Lists all candidates for an assessment.
 * Clicking a candidate opens their full Candidate Dashboard.
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

export default function Review() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (assessmentId) loadCandidates();
  }, [assessmentId]);

  // Auto-navigate if session param present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    if (sessionId) {
      navigate(`/candidate/${sessionId}`, { replace: true });
    }
  }, []);

  const loadCandidates = async () => {
    try {
      const res = await api.get(`/api/v1/reviews/assessments/${assessmentId}/candidates`);
      setCandidates(res.data.candidates);
      setAssessmentTitle(res.data.assessment_title || "Assessment");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load candidates");
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (filter === "all") return true;
    if (filter === "pending") return !c.decision;
    return c.decision === filter;
  });

  const stats = {
    total: candidates.length,
    selected: candidates.filter((c) => c.decision === "select").length,
    rejected: candidates.filter((c) => c.decision === "reject").length,
    hold: candidates.filter((c) => c.decision === "hold").length,
    pending: candidates.filter((c) => !c.decision).length,
  };

  return (
    <div className="p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate("/assessments")} className="text-gray-400 hover:text-white text-sm mb-2 block">
            ← Back to Assessments
          </button>
          <h1 className="text-2xl font-bold">📊 Review: {assessmentTitle}</h1>
          <p className="text-sm text-gray-400 mt-1">{candidates.length} candidates assigned</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <button onClick={() => setFilter("all")} className={`rounded-xl p-4 border transition ${filter === "all" ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
        </button>
        <button onClick={() => setFilter("select")} className={`rounded-xl p-4 border transition ${filter === "select" ? "border-green-500 bg-green-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
          <p className="text-2xl font-bold text-green-400">{stats.selected}</p>
          <p className="text-xs text-gray-400">Selected</p>
        </button>
        <button onClick={() => setFilter("hold")} className={`rounded-xl p-4 border transition ${filter === "hold" ? "border-yellow-500 bg-yellow-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
          <p className="text-2xl font-bold text-yellow-400">{stats.hold}</p>
          <p className="text-xs text-gray-400">On Hold</p>
        </button>
        <button onClick={() => setFilter("reject")} className={`rounded-xl p-4 border transition ${filter === "reject" ? "border-red-500 bg-red-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
          <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
          <p className="text-xs text-gray-400">Rejected</p>
        </button>
        <button onClick={() => setFilter("pending")} className={`rounded-xl p-4 border transition ${filter === "pending" ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
          <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
          <p className="text-xs text-gray-400">Pending Review</p>
        </button>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCandidates.map((c) => (
          <div
            key={c.session_id}
            onClick={() => navigate(`/candidate/${c.session_id}`)}
            className="bg-gray-800 rounded-xl border border-gray-700 p-5 cursor-pointer hover:border-blue-500 hover:bg-gray-800/80 transition group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 group-hover:bg-blue-900/50 group-hover:text-blue-300 transition">
                  {(c.candidate_name || c.candidate_email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{c.candidate_name || c.candidate_email.split("@")[0]}</p>
                  <p className="text-xs text-gray-500">{c.candidate_email}</p>
                </div>
              </div>
              {c.decision && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  c.decision === "select" ? "bg-green-900 text-green-300" :
                  c.decision === "reject" ? "bg-red-900 text-red-300" :
                  "bg-yellow-900 text-yellow-300"
                }`}>{c.decision}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {c.score !== null ? (
                  <span className={`text-lg font-bold ${c.score >= 70 ? "text-green-400" : c.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                    {c.score.toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-lg font-bold text-gray-500">—</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.status === "submitted" ? "bg-green-900/50 text-green-300" :
                  c.status === "in_progress" ? "bg-blue-900/50 text-blue-300" :
                  "bg-gray-700 text-gray-400"
                }`}>{c.status}</span>
              </div>
              {c.total_flags > 0 && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  🚨 {c.total_flags}
                </span>
              )}
            </div>

            {/* Open indicator */}
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500 group-hover:text-blue-400 transition">
              Click to open full review →
            </div>
          </div>
        ))}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          <p className="text-lg">No candidates match this filter</p>
          <button onClick={() => setFilter("all")} className="text-blue-400 text-sm mt-2 hover:underline">Show all</button>
        </div>
      )}
    </div>
  );
}
