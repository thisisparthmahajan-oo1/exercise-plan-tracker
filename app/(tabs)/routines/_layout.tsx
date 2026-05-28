import { Stack } from 'expo-router';

import { defaultStackOptions } from '@/src/ui/stackOptions';

export default function RoutinesLayout() {
  return <Stack screenOptions={defaultStackOptions} />;
}
