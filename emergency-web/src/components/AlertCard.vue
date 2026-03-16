<template>
  <div class="alert-card" :class="[levelClass, statusClass]">
    <div v-if="isNew" class="new-badge">NEW</div>
    <div class="alert-header">
      <div class="alert-header-left">
        <span class="alert-level-tag" :class="levelClass">
          {{ levelLabel }}
        </span>
        <span class="alert-status-tag" :class="statusClass">
          {{ statusLabel }}
        </span>
      </div>
      <span class="alert-time">{{ formattedTime }}</span>
    </div>
    <div class="alert-body">
      <div class="alert-field">
        <span class="field-label">用户 ID</span>
        <span class="field-value">{{ alert.user }}</span>
      </div>
      <div class="alert-field">
        <span class="field-label">危险等级</span>
        <span class="field-value">{{ levelLabel }}</span>
      </div>
      <div class="alert-field">
        <span class="field-label">位置</span>
        <span class="field-value">{{ alert.location || '未知' }}</span>
      </div>
      <div class="alert-field">
        <span class="field-label">处理人</span>
        <span class="field-value">{{ alert.handled_by_name || '未认领' }}</span>
      </div>
      <div v-if="alert.description" class="alert-field alert-message">
        <span class="field-label">详情</span>
        <span class="field-value">{{ alert.description }}</span>
      </div>
    </div>
    <div class="alert-actions">
      <button
        v-if="alert.status === 'active'"
        class="action-btn action-acknowledge"
        :disabled="loading"
        @click="$emit('acknowledge', alert.id)"
      >
        {{ loading ? '处理中...' : '确认接收' }}
      </button>
      <button
        v-if="alert.status === 'active' || alert.status === 'acknowledged'"
        class="action-btn action-resolve"
        :disabled="loading"
        @click="$emit('resolve', alert.id)"
      >
        {{ loading ? '处理中...' : '标记已解决' }}
      </button>
      <span v-if="alert.status === 'acknowledged' && alert.acknowledged_at" class="action-timestamp">
        已确认于 {{ formatTimestamp(alert.acknowledged_at) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CrisisAlert } from '../types/crisis'

const props = defineProps<{
  alert: CrisisAlert
  isNew: boolean
  loading?: boolean
}>()

defineEmits<{
  acknowledge: [id: number]
  resolve: [id: number]
}>()

const levelClass = computed(() => `level-${props.alert.level}`)
const statusClass = computed(() => `status-${props.alert.status}`)

const levelLabel = computed(() => {
  const labels: Record<string, string> = {
    high: '高危',
    medium: '中危',
    low: '低危',
    critical: '严重',
  }
  return labels[props.alert.level] || props.alert.level
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    active: '待处理',
    acknowledged: '处理中',
    resolved: '已解决',
  }
  return labels[props.alert.status] || props.alert.status
})

const formattedTime = computed(() => {
  try {
    const date = new Date(props.alert.created_at)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return props.alert.created_at
  }
})

function formatTimestamp(ts: string | null): string {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}
</script>

<style scoped>
.alert-card {
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: slideIn 0.4s ease-out;
}

.alert-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.alert-card.status-acknowledged {
  opacity: 0.85;
}

.level-high,
.level-critical {
  background-color: #fef2f2;
  border-left: 5px solid #dc2626;
}

.level-medium {
  background-color: #fff7ed;
  border-left: 5px solid #ea580c;
}

.level-low {
  background-color: #fefce8;
  border-left: 5px solid #ca8a04;
}

.new-badge {
  position: absolute;
  top: -6px;
  right: 12px;
  background: #dc2626;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.alert-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-level-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  color: white;
  border-left: none !important;
}

.alert-level-tag.level-high,
.alert-level-tag.level-critical {
  background-color: #dc2626;
}

.alert-level-tag.level-medium {
  background-color: #ea580c;
}

.alert-level-tag.level-low {
  background-color: #ca8a04;
}

.alert-status-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.alert-status-tag.status-active {
  background-color: #fef3c7;
  color: #92400e;
}

.alert-status-tag.status-acknowledged {
  background-color: #dbeafe;
  color: #1e40af;
}

.alert-time {
  font-size: 13px;
  color: #6b7280;
}

.alert-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.alert-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.alert-message {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.alert-actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-acknowledge {
  background: #2563eb;
  color: white;
}

.action-acknowledge:hover:not(:disabled) {
  background: #1d4ed8;
}

.action-resolve {
  background: #16a34a;
  color: white;
}

.action-resolve:hover:not(:disabled) {
  background: #15803d;
}

.action-timestamp {
  font-size: 12px;
  color: #6b7280;
  margin-left: auto;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 480px) {
  .alert-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .alert-body {
    grid-template-columns: 1fr;
  }

  .alert-actions {
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    text-align: center;
  }
}
</style>
