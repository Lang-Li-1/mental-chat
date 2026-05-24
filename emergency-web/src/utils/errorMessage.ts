const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Invalid credentials.': '用户名或密码错误。',
  'Enter a valid email address.': '请输入有效的邮箱地址。',
  'At least one of email or phone must be provided.': '邮箱和手机号至少填写一个。',
  'Only admin or professional accounts can access the emergency dashboard.': '只有管理员或医生可以访问应急面板。',
  'Permission denied.': '没有操作权限。',
  'Authentication required': '请先登录。',
  'Network Error': '网络连接异常，请检查网络。',
};

export function toChineseErrorMessage(value: unknown, fallback = '操作失败，请稍后重试。') {
  if (!value) return fallback;
  const message = String(value);
  return ERROR_MESSAGE_MAP[message] || message;
}
