import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Database, Mail, Lock, User, Briefcase, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState('analyst');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email || !password) {
      setValidationError('Please fill in all required credentials.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, workspaceName || undefined, role);
      }
      navigate('/dashboard');
    } catch (err) {
      // API validation errors are managed and updated by AuthContext state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (loginTab: boolean) => {
    setIsLogin(loginTab);
    setValidationError(null);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-mesh-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass-card p-8 rounded-2xl border border-brand-border">
        {/* Branding header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-slate-950/60 border border-brand-border flex items-center justify-center">
            <Database className="h-7 w-7 text-brand-teal" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">Datalyze AI</h2>
          <p className="mt-2 text-xs text-slate-400">
            {isLogin ? 'Intelligent data diagnostics & profiling' : 'Register a multi-tenant client workspace'}
          </p>
        </div>

        {/* Login/Signup Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-lg border border-brand-border/40">
          <button
            onClick={() => handleTabChange(true)}
            className={`py-2 text-xs font-semibold rounded-md transition-all ${
              isLogin ? 'bg-brand-teal text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabChange(false)}
            className={`py-2 text-xs font-semibold rounded-md transition-all ${
              !isLogin ? 'bg-brand-teal text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Workspace
          </button>
        </div>

        {/* Toast Error Bulletin */}
        {(validationError || error) && (
          <div className="bg-brand-rose/10 border border-brand-rose/30 rounded-lg p-3.5 flex items-start space-x-3 text-xs text-brand-rose animate-pulse">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{validationError || error}</span>
          </div>
        )}

        {/* Input credentials Form */}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {/* Email address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-brand-border rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-brand-border rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
              />
            </div>
          </div>

          {/* Registration specific fields */}
          {!isLogin && (
            <>
              {/* Workspace name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400" htmlFor="workspaceName">
                  Workspace Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <input
                    id="workspaceName"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Acme Analytics"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-brand-border rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
                  />
                </div>
              </div>

              {/* Security Roles */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400" htmlFor="role">
                  Tenant Role
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-brand-border rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all"
                  >
                    <option value="analyst" className="bg-brand-bg text-white">Analyst (Upload / View)</option>
                    <option value="manager" className="bg-brand-bg text-white">Manager (Run Healing)</option>
                    <option value="admin" className="bg-brand-bg text-white">Administrator (Full Control)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-medium text-xs rounded-lg shadow-glow focus:outline-none transition-all duration-200"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Provisions Account'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
