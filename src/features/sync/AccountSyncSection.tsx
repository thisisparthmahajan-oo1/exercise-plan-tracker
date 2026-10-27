import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { palette, radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';
import { signIn, signOut, syncNow, type SyncStatus } from '@/src/sync/engine';
import { useSyncStatus } from '@/src/sync/SyncProvider';
import { PrimaryButton, SectionLabel, StyledTextInput, Surface } from '@/src/ui';

export function AccountSyncSection() {
  const status = useSyncStatus();
  return (
    <View style={styles.section}>
      <SectionLabel>Account & Sync</SectionLabel>
      {!status.configured ? (
        <NotConfigured />
      ) : status.signedIn ? (
        <SignedIn status={status} />
      ) : (
        <SignInForm lastError={status.error} />
      )}
    </View>
  );
}

function NotConfigured() {
  const accent = useAccent();
  return (
    <Surface style={[styles.card, { borderColor: accent.accentEdge }]}>
      <ThemedText style={styles.title}>Cloud sync off</ThemedText>
      <ThemedText style={[styles.hint, { color: accent.textDim }]}>
        This build has no sync server configured. Everything stays on this phone.
      </ThemedText>
    </Surface>
  );
}

function SignedIn({ status }: { status: SyncStatus }) {
  const accent = useAccent();
  const onSignOut = () =>
    Alert.alert(
      'Sign out?',
      'Your data stays on this phone. Changes made while signed out upload when you enter the token again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );

  return (
    <Surface style={[styles.card, { borderColor: accent.accentEdge }]}>
      <ThemedText style={styles.title}>Cloud sync on</ThemedText>
      <ThemedText style={[styles.hint, { color: status.error ? palette.danger : accent.textDim }]}>
        {statusLine(status)}
      </ThemedText>
      <View style={styles.actions}>
        <PrimaryButton
          label={status.syncing ? 'Syncing…' : 'Sync now'}
          variant="ghost"
          disabled={status.syncing}
          onPress={() => void syncNow()}
          style={styles.action}
        />
        <PrimaryButton label="Sign out" variant="ghost" onPress={onSignOut} style={styles.action} />
      </View>
    </Surface>
  );
}

function SignInForm({ lastError }: { lastError: string | null }) {
  const accent = useAccent();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(token.trim());
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shownError = error ?? lastError;
  return (
    <Surface style={[styles.card, { borderColor: accent.accentEdge }]}>
      <ThemedText style={styles.title}>Back up & sync</ThemedText>
      <ThemedText style={[styles.hint, { color: accent.textDim }]}>
        Enter the server's access token to copy your history to the cloud and keep devices in
        sync. The app keeps working offline either way.
      </ThemedText>
      <StyledTextInput
        value={token}
        onChangeText={setToken}
        placeholder="Access token"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="password"
        onSubmitEditing={onSubmit}
      />
      {shownError ? (
        <ThemedText style={[styles.hint, { color: palette.danger }]}>{shownError}</ThemedText>
      ) : null}
      <PrimaryButton
        label={busy ? 'Connecting…' : 'Connect'}
        disabled={busy || !token.trim()}
        onPress={onSubmit}
      />
    </Surface>
  );
}

function statusLine(s: SyncStatus): string {
  if (s.syncing) return 'Syncing…';
  if (s.error) return `Last sync failed: ${s.error}`;
  if (s.pending > 0) {
    return `${s.pending} change${s.pending === 1 ? '' : 's'} waiting to upload`;
  }
  if (s.lastSyncedAt == null) return 'Not synced yet';
  return `Synced ${formatAgo(s.lastSyncedAt)}`;
}

function formatAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  action: {
    flex: 1,
  },
});
