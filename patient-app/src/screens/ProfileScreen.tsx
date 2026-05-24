import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { userAPI, UserInfo } from '../services/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function getRoleLabel(role: string): string {
  const roles: Record<string, string> = {
    patient: '患者',
    professional: '专业人士',
    supporter: '守护者',
  };
  return roles[role] || role;
}

function getRoleEmoji(role: string): string {
  const emojis: Record<string, string> = {
    patient: '🌱',
    professional: '🩺',
    supporter: '🤝',
  };
  return emojis[role] || '👤';
}

export default function ProfileScreen() {
  const { signOut, userRole } = useContext(AuthContext);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const response = await userAPI.getMe();
      setUser(response.data);
    } catch (error: any) {
      console.error('Failed to fetch user info', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        await userAPI.deleteAccount();
        signOut();
      } catch {
        if (Platform.OS === 'web') {
          window.alert('注销失败，请稍后重试');
        } else {
          Alert.alert('错误', '注销失败，请稍后重试');
        }
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('确定要注销账号吗？此操作不可撤销，所有数据将被永久删除。')) {
        doDelete();
      }
    } else {
      Alert.alert(
        '注销账号',
        '确定要注销账号吗？此操作不可撤销，所有数据将被永久删除。',
        [
          { text: '取消', style: 'cancel' },
          { text: '确认注销', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('确定要退出登录吗？')) {
        signOut();
      }
    } else {
      Alert.alert(
        '确认退出',
        '确定要退出登录吗？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '退出',
            style: 'destructive',
            onPress: async () => {
              await signOut();
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5DA480" />
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
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileBg}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.username}>{user?.username || '--'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleEmoji}>{getRoleEmoji(user?.role || '')}</Text>
            <Text style={styles.roleText}>
              {getRoleLabel(user?.role || '')}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>{'账号信息'}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'👤'}</Text>
            <Text style={styles.infoLabel}>{'用户名'}</Text>
          </View>
          <Text style={styles.infoValue}>{user?.username || '--'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'✉️'}</Text>
            <Text style={styles.infoLabel}>{'邮箱'}</Text>
          </View>
          <Text style={[styles.infoValue, !user?.email && styles.infoValueEmpty]}>
            {user?.email || '未设置'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'📱'}</Text>
            <Text style={styles.infoLabel}>{'手机'}</Text>
          </View>
          <Text style={[styles.infoValue, !user?.phone && styles.infoValueEmpty]}>
            {user?.phone || '未设置'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'📅'}</Text>
            <Text style={styles.infoLabel}>{'注册时间'}</Text>
          </View>
          <Text style={styles.infoValue}>
            {user?.created_at ? formatDate(user.created_at) : '--'}
          </Text>
        </View>
      </View>

      {/* Privacy Settings */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>{'🔒 隐私与安全'}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'🛡️'}</Text>
            <Text style={styles.infoLabel}>{'数据加密'}</Text>
          </View>
          <Text style={[styles.infoValue, { color: '#5DA480' }]}>{'已启用'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'📊'}</Text>
            <Text style={styles.infoLabel}>{'数据范围'}</Text>
          </View>
          <Text style={styles.infoValue}>{'仅授权可见'}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={handleDeleteAccount}
          activeOpacity={0.6}
        >
          <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{'🗑️'}</Text>
            <Text style={[styles.infoLabel, { color: '#E25B5B' }]}>{'注销账号'}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#E25B5B' }}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>{'退出登录'}</Text>
      </TouchableOpacity>

      {/* App Info */}
      <Text style={styles.appVersion}>{'心理守护 v1.0.0'}</Text>
      <Text style={styles.appTagline}>{'用心倾听 · 温暖陪伴'}</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F7F5',
  },
  profileCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  profileBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#3D7A5F',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatarContainer: {
    alignItems: 'center',
    padding: 28,
    paddingTop: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  roleEmoji: {
    fontSize: 14,
  },
  roleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoLabel: {
    fontSize: 15,
    color: '#6B8F7B',
  },
  infoValue: {
    fontSize: 15,
    color: '#2D4A3E',
    fontWeight: '500',
  },
  infoValueEmpty: {
    color: '#C0CCC5',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFF3F0',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#E25B5B',
  },
  logoutButtonText: {
    color: '#E25B5B',
    fontSize: 16,
    fontWeight: '700',
  },
  appVersion: {
    textAlign: 'center',
    color: '#A0B0A8',
    fontSize: 13,
    marginBottom: 4,
  },
  appTagline: {
    textAlign: 'center',
    color: '#C0CCC5',
    fontSize: 12,
    letterSpacing: 1,
  },
});
