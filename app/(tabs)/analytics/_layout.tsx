import { Stack } from 'expo-router';

import { defaultStackOptions } from '@/src/ui/stackOptions';

export default function AnalyticsLayout() {
  return <Stack screenOptions={defaultStackOptions} />;
}
