import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Link2, 
  MessageSquare, 
  Mail, 
  Database, 
  FileSpreadsheet, 
  ToggleLeft, 
  ToggleRight, 
  Save, 
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
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Slack Configuration Form State
  const [slackWebhook, setSlackWebhook] = useState<string>('');
  const [slackConnected, setSlackConnected] = useState<boolean>(false);
  
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
      
      // Seed form states from backend configs
      const slack = response.data.find(i => i.type === 'SLACK');
      if (slack) {
        const conf = JSON.parse(slack.config_json);
        setSlackWebhook(conf.webhook_url || '');
        setSlackConnected(!!conf.connected);
      } else {
        setSlackWebhook('');
        setSlackConnected(false);
      }

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

  const handleSaveConfig = async (type: 'SLACK' | 'EMAIL') => {
    if (!activeWorkspaceId) return;
    setSavingType(type);
    setError(null);
    
    let configJson = '{}';
    if (type === 'SLACK') {
      configJson = JSON.stringify({ webhook_url: slackWebhook });
    } else if (type === 'EMAIL') {
      configJson = JSON.stringify({ recipient_email: emailRecipient, frequency: emailFrequency });
    }

    try {
      const existing = integrations.find(i => i.type === type);
      const isActive = existing ? existing.is_active : 1;
      const token = localStorage.getItem('token');

      await axios.post('/api/v1/integrations/', {
        type,
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
      setError(err.response?.data?.detail || 'Failed to update channel configs.');
    } finally {
      setSavingType(null);
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
    setTestingType('EMAIL');
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/integrations/trigger-digest', null, {
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
      setTestingType(null);
    }
  };

  // Helper getters
  const getIntegrationState = (type: 'SLACK' | 'EMAIL') => {
    const item = integrations.find(i => i.type === type);
    return {
      exists: !!item,
      isActive: item ? item.is_active === 1 : false,
      id: item?.id
    };
  };

  const slackState = getIntegrationState('SLACK');
  const emailState = getIntegrationState('EMAIL');

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <Link2 className="h-5 w-5 text-brand-teal" />
            <span>Workspace Integrations Hub</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Connect Slack alerts, email summaries, and analytics endpoints to coordinate automated workflows.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Card 1: Slack Alerts */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 flex items-start justify-between border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                  <MessageSquare className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 font-sans">Slack Webhook Alerts</h3>
                  <span className="text-[10px] text-slate-400">Post warnings if data health drops below 70</span>
                </div>
              </div>
              
              {slackState.exists && (
                <button
                  onClick={() => slackState.id && handleToggleActive(slackState.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {slackState.isActive ? (
                    <ToggleRight className="h-6 w-6 text-brand-teal" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
              )}
            </div>

            {/* Config Panel */}
            <div className="p-6 bg-slate-50/50 space-y-4">
              <div className="space-y-1 text-xs font-sans">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-650 block">Incoming Webhook URL</label>
                  {slackConnected && (
                    <span className="flex items-center space-x-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-teal"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSaveConfig('SLACK')}
                  disabled={savingType === 'SLACK'}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {savingType === 'SLACK' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Slack Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Email Digest Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 flex items-start justify-between border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 font-sans">Email Executive Digest</h3>
                  <span className="text-[10px] text-slate-400">Receive trailing analytics summaries</span>
                </div>
              </div>
              
              {emailState.exists && (
                <button
                  onClick={() => emailState.id && handleToggleActive(emailState.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {emailState.isActive ? (
                    <ToggleRight className="h-6 w-6 text-brand-teal" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
              )}
            </div>

            {/* Config Panel */}
            <div className="p-6 bg-slate-50/50 space-y-4">
              <div className="space-y-1 text-xs font-sans">
                <label className="font-bold text-slate-650 block">Recipient Email Address</label>
                <input
                  type="email"
                  placeholder="manager@corporate.com"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-teal"
                />
              </div>

              <div className="space-y-1 text-xs font-sans">
                <label className="font-bold text-slate-650 block">Frequency</label>
                <select
                  value={emailFrequency}
                  onChange={(e) => setEmailFrequency(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
                >
                  <option value="Daily">Daily Summary</option>
                  <option value="Weekly">Weekly Digest</option>
                  <option value="Monthly">Monthly Analytics</option>
                </select>
              </div>

              <div className="flex justify-between items-center pt-2">
                {emailState.isActive ? (
                  <button
                    onClick={handleTestEmailDigest}
                    disabled={testingType === 'EMAIL'}
                    className="flex items-center space-x-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    {testingType === 'EMAIL' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 fill-current text-slate-400" />
                    )}
                    <span>Trigger Digest Now</span>
                  </button>
                ) : (
                  <div></div>
                )}
                
                <button
                  onClick={() => handleSaveConfig('EMAIL')}
                  disabled={savingType === 'EMAIL'}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {savingType === 'EMAIL' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Email Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Power BI Template Export */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-start space-x-3 opacity-90">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
              <Database className="h-5 w-5 text-amber-500" />
            </div>
            <div className="space-y-1 font-sans">
              <h3 className="text-xs font-black text-slate-800">Power BI Desktop Exporter</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Automatically formats layouts, simulation coefficients, and forecasts parameters to fit our widescreen reporting template (.PBIX).
              </p>
              <div className="pt-2 text-[9px] font-bold text-slate-450 uppercase tracking-wider">
                Status: Built-in Active Channel
              </div>
            </div>
          </div>

          {/* Card 4: Google Sheets Importer (Placeholder) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-start space-x-3 opacity-60">
            <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="space-y-1 font-sans">
              <h3 className="text-xs font-black text-slate-400">Google Sheets Connection</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Stream cells data directly from active cloud sheets parameters into workspace segments.
              </p>
              <div className="pt-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Status: Coming Soon
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default IntegrationsView;
