import React, { useContext } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthContext } from '../context/AuthContext';
import MoodScreen from '../screens/MoodScreen';
import ChatScreen from '../screens/ChatScreen';
import AssessmentScreen from '../screens/AssessmentScreen';
import RecoveryPlanScreen from '../screens/RecoveryPlanScreen';
import ArticleScreen from '../screens/ArticleScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SupporterHomeScreen from '../screens/SupporterHomeScreen';
import EncouragementScreen from '../screens/EncouragementScreen';

export type HomeTabParamList = {
  Mood: undefined;
  Chat: undefined;
  Recovery: undefined;
  Articles: undefined;
  Assessment: undefined;
  Profile: undefined;
  SupporterHome: undefined;
  Encouragement: undefined;
};

const Tab = createBottomTabNavigator<HomeTabParamList>();

const tabIcon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.65 }}>
    {emoji}
  </Text>
);

export default function HomeTabs() {
  const { userRole } = useContext(AuthContext);

  const isSupporter = userRole === 'supporter';

  const headerColor = isSupporter ? '#5A6FC2' : '#3D7A5F';
  const activeTabColor = isSupporter ? '#5A6FC2' : '#3D7A5F';

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: headerColor,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: 0.5,
        },
        tabBarActiveTintColor: activeTabColor,
        tabBarInactiveTintColor: '#A0B0A8',
        tabBarStyle: {
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
          backgroundColor: '#fff',
          borderTopColor: isSupporter ? '#E8EAF6' : '#EFF3F0',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      {isSupporter ? (
        <>
          <Tab.Screen
            name="SupporterHome"
            component={SupporterHomeScreen}
            options={{
              title: '守护者中心',
              tabBarLabel: '天使状态',
              tabBarIcon: tabIcon('👥'),
            }}
          />
          <Tab.Screen
            name="Encouragement"
            component={EncouragementScreen}
            options={{
              title: '守护者中心',
              tabBarLabel: '发送鼓励',
              tabBarIcon: tabIcon('💝'),
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: '守护者中心',
              tabBarLabel: '个人中心',
              tabBarIcon: tabIcon('👤'),
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Mood"
            component={MoodScreen}
            options={{
              title: '心理守护',
              tabBarLabel: '情绪记录',
              tabBarIcon: tabIcon('💚'),
            }}
          />
          <Tab.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: false,
              tabBarLabel: 'AI对话',
              tabBarIcon: tabIcon('💬'),
            }}
          />
          <Tab.Screen
            name="Recovery"
            component={RecoveryPlanScreen}
            options={{
              title: '心理守护',
              tabBarLabel: '今日计划',
              tabBarIcon: tabIcon('🏆'),
            }}
          />
          <Tab.Screen
            name="Articles"
            component={ArticleScreen}
            options={{
              title: '心理守护',
              tabBarLabel: '科普阅读',
              tabBarIcon: tabIcon('📖'),
            }}
          />
          <Tab.Screen
            name="Encouragement"
            component={EncouragementScreen}
            options={{
              title: '守护者聊天',
              tabBarLabel: '守护者',
              tabBarIcon: tabIcon('💝'),
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: '心理守护',
              tabBarLabel: '个人中心',
              tabBarIcon: tabIcon('👤'),
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
}
