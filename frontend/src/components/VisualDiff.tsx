import { ArrowRight, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ColumnDiff {
  originalType: string;
  originalMissing: number;
  originalMismatch: number;
  healedType: string;
  healedMissing: number;
  healedMismatch: number;
}

interface VisualDiffProps {
  originalScore: number;
  healedScore: number;
  filename: string;
  duplicatesRemoved: number;
  columnsImputed: Record<string, { count: number; strategy: string; value: any }>;
  typesCoerced: string[];
  columnsDiff: Record<string, ColumnDiff>;
}

export const VisualDiff = ({
  originalScore,
  healedScore,
  filename,
  duplicatesRemoved,
  columnsImputed,
  typesCoerced,
  columnsDiff
}: VisualDiffProps) => {
  return (
    <div className="space-y-6">
      {/* Health Score Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Diagnostics Score */}
        <div className="bg-white p-6 rounded-xl border border-rose-200 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 h-16 w-16 bg-rose-50 rounded-bl-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Original Quality Status</p>
          <h4 className="text-md font-bold text-slate-850 mt-1 truncate">{filename}</h4>
          <div className="mt-4 flex items-baseline space-x-3">
            <span className="text-4xl font-black text-rose-700">{originalScore}</span>
            <span className="text-xs text-slate-450">/ 100 Health Score</span>
          </div>
          <div className="mt-4 bg-rose-50 text-rose-750 text-xs px-3 py-1.5 rounded border border-rose-100 inline-block font-bold">
            Dataset quality profile compromised by anomalies.
          </div>
        </div>

        {/* Healed Diagnostics Score */}
        <div className="bg-white p-6 rounded-xl border border-emerald-200 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-50 rounded-bl-full flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Auto-Healed Quality Status</p>
          <h4 className="text-md font-bold text-slate-850 mt-1 truncate">healed_{filename}</h4>
          <div className="mt-4 flex items-baseline space-x-3">
            <span className="text-4xl font-black text-emerald-700">{healedScore}</span>
            <span className="text-xs text-slate-450">/ 100 Health Score</span>
          </div>
          <div className="mt-4 bg-emerald-50 text-emerald-755 text-xs px-3 py-1.5 rounded border border-emerald-100 inline-block font-bold">
            Automated cleaning and optimization complete.
          </div>
        </div>
      </div>

      {/* AI Doctor applied corrections */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 text-brand-teal animate-spin" style={{ animationDuration: '6s' }} />
          <span>AI Data Doctor Operations Applied</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Duplicates Cleared</p>
            <p className="text-xl font-black text-slate-800 mt-1">{duplicatesRemoved} rows</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Missing Imputations</p>
            <p className="text-xl font-black text-brand-teal mt-1">
              {Object.keys(columnsImputed).length} columns
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Data Types Coerced</p>
            <p className="text-xl font-black text-emerald-600 mt-1">
              {typesCoerced.length} columns
            </p>
          </div>
        </div>

        {/* Detailed Action bulletins */}
        <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
          {duplicatesRemoved === 0 && Object.keys(columnsImputed).length === 0 && typesCoerced.length === 0 && (
            <p className="italic text-slate-500">No modifications were required for this dataset.</p>
          )}
          {duplicatesRemoved > 0 && (
            <p className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
              <span>Removed {duplicatesRemoved} duplicate entries.</span>
            </p>
          )}
          {(Object.entries(columnsImputed) as [string, { count: number; strategy: string; value: any }][]).map(([col, details]) => (
            <p key={col} className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-teal"></span>
              <span>
                Imputed <strong>{details.count}</strong> empty cells in column <strong>'{col}'</strong> using <strong>{details.strategy}</strong> value: <code>{JSON.stringify(details.value)}</code>.
              </span>
            </p>
          ))}
          {typesCoerced.map((col: string) => (
            <p key={col} className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>
                Coerced column <strong>'{col}'</strong> schema mapping type to numeric values.
              </span>
            </p>
          ))}
        </div>
      </div>

      {/* Side-by-Side Table Schema Diff */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Structural Diff Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="uppercase bg-slate-100/50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-bold">Column Target</th>
                <th className="px-6 py-3 font-bold text-rose-600">Original Schema</th>
                <th className="px-6 py-3 text-center w-12"></th>
                <th className="px-6 py-3 font-bold text-emerald-600">Healed Schema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.entries(columnsDiff) as [string, ColumnDiff][]).map(([colName, diff]) => {
                const hasIssues = diff.originalMissing > 0 || diff.originalMismatch > 0;
                return (
                  <tr key={colName} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{colName}</td>
                    
                    {/* Original Schema state */}
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-650 font-mono">
                          {diff.originalType}
                        </span>
                        {hasIssues && (
                          <span className="text-rose-600 text-[10px] font-bold flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Unclean</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] space-y-0.5">
                        {diff.originalMissing > 0 && (
                          <span className="text-rose-500 block">Missing Count: {diff.originalMissing}</span>
                        )}
                        {diff.originalMismatch > 0 && (
                          <span className="text-rose-500 block">Mismatches: {diff.originalMismatch}</span>
                        )}
                      </div>
                    </td>

                    {/* Navigation Arrow */}
                    <td className="px-2 py-4 text-center">
                      <ArrowRight className="h-4 w-4 text-slate-400 inline" />
                    </td>

                    {/* Healed Schema state */}
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-650 font-mono">
                          {diff.healedType}
                        </span>
                        <span className="text-emerald-600 text-[10px] font-bold flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Healed</span>
                        </span>
                      </div>
                      <div className="text-[10px] space-y-0.5 text-slate-500">
                        <span>Missing Count: 0</span>
                        <span className="block">Mismatches: 0</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
