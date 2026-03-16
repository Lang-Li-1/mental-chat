import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { recoveryAPI, RecoveryTask, RecoveryBadge, RecoveryStats } from '../services/api';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const TASK_ICONS: Record<string, string> = {
  mood_log: '📝',
  mindfulness: '🧘',
  reading: '📖',
  exercise: '🏃',
  social: '💬',
  gratitude: '🙏',
};

const BADGE_CONFIG: Record<string, { emoji: string; label: string; description: string }> = {
  streak_3: { emoji: '🔥', label: '连续3天', description: '连续3天完成任务' },
  streak_7: { emoji: '⭐', label: '一周坚持', description: '连续7天完成任务' },
  streak_30: { emoji: '🏆', label: '月度冠军', description: '连续30天完成任务' },
  first_mood: { emoji: '💚', label: '心情初记', description: '首次记录情绪' },
  first_chat: { emoji: '💭', label: '初次倾诉', description: '首次与AI对话' },
  first_assessment: { emoji: '📋', label: '自我了解', description: '首次完成自评' },
  tasks_10: { emoji: '🌟', label: '小有成就', description: '累计完成10个任务' },
  tasks_50: { emoji: '💎', label: '持之以恒', description: '累计完成50个任务' },
  mood_improve: { emoji: '🌈', label: '心情好转', description: '情绪持续改善' },
};

export default function RecoveryPlanScreen() {
  const [tasks, setTasks] = useState<RecoveryTask[]>([]);
  const [badges, setBadges] = useState<RecoveryBadge[]>([]);
  const [stats, setStats] = useState<RecoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, badgesRes, statsRes] = await Promise.all([
        recoveryAPI.getTasks(),
        recoveryAPI.getBadges(),
        recoveryAPI.getStats(),
      ]);
      setTasks(tasksRes.data);
      setBadges(badgesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch recovery data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleComplete = async (taskId: number) => {
    setCompleting(taskId);
    try {
      await recoveryAPI.completeTask(taskId);
      showAlert('完成', '任务已完成，继续加油！');
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || '操作失败';
      showAlert('错误', msg);
    } finally {
      setCompleting(null);
    }
  };

  const completedToday = tasks.filter((t) => t.is_completed).length;
  const totalToday = tasks.length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5DA480" />
        <Text style={styles.loadingText}>{'加载中...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DA480" />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Stats Overview */}
      <View style={styles.statsCard}>
        <View style={styles.statsCardBg}>
          <View style={styles.statsDecor1} />
          <View style={styles.statsDecor2} />
        </View>
        <View style={styles.statsContent}>
          <Text style={styles.statsGreeting}>{'今日计划'}</Text>
          <Text style={styles.statsProgress}>
            {`${completedToday} / ${totalToday} 任务已完成`}
          </Text>
          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: totalToday > 0 ? `${(completedToday / totalToday) * 100}%` : '0%'
            }]} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.current_streak || 0}</Text>
              <Text style={styles.statLabel}>{'连续天数'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.total_completed || 0}</Text>
              <Text style={styles.statLabel}>{'累计完成'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.badge_count || 0}</Text>
              <Text style={styles.statLabel}>{'获得徽章'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Today's Tasks */}
      <Text style={styles.sectionTitle}>{'今日任务'}</Text>
      {tasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>{'🌿'}</Text>
          <Text style={styles.emptyText}>{'今日任务加载中...'}</Text>
        </View>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={[styles.taskCard, task.is_completed && styles.taskCardDone]}>
            <View style={styles.taskIconContainer}>
              <Text style={styles.taskIcon}>{TASK_ICONS[task.task_type] || '📌'}</Text>
            </View>
            <View style={styles.taskBody}>
              <Text style={[styles.taskTitle, task.is_completed && styles.taskTitleDone]}>
                {task.title}
              </Text>
              <Text style={styles.taskDesc}>{task.description}</Text>
            </View>
            {task.is_completed ? (
              <View style={styles.doneCheck}>
                <Text style={styles.doneCheckText}>{'✓'}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => handleComplete(task.id)}
                disabled={completing === task.id}
                activeOpacity={0.7}
              >
                {completing === task.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.completeBtnText}>{'完成'}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Badges */}
      <Text style={styles.sectionTitle}>{'成就徽章'}</Text>
      <View style={styles.badgeGrid}>
        {Object.entries(BADGE_CONFIG).map(([key, config]) => {
          const earned = badges.some((b) => b.badge_type === key);
          return (
            <View key={key} style={[styles.badgeItem, !earned && styles.badgeItemLocked]}>
              <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                {config.emoji}
              </Text>
              <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                {config.label}
              </Text>
              {earned && <Text style={styles.badgeEarned}>{'已获得'}</Text>}
            </View>
          );
        })}
      </View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>{'每日小贴士'}</Text>
        <Text style={styles.tipsText}>
          {'坚持完成每日任务可以帮助建立健康的生活习惯。即使今天只完成一个任务，也是很大的进步！记住，康复是一个循序渐进的过程。'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F4F7F5',
  },
  loadingText: {
    fontSize: 14,
    color: '#8FA89B',
  },

  // Stats card
  statsCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  statsCardBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#3D7A5F',
    overflow: 'hidden',
  },
  statsDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statsDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statsContent: {
    padding: 24,
  },
  statsGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  statsProgress: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 12,
    marginTop: 4,
  },

  // Task card
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  taskCardDone: {
    opacity: 0.7,
  },
  taskIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF6F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  taskIcon: {
    fontSize: 22,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#A0B0A8',
  },
  taskDesc: {
    fontSize: 13,
    color: '#8E9E95',
    lineHeight: 19,
  },
  completeBtn: {
    backgroundColor: '#5DA480',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 10,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  doneCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5DBE8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  doneCheckText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 10,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0B0A8',
  },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  badgeItem: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeItemLocked: {
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  badgeEmojiLocked: {
    fontSize: 28,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D4A3E',
    textAlign: 'center',
  },
  badgeLabelLocked: {
    color: '#A0B0A8',
  },
  badgeEarned: {
    fontSize: 10,
    color: '#5DA480',
    fontWeight: '600',
    marginTop: 4,
  },

  // Tips
  tipsCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 18,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B7A3B',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#8B7A3B',
    lineHeight: 22,
  },
});
