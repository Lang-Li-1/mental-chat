import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { supporterAPI, patientStatusAPI, SupporterLink, PatientStatusSummary } from '../services/api';
import { toChineseErrorMessage } from '../utils/errorMessage';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function getMoodColor(score: number): string {
  if (score <= 2) return '#E25B5B';
  if (score <= 4) return '#E88B5A';
  if (score <= 6) return '#E8C34A';
  if (score <= 8) return '#5DBE8A';
  return '#3DA06A';
}

function getMoodLabel(score: number): string {
  if (score <= 2) return '很差';
  if (score <= 4) return '较差';
  if (score <= 6) return '一般';
  if (score <= 8) return '较好';
  return '很好';
}

function getMoodEmoji(score: number): string {
  if (score <= 2) return '😢';
  if (score <= 4) return '😞';
  if (score <= 6) return '😐';
  if (score <= 8) return '😊';
  return '🤗';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

export default function SupporterHomeScreen() {
  const [links, setLinks] = useState<SupporterLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linking, setLinking] = useState(false);

  // Selected patient detail
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientStatus, setPatientStatus] = useState<PatientStatusSummary | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await supporterAPI.getLinkedPatients();
      setLinks(res.data);
    } catch (err) {
      console.error('Failed to fetch linked patients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLinks();
    setRefreshing(false);
  };

  const handleLink = async () => {
    if (!linkInput.trim()) {
      showAlert('提示', '请输入患者用户名或手机号');
      return;
    }
    setLinking(true);
    try {
      await supporterAPI.linkPatient(linkInput.trim());
      setLinkInput('');
      showAlert('成功', '已成功关联患者');
      fetchLinks();
    } catch (err: any) {
      const msg = err.response?.data?.detail || '关联失败，请检查信息是否正确';
      showAlert('错误', toChineseErrorMessage(msg, '关联失败，请检查信息是否正确'));
    } finally {
      setLinking(false);
    }
  };

  const handleSelectPatient = async (patientId: number) => {
    if (selectedPatientId === patientId) {
      setSelectedPatientId(null);
      setPatientStatus(null);
      return;
    }
    setSelectedPatientId(patientId);
    setStatusLoading(true);
    try {
      const res = await patientStatusAPI.getSummary(patientId);
      setPatientStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch patient status', err);
      setPatientStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DA480" />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Link Patient Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'关联患者'}</Text>
        <Text style={styles.cardDesc}>{'输入患者的用户名或手机号来关联'}</Text>
        <View style={styles.linkRow}>
          <TextInput
            style={styles.linkInput}
            placeholder="用户名或手机号"
            placeholderTextColor="#B0BEC5"
            value={linkInput}
            onChangeText={setLinkInput}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.linkBtn, linking && styles.linkBtnDisabled]}
            onPress={handleLink}
            disabled={linking}
            activeOpacity={0.8}
          >
            {linking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.linkBtnText}>{'关联'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Patient List */}
      <Text style={styles.sectionTitle}>{'已关联的患者'}</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5DA480" />
        </View>
      ) : links.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'👥'}</Text>
          <Text style={styles.emptyText}>{'暂未关联任何患者'}</Text>
          <Text style={styles.emptyHint}>{'请在上方输入患者信息进行关联'}</Text>
        </View>
      ) : (
        links.map((link) => {
          const patient = link.patient;
          const isSelected = selectedPatientId === patient.id;
          return (
            <View key={link.id}>
              <TouchableOpacity
                style={[styles.patientCard, isSelected && styles.patientCardActive]}
                onPress={() => handleSelectPatient(patient.id)}
                activeOpacity={0.7}
              >
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>
                    {patient.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.username}</Text>
                  <Text style={styles.patientMeta}>
                    {`关联时间: ${formatDate(link.created_at)}`}
                  </Text>
                </View>
                <Text style={styles.expandArrow}>{isSelected ? '▾' : '›'}</Text>
              </TouchableOpacity>

              {/* Patient Status Detail */}
              {isSelected && (
                <View style={styles.statusDetail}>
                  {statusLoading ? (
                    <ActivityIndicator size="small" color="#5DA480" style={{ padding: 20 }} />
                  ) : patientStatus ? (
                    <>
                      {/* Mood Overview */}
                      <View style={styles.statusRow}>
                        <View style={styles.statusItem}>
                          <Text style={styles.statusLabel}>{'平均心情'}</Text>
                          {patientStatus.average_mood_score != null ? (
                            <View style={styles.moodDisplay}>
                              <Text style={styles.moodEmoji}>
                                {getMoodEmoji(Math.round(patientStatus.average_mood_score))}
                              </Text>
                              <Text style={[styles.statusValue, { color: getMoodColor(Math.round(patientStatus.average_mood_score)) }]}>
                                {patientStatus.average_mood_score.toFixed(1)}
                              </Text>
                              <Text style={styles.moodLabelText}>
                                {getMoodLabel(Math.round(patientStatus.average_mood_score))}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.statusValueMuted}>{'暂无数据'}</Text>
                          )}
                        </View>
                        <View style={styles.statusItem}>
                          <Text style={styles.statusLabel}>{'对话次数'}</Text>
                          <Text style={styles.statusValue}>{patientStatus.total_chat_messages}</Text>
                        </View>
                        <View style={styles.statusItem}>
                          <Text style={styles.statusLabel}>{'活跃告警'}</Text>
                          <Text style={[
                            styles.statusValue,
                            patientStatus.active_crisis_alerts > 0 && styles.statusValueDanger
                          ]}>
                            {patientStatus.active_crisis_alerts}
                          </Text>
                        </View>
                      </View>

                      {/* Recent Mood Entries */}
                      {patientStatus.recent_mood_entries.length > 0 && (
                        <View style={styles.recentMoods}>
                          <Text style={styles.recentTitle}>{'近期情绪记录'}</Text>
                          {patientStatus.recent_mood_entries.slice(0, 5).map((entry) => (
                            <View key={entry.id} style={styles.moodEntry}>
                              <Text style={styles.moodEntryEmoji}>{getMoodEmoji(entry.mood_score)}</Text>
                              <View style={styles.moodEntryBody}>
                                <View style={styles.moodEntryHeader}>
                                  <Text style={[styles.moodEntryScore, { color: getMoodColor(entry.mood_score) }]}>
                                    {`${getMoodLabel(entry.mood_score)} · ${entry.mood_score}分`}
                                  </Text>
                                  <Text style={styles.moodEntryDate}>{formatDate(entry.created_at)}</Text>
                                </View>
                                {entry.content ? (
                                  <Text style={styles.moodEntryContent} numberOfLines={2}>{entry.content}</Text>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.statusError}>{'无法加载患者状态'}</Text>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Supporter Guide */}
      <View style={styles.guideCard}>
        <Text style={styles.guideTitle}>{'守护者支持指南'}</Text>
        <View style={styles.guideItem}>
          <Text style={styles.guideEmoji}>{'💬'}</Text>
          <View style={styles.guideBody}>
            <Text style={styles.guideItemTitle}>{'有效沟通'}</Text>
            <Text style={styles.guideItemText}>{'用开放式问题表达关心，如"你今天感觉怎么样？"避免说"你应该..."'}</Text>
          </View>
        </View>
        <View style={styles.guideItem}>
          <Text style={styles.guideEmoji}>{'👂'}</Text>
          <View style={styles.guideBody}>
            <Text style={styles.guideItemTitle}>{'倾听与陪伴'}</Text>
            <Text style={styles.guideItemText}>{'耐心倾听，不急于给建议。让对方知道你在身边就好。'}</Text>
          </View>
        </View>
        <View style={styles.guideItem}>
          <Text style={styles.guideEmoji}>{'🌟'}</Text>
          <View style={styles.guideBody}>
            <Text style={styles.guideItemTitle}>{'自我照顾'}</Text>
            <Text style={styles.guideItemText}>{'照顾他人的同时也要关注自己的情绪。必要时寻求专业帮助。'}</Text>
          </View>
        </View>
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
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Link card
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E9E95',
    marginBottom: 14,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#F7FAF8',
    color: '#2D4A3E',
  },
  linkBtn: {
    backgroundColor: '#5DA480',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkBtnDisabled: {
    opacity: 0.6,
  },
  linkBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 12,
  },

  // Patient card
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 2,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientCardActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF6F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5DA480',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 2,
  },
  patientMeta: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  expandArrow: {
    fontSize: 18,
    color: '#C0CCC5',
    marginLeft: 8,
  },

  // Status detail
  statusDetail: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 16,
    paddingTop: 8,
    marginBottom: 10,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
    backgroundColor: '#F7FAF8',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#8E9E95',
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D4A3E',
  },
  statusValueMuted: {
    fontSize: 13,
    color: '#A0B0A8',
  },
  statusValueDanger: {
    color: '#E25B5B',
  },
  moodDisplay: {
    alignItems: 'center',
    gap: 2,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabelText: {
    fontSize: 12,
    color: '#8E9E95',
  },

  // Recent moods
  recentMoods: {
    borderTopWidth: 1,
    borderTopColor: '#EFF3F0',
    paddingTop: 12,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 10,
  },
  moodEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F7F5',
  },
  moodEntryEmoji: {
    fontSize: 18,
    marginTop: 2,
  },
  moodEntryBody: {
    flex: 1,
  },
  moodEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodEntryScore: {
    fontSize: 14,
    fontWeight: '600',
  },
  moodEntryDate: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  moodEntryContent: {
    fontSize: 13,
    color: '#5A6B60',
    marginTop: 4,
    lineHeight: 19,
  },

  statusError: {
    textAlign: 'center',
    color: '#E25B5B',
    padding: 16,
    fontSize: 14,
  },

  // Guide card
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 16,
  },
  guideItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  guideEmoji: {
    fontSize: 24,
    marginTop: 2,
  },
  guideBody: {
    flex: 1,
  },
  guideItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  guideItemText: {
    fontSize: 13,
    color: '#5A6B60',
    lineHeight: 20,
  },

  // Shared
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E9E95',
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    color: '#A0B0A8',
  },
});
