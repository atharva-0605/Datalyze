import React from 'react';
import { 
  GraduationCap, 
  Settings, 
  LayoutDashboard,
  UploadCloud, 
  LayoutGrid,
  TrendingUp,
  Link2,
  Activity, 
  ArrowRight,
  Compass
} from 'lucide-react';

export const UserGuide: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'User Guide & Onboarding Manual',
      icon: <Compass className="h-5 w-5 text-brand-teal" />,
      desc: 'A comprehensive, step-by-step master checklist guiding you through the platform capabilities.'
    },
    {
      num: '02',
      title: 'Dashboard Command Room',
      icon: <LayoutDashboard className="h-5 w-5 text-brand-teal" />,
      desc: 'Monitor macro-level workspace metrics. The central dashboard provides aggregated pipeline logs, live health summaries, and operational status shortcuts.'
    },
    {
      num: '03',
      title: 'Analytical Templates Marketplace',
      icon: <LayoutGrid className="h-5 w-5 text-brand-teal" />,
      desc: 'Jumpstart workspaces instantly without manual setup loops. Browse the catalog repository of pre-built data structures, sliders defaults, and mock data visualization layouts to clone configurations.'
    },
    {
      num: '04',
      title: 'Data Ingestion & Healing Pipeline',
      icon: <UploadCloud className="h-5 w-5 text-brand-teal" />,
      desc: 'Import raw metrics (.csv) directly. The interface runs schema checkers on columns, counts rows, and details initial Data Health scores, unlocking a "Heal Dataset" data doctor routine to fix errors.'
    },
    {
      num: '05',
      title: 'Workspace Health & Data Drift Monitor',
      icon: <Activity className="h-5 w-5 text-brand-teal" />,
      desc: 'Tracks ongoing statistical health across dataset batches. Inspects diagnostic cards for features like Total_Revenue, Quantity, Gross_Income, Date, and Branch to verify they match "STABLE" validation states using Kolmogorov-Smirnov distribution testing.'
    },
    {
      num: '06',
      title: 'Executive Insights & Reports Hub',
      icon: <TrendingUp className="h-5 w-5 text-brand-teal" />,
      desc: 'Generate business summaries from clean data tables. Set workspace filters, click report generation triggers, and review text-narrated reports along with downloadable presentation slides.'
    },
    {
      num: '07',
      title: 'Workspace Integrations & Alert Pipelines',
      icon: <Link2 className="h-5 w-5 text-brand-teal" />,
      desc: 'Connect live workspace activities to external platforms. Input Slack webhook URLs for instant alert messages if health balances breach 70, input recipient email fields, select tracking frequencies, and flip the Email Executive Digest toggle or use the prompt "Trigger Digest Now" to automate local log summaries.'
    },
    {
      num: '08',
      title: 'Datalyze Learning Hub & Academy',
      icon: <GraduationCap className="h-5 w-5 text-brand-teal" />,
      desc: 'Access the localized learning academy modules to read technical deep-dives regarding data diagnostics theories, K-Means clustering modeling, natural query parsing syntax, and statistical diagnostics.'
    },
    {
      num: '09',
      title: 'Settings Portal',
      icon: <Settings className="h-5 w-5 text-brand-teal" />,
      desc: 'Access workspace credentials, environment variables, profile configurations, token permissions flags, layout preferences, and cache controls to align user privileges with active multi-tenant schemas.'
    }
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-8 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center space-x-2.5">
            <GraduationCap className="h-5.5 w-5.5 text-brand-teal" />
            <span>Operational Onboarding Manual</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            A comprehensive, step-by-step master checklist guiding you through the platform capabilities.
          </p>
        </div>
      </div>

      {/* Checklist Onboarding Progression */}
      <div className="relative border-l-2 border-slate-200 ml-4 pl-8 space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="relative group">
            {/* Circle Badge Indicator */}
            <div className="absolute -left-[45px] top-0 h-8 w-8 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center transition-colors group-hover:border-brand-teal group-hover:bg-slate-50">
              <span className="text-[10px] font-black text-slate-500 font-mono">
                {step.num}
              </span>
            </div>

            <div className="bg-white border border-slate-200 hover:border-slate-350 p-5 rounded-2xl shadow-sm transition-all duration-200 flex items-start gap-4">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mt-0.5">
                {step.icon}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black text-slate-800 tracking-tight">
                    {step.title}
                  </h4>
                  <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-slate-555 leading-relaxed font-normal">
                  {step.desc}
                </p>

                {step.num === '07' && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-2 text-[10px] font-sans">
                    <span className="font-bold text-slate-800 block">
                      Quick Setup: How to Generate a Webhook URL
                    </span>
                    <ul className="space-y-1.5 text-slate-600 pl-1 list-none">
                      <li className="flex items-start gap-1">
                        <span className="font-bold text-brand-teal shrink-0">1.</span>
                        <span>Create a Target Channel: Select or make an alert channel in your Slack workspace.</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <span className="font-bold text-brand-teal shrink-0">2.</span>
                        <span>Create an App Wrapper: Visit <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-brand-teal hover:underline font-semibold">api.slack.com/apps</a> &rarr; Create App From Scratch and select your workspace.</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <span className="font-bold text-brand-teal shrink-0">3.</span>
                        <span>Enable Inbound Pings: Click 'Incoming Webhooks' in the side menu and flip the toggle switch to ON.</span>
                      </li>
                      <li className="flex items-start gap-1">
                        <span className="font-bold text-brand-teal shrink-0">4.</span>
                        <span>Authorize and Copy: Click 'Add New Webhook to Workspace', pick your target channel, authorize, and copy the generated URL.</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default UserGuide;
