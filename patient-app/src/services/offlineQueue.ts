/**
 * Offline queue for mood entries — Phase 4.3
 * Queues mood entries when offline, syncs when connection is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { moodAPI, type CreateMoodEntryRequest } from './api';

const QUEUE_KEY = 'offline_mood_queue';

interface QueuedEntry {
  data: CreateMoodEntryRequest;
  timestamp: string;
}

export async function getQueue(): Promise<QueuedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueMoodEntry(data: CreateMoodEntryRequest): Promise<void> {
  const queue = await getQueue();
  queue.push({ data, timestamp: new Date().toISOString() });
  await saveQueue(queue);
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const remaining: QueuedEntry[] = [];

  for (const entry of queue) {
    try {
      await moodAPI.create(entry.data);
      synced++;
    } catch {
      remaining.push(entry);
    }
  }

  await saveQueue(remaining);
  return { synced, failed: remaining.length };
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  } catch {
    return true; // Assume online if check fails
  }
}

/**
 * Smart mood entry submission: tries online first, falls back to queue.
 */
export async function submitMoodEntry(data: CreateMoodEntryRequest): Promise<{ queued: boolean }> {
  const online = await isOnline();
  if (online) {
    try {
      await moodAPI.create(data);
      // Also try to sync any previously queued entries
      await syncQueue();
      return { queued: false };
    } catch {
      // Network error — queue it
      await enqueueMoodEntry(data);
      return { queued: true };
    }
  } else {
    await enqueueMoodEntry(data);
    return { queued: true };
  }
}

/**
 * Start background sync listener.
 * Call once at app startup, returns unsubscribe function.
 */
export function startOfflineSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue().catch(() => {});
    }
  });
  return unsubscribe;
}
