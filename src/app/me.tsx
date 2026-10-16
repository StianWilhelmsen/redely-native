import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { api, ApiError, errorMessage, keys, type Member, type NotificationPrefs } from '@/api';
import {
  ColorSwatches,
  Icon,
  PaperNote,
  PillButton,
  Segmented,
  SnapMagnet,
  TopBar,
  useRoleLabel,
  Waiting,
} from '@/components/magneten/family/parts';
import { useMemberActions } from '@/components/magneten/family/use-member-actions';
import { Magne } from '@/components/magneten/magne';
import { PhotoMagnet } from '@/components/magneten/photo-magnet';
import { Button, Card, Field, Row, Screen, SectionLabel, Toggle } from '@/components/magneten/ui';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/constants/legal';
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { Feel } from '@/design/motion';
import { currentLanguage, restoreLanguageSetting, setLanguageSetting, type LanguageSetting } from '@/i18n';
import { formatLongDate, formatMonthYear, isThisWeek } from '@/lib/family-dates';
import { parseJoinCode } from '@/lib/family-invite';
import { requestAndRegisterPushToken } from '@/lib/push-notifications';
import { useHousehold, useMeState } from '@/state/household';
import { usePalette, type AppearanceMode } from '@/theme/palette-context';

const PREF_KEYS: (keyof NotificationPrefs)[] = ['reminders', 'assignments', 'comments', 'activity'];

export default function MeScreen() {
  const { me } = useHousehold();
  if (!me) return <Waiting />;
  return <MePage me={me} />;
}

