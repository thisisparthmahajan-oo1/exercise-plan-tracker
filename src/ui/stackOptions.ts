import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { fonts, palette } from '@/constants/theme';

export const defaultStackOptions: NativeStackNavigationOptions = {
  contentStyle: { backgroundColor: palette.bg },
  headerStyle: { backgroundColor: palette.bg },
  headerTintColor: palette.text,
  headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
  headerShadowVisible: false,
  headerBackTitle: '',
  headerBackButtonDisplayMode: 'minimal',
};
