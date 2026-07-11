import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  TrendingUp, 
  FileText, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Plus, 
  RefreshCw, 
  Loader2, 
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

interface ReportItem {
  id: number;
  workspace_id: number;
  file_path: string;
  created_at: string;
}

export const InsightsView: React.FC = () => {
  const { activeWorkspaceId, workspaces } = useWorkspace();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Accordion state (expanded insight IDs)
  const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});

  // Generate Report Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [reportFormat, setReportFormat] = useState<'PDF' | 'PPTX'>('PPTX');
  const [reportTitle, setReportTitle] = useState<string>('Workspace Analysis Report');
  const [generating, setGenerating] = useState<boolean>(false);

  const fetchInsightsAndReports = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': activeWorkspaceId
      };
      const [insRes, repRes] = await Promise.all([
        axios.get<InsightItem[]>('/api/v1/insights/', { headers }),
        axios.get<ReportItem[]>('/api/v1/insights/reports', { headers })
      ]);
      setInsights(insRes.data);
      setReports(repRes.data);
    } catch (err: any) {
      console.error('Failed to load insights/reports:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch executive insights logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsightsAndReports();
  }, [activeWorkspaceId]);

  const toggleInsight = (id: number) => {
    setExpandedInsights((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to map workspace id to name
  const getWorkspaceName = (wsId: number) => {
    const ws = workspaces.find((w) => w.id === wsId);
    return ws ? ws.name : `Workspace #${wsId}`;
  };

  // Filter Insights
  const filteredInsights = useMemo(() => {
    return insights.filter((ins) => {
      // Workspace filter
      if (selectedWorkspaceFilter !== 'ALL' && ins.workspace_id.toString() !== selectedWorkspaceFilter) {
        return false;
      }
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
  }, [insights, selectedWorkspaceFilter, startDate, endDate]);

  // Filter Reports
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      // Workspace filter
      if (selectedWorkspaceFilter !== 'ALL' && rep.workspace_id.toString() !== selectedWorkspaceFilter) {
        return false;
      }
      // Start date filter
      if (startDate && new Date(rep.created_at) < new Date(startDate)) {
        return false;
      }
      // End date filter
      if (endDate) {
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        if (new Date(rep.created_at) > endDay) {
          return false;
        }
      }
      return true;
    });
  }, [reports, selectedWorkspaceFilter, startDate, endDate]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/v1/insights/generate-report',
        {
          format: reportFormat,
          title: reportTitle,
          selected_sections: ["Data Health Scorecard", "What-If Simulation Projections", "Customer Segmentation Badges"]
        },
        { 
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Workspace-ID': activeWorkspaceId
          }
        }
      );

      // Create download link
      const blob = new Blob([response.data], {
        type: reportFormat === 'PPTX' 
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/pdf'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportTitle.replace(/\s+/g, '_')}.${reportFormat.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setShowModal(false);
      // Refresh list to show newly generated report log
      await fetchInsightsAndReports();
    } catch (err: any) {
      console.error('Report compilation failed:', err);
      alert('Failed to compile report. Ensure a dataset is active in the workspace.');
    } finally {
      setGenerating(false);
    }
  };

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
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate New Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-250 p-4 rounded-xl text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* Filter Controls Ribbon */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">Filter Workspace</label>
          <select
            value={selectedWorkspaceFilter}
            onChange={(e) => setSelectedWorkspaceFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-brand-teal cursor-pointer"
          >
            <option value="ALL">All Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id.toString()}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 focus:outline-none focus:border-brand-teal"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Historical AI Summaries Accordions */}
        <div className="lg:col-span-2 space-y-4">
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
            filteredInsights.map((insight) => {
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
                        {insight.narrative_text.slice(0, 80)}...
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

        {/* Right Side: Compiled Slide Decks & PDF Reports History */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Reports Log Archive ({filteredReports.length})
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl animate-pulse space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white border border-slate-200 p-6 rounded-xl text-center text-slate-500 text-xs">
              No compiled reports logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const filename = report.file_path.split('\\').pop()?.split('/').pop() || 'report.pptx';
                const isPptx = filename.toLowerCase().endsWith('.pptx');

                return (
                  <div 
                    key={report.id} 
                    className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between text-xs transition-all hover:border-slate-300"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
                        <FileText className={`h-4 w-4 ${isPptx ? 'text-orange-500' : 'text-blue-500'}`} />
                        <span className="truncate max-w-[160px]" title={filename}>
                          {filename}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{getWorkspaceName(report.workspace_id)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Generate Report Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 font-sans animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Compile Executive Report
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Generate a data presentation card or document and log it to this workspace history log.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-650 block">Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-teal"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-650 block">Select Presentation Format</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setReportFormat('PPTX')}
                    className={`py-3 border rounded-xl font-bold flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                      reportFormat === 'PPTX'
                        ? 'border-brand-teal bg-teal-50/10 text-brand-teal'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">PPTX</span>
                    <span className="text-[9px] font-medium text-slate-400">PowerPoint Presentation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportFormat('PDF')}
                    className={`py-3 border rounded-xl font-bold flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                      reportFormat === 'PDF'
                        ? 'border-brand-teal bg-teal-50/10 text-brand-teal'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">PDF</span>
                    <span className="text-[9px] font-medium text-slate-400">Data Quality Document</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                onClick={() => setShowModal(false)}
                disabled={generating}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold rounded-lg shadow-md transition-colors cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Compiling Report...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Build & Ingest Log</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InsightsView;
