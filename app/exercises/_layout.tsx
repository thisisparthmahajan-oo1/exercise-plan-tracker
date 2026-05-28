import { Stack } from 'expo-router';

import { defaultStackOptions } from '@/src/ui/stackOptions';

export default function ExercisesLayout() {
  return <Stack screenOptions={defaultStackOptions} />;
}
