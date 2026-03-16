import { useEffect, useState, useCallback } from 'react';
import { getAdminUsers, updateAdminUser } from '../services/patientService';
import type { Patient } from '../types';

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

function UserManagementPage() {
  const [users, setUsers] = useState<(Patient & { is_active?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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

  return (
    <div className="page-content">
      <h2 className="page-title">用户管理</h2>

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
