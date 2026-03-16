import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import HomeTabs from './src/navigation/HomeTabs';
import { AuthContext } from './src/context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('access_token');
        const userInfo = await AsyncStorage.getItem('user_info');
        if (storedToken) {
          setToken(storedToken);
        }
        if (userInfo) {
          try {
            const parsed = JSON.parse(userInfo);
            setUserRole(parsed.role || null);
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load token', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const authContext = {
    token,
    userRole,
    signIn: async (accessToken: string, role?: string) => {
      await AsyncStorage.setItem('access_token', accessToken);
      setToken(accessToken);
      if (role) setUserRole(role);
    },
    signOut: async () => {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user_info');
      setToken(null);
      setUserRole(null);
    },
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#5DA480" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {token == null ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <Stack.Screen name="Home" component={HomeTabs} />
          )}
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
