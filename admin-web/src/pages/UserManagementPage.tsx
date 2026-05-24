import { useEffect, useState, useCallback } from 'react';
import { getAdminUsers, updateAdminUser, createAdminUser } from '../services/patientService';
import type { Patient } from '../types';
import { toChineseErrorMessage } from '../utils/errorMessage';

const roleLabels: Record<string, string> = {
  patient: '患者',
  professional: '专业人员',
  supporter: '亲友',
  admin: '管理员',
};

const roleColors: Record<string, { bg: string; color: string }> = {
  patient: { bg: '#dbeafe', color: '#1e40af' },
  professional: { bg: '#dcfce7', color: '#166534' },
  supporter: { bg: '#fef3c7', color: '#92400e' },
  admin: { bg: '#f3e8ff', color: '#6b21a8' },
};

function formatTime(time: string | null): string {
  if (!time) return '-';
  try {
    return new Date(time).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return time || '-';
  }
}

type CreateForm = {
  username: string;
  password: string;
  role: 'admin' | 'professional';
  email: string;
  phone: string;
};

const emptyForm: CreateForm = {
  username: '',
  password: '',
  role: 'professional',
  email: '',
  phone: '',
};

function UserManagementPage() {
  const [users, setUsers] = useState<(Patient & { is_active?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (roleFilter) params.role = roleFilter;
      if (search.trim()) params.search = search.trim();
      const data = await getAdminUsers(params);
      setUsers(data);
    } catch {
      setError('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleToggleActive = async (user: Patient & { is_active?: boolean }) => {
    setUpdatingId(user.id);
    try {
      const updated = await updateAdminUser(user.id, { is_active: !(user as any).is_active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setCreateError('');
    const username = createForm.username.trim();
    const password = createForm.password;
    if (!username || !password) {
      setCreateError('用户名和密码必填');
      return;
    }
    if (password.length < 8) {
      setCreateError('密码至少 8 位');
      return;
    }
    setCreating(true);
    try {
      await createAdminUser({
        username,
        password,
        role: createForm.role,
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
      });
      setShowCreate(false);
      await fetchUsers();
    } catch (err: any) {
      setCreateError(toChineseErrorMessage(err?.response?.data?.detail, '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>用户管理</h2>
        <button className="btn" onClick={openCreate} style={{ padding: '8px 16px' }}>
          + 新增管理员/医生
        </button>
      </div>

      <div className="alert-history-filters">
        <div className="filter-group">
          <label>角色</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="patient">患者</option>
            <option value="professional">专业人员</option>
            <option value="supporter">亲友</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div className="filter-group" style={{ flex: 1, minWidth: 200 }}>
          <label>搜索</label>
          <input
            type="text"
            placeholder="用户名、邮箱、手机号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <span style={{ fontSize: 14, color: '#6b7280', alignSelf: 'flex-end', paddingBottom: 10 }}>
          共 {users.length} 名用户
        </span>
      </div>

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && users.length === 0 && (
        <div className="empty">暂无用户</div>
      )}

      {showCreate && (
        <div
          onClick={() => !creating && setShowCreate(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 8, padding: 24,
              width: '100%', maxWidth: 420, boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>新增管理员 / 医生</h3>

            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#374151' }}>
                角色
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'professional' })}
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                >
                  <option value="professional">医生（专业人员）</option>
                  <option value="admin">管理员</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#374151' }}>
                用户名 *
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#374151' }}>
                密码 *（至少 8 位）
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#374151' }}>
                邮箱
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#374151' }}>
                手机号
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                />
              </label>

              {createError && (
                <div style={{ color: '#b91c1c', fontSize: 13 }}>{createError}</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                className="btn btn-back"
                disabled={creating}
                onClick={() => setShowCreate(false)}
                style={{ padding: '8px 16px' }}
              >
                取消
              </button>
              <button
                className="btn"
                disabled={creating}
                onClick={handleCreate}
                style={{ padding: '8px 16px' }}
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>手机</th>
              <th>角色</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ cursor: 'default' }}>
                <td data-label="ID">{user.id}</td>
                <td data-label="用户名">{user.username}</td>
                <td data-label="邮箱">{user.email || '-'}</td>
                <td data-label="手机">{user.phone || '-'}</td>
                <td data-label="角色">
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: roleColors[user.role]?.bg || '#f3f4f6',
                      color: roleColors[user.role]?.color || '#374151',
                    }}
                  >
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td data-label="注册时间">{formatTime(user.created_at)}</td>
                <td data-label="操作">
                  <button
                    className={`btn ${(user as any).is_active === false ? 'btn-back' : 'btn-danger'}`}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    disabled={updatingId === user.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(user);
                    }}
                  >
                    {updatingId === user.id
                      ? '...'
                      : (user as any).is_active === false
                        ? '启用'
                        : '禁用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default UserManagementPage;
