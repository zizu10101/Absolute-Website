import React from 'react';
import { ReportsPage } from '../components/ReportsPage';
import { ArrowLeft } from 'lucide-react';

/**
 * Full-page Reports view accessible at /reports
 * Can be opened from POS via Reports button
 */
export function ReportsPageFull() {
  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header with back button */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft size={20} className="text-zinc-600" />
            </button>
            <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-900">
              Reports
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-bold">Financial summaries and analytics</p>
        </div>
      </div>

      {/* Reports content */}
      <div className="flex-1 overflow-hidden">
        <ReportsPage />
      </div>
    </div>
  );
}
