import { Stack } from 'expo-router';

import { defaultStackOptions } from '@/src/ui/stackOptions';

export default function BodyLayout() {
  return <Stack screenOptions={defaultStackOptions} />;
}
