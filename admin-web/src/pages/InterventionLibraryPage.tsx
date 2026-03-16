import { useState } from 'react';

interface Intervention {
  id: number;
  title: string;
  category: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  steps: string[];
  tags: string[];
}

const INTERVENTIONS: Intervention[] = [
  // Low risk
  {
    id: 1, category: '情绪支持', level: 'low',
    title: '积极倾听与共情回应',
    description: '当患者情绪波动较小时，采用积极倾听技术，给予共情回应，帮助患者感受到被理解和支持。',
    steps: ['建立安全的对话环境', '使用开放式提问引导患者表达', '反映患者的情绪并给予肯定', '总结对话内容并确认理解'],
    tags: ['情绪低落', '日常波动', '压力'],
  },
  {
    id: 2, category: '认知行为', level: 'low',
    title: '认知重构练习',
    description: '帮助患者识别负面自动思维，通过认知重构技术建立更平衡的思维方式。',
    steps: ['识别引发不适的情境', '记录自动出现的负面想法', '评估想法的证据和反证', '建立更平衡的替代想法'],
    tags: ['负面思维', '焦虑', '自我怀疑'],
  },
  {
    id: 3, category: '生活方式', level: 'low',
    title: '行为激活计划',
    description: '通过安排愉悦活动和成就性活动，帮助患者打破"低情绪-低活动"的恶性循环。',
    steps: ['评估患者当前的活动水平', '共同制定每日活动计划', '从简单愉悦的活动开始', '逐步增加活动难度和频率', '记录活动后的情绪变化'],
    tags: ['缺乏动力', '社交退缩', '作息紊乱'],
  },
  // Medium risk
  {
    id: 4, category: '情绪调节', level: 'medium',
    title: '正念冥想引导',
    description: '当患者焦虑或情绪不稳定时，引导进行正念冥想练习，帮助回到当下。',
    steps: ['引导患者到安静环境', '指导呼吸放松（4-7-8呼吸法）', '引导身体扫描，觉察紧张部位', '进行5-10分钟正念练习', '讨论练习后的感受'],
    tags: ['焦虑', '恐慌', '失眠', '情绪波动'],
  },
  {
    id: 5, category: '认知行为', level: 'medium',
    title: '暴露与反应预防',
    description: '针对特定恐惧或回避行为，制定渐进式暴露计划，逐步降低焦虑反应。',
    steps: ['建立焦虑层级表（0-100）', '从最低焦虑级别开始暴露', '教授放松应对技术', '在暴露过程中保持不回避', '记录每次暴露后的焦虑变化'],
    tags: ['特定恐惧', '社交焦虑', '回避行为'],
  },
  {
    id: 6, category: '人际关系', level: 'medium',
    title: '社交技能训练',
    description: '帮助患者提升社交能力，改善人际关系，增强社会支持网络。',
    steps: ['评估当前社交困难', '角色扮演练习社交场景', '教授有效沟通技巧', '制定渐进社交计划', '讨论实践中的困难与收获'],
    tags: ['社交障碍', '孤独感', '人际冲突'],
  },
  {
    id: 7, category: '情绪调节', level: 'medium',
    title: '辩证行为疗法技能',
    description: '使用DBT技能帮助患者管理强烈情绪，包括痛苦承受、情绪调节和人际效能。',
    steps: ['教授痛苦承受技能（TIPP技术）', '练习情绪识别和命名', '教授"相反行动"策略', '建立情绪调节计划', '定期回顾和巩固技能'],
    tags: ['情绪失控', '自伤冲动', '人际不稳定'],
  },
  // High risk
  {
    id: 8, category: '危机干预', level: 'high',
    title: '安全计划制定',
    description: '与患者共同制定个人安全计划，明确危机时的应对步骤和求助资源。',
    steps: ['识别个人危机预警信号', '列出自我调节策略', '确定可联系的支持人员', '明确专业求助渠道', '限制接触危险物品', '签署安全承诺'],
    tags: ['自杀风险', '自伤', '危机状态'],
  },
  {
    id: 9, category: '危机干预', level: 'high',
    title: '自杀风险评估与管理',
    description: '系统评估自杀风险水平，根据评估结果制定相应的管理策略。',
    steps: ['使用标准化量表（如C-SSRS）评估', '评估保护因素和风险因素', '确定风险等级', '制定相应管理计划', '安排随访频率', '通知相关支持人员'],
    tags: ['自杀意念', '自杀计划', '自杀未遂史'],
  },
  {
    id: 10, category: '药物管理', level: 'high',
    title: '药物治疗建议与转介',
    description: '当心理干预效果有限时，建议并协助患者获得精神科药物治疗。',
    steps: ['评估当前治疗效果', '与患者讨论药物治疗的利弊', '转介精神科医生', '协调联合治疗计划', '监测药物依从性和副作用'],
    tags: ['重度抑郁', '重度焦虑', '治疗抵抗'],
  },
  // Critical
  {
    id: 11, category: '紧急干预', level: 'critical',
    title: '紧急危机干预流程',
    description: '患者存在即刻危险时的紧急应对流程，包括即时安全评估和必要时的住院安排。',
    steps: ['保持冷静，维持与患者联系', '直接询问自杀/伤害意图', '评估即刻危险程度', '如有即刻风险，拨打急救电话', '不要让患者独处', '安排紧急精神科评估', '通知紧急联系人'],
    tags: ['自杀企图', '急性精神病性症状', '严重自伤'],
  },
  {
    id: 12, category: '紧急干预', level: 'critical',
    title: '强制住院评估建议',
    description: '当患者对自身或他人构成严重危险时，启动强制住院评估程序。',
    steps: ['记录危险行为和评估结果', '联系精神科急诊', '告知患者家属/监护人', '协助安排转运', '提交专业评估报告', '后续跟踪随访'],
    tags: ['严重暴力风险', '严重自杀风险', '急性精神病'],
  },
];

