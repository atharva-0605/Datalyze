import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Briefcase
} from 'lucide-react';

interface InsightItem {
  id: number;
  workspace_id: number;
  upload_id: string | null;
  narrative_text: string;
  source_type: string;
  created_at: string;
}

export const InsightsView: React.FC = () => {
  const { activeWorkspaceId, activeWorkspace, workspaces } = useWorkspace();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Accordion state (expanded insight IDs)
  const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});

  const fetchInsightsAndReports = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      const targetWorkspaceId = activeWorkspace?.dbId || activeWorkspaceId;
      const insRes = await axios.get<InsightItem[]>(`/api/v1/insights/?workspace_id=${targetWorkspaceId}`, { headers });
      setInsights(insRes.data);
    } catch (err: any) {
      console.error('Failed to load insights:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch executive insights logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInsights([]);
    fetchInsightsAndReports();
  }, [activeWorkspaceId, activeWorkspace]);

  const toggleInsight = (id: number) => {
    setExpandedInsights((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to map workspace id to name
  const getWorkspaceName = (wsId: number) => {
    const ws = workspaces.find((w) => w.dbId === wsId || w.id === wsId);
    return ws ? ws.name : `Workspace #${wsId}`;
  };

  // Filter Insights
  const filteredInsights = useMemo(() => {
    return insights.filter((ins) => {
      // Start date filter
      if (startDate && new Date(ins.created_at) < new Date(startDate)) {
        return false;
      }
      // End date filter
      if (endDate) {
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        if (new Date(ins.created_at) > endDay) {
          return false;
        }
      }
      return true;
    });
  }, [insights, startDate, endDate]);





  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-brand-teal" />
            <span>Executive Insights & Reports Hub</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Review historical plain-English business narratives and compile new corporate slide decks.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchInsightsAndReports}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* Filter Controls Ribbon */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-brand-teal"
          />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 focus:outline-none focus:border-brand-teal"
          />
        </div>
      </div>

      {/* Main Grid: Left (Insights), Right (Reports List) */}
      <div className="space-y-4">
        
        {/* Left Side: Historical AI Summaries Accordions */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Historic Narrative Insights ({filteredInsights.length})
          </h3>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-slate-200 p-6 rounded-xl animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-500 text-xs">
              No historical AI insights found matching the filters.
            </div>
          ) : (
            filteredInsights.slice(0, 1).map((insight) => {
              const isExpanded = !!expandedInsights[insight.id];
              return (
                <div 
                  key={insight.id} 
                  className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden transition-all duration-200"
                >
                  <div 
                    onClick={() => toggleInsight(insight.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <Briefcase className="h-3 w-3" />
                        <span>{getWorkspaceName(insight.workspace_id)}</span>
                        <span>•</span>
                        <span>{insight.source_type}</span>
                      </div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug line-clamp-1">
                        {insight.narrative_text.slice(0, 50)}...
                      </h4>
                    </div>
                    <div className="flex items-center space-x-3 text-slate-400">
                      <span className="text-[10px] font-semibold">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4 text-xs font-sans">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Full Plain-English Narrative Summary
                        </span>
                        <p className="text-slate-750 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {insight.narrative_text}
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Database Reference Key: insight_log_{insight.id}</span>
                        <span>Created: {new Date(insight.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reports archive list end */}
    </div>
  );
};

export default InsightsView;
