import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import {
  supporterAPI,
  encouragementAPI,
  SupporterLink,
  EncouragementMessage,
} from '../services/api';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

const PRESET_MESSAGES = [
  '你很棒，一切都会好起来的！',
  '我一直在你身边，有什么需要随时告诉我。',
  '今天辛苦了，好好休息吧。',
  '你比自己想象的更强大！',
  '不管遇到什么，我们一起面对。',
  '每一天都是新的开始，加油！',
];

export default function EncouragementScreen() {
  const { userRole } = useContext(AuthContext);
  const isSupporter = userRole === 'supporter';

  // Supporter: send mode
  const [links, setLinks] = useState<SupporterLink[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Patient: receive mode
  const [messages, setMessages] = useState<EncouragementMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (isSupporter) {
        const res = await supporterAPI.getLinkedPatients();
        setLinks(res.data);
        setSelectedPatientId((prev) => {
          if (prev && res.data.some((l) => l.patient.id === prev)) return prev;
          return res.data.length > 0 ? res.data[0].patient.id : null;
        });
      } else {
        const res = await encouragementAPI.list();
        setMessages(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  }, [isSupporter]);

  // Re-fetch every time this tab comes into focus, so newly linked patients
  // (added on SupporterHome) appear without manual page refresh.
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSend = async (content: string) => {
    if (!selectedPatientId) {
      showAlert('提示', '请先选择一位天使');
      return;
    }
    if (!content.trim()) {
      showAlert('提示', '请输入鼓励消息');
      return;
    }
    setSending(true);
    try {
      await supporterAPI.sendEncouragement(selectedPatientId, content.trim());
      showAlert('发送成功', '您的鼓励已送达！');
      setCustomMessage('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || '发送失败';
      showAlert('错误', msg);
    } finally {
      setSending(false);
    }
  };

  // ── Supporter: Send Encouragement ─────────────────────────────────────────
  if (isSupporter) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{'发送鼓励'}</Text>
        <Text style={styles.pageSubtitle}>{'为您关心的人送上温暖的话语'}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#5DA480" style={{ marginTop: 40 }} />
        ) : links.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{'💌'}</Text>
            <Text style={styles.emptyText}>{'请先在"天使状态"页面关联天使'}</Text>
          </View>
        ) : (
          <>
            {/* Patient Selector */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{'选择天使'}</Text>
              <View style={styles.patientChips}>
                {links.map((link) => {
                  const isActive = selectedPatientId === link.patient.id;
                  return (
                    <TouchableOpacity
                      key={link.id}
                      style={[styles.patientChip, isActive && styles.patientChipActive]}
                      onPress={() => setSelectedPatientId(link.patient.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.patientChipText, isActive && styles.patientChipTextActive]}>
                        {link.patient.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Preset Messages */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{'快捷消息'}</Text>
              <View style={styles.presetList}>
                {PRESET_MESSAGES.map((msg, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.presetItem}
                    onPress={() => handleSend(msg)}
                    disabled={sending}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetText}>{msg}</Text>
                    <Text style={styles.presetArrow}>{'›'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Message */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{'自定义消息'}</Text>
              <TextInput
                style={styles.customInput}
                placeholder="写下你想说的话..."
                placeholderTextColor="#B0BEC5"
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (sending || !customMessage.trim()) && styles.sendBtnDisabled]}
                onPress={() => handleSend(customMessage)}
                disabled={sending || !customMessage.trim()}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>{'发送'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // ── Patient: Received Encouragement ───────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DA480" />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{'守护者鼓励'}</Text>
      <Text style={styles.pageSubtitle}>{'来自守护者的温暖话语'}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#5DA480" style={{ marginTop: 40 }} />
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'💌'}</Text>
          <Text style={styles.emptyText}>{'还没有收到鼓励消息'}</Text>
          <Text style={styles.emptyHint}>{'守护者关联后可以给您发送鼓励'}</Text>
        </View>
      ) : (
        messages.map((msg) => (
          <View key={msg.id} style={styles.msgCard}>
            <View style={styles.msgHeader}>
              <View style={styles.msgAvatar}>
                <Text style={styles.msgAvatarText}>
                  {msg.sender_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.msgMeta}>
                <Text style={styles.msgSender}>{msg.sender_name}</Text>
                <Text style={styles.msgDate}>{formatDate(msg.created_at)}</Text>
              </View>
            </View>
            <Text style={styles.msgContent}>{msg.content}</Text>
          </View>
        ))
      )}
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
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8E9E95',
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 12,
  },

  // Patient chips
  patientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  patientChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F4F1',
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
  },
  patientChipActive: {
    backgroundColor: '#EEF6F1',
    borderColor: '#5DA480',
  },
  patientChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E9E95',
  },
  patientChipTextActive: {
    color: '#3D7A5F',
  },

  // Preset messages
  presetList: {
    gap: 6,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F7FAF8',
    borderRadius: 12,
  },
  presetText: {
    flex: 1,
    fontSize: 14,
    color: '#2D4A3E',
    lineHeight: 20,
  },
  presetArrow: {
    fontSize: 20,
    color: '#C0CCC5',
    marginLeft: 8,
  },

  // Custom input
  customInput: {
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#F7FAF8',
    minHeight: 80,
    marginBottom: 12,
    color: '#2D4A3E',
    lineHeight: 22,
  },
  sendBtn: {
    backgroundColor: '#5DA480',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Message cards (patient view)
  msgCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF6F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  msgAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DA480',
  },
  msgMeta: {
    flex: 1,
  },
  msgSender: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  msgDate: {
    fontSize: 12,
    color: '#A0B0A8',
    marginTop: 2,
  },
  msgContent: {
    fontSize: 15,
    color: '#2D4A3E',
    lineHeight: 24,
    backgroundColor: '#F7FAF8',
    borderRadius: 12,
    padding: 14,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 14,
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
