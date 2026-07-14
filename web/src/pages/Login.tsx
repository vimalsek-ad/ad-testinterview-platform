import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Role = "platform_admin" | "team_lead" | "interviewer";

const roleInfo: Record<Role, { icon: string; title: string; description: string; responsibilities: string[] }> = {
  platform_admin: {
    icon: "🛡️",
    title: "Platform Admin",
    description: "Full system access. Manages teams, users, and platform settings.",
    responsibilities: [
      "Create and manage teams",
      "Assign team leads and interviewers",
      "View all assessments across teams",
      "Platform-wide analytics and reporting",
      "Manage user accounts and permissions",
    ],
  },
  team_lead: {
    icon: "👑",
    title: "Team Lead",
    description: "Manages assessments and reviews for their team.",
    responsibilities: [
      "Create questions and assessments for the team",
      "Assign candidates to assessments",
      "Review candidate submissions and scores",
      "Make hiring decisions (Select / Hold / Reject)",
      "View team analytics and proctoring reports",
      "Add/remove team members",
    ],
  },
  interviewer: {
    icon: "🎯",
    title: "Interviewer",
    description: "Reviews candidates and provides feedback.",
    responsibilities: [
      "Review assigned candidate submissions",
      "View code, interview responses, and AI scores",
      "Add review notes and recommendations",
      "View proctoring flags for candidates",
      "Access team question bank",
    ],
  },
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("team_lead");
  const [expandedRole, setExpandedRole] = useState<Role | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegister) {
        await api.post("/api/v1/auth/register", { email, password, display_name: name });
      }
      const res = await api.post("/api/v1/auth/login", { email, password });
      localStorage.setItem("token", res.data.access_token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1623]">
      {/* Header */}
      <header className="bg-[#1a2332] h-14 flex items-center px-8">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#e85d3a"/>
            <path d="M12 2L2 7l10 5 10-5L12 2z" fill="#f47c5c"/>
          </svg>
          <span className="font-semibold text-lg text-white tracking-tight">
            alter<span className="font-bold">Domus</span>
          </span>
          <span className="text-gray-500 mx-2">|</span>
          <span className="font-semibold text-sm tracking-wide uppercase text-gray-400">AD Hire</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl flex gap-8">
          {/* Left — Role Selection */}
          <div className="flex-1 hidden md:block">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to AD Hire</h2>
            <p className="text-gray-400 text-sm mb-6">Enterprise Interview & Assessment Platform</p>

            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Select your role to sign in</p>

            <div className="space-y-3">
              {(Object.keys(roleInfo) as Role[]).map((role) => {
                const info = roleInfo[role];
                const isSelected = selectedRole === role;
                const isExpanded = expandedRole === role;

                return (
                  <div key={role} className="rounded-xl overflow-hidden">
                    {/* Role Card */}
                    <div
                      onClick={() => setSelectedRole(role)}
                      className={`p-4 cursor-pointer transition border ${
                        isSelected
                          ? "bg-blue-900/30 border-blue-600"
                          : "bg-gray-800/50 border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div>
                            <p className={`font-semibold text-sm ${isSelected ? "text-blue-300" : "text-gray-200"}`}>
                              {info.title}
                            </p>
                            <p className="text-xs text-gray-400">{info.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="w-3 h-3 bg-blue-500 rounded-full" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRole(isExpanded ? null : role);
                            }}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
                          >
                            {isExpanded ? "▲" : "▼"} Info
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Responsibilities */}
                    {isExpanded && (
                      <div className="bg-gray-800 border-x border-b border-gray-700 px-5 py-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Roles & Responsibilities</p>
                        <ul className="space-y-1.5">
                          {info.responsibilities.map((r, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — Login Form */}
          <div className="w-full md:w-[380px]">
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-full mb-4">
                  <span>{roleInfo[selectedRole].icon}</span>
                  <span className="text-xs text-gray-300 font-medium">{roleInfo[selectedRole].title}</span>
                </div>
                <h1 className="text-xl font-bold text-white">
                  {isRegister ? "Create Account" : "Sign In"}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {isRegister ? "Register to get started" : "Enter your credentials"}
                </p>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Vimal S"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email</label>
                  <input
                    type="email"
                    placeholder="you@alterdomus.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    required
                  />
                </div>

                {/* Mobile role selector */}
                <div className="md:hidden">
                  <label className="text-xs text-gray-400 mb-1 block">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as Role)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
                  >
                    <option value="platform_admin">🛡️ Platform Admin</option>
                    <option value="team_lead">👑 Team Lead</option>
                    <option value="interviewer">🎯 Interviewer</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-sm"
                >
                  {isRegister ? "Create Account" : "Sign In"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">
                  {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    onClick={() => { setIsRegister(!isRegister); setError(""); }}
                    className="text-blue-400 hover:underline font-medium"
                  >
                    {isRegister ? "Sign In" : "Register"}
                  </button>
                </p>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-600 mt-6">
              Powered by Alter Domus · AD Hire Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
