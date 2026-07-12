import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../auth/AuthContext';
import { ApiClientError } from '../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('student@demo.local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const me = await (await fetch('/api/v1/users/me', { credentials: 'include' })).json();
      navigate(homeForRole(me.role));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-semibold">TOEFL-style Mock Test Platform</h1>
          <p className="text-sm text-slate-500 mt-1">非 ETS 官方平台。此為模擬測驗系統。</p>
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2" role="alert">
            {error}
          </div>
        )}
        <label className="block text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading} className="w-full exam-btn-primary py-2">
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <p className="text-xs text-slate-500">
          Demo: student@demo.local / teacher@demo.local / orgadmin@demo.local (Password123!)
        </p>
      </form>
    </div>
  );
}
