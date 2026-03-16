import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { assessmentAPI, AssessmentResult } from '../services/api';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── PHQ-9 Questions ─────────────────────────────────────────────────────────

const PHQ9_QUESTIONS = [
  '做事时提不起劲或没有兴趣',
  '感到心情低落、沮丧或绝望',
  '入睡困难、睡不安稳或睡眠过多',
  '感觉疲倦或没有活力',
  '食欲不振或吃太多',
  '觉得自己很糟——或觉得自己很失败，或让自己或家人失望',
  '对事物专注有困难，例如阅读报纸或看电视时',
  '动作或说话速度缓慢到别人可以觉察？或正好相反——静不下来、坐立不安',
  '有不如死掉或用某种方式伤害自己的念头',
];

// ── GAD-7 Questions ─────────────────────────────────────────────────────────

const GAD7_QUESTIONS = [
  '感觉紧张、焦虑或急切',
  '不能够停止或控制担忧',
  '对各种各样的事情担忧过多',
  '很难放松下来',
  '由于不安而无法静坐',
  '变得容易烦恼或急躁',
  '感到似乎将有可怕的事情发生而害怕',
];

const OPTION_LABELS = ['完全没有', '有几天', '超过一半天数', '几乎每天'];
const OPTION_SCORES = [0, 1, 2, 3];

type AssessmentType = 'phq9' | 'gad7';
type ScreenState = 'select' | 'quiz' | 'result' | 'history';

function getSeverityPHQ9(score: number): string {
  if (score <= 4) return '正常';
  if (score <= 9) return '轻度抑郁';
  if (score <= 14) return '中度抑郁';
  if (score <= 19) return '中重度抑郁';
  return '重度抑郁';
}

function getSeverityGAD7(score: number): string {
  if (score <= 4) return '正常';
  if (score <= 9) return '轻度焦虑';
  if (score <= 14) return '中度焦虑';
  return '重度焦虑';
}

