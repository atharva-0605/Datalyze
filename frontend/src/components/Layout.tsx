import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  LayoutDashboard,
  UploadCloud,
  Settings,
  LogOut,
  Database,
  User,
  Menu,
  X,
  Plus,
  Trash2,
  Activity,
  TrendingUp,
  LayoutGrid,
  GraduationCap,
  Link2,
  Compass
} from 'lucide-react';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { activeWorkspaceId, workspaces, setActiveWorkspaceId, createWorkspace, deleteWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { name: 'User Guide', path: '/guide', icon: Compass },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Marketplace', path: '/marketplace', icon: LayoutGrid },
    { name: 'Data Ingestion', path: '/ingestion', icon: UploadCloud },
    { name: 'Workspace Health', path: '/health', icon: Activity },
    { name: 'Insights', path: '/insights', icon: TrendingUp },
    { name: 'Integrations', path: '/integrations', icon: Link2 },
    { name: 'Learning Hub', path: '/academy', icon: GraduationCap },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20 sticky top-0">
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6 text-brand-teal" />
          <span className="font-bold text-lg tracking-wider text-slate-900">Datalyze AI</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-slate-500 hover:text-slate-800 focus:outline-none"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:relative md:flex flex-col w-64 bg-white border-r border-slate-200 z-30 transition-transform duration-300 ease-in-out`}
      >
        {/* Brand Header */}
        <div className="hidden md:flex items-center space-x-2 px-6 py-5 border-b border-slate-200">
          <Database className="h-7 w-7 text-brand-teal animate-pulse" />
          <span className="font-bold text-xl tracking-wider text-slate-900">Datalyze AI</span>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 rounded-l-none'
                    : 'text-slate-700 hover:text-blue-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Health status heartbeat */}
        <div className="p-4 border-t border-slate-200 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Engine Liveness</span>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-600 font-bold uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container View */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 z-10 sticky top-0 hidden md:flex">
          {/* Workspace Switcher select dropdown */}
          <div className="flex items-center space-x-2">
            <label htmlFor="workspace-select" className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Workspace:
            </label>
            <select
              id="workspace-select"
              value={activeWorkspaceId || ''}
              onChange={(e) => {
                setActiveWorkspaceId(e.target.value ? Number(e.target.value) : null);
              }}
              className="bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-teal transition-all duration-200 cursor-pointer"
            >
              {workspaces.length === 0 && (
                <option value="">No Workspaces Found</option>
              )}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (ID: {w.id})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                const name = prompt("Enter new workspace name:");
                if (name && name.trim()) {
                  try {
                    await createWorkspace(name.trim());
                  } catch (err) {
                    alert("Failed to create workspace. Please check console.");
                  }
                }
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg border border-blue-600 transition-all duration-200"
              title="Create New Workspace"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                if (activeWorkspaceId === null) return;
                if (window.confirm("Are you sure you want to delete this workspace and all its data?")) {
                  try {
                    const newWorkspaces = await deleteWorkspace(activeWorkspaceId);
                    if (newWorkspaces && newWorkspaces.length > 0) {
                      setActiveWorkspaceId(newWorkspaces[0].id);
                    } else {
                      setActiveWorkspaceId(null);
                    }
                  } catch (err) {
                    alert("Failed to delete workspace. Please verify owner credentials.");
                  }
                }
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-lg border border-rose-600 transition-all duration-200"
              title="Delete Active Workspace"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5">
              <div className="bg-slate-50 rounded-full p-1.5 border border-slate-200">
                <User className="h-4 w-4 text-brand-teal" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 leading-none">Analyst Account</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">{user?.email || 'guest@datalyze.ai'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Viewport content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
};
