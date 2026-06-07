import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette, radius } from '@/constants/theme';
import { useSessionList } from '@/src/features/history/useSessionList';
import { formatSessionDate } from '@/src/lib/formatDate';
import { useAccent } from '@/src/lib/settings';
import { useElapsedSince } from '@/src/lib/useElapsedSince';
import { useRoutineRepo, useSessionRepo } from '@/src/repos/RepoContext';
import type { RoutineWithExercises, WeeklyStats } from '@/src/repos/types';
import { Glow, Screen, SectionLabel, Surface } from '@/src/ui';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night session?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night session?';
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatVolume(v: number): string {
  if (v >= 100_000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString();
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionRepo = useSessionRepo();
  const routineRepo = useRoutineRepo();
  const { sessions, reload } = useSessionList();
  const accent = useAccent();
  const [starting, setStarting] = useState(false);
  const [nextRoutine, setNextRoutine] = useState<RoutineWithExercises | null>(null);
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
      let cancelled = false;
      (async () => {
        const next = await sessionRepo.suggestNextRoutine();
        if (cancelled) return;
        if (next) {
          const full = await routineRepo.get(next.id);
          if (!cancelled) setNextRoutine(full);
        } else {
          setNextRoutine(null);
        }
        const s = await sessionRepo.weeklyStats();
        if (!cancelled) setStats(s);
      })();
      return () => {
        cancelled = true;
      };
    }, [reload, sessionRepo, routineRepo]),
  );

  const startWorkout = async (routineId: string | null) => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await sessionRepo.start(routineId);
      router.push({ pathname: '/workout/[sessionId]' as const, params: { sessionId: session.id } });
    } catch (e) {
      Alert.alert('Could not start workout', e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const inProgress = sessions.find((s) => !s.endedAt) ?? null;
  const recent = sessions.filter((s) => s.endedAt).slice(0, 3);

  // Day-of-week sequence ending today (Sun..Sat starting index aligned to oldest day of activity window)
  const todayDow = new Date().getDay();
  const daysActive = stats?.daysActive ?? [false, false, false, false, false, false, false];
  const dayLabels = Array.from({ length: 7 }).map((_, i) => {
    const dow = (todayDow - 6 + i + 7) % 7;
    return DAY_INITIALS[dow];
  });

  return (
    <Screen>
      <Glow height={insets.top + 320} intensity={0.22} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18 }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.greeting}>{greeting()}</ThemedText>
            <ThemedText style={styles.dateLabel}>{todayLabel()}</ThemedText>
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => router.push('/settings' as never)}
            style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="gearshape.fill" size={22} color={accent.textDim} />
          </Pressable>
        </View>

        {/* Stats */}
        <Surface style={styles.statsCard}>
          <StatCell
            label="Sessions"
            value={String(stats?.sessionCount ?? 0)}
            sublabel="this week"
          />
          <View style={[styles.statDivider, { backgroundColor: accent.borderSoft }]} />
          <StatCell
            label="Volume"
            value={formatVolume(stats?.totalVolume ?? 0)}
            sublabel="7 days · kg"
            accent
          />
          <View style={[styles.statDivider, { backgroundColor: accent.borderSoft }]} />
          <StatCell
            label="Active"
            value={`${daysActive.filter(Boolean).length}/7`}
            sublabel="days"
          />
        </Surface>

        {/* Hero / today's workout */}
        {inProgress ? (
          <ResumeCard
            label={inProgress.routineName ?? 'Quick Workout'}
            startedAt={inProgress.startedAt}
            onPress={() =>
              router.push({
                pathname: '/workout/[sessionId]' as const,
                params: { sessionId: inProgress.id },
              })
            }
          />
        ) : (
          <HeroCard
            routine={nextRoutine}
            disabled={starting}
            onStart={() => startWorkout(nextRoutine?.id ?? null)}
            onQuickStart={() => startWorkout(null)}
          />
        )}

        {/* Weekly activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel>This week</SectionLabel>
            <ThemedText style={styles.sectionMeta}>
              {daysActive.filter(Boolean).length} of 7 days
            </ThemedText>
          </View>
          <View style={styles.dotsRow}>
            {daysActive.map((active, i) => {
              const isToday = i === 6;
              return (
                <View key={i} style={styles.dotCol}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: accent.surfaceHi },
                      active && {
                        backgroundColor: accent.accent,
                        borderColor: accent.accent,
                      },
                      isToday && { borderColor: accent.accent, borderWidth: 2 },
                    ]}
                  />
                  <ThemedText
                    style={[
                      styles.dotLabel,
                      isToday && { color: accent.text, fontWeight: '700' as const },
                    ]}>
                    {dayLabels[i]}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent */}
        {recent.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Recent</SectionLabel>
            <View style={styles.recentList}>
              {recent.map((s) => (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/history/[id]' as const,
                      params: { id: s.id },
                    })
                  }>
                  <Surface style={[styles.recentCard, { borderColor: accent.accentEdge }]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.recentTitle}>
                        {s.routineName ?? 'Quick Workout'}
                      </ThemedText>
                      <ThemedText style={styles.recentMeta}>
                        {formatSessionDate(s.startedAt)} · {s.setCount} set
                        {s.setCount === 1 ? '' : 's'}
                      </ThemedText>
                    </View>
                    {s.totalVolume > 0 ? (
                      <View style={styles.recentVolume}>
                        <ThemedText style={[styles.recentVolumeValue, { color: accent.accent }]}>
                          {formatVolume(s.totalVolume)}
                        </ThemedText>
                        <ThemedText style={styles.recentVolumeLabel}>VOL</ThemedText>
                      </View>
                    ) : null}
                  </Surface>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StatCell({
  label,
  value,
  sublabel,
  accent = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  const accentTokens = useAccent();
  return (
    <View style={styles.statCell}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText
        style={[styles.statValue, accent && { color: accentTokens.accent }]}>
        {value}
      </ThemedText>
      {sublabel ? <ThemedText style={styles.statSub}>{sublabel}</ThemedText> : null}
    </View>
  );
}

function HeroCard({
  routine,
  disabled,
  onStart,
  onQuickStart,
}: {
  routine: RoutineWithExercises | null;
  disabled?: boolean;
  onStart: () => void;
  onQuickStart: () => void;
}) {
  const accent = useAccent();
  const exerciseCount = routine?.exercises.length ?? 0;
  const totalSets =
    routine?.exercises.reduce(
      (acc, e) => acc + (e.setPlans.length || e.plannedSets),
      0,
    ) ?? 0;
  const previewNames =
    routine?.exercises.slice(0, 4).map((e) => e.exercise.name) ?? [];

  return (
    <View style={styles.heroOuter}>
      <View style={[styles.heroAccentEdge, { borderColor: accent.accentEdge }]} />
      <Surface variant="high" style={styles.heroCard}>
        <View style={styles.heroLabelRow}>
          <View style={[styles.dotIndicator, { backgroundColor: accent.accent }]} />
          <ThemedText style={[styles.heroLabel, { color: accent.accent }]}>
            {routine ? 'NEXT UP' : 'GET MOVING'}
          </ThemedText>
        </View>
        <ThemedText style={styles.heroTitle}>
          {routine ? routine.name : 'Quick Workout'}
        </ThemedText>
        <ThemedText style={styles.heroMeta}>
          {routine
            ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} · ${totalSets} set${totalSets === 1 ? '' : 's'}`
            : 'Log on the fly. Pick exercises as you go.'}
        </ThemedText>

        {previewNames.length > 0 ? (
          <View style={styles.heroPills}>
            {previewNames.map((name) => (
              <View key={name} style={[styles.heroPill, { backgroundColor: accent.surface }]}>
                <ThemedText style={styles.heroPillText} numberOfLines={1}>
                  {name}
                </ThemedText>
              </View>
            ))}
            {exerciseCount > previewNames.length ? (
              <View
                style={[
                  styles.heroPill,
                  { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge },
                ]}>
                <ThemedText style={styles.heroPillText}>
                  +{exerciseCount - previewNames.length}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={onStart}
          disabled={disabled}
          style={({ pressed }) => [
            styles.heroBtnWrap,
            { opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}>
          <LinearGradient
            colors={accent.accentGradient as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBtn}>
            <IconSymbol name="play.fill" size={20} color={accent.accentInk} />
            <ThemedText style={[styles.heroBtnLabel, { color: accent.accentInk }]}>
              {routine ? 'Start workout' : 'Start quick workout'}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {routine ? (
          <Pressable
            onPress={onQuickStart}
            disabled={disabled}
            style={({ pressed }) => [
              styles.heroQuickLink,
              { opacity: disabled || pressed ? 0.5 : 1 },
            ]}>
            <ThemedText style={styles.heroQuickLinkLabel}>
              Or start without a routine
            </ThemedText>
          </Pressable>
        ) : null}
      </Surface>
    </View>
  );
}

function ResumeCard({
  label,
  startedAt,
  onPress,
}: {
  label: string;
  startedAt: Date;
  onPress: () => void;
}) {
  const accent = useAccent();
  const elapsed = useElapsedSince(startedAt);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.resumeOuter,
        {
          backgroundColor: accent.accentSoft,
          borderColor: accent.accentEdge,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      <View style={styles.resumeHeaderRow}>
        <View style={styles.resumeLabelRow}>
          <View style={[styles.livePulse, { backgroundColor: accent.accent }]} />
          <ThemedText style={[styles.resumeLabel, { color: accent.accent }]}>LIVE</ThemedText>
        </View>
        <ThemedText style={styles.resumeRoutine} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>

      <View style={styles.resumeTimerWrap}>
        <ThemedText style={styles.resumeTimer}>{elapsed}</ThemedText>
        <ThemedText style={[styles.resumeTimerLabel, { color: accent.accent }]}>ELAPSED</ThemedText>
      </View>

      <View style={styles.resumeBtnRow}>
        <View style={[styles.resumeBtn, { backgroundColor: accent.accent }]}>
          <IconSymbol name="play.fill" size={16} color={accent.accentInk} />
          <ThemedText style={[styles.resumeBtnLabel, { color: accent.accentInk }]}>
            Resume workout
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 22,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  dateLabel: {
    fontSize: 13,
    marginTop: 4,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  statCell: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    marginTop: 2,
    ...numeric('bold'),
  },
  statSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
  },

  // Hero
  heroOuter: {
    position: 'relative',
    borderRadius: radius.xl,
  },
  heroAccentEdge: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
  },
  heroCard: {
    padding: 20,
    gap: 14,
    borderRadius: radius.xl,
    borderColor: 'transparent',
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    fontWeight: '800',
    marginTop: -4,
  },
  heroMeta: {
    fontSize: 14,
    marginTop: -6,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroBtnWrap: {
    marginTop: 6,
    borderRadius: radius.lg,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
    borderRadius: radius.lg,
  },
  heroBtnLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroQuickLink: {
    alignItems: 'center',
    paddingTop: 4,
  },
  heroQuickLinkLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Resume in-progress card
  resumeOuter: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  resumeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resumeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resumeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  resumeRoutine: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  resumeTimerWrap: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  resumeTimer: {
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -2,
    ...numeric('bold'),
  },
  resumeTimerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  resumeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  resumeBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Activity dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dotCol: {
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  dotLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Recent list
  recentList: {
    gap: 8,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  recentMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  recentVolume: {
    alignItems: 'flex-end',
  },
  recentVolumeValue: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
    ...numeric('bold'),
  },
  recentVolumeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
});
