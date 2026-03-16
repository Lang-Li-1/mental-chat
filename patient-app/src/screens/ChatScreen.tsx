import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { chatAPI, chatFeedbackAPI, ChatMessage, ChatSession } from '../services/api';
import EmergencyButton from '../components/EmergencyButton';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

interface DisplayMessage {
  id: string;
  content: string;
  isAI: boolean;
  timestamp: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      content:
        '你好，我是你的AI心理健康助手。你可以和我聊聊任何事情，我会认真倾听并给予你支持。',
      isAI: true,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const flatListRef = useRef<FlatList>(null);
  const messageCountRef = useRef(1);

  // Feedback state: messageId -> true (positive) / false (negative)
  const [feedbacks, setFeedbacks] = useState<Record<string, boolean>>({});

  const handleFeedback = useCallback(async (msgId: string, isPositive: boolean) => {
    // Extract numeric ID from message id like "ai-123"
    const numericId = parseInt(msgId.replace(/\D/g, ''), 10);
    if (isNaN(numericId)) return;

    // Optimistic update
    setFeedbacks((prev) => ({ ...prev, [msgId]: isPositive }));
    try {
      await chatFeedbackAPI.submit(numericId, isPositive);
    } catch {
      // Revert on error
      setFeedbacks((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    }
  }, []);

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await chatAPI.getSessions();
      setSessions(res.data);
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadSession = useCallback(async (sid: string) => {
    setShowHistory(false);
    try {
      const res = await chatAPI.getSessionMessages(sid);
      const loaded: DisplayMessage[] = res.data.map((m: ChatMessage) => ({
        id: `${m.is_ai_response ? 'ai' : 'user'}-${m.id}`,
        content: m.content,
        isAI: m.is_ai_response,
        timestamp: m.created_at,
      }));
      setMessages(loaded);
      setSessionId(sid);
      messageCountRef.current = loaded.length;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    } catch (e) {
      console.error('Failed to load session', e);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setShowHistory(false);
    setSessionId(undefined);
    setMessages([
      {
        id: 'welcome',
        content: '你好，我是你的AI心理健康助手。你可以和我聊聊任何事情，我会认真倾听并给予你支持。',
        isAI: true,
        timestamp: new Date().toISOString(),
      },
    ]);
    messageCountRef.current = 1;
  }, []);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    fetchSessions();
  }, [fetchSessions]);

  // Voice input
  const onTranscript = useCallback((text: string) => {
    setInputText(text);
  }, []);
  const { isRecording, isAvailable: voiceAvailable, start: startRecording, stop: stopRecording } =
    useSpeechRecognition(onTranscript);

  // TTS playback
  const { playingId: playingMsgId, loadingId: loadingMsgId, play: playTTS, stop: stopPlayback } = useAudioPlayer();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Streaming AI message ID for in-progress updates
  const streamingMsgIdRef = useRef<string | null>(null);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    if (isRecording) stopRecording();

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      content: text,
      isAI: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);
    scrollToBottom();

