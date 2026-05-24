const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Invalid credentials.': '用户名或密码错误。',
  'Enter a valid email address.': '请输入有效的邮箱地址。',
  'At least one of email or phone must be provided.': '邮箱和手机号至少填写一个。',
  'Authentication required': '请先登录。',
  'Invalid JSON': '请求数据格式不正确。',
  'content is required': '请输入消息内容。',
  'content is required.': '请输入消息内容。',
  'Task not found.': '任务不存在或不属于当前账号。',
  'Already completed.': '任务已完成，请刷新后查看。',
  'Patient not found.': '患者不存在。',
  'Already linked.': '已经关联过该患者。',
  'Only supporters can link patients.': '只有守护者可以关联患者。',
  'Please provide patient username or phone.': '请输入患者用户名或手机号。',
  'You are not linked to this patient.': '您尚未关联该患者。',
  'Permission denied.': '没有操作权限。',
  'Stream request failed: 401': '登录已过期，请重新登录。',
  'Stream request failed: 403': '没有操作权限。',
  'Stream request failed: 500': '服务器异常，请稍后重试。',
  'No reader': '当前浏览器不支持流式响应。',
  'Connection lost': '连接中断，请稍后重试。',
  'Network Error': '网络连接异常，请检查网络。',
};

export function toChineseErrorMessage(value: unknown, fallback = '操作失败，请稍后重试。') {
  if (!value) return fallback;
  const message = String(value);
  return ERROR_MESSAGE_MAP[message] || message;
}
