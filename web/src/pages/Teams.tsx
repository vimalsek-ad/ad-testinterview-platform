import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: string;
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("interviewer");
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTeams();
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const res = await api.get("/api/v1/auth/me");
      setIsAdmin(res.data.is_platform_admin);
    } catch {}
  };

  const loadTeams = async () => {
    try {
      const res = await api.get("/api/v1/teams");
      setTeams(res.data);
    } catch {
      navigate("/login");
    }
  };

  const loadMembers = async (teamId: string) => {
    setSelectedTeam(teamId);
    try {
      const res = await api.get(`/api/v1/teams/${teamId}`);
      setMembers(res.data.members);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load team");
    }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/v1/teams", { name: newTeamName, description: newTeamDesc });
      setNewTeamName("");
      setNewTeamDesc("");
      setShowCreateForm(false);
      loadTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create team");
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedTeam) return;
    try {
      await api.post(`/api/v1/teams/${selectedTeam}/members`, { email: memberEmail, role: memberRole });
      setMemberEmail("");
      setShowAddMember(false);
      loadMembers(selectedTeam);
      loadTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add member");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedTeam) return;
    try {
      await api.delete(`/api/v1/teams/${selectedTeam}/members/${userId}`);
      loadMembers(selectedTeam);
      loadTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to remove member");
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team? This cannot be undone.")) return;
    try {
      await api.delete(`/api/v1/teams/${teamId}`);
      setSelectedTeam(null);
      setMembers([]);
      loadTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete team");
    }
  };

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">👥 Team Management</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            + New Team
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 rounded">
          {error}
          <button onClick={() => setError("")} className="float-right text-red-400">×</button>
        </div>
      )}

      <div className="flex max-w-6xl mx-auto p-6 gap-6">
        {/* Teams List */}
        <div className="w-1/3">
          <h2 className="text-lg font-semibold mb-3">Your Teams</h2>
          {teams.length === 0 ? (
            <p className="text-gray-400">No teams yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => loadMembers(team.id)}
                  className={`p-4 rounded-lg cursor-pointer transition ${
                    selectedTeam === team.id
                      ? "bg-blue-900/50 border border-blue-500"
                      : "bg-gray-800 hover:bg-gray-750 border border-gray-700"
                  }`}
                >
                  <h3 className="font-semibold">{team.name}</h3>
                  {team.description && <p className="text-sm text-gray-400 mt-1">{team.description}</p>}
                  <p className="text-xs text-gray-500 mt-2">{team.member_count} member{team.member_count !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Detail / Members */}
        <div className="flex-1">
          {selectedTeam ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Members</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    + Add Member
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => deleteTeam(selectedTeam)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      🗑 Delete Team
                    </button>
                  )}
                </div>
              </div>
              {members.length === 0 ? (
                <p className="text-gray-400">No members yet.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{m.display_name}</p>
                        <p className="text-sm text-gray-400">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          m.role === "team_lead" ? "bg-amber-900/50 text-amber-300 border border-amber-700" : "bg-blue-900/50 text-blue-300 border border-blue-700"
                        }`}>
                          {m.role === "team_lead" ? "👑 Team Lead" : "🎯 Interviewer"}
                        </span>
                        <button
                          onClick={() => removeMember(m.user_id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">Select a team to view members</p>
              <p className="text-sm mt-2">Or create a new team to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createTeam} className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Team</h2>
            <input
              type="text"
              placeholder="Team name (e.g., Data Engineering)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 mb-3"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 mb-4"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={addMember} className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Member</h2>
            <input
              type="email"
              placeholder="User email (must be registered)"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 mb-3"
              required
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded border border-gray-600 mb-4"
            >
              <option value="interviewer">Interviewer</option>
              <option value="team_lead">Team Lead</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddMember(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium">Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
