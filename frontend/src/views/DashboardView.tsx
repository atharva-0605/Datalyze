import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDatasets } from '../hooks/useDatasets';
import { useWorkspace } from '../context/WorkspaceContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import { MultiplayerCanvas } from '../components/MultiplayerCanvas';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  Treemap,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import {
  BarChart3,
  LineChart as LucideLineChart,
  AreaChart as LucideAreaChart,
  PieChart as LucidePieChart,
  Layers,
  Compass,
  LayoutGrid,
  Filter,
  Tv,
  Database,
  Sliders,
  Loader2,
  Trash,
  Plus,
  DollarSign,
  Percent,
  TrendingUp,
  FileText,
  ChevronRight,
  Download,
  Mic
} from 'lucide-react';

const PALETTES: Record<string, string[]> = {
  blue: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  emerald: ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
  amber: ['#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fcd34d'],
  rose: ['#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
  violet: ['#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  cyan: ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63']
};

const CHART_TYPES = [
  { name: 'area', label: 'Area Chart', icon: LucideAreaChart },
  { name: 'bar', label: 'Clustered Bar', icon: BarChart3 },
  { name: 'line', label: 'Line Chart', icon: LucideLineChart },
  { name: 'pie', label: 'Pie Chart', icon: LucidePieChart },
  { name: 'scatter', label: 'Scatter Plot', icon: Layers },
  { name: 'composed', label: 'Composed Combo', icon: Layers },
  { name: 'radar', label: 'Radar Metric', icon: Compass },
  { name: 'radialbar', label: 'Radial Bar', icon: Compass },
  { name: 'treemap', label: 'Treemap Dist', icon: LayoutGrid },
  { name: 'funnel', label: 'Funnel Stage', icon: Filter },
  { name: 'barstacked', label: 'Stacked Bar', icon: BarChart3 },
  { name: 'linestepped', label: 'Stepped Line', icon: LucideLineChart },
  { name: 'areaspline', label: 'Spline Area', icon: LucideAreaChart },
  { name: 'kagitrend', label: 'Kagi Trend', icon: LucideLineChart },
  { name: 'waterfall', label: 'Waterfall', icon: BarChart3 },
  { name: 'donut', label: 'Donut Chart', icon: LucidePieChart },
  { name: 'card', label: 'Card KPI', icon: Tv }
];

const mapIconNameToStyle = (name: string): string => {
  switch (name) {
    case 'bar':
    case 'barstacked':
    case 'waterfall':
      return 'Bar';
    case 'line':
    case 'linestepped':
    case 'kagitrend':
      return 'Line';
    case 'area':
    case 'areaspline':
      return 'Smooth Area';
    case 'radialbar':
      return 'Radial Speedometer Gauge';
    case 'pie':
    case 'donut':
      return 'Donut Ring Chart';
    case 'scatter':
      return 'Scatter-Heatmap Grid';
    case 'radar':
      return 'Radar Cluster Web';
    default:
      return 'Interactive Tabular Grid Matrix';
  }
};

const mapStyleToIconName = (style: string): string => {
  switch (style) {
    case 'Bar':
      return 'bar';
    case 'Line':
      return 'line';
    case 'Smooth Area':
      return 'area';
    case 'Radial Speedometer Gauge':
      return 'radialbar';
    case 'Donut Ring Chart':
      return 'pie';
    case 'Scatter-Heatmap Grid':
      return 'scatter';
    case 'Radar Cluster Web':
      return 'radar';
    default:
      return 'card';
  }
};

const TEMPLATE_LABELS: Record<string, string> = {
  'productivity_time': "Productivity & Time Optimization",
  'operations_logistics': "Operational Operations & Logistics",
  'compliance_audit': "Compliance & Governance Audit",
  'commercial_revenue': "Commercial Revenue & Market Performance"
};

interface Widget {
  id: string;
  title: string;
  type: string;
  xAxisColumn: string;
  yAxisColumn: string;
  xAxisKey?: string;
  yAxisKey?: string;
  showLabels: boolean;
  showGrid: boolean;
  smooth: boolean;
  colorPalette: string;
}

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { datasets, fetchDatasets, getAiSummary, getDatasetRecords } = useDatasets();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const userEmail = user?.email || 'guest@datalyze.ai';
  
  const [selectedDatasetUuid, setSelectedDatasetUuid] = useState<string>('');
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  const handleSliderTick = (growth: number, attrition: number) => {
    setGrowthRate(growth);
    setAttritionRate(attrition);
  };
  
  // Dynamic dataset records state
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);

  const activeDataset = datasets.find((d) => d.uuid === selectedDatasetUuid);

  console.log("DEBUG: Current Dataset State:", activeDataset);
  console.log("DEBUG: Current Records State:", records);

  // Widget layout catalog array
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Collapsible Right Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  interface ActiveFilter {
    key: string;
    value: any;
  }

  // Cross-Filter State Engine
  const [activeFilter, setActiveFilter] = useState<{ column: string; value: any } | null>(null);
  const [dashboardFilter, setDashboardFilter] = useState<ActiveFilter | null>(null);

  const visibleData = useMemo(() => {
    if (!dashboardFilter) return records;
    return records.filter(row => row[dashboardFilter.key] === dashboardFilter.value);
  }, [records, dashboardFilter]);

  // AI summary states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState<boolean>(false);

  // What-If Simulation Controls
  const [growthRate, setGrowthRate] = useState<number>(15);
  const [attritionRate, setAttritionRate] = useState<number>(5);

  // PowerPoint Report Builder Modal States
  const [showPptxModal, setShowPptxModal] = useState<boolean>(false);
  const [pptxSections, setPptxSections] = useState<Record<string, boolean>>({
    health: true,
    simulation: true,
    segmentation: true
  });
  const [pptxGenerating, setPptxGenerating] = useState<boolean>(false);

  // Conversational Analyst Chat Session State
  interface ChatMessage {
    sender: 'user' | 'assistant';
    text: string;
    chartType?: string;
    chartData?: any[];
  }

  const [sessionId] = useState<string>(() => `session_${Math.random().toString(36).substr(2, 9)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'assistant', text: 'DATALYZE-AI: Connection established.' },
    { sender: 'assistant', text: 'System Ready. Ask me questions about your dataset (e.g. "break down sales by city").' }
  ]);
  const [nlpQuery, setNlpQuery] = useState<string>('');
  const [nlpLoading, setNlpLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const handleVoiceQueryClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("HTML5 Web Speech API is not supported in this browser. Please use Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setNlpQuery(transcript);
        triggerNlpQueryDirectly(transcript);
      }
    };

    recognition.start();
  };

  const triggerNlpQueryDirectly = async (queryText: string) => {
    if (!queryText.trim() || !selectedDatasetUuid || !activeWorkspaceId) return;

    setMessages(prev => [...prev, { sender: 'user', text: queryText.trim() }]);
    setNlpLoading(true);

    try {
      const response = await axios.post('/api/v1/query/chat', {
        session_id: sessionId,
        message: queryText.trim()
      }, {
        headers: {
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      
      const { answer_text, data, chart_hint } = response.data;
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: answer_text,
        chartType: chart_hint,
        chartData: data
      }]);
    } catch (err: any) {
      console.error('Copilot voice query failed:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Connection error.';
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: `Error: ${errMsg}`
      }]);
    } finally {
      setNlpLoading(false);
    }
  };

  // ML & AI Narrative State Definitions
  const [forecastActive, setForecastActive] = useState<boolean>(false);
  const [forecastProjection, setForecastProjection] = useState<number[]>([]);
  const [forecastWhatIf, setForecastWhatIf] = useState<number[]>([]);
  const [forecastingLoading, setForecastingLoading] = useState<boolean>(false);
  const [whatIfSlider, setWhatIfSlider] = useState<number>(0);

  const [segmentationActive, setSegmentationActive] = useState<boolean>(false);
  const [clusterAssignments, setClusterAssignments] = useState<any[]>([]);
  const [clusteringLoading, setClusteringLoading] = useState<boolean>(false);

  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [narrativesLoading, setNarrativesLoading] = useState<boolean>(false);
  const [activeBranchFilter, setActiveBranchFilter] = useState<string | null>(null);
  const [insightsVisible, setInsightsVisible] = useState<boolean>(false);
  const [kpiLabels, setKpiLabels] = useState({ sales: "Total Sales Volume", profit: "Gross Profit", tax: "Tax (VAT 5%)" });

  // Reset forecasting, clustering, and narrative states on dataset change
  useEffect(() => {
    setForecastActive(false);
    setForecastProjection([]);
    setForecastWhatIf([]);
    setWhatIfSlider(0);
    setSegmentationActive(false);
    setClusterAssignments([]);
    setNarratives({});
    setInsightsVisible(false);
    setDashboardFilter(null);
    setKpiLabels({ sales: "Total Sales Volume", profit: "Gross Profit", tax: "Tax (VAT 5%)" });
  }, [selectedDatasetUuid]);

  // What Changed While You Were Away Digest States
  const [digestItems, setDigestItems] = useState<{ text: string; icon: string }[]>([]);
  const [showDigestBanner, setShowDigestBanner] = useState<boolean>(false);


  const fetchDigestBriefing = async () => {
    if (!activeWorkspaceId) return;
    try {
      const response = await axios.get('/api/v1/digest/');
      if (response.data && response.data.items && response.data.items.length > 0) {
        setDigestItems(response.data.items);
        setShowDigestBanner(true);
      }
    } catch (err) {
      console.error("Failed to load user digest briefing:", err);
    }
  };

  // Load registered datasets on startup and whenever activeWorkspaceId changes
  useEffect(() => {
    fetchDatasets();
    setSelectedDatasetUuid('');
    setRecords([]);
    setAiSummary(null);
    fetchDigestBriefing();
    if (activeWorkspaceId) {
      const key = `dashboard_layout_ws_${activeWorkspaceId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && parsed.templateKey) {
            setActiveTemplateId(parsed.templateKey);
            setActiveTemplateName(localStorage.getItem(`active_layout_name_ws_${activeWorkspaceId}`) || parsed.templateKey);
            if (parsed.configs && parsed.configs.length > 0) {
              setChartConfigs(parsed.configs);
            } else {
              setChartConfigs([]);
            }
            return;
          }
        } catch (e) {
          // Fallback if saved as plain template ID string
          setActiveTemplateId(saved);
          setActiveTemplateName(localStorage.getItem(`active_layout_name_ws_${activeWorkspaceId}`) || saved);
          setChartConfigs([]);
          return;
        }
      }
      // Default fallback template config block
      setActiveTemplateId('productivity_time');
      setActiveTemplateName('Productivity & Time Optimization');
      setChartConfigs([]);
    } else {
      setActiveTemplateId(null);
      setActiveTemplateName(null);
      setChartConfigs([]);
    }
  }, [activeWorkspaceId, fetchDatasets]);

  // Auto-select initial dataset when datasets catalog loads
  useEffect(() => {
    if (datasets.length > 0 && !selectedDatasetUuid) {
      const savedUuid = localStorage.getItem('selected_dataset_uuid');
      if (savedUuid && datasets.some(d => d.uuid === savedUuid)) {
        setSelectedDatasetUuid(savedUuid);
        handleDatasetSelectChange(savedUuid);
        localStorage.removeItem('selected_dataset_uuid');
      } else {
        setSelectedDatasetUuid(datasets[0].uuid);
        handleDatasetSelectChange(datasets[0].uuid);
      }
    }
  }, [datasets, selectedDatasetUuid]);

  // Seed simulation defaults from template config if available
  useEffect(() => {
    if (selectedDatasetUuid) {
      const savedConfigStr = localStorage.getItem('healed_template_config');
      if (savedConfigStr) {
        try {
          const config = JSON.parse(savedConfigStr);
          if (config.slider_growth !== undefined) {
            setGrowthRate(Math.round(config.slider_growth * 100));
          }
          localStorage.removeItem('healed_template_config');
        } catch (e) {
          console.error("Failed to parse healed template config:", e);
        }
      }
    }
  }, [selectedDatasetUuid]);

  // Fetch raw records and AI Summary on selected dataset change
  useEffect(() => {
    if (selectedDatasetUuid) {
      setRecords([]);
      setRecordsLoading(true);
      getDatasetRecords(selectedDatasetUuid)
        .then((data) => {
          setRecords(data);
        })
        .catch((err) => {
          console.error('Failed to load dataset records:', err);
        })
        .finally(() => {
          setRecordsLoading(false);
        });

      setAiSummary(null);
      setAiSummaryLoading(true);
      getAiSummary(selectedDatasetUuid)
        .then((summary) => {
          setAiSummary(summary);
        })
        .catch((err) => {
          console.error('Failed to load AI summary:', err);
          setAiSummary('Local AI engine offline. Narrative executive insights are currently unavailable.');
        })
        .finally(() => {
          setAiSummaryLoading(false);
        });
      
      // Clear filters on dataset change
      setActiveFilter(null);
      setActiveBranchFilter(null);
    }
  }, [selectedDatasetUuid, getDatasetRecords, getAiSummary]);



  // Extract all columns and filter for numeric ones
  const allColumns = useMemo(() => {
    return activeDataset?.health_report?.columns
      ? Object.keys(activeDataset.health_report.columns)
      : [];
  }, [activeDataset]);

  const datasetColumns = useMemo(() => {
    if (records.length > 0) {
      return Object.keys(records[0]);
    }
    return allColumns;
  }, [records, allColumns]);

  const numCols = useMemo(() => {
    if (!activeDataset || !activeDataset.health_report || !activeDataset.health_report.columns) {
      return [];
    }
    const cols = activeDataset.health_report.columns;
    return Object.keys(cols).filter((col) => {
      const colInfo = cols[col];
      return (
        colInfo.inferred_type === 'numeric' ||
        colInfo.type.includes('int') ||
        colInfo.type.includes('float')
      );
    });
  }, [activeDataset]);

  // Column identification maps helper
  const getColByNames = (names: string[], fallback: string) => {
    const found = allColumns.find(col => names.some(n => col.toLowerCase() === n.toLowerCase()));
    return found || fallback;
  };

  const dateCol = getColByNames(['date', 'time', 'timestamp', 'check_in_timestamp'], allColumns[3] || 'Date');





  interface CustomChartConfig {
    chartId: string;
    chartType: string;
    xAxisColumn: string;
    yAxisColumn: string;
    title?: string;
  }

  const getInitialConfigs = (key: string, columns: string[]): CustomChartConfig[] => {
    const numCol1 = columns.find(c => c.toLowerCase().includes('score') || c.toLowerCase().includes('hour') || c.toLowerCase().includes('value') || c.toLowerCase().includes('total')) || columns[0] || '';
    const numCol2 = columns.find(c => c.toLowerCase().includes('streak') || c.toLowerCase().includes('time') || c.toLowerCase().includes('qty') || c.toLowerCase().includes('quantity') || c.toLowerCase().includes('amount')) || columns[1] || '';
    const catCol1 = columns.find(c => c.toLowerCase().includes('name') || c.toLowerCase().includes('branch') || c.toLowerCase().includes('city') || c.toLowerCase().includes('category')) || columns[2] || '';
    const dateCol = columns.find(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('timestamp') || c.toLowerCase().includes('check_in')) || columns[3] || '';

    if (key === 'productivity_time') {
      return [
        { chartId: 'prod-0', chartType: 'Radial Speedometer Gauge', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Velocity Gauge Speedometer' },
        { chartId: 'prod-1', chartType: 'Bar', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Urgency Proximity Swimlane Timeline' },
        { chartId: 'prod-2', chartType: 'Smooth Area', xAxisColumn: dateCol, yAxisColumn: numCol1, title: 'Focus Streak Continuity Area Chart' },
        { chartId: 'prod-3', chartType: 'Scatter-Heatmap Grid', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Weekly Task Saturation Grid' },
        { chartId: 'prod-4', chartType: 'Radar Cluster Web', xAxisColumn: numCol1, yAxisColumn: numCol2, title: 'Task Clearance Velocity Scatter Plot' }
      ];
    }
    if (key === 'operations_logistics') {
      return [
        { chartId: 'ops-0', chartType: 'Scatter-Heatmap Grid', xAxisColumn: catCol1, yAxisColumn: numCol1, title: '7x24 Data Volume Scatter-Heatmap Grid' },
        { chartId: 'ops-1', chartType: 'Bar', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Fulfillment Target Velocity Bar' },
        { chartId: 'ops-2', chartType: 'Donut Ring Chart', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Failure Distribution Donut Chart' },
        { chartId: 'ops-3', chartType: 'Radar Cluster Web', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Courier Supply Distribution Radar' },
        { chartId: 'ops-4', chartType: 'Line', xAxisColumn: dateCol, yAxisColumn: numCol2, title: 'Fleet Turnaround Temporal Trend' }
      ];
    }
    if (key === 'compliance_audit') {
      return [
        { chartId: 'audit-0', chartType: 'Bar', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Approval Status Column Chart' },
        { chartId: 'audit-1', chartType: 'Radar Cluster Web', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Peak Event Radar Cluster Web' },
        { chartId: 'audit-2', chartType: 'Donut Ring Chart', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Risk Severity Tiered Pie Ring' },
        { chartId: 'audit-3', chartType: 'Interactive Tabular Grid Matrix', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Interactive Exceptions Data Table' },
        { chartId: 'audit-4', chartType: 'Smooth Area', xAxisColumn: dateCol, yAxisColumn: numCol1, title: 'Weekly Anomaly Stepped Area Chart' }
      ];
    }
    if (key === 'commercial_revenue') {
      return [
        { chartId: 'comm-0', chartType: 'Bar', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Total by Branch Bar Chart' },
        { chartId: 'comm-1', chartType: 'Line', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Profit & Tax Combo Chart' },
        { chartId: 'comm-2', chartType: 'Smooth Area', xAxisColumn: dateCol, yAxisColumn: numCol1, title: 'Temporal Sales Trend Area Chart' },
        { chartId: 'comm-3', chartType: 'Donut Ring Chart', xAxisColumn: catCol1, yAxisColumn: numCol2, title: 'Smart City Quantity Donut Chart' },
        { chartId: 'comm-4', chartType: 'Interactive Tabular Grid Matrix', xAxisColumn: catCol1, yAxisColumn: numCol1, title: 'Top Records Matrix Table' }
      ];
    }
    // Standard fallback configs
    return [
      { chartId: 'fallback-0', chartType: 'Bar', xAxisColumn: columns[0] || '', yAxisColumn: columns[1] || '', title: 'Custom Plot 1' },
      { chartId: 'fallback-1', chartType: 'Line', xAxisColumn: columns[0] || '', yAxisColumn: columns[1] || '', title: 'Custom Plot 2' },
      { chartId: 'fallback-2', chartType: 'Smooth Area', xAxisColumn: columns[0] || '', yAxisColumn: columns[1] || '', title: 'Custom Plot 3' },
      { chartId: 'fallback-3', chartType: 'Donut Ring Chart', xAxisColumn: columns[0] || '', yAxisColumn: columns[1] || '', title: 'Custom Plot 4' },
      { chartId: 'fallback-4', chartType: 'Interactive Tabular Grid Matrix', xAxisColumn: columns[0] || '', yAxisColumn: columns[1] || '', title: 'Custom Plot 5' }
    ];
  };

  const templateKey = useMemo(() => {
    if (activeTemplateId) {
      const id = activeTemplateId.toLowerCase().trim();
      if (id === 'productivity_time' || id.includes('student') || id.includes('productivity') || id.includes('deadline')) return 'productivity_time';
      if (id === 'operations_logistics' || id.includes('delivery') || id.includes('quick_bit') || id.includes('operations') || id.includes('logistics')) return 'operations_logistics';
      if (id === 'compliance_audit' || id.includes('security') || id.includes('auditor') || id.includes('compliance') || id.includes('governance') || id.includes('audit')) return 'compliance_audit';
      if (id === 'commercial_revenue' || id.includes('revenue') || id.includes('commercial') || id.includes('retail')) return 'commercial_revenue';
    }
    if (activeTemplateName) {
      const name = activeTemplateName.toLowerCase();
      if (name.includes('student') || name.includes('productivity') || name.includes('deadline_shoot') || name.includes('productivity_time')) return 'productivity_time';
      if (name.includes('delivery') || name.includes('quick_bit') || name.includes('operations') || name.includes('logistics')) return 'operations_logistics';
      if (name.includes('security') || name.includes('auditor') || name.includes('compliance') || name.includes('governance') || name.includes('audit')) return 'compliance_audit';
      if (name.includes('revenue') || name.includes('commercial') || name.includes('retail') || name.includes('commercial_revenue')) return 'commercial_revenue';
    }
    return 'productivity_time'; // Default fallback template string mapping
  }, [activeTemplateId, activeTemplateName]);

  const [chartConfigs, setChartConfigs] = useState<CustomChartConfig[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

  const editingConfig = useMemo(() => {
    return chartConfigs.find(c => c.chartId === selectedChartId) || null;
  }, [chartConfigs, selectedChartId]);

  // Sync / hydrate chartConfigs based on layout key or dynamic allColumns updates
  useEffect(() => {
    if (activeWorkspaceId && templateKey && allColumns.length > 0) {
      const key = `dashboard_layout_ws_${activeWorkspaceId}`;
      const saved = localStorage.getItem(key);
      let parsedConfigs: CustomChartConfig[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && parsed.configs && parsed.configs.length > 0) {
            parsedConfigs = parsed.configs;
          }
        } catch (e) {}
      }
      
      if (parsedConfigs.length > 0) {
        setChartConfigs(parsedConfigs);
      } else {
        const defaults = getInitialConfigs(templateKey, allColumns);
        setChartConfigs(defaults);
        localStorage.setItem(key, JSON.stringify({
          templateKey,
          configs: defaults
        }));
      }
    }
  }, [activeWorkspaceId, templateKey, allColumns]);

  const handleConfigUpdate = (chartId: string, updatedFields: Partial<CustomChartConfig>) => {
    const updatedConfigs = chartConfigs.map(c => {
      if (c.chartId === chartId) {
        return { ...c, ...updatedFields };
      }
      return c;
    });
    setChartConfigs(updatedConfigs);
    if (activeWorkspaceId && templateKey) {
      const key = `dashboard_layout_ws_${activeWorkspaceId}`;
      localStorage.setItem(key, JSON.stringify({
        templateKey,
        configs: updatedConfigs
      }));
    }
  };


  const totalCol = getColByNames(['total', 'sales', 'amount'], numCols[0] || 'Total');
  const taxCol = getColByNames(['tax 5%', 'tax', 'vat'], numCols[2] || 'Tax 5%');
  const profitCol = getColByNames(['gross income', 'profit', 'gross_income'], numCols[3] || 'gross income');

  // Handle explicit user dataset selection changes and initialize standard widgets
  const handleDatasetSelectChange = (uuid: string, isExplicitUserAction: boolean = false) => {
    setSelectedDatasetUuid(uuid);
    
    const selected = datasets.find((d) => d.uuid === uuid);
    
    if (selected && activeWorkspaceId) {
      const templateStr = selected.template_key || 'productivity_time';
      const cols = selected.health_report?.columns ? Object.keys(selected.health_report.columns) : [];
      const templateName = TEMPLATE_LABELS[templateStr] || templateStr;
      
      setActiveTemplateId(templateStr);
      setActiveTemplateName(templateName);
      localStorage.setItem(`active_layout_name_ws_${activeWorkspaceId}`, templateName);
      
      const defaults = getInitialConfigs(templateStr, cols);
      const matchedTemplateLayout = {
        templateKey: templateStr,
        configs: defaults
      };
      
      localStorage.setItem(`dashboard_layout_ws_${activeWorkspaceId}`, JSON.stringify(matchedTemplateLayout));
      setChartConfigs(defaults);
      
      const localNumCols = cols.filter((c) => {
        const info = selected.health_report!.columns[c];
        return (
          info.inferred_type === 'numeric' ||
          info.type.includes('int') ||
          info.type.includes('float')
        );
      });
      const firstNum = localNumCols[0] || 'Value';

      const localBranchCol = cols.find(c => c.toLowerCase() === 'branch') || cols[0] || 'Branch';
      const localProdCol = cols.find(c => c.toLowerCase() === 'product line' || c.toLowerCase() === 'product_line' || c.toLowerCase() === 'product') || cols[1] || 'Product line';
      const localCityCol = cols.find(c => c.toLowerCase() === 'city') || cols[2] || 'City';
      const localDateCol = cols.find(c => c.toLowerCase() === 'date' || c.toLowerCase() === 'time') || cols[3] || 'Date';
      
      const localTotal = localNumCols.find(c => c.toLowerCase() === 'total' || c.toLowerCase() === 'sales') || firstNum;
      const localQty = localNumCols.find(c => c.toLowerCase() === 'quantity' || c.toLowerCase() === 'qty') || firstNum;
      const localProfit = localNumCols.find(c => c.toLowerCase() === 'gross income' || c.toLowerCase() === 'profit') || firstNum;

      setWidgets([
        {
          id: 'branch',
          title: 'Total by Branch',
          type: 'bar',
          xAxisColumn: localBranchCol,
          yAxisColumn: localTotal,
          xAxisKey: localBranchCol,
          yAxisKey: localTotal,
          showLabels: true,
          showGrid: true,
          smooth: false,
          colorPalette: 'blue',
        },
        {
          id: 'product_line',
          title: 'Profit & Tax by Product Line',
          type: 'composed',
          xAxisColumn: localProdCol,
          yAxisColumn: localProfit,
          xAxisKey: localProdCol,
          yAxisKey: localProfit,
          showLabels: true,
          showGrid: true,
          smooth: false,
          colorPalette: 'amber',
        },
        {
          id: 'timeline',
          title: 'Total Sales Trend by Date',
          type: 'area',
          xAxisColumn: localDateCol,
          yAxisColumn: localTotal,
          xAxisKey: localDateCol,
          yAxisKey: localTotal,
          showLabels: false,
          showGrid: true,
          smooth: true,
          colorPalette: 'blue',
        },
        {
          id: 'city',
          title: 'Quantity by City',
          type: 'donut',
          xAxisColumn: localCityCol,
          yAxisColumn: localQty,
          xAxisKey: localCityCol,
          yAxisKey: localQty,
          showLabels: false,
          showGrid: false,
          smooth: false,
          colorPalette: 'violet',
        },
      ]);
      
      setSelectedWidgetId('branch');
    } else {
      setWidgets([]);
      setSelectedWidgetId(null);
      if (isExplicitUserAction && activeWorkspaceId) {
        setActiveTemplateName(null);
        setActiveTemplateId(null);
        localStorage.removeItem(`active_layout_name_ws_${activeWorkspaceId}`);
        localStorage.removeItem(`dashboard_layout_ws_${activeWorkspaceId}`);
      }
    }
  };

  const toggleFilter = (column: string, value: any) => {
    if (activeFilter && activeFilter.column === column && activeFilter.value === value) {
      setActiveFilter(null);
      setActiveBranchFilter(null);
    } else {
      setActiveFilter({ column, value });
      setActiveBranchFilter(String(value));
    }
  };

  // Cross-filtered records
  const filteredRecords = useMemo(() => {
    if (!activeFilter) return records;
    return records.filter(row => String(row[activeFilter.column]) === String(activeFilter.value));
  }, [records, activeFilter]);

  const branchColName = useMemo(() => {
    if (records.length === 0) return 'Branch';
    const keys = Object.keys(records[0]);
    return keys.find(k => k.toLowerCase() === 'branch' || k.toLowerCase().includes('branch') || k.toLowerCase() === 'city') || keys[0] || 'branch';
  }, [records]);

  const filteredData = useMemo(() => {
    if (!activeBranchFilter) return records;
    return records.filter(item => String(item[branchColName]) === activeBranchFilter);
  }, [records, activeBranchFilter, branchColName]);

  const totalSalesValue = useMemo(() => {
    const growthFactor = 1 + growthRate / 100;
    const attritionFactor = 1 - attritionRate / 100;
    const sum = filteredData.reduce((sum, item) => sum + (Number(item[totalCol]) || 0), 0);
    return Math.round(sum * growthFactor * attritionFactor);
  }, [filteredData, totalCol, growthRate, attritionRate]);

  const grossProfitValue = useMemo(() => {
    const growthFactor = 1 + growthRate / 100;
    const attritionFactor = 1 - attritionRate / 100;
    const sum = filteredData.reduce((sum, item) => sum + (Number(item[profitCol]) || 0), 0);
    return Math.round(sum * growthFactor * attritionFactor);
  }, [filteredData, profitCol, growthRate, attritionRate]);

  const totalTaxValue = useMemo(() => {
    const growthFactor = 1 + growthRate / 100;
    const attritionFactor = 1 - attritionRate / 100;
    const sum = filteredData.reduce((sum, item) => sum + (Number(item[taxCol]) || 0), 0);
    return Math.round(sum * growthFactor * attritionFactor);
  }, [filteredData, taxCol, growthRate, attritionRate]);

  // Widget interaction update handlers
  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
    if (selectedWidgetId === id) {
      setSelectedWidgetId(null);
    }
  };

  const updateWidgetType = (id: string, type: string) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, type } : w)));
  };

  const updateWidgetPalette = (id: string, colorPalette: string) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, colorPalette } : w)));
  };

  const updateWidgetColumns = (id: string, xAxisColumn: string, yAxisColumn: string) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, xAxisColumn, yAxisColumn, xAxisKey: xAxisColumn, yAxisKey: yAxisColumn } : w)));
  };

  const updateWidgetTitle = (id: string, title: string) => {
    // strip/trims out redundant leading/trailing double quotes
    const cleaned = title.replace(/^"+|"+$/g, '').trim();
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, title: cleaned } : w)));
  };

  const updateWidgetPresentation = (id: string, key: 'showLabels' | 'showGrid' | 'smooth', val: boolean) => {
    setWidgets(widgets.map((w) => (w.id === id ? { ...w, [key]: val } : w)));
  };

  const addCustomWidget = () => {
    const firstNum = numCols[0] || allColumns[0] || 'Value';
    const newId = `custom_${Math.random().toString(36).substr(2, 9)}`;
    const newWidget: Widget = {
      id: newId,
      title: `Custom Visual Frame #${widgets.length + 1}`,
      type: 'bar',
      xAxisColumn: allColumns[0] || 'Row',
      yAxisColumn: firstNum,
      xAxisKey: allColumns[0] || 'Row',
      yAxisKey: firstNum,
      showLabels: true,
      showGrid: true,
      smooth: false,
      colorPalette: 'cyan',
    };
    setWidgets([...widgets, newWidget]);
    setSelectedWidgetId(newId);
  };

  // 1. Fully guarded aggregation helper
  const getAggregatedChartData = (
    rawData: any[] | null | undefined,
    xAxisKey: string | null | undefined,
    yAxisKey: string | null | undefined,
    chartType: string = ''
  ): any[] => {
    // If keys or raw data frames are unconfigured or loading, return silently without triggering errors
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0 || !xAxisKey || !yAxisKey) {
      return [];
    }

    try {
      const acc: Record<string, { total: number; count: number }> = {};

      rawData.forEach((row) => {
        if (!row) return;
        
        // Defensively parse values
        const key = String(row[xAxisKey] !== undefined && row[xAxisKey] !== null ? row[xAxisKey] : 'Unknown');
        let val = 0;
        if (row[yAxisKey] !== undefined && row[yAxisKey] !== null) {
          val = typeof row[yAxisKey] === 'number' ? row[yAxisKey] : parseFloat(String(row[yAxisKey]));
          if (isNaN(val)) val = 0;
        }

        if (!acc[key]) {
          acc[key] = { total: 0, count: 0 };
        }
        acc[key].total += val;
        acc[key].count += 1;
      });

      const formatted = Object.keys(acc).map((key, idx) => {
        const record = acc[key];
        // Defensive fallback if a key resolution goes out of bounds
        if (!record) {
          return {
            name: key,
            [xAxisKey]: key,
            [yAxisKey]: 0,
            total: 0,
            count: 0,
            value: 0,
            x: idx + 1,
            y: 0,
            profit: 0,
            tax: 0,
            subject: key.slice(0, 8),
            A: 0,
            fullMark: 150,
            name_treemap: key.slice(0, 10),
            size: 10,
            waterfall_base: 0,
            waterfall_change: 0,
            waterfall_color: '#ef4444',
            Value1: 0,
            Value2: 0
          };
        }

        const totalCount = record.count || 0;
        const totalSum = record.total || 0;
        const average = totalCount > 0 ? totalSum / totalCount : 0;
        
        const isDiscrete = String(chartType).toLowerCase().includes('bar') || 
                           String(chartType).toLowerCase().includes('pie') || 
                           String(chartType).toLowerCase().includes('funnel');

        const val = isDiscrete ? totalSum : average;

        return {
          name: key,
          [xAxisKey]: key,
          [yAxisKey]: val,
          total: totalSum,
          count: totalCount,
          value: val,
          // Helper keys for other chart formats
          x: idx + 1,
          y: val,
          profit: Math.round(val * 0.8),
          tax: Math.round(val * 0.05),
          subject: key.slice(0, 8),
          A: val,
          fullMark: 150,
          name_treemap: key.slice(0, 10),
          size: Math.abs(val) || 10,
          waterfall_base: val * 0.9,
          waterfall_change: val * 0.1,
          waterfall_color: '#10b981',
          Value1: Math.round(val * 0.6),
          Value2: Math.round(val * 0.4)
        };
      });

      if (xAxisKey === dateCol) {
        return formatted.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()).slice(0, 30);
      }
      return formatted.sort((a, b) => b.value - a.value);
    } catch (err) {
      // Left completely clean and empty so no redundant messages print to console
      return [];
    }
  };

  // 2. Guarded component wrapper helper
  const getWidgetData = (widget: any) => {
    // Exit instantly and silently if fields are not fully assigned by the user yet
    if (!widget || !widget.xAxisKey || !widget.yAxisKey) {
      return [];
    }
    
    let recordsToAggregate = records;
    if (activeFilter && activeFilter.column !== widget.xAxisKey) {
      recordsToAggregate = filteredRecords;
    }
    const baseData = getAggregatedChartData(recordsToAggregate, widget.xAxisKey, widget.yAxisKey, widget.type);

    // Overlay forecasting if active
    if (forecastActive && widget.xAxisColumn === dateCol && forecastProjection.length > 0) {
      const forecastPoints = [];
      for (let i = 0; i < forecastProjection.length; i++) {
        forecastPoints.push({
          name: `P+${i + 1}`,
          [widget.xAxisKey]: `P+${i + 1}`,
          [widget.yAxisKey]: forecastProjection[i],
          'Forecast Projection': forecastProjection[i],
          'What-If Baseline': forecastWhatIf[i] || forecastProjection[i],
          value: forecastProjection[i],
          isForecast: true
        });
      }
      return [...baseData, ...forecastPoints];
    }
    return baseData;
  };

  // Render method targeting generic widgets
  const renderWidgetContent = (widget: Widget) => {
    const data = getWidgetData(widget);
    const palette = PALETTES[widget.colorPalette] || PALETTES.blue;
    const mainColor = palette[0];
    const gridColor = widget.showGrid ? "rgba(0,0,0,0.06)" : "transparent";
    const lineType = widget.smooth ? "monotone" : "linear";

    const isDimmed = (entryName: string) => {
      return activeFilter && activeFilter.column === widget.xAxisColumn && String(activeFilter.value) !== String(entryName);
    };

    switch (String(widget.type).toLowerCase()) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`areaGrad_${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={mainColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type={lineType}
                name={widget.yAxisColumn}
                dataKey="value"
                stroke={mainColor}
                fillOpacity={1}
                fill={`url(#areaGrad_${widget.id})`}
                strokeWidth={2}
                onClick={(entry: any) => {
                  if (entry && entry.activePayload) {
                    toggleFilter(widget.xAxisColumn, entry.activeLabel);
                  }
                }}
              >
                {widget.showLabels && <LabelList dataKey="value" position="top" fill="#64748b" fontSize={8} />}
              </Area>
              {forecastActive && widget.xAxisColumn === dateCol && (
                <>
                  <Area
                    type={lineType}
                    name="Forecast Projection"
                    dataKey="Forecast Projection"
                    stroke="#10b981"
                    fill="rgba(16, 185, 129, 0.1)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type={lineType}
                    name="What-If Baseline"
                    dataKey="What-If Baseline"
                    stroke="#fbbf24"
                    fill="rgba(251, 191, 36, 0.1)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="value"
                fill={mainColor}
                name={widget.yAxisColumn}
                radius={[4, 4, 0, 0]}
                onClick={(entry) => toggleFilter(widget.xAxisColumn, entry.name)}
              >
                {widget.showLabels && <LabelList dataKey="value" position="top" fill="#64748b" fontSize={8} />}
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={palette[index % palette.length]}
                    opacity={isDimmed(entry.name) ? 0.35 : 1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type={lineType}
                name={widget.yAxisColumn}
                dataKey="value"
                stroke={mainColor}
                strokeWidth={2}
                onClick={(entry: any) => {
                  if (entry && entry.activePayload) {
                    toggleFilter(widget.xAxisColumn, entry.activeLabel);
                  }
                }}
              >
                {widget.showLabels && <LabelList dataKey="value" position="top" fill="#64748b" fontSize={8} />}
              </Line>
              {forecastActive && widget.xAxisColumn === dateCol && (
                <>
                  <Line
                    type={lineType}
                    name="Forecast Projection"
                    dataKey="Forecast Projection"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type={lineType}
                    name="What-If Baseline"
                    dataKey="What-If Baseline"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
      case 'donut':
        const isDonut = String(widget.type).toLowerCase() === 'donut';
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={isDonut ? 60 : 0}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                onClick={(entry) => toggleFilter(widget.xAxisColumn, entry.name)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={palette[index % palette.length]}
                    opacity={isDimmed(entry.name) ? 0.35 : 1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid stroke={gridColor} />
              <XAxis type="number" dataKey="x" name={widget.xAxisColumn} stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis type="number" dataKey="y" name={widget.yAxisColumn} stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Scatter name="Data Nodes" data={data} fill={mainColor} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} />
              <YAxis yAxisId="left" stroke={mainColor} fontSize={9} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                yAxisId="left"
                dataKey="profit"
                fill={mainColor}
                name="Gross Income/Profit"
                barSize={20}
                radius={[4, 4, 0, 0]}
                onClick={(entry) => toggleFilter(widget.xAxisColumn, entry.name)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    opacity={isDimmed(entry.name) ? 0.35 : 1}
                    className="cursor-pointer hover:opacity-80"
                  />
                ))}
              </Bar>
              <Line yAxisId="right" type={lineType} dataKey="tax" stroke="#10b981" strokeWidth={2} name="Tax 5%" dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={8} />
              <PolarRadiusAxis stroke="#64748b" fontSize={8} />
              <Radar name={widget.yAxisColumn} dataKey="A" stroke={mainColor} fill={mainColor} fillOpacity={0.6} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'radialbar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" barSize={10} data={data.slice(0, 6)}>
              <RadialBar
                label={{ position: 'insideStart', fill: '#fff', fontSize: 8 }}
                background
                dataKey="value"
              >
                {data.slice(0, 6).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={palette[index % palette.length]}
                    opacity={isDimmed(entry.name) ? 0.35 : 1}
                  />
                ))}
              </RadialBar>
              <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
            </RadialBarChart>
          </ResponsiveContainer>
        );
      case 'treemap':
        const treemapData = data.map(item => ({
          name: item.name_treemap,
          size: item.size
        }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill={mainColor}
            >
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
            </Treemap>
          </ResponsiveContainer>
        );
      case 'funnel':
        const funnelData = data.slice(0, 5).map(item => ({
          value: item.value,
          name: item.name,
          fill: palette[0]
        }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Funnel
                dataKey="value"
                data={funnelData}
                isAnimationActive
              >
                {funnelData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={palette[index % palette.length]}
                    opacity={isDimmed(entry.name) ? 0.35 : 1}
                  />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );
      case 'barstacked':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Value1" stackId="a" fill={mainColor} name="Primary Metrics" />
              <Bar dataKey="Value2" stackId="a" fill={palette[2] || '#34d399'} name="Secondary Metrics" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'linestepped':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="step" name={widget.yAxisColumn} dataKey="value" stroke={mainColor} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'areaspline':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" name={widget.yAxisColumn} dataKey="value" stroke={mainColor} fill={mainColor} fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'kagitrend':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Line type="stepAfter" name="Kagi Directional Trend" dataKey="value" stroke={mainColor} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'waterfall':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11 }} />
              <Bar dataKey="waterfall_base" stackId="a" fill="transparent" />
              <Bar dataKey="waterfall_change" stackId="a" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.waterfall_color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'card':
        const sum = data.reduce((acc, curr) => acc + (Number((curr as any)[widget.yAxisColumn]) || 0), 0);
        const avg = data.length > 0 ? Math.round(sum / data.length) : 0;
        return (
          <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Average {widget.yAxisColumn}
            </span>
            <span className="text-3xl font-black text-brand-teal tracking-tight">
              {avg.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-500 mt-2">
              Sum: {sum.toLocaleString()} | Rows: {data.length}
            </span>
          </div>
        );
      default:
        return <div className="text-center text-xs text-slate-500 py-10">Unsupported Chart View</div>;
    }
  };

  const renderWidgetHeader = (widget: Widget) => (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-4">
      <h4 className="text-xs font-bold text-slate-900 tracking-tight">{widget.title}</h4>
      <div className="flex items-center space-x-2.5">
        <button
          onClick={() => removeWidget(widget.id)}
          className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
          title="Remove Widget"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);

  const branchWidget = widgets.find(w => w.id === 'branch');
  const productLineWidget = widgets.find(w => w.id === 'product_line');
  const timelineWidget = widgets.find(w => w.id === 'timeline');
  const cityWidget = widgets.find(w => w.id === 'city');
  const customWidgets = widgets.filter(
    (w) => !['branch', 'product_line', 'timeline', 'city'].includes(w.id)
  );

  const displayCols = useMemo(() => {
    return allColumns.slice(0, 6);
  }, [allColumns]);

  // Conversational NLQ Submit Handler
  const handleNlpQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpQuery.trim() || !selectedDatasetUuid || !activeWorkspaceId) return;

    const currentQuery = nlpQuery.trim();
    setMessages(prev => [...prev, { sender: 'user', text: currentQuery }]);
    setNlpQuery('');
    setNlpLoading(true);

    try {
      const response = await axios.post('/api/v1/query/chat', {
        session_id: sessionId,
        message: currentQuery
      }, {
        headers: {
          'X-Workspace-ID': activeWorkspaceId
        }
      });
      
      const { answer_text, data, chart_hint } = response.data;
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: answer_text,
        chartType: chart_hint,
        chartData: data
      }]);
    } catch (err: any) {
      console.error('Copilot query failed:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Connection error.';
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: `Error: ${errMsg}`
      }]);
    } finally {
      setNlpLoading(false);
    }
  };
  const handleGeneratePptx = async () => {
    if (!selectedDatasetUuid || !activeWorkspaceId) return;
    
    const selectedList = Object.entries(pptxSections)
      .filter(([_, checked]) => checked)
      .map(([name]) => name);

    if (selectedList.length === 0) {
      alert("Please select at least one slide section to generate the report.");
      return;
    }

    setPptxGenerating(true);
    try {
      const response = await axios.post('/api/v1/reports/generate-presentation', {
        selected_sections: selectedList
      }, {
        headers: { 'X-Workspace-ID': activeWorkspaceId },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Executive_Presentation_${activeWorkspaceId}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowPptxModal(false);
    } catch (err: any) {
      console.error('Presentation compilation failed:', err);
      alert('Error compiling PowerPoint presentation deck: ' + (err.message || 'Server error.'));
    } finally {
      setPptxGenerating(false);
    }
  };

  // ML & AI Narrative Trigger Handlers
  const triggerForecasting = async () => {
    if (!selectedDatasetUuid || !activeWorkspaceId) return;
    setForecastingLoading(true);
    try {
      const response = await axios.post('/api/v1/analytics/forecast', {
        dataset_uuid: selectedDatasetUuid,
        target_column: totalCol,
        horizon_days: 30,
        what_if_growth: whatIfSlider
      }, {
        headers: { 'X-Workspace-ID': activeWorkspaceId }
      });
      setForecastProjection(response.data.projection);
      setForecastWhatIf(response.data.what_if_baseline);
      setForecastActive(true);
      setInsightsVisible(true);
    } catch (err) {
      console.error('Forecasting failed:', err);
      alert('Failed to execute forecast. Ensure numerical data exists.');
    } finally {
      setForecastingLoading(false);
    }
  };

  const triggerSegmentation = async () => {
    if (!selectedDatasetUuid || !activeWorkspaceId) return;
    setClusteringLoading(true);
    try {
      const response = await axios.post('/api/v1/analytics/cluster', {
        dataset_uuid: selectedDatasetUuid,
        target_column: totalCol,
        k: 3
      }, {
        headers: { 'X-Workspace-ID': activeWorkspaceId }
      });
      setClusterAssignments(response.data.assignments);
      setSegmentationActive(true);
      setInsightsVisible(true);
    } catch (err) {
      console.error('Clustering failed:', err);
      alert('Failed to execute customer segmentation.');
    } finally {
      setClusteringLoading(false);
    }
  };

  const getClusterLabelForValue = (val: any) => {
    if (!segmentationActive || !clusterAssignments || clusterAssignments.length === 0) return null;
    const num = Number(val);
    if (isNaN(num)) return null;
    const match = clusterAssignments.find(a => Math.abs(a.value - num) < 0.01);
    return match ? match.label : null;
  };

  const handleWhatIfSliderChange = (val: number) => {
    setWhatIfSlider(val);
    if (forecastActive && selectedDatasetUuid && activeWorkspaceId) {
      axios.post('/api/v1/analytics/forecast', {
        dataset_uuid: selectedDatasetUuid,
        target_column: totalCol,
        horizon_days: 30,
        what_if_growth: val
      }, {
        headers: { 'X-Workspace-ID': activeWorkspaceId }
      }).then((response: any) => {
        setForecastProjection(response.data.projection);
        setForecastWhatIf(response.data.what_if_baseline);
      }).catch((err: any) => {
        console.error('Forecasting slider update failed:', err);
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedDatasetUuid) return;
    try {
      const response = await axios.post('/api/v1/reports/generate', {
        dataset_uuid: selectedDatasetUuid,
        title: `Analytics Report - ${activeDataset?.filename}`,
        custom_notes: "Generated from the corporate Pro Sales Dashboard."
      }, {
        responseType: 'blob'
      });
      const contentType = String(response.headers['content-type'] || 'application/pdf');
      const fileExtension = contentType.includes('text/html') ? 'html' : 'pdf';
      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `sales_report_${selectedDatasetUuid}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to generate report PDF. Ensure report engine service is active.');
    }
  };

  const handleDownloadCSV = async () => {
    if (!selectedDatasetUuid || !activeWorkspaceId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/v1/dashboard/download-csv', {
        params: { dataset_uuid: selectedDatasetUuid },
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-ID': activeWorkspaceId
        },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'healed_dataset.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Failed to download healed CSV:', err);
      alert('Failed to download healed CSV: ' + (err.message || 'Server error.'));
    }
  };

  const handleRevertSimulation = async () => {
    setGrowthRate(15);
    setAttritionRate(5);
    setWhatIfSlider(0);
    setForecastActive(false);
    setForecastProjection([]);
    setForecastWhatIf([]);
    setActiveFilter(null); // clear filters too for clean revert
    setActiveBranchFilter(null);
    setKpiLabels({ sales: "Total Sales Volume", profit: "Gross Profit", tax: "Tax (VAT 5%)" });
    
    if (selectedDatasetUuid) {
      setRecordsLoading(true);
      try {
        const data = await getDatasetRecords(selectedDatasetUuid);
        setRecords(data);
      } catch (err) {
        console.error('Failed to reload dataset records:', err);
      } finally {
        setRecordsLoading(false);
      }
    }
  };

  // Fetch AI narratives when dataset and records load
  useEffect(() => {
    if (selectedDatasetUuid && activeWorkspaceId && records.length > 0) {
      setNarratives({});
      setNarrativesLoading(true);
      
      const columns_metadata: Record<string, any> = {};
      allColumns.forEach(col => {
        columns_metadata[col] = activeDataset?.health_report?.columns[col]?.type || 'object';
      });
      
      axios.post('/api/v1/analytics/narrate', {
        columns_metadata: columns_metadata,
        chart_data: records.slice(0, 10).map(r => ({
          [totalCol]: r[totalCol],
          [profitCol]: r[profitCol]
        }))
      }, {
        headers: { 'X-Workspace-ID': activeWorkspaceId }
      }).then((response: any) => {
        setNarratives({
          general: response.data.narrative
        });
      }).catch((err: any) => {
        console.error('Failed to generate narratives:', err);
        setNarratives({
          general: 'AI Insight Narrator offline. Please check LLM engine connection settings.'
        });
      }).finally(() => {
        setNarrativesLoading(false);
      });
    }
  }, [selectedDatasetUuid, activeWorkspaceId, records, allColumns, activeDataset, totalCol, profitCol]);

  if (activeDataset && recordsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 bg-white border border-slate-200 p-10 rounded-2xl shadow-sm text-center">
          <Loader2 className="h-8 w-8 text-brand-teal animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading dataset visual parameters...</p>
        </div>
      </div>
    );
  }

  if (activeDataset && (!records || records.length === 0)) {
    return (
      <div className="p-20 text-center bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto mt-20 shadow-sm">
        <h2 className="text-xl font-bold text-red-600 text-center">Dataset Loaded But No Data Records Found</h2>
        <p className="text-slate-500 text-xs mt-2 text-center">Check the backend storage folder and network console for fetch errors.</p>
      </div>
    );
  }

  const renderNarrativeAnalysisCard = () => {
    if (!insightsVisible) return null;
    return (
      <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
          <span>🤖 AI Narrative Analysis</span>
        </h5>
        {narrativesLoading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-2.5 bg-slate-200 rounded w-full"></div>
            <div className="h-2.5 bg-slate-200 rounded w-5/6"></div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
            {narratives.general || "Executive intelligence summaries will display here when analysis completes."}
          </p>
        )}
      </div>
    );
  };

  const renderDynamicChart = (config: CustomChartConfig) => {
    if (!config) return null;
    const { chartType, xAxisColumn, yAxisColumn } = config;
    
    switch (chartType) {
      case 'Radial Speedometer Gauge':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" cy="50%" innerRadius="30%" outerRadius="80%" barSize={10} 
              data={visibleData}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const clickedRow = visibleData[state.activeTooltipIndex];
                  if (clickedRow) {
                    setDashboardFilter({
                      key: xAxisColumn,
                      value: clickedRow[xAxisColumn]
                    });
                  }
                }
              }}
            >
              <RadialBar dataKey={yAxisColumn} name={yAxisColumn} fill="#3b82f6" />
              <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
              <Tooltip />
            </RadialBarChart>
          </ResponsiveContainer>
        );
      case 'Bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={visibleData}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  setDashboardFilter({
                    key: xAxisColumn,
                    value: state.activeLabel
                  });
                }
              }}
            >
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey={xAxisColumn} stroke="#94a3b8" fontSize={9} />
              <YAxis stroke="#94a3b8" fontSize={9} />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxisColumn} name={yAxisColumn} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'Line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={visibleData}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  setDashboardFilter({
                    key: xAxisColumn,
                    value: state.activeLabel
                  });
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xAxisColumn} stroke="#94a3b8" fontSize={9} />
              <YAxis stroke="#94a3b8" fontSize={9} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yAxisColumn} name={yAxisColumn} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'Smooth Area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={visibleData}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  setDashboardFilter({
                    key: xAxisColumn,
                    value: state.activeLabel
                  });
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xAxisColumn} stroke="#94a3b8" fontSize={9} />
              <YAxis stroke="#94a3b8" fontSize={9} />
              <Tooltip />
              <Area type="monotone" dataKey={yAxisColumn} name={yAxisColumn} stroke="#8b5cf6" fill="#c084fc" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'Donut Ring Chart':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={visibleData} 
                dataKey={yAxisColumn} 
                nameKey={xAxisColumn} 
                cx="50%" cy="50%" innerRadius={50} outerRadius={75} fill="#f43f5e" paddingAngle={4} label
                onClick={(data) => {
                  if (data && data.name) {
                    setDashboardFilter({
                      key: xAxisColumn,
                      value: data.name
                    });
                  }
                }}
              >
                {visibleData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PALETTES.rose[idx % PALETTES.rose.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'Scatter-Heatmap Grid':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart 
              margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const clickedRow = visibleData[state.activeTooltipIndex];
                  if (clickedRow) {
                    setDashboardFilter({
                      key: xAxisColumn,
                      value: clickedRow[xAxisColumn]
                    });
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xAxisColumn} name={xAxisColumn} stroke="#94a3b8" fontSize={9} />
              <YAxis type="number" dataKey={yAxisColumn} name={yAxisColumn} stroke="#94a3b8" fontSize={9} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name={config.title || "Scatter Details"} data={visibleData} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'Radar Cluster Web':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart 
              cx="50%" cy="50%" outerRadius="80%" 
              data={visibleData}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const clickedRow = visibleData[state.activeTooltipIndex];
                  if (clickedRow) {
                    setDashboardFilter({
                      key: xAxisColumn,
                      value: clickedRow[xAxisColumn]
                    });
                  }
                }
              }}
            >
              <PolarGrid stroke="#f1f5f9" />
              <PolarAngleAxis dataKey={xAxisColumn} stroke="#94a3b8" fontSize={8} />
              <PolarRadiusAxis stroke="#94a3b8" fontSize={8} />
              <Radar name={yAxisColumn} dataKey={yAxisColumn} stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'Interactive Tabular Grid Matrix':
        return (
          <div className="overflow-x-auto border border-slate-200 rounded-xl mt-3 max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 bg-slate-50">{xAxisColumn}</th>
                  <th className="p-3 bg-slate-50">{yAxisColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visibleData.slice(0, 15).map((row, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => setDashboardFilter({ key: xAxisColumn, value: row[xAxisColumn] })}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="p-3 truncate font-bold text-slate-900">{row[xAxisColumn]}</td>
                    <td className="p-3 font-semibold">{row[yAxisColumn]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div>Unknown chart style</div>;
    }
  };

  const renderChartCard = (index: number) => {
    const config = chartConfigs[index];
    if (!config) return null;
    const { chartId, chartType, xAxisColumn, yAxisColumn } = config;

    return (
      <div 
        key={chartId}
        onClick={() => setSelectedChartId(chartId)}
        className={`bg-white p-6 rounded-2xl border shadow-sm min-h-[380px] flex flex-col justify-between relative group transition-all duration-300 cursor-pointer ${
          selectedChartId === chartId 
            ? 'border-2 border-brand-teal ring-2 ring-brand-teal/15 bg-slate-50/20 shadow-md' 
            : 'border-slate-200 hover:border-brand-teal/40'
        }`}
      >
        {/* Settings gear icon wrapped in button */}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedChartId(chartId);
            setIsFlyoutOpen(true);
          }}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-brand-teal bg-slate-50 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 no-export flex items-center justify-center border border-slate-200"
          title="Customize Visualization Layout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>

        <div>
          {/* Typographic click targets */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h3 
              onClick={() => {
                setSelectedChartId(chartId);
                setIsFlyoutOpen(true);
              }}
              className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer hover:text-brand-teal hover:opacity-80 transition-all select-none"
            >
              <span className="h-2 w-2 rounded-full bg-brand-teal animate-pulse"></span>
              <span>{config.title || `${chartType} Visualization`}</span>
            </h3>

            {/* X and Y Axis click interactive buttons */}
            <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-medium">
              <button
                type="button"
                onClick={() => {
                  setSelectedChartId(chartId);
                  setIsFlyoutOpen(true);
                }}
                className="hover:text-brand-teal hover:bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Change X-Axis"
              >
                X: <span className="font-bold text-slate-600">{xAxisColumn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedChartId(chartId);
                  setIsFlyoutOpen(true);
                }}
                className="hover:text-brand-teal hover:bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Change Y-Axis"
              >
                Y: <span className="font-bold text-slate-600">{yAxisColumn}</span>
              </button>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center">
            {renderDynamicChart(config)}
          </div>
        </div>

        {renderNarrativeAnalysisCard()}
      </div>
    );
  };

  return (
    <div id="dashboard-reporting-canvas" className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6 pb-20 font-sans">
      
      {/* What Changed While You Were Away briefing banner */}
      {showDigestBanner && digestItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-5 py-4 mb-4 shadow-sm relative animate-fadeIn flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans no-export">
          <div className="space-y-1.5 flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 text-blue-950 font-sans">
              <span>👋 What Changed While You Were Away</span>
            </h4>
            <ul className="space-y-1 list-none pl-0">
              {digestItems.map((item, idx) => (
                <li key={idx} className="text-xs text-blue-800 flex items-center space-x-1.5 font-medium font-sans">
                  <span className="w-1.5 h-1.5 bg-blue-450 rounded-full flex-shrink-0"></span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <div className="pt-1.5">
              <button 
                onClick={() => navigate('/insights')}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline transition-colors cursor-pointer"
              >
                View Full Workspace Activity
              </button>
            </div>
          </div>
          <button 
            onClick={() => setShowDigestBanner(false)}
            className="self-start sm:self-center px-2.5 py-1 border border-blue-205 hover:bg-blue-100/80 text-blue-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer font-sans"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header Corporate sales banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span className="bg-brand-teal text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">PRO</span>
            <span>SALES DASHBOARD</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Corporate Real-Time Insights & Dynamic Cross-Filtering Engine
          </p>
        </div>

        {/* Dynamic selector & download buttons */}
        <div className="flex items-center flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-500">Workspace Dataset:</span>
            <select
              value={selectedDatasetUuid}
              onChange={(e) => handleDatasetSelectChange(e.target.value, true)}
              className="bg-white border border-slate-300 text-xs text-brand-teal font-bold rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-teal transition-all shadow-sm cursor-pointer"
            >
              <option value="">-- Select Processed Dataset --</option>
              {datasets.filter(d => d.filename.toLowerCase().startsWith('healed_')).map((d) => {
                const label = TEMPLATE_LABELS[d.template_key || ''] || "Productivity & Time Optimization";
                return (
                  <option key={d.uuid} value={d.uuid}>
                    {d.filename} ({label})
                  </option>
                );
              })}
            </select>
          </div>

          {activeDataset && (
            <div className="flex items-center gap-2 no-export">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                title="Download Health Report PDF"
              >
                <Download className="h-4 w-4" />
                <span>Download Health PDF</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                title="Download the operational data metrics in a clean CSV format"
              >
                <Download className="h-4 w-4" />
                <span>Download Healed CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {!activeDataset ? (
        /* Welcome empty workspace screen */
        <div className="bg-white p-20 rounded-2xl border border-slate-200 text-center space-y-5 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center animate-pulse">
            <Database className="h-8 w-8 text-brand-teal" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight text-center">
              Welcome to Datalyze Workspace
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed text-center">
              Welcome to Datalyze Workspace. Please select a processed dataset above to generate your custom analytics report.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {dashboardFilter && (
            <div className="bg-brand-teal/10 border border-brand-teal/30 text-brand-teal rounded-lg px-4 py-3 flex items-center justify-between font-sans text-xs animate-fadeIn">
              <div className="flex items-center space-x-2">
                <span className="font-bold flex items-center space-x-1">
                  <span className="w-2 h-2 bg-brand-teal rounded-full animate-ping"></span>
                  <span>Active Cross-Filter:</span>
                </span>
                <span className="bg-white border border-brand-teal/20 px-2 py-0.5 rounded text-slate-700 font-bold">
                  {dashboardFilter.key}
                </span>
                <span>=</span>
                <span className="bg-brand-teal text-white px-2 py-0.5 rounded font-black">
                  {String(dashboardFilter.value)}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setDashboardFilter(null)}
                className="text-brand-teal hover:text-brand-teal/80 hover:underline font-bold cursor-pointer bg-white px-2.5 py-1 border border-brand-teal/20 rounded-md transition-colors shadow-sm"
              >
                Clear Active Filter
              </button>
            </div>
          )}
          
          {/* Top-Right KPI Cards & Simulation Controls in row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* KPI Golden-Hued Container */}
            <div className="lg:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap gap-6 items-center shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-32 bg-amber-100/30 transform skew-x-12 translate-x-10 pointer-events-none"></div>
              
              <div className="flex-1 min-w-[120px] border-r border-amber-200/80 pr-6">
                <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider flex items-center space-x-1">
                  <DollarSign className="h-3 w-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={kpiLabels.sales}
                    onChange={(e) => setKpiLabels({...kpiLabels, sales: e.target.value})}
                    className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold uppercase tracking-wider text-amber-700 cursor-pointer w-full text-[10px]"
                  />
                </span>
                <h3 className="text-2xl font-black text-amber-900 tracking-tight block mt-1">
                  ${totalSalesValue.toLocaleString()}
                </h3>
              </div>
              
              <div className="flex-1 min-w-[120px] border-r border-amber-200/80 pr-6">
                <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={kpiLabels.profit}
                    onChange={(e) => setKpiLabels({...kpiLabels, profit: e.target.value})}
                    className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold uppercase tracking-wider text-amber-700 cursor-pointer w-full text-[10px]"
                  />
                </span>
                <h3 className="text-2xl font-black text-amber-900 tracking-tight block mt-1">
                  ${grossProfitValue.toLocaleString()}
                </h3>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider flex items-center space-x-1">
                  <Percent className="h-3 w-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={kpiLabels.tax}
                    onChange={(e) => setKpiLabels({...kpiLabels, tax: e.target.value})}
                    className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold uppercase tracking-wider text-amber-700 cursor-pointer w-full text-[10px]"
                  />
                </span>
                <h3 className="text-2xl font-black text-amber-900 tracking-tight block mt-1">
                  ${totalTaxValue.toLocaleString()}
                </h3>
              </div>
            </div>

            {/* Simulation Controls Container */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center space-x-1.5">
                <Sliders className="h-3.5 w-3.5 text-brand-teal" />
                <span>Sales Simulation Controls</span>
              </span>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 block">Growth Forecast:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={growthRate}
                      onChange={(e) => setGrowthRate(Number(e.target.value))}
                      className="w-full accent-brand-teal cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700 shrink-0">+{growthRate}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 block">Attrition/Churn:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={attritionRate}
                      onChange={(e) => setAttritionRate(Number(e.target.value))}
                      className="w-full accent-brand-teal cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700 shrink-0">-{attritionRate}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleRevertSimulation}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold text-[9px] rounded-lg transition-all cursor-pointer"
                  title="Revert all sales simulation values to baseline"
                >
                  Revert Simulation
                </button>
              </div>
            </div>

            {/* AI Predictive Actions & What-If Simulator */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center space-x-1.5">
                  <Sliders className="h-3.5 w-3.5 text-brand-teal animate-pulse" />
                  <span>AI Predictive Actions</span>
                </span>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={triggerForecasting}
                    disabled={forecastingLoading || !selectedDatasetUuid}
                    className="flex items-center justify-center px-2 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-brand-teal/50 text-white font-bold text-[9px] rounded-lg transition-all cursor-pointer text-center"
                  >
                    {forecastingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run Forecast"}
                  </button>
                  <button
                    type="button"
                    onClick={triggerSegmentation}
                    disabled={clusteringLoading || !selectedDatasetUuid}
                    className="flex items-center justify-center px-2 py-2 bg-indigo-605 hover:bg-indigo-705 disabled:bg-indigo-400 text-white font-bold text-[9px] rounded-lg transition-all cursor-pointer text-center"
                  >
                    {clusteringLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Segment Customers"}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span className="font-semibold">What-If Growth Simulator:</span>
                  <span className="font-bold text-brand-teal">{whatIfSlider > 0 ? `+${whatIfSlider}` : whatIfSlider}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={whatIfSlider}
                  onChange={(e) => handleWhatIfSliderChange(Number(e.target.value))}
                  disabled={!forecastActive}
                  className="w-full accent-brand-teal cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

          </div>

          {/* Active Cross Filter Indicator Banner */}
          {activeFilter && (
            <div className="bg-brand-teal/10 border border-brand-teal/20 text-brand-teal text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm animate-fadeIn">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 animate-pulse" />
                <span>
                  Active Filter: <strong>{activeFilter.column}</strong> matches <strong>"{activeFilter.value}"</strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setActiveBranchFilter(null);
                }}
                className="bg-white border border-brand-teal/20 hover:bg-brand-teal hover:text-white px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer"
              >
                Clear Filter [X]
              </button>
            </div>
          )}

          {recordsLoading ? (
            <div className="bg-white p-16 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3 shadow-sm">
              <Loader2 className="h-8 w-8 text-brand-teal animate-spin" />
              <p className="text-xs text-slate-400">Loading dataset rows from cloud store...</p>
            </div>
          ) : (
            /* Side-by-Side Canvas + Visualizations Sidebar Panel */
            <div className="flex flex-col xl:flex-row gap-6 items-start relative">
              
              {/* Left/Center Area: Masonry grid reporting canvas */}
              <div className="flex-1 space-y-6 w-full transition-all duration-300 ease-in-out">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-3">
                  <h2 className="text-sm font-bold text-brand-teal uppercase tracking-wider flex items-center space-x-2">
                    <FileText className="h-4.5 w-4.5" />
                    <span>Data Analytics Report: {activeDataset.filename}</span>
                  </h2>
                </div>

                {/* Asymmetrical grid layouts */}
                {/* Asymmetrical grid layouts wrapped in ErrorBoundary */}
                <ErrorBoundary>
                  {templateKey === 'productivity_time' ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {renderChartCard(0)}
                        {renderChartCard(1)}
                        {renderChartCard(2)}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderChartCard(3)}
                        {renderChartCard(4)}
                      </div>
                    </div>
                  ) : templateKey === 'operations_logistics' ? (
                    <div className="space-y-6">
                      <div className="w-full">
                        {renderChartCard(0)}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderChartCard(1)}
                        {renderChartCard(2)}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderChartCard(3)}
                        {renderChartCard(4)}
                      </div>
                    </div>
                  ) : templateKey === 'compliance_audit' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <div className="xl:col-span-1 space-y-6">
                        {renderChartCard(0)}
                        {renderChartCard(1)}
                        {renderChartCard(2)}
                      </div>
                      <div className="xl:col-span-2 space-y-6">
                        {renderChartCard(3)}
                        {renderChartCard(4)}
                      </div>
                    </div>
                  ) : templateKey === 'commercial_revenue' ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderChartCard(0)}
                        {renderChartCard(1)}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {renderChartCard(2)}
                        {renderChartCard(3)}
                      </div>
                      <div className="w-full">
                        {renderChartCard(4)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {branchWidget && (
                          <div
                            onClick={() => setSelectedWidgetId(branchWidget.id)}
                            className={`bg-white p-6 rounded-2xl flex flex-col justify-between min-h-[440px] cursor-pointer transition-all ${
                              selectedWidgetId === branchWidget.id
                                ? 'border-2 border-brand-teal shadow-md bg-slate-50/20'
                                : 'border border-slate-200 hover:border-slate-350'
                            }`}
                          >
                            <div>
                              {renderWidgetHeader(branchWidget)}
                              <div className="h-44">
                                {renderWidgetContent(branchWidget)}
                              </div>
                            </div>
                            
                            {/* Data Matrix Table */}
                            <div className="space-y-2 mt-4">
                              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                Data Matrix Table (Top 30 Records)
                              </h4>
                              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                                <table className="w-full text-left border-collapse text-[9px]">
                                  <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 z-10 font-bold border-b border-slate-200">
                                    <tr>
                                      {displayCols.map(col => (
                                        <th key={col} className="p-1.5 bg-slate-50">{col}</th>
                                      ))}
                                      {segmentationActive && (
                                        <th className="p-1.5 bg-slate-50 text-indigo-600">Segment</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredRecords.slice(0, 30).map((row, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        {displayCols.map(col => (
                                          <td key={col} className="p-1.5 truncate max-w-[85px]">
                                            {row && row[col] !== undefined && row[col] !== null 
                                              ? (typeof row[col] === 'number' ? Number(row[col]).toLocaleString() : String(row[col]))
                                              : ""}
                                          </td>
                                        ))}
                                        {segmentationActive && (() => {
                                          const label = getClusterLabelForValue(row[totalCol]);
                                          let badgeClass = "bg-slate-100 text-slate-700";
                                          if (label === "Low Value") badgeClass = "bg-rose-50 border border-rose-250 text-rose-700 font-bold";
                                          else if (label === "Medium Value") badgeClass = "bg-amber-50 border border-amber-250 text-amber-700 font-bold";
                                          else if (label?.includes("High") || label?.includes("Premium")) badgeClass = "bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold";
                                          
                                          return (
                                            <td className="p-1.5">
                                              <span className={`px-1.5 py-0.5 rounded text-[8px] ${badgeClass}`}>
                                                {label || "Unclassified"}
                                              </span>
                                            </td>
                                          );
                                        })()}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {renderNarrativeAnalysisCard()}
                          </div>
                        )}

                        {productLineWidget && (
                          <div
                            onClick={() => setSelectedWidgetId(productLineWidget.id)}
                            className={`bg-white p-6 rounded-2xl flex flex-col justify-between min-h-[440px] cursor-pointer transition-all ${
                              selectedWidgetId === productLineWidget.id
                                ? 'border-2 border-brand-teal shadow-md bg-slate-50/20'
                                : 'border border-slate-200 hover:border-slate-350'
                            }`}
                          >
                            <div className="flex-1 flex flex-col justify-between">
                              {renderWidgetHeader(productLineWidget)}
                              <div className="h-80 w-full flex items-center justify-center">
                                {renderWidgetContent(productLineWidget)}
                              </div>
                            </div>
                            {renderNarrativeAnalysisCard()}
                          </div>
                        )}
                      </div>

                      {/* Row 2 Grid: Timeline Line & City Pie */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                        {timelineWidget && (
                          <div
                            onClick={() => setSelectedWidgetId(timelineWidget.id)}
                            className={`lg:col-span-2 bg-white p-6 rounded-2xl cursor-pointer transition-all ${
                              selectedWidgetId === timelineWidget.id
                                ? 'border-2 border-brand-teal shadow-md bg-slate-50/20'
                                : 'border border-slate-200 hover:border-slate-350'
                            }`}
                          >
                            {renderWidgetHeader(timelineWidget)}
                            <div className="h-60">
                              {renderWidgetContent(timelineWidget)}
                            </div>
                            {renderNarrativeAnalysisCard()}
                          </div>
                        )}

                        {cityWidget && (
                          <div
                            onClick={() => setSelectedWidgetId(cityWidget.id)}
                            className={`bg-white p-6 rounded-2xl cursor-pointer transition-all ${
                              selectedWidgetId === cityWidget.id
                                ? 'border-2 border-brand-teal shadow-md bg-slate-50/20'
                                : 'border border-slate-200 hover:border-slate-350'
                            }`}
                          >
                            {renderWidgetHeader(cityWidget)}
                            <div className="h-60 flex items-center justify-center">
                              {renderWidgetContent(cityWidget)}
                            </div>
                            {renderNarrativeAnalysisCard()}
                          </div>
                        )}
                      </div>

                      {/* Custom visual frames masonry grid */}
                      {customWidgets.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          {customWidgets.map((widget) => (
                            <div
                              key={widget.id}
                              onClick={() => setSelectedWidgetId(widget.id)}
                              className={`bg-white p-6 rounded-2xl flex flex-col justify-between min-h-[380px] cursor-pointer transition-all ${
                                selectedWidgetId === widget.id
                                  ? 'border-2 border-brand-teal shadow-md bg-slate-50/20'
                                  : 'border border-slate-200 hover:border-slate-350'
                              }`}
                            >
                              <div className="flex-1 flex flex-col justify-between">
                                {renderWidgetHeader(widget)}
                                <div className="h-60 relative w-full flex items-center justify-center">
                                  {renderWidgetContent(widget)}
                                </div>
                              </div>
                              {renderNarrativeAnalysisCard()}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </ErrorBoundary>

              {/* Bottom Area: Interactive AI Query Terminal */}
              <div className="bg-slate-50 text-slate-800 font-mono p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mt-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-500 font-semibold ml-2">DATALYZE-AI-CONSOLE v1.0.0</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-sans font-bold">ONLINE</span>
                </div>
                
                <div className="h-72 overflow-y-auto space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-1">
                  {messages.map((msg, idx) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <div key={idx} className={`whitespace-pre-wrap leading-relaxed ${isUser ? 'text-slate-900 font-bold' : 'text-slate-850 space-y-2.5'}`}>
                        {isUser ? (
                          <>
                            <span className="text-brand-teal font-extrabold mr-1.5">$</span>
                            {msg.text}
                          </>
                        ) : (
                          <>
                            <p>{msg.text}</p>
                            
                            {/* Render inline Recharts chart if chartType is valid */}
                            {msg.chartType && msg.chartType !== 'none' && msg.chartData && msg.chartData.length > 0 && (
                              <div className="bg-white border border-slate-250 rounded-xl p-3 shadow-sm h-48 w-full mt-2 no-export font-sans">
                                <ResponsiveContainer width="100%" height="100%">
                                  {msg.chartType === 'bar' ? (
                                    <BarChart data={msg.chartData}>
                                      <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                                      <YAxis tick={{ fontSize: 9 }} />
                                      <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                                      <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                  ) : msg.chartType === 'line' ? (
                                    <LineChart data={msg.chartData}>
                                      <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                                      <YAxis tick={{ fontSize: 9 }} />
                                      <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  ) : (
                                    <PieChart>
                                      <Pie
                                        data={msg.chartData}
                                        dataKey="value"
                                        nameKey="category"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={45}
                                        fill="#10b981"
                                        label={{ fontSize: 8 }}
                                      />
                                      <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                                    </PieChart>
                                  )}
                                </ResponsiveContainer>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {nlpLoading && (
                    <div className="animate-pulse flex items-center space-x-2 text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-ping"></span>
                      <span>Analyst Copilot is computing results...</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleNlpQuerySubmit} className="flex gap-2 border-t border-slate-200 pt-3 items-center">
                  <span className="text-brand-teal font-bold shrink-0">$</span>
                  <input
                    type="text"
                    value={nlpQuery}
                    disabled={nlpLoading}
                    onChange={(e) => setNlpQuery(e.target.value)}
                    placeholder="Ask dataset queries (e.g. 'highest Total_Revenue', 'summary', 'row count')"
                    className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-xs py-2 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleVoiceQueryClick}
                    disabled={nlpLoading}
                    className={`p-2 rounded transition-all cursor-pointer border border-transparent ${
                      isRecording 
                        ? 'bg-red-50 border-red-200 animate-pulse text-red-600' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                    }`}
                    title="Voice Query"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="submit"
                    disabled={nlpLoading || !nlpQuery.trim()}
                    className="px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded transition-all cursor-pointer font-sans"
                  >
                    Submit Query
                  </button>
                </form>
              </div>
                
                {/* Bottom Block: Executive Insight Narrative */}
                <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-xl relative overflow-hidden w-full">
                  <div className="flex items-center space-x-1.5 text-brand-emerald mb-2">
                    <Database className="h-3.5 w-3.5 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Executive Insight Narrative</span>
                  </div>
                  {aiSummaryLoading ? (
                    <div className="space-y-1.5 animate-pulse w-full">
                      <div className="h-3 bg-slate-200 rounded w-full"></div>
                      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-650 leading-relaxed w-full">
                      {aiSummary || "Active summary prose loading from Cloud AI engine..."}
                    </p>
                  )}
                </div>

            </div>

              {/* Right Area: Dedicated Visualizations & Data Fields Sidebar (Collapsible) */}
              <div className={`relative shrink-0 transition-all duration-300 ease-in-out ${
                isSidebarOpen ? 'w-full xl:w-80 opacity-100' : 'w-0 xl:w-0 opacity-0 pointer-events-none overflow-hidden border-none p-0 m-0'
              }`}>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
                  {/* Collapse handle tab button on the inner edge */}
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute -left-3.5 top-1/2 -translate-y-1/2 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 rounded-full p-1.5 shadow-sm z-20 cursor-pointer text-slate-500 hover:text-slate-800 hidden xl:block"
                    title="Collapse Visualizations Panel"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Visualizations grid matrix */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                      Visualizations
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {CHART_TYPES.map((ct) => {
                        const IconComponent = ct.icon;
                        let isSelected = false;
                        let isDisabled = true;
                        
                        if (editingConfig) {
                          isSelected = mapStyleToIconName(editingConfig.chartType) === ct.name;
                          isDisabled = false;
                        } else if (selectedWidget) {
                          isSelected = selectedWidget.type === ct.name;
                          isDisabled = false;
                        }

                        return (
                          <button
                            key={ct.name}
                            disabled={isDisabled}
                            onClick={() => {
                              if (editingConfig) {
                                handleConfigUpdate(editingConfig.chartId, { chartType: mapIconNameToStyle(ct.name) });
                              } else if (selectedWidget) {
                                updateWidgetType(selectedWidget.id, ct.name);
                              }
                            }}
                            className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all text-center group cursor-pointer ${
                              isDisabled
                                ? 'opacity-45 cursor-not-allowed border-slate-200 bg-slate-50'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-650'
                                : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:text-slate-800 hover:border-slate-400'
                            }`}
                            title={ct.label}
                          >
                            <IconComponent className="h-4 w-4 transition-transform group-hover:scale-105" />
                            <span className="text-[8px] font-bold block truncate max-w-full leading-none">
                              {ct.label.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Build Visual Fields form bindings */}
                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Build Visual Fields
                    </h3>
                    {editingConfig ? (
                      <div className="space-y-3.5 text-[10px]">
                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">Visual Frame Title:</span>
                          <input
                            type="text"
                            value={editingConfig.title || ''}
                            onChange={(e) => handleConfigUpdate(editingConfig.chartId, { title: e.target.value })}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm text-xs"
                            placeholder="Enter chart title..."
                          />
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">X-Axis / Legend Values:</span>
                          <select
                            value={editingConfig.xAxisColumn}
                            onChange={(e) => handleConfigUpdate(editingConfig.chartId, { xAxisColumn: e.target.value })}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm cursor-pointer"
                          >
                            {(records.length > 0 ? Object.keys(records[0]) : allColumns).map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">Y-Axis / Column Values:</span>
                          <select
                            value={editingConfig.yAxisColumn}
                            onChange={(e) => handleConfigUpdate(editingConfig.chartId, { yAxisColumn: e.target.value })}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm cursor-pointer"
                          >
                            {(records.length > 0 ? Object.keys(records[0]) : allColumns).map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : selectedWidget ? (
                      <div className="space-y-3.5 text-[10px]">
                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">Visual Frame Title:</span>
                          <input
                            type="text"
                            value={selectedWidget.title}
                            onChange={(e) => updateWidgetTitle(selectedWidget.id, e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm text-xs"
                            placeholder="Enter chart title..."
                          />
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">X-Axis / Legend Values:</span>
                          <select
                            value={selectedWidget.xAxisColumn}
                            onChange={(e) => updateWidgetColumns(selectedWidget.id, e.target.value, selectedWidget.yAxisColumn)}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm"
                          >
                            {datasetColumns.map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">Y-Axis / Column Values:</span>
                          <select
                            value={selectedWidget.yAxisColumn}
                            onChange={(e) => updateWidgetColumns(selectedWidget.id, selectedWidget.xAxisColumn, e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm"
                          >
                            {datasetColumns.map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col space-y-1">
                          <span className="text-slate-400 font-semibold">Color Palette:</span>
                          <select
                            value={selectedWidget.colorPalette}
                            onChange={(e) => updateWidgetPalette(selectedWidget.id, e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 rounded-lg p-2 focus:outline-none focus:border-brand-teal shadow-sm"
                          >
                            <option value="blue">Electric Blue</option>
                            <option value="emerald">Forest Emerald</option>
                            <option value="amber">Warm Amber</option>
                            <option value="rose">Sunset Rose</option>
                            <option value="violet">Cyber Violet</option>
                            <option value="cyan">Deep Cyan</option>
                          </select>
                        </div>

                        {/* Presentation Toggles */}
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedWidget.showGrid}
                              onChange={(e) => updateWidgetPresentation(selectedWidget.id, 'showGrid', e.target.checked)}
                              className="rounded bg-white border-slate-300 text-brand-teal focus:ring-0"
                            />
                            <span>Show Gridlines</span>
                          </label>
                          <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedWidget.showLabels}
                              onChange={(e) => updateWidgetPresentation(selectedWidget.id, 'showLabels', e.target.checked)}
                              className="rounded bg-white border-slate-300 text-brand-teal focus:ring-0"
                            />
                            <span>Show Value Labels</span>
                          </label>
                          <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedWidget.smooth}
                              onChange={(e) => updateWidgetPresentation(selectedWidget.id, 'smooth', e.target.checked)}
                              className="rounded bg-white border-slate-300 text-brand-teal focus:ring-0"
                            />
                            <span>Enable Smooth (Spline)</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">
                        Select a visual frame on the canvas to configure its fields.
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Expand sidebar trigger tab floating on the right side if closed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="fixed right-6 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-full p-3 shadow-md z-30 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-brand-teal/20"
              title="Expand Visualizations Panel"
            >
              <Sliders className="h-5 w-5 text-brand-teal" />
            </button>
          )}



          {/* Permanent Floating Action Button */}
          <button
            onClick={addCustomWidget}
            className="fixed bottom-6 right-6 z-40 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs px-5 py-3.5 rounded-full shadow-glow flex items-center space-x-2 transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-brand-teal/20"
          >
            <Plus className="h-4.5 w-4.5 animate-bounce" />
            <span>+ Add Custom Power BI View Frame</span>
          </button>
        </div>
      )}


      {/* PowerPoint slide builder modal */}
      {showPptxModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn no-export">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 relative">
            <button
              onClick={() => setShowPptxModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650 font-bold"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2.5 text-amber-500 border-b border-slate-100 pb-3">
              <Tv className="h-5 w-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Executive slide builder
              </h4>
            </div>
            
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed font-sans">
              <p>Select the slide sections to compile into your executive PowerPoint (.pptx) deck:</p>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pptxSections.health}
                    onChange={(e) => setPptxSections({ ...pptxSections, health: e.target.checked })}
                    className="h-4 w-4 text-brand-teal focus:ring-brand-teal border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Data Health Scorecard</span>
                </label>
                
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pptxSections.simulation}
                    onChange={(e) => setPptxSections({ ...pptxSections, simulation: e.target.checked })}
                    className="h-4 w-4 text-brand-teal focus:ring-brand-teal border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">What-If Simulation Projections</span>
                </label>
                
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pptxSections.segmentation}
                    onChange={(e) => setPptxSections({ ...pptxSections, segmentation: e.target.checked })}
                    className="h-4 w-4 text-brand-teal focus:ring-brand-teal border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Customer Segmentation Badges</span>
                </label>
              </div>

              {pptxGenerating ? (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Generating Slide Deck...</span>
                    <span className="animate-pulse">Loading AI Narrative...</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 h-2.5 rounded-full w-2/3 animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGeneratePptx}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Build Executive PowerPoint Deck</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {isFlyoutOpen && editingConfig && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans no-export">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsFlyoutOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 z-50 animate-slideOver">
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-100px)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Visualization Layout Editor
                </h3>
                <button 
                  onClick={() => setIsFlyoutOpen(false)}
                  className="text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Chart Title Customization */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Chart Display Title</label>
                  <input 
                    type="text" 
                    value={editingConfig.title || ''} 
                    onChange={(e) => handleConfigUpdate(editingConfig.chartId, { title: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-teal text-slate-700 font-bold"
                  />
                </div>

                {/* 1. X-Axis Property */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">X-Axis Property</label>
                  <select 
                    value={editingConfig.xAxisColumn} 
                    onChange={(e) => handleConfigUpdate(editingConfig.chartId, { xAxisColumn: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-teal text-slate-700 font-bold cursor-pointer"
                  >
                    {(records.length > 0 ? Object.keys(records[0]) : allColumns).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Y-Axis Property */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Y-Axis Property</label>
                  <select 
                    value={editingConfig.yAxisColumn} 
                    onChange={(e) => handleConfigUpdate(editingConfig.chartId, { yAxisColumn: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-teal text-slate-700 font-bold cursor-pointer"
                  >
                    {(records.length > 0 ? Object.keys(records[0]) : allColumns).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Visualization Style Override */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Visualization Style Override</label>
                  <select 
                    value={editingConfig.chartType} 
                    onChange={(e) => handleConfigUpdate(editingConfig.chartId, { chartType: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-teal text-slate-700 font-bold cursor-pointer"
                  >
                    {['Bar', 'Line', 'Smooth Area', 'Radial Speedometer Gauge', 'Donut Ring Chart', 'Scatter-Heatmap Grid', 'Radar Cluster Web', 'Interactive Tabular Grid Matrix'].map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 z-20">
              <button 
                type="button"
                onClick={() => setIsFlyoutOpen(false)}
                className="w-full px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer text-center"
              >
                Close Editor
              </button>
            </div>
          </div>
        </div>
      )}
      {activeWorkspaceId && (
        <MultiplayerCanvas
          workspaceId={activeWorkspaceId}
          userEmail={userEmail}
          onSliderTick={handleSliderTick}
          growthRate={growthRate}
          attritionRate={attritionRate}
        />
      )}
    </div>
  );
};
