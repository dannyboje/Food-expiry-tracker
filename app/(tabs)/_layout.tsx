import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand } from '@/constants/theme';

function AddTabButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/add-item')}
      style={styles.addBtn}
      hitSlop={8}>
      <View style={styles.addBtnInner}>
        <IconSymbol name="plus.circle.fill" size={28} color="#fff" />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.green,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Pantry',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="refrigerator" color={color} />,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => <AddTabButton />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Health',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="cart" color={color} />,
        }}
      />
      {/* Hidden tabs — content moved into Household screen */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="recipes" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 4 : 0,
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
