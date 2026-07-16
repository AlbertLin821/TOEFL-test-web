import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../auth/AuthContext';
import { ApiClientError } from '../lib/api';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致。');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      navigate(homeForRole('student'), { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'CONFLICT') {
        setError('這個 Email 已經註冊，請直接登入。');
      } else {
        setError(err instanceof ApiClientError ? err.message : '註冊失敗，請稍後再試。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-5 rounded-lg bg-white p-8 shadow-md">
        <div>
          <p className="text-sm font-medium text-blue-700">學生註冊</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">建立你的測驗帳號</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">註冊完成後會自動登入，並可直接參加目前開放的模擬考試。</p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-name">
          姓名
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="register-password">
            密碼
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="register-password-hint"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={100}
            required
          />
          <p id="register-password-hint" className="mt-1 text-xs text-slate-500">
            至少 8 個字元。
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="register-confirm-password">
            確認密碼
          </label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={passwordsMismatch}
            aria-describedby={passwordsMismatch ? 'register-confirm-error' : undefined}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 aria-[invalid=true]:border-red-500"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={100}
            required
          />
          {passwordsMismatch && (
            <p id="register-confirm-error" className="mt-1 text-xs text-red-700">
              兩次輸入的密碼不一致。
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || passwordsMismatch}
          className="w-full exam-btn-primary py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '註冊中…' : '註冊並開始'}
        </button>

        <p className="text-center text-sm text-slate-600">
          已經有帳號？{' '}
          <Link className="font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" to="/login">
            返回登入
          </Link>
        </p>
      </form>
    </main>
  );
}
