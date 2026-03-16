import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientDetail, type PatientDetail } from '../services/patientService';

function moodColor(score: number): string {
  if (score <= 2) return '#E25B5B';
  if (score <= 4) return '#E88B5A';
  if (score <= 6) return '#E8C34A';
  if (score <= 8) return '#5DBE8A';
  return '#3DA06A';
}

function levelLabel(level: string): string {
  const m: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' };
  return m[level] || level;
}

function levelColor(level: string): string {
  const m: Record<string, string> = { low: '#5DBE8A', medium: '#E8C34A', high: '#E88B5A', critical: '#E25B5B' };
  return m[level] || '#999';
}

function statusLabel(s: string): string {
  const m: Record<string, string> = { active: '活跃', acknowledged: '已确认', resolved: '已解决' };
  return m[s] || s;
}

function formatTime(t: string): string {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(t: string): string {
  return new Date(t).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

type TrendRange = 'today' | 'month' | 'year' | 'all';

function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendRange, setTrendRange] = useState<TrendRange>('month');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getPatientDetail(id);
        if (!cancelled) setData(detail);
      } catch {
        if (!cancelled) setError('获取患者信息失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="page-content"><div className="loading">加载中...</div></div>;
  if (error) return <div className="page-content"><div className="error-message">{error}</div></div>;
  if (!data) return null;

  const { user, mood_entries, average_mood_score, total_chat_messages, recent_sessions, crisis_alerts, assessments } = data;

  return (
    <div className="page-content">
      <div className="detail-header">
        <button className="btn btn-back" onClick={() => navigate('/')}>← 返回列表</button>
      </div>

      {/* Patient Info */}
      <div className="pd-info-card">
        <div className="pd-avatar">{user.username.charAt(0).toUpperCase()}</div>
        <div className="pd-info">
          <h2 className="pd-name">{user.username}</h2>
          <div className="pd-meta">
            {user.email && <span>✉️ {user.email}</span>}
            {user.phone && <span>📱 {user.phone}</span>}
            <span>📅 注册于 {formatDate(user.created_at)}</span>
          </div>
        </div>
        <div className="pd-stats-row">
          <div className="pd-stat">
            <div className="pd-stat-value" style={{ color: average_mood_score ? moodColor(Math.round(average_mood_score)) : '#999' }}>
              {average_mood_score ? average_mood_score.toFixed(1) : '--'}
            </div>
            <div className="pd-stat-label">平均心情</div>
          </div>
          <div className="pd-stat">
            <div className="pd-stat-value">{total_chat_messages}</div>
            <div className="pd-stat-label">对话消息</div>
          </div>
          <div className="pd-stat">
            <div className="pd-stat-value" style={{ color: crisis_alerts.filter(a => a.status === 'active').length > 0 ? '#E25B5B' : undefined }}>
              {crisis_alerts.filter(a => a.status === 'active').length}
            </div>
            <div className="pd-stat-label">活跃告警</div>
          </div>
          <div className="pd-stat">
            <div className="pd-stat-value">{mood_entries.length}</div>
            <div className="pd-stat-label">情绪记录</div>
          </div>
        </div>
      </div>

      {/* Mood Trend Chart */}
      {mood_entries.length > 0 && (() => {
        const now = new Date();
        const filteredEntries = mood_entries.filter((e) => {
          const d = new Date(e.created_at);
          switch (trendRange) {
            case 'today':
              return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
            case 'month':
              return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            case 'year':
              return d.getFullYear() === now.getFullYear();
            case 'all':
              return true;
          }
        });
        // Aggregate by date for chart
        const dayMap: Record<string, { total: number; count: number }> = {};
        filteredEntries.forEach((e) => {
          const d = new Date(e.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!dayMap[key]) dayMap[key] = { total: 0, count: 0 };
          dayMap[key].total += e.mood_score;
          dayMap[key].count++;
        });
        const chartData = Object.entries(dayMap)
          .map(([date, v]) => ({ date, avg_score: Math.round((v.total / v.count) * 10) / 10 }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14);
        const chartMax = Math.max(...chartData.map(m => m.avg_score), 10);
        const rangeLabels: Record<TrendRange, string> = { today: '今日', month: '本月', year: '本年', all: '全部' };

        return (
          <div className="pd-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="pd-section-title" style={{ margin: 0 }}>📈 情绪趋势</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['today', 'month', 'year', 'all'] as TrendRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTrendRange(r)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: trendRange === r ? '#3d7a5f' : '#f3f4f6',
                      color: trendRange === r ? '#fff' : '#6b7280',
                    }}
                  >
                    {rangeLabels[r]}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="pd-empty">该时间段暂无记录</div>
            ) : (
              <div className="pd-chart">
                <div className="pd-chart-bars">
                  {chartData.map((m, i) => (
                    <div key={i} className="pd-chart-col">
                      <div className="pd-chart-bar-track">
                        <div
                          className="pd-chart-bar"
                          style={{
                            height: `${(m.avg_score / chartMax) * 100}%`,
                            backgroundColor: moodColor(Math.round(m.avg_score)),
                          }}
                        >
                          <span className="pd-chart-bar-val">{m.avg_score}</span>
                        </div>
                      </div>
                      <span className="pd-chart-label">{formatDate(m.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="pd-grid">
        {/* Recent Mood Entries */}
        <div className="pd-section">
          <h3 className="pd-section-title">💚 近期情绪记录</h3>
          {mood_entries.length === 0 ? (
            <div className="pd-empty">暂无记录</div>
          ) : (
            <div className="pd-mood-list">
              {mood_entries.slice(0, 10).map((e) => (
                <div key={e.id} className="pd-mood-item">
                  <div className="pd-mood-score" style={{ backgroundColor: moodColor(e.mood_score) + '20', color: moodColor(e.mood_score) }}>
                    {e.mood_score}
                  </div>
                  <div className="pd-mood-body">
                    <div className="pd-mood-content">{e.content || '（无文字描述）'}</div>
                    <div className="pd-mood-time">{formatTime(e.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Sessions */}
        <div className="pd-section">
          <h3 className="pd-section-title">💬 近期对话</h3>
          {recent_sessions.length === 0 ? (
            <div className="pd-empty">暂无对话记录</div>
          ) : (
            <div className="pd-session-list">
              {recent_sessions.map((s) => (
                <div key={s.session_id} className="pd-session-item">
                  <div className="pd-session-preview">{s.preview || '（空对话）'}</div>
                  <div className="pd-session-meta">
                    <span>{s.message_count} 条消息</span>
                    <span>{formatTime(s.last_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pd-grid">
        {/* Crisis Alerts */}
        <div className="pd-section">
          <h3 className="pd-section-title">🚨 危机告警历史</h3>
          {crisis_alerts.length === 0 ? (
            <div className="pd-empty">暂无告警记录</div>
          ) : (
            <div className="pd-alert-list">
              {crisis_alerts.map((a) => (
                <div key={a.id} className="pd-alert-item">
                  <div className="pd-alert-left">
                    <span className="pd-alert-level" style={{ backgroundColor: levelColor(a.level) + '20', color: levelColor(a.level) }}>
                      {levelLabel(a.level)}
                    </span>
                    <span className="pd-alert-status">{statusLabel(a.status)}</span>
                  </div>
                  <div className="pd-alert-desc">{a.description || '（无描述）'}</div>
                  <div className="pd-alert-time">{formatTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessments */}
        <div className="pd-section">
          <h3 className="pd-section-title">📋 评估记录</h3>
          {assessments.length === 0 ? (
            <div className="pd-empty">暂无评估记录</div>
          ) : (
            <div className="pd-assess-list">
              {assessments.map((a) => (
                <div key={a.id} className="pd-assess-item">
                  <div className="pd-assess-type">{a.assessment_type === 'phq9' ? 'PHQ-9' : 'GAD-7'}</div>
                  <div className="pd-assess-score">{a.total_score}分</div>
                  <div className="pd-assess-severity">{a.severity}</div>
                  <div className="pd-assess-time">{formatTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetailPage;
