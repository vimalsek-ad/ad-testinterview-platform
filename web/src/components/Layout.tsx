import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<any>(null);
  const [newSubmissions, setNewSubmissions] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get("/api/v1/auth/me");
        setUser(res.data);
        // Check for new submissions since last visit
        const lastVisit = localStorage.getItem("last_dashboard_visit");
        if (lastVisit) {
          try {
            const analyticsRes = await api.get("/api/v1/admin/analytics/candidates");
            const candidates = analyticsRes.data.candidates || [];
            const newCount = candidates.filter((c: any) =>
              c.submitted_at && new Date(c.submitted_at) > new Date(lastVisit)
            ).length;
            setNewSubmissions(newCount);
          } catch { /* ignore */ }
        }
        localStorage.setItem("last_dashboard_visit", new Date().toISOString());
      } catch {
        navigate("/login");
      }
    }
    loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const navItems = [
    { path: "/dashboard", label: "Overview", icon: "📊" },
    { path: "/teams", label: "Teams", icon: "👥" },
    { path: "/questions", label: "Questions", icon: "📝" },
    { path: "/assessments", label: "Assessments", icon: "📋" },
  ];

  const getInitials = (name: string) => {
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  if (!user) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Header — Alter Domus style */}
      <header className="bg-[#1a2332] text-white h-14 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* AD Logo */}
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#e85d3a"/>
              <path d="M12 2L2 7l10 5 10-5L12 2z" fill="#f47c5c"/>
            </svg>
            <span className="font-semibold text-lg tracking-tight">
              alter<span className="font-bold">Domus</span>
            </span>
          </div>
          <span className="text-gray-400 mx-2">|</span>
          <span className="font-semibold text-sm tracking-wide uppercase text-gray-300">AD Hire</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              document.documentElement.classList.toggle("light-theme");
              localStorage.setItem("theme", document.documentElement.classList.contains("light-theme") ? "light" : "dark");
            }}
            className="text-gray-400 hover:text-white text-sm p-1.5 rounded hover:bg-gray-700"
            title="Toggle theme"
          >
            🌓
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#2a3a4a] flex items-center justify-center text-xs font-bold text-gray-300">
              {getInitials(user.display_name)}
            </div>
            <span className="text-sm text-gray-300">{user.display_name}</span>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-[#111827] border-r border-gray-700 flex flex-col">
          {/* Team/Org Section */}
          <div className="px-4 py-4 border-b border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Platform</p>
            <p className="font-semibold text-white text-sm mt-1">AD Hire</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  location.pathname === item.path
                    ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.path === "/dashboard" && newSubmissions > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {newSubmissions}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Bottom info */}
          <div className="px-4 py-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.is_platform_admin ? "Platform Admin" : "Team Member"}
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
