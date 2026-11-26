import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { testSupabaseConnection, type SupabaseConnectionResult } from '../lib/supabase';

export const SupabaseCheckPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SupabaseConnectionResult | null>(null);

  const runCheck = async () => {
    setLoading(true);
    const status = await testSupabaseConnection();
    setResult(status);
    setLoading(false);
  };

  useEffect(() => {
    void runCheck();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Supabase Connection Check</h1>
            <p className="text-sm text-slate-500">Milestone 1 — Project &amp; Environment Verification</p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            Checking Supabase connection...
          </div>
        ) : result?.ok ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Connected to Supabase
            </div>
            <p className="text-sm text-emerald-800">{result.message}</p>
            <p className="text-xs font-mono text-emerald-700 break-all">URL: {result.url}</p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Supabase Not Connected Yet
            </div>
            <p className="text-sm text-amber-800">{result?.message}</p>
            <p className="text-xs text-amber-700">
              Update <code className="font-mono bg-amber-100 px-1 rounded">client/.env</code> with{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code>, then restart the dev server.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back to Home
          </Link>
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Re-test Connection
          </button>
        </div>
      </div>
    </div>
  );
};
