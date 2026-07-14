import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Question {
  id: string;
  title: string;
  difficulty: string;
}

interface Assessment {
  id: string;
  title: string;
  status: string;
}

export default function Assessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [candidateLinks, setCandidateLinks] = useState<{email: string; link: string}[]>([]);
  const navigate = useNavigate();

  // Create form
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // Assign form
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateName, setCandidateName] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const qRes = await api.get("/api/v1/questions");
      setQuestions(qRes.data);
      const aRes = await api.get("/api/v1/assessments");
      setAssessments(aRes.data);
    } catch { navigate("/login"); }
  };

  const createAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (selectedQuestions.length === 0) {
      setError("Select at least one question");
      return;
    }
    try {
      const res = await api.post("/api/v1/assessments", {
        title,
        total_time_limit_minutes: timeLimit,
        question_ids: selectedQuestions,
      });
      setShowCreate(false);
      setTitle(""); setTimeLimit(60); setSelectedQuestions([]);
      loadData(); // Reload assessments from backend
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create assessment");
    }
  };

  const assignCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssign) return;
    setError("");
    try {
      const res = await api.post(`/api/v1/assessments/${showAssign}/assign`, {
        candidate_email: candidateEmail,
        candidate_name: candidateName || undefined,
      });
      setCandidateLinks([...candidateLinks, { email: candidateEmail, link: res.data.link }]);
      setCandidateEmail(""); setCandidateName("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assign candidate");
    }
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">📋 Assessments</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          + New Assessment
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
          {error}
          <button onClick={() => setError("")} className="float-right text-red-400">×</button>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        {/* Assessments List */}
        {assessments.length > 0 && (
          <div className="space-y-3 mb-8">
            {assessments.map((a) => (
              <div key={a.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      a.status === "published" ? "bg-green-900 text-green-300" :
                      a.status === "draft" ? "bg-gray-700 text-gray-300" :
                      "bg-red-900 text-red-300"
                    }`}>{a.status}</span>
                    <span className="text-xs text-gray-500">⏱ {a.total_time_limit_minutes} min</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/review/${a.id}`)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    📊 Review
                  </button>
                  <button
                    onClick={() => { setShowAssign(a.id); setCandidateLinks([]); }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                  >
                    Assign Candidates
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Candidate Links (after assigning) */}
        {candidateLinks.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">📧 Candidate Links (share these)</h3>
            {candidateLinks.map((c, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-700/50 last:border-0">
                <span className="text-gray-300">{c.email}</span>
                <span className="text-gray-500">→</span>
                <code className="text-xs text-blue-400 bg-gray-900 px-2 py-1 rounded flex-1 truncate">{c.link}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(c.link)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-700 rounded"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}

        {assessments.length === 0 && !showCreate && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg">No assessments yet</p>
            <p className="text-sm mt-2">Create one by selecting questions and setting a time limit</p>
          </div>
        )}
      </div>

      {/* Create Assessment Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createAssessment} className="bg-gray-800 p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Assessment</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Assessment title (e.g., Senior DE — July 2026)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                required
              />
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Time Limit (minutes):</label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                  min={5}
                  max={300}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Select Questions ({selectedQuestions.length} selected):</label>
                {questions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No questions available. Create questions first.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {questions.map((q) => (
                      <label
                        key={q.id}
                        className={`flex items-center gap-3 p-3 rounded cursor-pointer transition ${
                          selectedQuestions.includes(q.id) ? "bg-blue-900/50 border border-blue-500" : "bg-gray-700 border border-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedQuestions.includes(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                          className="w-4 h-4"
                        />
                        <span className="flex-1">{q.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          q.difficulty === "easy" ? "bg-green-900 text-green-300" :
                          q.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                          "bg-red-900 text-red-300"
                        }`}>{q.difficulty}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Create & Publish</button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Candidate Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Candidate</h2>
            <form onSubmit={assignCandidate} className="space-y-3">
              <input
                type="email"
                placeholder="Candidate email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                required
              />
              <input
                type="text"
                placeholder="Candidate name (optional)"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAssign(null)} className="px-4 py-2 text-gray-400 hover:text-white">Close</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium">Assign & Get Link</button>
              </div>
            </form>
            {candidateLinks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Assigned:</p>
                {candidateLinks.map((c, idx) => (
                  <div key={idx} className="text-xs text-blue-400 mb-1 truncate">{c.email}: {c.link}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
