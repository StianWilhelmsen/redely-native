/**
 * Date and time picking for the note form, on the platform's own picker: a dialog on
 * Android, an inline picker on iOS.
 */

import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import type { DateString, TimeString } from '@/api';
import { Chip } from '@/components/magneten/ui';
import { usePalette } from '@/theme/palette-context';

const pad = (n: number) => String(n).padStart(2, '0');

function dateToString(d: Date): DateString {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function stringToDate(ds: DateString | null): Date {
  if (!ds) return new Date();
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function timeToDate(time: TimeString | null): Date {
  const d = new Date();
  const [h, m] = (time ?? '17:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** A chip that opens the date picker. `label` shows the picked date or "Velg dato". */
export function DateChip({
  label,
  selected,
  value,
  minimum,
  onChange,
  locale,
}: {
  label: string;
  selected: boolean;
  value: DateString | null;
  minimum: DateString;
  onChange: (date: DateString) => void;
  locale: string;
}) {
  const { scheme, tokens } = usePalette();
  const [showIos, setShowIos] = useState(false);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: stringToDate(value),
        minimumDate: stringToDate(minimum),
        mode: 'date',
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(dateToString(d));
        },
      });
    } else {
      setShowIos((s) => !s);
    }
  };
  return (
    <>
      <Chip label={label} selected={selected} onPress={open} />
      {Platform.OS === 'ios' && showIos ? (
        <View style={{ width: '100%', backgroundColor: tokens.paper, borderRadius: 14 }}>
          <DateTimePicker
            value={stringToDate(value)}
            minimumDate={stringToDate(minimum)}
            mode="date"
            display="inline"
            locale={locale}
            themeVariant={scheme}
            accentColor={tokens.magne}
            onChange={(_e, d) => {
              if (d) onChange(dateToString(d));
              setShowIos(false);
            }}
          />
        </View>
      ) : null}
    </>
  );
}

/** A chip that opens the time picker. */
export function TimeChip({
  label,
  selected,
  value,
  onChange,
  locale,
}: {
  label: string;
  selected: boolean;
  value: TimeString | null;
  onChange: (time: TimeString) => void;
  locale: string;
}) {
  const { scheme, tokens } = usePalette();
  const [showIos, setShowIos] = useState(false);
  const fromDate = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeToDate(value),
        mode: 'time',
        is24Hour: true,
        minuteInterval: 5,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(fromDate(d));
        },
      });
    } else {
      setShowIos((s) => !s);
      if (!value) onChange(fromDate(timeToDate(null)));
    }
  };
  return (
    <>
      <Chip label={label} selected={selected} onPress={open} />
      {Platform.OS === 'ios' && showIos ? (
        <View style={{ width: '100%', backgroundColor: tokens.paper, borderRadius: 14, alignItems: 'center' }}>
          <DateTimePicker
            value={timeToDate(value)}
            mode="time"
            display="spinner"
            minuteInterval={5}
            locale={locale}
            themeVariant={scheme}
            onChange={(_e, d) => d && onChange(fromDate(d))}
          />
        </View>
      ) : null}
    </>
  );
}
