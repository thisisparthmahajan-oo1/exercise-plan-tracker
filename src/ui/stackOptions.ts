import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { fonts } from '@/constants/theme';

// Per-screen overrides need theme-aware bg/header colors; this base only
// covers the things that never change. Consumers that set their own
// Stack.Screen options carry the bulk of styling.
export const defaultStackOptions: NativeStackNavigationOptions = {
  headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
  headerShadowVisible: false,
  headerBackTitle: '',
  headerBackButtonDisplayMode: 'minimal',
};
