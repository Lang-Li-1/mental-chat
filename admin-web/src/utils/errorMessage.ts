const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Invalid credentials.': '用户名或密码错误。',
  'Enter a valid email address.': '请输入有效的邮箱地址。',
  'At least one of email or phone must be provided.': '邮箱和手机号至少填写一个。',
  'Patient not found': '患者不存在。',
  'Patient not found.': '患者不存在。',
  'User not found.': '用户不存在。',
  'Assignment not found.': '分配关系不存在。',
  'This assignment already exists.': '该分配关系已存在。',
  'Permission denied.': '没有操作权限。',
  'Network Error': '网络连接异常，请检查网络。',
};

export function toChineseErrorMessage(value: unknown, fallback = '操作失败，请稍后重试。') {
  if (!value) return fallback;
  const maybeAxiosError = value as {
    response?: { data?: { detail?: unknown; message?: unknown } | string };
    message?: unknown;
  };
  const responseData = maybeAxiosError.response?.data;
  const rawMessage =
    typeof responseData === 'string'
      ? responseData
      : responseData?.detail || responseData?.message || maybeAxiosError.message || value;
  const message = String(rawMessage);
  return ERROR_MESSAGE_MAP[message] || message;
}
