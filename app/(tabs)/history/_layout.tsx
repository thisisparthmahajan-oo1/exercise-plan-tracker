import { Stack } from 'expo-router';

import { defaultStackOptions } from '@/src/ui/stackOptions';

export default function HistoryLayout() {
  return <Stack screenOptions={defaultStackOptions} />;
}
