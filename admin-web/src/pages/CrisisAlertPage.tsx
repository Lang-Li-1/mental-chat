import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchActiveCrisisAlerts, updateAlertStatus, getPatientDetail, type PatientDetail } from '../services/patientService';
import type { CrisisAlert } from '../types';

const POLL_INTERVAL = 30000; // Fallback polling (30s instead of 5s, WebSocket is primary)
const WS_RECONNECT_DELAY = 3000;
const NEW_ALERT_DURATION = 10000;
const TIMEOUT_MINUTES = 5;

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

const levelColors: Record<string, { bg: string; border: string; tag: string }> = {
  high: { bg: '#fef2f2', border: '#dc2626', tag: '#dc2626' },
  medium: { bg: '#fff7ed', border: '#ea580c', tag: '#ea580c' },
  low: { bg: '#fefce8', border: '#ca8a04', tag: '#ca8a04' },
  critical: { bg: '#fef2f2', border: '#7f1d1d', tag: '#7f1d1d' },
};

function formatTime(time: string): string {
  try {
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return time;
  }
}

function formatShortTime(time: string): string {
  return new Date(time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function sortAlerts(alerts: CrisisAlert[]): CrisisAlert[] {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...alerts].sort((a, b) => {
    const diff = (order[a.level] ?? 4) - (order[b.level] ?? 4);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getRefreshDisplay(time: Date | null): string {
  if (!time) return '--';
  const diffSeconds = Math.floor((Date.now() - time.getTime()) / 1000);
  if (diffSeconds < 5) return '刚刚';
  if (diffSeconds < 60) return `${diffSeconds}秒前`;
  return `${Math.floor(diffSeconds / 60)}分钟前`;
}

function isTimedOut(alert: CrisisAlert): boolean {
  if (alert.status !== 'active') return false;
  const elapsed = Date.now() - new Date(alert.created_at).getTime();
  return elapsed > TIMEOUT_MINUTES * 60 * 1000;
}

function getElapsedMinutes(time: string): number {
  return Math.floor((Date.now() - new Date(time).getTime()) / 60000);
}

function moodColor(score: number): string {
  if (score <= 2) return '#E25B5B';
  if (score <= 4) return '#E88B5A';
  if (score <= 6) return '#E8C34A';
  if (score <= 8) return '#5DBE8A';
  return '#3DA06A';
}

function CrisisAlertPage() {
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshDisplay, setRefreshDisplay] = useState('--');
  const [newAlertIds, setNewAlertIds] = useState<Set<number>>(new Set());
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [, setTick] = useState(0); // force re-render for timeout checks
  const [filterLevel, setFilterLevel] = useState<string | null>(null); // filter by level

  // Patient detail panorama
  const [panoramaAlert, setPanoramaAlert] = useState<CrisisAlert | null>(null);
  const [panoramaData, setPanoramaData] = useState<PatientDetail | null>(null);
  const [panoramaLoading, setPanoramaLoading] = useState(false);

  // Notes dialog state
  const [notesDialog, setNotesDialog] = useState<{
    open: boolean;
    alertId: number | null;
    action: 'acknowledged' | 'resolved';
    notes: string;
  }>({ open: false, alertId: null, action: 'acknowledged', notes: '' });

  // WebSocket state — Phase 4.2
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const knownIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Request desktop notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // WebSocket connection for real-time alerts
  useEffect(() => {
    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseUrl = (import.meta as Record<string, Record<string, string>>).env?.VITE_API_BASE_URL || window.location.origin;
      const wsHost = baseUrl.replace(/^https?:\/\//, '');
      const ws = new WebSocket(`${protocol}//${wsHost}/ws/alerts/`);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'new') {
            // Add new alert
            setAlerts((prev) => {
              const exists = prev.some((a) => a.id === msg.alert.id);
              if (exists) return prev;
              const updated = sortAlerts([msg.alert, ...prev]);
              // Mark as new
              setNewAlertIds((nids) => {
                const next = new Set(nids);
                next.add(msg.alert.id);
                setTimeout(() => {
                  setNewAlertIds((p) => { const n = new Set(p); n.delete(msg.alert.id); return n; });
                }, NEW_ALERT_DURATION);
                return next;
              });
              knownIdsRef.current.add(msg.alert.id);
              // Desktop notification for high/critical alerts
              if (
                'Notification' in window &&
                Notification.permission === 'granted' &&
                (msg.alert.level === 'high' || msg.alert.level === 'critical')
              ) {
                new Notification('高危告警', {
                  body: `用户 #${msg.alert.user} — ${levelLabels[msg.alert.level] || msg.alert.level}`,
                  tag: `crisis-${msg.alert.id}`,
                });
              }
              return updated;
            });
          } else if (msg.event === 'updated') {
            // Update existing alert or remove if resolved
            if (msg.alert.status === 'resolved') {
              setAlerts((prev) => prev.filter((a) => a.id !== msg.alert.id));
            } else {
              setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)));
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Reconnect after delay
        wsReconnectTimer.current = setTimeout(connectWs, WS_RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    }

    connectWs();

    return () => {
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchActiveCrisisAlerts();
      const sorted = sortAlerts(data);

      if (!isFirstLoadRef.current) {
        const incomingIds = new Set(sorted.map((a) => a.id));
        const brandNew = new Set<number>();
        for (const id of incomingIds) {
          if (!knownIdsRef.current.has(id)) {
            brandNew.add(id);
          }
        }
        if (brandNew.size > 0) {
          setNewAlertIds((prev) => new Set([...prev, ...brandNew]));
          setTimeout(() => {
            setNewAlertIds((prev) => {
              const next = new Set(prev);
              for (const id of brandNew) next.delete(id);
              return next;
            });
          }, NEW_ALERT_DURATION);
        }
        knownIdsRef.current = incomingIds;
      } else {
        knownIdsRef.current = new Set(sorted.map((a) => a.id));
        isFirstLoadRef.current = false;
      }

      setAlerts(sorted);
      setHasError(false);
      setErrorMessage('');
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setHasError(true);
      setErrorMessage(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const pollTimer = setInterval(fetchAlerts, POLL_INTERVAL);
    const displayTimer = setInterval(() => {
      setRefreshDisplay(getRefreshDisplay(lastRefresh));
      setTick(t => t + 1); // update timeout highlights
    }, 1000);
    return () => {
      clearInterval(pollTimer);
      clearInterval(displayTimer);
    };
  }, [fetchAlerts]);

  useEffect(() => {
    setRefreshDisplay(getRefreshDisplay(lastRefresh));
  }, [lastRefresh]);

  const openNotesDialog = (alertId: number, action: 'acknowledged' | 'resolved') => {
    setNotesDialog({ open: true, alertId, action, notes: '' });
  };

  const closeNotesDialog = () => {
    setNotesDialog({ open: false, alertId: null, action: 'acknowledged', notes: '' });
  };

  const handleSubmitAction = async () => {
    if (!notesDialog.alertId) return;
    if (!notesDialog.notes.trim()) return;

    setUpdatingId(notesDialog.alertId);
    closeNotesDialog();
    try {
      if (notesDialog.action === 'acknowledged') {
        const updated = await updateAlertStatus(notesDialog.alertId, 'acknowledged', notesDialog.notes);
        setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        await updateAlertStatus(notesDialog.alertId, 'resolved', notesDialog.notes);
        setAlerts((prev) => prev.filter((a) => a.id !== notesDialog.alertId));
      }
    } catch {
      // Next poll will correct state
    } finally {
      setUpdatingId(null);
    }
  };

  const openPanorama = async (alert: CrisisAlert) => {
    setPanoramaAlert(alert);
    setPanoramaData(null);
    setPanoramaLoading(true);
    try {
      const detail = await getPatientDetail(String(alert.user));
      setPanoramaData(detail);
    } catch {
      // leave data null to show error state
    } finally {
      setPanoramaLoading(false);
    }
  };

  const closePanorama = () => {
    setPanoramaAlert(null);
    setPanoramaData(null);
  };

  const highCount = alerts.filter((a) => a.level === 'high' || a.level === 'critical').length;
  const mediumCount = alerts.filter((a) => a.level === 'medium').length;
  const lowCount = alerts.filter((a) => a.level === 'low').length;
  const timeoutCount = alerts.filter(isTimedOut).length;

  return (
    <div className="crisis-dashboard">
      {/* Header */}
      <div className="crisis-header">
        <div className="crisis-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ color: '#f87171', fontSize: 28 }}>&#9888;</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>紧急服务监控中心</h1>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Crisis Alert Dashboard</p>
            </div>
          </div>
          <div className={`crisis-status ${hasError ? 'crisis-status-error' : 'crisis-status-online'}`}>
            <span className="crisis-status-dot" />
            <span>{hasError ? '连接异常' : wsConnected ? '实时监控中 (WS)' : '轮询监控中'}</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="crisis-stats-bar">
        <div className="crisis-stat-item" onClick={() => setFilterLevel(filterLevel === null ? null : null)} style={{ cursor: 'pointer', outline: filterLevel === null ? '2px solid #3d7a5f' : 'none', borderRadius: 12 }}>
          <span className="crisis-stat-number">{alerts.length}</span>
          <span className="crisis-stat-label">活跃警报</span>
        </div>
        <div className="crisis-stat-item" onClick={() => setFilterLevel(filterLevel === 'high' ? null : 'high')} style={{ cursor: 'pointer', outline: filterLevel === 'high' ? '2px solid #dc2626' : 'none', borderRadius: 12 }}>
          <span className="crisis-stat-number" style={{ color: '#dc2626' }}>{highCount}</span>
          <span className="crisis-stat-label">高危</span>
        </div>
        <div className="crisis-stat-item" onClick={() => setFilterLevel(filterLevel === 'medium' ? null : 'medium')} style={{ cursor: 'pointer', outline: filterLevel === 'medium' ? '2px solid #ea580c' : 'none', borderRadius: 12 }}>
          <span className="crisis-stat-number" style={{ color: '#ea580c' }}>{mediumCount}</span>
          <span className="crisis-stat-label">中危</span>
        </div>
        <div className="crisis-stat-item" onClick={() => setFilterLevel(filterLevel === 'low' ? null : 'low')} style={{ cursor: 'pointer', outline: filterLevel === 'low' ? '2px solid #ca8a04' : 'none', borderRadius: 12 }}>
          <span className="crisis-stat-number" style={{ color: '#ca8a04' }}>{lowCount}</span>
          <span className="crisis-stat-label">低危</span>
        </div>
        {timeoutCount > 0 && (
          <div className="crisis-stat-item" onClick={() => setFilterLevel(filterLevel === 'timeout' ? null : 'timeout')} style={{ border: '2px solid #dc2626', cursor: 'pointer', outline: filterLevel === 'timeout' ? '2px solid #7f1d1d' : 'none', borderRadius: 12 }}>
            <span className="crisis-stat-number" style={{ color: '#dc2626' }}>{timeoutCount}</span>
            <span className="crisis-stat-label">超时未处理</span>
          </div>
        )}
        {filterLevel && (
          <div className="crisis-stat-item" onClick={() => setFilterLevel(null)} style={{ cursor: 'pointer', backgroundColor: '#f0fdf4', borderRadius: 12 }}>
            <span style={{ fontSize: 12, color: '#3d7a5f', fontWeight: 600 }}>清除筛选 ×</span>
          </div>
        )}
        <div className="crisis-stat-item" style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
          <span className="crisis-stat-label">上次刷新</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{refreshDisplay}</span>
          {isLoading && <span className="crisis-refresh-spinner" />}
        </div>
      </div>

      {/* Error Banner */}
      {hasError && (
        <div className="crisis-error-banner">
          <span>无法连接到服务器: {errorMessage}</span>
          <button className="crisis-retry-btn" onClick={fetchAlerts}>重试</button>
        </div>
      )}

      {/* Alert List */}
      <div className="crisis-alert-container">
        {isLoading && alerts.length === 0 && (
          <div className="loading" style={{ padding: 80 }}>
            <div className="crisis-spinner" />
            <p>正在加载警报数据...</p>
          </div>
        )}

        {!isLoading && alerts.length === 0 && !hasError && (
          <div className="empty" style={{ padding: 80 }}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>当前没有活跃的危机警报</p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>系统正在持续监控中，新警报将自动显示</p>
          </div>
        )}

        {alerts.length > 0 && (() => {
          const displayAlerts = filterLevel
            ? filterLevel === 'timeout'
              ? alerts.filter(isTimedOut)
              : filterLevel === 'high'
                ? alerts.filter(a => a.level === 'high' || a.level === 'critical')
                : alerts.filter(a => a.level === filterLevel)
            : alerts;
          return displayAlerts.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>当前筛选条件下没有警报</p>
            </div>
          ) : (
          <div className="crisis-alert-grid">
            {displayAlerts.map((alert) => {
              const colors = levelColors[alert.level] || levelColors.low;
              const isNew = newAlertIds.has(alert.id);
              const isUpdating = updatingId === alert.id;
              const timedOut = isTimedOut(alert);
              const elapsed = getElapsedMinutes(alert.created_at);
              return (
                <div
                  key={alert.id}
                  className={`crisis-alert-card${timedOut ? ' crisis-timeout' : ''}`}
                  style={{
                    backgroundColor: colors.bg,
                    borderLeftColor: colors.border,
                  }}
                >
                  {isNew && <div className="crisis-new-badge">NEW</div>}
                  {timedOut && (
                    <div className="crisis-timeout-badge">
                      &#9200; 超时 {elapsed} 分钟
                    </div>
                  )}
                  <div className="crisis-alert-header">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        className="crisis-level-tag"
                        style={{ backgroundColor: colors.tag }}
                      >
                        {levelLabels[alert.level] || alert.level}
                      </span>
                      <span className="crisis-status-label" data-status={alert.status}>
                        {statusLabels[alert.status] || alert.status}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {formatTime(alert.created_at)}
                    </span>
                  </div>
                  <div className="crisis-alert-body">
                    <div className="crisis-alert-field">
                      <span className="crisis-field-label">用户 ID</span>
                      <span className="crisis-field-value">{alert.user}</span>
                    </div>
                    <div className="crisis-alert-field">
                      <span className="crisis-field-label">危险等级</span>
                      <span className="crisis-field-value">{levelLabels[alert.level] || alert.level}</span>
                    </div>
                    <div className="crisis-alert-field">
                      <span className="crisis-field-label">位置</span>
                      <span className="crisis-field-value">{alert.location || '未知'}</span>
                    </div>
                    <div className="crisis-alert-field">
                      <span className="crisis-field-label">处理人</span>
                      <span className="crisis-field-value">{alert.handled_by_name || '未认领'}</span>
                    </div>
                    {alert.description && (
                      <div className="crisis-alert-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="crisis-field-label">详情</span>
                        <span className="crisis-field-value">{alert.description}</span>
                      </div>
                    )}
                    {alert.processing_notes && (
                      <div className="crisis-alert-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="crisis-field-label">处理记录</span>
                        <span className="crisis-field-value" style={{ whiteSpace: 'pre-wrap' }}>
                          {alert.processing_notes}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="crisis-alert-actions">
                    {alert.status === 'active' && (
                      <button
                        className="crisis-action-btn crisis-action-ack"
                        disabled={isUpdating}
                        onClick={(e) => { e.stopPropagation(); openNotesDialog(alert.id, 'acknowledged'); }}
                      >
                        {isUpdating ? '处理中...' : '确认接收'}
                      </button>
                    )}
                    {(alert.status === 'active' || alert.status === 'acknowledged') && (
                      <button
                        className="crisis-action-btn crisis-action-resolve"
                        disabled={isUpdating}
                        onClick={(e) => { e.stopPropagation(); openNotesDialog(alert.id, 'resolved'); }}
                      >
                        {isUpdating ? '处理中...' : '标记已解决'}
                      </button>
                    )}
                    <button
                      className="crisis-action-btn crisis-action-detail"
                      onClick={(e) => { e.stopPropagation(); openPanorama(alert); }}
                    >
                      查看患者详情
                    </button>
                    {alert.acknowledged_at && (
                      <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                        已确认于 {formatTime(alert.acknowledged_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>

      {/* Notes Dialog */}
      {notesDialog.open && (
        <div className="notes-dialog-overlay" onClick={closeNotesDialog}>
          <div className="notes-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="notes-dialog-title">
              {notesDialog.action === 'acknowledged' ? '确认接收告警' : '标记告警已解决'}
            </h3>
            <p className="notes-dialog-hint">
              请填写处理记录（必填）
            </p>
            <textarea
              className="notes-dialog-textarea"
              placeholder="请输入处理记录..."
              value={notesDialog.notes}
              onChange={(e) => setNotesDialog((prev) => ({ ...prev, notes: e.target.value }))}
              autoFocus
              rows={4}
            />
            <div className="notes-dialog-actions">
              <button className="notes-dialog-cancel" onClick={closeNotesDialog}>取消</button>
              <button
                className="notes-dialog-submit"
                disabled={!notesDialog.notes.trim()}
                onClick={handleSubmitAction}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Detail Panorama Modal */}
      {panoramaAlert && (
        <div className="notes-dialog-overlay" onClick={closePanorama}>
          <div className="panorama-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="panorama-header">
              <h3>患者全景 — 用户 #{panoramaAlert.user}</h3>
              <button className="panorama-close" onClick={closePanorama}>×</button>
            </div>
            {panoramaLoading && (
              <div className="loading" style={{ padding: 40 }}>加载中...</div>
            )}
            {!panoramaLoading && !panoramaData && (
              <div className="pd-empty">无法获取患者信息</div>
            )}
            {!panoramaLoading && panoramaData && (
              <div className="panorama-body">
                {/* Patient Info */}
                <div className="panorama-info-row">
                  <div className="panorama-info-item">
                    <span className="panorama-label">用户名</span>
                    <span className="panorama-value">{panoramaData.user.username}</span>
                  </div>
                  <div className="panorama-info-item">
                    <span className="panorama-label">平均心情</span>
                    <span className="panorama-value" style={{ color: panoramaData.average_mood_score ? moodColor(Math.round(panoramaData.average_mood_score)) : undefined }}>
                      {panoramaData.average_mood_score ? panoramaData.average_mood_score.toFixed(1) : '--'}
                    </span>
                  </div>
                  <div className="panorama-info-item">
                    <span className="panorama-label">对话消息数</span>
                    <span className="panorama-value">{panoramaData.total_chat_messages}</span>
                  </div>
                  <div className="panorama-info-item">
                    <span className="panorama-label">情绪记录数</span>
                    <span className="panorama-value">{panoramaData.mood_entries.length}</span>
                  </div>
                </div>

                {/* Current Alert */}
                <div className="panorama-section">
                  <h4>当前告警</h4>
                  <div className="panorama-alert-info">
                    <span className="crisis-level-tag" style={{ backgroundColor: (levelColors[panoramaAlert.level] || levelColors.low).tag }}>
                      {levelLabels[panoramaAlert.level]}
                    </span>
                    <span style={{ fontSize: 14 }}>{panoramaAlert.description || '（无描述）'}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formatTime(panoramaAlert.created_at)}</span>
                  </div>
                </div>

                {/* Recent Moods */}
                <div className="panorama-section">
                  <h4>近期情绪（最近5条）</h4>
                  {panoramaData.mood_entries.length === 0 ? (
                    <div className="pd-empty" style={{ padding: 12 }}>暂无记录</div>
                  ) : (
                    <div className="panorama-mood-list">
                      {panoramaData.mood_entries.slice(0, 5).map(e => (
                        <div key={e.id} className="panorama-mood-item">
                          <span className="panorama-mood-score" style={{ color: moodColor(e.mood_score) }}>{e.mood_score}</span>
                          <span className="panorama-mood-text">{e.content || '（无文字）'}</span>
                          <span className="panorama-mood-time">{formatShortTime(e.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Sessions */}
                <div className="panorama-section">
                  <h4>近期对话</h4>
                  {panoramaData.recent_sessions.length === 0 ? (
                    <div className="pd-empty" style={{ padding: 12 }}>暂无对话</div>
                  ) : (
                    <div className="panorama-mood-list">
                      {panoramaData.recent_sessions.map(s => (
                        <div key={s.session_id} className="panorama-mood-item">
                          <span className="panorama-mood-text">{s.preview || '（空对话）'}</span>
                          <span className="panorama-mood-time">{s.message_count}条 · {formatShortTime(s.last_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Crisis History */}
                {panoramaData.crisis_alerts.length > 1 && (
                  <div className="panorama-section">
                    <h4>历史告警（{panoramaData.crisis_alerts.length}条）</h4>
                    <div className="panorama-mood-list">
                      {panoramaData.crisis_alerts.slice(0, 5).map(a => (
                        <div key={a.id} className="panorama-mood-item">
                          <span className="crisis-level-tag" style={{ backgroundColor: (levelColors[a.level] || levelColors.low).tag, fontSize: 11, padding: '1px 6px' }}>
                            {levelLabels[a.level]}
                          </span>
                          <span className="panorama-mood-text">{a.description || '（无描述）'}</span>
                          <span className="panorama-mood-time">{formatShortTime(a.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CrisisAlertPage;
