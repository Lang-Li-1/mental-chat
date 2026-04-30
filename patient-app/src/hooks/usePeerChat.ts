import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { peerChatAPI, EncouragementMessage } from '../services/api';
import { API_BASE_URL } from '../config';

type Status = 'connecting' | 'open' | 'closed';

function wsUrlFromBase(peerId: number, token: string): string {
  // API_BASE_URL is "http://host[:port]" — convert to ws/wss
  const url = new URL(API_BASE_URL);
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}/ws/chat/${peerId}/?token=${encodeURIComponent(token)}`;
}

export function usePeerChat(peerId: number | null) {
  const [messages, setMessages] = useState<EncouragementMessage[]>([]);
  const [status, setStatus] = useState<Status>('closed');
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupSocket = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async (pid: number) => {
    cleanupSocket();
    setStatus('connecting');
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      setStatus('closed');
      return;
    }
    const ws = new WebSocket(wsUrlFromBase(pid, token));
    wsRef.current = ws;
    ws.onopen = () => setStatus('open');
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'message' && data.message) {
          setMessages((prev) => {
            // Dedupe by id
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message as EncouragementMessage];
          });
        }
      } catch {}
    };
    ws.onclose = () => {
      setStatus('closed');
      // Auto-reconnect after 2s if peer is still selected
      if (peerIdRef.current === pid) {
        reconnectTimer.current = setTimeout(() => connect(pid), 2000);
      }
    };
    ws.onerror = () => {
      // onclose will fire next
    };
  }, [cleanupSocket]);

  // Track current peerId in a ref so reconnect knows whether to retry
  const peerIdRef = useRef<number | null>(null);
  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  // Initial history load + WS connect when peer changes
  useEffect(() => {
    if (peerId == null) {
      cleanupSocket();
      setMessages([]);
      setStatus('closed');
      return;
    }
    let cancelled = false;
    setLoading(true);
    peerChatAPI
      .history(peerId)
      .then((res) => {
        if (!cancelled) setMessages(res.data);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    connect(peerId);
    return () => {
      cancelled = true;
      cleanupSocket();
    };
  }, [peerId, connect, cleanupSocket]);

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || peerId == null) return false;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: trimmed }));
        return true;
      }
      // HTTP fallback when socket not ready — the message will appear via
      // next history reload, but we also push it locally for instant feedback.
      peerChatAPI
        .send(peerId, trimmed)
        .then((res) => {
          setMessages((prev) =>
            prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data],
          );
        })
        .catch(() => {});
      return true;
    },
    [peerId],
  );

  return { messages, status, loading, send };
}
