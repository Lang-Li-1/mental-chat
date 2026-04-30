import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, registerProfessional } from '../services/patientService';

type Mode = 'login' | 'register';

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
  };

  const persistAuth = (data: { tokens: { access: string; refresh: string }; user: { role: string; username: string } }) => {
    localStorage.setItem('token', data.tokens.access);
    localStorage.setItem('refresh_token', data.tokens.refresh);
    localStorage.setItem('userRole', data.user.role);
    localStorage.setItem('userName', data.user.username);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    if (mode === 'register') {
      if (password.length < 8) {
        setError('密码至少 8 位');
        return;
      }
      if (!email.trim() && !phone.trim()) {
        setError('邮箱和手机号至少填一个');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await login({ username: trimmedUsername, password });
        if (data.user.role !== 'admin' && data.user.role !== 'professional') {
          setError('仅管理员和医生可以登录后台系统');
          return;
        }
        persistAuth(data);
        navigate('/', { replace: true });
      } else {
        const data = await registerProfessional({
          username: trimmedUsername,
          password,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        persistAuth(data);
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status: number; data?: { detail?: string; username?: string[]; email?: string[]; password?: string[] } } };
        const status = axiosErr.response?.status;
        const detail =
          axiosErr.response?.data?.detail ||
          axiosErr.response?.data?.username?.[0] ||
          axiosErr.response?.data?.email?.[0] ||
          axiosErr.response?.data?.password?.[0];
        if (mode === 'login' && status === 401) {
          setError('用户名或密码错误');
        } else if (detail) {
          setError(detail);
        } else {
          setError(mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试');
        }
      } else {
        setError('网络错误，请检查连接');
      }
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>后台管理系统</h1>
        <p className="subtitle">
          {isRegister ? '抑郁干预 AI 系统 - 医生注册' : '抑郁干预 AI 系统 - 管理员登录'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              placeholder={isRegister ? '请设置用户名' : '请输入用户名或邮箱'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          {isRegister && (
            <>
              <div className="form-group">
                <label htmlFor="email">邮箱</label>
                <input
                  id="email"
                  type="email"
                  placeholder="邮箱（与手机号至少填一个）"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">手机号</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="手机号（可选）"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">密码{isRegister ? '（至少 8 位）' : ''}</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? isRegister
                ? '注册中...'
                : '登录中...'
              : isRegister
                ? '注册并登录'
                : '登录'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          {isRegister ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: 14 }}
            >
              已有账号？返回登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('register')}
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: 14 }}
            >
              我是医生，我要创建账号
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
