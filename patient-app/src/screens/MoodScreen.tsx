import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}
import { moodAPI, MoodEntry } from '../services/api';

// ── Mood emoji + label mapping ───────────────────────────────────────────────

const MOOD_CONFIG: { emoji: string; label: string; color: string }[] = [
  { emoji: '😢', label: '很差', color: '#E25B5B' },
  { emoji: '😞', label: '较差', color: '#E88B5A' },
  { emoji: '😐', label: '一般', color: '#E8C34A' },
  { emoji: '😊', label: '较好', color: '#5DBE8A' },
  { emoji: '🤗', label: '很好', color: '#3DA06A' },
];

function getMoodIndex(score: number): number {
  if (score <= 2) return 0;
  if (score <= 4) return 1;
  if (score <= 6) return 2;
  if (score <= 8) return 3;
  return 4;
}

function getMoodLabel(score: number): string {
  return MOOD_CONFIG[getMoodIndex(score)].label;
}

function getMoodColor(score: number): string {
  return MOOD_CONFIG[getMoodIndex(score)].color;
}

function getMoodEmoji(score: number): string {
  return MOOD_CONFIG[getMoodIndex(score)].emoji;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function MoodScreen() {
  const [moodScore, setMoodScore] = useState(5);
  const [content, setContent] = useState('');
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Trend range state
  const [trendRange, setTrendRange] = useState<'today' | 'month' | 'year' | 'all'>('month');

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await moodAPI.list();
      setEntries(response.data);
    } catch (error: any) {
      console.error('Failed to fetch mood entries', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await moodAPI.create({
        mood_score: moodScore,
        content: content.trim(),
      });
      showAlert('成功', '情绪记录已保存');
      setContent('');
      setMoodScore(5);
      fetchEntries();
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.mood_score?.[0] ||
        '保存失败，请重试';
      showAlert('错误', String(message));
    } finally {
      setSubmitting(false);
    }
  };

  const renderEntry = ({ item }: { item: MoodEntry }) => (
    <View style={styles.entryCard}>
      <View style={[styles.entryColorBar, { backgroundColor: getMoodColor(item.mood_score) }]} />
      <View style={styles.entryBody}>
        <View style={styles.entryHeader}>
          <View style={styles.entryLeft}>
            <Text style={styles.entryEmoji}>{getMoodEmoji(item.mood_score)}</Text>
            <View>
              <Text style={[styles.entryMoodLabel, { color: getMoodColor(item.mood_score) }]}>
                {getMoodLabel(item.mood_score)}
              </Text>
              <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.entryScoreBadge, { backgroundColor: getMoodColor(item.mood_score) + '18' }]}>
            <Text style={[styles.entryScoreText, { color: getMoodColor(item.mood_score) }]}>
              {item.mood_score}
            </Text>
          </View>
        </View>
        {item.content ? (
          <Text style={styles.entryContent}>{item.content}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Mood Input Card */}
      <View style={styles.inputCard}>
        <Text style={styles.cardTitle}>{'今天心情如何？'}</Text>

        {/* Emoji selector */}
        <View style={styles.emojiRow}>
          {MOOD_CONFIG.map((mood, index) => {
            const scoreRange = index === 0 ? [1, 2] : index === 1 ? [3, 4] : index === 2 ? [5, 6] : index === 3 ? [7, 8] : [9, 10];
            const isSelected = getMoodIndex(moodScore) === index;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.emojiButton,
                  isSelected && { backgroundColor: mood.color + '20', borderColor: mood.color },
                ]}
                onPress={() => setMoodScore(scoreRange[0] + 1)}
                activeOpacity={0.7}
              >
                <Text style={[styles.emojiText, isSelected && styles.emojiTextSelected]}>{mood.emoji}</Text>
                <Text style={[styles.emojiLabel, isSelected && { color: mood.color, fontWeight: '700' }]}>{mood.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fine-tune score */}
        <View style={styles.fineScoreContainer}>
          <Text style={styles.fineScoreLabel}>精确分数</Text>
          <View style={styles.scoreChips}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <TouchableOpacity
                key={score}
                style={[
                  styles.scoreChip,
                  moodScore === score && { backgroundColor: getMoodColor(score), borderColor: getMoodColor(score) },
                ]}
                onPress={() => setMoodScore(score)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.scoreChipText,
                    moodScore === score && styles.scoreChipTextActive,
                  ]}
                >
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content Input */}
        <TextInput
          style={styles.textInput}
          placeholder={'写下你的想法和感受...（选填）'}
          placeholderTextColor="#B0BEC5"
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>{'保存记录'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mood Trend Chart */}
      {entries.length >= 2 && (
        <View style={styles.chartCard}>
          <View style={styles.chartTitleRow}>
            <Text style={styles.sectionTitle}>{'📈 近期趋势'}</Text>
          </View>
          {/* Time range tabs */}
          <View style={styles.trendTabs}>
            {([
              { key: 'today', label: '今日' },
              { key: 'month', label: '本月' },
              { key: 'year', label: '本年' },
              { key: 'all', label: '全部' },
            ] as const).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.trendTab, trendRange === tab.key && styles.trendTabActive]}
                onPress={() => setTrendRange(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.trendTabText, trendRange === tab.key && styles.trendTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chartContainer}>
            {(() => {
              const now = new Date();
              const filtered = entries.filter((e) => {
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
              const recent = filtered.slice(0, 10).reverse();
              const chartHeight = 100;
              if (recent.length === 0) {
                return (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={styles.chartHint}>{'该时间段暂无记录'}</Text>
                  </View>
                );
              }
              return (
                <View style={styles.chartInner}>
                  {/* Grid lines */}
                  <View style={styles.chartGrid}>
                    {[10, 7, 4, 1].map((v) => (
                      <View key={v} style={styles.gridRow}>
                        <Text style={styles.gridLabel}>{v}</Text>
                        <View style={styles.gridLine} />
                      </View>
                    ))}
                  </View>
                  {/* Bars */}
                  <View style={styles.chartBars}>
                    {recent.map((entry, i) => {
                      const barHeight = (entry.mood_score / 10) * chartHeight;
                      return (
                        <View key={i} style={styles.chartBarWrapper}>
                          <View style={styles.chartBarTrack}>
                            <View
                              style={[
                                styles.chartBar,
                                {
                                  height: barHeight,
                                  backgroundColor: getMoodColor(entry.mood_score),
                                },
                              ]}
                            >
                              <Text style={styles.barValue}>{entry.mood_score}</Text>
                            </View>
                          </View>
                          <Text style={styles.chartBarLabel}>
                            {formatShortDate(entry.created_at)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      )}

      {/* Emotion Calendar */}
      {entries.length > 0 && (() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

        // Build entry map: "YYYY-MM-DD" -> average mood score
        const dayMap: Record<string, { avg: number; count: number }> = {};
        entries.forEach((e) => {
          const d = new Date(e.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!dayMap[key]) dayMap[key] = { avg: 0, count: 0 };
          dayMap[key].avg = (dayMap[key].avg * dayMap[key].count + e.mood_score) / (dayMap[key].count + 1);
          dayMap[key].count++;
        });

        const cells: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        const today = new Date();
        const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        const selectedKey = selectedDay;

        return (
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => setCalendarDate(new Date(year, month - 1, 1))}
                style={styles.calendarNav}
                activeOpacity={0.6}
              >
                <Text style={styles.calendarNavText}>{'‹'}</Text>
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>{`${year}年${month + 1}月`}</Text>
              <TouchableOpacity
                onPress={() => setCalendarDate(new Date(year, month + 1, 1))}
                style={styles.calendarNav}
                activeOpacity={0.6}
              >
                <Text style={styles.calendarNavText}>{'›'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarWeekRow}>
              {weekDays.map((w) => (
                <Text key={w} style={styles.calendarWeekDay}>{w}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {cells.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                }
                const key = `${year}-${month}-${day}`;
                const data = dayMap[key];
                const isSelected = selectedKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.calendarCell,
                      isToday(day) && styles.calendarCellToday,
                      isSelected && styles.calendarCellSelected,
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : key)}
                    activeOpacity={0.6}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      isToday(day) && styles.calendarDayToday,
                      isSelected && styles.calendarDaySelected,
                    ]}>
                      {day}
                    </Text>
                    {data && (
                      <View style={[styles.calendarDot, { backgroundColor: getMoodColor(Math.round(data.avg)) }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedDay && (() => {
              const parts = selectedDay.split('-');
              const dayEntries = entries.filter((e) => {
                const d = new Date(e.created_at);
                return d.getFullYear() === Number(parts[0]) && d.getMonth() === Number(parts[1]) && d.getDate() === Number(parts[2]);
              });
              if (dayEntries.length === 0) return null;
              return (
                <View style={styles.calendarDayDetail}>
                  <Text style={styles.calendarDayDetailTitle}>
                    {`${Number(parts[1]) + 1}月${parts[2]}日 · ${dayEntries.length}条记录`}
                  </Text>
                  {dayEntries.map((e) => (
                    <View key={e.id} style={styles.calendarDayEntry}>
                      <Text style={{ fontSize: 18 }}>{getMoodEmoji(e.mood_score)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.calendarDayEntryScore}>{getMoodLabel(e.mood_score)} · {e.mood_score}分</Text>
                        {e.content ? <Text style={styles.calendarDayEntryContent} numberOfLines={2}>{e.content}</Text> : null}
                      </View>
                      <Text style={styles.calendarDayEntryTime}>
                        {new Date(e.created_at).getHours().toString().padStart(2, '0')}:{new Date(e.created_at).getMinutes().toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        );
      })()}

      {/* History Title */}
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{'📝 历史记录'}</Text>
        <Text style={styles.historyCount}>{entries.length > 0 ? `共 ${entries.length} 条` : ''}</Text>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading && entries.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DA480" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderEntry}
          ListHeaderComponent={renderHeader()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DA480" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>{'📝'}</Text>
              <Text style={styles.emptyText}>{'还没有记录，开始记录您的心情吧'}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8FA89B',
  },

  // ── Input Card ──────────────────────────────────────────────────
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 16,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 6,
  },
  emojiButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F7FAF8',
  },
  emojiText: {
    fontSize: 28,
    marginBottom: 4,
  },
  emojiTextSelected: {
    fontSize: 32,
  },
  emojiLabel: {
    fontSize: 12,
    color: '#8E9E95',
    fontWeight: '500',
  },

  // Fine score chips
  fineScoreContainer: {
    marginBottom: 16,
  },
  fineScoreLabel: {
    fontSize: 13,
    color: '#8E9E95',
    marginBottom: 8,
    fontWeight: '500',
  },
  scoreChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  scoreChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
  },
  scoreChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A8F82',
  },
  scoreChipTextActive: {
    color: '#fff',
  },

  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#F7FAF8',
    minHeight: 80,
    marginBottom: 14,
    color: '#2D4A3E',
    lineHeight: 22,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  submitButton: {
    backgroundColor: '#5DA480',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Chart Card ──────────────────────────────────────────────────
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  chartTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartHint: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  trendTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  trendTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F4F1',
    alignItems: 'center',
  },
  trendTabActive: {
    backgroundColor: '#5DA480',
  },
  trendTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E9E95',
  },
  trendTabTextActive: {
    color: '#fff',
  },
  chartContainer: {
    overflow: 'hidden',
  },
  chartInner: {
    height: 140,
    position: 'relative',
  },
  chartGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 10,
    color: '#C0CCC5',
    width: 18,
    textAlign: 'right',
    marginRight: 6,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EFF3F0',
  },
  chartBars: {
    position: 'absolute',
    left: 28,
    right: 0,
    bottom: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 24,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarTrack: {
    height: 100,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  chartBar: {
    width: 22,
    borderRadius: 6,
    minHeight: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
  },
  barValue: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#A0B0A8',
    marginTop: 6,
  },

  // ── Calendar ──────────────────────────────────────────────────
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarNav: {
    padding: 8,
  },
  calendarNavText: {
    fontSize: 22,
    color: '#5DA480',
    fontWeight: '600',
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#A0B0A8',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  calendarCellToday: {
    backgroundColor: '#EEF6F1',
    borderRadius: 10,
  },
  calendarCellSelected: {
    backgroundColor: '#5DA480',
    borderRadius: 10,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#2D4A3E',
    fontWeight: '500',
  },
  calendarDayToday: {
    fontWeight: '700',
    color: '#5DA480',
  },
  calendarDaySelected: {
    color: '#fff',
    fontWeight: '700',
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  calendarDayDetail: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFF3F0',
  },
  calendarDayDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 10,
  },
  calendarDayEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F7F5',
  },
  calendarDayEntryScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D4A3E',
  },
  calendarDayEntryContent: {
    fontSize: 12,
    color: '#8E9E95',
    marginTop: 2,
  },
  calendarDayEntryTime: {
    fontSize: 12,
    color: '#A0B0A8',
  },

  // ── History Section ──────────────────────────────────────────────
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  historyCount: {
    fontSize: 13,
    color: '#A0B0A8',
  },

  // ── Entry Card ──────────────────────────────────────────────────
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  entryColorBar: {
    width: 4,
  },
  entryBody: {
    flex: 1,
    padding: 14,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryEmoji: {
    fontSize: 28,
  },
  entryMoodLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  entryDate: {
    fontSize: 12,
    color: '#A0B0A8',
    marginTop: 2,
  },
  entryScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryScoreText: {
    fontSize: 16,
    fontWeight: '800',
  },
  entryContent: {
    fontSize: 14,
    color: '#5A6B60',
    marginTop: 10,
    lineHeight: 21,
    paddingLeft: 38,
  },

  // ── Empty State ──────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0B0A8',
    textAlign: 'center',
  },
});
