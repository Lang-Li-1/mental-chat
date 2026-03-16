import { useEffect, useState } from 'react';
import { getAdminStats, exportCSV } from '../services/patientService';

interface Stats {
  users: { total: number; patients: number; professionals: number; supporters: number };
  mood_entries: { total: number; last_7_days: number; last_30_days: number; average_score: number | null };
  chat_messages: { total: number; last_7_days: number };
  crisis_alerts: { total: number; active: number; resolved: number; last_7_days: number; last_30_days: number };
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch {
        setError('获取统计数据失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
  if (error) return <div className="page-content"><div className="error-message">{error}</div></div>;
  if (!stats) return null;

  return (
    <div className="page-content">
      <div className="page-title-row">
        <h2 className="page-title" style={{ margin: 0 }}>数据概览</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-back" onClick={() => exportCSV('patients')} style={{ fontSize: 12, padding: '4px 12px' }}>
            导出患者
          </button>
          <button className="btn btn-back" onClick={() => exportCSV('mood_entries')} style={{ fontSize: 12, padding: '4px 12px' }}>
            导出情绪
          </button>
          <button className="btn btn-back" onClick={() => exportCSV('crisis_alerts')} style={{ fontSize: 12, padding: '4px 12px' }}>
            导出告警
          </button>
        </div>
      </div>

      {/* User stats */}
      <h3 className="section-title">用户统计</h3>
      <div className="stats-grid">
        <StatCard label="总用户" value={stats.users.total} color="#1e40af" />
        <StatCard label="患者" value={stats.users.patients} color="#2563eb" />
        <StatCard label="专业人员" value={stats.users.professionals} color="#16a34a" />
        <StatCard label="亲友" value={stats.users.supporters} color="#ca8a04" />
      </div>

      {/* Mood stats */}
      <h3 className="section-title" style={{ marginTop: 24 }}>情绪记录</h3>
      <div className="stats-grid">
        <StatCard label="总记录" value={stats.mood_entries.total} />
        <StatCard
          label="近7天"
          value={stats.mood_entries.last_7_days}
          sub={`近30天 ${stats.mood_entries.last_30_days}`}
        />
        <StatCard
          label="平均心情"
          value={stats.mood_entries.average_score !== null ? stats.mood_entries.average_score.toFixed(1) : '-'}
          color={
            stats.mood_entries.average_score !== null
              ? stats.mood_entries.average_score >= 7
                ? '#16a34a'
                : stats.mood_entries.average_score >= 4
                  ? '#ea580c'
                  : '#dc2626'
              : undefined
          }
          sub="满分 10"
        />
      </div>

      {/* Chat stats */}
      <h3 className="section-title" style={{ marginTop: 24 }}>对话消息</h3>
      <div className="stats-grid">
        <StatCard label="总消息" value={stats.chat_messages.total} />
        <StatCard label="近7天" value={stats.chat_messages.last_7_days} />
      </div>

      {/* Crisis stats */}
      <h3 className="section-title" style={{ marginTop: 24 }}>危机告警</h3>
      <div className="stats-grid">
        <StatCard label="总告警" value={stats.crisis_alerts.total} />
        <StatCard label="活跃" value={stats.crisis_alerts.active} color="#dc2626" />
        <StatCard label="已解决" value={stats.crisis_alerts.resolved} color="#16a34a" />
        <StatCard
          label="近7天"
          value={stats.crisis_alerts.last_7_days}
          sub={`近30天 ${stats.crisis_alerts.last_30_days}`}
        />
      </div>
    </div>
  );
}

export default StatsPage;
