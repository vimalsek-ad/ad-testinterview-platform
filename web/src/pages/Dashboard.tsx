import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.get("/api/v1/auth/me");
        setUser(userRes.data);
        const qRes = await api.get("/api/v1/questions");
        setQuestions(qRes.data);
      } catch {
        navigate("/login");
      }
    }
    load();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🎯 Interview Platform</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/teams")} className="text-blue-400 hover:underline text-sm">Teams</button>
          <button onClick={() => navigate("/questions")} className="text-blue-400 hover:underline text-sm">Questions</button>
          <button onClick={() => navigate("/assessments")} className="text-blue-400 hover:underline text-sm">Assessments</button>
          <span className="text-gray-400">{user.display_name} ({user.email})</span>
          <button onClick={handleLogout} className="text-red-400 hover:underline text-sm">Logout</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Question Bank</h2>
        <p className="text-gray-400 mb-6">
          {questions.length} question{questions.length !== 1 ? "s" : ""} available
        </p>

        {questions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No questions yet. Create one using the API:</p>
            <code className="text-sm text-green-400 bg-gray-900 px-4 py-2 rounded block">
              POST /api/v1/questions
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{q.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      q.difficulty === "easy" ? "bg-green-900 text-green-300" :
                      q.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                      "bg-red-900 text-red-300"
                    }`}>{q.difficulty}</span>
                    {q.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="text-gray-500 text-sm">{q.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
