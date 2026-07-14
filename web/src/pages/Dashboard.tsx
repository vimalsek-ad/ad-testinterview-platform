import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Candidate {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  assessment_id: string;
  assessment_title: string;
  status: string;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  time_spent_minutes: number | null;
  flag_count: number;
  decision: string | null;
  code_submissions: {
    question_id: string;
    language: string;
    score: number | null;
    tests_passed: number | null;
    tests_total: number | null;
    submitted_at: string;
  }[];
  interview_responses: {
    question_id: string;
    transcription: string | null;
    ai_score: number | null;
    submitted_at: string;
  }[];
}

interface Overview {
  platform: { total_users: number; total_questions: number; total_assessments: number; total_sessions: number; total_submissions: number };
  sessions_by_status: Record<string, number>;
  scoring: { average_score: number | null; completion_rate: number };
  decisions: { select: number; reject: number; hold: number; pending_review: number };
  proctoring: { total_flags: number; sessions_with_flags: number; clean_sessions: number };
}

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, candidatesRes] = await Promise.all([
          api.get("/api/v1/admin/analytics/overview"),
          api.get("/api/v1/admin/analytics/candidates"),
        ]);
        setOverview(overviewRes.data);
        setCandidates(candidatesRes.data.candidates);
      } catch {
        navigate("/login");
      }
    }
    load();
  }, []);

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-8 text-white">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">A snapshot of your hiring pipeline.</p>
      </div>

      {/* Stat Cards — Row 1 */}
      {overview && (
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard label="Candidates" value={overview.platform.total_sessions} />
          <StatCard label="Assessments" value={overview.platform.total_assessments} />
          <StatCard label="Questions" value={overview.platform.total_questions} />
          <StatCard label="Avg Score" value={overview.scoring.average_score ? `${overview.scoring.average_score}%` : "—"} />
        </div>
      )}

      {/* Decision Cards — Row 2 */}
      {overview && (
        <div className="grid grid-cols-4 gap-5 mb-8">
          <DecisionCard label="Selected" value={overview.decisions.select} color="green" />
          <DecisionCard label="On Hold" value={overview.decisions.hold} color="yellow" />
          <DecisionCard label="Rejected" value={overview.decisions.reject} color="red" />
          <DecisionCard label="Review Pending" value={overview.decisions.pending_review} color="blue" />
        </div>
      )}

      {/* Charts + Recent Activity */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Bar Chart — Candidate Pipeline */}
        {overview && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Candidate Pipeline</h3>
            <div className="flex items-end gap-4 h-40">
              <BarItem label="Invited" value={overview.sessions_by_status["invited"] || 0} max={overview.platform.total_sessions} color="bg-gray-400" />
              <BarItem label="In Progress" value={overview.sessions_by_status["in_progress"] || 0} max={overview.platform.total_sessions} color="bg-blue-500" />
              <BarItem label="Submitted" value={overview.sessions_by_status["submitted"] || 0} max={overview.platform.total_sessions} color="bg-teal-500" />
              <BarItem label="Scored" value={overview.sessions_by_status["scored"] || 0} max={overview.platform.total_sessions} color="bg-purple-500" />
            </div>
          </div>
        )}

        {/* Proctoring / Integrity Chart */}
        {overview && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Integrity Overview</h3>
            <div className="flex items-end gap-4 h-40">
              <BarItem label="Clean" value={overview.proctoring.clean_sessions} max={overview.platform.total_sessions} color="bg-green-500" />
              <BarItem label="Flagged" value={overview.proctoring.sessions_with_flags} max={overview.platform.total_sessions} color="bg-red-400" />
              <BarItem label="Total Flags" value={overview.proctoring.total_flags} max={Math.max(overview.proctoring.total_flags, 1)} color="bg-orange-400" />
            </div>
            <div className="mt-4 flex gap-4 text-xs text-gray-400">
              <span>Completion Rate: <strong className="text-white">{overview.scoring.completion_rate}%</strong></span>
              <span>Flagged: <strong className="text-red-400">{overview.proctoring.sessions_with_flags}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity + Candidate Detail */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Sign-ins / Activity */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Recent Candidates</h3>
            <button onClick={() => navigate("/assessments")} className="text-xs text-blue-400 hover:underline font-medium">
              View All
            </button>
          </div>
          <div className="space-y-1">
            {candidates.slice(0, 8).map((c) => (
              <div
                key={c.session_id}
                onClick={() => setSelectedCandidate(c)}
                className="flex items-center justify-between py-3 px-3 rounded-lg cursor-pointer hover:bg-gray-700/50 transition border-b border-gray-700/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                    {getInitials(c.candidate_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.candidate_name}</p>
                    <p className="text-xs text-gray-400">{c.candidate_email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{c.started_at ? timeAgo(c.started_at) : "Not started"}</p>
                  <p className="text-xs text-gray-500">{c.assessment_title}</p>
                </div>
              </div>
            ))}
            {candidates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No candidates yet</p>
            )}
          </div>
        </div>

        {/* Candidate Detail Panel */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          {selectedCandidate ? (
            <CandidateDetail candidate={selectedCandidate} navigate={navigate} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">Click a candidate to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function DecisionCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "border-green-700 bg-green-900/40 text-green-400",
    yellow: "border-yellow-700 bg-yellow-900/40 text-yellow-400",
    red: "border-red-700 bg-red-900/40 text-red-400",
    blue: "border-blue-700 bg-blue-900/40 text-blue-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}

function BarItem({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const height = max > 0 ? Math.max((value / max) * 100, 4) : 4;
  return (
    <div className="flex-1 flex flex-col items-center">
      <span className="text-xs font-bold text-gray-300 mb-1">{value}</span>
      <div className="w-full bg-gray-700 rounded-t relative" style={{ height: "120px" }}>
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-t ${color} transition-all`}
          style={{ height: `${height}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 mt-2 text-center leading-tight">{label}</span>
    </div>
  );
}

function CandidateDetail({ candidate, navigate }: { candidate: Candidate; navigate: any }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{candidate.candidate_name}</h3>
          <p className="text-xs text-gray-400">{candidate.candidate_email}</p>
          <p className="text-xs text-gray-500 mt-0.5">{candidate.assessment_title}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${(candidate.score ?? 0) >= 70 ? "text-green-400" : (candidate.score ?? 0) >= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {candidate.score !== null ? `${candidate.score.toFixed(0)}%` : "—"}
          </p>
          {candidate.decision && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              candidate.decision === "select" ? "bg-green-900 text-green-300" :
              candidate.decision === "reject" ? "bg-red-900 text-red-300" :
              "bg-yellow-900 text-yellow-300"
            }`}>{candidate.decision}</span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-3 gap-3 text-sm bg-gray-900 rounded-lg p-3">
        <div>
          <p className="text-xs text-gray-500">Started</p>
          <p className="text-gray-300 font-medium text-xs">{candidate.started_at ? new Date(candidate.started_at).toLocaleString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Submitted</p>
          <p className="text-gray-300 font-medium text-xs">{candidate.submitted_at ? new Date(candidate.submitted_at).toLocaleString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-white font-bold text-xs">{candidate.time_spent_minutes ? `${candidate.time_spent_minutes} min` : "—"}</p>
        </div>
      </div>

      {/* Code Submissions */}
      {candidate.code_submissions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Code Submissions</h4>
          {candidate.code_submissions.map((sub, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <span className="text-xs text-gray-400">{sub.language}</span>
              <span className={`text-xs font-semibold ${(sub.score ?? 0) >= 70 ? "text-green-400" : "text-red-400"}`}>
                {sub.tests_passed}/{sub.tests_total} ({sub.score?.toFixed(0) ?? 0}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Interview Responses */}
      {candidate.interview_responses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Interview Responses</h4>
          {candidate.interview_responses.map((resp, idx) => (
            <div key={idx} className="py-2 border-b border-gray-700 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Response {idx + 1}</span>
                {resp.ai_score !== null && (
                  <span className={`text-xs font-bold ${resp.ai_score >= 50 ? "text-green-400" : "text-red-400"}`}>
                    AI: {resp.ai_score}%
                  </span>
                )}
              </div>
              {resp.transcription && (
                <p className="text-xs text-gray-300 mt-1 line-clamp-2">{resp.transcription}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Proctoring + Action */}
      <div className="flex items-center justify-between pt-2">
        <span className={`text-xs ${candidate.flag_count === 0 ? "text-green-400" : "text-red-400"}`}>
          {candidate.flag_count === 0 ? "✅ Clean" : `🚨 ${candidate.flag_count} flags`}
        </span>
        <button
          onClick={() => navigate(`/candidate/${candidate.session_id}`)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
        >
          Open Full Review →
        </button>
      </div>
    </div>
  );
}