function MePage({ me }: { me: Member }) {
  const { t, i18n } = useTranslation();
  const { tokens, mode, setMode } = usePalette();
  const roleLabel = useRoleLabel();
  const { hid, membership, isPluss } = useHousehold();
  const { me: account, mutateMe, switchHousehold } = useMeState();
  const { signOut } = useAuth();
  const { update } = useMemberActions();

  const { data: areas } = useSWR(keys.areas(hid), () => api.areas.list(hid));
  const { data: doneMine } = useSWR(keys.notes(hid, `done:${me.id}`), () =>
    api.notes.list(hid, { status: 'done', assigneeMemberId: me.id })
  );
  const { data: openMine } = useSWR(keys.notes(hid, `open:${me.id}`), () =>
    api.notes.list(hid, { status: 'open', assigneeMemberId: me.id })
  );
  const { data: subscription } = useSWR(keys.subscription(hid), () => api.subscription.get(hid));

  const [language, setLanguage] = useState<LanguageSetting | undefined>(undefined);
  useEffect(() => {
    restoreLanguageSetting()
      .then(setLanguage)
      .catch(() => setLanguage('system'));
  }, []);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const myAreas = (areas ?? []).filter((a) => a.ownerMemberId === me.id);
  const doneThisWeek = (doneMine ?? []).filter((n) => isThisWeek(n.completedAt)).length;

  const fail = (e: unknown) => {
    const lastAdult = e instanceof ApiError && e.code === 'last_adult';
    Alert.alert(t('family.member.failed'), lastAdult ? t('family.member.lastAdult') : errorMessage(e));
  };

  const pickLanguage = async (setting: LanguageSetting) => {
    setLanguage(setting);
    await setLanguageSetting(setting);
    try {
      const next = await api.me.update({ locale: currentLanguage() });
      mutateMe(next, { revalidate: false });
    } catch {
      // The household provider re-syncs the server's locale on the next /api/me.
    }
  };

  const togglePref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!account) return;
    if (value && !account.hasPushToken) {
      try {
        const status = await requestAndRegisterPushToken();
        if (status !== 'granted') {
          Alert.alert(t('family.me.notifDeniedTitle'), t('family.me.notifDeniedBody'), [
            { text: t('actions.cancel'), style: 'cancel' },
            { text: t('family.me.openSettings'), onPress: () => Linking.openSettings().catch(() => {}) },
          ]);
        }
      } catch (e) {
        console.warn('[me] push registration failed', e);
      }
    }
    mutateMe({ ...account, notifications: { ...account.notifications, [key]: value } }, { revalidate: false });
    try {
      const prefs = await api.me.setNotificationPrefs({ [key]: value });
      mutateMe((m) => m && { ...m, notifications: prefs }, { revalidate: true });
    } catch (e) {
      mutateMe();
      Alert.alert(t('family.member.failed'), errorMessage(e));
    }
  };

  const join = () => {
    const code = parseJoinCode(joinCode);
    if (!code) return;
    setJoinOpen(false);
    setJoinCode('');
    router.push({ pathname: '/join/[code]', params: { code } });
  };

  const leave = () => {
    Alert.alert(t('family.me.leaveTitle', { name: membership.name }), t('family.member.leaveBody'), [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('family.member.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.households.leave(hid);
            await mutateMe();
          } catch (e) {
            fail(e);
          }
        },
      },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert(t('family.me.deleteTitle'), t('family.me.deleteBody'), [
      { text: t('actions.cancel'), style: 'cancel' },
      {
        text: t('family.me.deleteContinue'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('family.me.deleteConfirmTitle'), t('family.me.deleteConfirmBody'), [
            { text: t('actions.cancel'), style: 'cancel' },
            {
              text: t('family.me.deleteConfirm'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await api.me.delete();
                  await signOut();
                } catch (e) {
                  Alert.alert(t('family.member.failed'), errorMessage(e));
                }
              },
            },
          ]),
      },
    ]);
  };

  const plussLine = () => {
    if (!isPluss) return t('family.me.plussOffSub');
    const parts: string[] = [];
    if (subscription?.payerName) parts.push(t('family.me.paidBy', { name: subscription.payerName }));
    if (subscription?.currentPeriodEnd) {
      const date = formatLongDate(subscription.currentPeriodEnd, i18n.language);
      parts.push(subscription.status === 'CANCELED' ? t('family.me.endsOn', { date }) : t('family.me.renewsOn', { date }));
    }
    parts.push(t('family.me.wholeFamily'));
    return parts.join(' · ');
  };

  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen>
      <TopBar
        right={
          <PillButton
            light
            label={t('family.me.editProfile')}
            onPress={() => router.push({ pathname: '/member/[id]', params: { id: me.id } })}
          />
        }
      />

      <View style={styles.hero}>
        <SnapMagnet name={me.displayName} color={me.color} photoUrl={me.photoUrl} size={100} />
        <Text style={[styles.heroName, { color: tokens.text }]} accessibilityRole="header">
          {account?.name || me.displayName}
        </Text>
        <Text style={[styles.heroSub, { color: tokens.textSecondary }]}>
          {t('family.me.since', {
            role: roleLabel(me.role),
            household: membership.name,
            date: formatMonthYear(me.createdAt, i18n.language),
          })}
        </Text>
      </View>

      <PaperNote paper={tokens.paperYellow} magnet={tokens.magne} tilt={-0.8}>
        <Text style={[styles.noteTitle, { color: tokens.paperInk }]}>{t('family.me.week')}</Text>
        <View style={styles.stats}>
          <Stat value={doneMine ? doneThisWeek : '–'} label={t('family.me.statDone', { count: doneThisWeek })} />
          <Stat value={openMine ? openMine.length : '–'} label={t('family.me.statOpen', { count: openMine?.length ?? 0 })} />
          <Stat value={areas ? myAreas.length : '–'} label={t('family.me.statAreas', { count: myAreas.length })} />
        </View>
        <Text style={[styles.noteFoot, { color: tokens.paperInk }]}>{t('family.me.onlyYou')}</Text>
      </PaperNote>

      <SectionLabel>{t('family.me.myAreas')}</SectionLabel>
      <View style={styles.chips}>
        {myAreas.map((a) => (
          <View key={a.id} style={[styles.chip, { backgroundColor: tokens.paper }]}>
            <Text style={[styles.chipText, { color: tokens.text }]}>{a.name}</Text>
          </View>
        ))}
        <Pressable
          onPress={() => router.push('/areas')}
          accessibilityRole="link"
          style={[styles.chip, styles.dashed, { borderColor: tokens.textSecondary }]}>
          <Text style={[styles.chipText, { color: tokens.text }]}>{t('family.list.areas')}</Text>
        </Pressable>
      </View>

      <SectionLabel>{t('family.me.homes')}</SectionLabel>
      <Card>
        {(account?.households ?? []).map((h) => {
          const active = h.householdId === hid;
          return (
            <Pressable
              key={h.householdId}
              disabled={active}
              onPress={() => {
                Feel.tick();
                switchHousehold(h.householdId);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={active ? h.name : t('family.me.switchTo', { name: h.name })}
              style={[styles.homeRow, { borderBottomColor: tokens.backgroundSelected }]}>
              <PhotoMagnet name={h.displayName} color={h.color} photoUrl={h.photoUrl} size={26} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.homeName, { color: tokens.text }]}>{h.name}</Text>
                <Text style={[styles.sub, { color: tokens.textSecondary }]}>
                  {[t('family.me.youAre', { role: roleLabel(h.role).toLowerCase() }), h.isPluss ? t('family.me.pluss') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {active ? (
                <View style={[styles.activePill, { backgroundColor: tokens.stamp }]}>
                  <Text style={styles.activeText}>{t('family.me.active')}</Text>
                </View>
              ) : (
                <Text style={[styles.switch, { color: tokens.textSecondary }]}>{t('family.me.switch')}</Text>
              )}
            </Pressable>
          );
        })}
        {joinOpen ? (
          <View style={styles.join}>
            <Field
              label={t('family.me.joinLabel')}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder="K7MX2Q"
              onSubmitEditing={join}
              returnKeyType="go"
            />
            <Button label={t('family.me.joinGo')} onPress={join} disabled={!parseJoinCode(joinCode)} />
          </View>
        ) : (
          <Row label={t('family.me.join')} onPress={() => setJoinOpen(true)} />
        )}
        <Pressable onPress={leave} accessibilityRole="button" style={styles.plainRow}>
          <Text style={[styles.rowDanger, { color: tokens.danger }]}>{t('family.me.leave', { name: membership.name })}</Text>
        </Pressable>
      </Card>

      <SectionLabel>{t('family.color.section')}</SectionLabel>
      <Card style={styles.pad}>
        <ColorSwatches value={me.color} onChange={(color) => update(me, { color }).catch(fail)} />
      </Card>

      <SectionLabel>{t('family.me.notifications')}</SectionLabel>
      <Card>
        {PREF_KEYS.map((key) => (
          <View key={key} style={[styles.toggleRow, { borderBottomColor: tokens.backgroundSelected }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: tokens.text }]}>{t(`family.me.prefs.${key}.title`)}</Text>
              <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t(`family.me.prefs.${key}.sub`)}</Text>
            </View>
            <Toggle
              label={t(`family.me.prefs.${key}.title`)}
              value={account?.notifications[key] ?? false}
              onChange={(v) => togglePref(key, v)}
            />
          </View>
        ))}
        <View style={styles.segRow}>
          <Text style={[styles.rowLabel, { color: tokens.text }]}>{t('family.me.appearance')}</Text>
          <Segmented<AppearanceMode>
            label={t('family.me.appearance')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: t('family.me.light') },
              { value: 'dark', label: t('family.me.dark') },
              { value: 'system', label: t('family.me.system') },
            ]}
          />
        </View>
      </Card>

      <SectionLabel>{t('family.me.language')}</SectionLabel>
      <Card style={styles.pad}>
        <Segmented<LanguageSetting>
          label={t('family.me.language')}
          value={language}
          onChange={pickLanguage}
          options={[
            { value: 'nb', label: 'Norsk' },
            { value: 'en', label: 'English' },
            { value: 'system', label: t('family.me.languageSystem') },
          ]}
        />
      </Card>

      <SectionLabel>{t('family.me.subscription')}</SectionLabel>
      <Pressable
        onPress={() => router.push('/pluss')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.plussCard, { backgroundColor: tokens.paper, opacity: pressed ? 0.85 : 1 }]}>
        <View style={[styles.plussDot, { backgroundColor: isPluss ? tokens.magne : tokens.border }]} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.plussTitle, { color: tokens.text }]}>
            {isPluss ? t('family.me.plussOn') : t('family.me.plussOff')}
          </Text>
          <Text style={[styles.sub, { color: tokens.textSecondary }]}>{plussLine()}</Text>
        </View>
        <Icon name="chevron" size={16} color={tokens.textSecondary} />
      </Pressable>

      <SectionLabel>{t('family.me.account')}</SectionLabel>
      <Card>
        <Row label={t('family.me.email')} value={account?.email ?? '–'} />
        <Row label={t('family.me.terms')} onPress={() => router.push(TERMS_ROUTE)} />
        <Row label={t('family.me.privacy')} onPress={() => router.push(PRIVACY_ROUTE)} />
        <Row label={t('family.me.about')} value={version ? t('family.me.version', { version }) : undefined} />
        <Pressable onPress={deleteAccount} accessibilityRole="button" style={styles.plainRow}>
          <Text style={[styles.rowDanger, { color: tokens.danger }]}>{t('family.me.delete')}</Text>
        </Pressable>
      </Card>

      <View style={styles.signOut}>
        <Magne pose="hei" size={50} />
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.signOutButton}>
          <Text style={[styles.signOutText, { color: tokens.textSecondary }]}>{t('family.me.signOut')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  const { tokens } = usePalette();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.statValue, { color: tokens.paperInk }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tokens.paperInk }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6 },
  heroName: { fontFamily: FontFamily.hand, fontSize: 28, lineHeight: 34, marginTop: 4, textAlign: 'center' },
  heroSub: { fontFamily: FontFamily.regular, fontSize: 13, textAlign: 'center' },
  noteTitle: { fontFamily: FontFamily.hand, fontSize: 20, lineHeight: 24 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statValue: { fontFamily: FontFamily.hand, fontSize: 30, lineHeight: 34 },
  statLabel: { fontFamily: FontFamily.regular, fontSize: 12, opacity: 0.75 },
  noteFoot: { fontFamily: FontFamily.regular, fontSize: 12.5, opacity: 0.75 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  dashed: { borderWidth: 2, borderStyle: 'dashed' },
  chipText: { fontFamily: FontFamily.bold, fontSize: 13 },
  homeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, minHeight: 56 },
  homeName: { fontFamily: FontFamily.bold, fontSize: 14.5 },
  sub: { fontFamily: FontFamily.regular, fontSize: 12 },
  activePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  activeText: { fontFamily: FontFamily.extraBold, fontSize: 11.5, color: '#FFFFFF' },
  switch: { fontFamily: FontFamily.bold, fontSize: 13 },
  join: { paddingVertical: 12, gap: 10 },
  plainRow: { minHeight: 48, justifyContent: 'center' },
  rowDanger: { fontFamily: FontFamily.semiBold, fontSize: 14.5 },
  pad: { paddingVertical: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  rowLabel: { fontFamily: FontFamily.semiBold, fontSize: 14.5 },
  segRow: { paddingVertical: 12, gap: 10 },
  plussCard: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  plussDot: { width: 42, height: 42, borderRadius: 21, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)' },
  plussTitle: { fontFamily: FontFamily.extraBold, fontSize: 14.5 },
  signOut: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 10 },
  signOutButton: { minHeight: 44, justifyContent: 'center', paddingBottom: 6 },
  signOutText: { fontFamily: FontFamily.bold, fontSize: 14 },
});
