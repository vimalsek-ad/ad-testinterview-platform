/**
 * Candidate Review Dashboard — full page view of a single candidate's assessment.
 * Features: Score trend, question timing, code diff, proctoring, PDF export, decision.
 */

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface CandidateData {
  session_id: string;
  candidate_email: string;
  candidate_name: string | null;
  composite_score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  status: string;
  assessment_title: string;
  code_submissions: {
    id: string;
    question_id: string;
    question_title: string;
    reference_solution: string | null;
    source_code: string;
    language: string;
    score: number | null;
    tests_passed: number | null;
    tests_total: number | null;
    submitted_at: string;
  }[];
  proctoring: {
    total_flags: number;
    integrity_score: number;
    flags: { type: string; severity: string; description: string; timestamp: string }[];
  };
  interview_responses: {
    id: string;
    question_id: string;
    filename: string;
    transcription: string | null;
    ai_score: number | null;
    submitted_at: string;
  }[];
  decision: { decision: string; notes: string; reviewer_email: string; decided_at: string } | null;
}

interface TeamScore {
  score: number;
  candidate: string;
}

export default function CandidateReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [teamData, setTeamData] = useState<{ average_score: number; scores: TeamScore[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "code" | "interview" | "proctoring">("overview");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [error, setError] = useState("");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [showReference, setShowReference] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionId) {
      loadCandidate();
      loadTeamData();
    }
  }, [sessionId]);

  const loadCandidate = async () => {
    try {
      const res = await api.get(`/api/v1/reviews/candidates/${sessionId}`);
      setCandidate(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load candidate");
    }
  };

  const loadTeamData = async () => {
    try {
      const res = await api.get("/api/v1/admin/analytics/team-average");
      setTeamData(res.data);
    } catch { /* ignore */ }
  };

  const makeDecision = async (decision: string) => {
    if (!candidate) return;
    try {
      await api.post(`/api/v1/reviews/candidates/${candidate.session_id}/decision`, {
        decision,
        notes: decisionNotes || undefined,
      });
      setDecisionNotes("");
      loadCandidate();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to record decision");
    }
  };

  const getTimeDiff = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getQuestionTiming = () => {
    if (!candidate || !candidate.started_at) return [];
    const events = [
      ...candidate.code_submissions.map((s) => ({ type: "code", time: s.submitted_at, label: s.question_title || "Code", score: s.score })),
      ...candidate.interview_responses.map((r, i) => ({ type: "interview", time: r.submitted_at, label: `Interview ${i + 1}`, score: r.ai_score })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let prevTime = candidate.started_at;
    return events.map((e) => {
      const duration = getTimeDiff(prevTime!, e.time);
      prevTime = e.time;
      return { ...e, duration };
    });
  };

  // PDF Export
  const exportPDF = () => {
    if (!candidate) return;
    const content = reportRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html><head><title>Candidate Report - ${candidate.candidate_name || candidate.candidate_email}</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 18px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .score { font-size: 48px; font-weight: bold; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .stat { background: #f5f5f5; padding: 12px; border-radius: 8px; }
        .stat-label { font-size: 10px; text-transform: uppercase; color: #666; }
        .stat-value { font-size: 14px; font-weight: 600; margin-top: 4px; }
        .timeline-item { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .flag { padding: 6px 12px; background: #fff3f3; border-left: 3px solid #e53e3e; margin: 4px 0; border-radius: 4px; }
        pre { background: #f5f5f5; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
        .decision { padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-top: 16px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <div>
          <h1>${candidate.candidate_name || candidate.candidate_email.split("@")[0]}</h1>
          <p style="color:#666">${candidate.candidate_email}</p>
          <p style="color:#999;font-size:12px">${candidate.assessment_title}</p>
        </div>
        <div style="text-align:right">
          <div class="score" style="color:${(candidate.composite_score ?? 0) >= 70 ? '#22c55e' : (candidate.composite_score ?? 0) >= 40 ? '#eab308' : '#ef4444'}">${(candidate.composite_score ?? 0).toFixed(0)}%</div>
          <p style="color:#666;font-size:12px">Composite Score</p>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-label">Status</div><div class="stat-value">${candidate.status}</div></div>
        <div class="stat"><div class="stat-label">Started</div><div class="stat-value">${candidate.started_at ? new Date(candidate.started_at).toLocaleString() : '—'}</div></div>
        <div class="stat"><div class="stat-label">Submitted</div><div class="stat-value">${candidate.submitted_at ? new Date(candidate.submitted_at).toLocaleString() : '—'}</div></div>
        <div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${candidate.started_at && candidate.submitted_at ? getTimeDiff(candidate.started_at, candidate.submitted_at) : '—'}</div></div>
      </div>
      <h2>Code Submissions</h2>
      ${candidate.code_submissions.map((s) => `
        <div class="timeline-item">
          <span><strong>${s.question_title || 'Code'}</strong> (${s.language})</span>
          <span>${s.tests_passed}/${s.tests_total} passed — ${(s.score ?? 0).toFixed(0)}%</span>
        </div>
      `).join("")}
      <h2>Interview Responses</h2>
      ${candidate.interview_responses.map((r, i) => `
        <div style="margin:8px 0">
          <p><strong>Response ${i + 1}</strong> ${r.ai_score !== null ? `— AI Score: ${r.ai_score}%` : ''}</p>
          ${r.transcription ? `<p style="color:#444;font-size:13px;margin-top:4px">${r.transcription}</p>` : '<p style="color:#999">Processing...</p>'}
        </div>
      `).join("")}
      <h2>Proctoring (${candidate.proctoring.total_flags} flags)</h2>
      <p>Integrity Score: <strong>${candidate.proctoring.integrity_score}/100</strong></p>
      ${candidate.proctoring.flags.length === 0 ? '<p style="color:green">✓ No suspicious activity detected</p>' :
        candidate.proctoring.flags.map((f) => `<div class="flag"><strong>${f.severity}</strong>: ${f.description}</div>`).join("")}
      ${candidate.decision ? `
        <div class="decision" style="background:${candidate.decision.decision === 'select' ? '#dcfce7' : candidate.decision.decision === 'reject' ? '#fee2e2' : '#fef3c7'}">
          Decision: ${candidate.decision.decision.toUpperCase()} by ${candidate.decision.reviewer_email}
          ${candidate.decision.notes ? `<br><span style="font-weight:normal;font-size:12px">${candidate.decision.notes}</span>` : ''}
        </div>` : ''}
      <p style="text-align:center;color:#999;font-size:11px;margin-top:32px">Generated by AD Hire — ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (error) {
    return (
      <div className="p-8 text-white">
        <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!candidate) {
    return <div className="p-8 text-white">Loading candidate details...</div>;
  }

  const score = candidate.composite_score ?? 0;
  const scoreColor = score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
  const integrityScore = candidate.proctoring.integrity_score;
  const integrityColor = integrityScore >= 80 ? "text-green-400" : integrityScore >= 50 ? "text-yellow-400" : "text-red-400";
  const questionTimings = getQuestionTiming();

  return (
    <div className="p-6 text-white" ref={reportRef}>
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-white text-sm">
          ← Back to Dashboard
        </button>
        <button
          onClick={exportPDF}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          📄 Export PDF
        </button>
      </div>

      {/* Candidate Header Card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300">
              {(candidate.candidate_name || candidate.candidate_email)[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{candidate.candidate_name || candidate.candidate_email.split("@")[0]}</h1>
              <p className="text-sm text-gray-400">{candidate.candidate_email}</p>
              <p className="text-xs text-gray-500 mt-1">{candidate.assessment_title}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${scoreColor}`}>{score.toFixed(0)}%</p>
            <p className="text-xs text-gray-400 mt-1">Composite Score</p>
            {candidate.decision && (
              <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-medium ${
                candidate.decision.decision === "select" ? "bg-green-900 text-green-300" :
                candidate.decision.decision === "reject" ? "bg-red-900 text-red-300" :
                "bg-yellow-900 text-yellow-300"
              }`}>{candidate.decision.decision.toUpperCase()}</span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <MiniStat label="Status" value={candidate.status} />
          <MiniStat label="Started" value={candidate.started_at ? new Date(candidate.started_at).toLocaleString() : "—"} />
          <MiniStat label="Submitted" value={candidate.submitted_at ? new Date(candidate.submitted_at).toLocaleString() : "—"} />
          <MiniStat label="Duration" value={candidate.started_at && candidate.submitted_at ? getTimeDiff(candidate.started_at, candidate.submitted_at) : "—"} />
          <MiniStat label="Integrity" value={`${integrityScore}/100`} valueColor={integrityColor} />
        </div>
      </div>

      {/* Score Trend — Candidate vs Team Average */}
      {teamData && teamData.scores.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Score vs Team Average</h3>
          <div className="flex items-end gap-2 h-32">
            {teamData.scores.map((s, idx) => {
              const isCurrentCandidate = s.candidate === (candidate.candidate_name || candidate.candidate_email.split("@")[0]);
              const barHeight = Math.max((s.score / 100) * 100, 4);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 mb-1">{s.score.toFixed(0)}%</span>
                  <div className="w-full bg-gray-700 rounded-t relative" style={{ height: "100px" }}>
                    <div
                      className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${isCurrentCandidate ? "bg-blue-500" : "bg-gray-500"}`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-[9px] mt-1 truncate w-full text-center ${isCurrentCandidate ? "text-blue-400 font-bold" : "text-gray-500"}`}>
                    {s.candidate.slice(0, 6)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-gray-400">Team Avg: <strong className="text-white">{teamData.average_score}%</strong></span>
            <span className="text-gray-400">This candidate: <strong className={scoreColor}>{score.toFixed(0)}%</strong></span>
            <span className={`font-medium ${score >= teamData.average_score ? "text-green-400" : "text-red-400"}`}>
              {score >= teamData.average_score ? "↑" : "↓"} {Math.abs(score - teamData.average_score).toFixed(0)}% {score >= teamData.average_score ? "above" : "below"} avg
            </span>
          </div>
        </div>
      )}

      {/* Question-level Timing */}
      {questionTimings.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">⏱ Question-level Timing</h3>
          <div className="space-y-2">
            {questionTimings.map((qt, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{qt.type === "code" ? "💻" : "🎬"}</span>
                  <span className="text-sm text-gray-300">{qt.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">Time spent: <strong className="text-white">{qt.duration}</strong></span>
                  {qt.score !== null && (
                    <span className={`text-xs font-bold ${(qt.score ?? 0) >= 70 ? "text-green-400" : (qt.score ?? 0) >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                      {qt.score?.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
        {(["overview", "code", "interview", "proctoring"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {tab === "overview" ? "📊 Overview" : tab === "code" ? "💻 Code" : tab === "interview" ? "🎬 Interview" : "🛡️ Proctoring"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Score Breakdown */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Performance Summary</h3>
            <div className="space-y-3">
              <ScoreBar label="Code Score" value={score} />
              <ScoreBar label="Integrity" value={integrityScore} />
              {candidate.interview_responses.length > 0 && (
                <ScoreBar label="Interview AI Score" value={candidate.interview_responses[0]?.ai_score ?? 0} />
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Activity Timeline</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {candidate.started_at && <TimelineItem time={candidate.started_at} event="Assessment started" icon="🟢" />}
              {candidate.code_submissions.map((sub, idx) => (
                <TimelineItem key={idx} time={sub.submitted_at} event={`Code submitted (${sub.language}) — ${sub.score?.toFixed(0)}%`} icon="💻" />
              ))}
              {candidate.interview_responses.map((resp, idx) => (
                <TimelineItem key={`iv-${idx}`} time={resp.submitted_at} event={`Interview recorded${resp.ai_score !== null ? ` — AI: ${resp.ai_score}%` : ""}`} icon="🎬" />
              ))}
              {candidate.submitted_at && <TimelineItem time={candidate.submitted_at} event="Assessment submitted" icon="✅" />}
              {candidate.decision && <TimelineItem time={candidate.decision.decided_at} event={`Decision: ${candidate.decision.decision} by ${candidate.decision.reviewer_email}`} icon="📋" />}
            </div>
          </div>

          {/* Decision Panel */}
          <div className="col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Decision</h3>
            {candidate.decision ? (
              <div className="flex items-center gap-4">
                <span className={`text-lg font-bold ${candidate.decision.decision === "select" ? "text-green-400" : candidate.decision.decision === "reject" ? "text-red-400" : "text-yellow-400"}`}>
                  {candidate.decision.decision.toUpperCase()}
                </span>
                <span className="text-gray-400 text-sm">by {candidate.decision.reviewer_email}</span>
                {candidate.decision.notes && <span className="text-gray-500 text-sm">— {candidate.decision.notes}</span>}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <textarea value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} placeholder="Notes (optional)" className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500" rows={1} />
                <button onClick={() => makeDecision("select")} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium">✓ Select</button>
                <button onClick={() => makeDecision("hold")} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium">⏸ Hold</button>
                <button onClick={() => makeDecision("reject")} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium">✗ Reject</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "code" && (
        <div className="space-y-4">
          {candidate.code_submissions.length === 0 ? (
            <p className="text-gray-500">No code submissions</p>
          ) : (
            candidate.code_submissions.map((sub) => (
              <div key={sub.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded font-mono">{sub.language}</span>
                    <span className="text-sm text-gray-300">{sub.question_title || `Question ${sub.question_id.slice(0, 8)}...`}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${(sub.score ?? 0) >= 70 ? "text-green-400" : "text-red-400"}`}>
                      {sub.tests_passed}/{sub.tests_total} passed ({sub.score?.toFixed(0)}%)
                    </span>
                    <span className="text-xs text-gray-500">{new Date(sub.submitted_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setExpandedCode(expandedCode === sub.id ? null : sub.id)} className="text-xs text-blue-400 hover:underline">
                    {expandedCode === sub.id ? "Hide Code ▲" : "Show Code ▼"}
                  </button>
                  <button onClick={() => setShowReference(showReference === sub.id ? null : sub.id)} className="text-xs text-purple-400 hover:underline">
                    {showReference === sub.id ? "Hide Reference ▲" : "Show Reference Solution ▼"}
                  </button>
                </div>
                {expandedCode === sub.id && (
                  <div className="mb-2">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Candidate's Solution:</p>
                    <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto max-h-[400px] overflow-y-auto font-mono border border-gray-700">
                      {sub.source_code}
                    </pre>
                  </div>
                )}
                {showReference === sub.id && (
                  <div>
                    <p className="text-[10px] text-purple-400 uppercase mb-1">Reference Solution:</p>
                    <pre className="bg-purple-900/20 rounded-lg p-4 text-sm text-purple-200 overflow-x-auto max-h-[400px] overflow-y-auto font-mono border border-purple-700/50">
                      {sub.reference_solution || "# No reference solution provided for this question.\n# Add one when creating/editing the question."}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "interview" && (
        <div className="space-y-4">
          {candidate.interview_responses.length === 0 ? (
            <p className="text-gray-500">No interview responses</p>
          ) : (
            candidate.interview_responses.map((resp, idx) => (
              <div key={resp.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-300">Response {idx + 1}</span>
                  <div className="flex items-center gap-3">
                    {resp.ai_score !== null && (
                      <span className={`font-bold ${resp.ai_score >= 50 ? "text-green-400" : "text-red-400"}`}>AI Score: {resp.ai_score}%</span>
                    )}
                    <span className="text-xs text-gray-500">{new Date(resp.submitted_at).toLocaleString()}</span>
                  </div>
                </div>
                {resp.transcription ? (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-2">📝 Transcription:</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{resp.transcription}</p>
                  </div>
                ) : (
                  <p className="text-xs text-yellow-400">⏳ Transcription processing...</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "proctoring" && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Proctoring Flags ({candidate.proctoring.total_flags})</h3>
            <span className={`text-sm font-bold ${integrityColor}`}>Integrity: {integrityScore}/100</span>
          </div>
          {candidate.proctoring.flags.length === 0 ? (
            <p className="text-green-400 text-sm">✅ No suspicious activity detected</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {candidate.proctoring.flags.map((flag, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-900 rounded border-l-4 border-l-red-500">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                      flag.severity === "critical" ? "bg-red-900 text-red-300" :
                      flag.severity === "high" ? "bg-orange-900 text-orange-300" :
                      flag.severity === "medium" ? "bg-yellow-900 text-yellow-300" :
                      "bg-gray-700 text-gray-300"
                    }`}>{flag.severity}</span>
                    <span className="text-sm text-gray-300">{flag.description}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(flag.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${valueColor || "text-gray-200"}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-bold text-gray-200">{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function TimelineItem({ time, event, icon }: { time: string; event: string; icon: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-gray-300">{event}</p>
        <p className="text-xs text-gray-500">{new Date(time).toLocaleString()}</p>
      </div>
    </div>
  );
}
