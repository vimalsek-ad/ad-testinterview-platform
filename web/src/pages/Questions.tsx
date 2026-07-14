import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Question {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  tags: string[];
  supported_languages: string[];
  description: string;
}

interface TestCase {
  id: string;
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  order_index: number;
  time_limit_ms: number;
  memory_limit_mb: number;
}

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddTestCase, setShowAddTestCase] = useState(false);
  const navigate = useNavigate();

  // Create question form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [tags, setTags] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["python"]);
  const [questionType, setQuestionType] = useState<"coding" | "interview">("coding");
  const [maxDuration, setMaxDuration] = useState(180); // seconds for interview

  // Test case form state
  const [tcInput, setTcInput] = useState("");
  const [tcOutput, setTcOutput] = useState("");
  const [tcHidden, setTcHidden] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    try {
      const res = await api.get("/api/v1/questions");
      setQuestions(res.data);
    } catch { navigate("/login"); }
  };

  const loadQuestionDetail = async (id: string) => {
    setSelectedQ(id);
    try {
      const res = await api.get(`/api/v1/questions/${id}`);
      setQuestionDetail(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load question");
    }
  };

  const createQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/v1/questions", {
        title,
        description,
        difficulty,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        supported_languages: questionType === "coding" ? selectedLanguages : [],
        type: questionType,
      });
      setTitle(""); setDescription(""); setDifficulty("medium"); setTags("");
      setSelectedLanguages(["python"]); setQuestionType("coding");
      setShowCreateForm(false);
      loadQuestions();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create question");
    }
  };

  const addTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQ) return;
    setError("");
    try {
      await api.post(`/api/v1/questions/${selectedQ}/test-cases`, {
        input_data: tcInput,
        expected_output: tcOutput,
        is_hidden: tcHidden,
      });
      setTcInput(""); setTcOutput(""); setTcHidden(false);
      setShowAddTestCase(false);
      loadQuestionDetail(selectedQ);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add test case");
    }
  };

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">📝 Question Bank</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          + New Question
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
          {error}
          <button onClick={() => setError("")} className="float-right text-red-400">×</button>
        </div>
      )}

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Questions List */}
        <div className="w-[35%]">
          <h2 className="text-lg font-semibold mb-3">{questions.length} Question{questions.length !== 1 ? "s" : ""}</h2>
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                onClick={() => loadQuestionDetail(q.id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  selectedQ === q.id
                    ? "bg-blue-900/50 border border-blue-500"
                    : "bg-gray-800 hover:bg-gray-750 border border-gray-700"
                }`}
              >
                <h3 className="font-semibold">{q.title}</h3>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    q.type === "coding" ? "bg-blue-900 text-blue-300" : "bg-purple-900 text-purple-300"
                  }`}>{q.type === "coding" ? "💻 coding" : "🎬 interview"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    q.difficulty === "easy" ? "bg-green-900 text-green-300" :
                    q.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
                    "bg-red-900 text-red-300"
                  }`}>{q.difficulty}</span>
                  {q.tags?.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{tag}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Languages: {q.supported_languages?.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Question Detail + Test Cases */}
        <div className="flex-1">
          {questionDetail ? (
            <>
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h2 className="text-xl font-bold mb-2">{questionDetail.title}</h2>
                <pre className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mt-3">
                  {questionDetail.description}
                </pre>
              </div>

              {/* Test Cases — only for coding questions */}
              {questionDetail.type === "coding" && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">
                      Test Cases ({questionDetail.test_cases?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowAddTestCase(true)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      + Add Test Case
                    </button>
                  </div>

                  <div className="space-y-3">
                    {questionDetail.test_cases?.map((tc: TestCase, idx: number) => (
                      <div key={tc.id} className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-300">
                            Test Case #{idx + 1}
                          </span>
                          <div className="flex gap-2">
                            {tc.is_hidden ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-orange-900 text-orange-300">Hidden</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">Visible</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Input:</p>
                            <pre className="bg-gray-900 px-3 py-2 rounded text-sm text-green-300">{tc.input_data}</pre>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Expected Output:</p>
                            <pre className="bg-gray-900 px-3 py-2 rounded text-sm text-blue-300">{tc.expected_output}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Interview question info */}
              {questionDetail.type === "interview" && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">🎬 Interview Response Settings</h3>
                  <p className="text-gray-400 text-sm">Candidate will record a video response (webcam + audio) for this question.</p>
                  <p className="text-gray-400 text-sm mt-2">No test cases needed — response is evaluated by AI scoring or human review.</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">Select a question to view details</p>
              <p className="text-sm mt-2">Or create a new question</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Question Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createQuestion} className="bg-gray-800 p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Question</h2>
            <div className="space-y-3">
              {/* Question Type Selector */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionType("coding")}
                  className={`flex-1 py-3 rounded font-medium text-sm ${
                    questionType === "coding"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  💻 Coding Question
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionType("interview")}
                  className={`flex-1 py-3 rounded font-medium text-sm ${
                    questionType === "interview"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  🎬 Interview Question
                </button>
              </div>

              <input
                type="text"
                placeholder={questionType === "coding" ? "Question title (e.g., Two Sum)" : "Question title (e.g., Explain CAP Theorem)"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                required
              />
              <textarea
                placeholder={questionType === "coding"
                  ? "Description — include examples, constraints, input/output format"
                  : "Interview prompt — what should the candidate explain or demonstrate?"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                rows={6}
                required
              />
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <input
                type="text"
                placeholder="Tags (comma-separated, e.g., arrays, system-design)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
              />

              {/* Coding-specific: Language selector */}
              {questionType === "coding" && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Supported Languages (select one or more):</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "python", label: "Python" },
                      { id: "javascript", label: "JavaScript" },
                      { id: "java", label: "Java" },
                      { id: "cpp", label: "C++" },
                      { id: "c", label: "C" },
                      { id: "go", label: "Go" },
                      { id: "ruby", label: "Ruby" },
                      { id: "rust", label: "Rust" },
                      { id: "typescript", label: "TypeScript" },
                      { id: "csharp", label: "C#" },
                    ].map((lang) => (
                      <label
                        key={lang.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
                          selectedLanguages.includes(lang.id)
                            ? "bg-blue-900/50 border border-blue-500 text-blue-300"
                            : "bg-gray-700 border border-gray-600 text-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLanguages.includes(lang.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLanguages([...selectedLanguages, lang.id]);
                            } else {
                              setSelectedLanguages(selectedLanguages.filter((l) => l !== lang.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Interview-specific: Duration */}
              {questionType === "interview" && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Max Response Duration (seconds):</label>
                  <input
                    type="number"
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600"
                    min={30}
                    max={600}
                  />
                  <p className="text-xs text-gray-500 mt-1">Candidate records a video response (webcam + audio). Default: 3 minutes.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Test Case Modal */}
      {showAddTestCase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={addTestCase} className="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Add Test Case</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Input (what gets passed as stdin):</label>
                <textarea
                  placeholder="e.g., 2 7 11 15\n9"
                  value={tcInput}
                  onChange={(e) => setTcInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 font-mono text-sm"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Expected Output:</label>
                <textarea
                  placeholder="e.g., 0 1"
                  value={tcOutput}
                  onChange={(e) => setTcOutput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 font-mono text-sm"
                  rows={2}
                  required
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tcHidden}
                  onChange={(e) => setTcHidden(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">Hidden test case (candidate won't see this)</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowAddTestCase(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium">Add Test Case</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
