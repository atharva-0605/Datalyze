import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  GraduationCap, 
  FileText, 
  Mic,
  Link2,
  Activity
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  content: string;
  readTime: string;
}

export const LearningHubView: React.FC = () => {
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({
    'health_scores': true // Open the first one by default
  });

  const articles: Article[] = [
    {
      id: 'health_scores',
      title: 'Understanding Data Health Scores',
      category: 'Data Diagnostics',
      icon: <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />,
      readTime: '3 min read',
      content: `## Data Quality Profiling & Ingestion Checks

Our platform evaluates every uploaded spreadsheet dataset against key health heuristics to compute a Data Health Score from 0 to 100. This score acts as your first line of defense against corrupted or skewed analysis results.

### Key Evaluation Criteria:
* **Null Value Concentrations**: Calculates the ratio of empty cells to total cell capacity. Datasets with high missing percentage rates drop in health quality.
* **Duplicate Observations**: Scans for exact row duplicates. Duplicate values distort mathematical mean averages and forecast algorithms.
* **Data Type Consistency**: Identifies format anomalies, such as columns containing text strings mixed inside numeric columns.

### Remediation Strategies:
Using our built-in Data Doctor engine, you can conditionally heal your datasets. When duplicates are purged or null values are imputed, a new updated health profile is generated instantly. Ensuring a score above 80% is recommended before running predictive canvas trends or slides export pipelines.`
    },
    {
      id: 'segmentation_badges',
      title: 'Interpreting Segmentation Badges',
      category: 'Machine Learning',
      icon: <FileText className="h-4.5 w-4.5 text-blue-500" />,
      readTime: '4 min read',
      content: `## Customer Cohort Clustering & Retraining

Our machine learning engine groups customer behaviors into clusters using the K-Means clustering algorithm. Each customer row is assigned a specific dynamic Segmentation Badge representing their precise behavioral cohort.

### Segmentation Dimensions:
* **High-Value Champions**: Cohorts with high monthly revenue averages and low support ticket volumes.
* **At-Risk Customers**: Cohorts characterized by declining revenue and high frequencies of support tickets, indicating a high probability of churn.
* **Moderate Baselines**: Standard users displaying average transaction metrics.

### Retraining Routines:
As you ingest fresh weekly datasets, execute a cluster retraining routine from the main control layout to re-align customer tags with shifting commercial baselines.`
    },
    {
      id: 'voice_queries',
      title: 'Using Conversational Analyst Queries',
      category: 'User Interface',
      icon: <Mic className="h-4.5 w-4.5 text-brand-teal" />,
      readTime: '3 min read',
      content: `## Conversational Dialogue Commands & Context Memory

Bridge the gap between raw data arrays and commercial strategies using our Natural Language Query interface. Type clean questions to parse complex data metrics without writing SQL queries.

### Extraction Phrases:
* **Query metrics using human syntax**: Query metrics using human syntax (e.g., 'Show me total revenue patterns across Q3 grouped by branch').

### Layout Controls:
Use input queries to instantly update active dashboard graphs, recalculate field balances, or automatically package presentation slides for file download exports.`
    },
    {
      id: 'integration_architecture',
      title: 'Integration & Automations Architecture',
      category: 'System Integration',
      icon: <Link2 className="h-4.5 w-4.5 text-amber-500" />,
      readTime: '5 min read',
      content: `## Pipeline Workflows & Background Messaging Workers

Our workspace integrations hub establishes real-time connections to sync critical data quality updates with downstream operational tools.

### Slack Webhook Automations:
* **HTTP POST Payloads**: When a Slack integration is configured and active, our background worker binds a trigger to the dataset upload streams.
* **Conditional Threshold Warnings**: If the calculated dataset health score falls below 70, the system initiates an asynchronous HTTP POST dispatch containing a structured JSON warning block detailing the file metadata, workspace parameters, and specific suggestions.

### Email Digest Schedulers:
* **SMTP Digests Configuration**: Save a target recipient email address, selection frequency (daily, weekly, monthly), and toggle activation parameters.
* **Direct Analytics Deliveries**: The system utilizes standard SMTP transporters (Nodemailer, SendGrid, or local SMTP forwarders) to automatically generate plain-text or HTML reports detailing health metrics, anomalies flagged, and active alerts, transmitting them straight to the saved recipient.`
    },
    {
      id: 'statistical_mathematics',
      title: 'Statistical Mathematics of Data Drift',
      category: 'Data Diagnostics',
      icon: <Activity className="h-4.5 w-4.5 text-rose-500" />,
      readTime: '6 min read',
      content: `## Non-Parametric Kolmogorov-Smirnov Distribution Analysis

Continuous telemetry monitoring runs distribution diagnostics comparing recent file uploads to baseline profiles to identify covariate drift.

### Kolmogorov-Smirnov (K-S) Two-Sample Test:
* **Statistical Hypotheses**: Evaluates the null hypothesis ($H_0$) that two independent datasets (e.g., historical run vs. current run) are drawn from the identical continuous distribution.
* **Empirical Cumulative Distribution Functions (ECDF)**: Calculates the maximum vertical difference ($D$) between the ECDFs of both samples.
* **Significance Testing**: Evaluates whether $D$ exceeds critical thresholds based on the p-value. A p-value below $0.05$ rejects the null hypothesis, triggering an official **DRIFTED** status alert on the dashboard.

### Core Metrics Tracking:
* **Numerical Metrics Analysis**: The drift engine runs this test across continuous attributes like **Total_Revenue**, **Quantity**, and **Gross_Income** to guarantee that financial baselines are stable before running model simulations.`
    }
  ];

  const toggleArticle = (id: string) => {
    setExpandedArticles((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Custom Lightweight Markdown Parser
  const renderMarkdown = (text: string) => {
    return text.split('\n\n').map((paragraph, pIdx) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={pIdx} className="text-xs font-black text-slate-800 uppercase tracking-wider mt-5 mb-2 border-b border-slate-100 pb-1.5 font-sans">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={pIdx} className="text-xs font-bold text-brand-teal mt-4 mb-2 font-sans">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <ul key={pIdx} className="list-disc pl-5 space-y-1.5 my-3 text-slate-650 text-xs font-sans">
            {trimmed.split('\n').map((line, lIdx) => (
              <li key={lIdx} className="leading-relaxed">
                {line.replace(/^[-*]\s+/, '')}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={pIdx} className="leading-relaxed text-xs text-slate-600 font-sans mb-3">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header ribbon */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-5">
        <GraduationCap className="h-6 w-6 text-brand-teal" />
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Datalyze Learning Hub & Academy
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Learn statistical analytics best practices, interpret cluster models, and master natural query interfaces.
          </p>
        </div>
      </div>

      {/* Main Guides Accordion List */}
      <div className="space-y-4">
        {articles.map((article) => {
          const isExpanded = !!expandedArticles[article.id];
          return (
            <div 
              key={article.id}
              className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden transition-all duration-150"
            >
              {/* Header Tab */}
              <div 
                onClick={() => toggleArticle(article.id)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-50 border border-slate-150 rounded-lg">
                    {article.icon}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      {article.category}
                    </span>
                    <h3 className="text-xs font-black text-slate-800 font-sans">
                      {article.title}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-slate-450 text-[10px] font-semibold">
                  <span>{article.readTime}</span>
                  {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                </div>
              </div>

              {/* Expandable Article Body - Rendering full-width unique content */}
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-3 text-xs leading-relaxed">
                  {renderMarkdown(article.content)}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default LearningHubView;
