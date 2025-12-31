import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // When email confirmation is disabled, signUp returns a session immediately
        if (data.session) {
          setMessage('註冊成功！正在進入...');
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else if (data.user && !data.session) {
          // Email confirmation is still required
          setMessage('請檢查您的電子郵件以進行驗證。');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Successful login - page will redirect via AppContext
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
            <Layout size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Things Clone</h1>
          <p className="text-sm text-gray-500 mt-2">專注於您的任務</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                {mode === 'signin' ? '登入' : '註冊帳號'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
          >
            {mode === 'signin' ? '還沒有帳號？立即註冊' : '已經有帳號？登入'}
          </button>
        </div>

        {/* Demo Account Section */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">或使用 Demo 帳號體驗</p>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                if (!supabase) throw new Error("Supabase client not initialized");
                const { error } = await supabase.auth.signInWithPassword({
                  email: 'demo@demo.com',
                  password: 'demo123456',
                });
                if (error) throw error;
                window.location.reload();
              } catch (err: any) {
                setError('Demo 帳號登入失敗: ' + err.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
          >
            🎮 Demo 帳號登入
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            demo@demo.com / demo123456
          </p>
        </div>
      </div>
    </div>
  );
};
