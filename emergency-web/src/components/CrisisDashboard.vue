<template>
  <div class="dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h1 class="header-title">紧急服务监控中心</h1>
            <p class="header-subtitle">Crisis Alert Dashboard</p>
          </div>
        </div>
        <div class="header-right">
          <div class="status-indicator" :class="{ 'status-online': !hasError, 'status-error': hasError }">
            <span class="status-dot"></span>
            <span class="status-text">{{ hasError ? '连接异常' : '实时监控中' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-number">{{ alerts.length }}</span>
        <span class="stat-label">活跃警报</span>
      </div>
      <div class="stat-item stat-high">
        <span class="stat-number">{{ highCount }}</span>
        <span class="stat-label">高危</span>
      </div>
      <div class="stat-item stat-medium">
        <span class="stat-number">{{ mediumCount }}</span>
        <span class="stat-label">中危</span>
      </div>
      <div class="stat-item stat-low">
        <span class="stat-number">{{ lowCount }}</span>
        <span class="stat-label">低危</span>
      </div>
      <div class="stat-item stat-refresh">
        <span class="stat-label">上次刷新</span>
        <span class="stat-time">{{ lastRefreshDisplay }}</span>
        <span class="refresh-indicator" :class="{ 'refreshing': isLoading }"></span>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="hasError" class="error-banner">
      <span>无法连接到服务器: {{ errorMessage }}</span>
      <button class="retry-button" @click="fetchAlerts">重试</button>
    </div>

    <!-- Alert List -->
    <main class="alert-list-container">
      <div v-if="isLoading && alerts.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>正在加载警报数据...</p>
      </div>

      <div v-else-if="alerts.length === 0 && !hasError" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p>当前没有活跃的危机警报</p>
        <p class="empty-hint">系统正在持续监控中，新警报将自动显示</p>
      </div>

      <div v-else class="alert-list">
        <AlertCard
          v-for="alert in alerts"
          :key="alert.id"
          :alert="alert"
          :is-new="newAlertIds.has(alert.id)"
          :loading="updatingAlertId === alert.id"
          @acknowledge="handleAcknowledge"
          @resolve="handleResolve"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchActiveCrisisAlerts, updateAlertStatus } from '../services/api'
import type { CrisisAlert } from '../types/crisis'
import AlertCard from './AlertCard.vue'

const POLL_INTERVAL = 5000
const NEW_ALERT_DURATION = 10000

const alerts = ref<CrisisAlert[]>([])
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const lastRefreshTime = ref<Date | null>(null)
const lastRefreshDisplay = ref('--')
const newAlertIds = ref<Set<number>>(new Set())
const updatingAlertId = ref<number | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let refreshDisplayTimer: ReturnType<typeof setInterval> | null = null
let knownAlertIds = new Set<number>()
let isFirstLoad = true

const highCount = computed(() => alerts.value.filter((a) => a.level === 'high' || a.level === 'critical').length)
const mediumCount = computed(() => alerts.value.filter((a) => a.level === 'medium').length)
const lowCount = computed(() => alerts.value.filter((a) => a.level === 'low').length)

function updateRefreshDisplay() {
  if (!lastRefreshTime.value) {
    lastRefreshDisplay.value = '--'
    return
  }
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - lastRefreshTime.value.getTime()) / 1000)
  if (diffSeconds < 5) {
    lastRefreshDisplay.value = '刚刚'
  } else if (diffSeconds < 60) {
    lastRefreshDisplay.value = `${diffSeconds}秒前`
  } else {
    const diffMinutes = Math.floor(diffSeconds / 60)
    lastRefreshDisplay.value = `${diffMinutes}分钟前`
  }
}

