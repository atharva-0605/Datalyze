import React, { useState, useRef } from 'react';
import { useDatasets, Dataset, HealResponse } from '../hooks/useDatasets';
import { VisualDiff } from '../components/VisualDiff';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  AlertTriangle,
  RefreshCw,
  Download,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import axios from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';

const getColFromAction = (actionStr: string): string | null => {
  const match = actionStr.match(/Column '([^']+)'/);
  return match ? match[1] : null;
};

interface AnomalyAccordionRowProps {
  action: string;
  columnName: string | null;
  datasetUuid: string;
}

const AnomalyAccordionRow: React.FC<AnomalyAccordionRowProps> = ({ action, columnName, datasetUuid }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && columnName && !explanation) {
      setLoading(true);
      try {
        const response = await axios.get(`/api/v1/datasets/${datasetUuid}/anomaly-explanations`, {
          params: { column_name: columnName }
        });
        setExplanation(response.data.explanation_text);
        setChartData(response.data.chart_data || []);
      } catch (err) {
        console.error(err);
        setExplanation("Failed to load AI root-cause diagnostics.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="border-b border-slate-200 last:border-0 bg-white">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="font-semibold text-slate-800">{action}</span>
        </div>
        {columnName ? (
          <div className="flex items-center space-x-1.5 text-slate-400">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        ) : null}
      </button>

      {isOpen && columnName && (
        <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 animate-fadeIn">
          {loading ? (
            <div className="flex items-center space-x-2 py-4 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-brand-teal" />
              <span>Analyzing correlation root causes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-2">
              <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-brand-teal uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Root-Cause Detective Narrative</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-xs">
                  {explanation}
                </p>
              </div>

              {chartData.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Anomaly Concentration Map
                  </span>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <XAxis dataKey="category" hide />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ fontSize: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          labelStyle={{ fontWeight: 'bold' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#0ea5e9" 
                          strokeWidth={2} 
                          dot={{ r: 3, fill: '#0ea5e9' }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                  <span className="text-[8px] text-slate-400 text-center block">
                    Anomaly frequency distribution by Category
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type IngestionMode = 'UPLOADING' | 'DIAGNOSTICS' | 'HEALED' | 'ALIGNMENT';

interface AlignmentItem {
  detected_header: string;
  mapped_header: string;
  confidence_score: number;
  confidence_rating: 'HIGH' | 'MEDIUM' | 'LOW';
  historical: boolean;
}

export const IngestionView: React.FC = () => {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { uploadDataset, healDataset, generateReport, uploadProgress, downloadHealedDataset, loading, error } = useDatasets();
  
  const [mode, setMode] = useState<IngestionMode>('UPLOADING');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedDataset, setUploadedDataset] = useState<Dataset | null>(null);
  const [healedData, setHealedData] = useState<HealResponse | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preprocessing config options states
  const [dropDuplicates, setDropDuplicates] = useState(false);
  const [fillMissing, setFillMissing] = useState(false);

  // Schema Mapper States
  const [alignmentSuggestions, setAlignmentSuggestions] = useState<AlignmentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [schemaChecking, setSchemaChecking] = useState<boolean>(false);

  // Locked Template State
  const [lockedTemplate, setLockedTemplate] = useState<any>(() => {
    const saved = localStorage.getItem('locked_template');
    return saved ? JSON.parse(saved) : null;
  });

  const TARGET_COLUMNS = [
    'Invoice_ID', 'Branch', 'City', 'Customer_Type', 'Gender', 'Product_Line',
    'Unit_Price', 'Quantity', 'Tax_5', 'Total_Revenue', 'Date', 'Time',
    'Payment', 'COGS', 'Gross_Margin_Percentage', 'Gross_Income', 'Rating'
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setSchemaChecking(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const previewRes = await axios.post('/api/v1/schema/preview-headers', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });

      const headers = previewRes.data.headers;

      const response = await axios.post('/api/v1/schema/analyze', {
        uploaded_columns: headers,
        target_columns: TARGET_COLUMNS
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });

      const suggestions = response.data.suggestions as AlignmentItem[];
      const needsAlignment = suggestions.some((s) => s.confidence_score < 1.0);

      if (needsAlignment) {
        setAlignmentSuggestions(suggestions);
        setMode('ALIGNMENT');
      } else {
        const dataset = await uploadDataset(file, false, false, undefined, lockedTemplate?.id);
        setUploadedDataset(dataset);
        setMode('DIAGNOSTICS');
      }
    } catch (err) {
      console.error('Schema analysis failed, falling back to upload:', err);
      try {
        const dataset = await uploadDataset(file, false, false, undefined, lockedTemplate?.id);
        setUploadedDataset(dataset);
        setMode('DIAGNOSTICS');
      } catch (uploadErr) {
        console.error('Fallback upload failed:', uploadErr);
      }
    } finally {
      setSchemaChecking(false);
    }
  };

  const handleConfirmAlignment = async () => {
    if (!selectedFile) return;
    setSchemaChecking(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/schema/confirm', {
        mappings: alignmentSuggestions
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        }
      });

      const mappingsMap: Record<string, string> = {};
      alignmentSuggestions.forEach((s) => {
        if (s.detected_header !== s.mapped_header) {
          mappingsMap[s.detected_header] = s.mapped_header;
        }
      });

      const dataset = await uploadDataset(
        selectedFile,
        false,
        false,
        JSON.stringify(mappingsMap),
        lockedTemplate?.id
      );
      if (dataset && lockedTemplate) {
        localStorage.setItem(`dataset_template_${dataset.uuid}`, lockedTemplate.stringId);
      }
      setUploadedDataset(dataset);
      setMode('DIAGNOSTICS');
    } catch (err) {
      console.error('Alignment confirmation failed:', err);
    } finally {
      setSchemaChecking(false);
    }
  };

  const triggerHeal = async () => {
    if (!uploadedDataset) return;
    try {
      const result = await healDataset(uploadedDataset.uuid);
      if (result && lockedTemplate) {
        localStorage.setItem(`dataset_template_${result.dataset_uuid}`, lockedTemplate.stringId);
      }
      setHealedData(result);
      setMode('HEALED');
    } catch (err) {
      console.error('Healing execution failed:', err);
    }
  };

  const handleProceedToDashboard = () => {
    if (!healedData) return;
    localStorage.setItem('selected_dataset_uuid', healedData.dataset_uuid);
    if (lockedTemplate) {
      localStorage.setItem('healed_template_config', lockedTemplate.default_config_json);
      if (activeWorkspaceId) {
        localStorage.setItem(`active_layout_name_ws_${activeWorkspaceId}`, lockedTemplate.name);
        const layoutBundle = {
          templateKey: lockedTemplate.stringId,
          configs: []
        };
        localStorage.setItem(`dashboard_layout_ws_${activeWorkspaceId}`, JSON.stringify(layoutBundle));
        localStorage.setItem(`dataset_template_${healedData.dataset_uuid}`, lockedTemplate.stringId);
      }
    }
    localStorage.removeItem('locked_template');
    setLockedTemplate(null);
    navigate('/dashboard');
  };

  const triggerReportDownload = async () => {
    if (!uploadedDataset) return;
    const targetUuid = healedData ? healedData.dataset_uuid : uploadedDataset.uuid;
    try {
      await generateReport(targetUuid, 'Datalyze AI - Dataset Diagnostics Report');
    } catch (err) {
      console.error('Report downloading failed:', err);
    }
  };

  const resetUploader = () => {
    setMode('UPLOADING');
    setUploadedDataset(null);
    setHealedData(null);
  };

  // Helper to generate the column diff mapping for `<VisualDiff />`
  const getColumnsDiff = () => {
    const diff: Record<string, any> = {};
    if (!uploadedDataset || !uploadedDataset.health_report) return diff;
    
    const originalCols = uploadedDataset.health_report.columns;
    
    Object.keys(originalCols).forEach((col) => {
      const orig = originalCols[col];
      const isCoerced = healedData ? healedData.changes_made.types_coerced.includes(col) : false;
      
      diff[col] = {
        originalType: orig.type,
        originalMissing: orig.missing_count,
        originalMismatch: orig.mismatch_count,
        healedType: isCoerced ? 'float64' : orig.type,
        healedMissing: 0,
        healedMismatch: 0,
      };
    });
    
    return diff;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Ingestion Engine</h1>
          <p className="text-xs text-slate-500 mt-1">Upload and audit your spreadsheet files instantly</p>
        </div>
        {mode !== 'UPLOADING' && (
          <button
            onClick={resetUploader}
            className="flex items-center space-x-1.5 text-xs text-brand-teal hover:underline font-medium cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Upload New File</span>
          </button>
        )}
      </div>

      {lockedTemplate && (
        <div className="bg-blue-50 border border-blue-200 p-4.5 rounded-2xl shadow-sm text-xs text-blue-800 font-medium font-sans flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>Template Locked: Please upload your custom dataset matching the <strong>{lockedTemplate.name}</strong> format.</span>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('locked_template');
              setLockedTemplate(null);
            }}
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-4 cursor-pointer text-[10px] uppercase tracking-wider bg-blue-100/50 border border-blue-200 px-2 py-1 rounded-lg"
          >
            Clear Lock
          </button>
        </div>
      )}

      {/* Mode 1: File UPLOADER dropzone */}
      {mode === 'UPLOADING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Left/Middle Dropzone (2/3 width) */}
            <div className="md:col-span-2 flex">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white p-12 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 flex-1 flex flex-col justify-center items-center ${
                  dragActive
                    ? 'border-brand-teal bg-blue-50/10 scale-[1.01]'
                    : 'border-slate-300 hover:border-brand-teal/60 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                />
                <div className="mx-auto h-16 w-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mb-4">
                  <UploadCloud className="h-8 w-8 text-brand-teal" />
                </div>
                <h3 className="text-md font-semibold text-slate-800">Drag & drop your files here</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                  Supports CSV, Excel (.xlsx, .xls) and JSON formats up to 500MB
                </p>
                <button
                  type="button"
                  className="mt-6 px-4 py-2 bg-slate-50 text-xs font-bold text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Browse Files
                </button>
              </div>
            </div>

            {/* Right Options Panel (1/3 width) */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Advanced Data Diagnostics & Healing Configurations
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Configure preprocessing pipeline rules applied to your dataset during ingestion.
                </p>
                
                <div className="space-y-4 mt-6">
                  <label className="flex items-start space-x-3 text-xs text-slate-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dropDuplicates}
                      onChange={(e) => setDropDuplicates(e.target.checked)}
                      className="rounded bg-white border-slate-300 text-brand-teal focus:ring-0 mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Auto-Drop Duplicate Rows</span>
                      <span className="text-[10px] text-slate-450">Removes duplicate observations to prevent analytics skew.</span>
                    </div>
                  </label>
                  
                  <label className="flex items-start space-x-3 text-xs text-slate-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fillMissing}
                      onChange={(e) => setFillMissing(e.target.checked)}
                      className="rounded bg-white border-slate-300 text-brand-teal focus:ring-0 mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Impute Missing Values</span>
                      <span className="text-[10px] text-slate-450">Fills empty cells using mean/mode columns criteria.</span>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg text-[9px] text-slate-455 leading-relaxed">
                Tip: Enabling these features runs pre-processing on-the-fly, giving you a cleaned dataset instantly.
              </div>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress > 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 shadow-sm">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-teal" />
                  <span>Streaming dataset file...</span>
                </span>
                <span className="text-brand-teal">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-brand-teal h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* API Errors */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 flex items-start space-x-3 text-xs text-rose-600">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Mode: ALIGNMENT Interceptor panel */}
      {mode === 'ALIGNMENT' && (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center space-x-1.5 font-sans">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                <span>Schema Layout Alignment Required</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                Some columns do not match the expected dataset schema format. Please verify matches before ingestion.
              </p>
            </div>
            <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded text-[10px] font-bold font-sans">
              Unmapped Headers Caught
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-150">
            <div className="bg-slate-50 p-3 grid grid-cols-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Detected Unrecognized Header</span>
              <span className="text-center">Confidence Match</span>
              <span className="text-right">Canonical System Attribute Mapping</span>
            </div>

            {alignmentSuggestions.map((item, index) => {
              const badgeColor = item.confidence_rating === 'HIGH'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : item.confidence_rating === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-250';

              return (
                <div key={index} className="p-3.5 grid grid-cols-3 items-center text-xs text-slate-700 font-sans">
                  <span className="font-mono font-bold text-slate-900">{item.detected_header}</span>
                  
                  <div className="flex justify-center">
                    <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
                      {item.confidence_rating} ({Math.round(item.confidence_score * 100)}%)
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <select
                      value={item.mapped_header}
                      onChange={(e) => {
                        const updated = [...alignmentSuggestions];
                        updated[index].mapped_header = e.target.value;
                        setAlignmentSuggestions(updated);
                      }}
                      className="bg-white border border-slate-300 text-xs text-slate-700 rounded px-2.5 py-1 focus:outline-none focus:border-brand-teal max-w-[200px] cursor-pointer"
                    >
                      {TARGET_COLUMNS.map((target) => (
                        <option key={target} value={target}>
                          {target}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 font-sans">
            <button
              onClick={resetUploader}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel Upload
            </button>
            <button
              onClick={handleConfirmAlignment}
              disabled={schemaChecking}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
            >
              {schemaChecking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm Schema Matrix & Ingest</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: DIAGNOSTICS visual audit report view */}
      {mode === 'DIAGNOSTICS' && uploadedDataset && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dataset Audit Log Diagnostics</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                (uploadedDataset.health_score ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                Data Health Score: {uploadedDataset.health_score ?? 0}/100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Rows</span>
                <span className="text-lg font-black text-slate-800">{uploadedDataset.row_count ?? 0}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Columns Count</span>
                <span className="text-lg font-black text-slate-800">{uploadedDataset.column_count ?? 0}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Missing Cells</span>
                <span className="text-lg font-black text-slate-800">
                  {uploadedDataset.health_report?.summary.missing_cells ?? 0} ({uploadedDataset.health_report?.summary.missing_percentage ?? 0}%)
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Duplicate Rows</span>
                <span className="text-lg font-black text-slate-800">
                  {uploadedDataset.health_report?.summary.duplicate_rows ?? 0} ({uploadedDataset.health_report?.summary.duplicate_percentage ?? 0}%)
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quality Issues & Action Items (Click to view AI Root-Cause Diagnostic)
              </span>
              <div className="space-y-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-slate-50/50 shadow-sm">
                {uploadedDataset.health_report?.suggested_actions.map((act, index) => {
                  const colName = getColFromAction(act);
                  return (
                    <AnomalyAccordionRow
                      key={index}
                      action={act}
                      columnName={colName}
                      datasetUuid={uploadedDataset.uuid}
                    />
                  );
                })}
                {uploadedDataset.health_report?.suggested_actions.length === 0 && (
                  <div className="p-4 text-xs text-slate-400 italic">No health issues detected in source dataset.</div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={triggerHeal}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/60 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
              >
                {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Auto-Heal Dataset (Impute & Clean)</span>
              </button>
              <button
                onClick={triggerReportDownload}
                className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Health PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: HEALED visual diff representation */}
      {mode === 'HEALED' && healedData && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cleansing Report summary</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                Health Restored: {healedData.new_health_score}/100
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Duplicate Rows Removed:</span>
                <span className="text-md font-black text-slate-800">{healedData.changes_made.duplicates_removed}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Imputed Columns:</span>
                <span className="text-md font-black text-slate-800">{Object.keys(healedData.changes_made.columns_imputed).length}</span>
              </div>
            </div>

            {healedData.new_health_score === 100 && (
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl text-xs text-emerald-800 font-medium font-sans flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Perfect Health! The dataset has been successfully cleansed and all quality violations have been resolved.</span>
              </div>
            )}

            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visual Schema Quality Diff</span>
              <VisualDiff 
                originalScore={uploadedDataset?.health_score || 0}
                healedScore={healedData.new_health_score}
                filename={uploadedDataset?.filename || ''}
                duplicatesRemoved={healedData.changes_made.duplicates_removed}
                columnsImputed={healedData.changes_made.columns_imputed}
                typesCoerced={healedData.changes_made.types_coerced}
                columnsDiff={getColumnsDiff()} 
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => downloadHealedDataset(healedData.dataset_uuid, healedData.healed_filename)}
                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Cleaned File</span>
              </button>
              <button
                onClick={triggerReportDownload}
                className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Final PDF</span>
              </button>
              {healedData.new_health_score === 100 && (
                <button
                  onClick={handleProceedToDashboard}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.01] cursor-pointer"
                >
                  <span>Proceed to Dashboard{lockedTemplate ? ` with ${lockedTemplate.name}` : ''}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngestionView;
