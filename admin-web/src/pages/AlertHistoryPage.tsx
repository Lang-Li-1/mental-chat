import { useEffect, useState, useCallback } from 'react';
import { fetchAllCrisisAlerts } from '../services/patientService';
import type { CrisisAlert } from '../types';

const levelLabels: Record<string, string> = {
  high: '高危',
  medium: '中危',
  low: '低危',
  critical: '严重',
};

const statusLabels: Record<string, string> = {
  active: '待处理',
  acknowledged: '处理中',
  resolved: '已解决',
};

const levelColors: Record<string, string> = {
  high: '#dc2626',
  medium: '#ea580c',
  low: '#ca8a04',
  critical: '#7f1d1d',
};

const statusColors: Record<string, { bg: string; color: string }> = {
  active: { bg: '#fef3c7', color: '#92400e' },
  acknowledged: { bg: '#dbeafe', color: '#1e40af' },
  resolved: { bg: '#dcfce7', color: '#166534' },
};

function formatTime(time: string | null): string {
  if (!time) return '-';
  try {
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
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

function AlertHistoryPage() {
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Expanded detail
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterLevel) params.level = filterLevel;
      if (filterStatus) params.status = filterStatus;
      const data = await fetchAllCrisisAlerts(params);
      setAlerts(data);
    } catch {
      setError('获取告警历史失败');
    } finally {
      setLoading(false);
    }
  }, [filterLevel, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="page-content">
      <h2 className="page-title">告警历史</h2>

      {/* Filters */}
      <div className="alert-history-filters">
        <div className="filter-group">
          <label>等级</label>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
            <option value="">全部</option>
            <option value="critical">严重</option>
            <option value="high">高危</option>
            <option value="medium">中危</option>
            <option value="low">低危</option>
          </select>
        </div>
        <div className="filter-group">
          <label>状态</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="active">待处理</option>
            <option value="acknowledged">处理中</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
        <span style={{ fontSize: 14, color: '#6b7280', alignSelf: 'flex-end', paddingBottom: 10 }}>
          共 {alerts.length} 条记录
        </span>
      </div>

      {loading && <div className="loading">加载中...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && alerts.length === 0 && (
        <div className="empty">暂无告警记录</div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>等级</th>
              <th>状态</th>
              <th>用户 ID</th>
              <th>处理人</th>
              <th>创建时间</th>
              <th>解决时间</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <>
                <tr
                  key={alert.id}
                  onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td data-label="ID">{alert.id}</td>
                  <td data-label="等级">
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'white',
                        background: levelColors[alert.level] || '#6b7280',
                      }}
                    >
                      {levelLabels[alert.level] || alert.level}
                    </span>
                  </td>
                  <td data-label="状态">
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: statusColors[alert.status]?.bg || '#f3f4f6',
                        color: statusColors[alert.status]?.color || '#374151',
                      }}
                    >
                      {statusLabels[alert.status] || alert.status}
                    </span>
                  </td>
                  <td data-label="用户">{alert.user}</td>
                  <td data-label="处理人">{alert.handled_by_name || '-'}</td>
                  <td data-label="创建时间">{formatTime(alert.created_at)}</td>
                  <td data-label="解决时间">{formatTime(alert.resolved_at)}</td>
                </tr>
                {expandedId === alert.id && (
                  <tr key={`${alert.id}-detail`} className="expanded-row">
                    <td colSpan={7} style={{ padding: '12px 16px', background: '#f9fafb' }}>
                      <div className="alert-detail-grid">
                        {alert.description && (
                          <div>
                            <strong>描述：</strong>
                            <span>{alert.description}</span>
                          </div>
                        )}
                        {alert.location && (
                          <div>
                            <strong>位置：</strong>
                            <span>{alert.location}</span>
                          </div>
                        )}
                        {alert.acknowledged_at && (
                          <div>
                            <strong>确认时间：</strong>
                            <span>{formatTime(alert.acknowledged_at)}</span>
                          </div>
                        )}
                        {alert.processing_notes && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong>处理记录：</strong>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{alert.processing_notes}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AlertHistoryPage;
