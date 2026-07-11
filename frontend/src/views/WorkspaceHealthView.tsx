import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { Activity, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface DriftLog {
  id: number;
  upload_id: string;
  column_name: string;
  mean_value: number | null;
  std_dev_value: number | null;
  cardinality: number;
  drift_status: 'STABLE' | 'WARNING' | 'DRIFTED';
  p_value: number | null;
  created_at: string;
}

export const WorkspaceHealthView: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<DriftLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDriftHistory = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const targetWorkspaceId = activeWorkspace.dbId || activeWorkspace.id;
      const response = await axios.get<DriftLog[]>(`/api/v1/workspace/${targetWorkspaceId}/drift-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': String(targetWorkspaceId)
        }
      });
      setLogs(response.data);
    } catch (err: any) {
      console.error('Failed to fetch drift history:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load liveness monitor logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriftHistory();
  }, [activeWorkspace]);

  // Group logs by upload run context
  const groupedRuns = useMemo(() => {
    const runsMap: Record<string, { timestamp: string; items: DriftLog[] }> = {};
    
    logs.forEach((log) => {
      if (!runsMap[log.upload_id]) {
        runsMap[log.upload_id] = {
          timestamp: log.created_at,
          items: []
        };
      }
      runsMap[log.upload_id].items.push(log);
    });

    // Convert map to sorted list
    return Object.entries(runsMap)
      .map(([uploadId, val]) => {
        // Evaluate global status of this run
        let status: 'STABLE' | 'WARNING' | 'DRIFTED' = 'STABLE';
        const hasDrift = val.items.some((i) => i.drift_status === 'DRIFTED');
        const hasWarning = val.items.some((i) => i.drift_status === 'WARNING');
        
        if (hasDrift) {
          status = 'DRIFTED';
        } else if (hasWarning) {
          status = 'WARNING';
        }

        return {
          uploadId,
          timestamp: val.timestamp,
          status,
          items: val.items
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2">
            <Activity className="h-5 w-5 text-brand-teal" />
            <span>Workspace Health & Data Drift Monitor</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Tracks distribution drift deviations across successive dataset uploads using Kolmogorov-Smirnov statistical tests.
          </p>
        </div>
        <button
          onClick={fetchDriftHistory}
          disabled={loading || !activeWorkspace}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer font-sans"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Monitor</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : groupedRuns.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
            <CheckCircle className="h-6 w-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-700">No profile logs recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Upload successive datasets inside the Ingestion panel. The drift monitor will analyze profile deviations relative to your baseline.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
          {groupedRuns.map((run) => {
            const isDrifted = run.status === 'DRIFTED';
            const isWarning = run.status === 'WARNING';
            
            const badgeColor = isDrifted 
              ? 'bg-rose-500 border-rose-500' 
              : isWarning 
                ? 'bg-amber-500 border-amber-500' 
                : 'bg-emerald-500 border-emerald-500';

            const runLabel = isDrifted 
              ? 'Significant Drift Anomaly Detected' 
              : isWarning 
                ? 'Minor Structural Shift' 
                : 'Stable Data Profile';

            return (
              <div key={run.uploadId} className="relative">
                {/* Timeline node dot indicator */}
                <div className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ${badgeColor}`}></div>
                
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Ingested Run: {run.uploadId}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 leading-tight">
                        {runLabel}
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {new Date(run.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {isDrifted && (
                    <div className="bg-rose-50 border border-rose-150 p-3.5 rounded-xl flex items-start space-x-2 text-rose-800 text-xs leading-relaxed">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <span className="font-bold">Retraining Recommended: </span>
                        A statistically significant shift in distribution features has occurred. Your existing K-Means segmentation clusters and narrative forecast projections should be refreshed.
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Feature Profiles & Deviation Indicators
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {run.items.map((item) => {
                        const isColDrifted = item.drift_status === 'DRIFTED';
                        const isColWarning = item.drift_status === 'WARNING';
                        
                        const statusTag = isColDrifted 
                          ? 'bg-rose-50 text-rose-700' 
                          : isColWarning 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-slate-50 text-slate-500';

                        return (
                          <div 
                            key={item.id} 
                            className={`border rounded-xl p-3.5 flex items-center justify-between text-xs transition-colors duration-150 ${
                              isColDrifted 
                                ? 'border-rose-200 bg-rose-50/20' 
                                : isColWarning 
                                  ? 'border-amber-200 bg-amber-50/20' 
                                  : 'border-slate-200 hover:bg-slate-50/30'
                            }`}
                          >
                            <div className="space-y-1">
                              <span className="font-bold text-slate-850 block">{item.column_name}</span>
                              <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                                {item.mean_value !== null && (
                                  <span>Mean: {item.mean_value.toFixed(2)}</span>
                                )}
                                <span>Card: {item.cardinality}</span>
                                {item.p_value !== null && (
                                  <span>p-value: {item.p_value.toFixed(4)}</span>
                                )}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${statusTag}`}>
                              {item.drift_status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkspaceHealthView;
