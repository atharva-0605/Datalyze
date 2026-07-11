import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { LayoutGrid, CheckCircle2, Play, RefreshCw } from 'lucide-react';

interface TemplateItem {
  id: number;
  name: string;
  description: string;
  sample_csv_path: string;
  default_config_json: string;
}

export const MarketplaceView: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<TemplateItem[]>('/api/v1/templates/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      setTemplates(response.data);
    } catch (err: any) {
      console.error('Failed to load marketplace templates:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch templates catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [activeWorkspaceId]);

  const handleUseTemplate = (template: any) => {
    if (!activeWorkspaceId) return;
    try {
      localStorage.setItem('locked_template', JSON.stringify({
        id: template.id,
        stringId: template.stringId,
        name: template.name,
        description: template.description,
        default_config_json: template.default_config_json
      }));
      const layoutBundle = {
        templateKey: template.stringId,
        configs: []
      };
      localStorage.setItem(`dashboard_layout_ws_${activeWorkspaceId}`, JSON.stringify(layoutBundle));
      localStorage.setItem(`active_layout_name_ws_${activeWorkspaceId}`, template.name);
      navigate('/ingestion');
    } catch (err: any) {
      console.error('Failed to lock template:', err);
      setError('Failed to select and lock template.');
    }
  };

  // Map backend templates to exactly the four enterprise profiles
  const mappedTemplates = templates.filter(t => {
    const nameLower = t.name.toLowerCase();
    return nameLower.includes('student') || nameLower.includes('delivery') || nameLower.includes('security') || nameLower.includes('retail');
  }).map(t => {
    const nameLower = t.name.toLowerCase();
    if (nameLower.includes('student')) {
      return {
        ...t,
        stringId: 'productivity_time',
        name: "Productivity & Time Optimization",
        description: "Deploys a high-density performance-velocity layout designed to track time allocation and milestone completion metrics. This template automatically configures a Radial Velocity Gauge (speedometer), a horizontal Urgency Proximity Swimlane Chart, and a smooth Focus Streak Continuity Area Chart. Included Visual Widgets: 📈 Radial Velocity Speedometer | 🏁 Horizontal Swimlane Timeline | 📊 Focus Continuity Area Line Chart"
      };
    } else if (nameLower.includes('delivery')) {
      return {
        ...t,
        stringId: 'operations_logistics',
        name: "Operational Operations & Logistics",
        description: "Deploys a wide-pane logistics overview layout designed to expose fulfillment bottlenecks and regional volume trends. This template automatically configures a Fulfillment Latency Stacked Bar Graph, a 7x24 Data Volume Heatmap Grid, and an operational Failure Distribution Donut Chart. Included Visual Widgets: 🚚 Fulfillment Latency Stacked Bar | 🗺️ 7x24 Data Volume Heatmap Grid | 🍩 Operational Failure Donut Chart"
      };
    } else if (nameLower.includes('security')) {
      return {
        ...t,
        stringId: 'compliance_audit',
        name: "Compliance & Governance Audit",
        description: "Deploys a data-heavy risk and validation auditing board layout designed to highlight system discrepancies. This template automatically configures a two-color Approval Status Stacked Column Chart, a circular Peak Event Radar Cluster Web, and a real-time Exceptions Logging Data Table. Included Visual Widgets: 🛡️ Approval Status Stacked Column | 🕸️ Peak Event Radar Cluster Web | 📋 Real-Time Exceptions Logging Data Table"
      };
    } else {
      return {
        ...t,
        stringId: 'commercial_revenue',
        name: "Commercial Revenue & Market Performance",
        description: "Deploys a balanced financial monitoring suite mapping regional fiscal streams. This template automatically configures a Branch Revenue Bar Chart, a Product Profit Combo Line/Bar Chart, a Temporal Sales Trend Area Chart, a Smart City Quantity Donut, and a Top Records Matrix Table. Included Visual Widgets: 📊 Branch Revenue Bar Chart | 📈 Product Profit Combo Line/Bar Chart | 📅 Temporal Sales Trend Area Chart | 🍩 Smart City Quantity Donut | 📋 Top Records Matrix Table"
      };
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <LayoutGrid className="h-5 w-5 text-brand-teal" />
            <span>Analytical Templates Marketplace</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Jumpstart your environment with pre-built data structures, sliders defaults, and mock visualizations.
          </p>
        </div>
        <button
          onClick={fetchTemplates}
          disabled={loading}
          className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Catalog</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl animate-pulse space-y-4">
              <div className="h-32 bg-slate-100 rounded-xl"></div>
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mappedTemplates.map((template) => {
            return (
              <div 
                key={template.id} 
                className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-brand-teal/40 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Mock Visual Chart Thumbnail Preview Box */}
                  <div className="bg-slate-50 h-36 border-b border-slate-150 relative flex items-center justify-center p-4">
                    {template.stringId === 'productivity_time' ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-teal-50 border border-teal-100 rounded-full text-brand-teal shadow-sm">
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Productivity & Time Tracker</span>
                      </div>
                    ) : template.stringId === 'operations_logistics' ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-full text-amber-550 shadow-sm">
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="3" width="15" height="13" rx="2" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Operations & Logistics Hub</span>
                      </div>
                    ) : template.stringId === 'compliance_audit' ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-full text-cyan-600 shadow-sm">
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="m9 11 2 2 4-4" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Compliance & Governance System</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 shadow-sm">
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Commercial Revenue Cockpit</span>
                      </div>
                    )}
                  </div>
 
                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center justify-between">
                      <span>{template.name}</span>
                      <span className="text-[8px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-sans uppercase font-extrabold tracking-wider">
                        {template.stringId.replace('_', ' ')}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      {template.description}
                    </p>
                    <div className="bg-white border border-slate-150 p-3.5 rounded-xl space-y-2 shadow-sm text-[10px] font-sans">
                      <span className="font-extrabold text-slate-800 block uppercase tracking-wider text-[9px]">
                        Included Visual Widgets:
                      </span>
                      {template.stringId === 'productivity_time' && (
                        <ul className="space-y-1.5 text-slate-600 font-semibold leading-relaxed">
                          <li className="flex items-center space-x-1.5">
                            <span>📈</span>
                            <span>Radial Velocity Speedometer</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>🏁</span>
                            <span>Horizontal Swimlane Timeline</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>📊</span>
                            <span>Focus Continuity Area Line Chart</span>
                          </li>
                        </ul>
                      )}
                      {template.stringId === 'operations_logistics' && (
                        <ul className="space-y-1.5 text-slate-600 font-semibold leading-relaxed">
                          <li className="flex items-center space-x-1.5">
                            <span>🚚</span>
                            <span>Fulfillment Latency Stacked Bar</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>🗺️</span>
                            <span>7x24 Data Volume Heatmap Grid</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>🍩</span>
                            <span>Operational Failure Donut Chart</span>
                          </li>
                        </ul>
                      )}
                      {template.stringId === 'compliance_audit' && (
                        <ul className="space-y-1.5 text-slate-600 font-semibold leading-relaxed">
                          <li className="flex items-center space-x-1.5">
                            <span>🛡️</span>
                            <span>Approval Status Stacked Column</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>🕸️</span>
                            <span>Peak Event Radar Cluster Web</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>📋</span>
                            <span>Real-Time Exceptions Logging Data Table</span>
                          </li>
                        </ul>
                      )}
                      {template.stringId === 'commercial_revenue' && (
                        <ul className="space-y-1.5 text-slate-600 font-semibold leading-relaxed">
                          <li className="flex items-center space-x-1.5">
                            <span>📊</span>
                            <span>Branch Revenue Bar Chart</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>📈</span>
                            <span>Product Profit Combo Line/Bar Chart</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>📅</span>
                            <span>Temporal Sales Trend Area Chart</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>🍩</span>
                            <span>Smart City Quantity Donut</span>
                          </li>
                          <li className="flex items-center space-x-1.5">
                            <span>📋</span>
                            <span>Top Records Matrix Table</span>
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-slate-55">
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Includes expected columns list</span>
                  </span>
                  <button
                    onClick={() => handleUseTemplate(template)}
                    disabled={!activeWorkspaceId}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow transition-all cursor-pointer font-sans"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Use this Template</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketplaceView;
