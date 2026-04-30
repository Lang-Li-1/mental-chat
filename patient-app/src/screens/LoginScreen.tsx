import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../services/api';

const { width } = Dimensions.get('window');
const isWide = width > 600;

export default function LoginScreen() {
  const { signIn } = useContext(AuthContext);

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'supporter'>('patient');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      showAlert('提示', '请填写用户名和密码');
      return;
    }
    if (isRegister && !email.trim()) {
      showAlert('提示', '请填写邮箱');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (isRegister) {
        response = await authAPI.register({
          username: username.trim(),
          email: email.trim(),
          password: password,
          role: selectedRole,
        });
      } else {
        response = await authAPI.login({
          username: username.trim(),
          password: password,
        });
      }

      const { tokens, user } = response.data;

      await AsyncStorage.setItem('refresh_token', tokens.refresh);
      await AsyncStorage.setItem('user_info', JSON.stringify(user));

      await signIn(tokens.access, user.role);
    } catch (error: any) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.username?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.password?.[0] ||
        error.response?.data?.non_field_errors?.[0] ||
        '操作失败，请检查网络连接';
      showAlert('错误', String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative top wave */}
          <View style={styles.decorTop}>
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>{'🌿'}</Text>
            </View>
            <Text style={styles.appTitle}>{'心理守护'}</Text>
            <Text style={styles.appSubtitle}>
              {'温暖陪伴，守护您的内心世界'}
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.form, isWide && styles.formWide]}>
            <Text style={styles.formTitle}>
              {isRegister ? '创建新账号' : '欢迎回来'}
            </Text>
            <Text style={styles.formSubtitle}>
              {isRegister ? '开启你的心灵健康之旅' : '继续你的心灵健康之旅'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{'用户名'}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'username' && styles.inputWrapperFocused,
                ]}
              >
                <Text style={styles.inputIcon}>{'👤'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={'请输入用户名'}
                  placeholderTextColor="#B8C4D0"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{'我是'}</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[styles.roleOption, selectedRole === 'patient' && styles.roleOptionActive]}
                    onPress={() => setSelectedRole('patient')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.roleOptionEmoji}>{'🌱'}</Text>
                    <Text style={[styles.roleOptionText, selectedRole === 'patient' && styles.roleOptionTextActive]}>
                      {'天使'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleOption, selectedRole === 'supporter' && styles.roleOptionActive]}
                    onPress={() => setSelectedRole('supporter')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.roleOptionEmoji}>{'🤝'}</Text>
                    <Text style={[styles.roleOptionText, selectedRole === 'supporter' && styles.roleOptionTextActive]}>
                      {'守护者'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{'邮箱'}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'email' && styles.inputWrapperFocused,
                  ]}
                >
                  <Text style={styles.inputIcon}>{'✉️'}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={'请输入邮箱'}
                    placeholderTextColor="#B8C4D0"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{'密码'}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                ]}
              >
                <Text style={styles.inputIcon}>{'🔒'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={'请输入密码'}
                  placeholderTextColor="#B8C4D0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.6}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isRegister ? '注册' : '登录'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsRegister(!isRegister)}
              activeOpacity={0.7}
            >
              <Text style={styles.switchText}>
                {isRegister
                  ? '已有账号？点此登录'
                  : '没有账号？点此注册'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom tagline */}
          <Text style={styles.bottomText}>{'用心倾听 · 温暖陪伴 · 专业守护'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#EEF4ED',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  decorTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 200,
    height: 200,
  },
  decorCircle1: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(93, 164, 128, 0.12)',
  },
  decorCircle2: {
    position: 'absolute',
    top: 40,
    right: 60,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(93, 164, 128, 0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(93, 164, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 36,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2D4A3E',
    marginBottom: 8,
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 15,
    color: '#6B8F7B',
    letterSpacing: 0.5,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#2D4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  formWide: {
    padding: 36,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D4A3E',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#8FA89B',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7D6A',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    borderRadius: 14,
    backgroundColor: '#F7FAF8',
    paddingHorizontal: 14,
  },
  inputWrapperFocused: {
    borderColor: '#5DA480',
    backgroundColor: '#fff',
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D4A3E',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  button: {
    backgroundColor: '#5DA480',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#5DA480',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2EBE6',
    backgroundColor: '#F7FAF8',
  },
  roleOptionActive: {
    borderColor: '#5DA480',
    backgroundColor: '#EEF6F1',
  },
  roleOptionEmoji: {
    fontSize: 18,
  },
  roleOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E9E95',
  },
  roleOptionTextActive: {
    color: '#3D7A5F',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchText: {
    color: '#5DA480',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomText: {
    textAlign: 'center',
    color: '#8FA89B',
    fontSize: 12,
    marginTop: 32,
    letterSpacing: 1,
  },
});