const CATEGORIES = [...new Set(INTERVENTIONS.map(i => i.category))];
const LEVELS: { value: string; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: '#666' },
  { value: 'low', label: '低风险', color: '#5DBE8A' },
  { value: 'medium', label: '中风险', color: '#E8C34A' },
  { value: 'high', label: '高风险', color: '#E88B5A' },
  { value: 'critical', label: '紧急', color: '#E25B5B' },
];

function levelColor(level: string): string {
  const m: Record<string, string> = { low: '#5DBE8A', medium: '#E8C34A', high: '#E88B5A', critical: '#E25B5B' };
  return m[level] || '#999';
}

function levelLabel(level: string): string {
  const m: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险', critical: '紧急' };
  return m[level] || level;
}

function InterventionLibraryPage() {
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = INTERVENTIONS.filter(i => {
    if (filterLevel !== 'all' && i.level !== filterLevel) return false;
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.title.toLowerCase().includes(q)
        || i.description.toLowerCase().includes(q)
        || i.tags.some(t => t.includes(q));
    }
    return true;
  });

  return (
    <div className="page-content">
      <h1 className="page-title">📖 干预建议库</h1>

      <div className="iv-filters">
        <div className="iv-search">
          <input
            type="text"
            className="search-input"
            placeholder="搜索干预方案、标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>
        <div className="iv-filter-row">
          <div className="iv-level-tabs">
            {LEVELS.map(l => (
              <button
                key={l.value}
                className={`iv-level-tab${filterLevel === l.value ? ' active' : ''}`}
                style={filterLevel === l.value ? { backgroundColor: l.color, color: '#fff', borderColor: l.color } : undefined}
                onClick={() => setFilterLevel(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <select
            className="iv-cat-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">全部分类</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="iv-count">{filtered.length} 个方案</div>

      <div className="iv-list">
        {filtered.map(item => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`iv-card${isExpanded ? ' expanded' : ''}`}
              style={{ borderLeftColor: levelColor(item.level) }}
            >
              <div className="iv-card-header" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                <div className="iv-card-left">
                  <span className="iv-card-level" style={{ backgroundColor: levelColor(item.level) + '18', color: levelColor(item.level) }}>
                    {levelLabel(item.level)}
                  </span>
                  <span className="iv-card-cat">{item.category}</span>
                </div>
                <h3 className="iv-card-title">{item.title}</h3>
                <span className="iv-card-toggle">{isExpanded ? '▲' : '▼'}</span>
              </div>

              <p className="iv-card-desc">{item.description}</p>

              {isExpanded && (
                <div className="iv-card-detail">
                  <div className="iv-steps">
                    <h4>实施步骤</h4>
                    <ol>
                      {item.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="iv-tags">
                    {item.tags.map(t => (
                      <span
                        key={t}
                        className="iv-tag"
                        onClick={e => { e.stopPropagation(); setSearch(t); }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="pd-empty">没有匹配的干预方案</div>
        )}
      </div>
    </div>
  );
}

export default InterventionLibraryPage;
