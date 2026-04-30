import React, { useState, useCallback, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import {
  supporterAPI,
  patientAPI,
  SupporterLink,
  EncouragementMessage,
  UserInfo,
} from '../services/api';
import { usePeerChat } from '../hooks/usePeerChat';

interface PeerOption {
  id: number;
  name: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

const PRESETS = [
  '你很棒，一切都会好起来的！',
  '我一直在你身边。',
  '今天辛苦了，好好休息。',
  '你比想象的更强大！',
];

export default function EncouragementScreen() {
  const { userRole } = useContext(AuthContext);
  const isSupporter = userRole === 'supporter';
  const accentColor = isSupporter ? '#5A6FC2' : '#5DA480';
  const accentBg = isSupporter ? '#EEF1F9' : '#EEF6F1';

  const [peers, setPeers] = useState<PeerOption[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(true);
  const [draft, setDraft] = useState('');
  const [meId, setMeId] = useState<number | null>(null);

  const { messages, status, loading: loadingHistory, send } = usePeerChat(selectedPeerId);

  // Read current user id from storage so we can render bubbles left/right
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user_info');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.id === 'number') setMeId(parsed.id);
        }
      } catch {}
    })();
  }, []);

  const fetchPeers = useCallback(async () => {
    setLoadingPeers(true);
    try {
      const res = isSupporter
        ? await supporterAPI.getLinkedPatients()
        : await patientAPI.getLinkedSupporters();
      const opts: PeerOption[] = res.data.map((link: SupporterLink) => {
        const peer: UserInfo = isSupporter ? link.patient : link.supporter;
        return { id: peer.id, name: peer.username };
      });
      setPeers(opts);
      setSelectedPeerId((prev) => {
        if (prev != null && opts.some((o) => o.id === prev)) return prev;
        return opts.length > 0 ? opts[0].id : null;
      });
    } catch (e) {
      console.error('Failed to load peers', e);
    } finally {
      setLoadingPeers(false);
    }
  }, [isSupporter]);

  useFocusEffect(
    useCallback(() => {
      fetchPeers();
    }, [fetchPeers]),
  );

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const handleSend = (content: string) => {
    if (!content.trim() || selectedPeerId == null) return;
    send(content);
    setDraft('');
  };

  if (loadingPeers) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  if (peers.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyEmoji}>{'💌'}</Text>
        <Text style={styles.emptyText}>
          {isSupporter
            ? '请先在"天使状态"页面关联天使'
            : '还没有守护者关联你'}
        </Text>
        {!isSupporter && (
          <Text style={styles.emptyHint}>
            {'让家人朋友用你的用户名关联后，就能在这里聊天了'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Peer selector + connection status */}
      <View style={styles.peerBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.peerScroll}
          contentContainerStyle={styles.peerBarContent}
        >
          {peers.map((p) => {
            const active = p.id === selectedPeerId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.peerChip,
                  active && { backgroundColor: accentBg, borderColor: accentColor },
                ]}
                onPress={() => setSelectedPeerId(p.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.peerChipText,
                    active && { color: accentColor, fontWeight: '700' },
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: status === 'open' ? '#5DA480' : '#D8A656' },
            ]}
          />
          <Text style={styles.statusText}>
            {status === 'open' ? '实时连接' : status === 'connecting' ? '连接中…' : '已断开'}
          </Text>
        </View>
      </View>

      {/* Message list */}
      <ScrollView
        ref={scrollRef}
        style={styles.msgArea}
        contentContainerStyle={styles.msgContent}
        showsVerticalScrollIndicator={false}
      >
        {loadingHistory ? (
          <ActivityIndicator color={accentColor} style={{ marginTop: 30 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.placeholderText}>{'还没有消息，发送第一条吧 ✉️'}</Text>
        ) : (
          messages.map((m: EncouragementMessage) => {
            const mine = meId != null && m.sender === meId;
            return (
              <View
                key={m.id}
                style={[styles.msgRow, mine ? styles.msgRowRight : styles.msgRowLeft]}
              >
                {!mine && (
                  <View style={[styles.avatar, { backgroundColor: accentBg }]}>
                    <Text style={[styles.avatarText, { color: accentColor }]}>
                      {(m.sender_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: accentColor }
                      : { backgroundColor: '#fff', borderColor: '#E2EBE6', borderWidth: 1 },
                  ]}
                >
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>
                    {m.content}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTime,
                      mine ? { color: 'rgba(255,255,255,0.7)' } : { color: '#A0B0A8' },
                    ]}
                  >
                    {formatTime(m.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Quick presets (supporter only) */}
      {isSupporter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presetRow}
        >
          {PRESETS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.presetChip}
              onPress={() => handleSend(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={isSupporter ? '说点温暖的话…' : '回复…'}
          placeholderTextColor="#B0BEC5"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: accentColor },
            !draft.trim() && styles.sendBtnDisabled,
          ]}
          onPress={() => handleSend(draft)}
          disabled={!draft.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.sendBtnText}>{'发送'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F5' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },

  peerBar: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomColor: '#E2EBE6',
    borderBottomWidth: 1,
  },
  peerScroll: { flexGrow: 0, flexShrink: 0 },
  peerBarContent: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F0F4F1',
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    marginRight: 8,
  },
  peerChipText: { fontSize: 13, color: '#8E9E95', fontWeight: '600' },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 11, color: '#8E9E95' },

  msgArea: { flex: 1 },
  msgContent: { padding: 14, paddingBottom: 8 },
  placeholderText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#8E9E95',
    fontSize: 14,
  },

  msgRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  avatarText: { fontSize: 13, fontWeight: '700' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleText: { fontSize: 15, color: '#2D4A3E', lineHeight: 21 },
  bubbleTextMine: { fontSize: 15, color: '#fff', lineHeight: 21 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  presetScroll: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#fff',
    borderTopColor: '#E2EBE6',
    borderTopWidth: 1,
  },
  presetRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F7FAF8',
    borderWidth: 1,
    borderColor: '#E2EBE6',
    marginRight: 8,
  },
  presetChipText: { fontSize: 12, color: '#5A7D6A' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopColor: '#E2EBE6',
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E2EBE6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F7FAF8',
    fontSize: 15,
    color: '#2D4A3E',
    marginRight: 8,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  sendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyEmoji: { fontSize: 56, marginBottom: 14 },
  emptyText: {
    fontSize: 16,
    color: '#5A7D6A',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyHint: { fontSize: 13, color: '#A0B0A8', textAlign: 'center' },
});