    const streamId = `ai-stream-${Date.now()}`;
    streamingMsgIdRef.current = streamId;
    const placeholderMsg: DisplayMessage = {
      id: streamId,
      content: '',
      isAI: true,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      await chatAPI.sendMessageStream(
        { content: text, session_id: sessionId },
        (serverUserMsg) => {
          if (!sessionId && serverUserMsg.session_id) {
            setSessionId(serverUserMsg.session_id);
          }
        },
        (deltaText) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, content: m.content + deltaText } : m,
            ),
          );
          scrollToBottom();
        },
        (serverAiMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? {
                    id: `ai-${serverAiMsg.id}`,
                    content: serverAiMsg.content,
                    isAI: true,
                    timestamp: serverAiMsg.created_at,
                  }
                : m,
            ),
          );
          streamingMsgIdRef.current = null;
        },
      );
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId && !m.content
            ? { ...m, content: '抱歉，消息发送失败。请检查网络连接后重试。' }
            : m,
        ),
      );
      streamingMsgIdRef.current = null;
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => (
    <View
      style={[
        styles.messageBubbleContainer,
        item.isAI ? styles.aiBubbleContainer : styles.userBubbleContainer,
      ]}
    >
      {item.isAI && (
        <View style={styles.avatarAI}>
          <Text style={styles.avatarIcon}>{'🌿'}</Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.isAI ? styles.aiBubble : styles.userBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.isAI ? styles.aiMessageText : styles.userMessageText,
          ]}
        >
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text
            style={[
              styles.messageTime,
              item.isAI ? styles.aiMessageTime : styles.userMessageTime,
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
          {/* TTS play button for AI messages */}
          {item.isAI && item.id !== 'welcome' && !item.id.startsWith('ai-stream-') && (
            <>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => playTTS(item.id, item.content)}
                disabled={loadingMsgId === item.id}
                activeOpacity={0.6}
              >
                {loadingMsgId === item.id ? (
                  <ActivityIndicator size={12} color="#8FA89B" />
                ) : (
                  <Text style={styles.playButtonText}>
                    {playingMsgId === item.id ? '⏹' : '▶'}
                  </Text>
                )}
              </TouchableOpacity>
              {/* Thumbs up/down feedback */}
              <View style={styles.feedbackRow}>
                <TouchableOpacity
                  style={[
                    styles.feedbackBtn,
                    feedbacks[item.id] === true && styles.feedbackBtnActive,
                  ]}
                  onPress={() => handleFeedback(item.id, true)}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.feedbackIcon,
                    feedbacks[item.id] === true && styles.feedbackIconActive,
                  ]}>{'👍'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.feedbackBtn,
                    feedbacks[item.id] === false && styles.feedbackBtnNeg,
                  ]}
                  onPress={() => handleFeedback(item.id, false)}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.feedbackIcon,
                    feedbacks[item.id] === false && styles.feedbackIconActive,
                  ]}>{'👎'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
      {!item.isAI && (
        <View style={styles.avatarUser}>
          <Text style={styles.avatarUserText}>{'我'}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerButton} onPress={startNewChat} activeOpacity={0.7}>
          <Text style={styles.headerButtonIcon}>{'+'}</Text>
          <Text style={styles.headerButtonLabel}>{'新对话'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitleIcon}>{'🌿'}</Text>
          <Text style={styles.headerTitle}>{'心灵对话'}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={openHistory} activeOpacity={0.7}>
          <Text style={styles.headerButtonIcon}>{'📋'}</Text>
          <Text style={styles.headerButtonLabel}>{'历史'}</Text>
        </TouchableOpacity>
      </View>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>{'历史对话'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowHistory(false)} activeOpacity={0.7}>
                <Text style={styles.modalClose}>{'关闭'}</Text>
              </TouchableOpacity>
            </View>
            {loadingSessions ? (
              <ActivityIndicator size="large" color="#5DA480" style={{ marginTop: 40 }} />
            ) : sessions.length === 0 ? (
              <View style={styles.emptyHistoryContainer}>
                <Text style={styles.emptyHistoryIcon}>{'💬'}</Text>
                <Text style={styles.emptyHistory}>{'暂无历史对话'}</Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.session_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.sessionItem,
                      sessionId === item.session_id && styles.sessionItemActive,
                    ]}
                    onPress={() => loadSession(item.session_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionDot} />
                      <View style={styles.sessionTextArea}>
                        <Text style={styles.sessionPreview} numberOfLines={1}>
                          {item.preview || '(空对话)'}
                        </Text>
                        <View style={styles.sessionMeta}>
                          <Text style={styles.sessionDate}>
                            {new Date(item.last_message_at).toLocaleDateString('zh-CN')}
                          </Text>
                          <Text style={styles.sessionCount}>{item.message_count} 条消息</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          if (messages.length !== messageCountRef.current) {
            messageCountRef.current = messages.length;
            scrollToBottom();
          }
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Typing Indicator */}
      {sending && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
          <Text style={styles.typingText}>{'AI正在思考...'}</Text>
        </View>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Text style={styles.recordingDot}>{'●'}</Text>
          <Text style={styles.recordingText}>{'正在录音，请说话...'}</Text>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {/* Microphone button */}
        {voiceAvailable && (
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={toggleRecording}
            disabled={sending}
            activeOpacity={0.7}
          >
            <Text style={styles.micButtonText}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={'输入消息...'}
            placeholderTextColor="#B0BEC5"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!sending}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
        >
          <Text style={styles.sendButtonText}>{'↑'}</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Button */}
      <EmergencyButton />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#3D7A5F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  aiBubbleContainer: {
    justifyContent: 'flex-start',
    marginRight: 48,
  },
  userBubbleContainer: {
    justifyContent: 'flex-end',
    marginLeft: 48,
  },
  avatarAI: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarIcon: {
    fontSize: 18,
  },
  avatarUser: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5DA480',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarUserText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 20,
    padding: 14,
    paddingBottom: 10,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#5DA480',
    borderBottomRightRadius: 6,
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 23,
  },
  aiMessageText: {
    color: '#2D4A3E',
  },
  userMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  messageTime: {
    fontSize: 11,
  },
  aiMessageTime: {
    color: '#B0BEC5',
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.65)',
  },
  playButton: {
    marginLeft: 8,
    padding: 3,
  },
  playButtonText: {
    fontSize: 13,
    color: '#5DA480',
  },
  feedbackRow: {
    flexDirection: 'row',
    marginLeft: 6,
    gap: 2,
  },
  feedbackBtn: {
    padding: 2,
    borderRadius: 10,
  },
  feedbackBtnActive: {
    backgroundColor: '#E8F5E9',
  },
  feedbackBtnNeg: {
    backgroundColor: '#FEF2F2',
  },
  feedbackIcon: {
    fontSize: 12,
    opacity: 0.5,
  },
  feedbackIconActive: {
    opacity: 1,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5DA480',
    opacity: 0.4,
  },
  typingDot1: { opacity: 0.8 },
  typingDot2: { opacity: 0.5 },
  typingDot3: { opacity: 0.3 },
  typingText: {
    fontSize: 13,
    color: '#8FA89B',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  recordingDot: {
    color: '#E25B5B',
    fontSize: 14,
    marginRight: 6,
  },
  recordingText: {
    fontSize: 13,
    color: '#E25B5B',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EFF3F0',
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F7F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micButtonActive: {
    backgroundColor: '#FEF2F2',
  },
  micButtonText: {
    fontSize: 20,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    borderRadius: 22,
    backgroundColor: '#F7FAF8',
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#2D4A3E',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  sendButton: {
    backgroundColor: '#5DA480',
    width: 42,
    height: 42,
    borderRadius: 21,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#C5D8CD',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3D7A5F',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitleIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  headerButtonIcon: {
    fontSize: 13,
    color: '#fff',
  },
  headerButtonLabel: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },

  // History modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
    paddingBottom: 30,
  },
  modalHeader: {
    alignItems: 'center',
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F1',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4DED8',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 26,
  },
  modalClose: {
    fontSize: 15,
    color: '#5DA480',
    fontWeight: '600',
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyHistoryIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyHistory: {
    color: '#A0B0A8',
    fontSize: 15,
  },
  sessionItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F7F5',
  },
  sessionItemActive: {
    backgroundColor: '#EEF6F1',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5DA480',
    marginRight: 14,
  },
  sessionTextArea: {
    flex: 1,
  },
  sessionPreview: {
    fontSize: 15,
    color: '#2D4A3E',
    fontWeight: '500',
    marginBottom: 4,
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDate: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  sessionCount: {
    fontSize: 12,
    color: '#A0B0A8',
  },
});
