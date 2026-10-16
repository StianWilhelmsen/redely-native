import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DateString } from '@/api';
import { FontFamily } from '@/constants/theme';
import { Feel } from '@/design/motion';
import { formatDate, fromLocalDate, intlLocale, localTimeOf, toLocalDate } from '@/lib/week-dates';
import { usePalette } from '@/theme/palette-context';

/**
 * A date or a time, picked with the platform's own picker. The picker works in the
 * device's zone, so we only ever hand it - and read back - wall-clock parts; the Oslo
 * offset is added when the event is saved (see `osloIso`).
 */
export function DateTimeField({
  mode,
  date,
  time = '12:00',
  minimumDate,
  onChange,
}: {
  mode: 'date' | 'time';
  date: DateString;
  time?: string;
  minimumDate?: DateString;
  onChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { tokens, scheme } = usePalette();
  const lang = i18n.language;
  const value = toLocalDate(date, time);
  const shown = mode === 'date' ? formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short' }) : time;
  const label = t(mode === 'date' ? 'week.form.pickDate' : 'week.form.pickTime', { value: shown });

  const emit = (d: Date) => onChange(mode === 'date' ? fromLocalDate(d) : localTimeOf(d));

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale={intlLocale(lang)}
        themeVariant={scheme}
        accentColor={tokens.magne}
        minuteInterval={5}
        minimumDate={minimumDate ? toLocalDate(minimumDate, '00:00') : undefined}
        accessibilityLabel={label}
        onChange={(_e: DateTimePickerEvent, d?: Date) => d && emit(d)}
      />
    );
  }

  if (Platform.OS === 'web') {
    return (
      <TextInput
        defaultValue={mode === 'date' ? date : time}
        accessibilityLabel={label}
        onEndEditing={(e) => {
          const v = e.nativeEvent.text.trim();
          if (mode === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(v) : /^\d{2}:\d{2}$/.test(v)) onChange(v);
        }}
        style={[styles.pill, styles.text, { backgroundColor: tokens.backgroundSelected, color: tokens.text }]}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Feel.tick();
        DateTimePickerAndroid.open({
          value,
          mode,
          is24Hour: true,
          minimumDate: minimumDate ? toLocalDate(minimumDate, '00:00') : undefined,
          onChange: (e, d) => {
            if (e.type === 'set' && d) emit(d);
          },
        });
      }}
      style={({ pressed }) => [styles.pill, { backgroundColor: tokens.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.text, { color: tokens.text }]}>{shown}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  text: { fontFamily: FontFamily.semiBold, fontSize: 15 },
});
