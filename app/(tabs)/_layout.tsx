import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Activity, BookOpen, LayoutDashboard, Settings, SquarePen } from 'lucide-react-native';
import { useThemeColor } from 'heroui-native';
import { useReadingScale } from '@/lib/readingPreferences';
import { selection } from '@/lib/journal';
export default function TabLayout() {
  const scale = useReadingScale();
  const [background, foreground, muted, border, accent] = useThemeColor([
    'background',
    'foreground',
    'muted',
    'border',
    'accent',
  ]);
  return (
    <>
      {/* eslint-disable-next-line react/style-prop-object -- Expo StatusBar's style prop accepts a status-bar mode string, not a style object. */}
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: background },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
          tabBarStyle: {
            backgroundColor: background,
            borderTopColor: border,
            shadowColor: background,
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
            height: 82,
            paddingTop: 9,
            paddingBottom: 20,
          },
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: 11 * Math.min(Math.max(scale, 1), 1.15),
          },
          tabBarLabelPosition: 'below-icon',
          tabBarAllowFontScaling: true,
          tabBarItemStyle: { minWidth: 0 },
          headerTintColor: foreground,
        }}
        screenListeners={({ navigation, route }) => ({
          tabPress: () => {
            if (navigation.getState().routes[navigation.getState().index]?.key !== route.key)
              selection();
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Desk',
            tabBarIcon: ({ color, size }) => (
              <LayoutDashboard color={color} size={size} strokeWidth={1.7} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'Book',
            tabBarIcon: ({ color, size }) => (
              <BookOpen color={color} size={size} strokeWidth={1.7} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, size }) => (
              <Activity color={color} size={size} strokeWidth={1.7} />
            ),
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            title: 'Review',
            tabBarIcon: ({ color, size }) => (
              <SquarePen color={color} size={size} strokeWidth={1.7} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} strokeWidth={1.7} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
