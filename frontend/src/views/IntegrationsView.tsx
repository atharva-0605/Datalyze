import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Link2, 
  Mail, 
  ToggleLeft, 
  ToggleRight, 
  Send, 
  Loader2, 
  RefreshCw,
  Play
} from 'lucide-react';

interface IntegrationConfig {
  id?: number;
  workspace_id?: number;
  type: 'SLACK' | 'EMAIL';
  config_json: string;
  is_active: number;
}

export const IntegrationsView: React.FC = () => {
  const { activeWorkspaceId } = useWorkspace();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Email Configuration Form State
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailFrequency, setEmailFrequency] = useState<string>('Weekly');

  const fetchIntegrations = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<IntegrationConfig[]>('/api/v1/integrations/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      setIntegrations(response.data);

      const email = response.data.find(i => i.type === 'EMAIL');
      if (email) {
        const conf = JSON.parse(email.config_json);
        setEmailRecipient(conf.recipient_email || '');
        setEmailFrequency(conf.frequency || 'Weekly');
      } else {
        setEmailRecipient('');
        setEmailFrequency('Weekly');
      }
    } catch (err: any) {
      console.error('Failed to load integrations:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch integrations configs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [activeWorkspaceId]);

  const handleSaveConfig = async () => {
    if (!activeWorkspaceId) return;
    setSaving(true);
    setError(null);
    
    const configJson = JSON.stringify({ recipient_email: emailRecipient, frequency: emailFrequency });
    const existing = integrations.find(i => i.type === 'EMAIL');
    const isActive = existing ? existing.is_active : 1;

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/integrations/', {
        type: 'EMAIL',
        config_json: configJson,
        is_active: isActive
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      await fetchIntegrations();
    } catch (err: any) {
      console.error('Failed to save integration config:', err);
      setError(err.response?.data?.detail || 'Failed to update email configs.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (intId: number) => {
    if (!activeWorkspaceId) return;
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/v1/integrations/${intId}/toggle`, null, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      await fetchIntegrations();
    } catch (err: any) {
      console.error('Failed to toggle integration:', err);
      setError(err.response?.data?.detail || 'Failed to update active state.');
    }
  };

  const handleTestEmailDigest = async () => {
    if (!activeWorkspaceId) return;
    setTesting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/integrations/trigger-digest', { frequency: emailFrequency }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      alert('Email digest successfully dispatched to background task!');
    } catch (err: any) {
      console.error('Failed to trigger email digest:', err);
      setError(err.response?.data?.detail || 'Trigger failed. Configure and enable email integration first.');
    } finally {
      setTesting(false);
    }
  };

  const emailItem = integrations.find(i => i.type === 'EMAIL');
  const emailExists = !!emailItem;
  const emailActive = emailItem ? emailItem.is_active === 1 : false;
  const emailId = emailItem?.id;

  return (
    <div className="space-y-8 max-w-2xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <Link2 className="h-5 w-5 text-brand-teal" />
            <span>Workspace Integrations Hub</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Configure executive summaries, reports, and Trailing Analytics summaries sent automatically.
          </p>
        </div>
        <button
          onClick={fetchIntegrations}
          disabled={loading}
          className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Status</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl text-xs text-rose-800 font-medium font-sans">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-md animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 rounded w-12"></div>
          </div>
          <div className="h-10 bg-slate-100 rounded w-full"></div>
          <div className="h-10 bg-slate-100 rounded w-full"></div>
          <div className="h-10 bg-slate-200 rounded w-1/4 self-end"></div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Mail className="h-6 w-6 text-blue-500" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <h3 className="text-sm font-black text-slate-800">Email Executive Digest</h3>
                  {emailActive ? (
                    <span className="flex items-center space-x-1 text-[9px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 border border-emerald-250 px-2.5 py-0.5 rounded-full select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>ACTIVE AUTOMATION</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-250 px-2.5 py-0.5 rounded-full select-none">
                      <span>UNCONFIGURED</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Receive trailing analytics and diagnostics summary reports directly in your inbox</p>
              </div>
            </div>
            
            {emailExists && (
              <button
                onClick={() => emailId && handleToggleActive(emailId)}
                className="text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                title={emailActive ? "Deactivate Automation" : "Activate Automation"}
              >
                {emailActive ? (
                  <ToggleRight className="h-7 w-7 text-brand-teal" />
                ) : (
                  <ToggleLeft className="h-7 w-7" />
                )}
              </button>
            )}
          </div>

          <div className="space-y-5 pt-4 border-t border-slate-100">
            <div className="space-y-2 text-xs font-sans">
              <label className="font-bold text-slate-650 block">Recipient Email Address</label>
              <input
                type="email"
                placeholder="manager@corporate.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2 text-xs font-sans">
              <label className="font-bold text-slate-650 block">Digest Frequency</label>
              <select
                value={emailFrequency}
                onChange={(e) => setEmailFrequency(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-semibold"
              >
                <option value="Daily">Daily Summary</option>
                <option value="Weekly">Weekly Digest</option>
                <option value="Monthly">Monthly Analytics</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              {emailActive ? (
                <button
                  onClick={handleTestEmailDigest}
                  disabled={testing}
                  className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current text-slate-400" />
                  )}
                  <span>Trigger Digest Now</span>
                </button>
              ) : (
                <div />
              )}
              
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Save Email Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsView;
