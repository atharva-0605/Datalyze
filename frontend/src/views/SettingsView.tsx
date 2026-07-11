import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Save, Loader2, CheckCircle2, UserCheck, UserPlus, Trash2 } from 'lucide-react';

interface Member {
  id: number;
  email: string;
  role: string;
}

export const SettingsView: React.FC = () => {
  const { activeWorkspaceId, workspaces, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Invite states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Find active workspace details
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Populate workspace name input
  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceName(activeWorkspace.name);
    }
  }, [activeWorkspace, activeWorkspaceId]);

  // Fetch workspace members list
  const fetchMembers = async () => {
    if (!activeWorkspaceId) return;
    setLoadingMembers(true);
    try {
      const response = await axios.get<Member[]>(`/api/v1/workspaces/${activeWorkspaceId}/members`);
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch workspace members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeWorkspaceId]);

  // Save workspace name rename action
  const handleSaveWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || !activeWorkspaceId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      await axios.put(`/api/v1/workspaces/${activeWorkspaceId}`, { name: workspaceName.trim() });
      await refreshWorkspaces();
      setStatusMessage({ type: 'success', text: 'Workspace name updated successfully.' });
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      setStatusMessage({ type: 'error', text: 'Failed to update workspace name. Unauthorized or connection error.' });
    } finally {
      setSaving(false);
    }
  };

  // Invite member form submit action
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspaceId) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      await axios.post(`/api/v1/workspaces/${activeWorkspaceId}/invites`, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteEmail('');
      setInviteStatus({ type: 'success', text: `Successfully invited ${inviteEmail.trim()} to this workspace.` });
      await fetchMembers();
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      const detail = error.response?.data?.detail || 'Colleague user email not found or unauthorized.';
      setInviteStatus({ type: 'error', text: detail });
    } finally {
      setInviting(false);
    }
  };

  // Revoke member membership action
  const handleRevokeMembership = async (memberId: number) => {
    if (!activeWorkspaceId) return;
    if (!window.confirm("Are you sure you want to revoke this user's membership?")) return;
    
    try {
      await axios.delete(`/api/v1/workspaces/${activeWorkspaceId}/members/${memberId}`);
      await fetchMembers();
    } catch (error: any) {
      console.error('Failed to revoke member membership:', error);
      const detail = error.response?.data?.detail || 'Failed to revoke member membership. Only workspace owner is authorized.';
      alert(detail);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Title Header Section */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <span className="bg-brand-teal text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">CONFIG</span>
          <span>WORKSPACE SETTINGS</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure corporate metadata, rename active environments, and manage team authentication permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: Rename form settings */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Shield className="h-4.5 w-4.5 text-brand-teal" />
              <span>Workspace Profile</span>
            </h3>
            
            <form onSubmit={handleSaveWorkspaceName} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
                  placeholder="Enter workspace name"
                  required
                />
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-lg text-[10px] flex items-start space-x-2 ${
                  statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !workspaceName.trim()}
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-semibold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Workspace Name</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Member table & invitation management */}
        <div className="md:col-span-2 space-y-6">
          {/* Invite Section */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2 pb-2 border-b border-slate-100">
              <UserPlus className="h-4.5 w-4.5 text-brand-teal" />
              <span>Invite Team Member</span>
            </h3>
            
            <form onSubmit={handleInviteMember} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-2 sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Colleague Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Role Assignment
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all cursor-pointer"
                >
                  <option value="admin">Admin</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-semibold text-xs rounded-lg shadow-md transition-all cursor-pointer h-[38px]"
                >
                  {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  <span>Invite Member</span>
                </button>
              </div>
            </form>

            {inviteStatus && (
              <div className={`p-3 rounded-lg text-[10px] flex items-start space-x-2 ${
                inviteStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{inviteStatus.text}</span>
              </div>
            )}
          </div>

          {/* Members Table Section */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Users className="h-4.5 w-4.5 text-brand-teal" />
              <span>Authorized Team Access</span>
            </h3>

            {loadingMembers ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 className="h-6 w-6 text-brand-teal animate-spin" />
                <p className="text-[10px] text-slate-400">Loading authorized users list...</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">User Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {members.map((member) => {
                      const isOwner = member.email === user?.email;
                      return (
                        <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-medium flex items-center space-x-2">
                            {isOwner && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center space-x-0.5">
                                <UserCheck className="h-2.5 w-2.5" />
                                <span>Owner</span>
                              </span>
                            )}
                            <span>{member.email}</span>
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
                              {member.role || 'Analyst'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="flex items-center space-x-1.5 text-[10px] font-semibold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              <span>Active</span>
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {!isOwner && (
                              <button
                                onClick={() => handleRevokeMembership(member.id)}
                                className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg border border-transparent hover:border-rose-100 hover:bg-rose-50 transition-all cursor-pointer"
                                title="Revoke Membership"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                          No authorized team members found for this workspace.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
