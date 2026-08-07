import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR, { useSWRConfig } from 'swr';

import { AvatarBadge } from '@/components/avatar-badge';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatShortDate, localDateKey, parseDueDateLocal } from '@/lib/date-utils';
import type { RepeatFrequency } from '@/types/api';

const REPEAT_OPTIONS: { key: RepeatFrequency; label: string }[] = [
  { key: 'NONE', label: 'Én gang' },
  { key: 'WEEKLY', label: 'Ukentlig' },
  { key: 'DAILY', label: 'Daglig' },
];

// Deliberately narrow (and labelled by effort rather than raw numbers): rotation already
// evens out who takes the heavy chores, so a wider spread would mostly invite inflating
// your own tasks. Mirrors TaskService.MIN/MAX_TASK_POINTS on the backend.
const POINT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Liten' },
  { value: 2, label: 'Vanlig' },
  { value: 3, label: 'Stor' },
];

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="eyebrow" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

export default function TaskFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: members } = useSWR('members', api.members);
  const { data: tasks, mutate: mutateTasks } = useSWR(editingId ? 'tasks' : null, api.tasks);
  const { mutate: globalMutate } = useSWRConfig();
  const existingTask = editingId ? (tasks ?? []).find((t) => t.id === editingId) ?? null : null;

  const [title, setTitle] = useState('');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('NONE');
  const [rotateAssignee, setRotateAssignee] = useState(true);
  const [assignedUserId, setAssignedUserId] = useState<number | null>(null);
  const [points, setPoints] = useState(1);
  // Defaults to today for new tasks (most tasks are due today/soon) - editing an
  // existing task overrides this from its real value once loaded, including null
  // if that task genuinely has no due date.
  const [dueDate, setDueDate] = useState<Date | null>(() => (editingId ? null : new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (existingTask && !prefilled) {
      setTitle(existingTask.title);
      setRepeatFrequency(existingTask.repeatFrequency);
      setRotateAssignee(existingTask.rotateAssignee);
      setAssignedUserId(existingTask.assignedTo?.id ?? null);
      setPoints(existingTask.points);
      setDueDate(existingTask.dueDate ? parseDueDateLocal(existingTask.dueDate) : null);
      setPrefilled(true);
    }
  }, [existingTask, prefilled]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Skriv inn en tittel.');
      return;
    }
    if (!assignedUserId) {
      setError('Velg hvem oppgaven skal tildeles.');
      return;
    }
    if (repeatFrequency !== 'NONE' && !dueDate) {
      setError('Gjentakende oppgaver må ha en forfallsdato.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await api.updateTask(editingId, {
          title: title.trim(),
          assignedUserId,
          points,
          repeatFrequency,
          rotateAssignee,
          dueDate: dueDate ? localDateKey(dueDate) : undefined,
          clearDueDate: !dueDate,
        });
        await mutateTasks();
      } else {
        await api.createTask({
          title: title.trim(),
          assignedUserId,
          points,
          repeatFrequency,
          rotateAssignee,
          dueDate: dueDate ? localDateKey(dueDate) : undefined,
        });
      }
      // Home, Kollektiv, etc. all read the same 'tasks'/'weekly-stats'/'collective-stats'
      // keys - without this they'd keep showing stale data until a manual pull-to-refresh.
      await Promise.all([
        globalMutate('tasks'),
        globalMutate('weekly-stats'),
        globalMutate('collective-stats'),
      ]);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('Slett oppgave', 'Dette kan ikke angres.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteTask(editingId);
            await Promise.all([
              mutateTasks(),
              globalMutate('weekly-stats'),
              globalMutate('collective-stats'),
            ]);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Kunne ikke slette oppgaven.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
          <ThemedText themeColor="textSecondary">Avbryt</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{editingId ? 'Rediger oppgave' : 'Ny oppgave'}</ThemedText>
        <Pressable onPress={handleSubmit} disabled={submitting} hitSlop={Spacing.two}>
          <ThemedText type="smallBold" themeColor={submitting ? 'textSecondary' : 'brand'}>
            Lagre
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <FieldLabel>Tittel</FieldLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="F.eks. Vaske badet"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Gjentakelse</FieldLabel>
          <View style={[styles.segmentGroup, { backgroundColor: theme.backgroundElement }]}>
            {REPEAT_OPTIONS.map((option) => {
              const active = option.key === repeatFrequency;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setRepeatFrequency(option.key)}
                  style={[styles.segment, active && { backgroundColor: theme.background }]}>
                  <ThemedText type={active ? 'smallBold' : 'small'} themeColor={active ? 'text' : 'textSecondary'}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {repeatFrequency !== 'NONE' && (
          <View style={styles.field}>
            <FieldLabel>Type</FieldLabel>
            <View style={[styles.segmentGroup, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                onPress={() => setRotateAssignee(true)}
                style={[styles.segment, rotateAssignee && { backgroundColor: theme.background }]}>
                <ThemedText type={rotateAssignee ? 'smallBold' : 'small'} themeColor={rotateAssignee ? 'text' : 'textSecondary'}>
                  Roterer
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setRotateAssignee(false)}
                style={[styles.segment, !rotateAssignee && { backgroundColor: theme.background }]}>
                <ThemedText type={!rotateAssignee ? 'smallBold' : 'small'} themeColor={!rotateAssignee ? 'text' : 'textSecondary'}>
                  Kun denne personen
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {rotateAssignee
                ? 'Neste gjentakelse går automatisk videre til neste medlem.'
                : 'Neste gjentakelse blir hos samme person hver gang.'}
            </ThemedText>
          </View>
        )}

        <View style={styles.field}>
          <FieldLabel>Tildelt til</FieldLabel>
          <View style={styles.assigneeRow}>
            {(members ?? []).map((member) => {
              const selected = member.id === assignedUserId;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => setAssignedUserId(member.id)}
                  style={styles.assigneeItem}>
                  <View
                    style={[
                      styles.assigneeRing,
                      { borderColor: selected ? theme.brand : 'transparent' },
                    ]}>
                    <AvatarBadge
                      userId={member.id}
                      name={member.name}
                      pictureUrl={member.pictureUrl}
                      shape="circle"
                      size={44}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.assigneeName}>
                    {member.name.split(' ')[0]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Hvor stor jobb?</FieldLabel>
          <View style={styles.pointsRow}>
            {POINT_OPTIONS.map(({ value, label }) => {
              const active = value === points;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label}, ${value} poeng`}
                  onPress={() => setPoints(value)}
                  style={[
                    styles.pointChip,
                    { borderColor: active ? theme.brand : theme.border },
                    active && { backgroundColor: theme.brand },
                  ]}>
                  <ThemedText type="small" style={active ? { color: theme.onBrand } : undefined}>
                    {label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor={active ? undefined : 'textSecondary'}
                    style={[styles.pointChipValue, active ? { color: theme.onBrand } : undefined]}>
                    {value} p
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Forfallsdato</FieldLabel>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[styles.dateRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor={dueDate ? 'text' : 'textSecondary'}>
              {dueDate ? formatShortDate(dueDate) : 'Ingen dato valgt'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>
          {dueDate && (
            <Pressable onPress={() => setDueDate(null)} hitSlop={Spacing.one}>
              <ThemedText type="small" themeColor="danger">
                Fjern dato
              </ThemedText>
            </Pressable>
          )}
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={editingId ? undefined : new Date()}
              onChange={(event, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (event.type === 'set' && selected) setDueDate(selected);
              }}
            />
          )}
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}

        {editingId && (
          <Pressable onPress={handleDelete} disabled={deleting} style={styles.deleteRow} hitSlop={Spacing.two}>
            <ThemedText type="smallBold" themeColor="danger">
              {deleting ? 'Sletter…' : 'Slett oppgave'}
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, borderTopColor: theme.border }]}>
        <PrimaryButton
          label={editingId ? 'Lagre endringer' : 'Legg til oppgave'}
          onPress={handleSubmit}
          loading={submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    opacity: 0.8,
  },
  input: {
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  segmentGroup: {
    flexDirection: 'row',
    borderRadius: Radii.input,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radii.input - 3,
  },
  assigneeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  assigneeItem: {
    alignItems: 'center',
    gap: Spacing.one,
    width: 60,
  },
  assigneeRing: {
    borderWidth: 2,
    borderRadius: 26,
    padding: 2,
  },
  assigneeName: {
    maxWidth: 60,
  },
  pointsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pointChip: {
    flex: 1,
    height: 52,
    borderRadius: Radii.chip,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  pointChipValue: {
    fontSize: 11,
    opacity: 0.8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  deleteRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
