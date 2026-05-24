import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { ARTICLE_CATEGORIES, getArticleCategoryLabel } from '@mental-chat/shared';
import { articleAPI, ArticleItem } from '../services/api';

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  ...ARTICLE_CATEGORIES,
];

export default function ArticleScreen() {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await articleAPI.list(selectedCat || undefined);
      setArticles(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCat]);

  useEffect(() => {
    setLoading(true);
    fetchArticles();
  }, [fetchArticles]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchArticles();
  };

  if (selectedArticle) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedArticle(null)}>
          <Text style={styles.backBtnText}>{'< 返回列表'}</Text>
        </TouchableOpacity>
        <View style={styles.articleDetail}>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{getArticleCategoryLabel(selectedArticle.category)}</Text>
          </View>
          <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
          <Text style={styles.articleDetailMeta}>
            {selectedArticle.author_name || '心理守护'} · {new Date(selectedArticle.created_at).toLocaleDateString('zh-CN')}
          </Text>
          {selectedArticle.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{selectedArticle.summary}</Text>
            </View>
          ) : null}
          <Text style={styles.articleContent}>{selectedArticle.content}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5DA480" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={styles.catBarContent}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.value}
            style={[styles.catTab, selectedCat === c.value && styles.catTabActive]}
            onPress={() => setSelectedCat(c.value)}
          >
            <Text style={[styles.catTabText, selectedCat === c.value && styles.catTabTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#5DA480" />
        </View>
      )}

      {!loading && articles.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>暂无文章</Text>
        </View>
      )}

      {!loading && articles.map(a => (
        <TouchableOpacity key={a.id} style={styles.card} onPress={() => {
          if (a.url) {
            if (Platform.OS === 'web') {
              window.open(a.url, '_blank');
            } else {
              Linking.openURL(a.url);
            }
          } else {
            setSelectedArticle(a);
          }
        }} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            <View style={styles.cardCat}>
              <Text style={styles.cardCatText}>{getArticleCategoryLabel(a.category)}</Text>
            </View>
            {a.url ? (
              <View style={[styles.cardCat, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                <Text style={[styles.cardCatText, { color: '#2563eb' }]}>{'外部链接'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardTitle}>{a.title}</Text>
          {a.summary ? <Text style={styles.cardSummary} numberOfLines={2}>{a.summary}</Text> : null}
          <Text style={styles.cardMeta}>{a.author_name || '心理守护'} · {new Date(a.created_at).toLocaleDateString('zh-CN')}</Text>
        </TouchableOpacity>
      ))}
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
  catBar: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  catBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E8E3',
  },
  catTabActive: {
    backgroundColor: '#3D7A5F',
    borderColor: '#3D7A5F',
  },
  catTabText: {
    fontSize: 13,
    color: '#6B8F7B',
    fontWeight: '600',
  },
  catTabTextActive: {
    color: '#fff',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#A0B0A8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCat: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61, 122, 95, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  cardCatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D7A5F',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
    lineHeight: 22,
  },
  cardSummary: {
    fontSize: 14,
    color: '#6B8F7B',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  // Detail view
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 14,
    color: '#3D7A5F',
    fontWeight: '600',
  },
  articleDetail: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61, 122, 95, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  catBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D7A5F',
  },
  articleDetailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D4A3E',
    lineHeight: 28,
    marginBottom: 8,
  },
  articleDetailMeta: {
    fontSize: 13,
    color: '#A0B0A8',
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: '#F4F7F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3D7A5F',
  },
  summaryText: {
    fontSize: 14,
    color: '#6B8F7B',
    lineHeight: 21,
    fontStyle: 'italic',
  },
  articleContent: {
    fontSize: 15,
    color: '#2D4A3E',
    lineHeight: 26,
  },
});
