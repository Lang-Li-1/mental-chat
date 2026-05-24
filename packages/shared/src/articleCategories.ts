export const ARTICLE_CATEGORIES = [
  { value: 'general', label: '综合' },
  { value: 'depression', label: '抑郁症' },
  { value: 'anxiety', label: '焦虑症' },
  { value: 'sleep', label: '睡眠' },
  { value: 'stress', label: '压力管理' },
  { value: 'relationship', label: '人际关系' },
  { value: 'self_care', label: '自我关怀' },
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]['value'];

export function getArticleCategoryLabel(value: string): string {
  return ARTICLE_CATEGORIES.find((category) => category.value === value)?.label || value;
}