function getSeverityColor(severity: string): string {
  if (severity.includes('正常')) return '#5DBE8A';
  if (severity.includes('轻度')) return '#E8C34A';
  if (severity.includes('中度') && !severity.includes('中重度')) return '#E88B5A';
  return '#E25B5B';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function AssessmentScreen() {
  const [screen, setScreen] = useState<ScreenState>('select');
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('phq9');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ score: number; severity: string; type: AssessmentType } | null>(null);

  // History
  const [history, setHistory] = useState<AssessmentResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const questions = assessmentType === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
  const getSeverity = assessmentType === 'phq9' ? getSeverityPHQ9 : getSeverityGAD7;

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await assessmentAPI.list();
      setHistory(res.data);
    } catch {
      console.error('Failed to load assessment history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const startQuiz = (type: AssessmentType) => {
    setAssessmentType(type);
    setCurrentQ(0);
    setAnswers([]);
    setScreen('quiz');
  };

  const handleAnswer = async (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);

    const qs = assessmentType === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
    if (currentQ < qs.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Done — submit
      const totalScore = newAnswers.reduce((a, b) => a + b, 0);
      const severity = getSeverity(totalScore);
      setSubmitting(true);
      try {
        await assessmentAPI.create({
          assessment_type: assessmentType,
          total_score: totalScore,
          answers: newAnswers,
          severity,
        });
        setLastResult({ score: totalScore, severity, type: assessmentType });
        setScreen('result');
        fetchHistory();
      } catch (err: any) {
        showAlert('提交失败', err.response?.data?.detail || '请稍后重试');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setAnswers(answers.slice(0, -1));
    } else {
      setScreen('select');
    }
  };

  // ── Select Screen ───────────────────────────────────────────────────────
  if (screen === 'select') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectContent}>
        <Text style={styles.pageTitle}>{'心理自评量表'}</Text>
        <Text style={styles.pageSubtitle}>{'选择一个量表开始评估，了解您的心理状态'}</Text>

        {/* PHQ-9 Card */}
        <TouchableOpacity style={styles.quizCard} onPress={() => startQuiz('phq9')} activeOpacity={0.8}>
          <View style={[styles.quizCardIcon, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.quizCardEmoji}>{'📋'}</Text>
          </View>
          <View style={styles.quizCardBody}>
            <Text style={styles.quizCardTitle}>{'PHQ-9 抑郁量表'}</Text>
            <Text style={styles.quizCardDesc}>{'9个问题 · 评估抑郁症状严重程度'}</Text>
            <Text style={styles.quizCardTime}>{'约 2-3 分钟'}</Text>
          </View>
          <Text style={styles.quizCardArrow}>{'›'}</Text>
        </TouchableOpacity>

        {/* GAD-7 Card */}
        <TouchableOpacity style={styles.quizCard} onPress={() => startQuiz('gad7')} activeOpacity={0.8}>
          <View style={[styles.quizCardIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.quizCardEmoji}>{'📊'}</Text>
          </View>
          <View style={styles.quizCardBody}>
            <Text style={styles.quizCardTitle}>{'GAD-7 焦虑量表'}</Text>
            <Text style={styles.quizCardDesc}>{'7个问题 · 评估焦虑症状严重程度'}</Text>
            <Text style={styles.quizCardTime}>{'约 2 分钟'}</Text>
          </View>
          <Text style={styles.quizCardArrow}>{'›'}</Text>
        </TouchableOpacity>

        {/* History Button */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => { setScreen('history'); fetchHistory(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.historyButtonText}>{'查看历史评估记录'}</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {'注意：自评量表仅供参考，不能替代专业诊断。如果您的评估结果显示中度及以上，建议您咨询专业心理医生。'}
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── Quiz Screen ────────────────────────────────────────────────────────
  if (screen === 'quiz') {
    const progress = (currentQ + 1) / questions.length;
    const typeName = assessmentType === 'phq9' ? 'PHQ-9' : 'GAD-7';

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.quizHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{'‹ 返回'}</Text>
          </TouchableOpacity>
          <Text style={styles.quizHeaderTitle}>{typeName}</Text>
          <Text style={styles.quizProgress}>{`${currentQ + 1}/${questions.length}`}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView style={styles.quizBody} contentContainerStyle={styles.quizBodyContent}>
          {/* Instruction */}
          <Text style={styles.quizInstruction}>
            {'在过去两周内，以下问题困扰您的频率是？'}
          </Text>

          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionNumber}>{`第 ${currentQ + 1} 题`}</Text>
            <Text style={styles.questionText}>{questions[currentQ]}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionList}>
            {OPTION_LABELS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.optionButton}
                onPress={() => handleAnswer(OPTION_SCORES[idx])}
                activeOpacity={0.7}
                disabled={submitting}
              >
                <View style={styles.optionLeft}>
                  <View style={styles.optionDot}>
                    <Text style={styles.optionDotText}>{idx}</Text>
                  </View>
                  <Text style={styles.optionLabel}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {submitting && (
            <View style={styles.submittingOverlay}>
              <ActivityIndicator size="large" color="#5DA480" />
              <Text style={styles.submittingText}>{'提交中...'}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Result Screen ──────────────────────────────────────────────────────
  if (screen === 'result' && lastResult) {
    const color = getSeverityColor(lastResult.severity);
    const typeName = lastResult.type === 'phq9' ? 'PHQ-9 抑郁量表' : 'GAD-7 焦虑量表';
    const maxScore = lastResult.type === 'phq9' ? 27 : 21;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{'评估完成'}</Text>
          <Text style={styles.resultType}>{typeName}</Text>

          <View style={[styles.scoreCircle, { borderColor: color }]}>
            <Text style={[styles.scoreValue, { color }]}>{lastResult.score}</Text>
            <Text style={styles.scoreMax}>{`/ ${maxScore}`}</Text>
          </View>

          <View style={[styles.severityBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.severityText, { color }]}>{lastResult.severity}</Text>
          </View>

          {/* Score breakdown */}
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>{'各题得分'}</Text>
            <View style={styles.breakdownRow}>
              {answers.map((a, i) => (
                <View key={i} style={styles.breakdownItem}>
                  <Text style={styles.breakdownQ}>{`Q${i + 1}`}</Text>
                  <View style={[styles.breakdownDot, {
                    backgroundColor: a === 0 ? '#5DBE8A' : a === 1 ? '#E8C34A' : a === 2 ? '#E88B5A' : '#E25B5B'
                  }]}>
                    <Text style={styles.breakdownScore}>{a}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Suggestion */}
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionTitle}>{'建议'}</Text>
            <Text style={styles.suggestionText}>
              {lastResult.severity.includes('正常')
                ? '您的评估结果在正常范围内，请继续保持良好的心理状态。如有需要，可以随时使用AI对话功能倾诉。'
                : lastResult.severity.includes('轻度')
                ? '您可能存在轻度症状，建议关注自己的情绪变化，保持规律作息和适当运动。可以尝试使用AI对话功能获取支持。'
                : '您的评估结果偏高，建议您尽快咨询专业心理医生进行进一步评估和治疗。如有紧急情况，请立即拨打心理援助热线。'}
            </Text>
          </View>
        </View>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => setScreen('select')}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeBtnText}>{'返回首页'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── History Screen ─────────────────────────────────────────────────────
  if (screen === 'history') {
    return (
      <View style={styles.container}>
        <View style={styles.historyHeader}>
          <TouchableOpacity onPress={() => setScreen('select')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{'‹ 返回'}</Text>
          </TouchableOpacity>
          <Text style={styles.historyHeaderTitle}>{'评估记录'}</Text>
          <View style={{ width: 60 }} />
        </View>

        {historyLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5DA480" />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{'📝'}</Text>
            <Text style={styles.emptyText}>{'暂无评估记录'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.historyList}>
            {history.map((item) => {
              const color = getSeverityColor(item.severity);
              const typeName = item.assessment_type === 'phq9' ? 'PHQ-9' : 'GAD-7';
              const maxScore = item.assessment_type === 'phq9' ? 27 : 21;
              return (
                <View key={item.id} style={styles.historyItem}>
                  <View style={[styles.historyColorBar, { backgroundColor: color }]} />
                  <View style={styles.historyItemBody}>
                    <View style={styles.historyItemTop}>
                      <View>
                        <Text style={styles.historyItemType}>{typeName}</Text>
                        <Text style={styles.historyItemDate}>{formatDate(item.created_at)}</Text>
                      </View>
                      <View style={styles.historyItemRight}>
                        <Text style={[styles.historyItemScore, { color }]}>
                          {item.total_score}
                          <Text style={styles.historyItemMax}>{` / ${maxScore}`}</Text>
                        </Text>
                        <View style={[styles.historyBadge, { backgroundColor: color + '18' }]}>
                          <Text style={[styles.historyBadgeText, { color }]}>{item.severity}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  selectContent: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D4A3E',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8E9E95',
    marginBottom: 24,
  },

  // Quiz cards
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  quizCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quizCardEmoji: {
    fontSize: 24,
  },
  quizCardBody: {
    flex: 1,
  },
  quizCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  quizCardDesc: {
    fontSize: 13,
    color: '#8E9E95',
    marginBottom: 2,
  },
  quizCardTime: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  quizCardArrow: {
    fontSize: 24,
    color: '#C0CCC5',
    marginLeft: 8,
  },

  // History button
  historyButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#5DA480',
  },
  historyButtonText: {
    color: '#5DA480',
    fontSize: 15,
    fontWeight: '600',
  },

  // Disclaimer
  disclaimer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#8B7A3B',
    lineHeight: 20,
  },

  // Quiz header
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 16,
    color: '#5DA480',
    fontWeight: '600',
  },
  quizHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  quizProgress: {
    fontSize: 14,
    color: '#8E9E95',
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },

  // Progress bar
  progressBar: {
    height: 4,
    backgroundColor: '#EFF3F0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5DA480',
    borderRadius: 2,
  },

  // Quiz body
  quizBody: {
    flex: 1,
  },
  quizBodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  quizInstruction: {
    fontSize: 14,
    color: '#8E9E95',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Question card
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  questionNumber: {
    fontSize: 13,
    color: '#5DA480',
    fontWeight: '700',
    marginBottom: 10,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D4A3E',
    textAlign: 'center',
    lineHeight: 26,
  },

  // Options
  optionList: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF6F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5DA480',
  },
  optionLabel: {
    fontSize: 16,
    color: '#2D4A3E',
    fontWeight: '500',
  },

  submittingOverlay: {
    alignItems: 'center',
    marginTop: 30,
    gap: 10,
  },
  submittingText: {
    color: '#8E9E95',
    fontSize: 14,
  },

  // Result
  resultContent: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  resultType: {
    fontSize: 14,
    color: '#8E9E95',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 14,
    color: '#A0B0A8',
    fontWeight: '500',
  },
  severityBadge: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 28,
  },
  severityText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Breakdown
  breakdownSection: {
    width: '100%',
    marginBottom: 24,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  breakdownItem: {
    alignItems: 'center',
    gap: 4,
  },
  breakdownQ: {
    fontSize: 11,
    color: '#A0B0A8',
    fontWeight: '600',
  },
  breakdownDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Suggestion
  suggestionBox: {
    width: '100%',
    backgroundColor: '#F4F7F5',
    borderRadius: 14,
    padding: 16,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#5A6B60',
    lineHeight: 22,
  },

  // Result actions
  resultActions: {
    gap: 10,
  },
  retakeBtn: {
    backgroundColor: '#5DA480',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  retakeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // History
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF3F0',
  },
  historyHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D4A3E',
  },
  historyList: {
    padding: 16,
    paddingBottom: 40,
  },
  historyItem: {
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
  historyColorBar: {
    width: 4,
  },
  historyItemBody: {
    flex: 1,
    padding: 14,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#A0B0A8',
  },
  historyItemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  historyItemScore: {
    fontSize: 22,
    fontWeight: '800',
  },
  historyItemMax: {
    fontSize: 13,
    color: '#A0B0A8',
    fontWeight: '500',
  },
  historyBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Shared
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0B0A8',
  },
});