function sortAlerts(alertList: CrisisAlert[]): CrisisAlert[] {
  const levelOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return [...alertList].sort((a, b) => {
    const levelDiff = (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3)
    if (levelDiff !== 0) return levelDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

async function fetchAlerts() {
  isLoading.value = true
  try {
    const data = await fetchActiveCrisisAlerts()
    const incoming = sortAlerts(data)

    if (!isFirstLoad) {
      const incomingIds = new Set(incoming.map((a) => a.id))
      const brandNew = new Set<number>()
      for (const id of incomingIds) {
        if (!knownAlertIds.has(id)) {
          brandNew.add(id)
        }
      }
      if (brandNew.size > 0) {
        for (const id of brandNew) {
          newAlertIds.value.add(id)
        }
        setTimeout(() => {
          for (const id of brandNew) {
            newAlertIds.value.delete(id)
          }
        }, NEW_ALERT_DURATION)
      }
      knownAlertIds = incomingIds
    } else {
      knownAlertIds = new Set(incoming.map((a) => a.id))
      isFirstLoad = false
    }

    alerts.value = incoming
    hasError.value = false
    errorMessage.value = ''
    lastRefreshTime.value = new Date()
    updateRefreshDisplay()
  } catch (err: unknown) {
    hasError.value = true
    if (err instanceof Error) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = '未知错误'
    }
  } finally {
    isLoading.value = false
  }
}

async function handleAcknowledge(id: number) {
  updatingAlertId.value = id
  try {
    const updated = await updateAlertStatus(id, 'acknowledged')
    alerts.value = alerts.value.map((a) => (a.id === id ? updated : a))
  } catch {
    // Silently fail — next poll will correct state
  } finally {
    updatingAlertId.value = null
  }
}

async function handleResolve(id: number) {
  updatingAlertId.value = id
  try {
    await updateAlertStatus(id, 'resolved')
    alerts.value = alerts.value.filter((a) => a.id !== id)
  } catch {
    // Silently fail — next poll will correct state
  } finally {
    updatingAlertId.value = null
  }
}

onMounted(() => {
  fetchAlerts()
  
  // Establish WebSocket Connection
  const wsUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws/alerts/';
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const msg = data.message;
      if (msg && msg.action) {
        if (msg.action === 'create' || msg.action === 'update') {
          // Add or update alert in the local list
          const incomingAlert = msg.data;
          const idx = alerts.value.findIndex(a => a.id === incomingAlert.id);
          
          if (idx !== -1) {
            // update
            const updatedAlerts = [...alerts.value];
            updatedAlerts[idx] = incomingAlert;
            // if resolved, filter it out
            if (incomingAlert.status === 'resolved') {
                alerts.value = updatedAlerts.filter(a => a.id !== incomingAlert.id);
            } else {
                alerts.value = sortAlerts(updatedAlerts);
            }
          } else {
            // create
            if (incomingAlert.status !== 'resolved') {
                alerts.value = sortAlerts([...alerts.value, incomingAlert]);
                newAlertIds.value.add(incomingAlert.id);
                setTimeout(() => {
                    newAlertIds.value.delete(incomingAlert.id);
                }, NEW_ALERT_DURATION);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing WS message', e);
    }
  };

  ws.onerror = () => {
    hasError.value = true;
    errorMessage.value = 'WebSocket connection error';
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Fallback to polling if WS dies
    if (!pollTimer) {
      pollTimer = setInterval(fetchAlerts, POLL_INTERVAL);
    }
  };

  // Only start polling if we are not relying fully on WS or if WS fails
  // Here we'll just poll occasionally as a fallback to ensure sync
  pollTimer = setInterval(fetchAlerts, POLL_INTERVAL * 6); // e.g. every 30s as fallback sync
  refreshDisplayTimer = setInterval(updateRefreshDisplay, 1000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (refreshDisplayTimer) clearInterval(refreshDisplayTimer)
})

</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background-color: #f3f4f6;
}

/* Header */
.dashboard-header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: white;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  color: #f87171;
}

.header-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.5px;
}

.header-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 2px 0 0 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.status-online {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.status-error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-online .status-dot {
  background-color: #22c55e;
  animation: blink 2s ease-in-out infinite;
}

.status-error .status-dot {
  background-color: #ef4444;
}

/* Stats Bar */
.stats-bar {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.stat-item {
  background: white;
  border-radius: 8px;
  padding: 12px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  font-weight: 500;
}

.stat-high .stat-number {
  color: #dc2626;
}

.stat-medium .stat-number {
  color: #ea580c;
}

.stat-low .stat-number {
  color: #ca8a04;
}

.stat-refresh {
  margin-left: auto;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  position: relative;
}

.stat-time {
  font-size: 14px;
  color: #1f2937;
  font-weight: 600;
}

.refresh-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  border-top-color: transparent;
  display: inline-block;
  opacity: 0;
  transition: opacity 0.2s;
}

.refresh-indicator.refreshing {
  opacity: 1;
  animation: spin 0.8s linear infinite;
}

/* Error Banner */
.error-banner {
  max-width: 1200px;
  margin: 0 auto 0;
  padding: 12px 24px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: auto;
  margin-right: auto;
  margin-top: 0;
  margin-bottom: 0;
  box-sizing: border-box;
  font-size: 14px;
}

.retry-button {
  background: #dc2626;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s;
}

.retry-button:hover {
  background: #b91c1c;
}

/* Alert List */
.alert-list-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px 32px;
}

.alert-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 14px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #6b7280;
  gap: 16px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #6b7280;
  gap: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.empty-hint {
  font-size: 13px !important;
  color: #9ca3af !important;
  font-weight: 400 !important;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    padding: 14px 16px;
  }

  .header-title {
    font-size: 18px;
  }

  .stats-bar {
    padding: 12px 16px;
    gap: 8px;
  }

  .stat-item {
    padding: 10px 14px;
    min-width: 65px;
    flex: 1;
  }

  .stat-number {
    font-size: 22px;
  }

  .stat-refresh {
    margin-left: 0;
    width: 100%;
    justify-content: center;
    margin-top: 4px;
  }

  .alert-list-container {
    padding: 12px 16px 24px;
  }

  .alert-list {
    grid-template-columns: 1fr;
  }

  .error-banner {
    margin: 0 16px;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .header-left {
    gap: 10px;
  }

  .header-icon svg {
    width: 22px;
    height: 22px;
  }

  .header-title {
    font-size: 16px;
  }

  .header-subtitle {
    display: none;
  }
}
</style>
