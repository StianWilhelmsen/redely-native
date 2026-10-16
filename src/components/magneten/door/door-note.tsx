import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Note, type NoteMember, type Paper } from '@/components/magneten/note';
import { Feel } from '@/design/motion';

type Props = {
  title: string;
  meta?: string;
  footer?: string;
  member: NoteMember;
  paper: Paper;
  tilt: number;
  done: boolean;
  smackIn: boolean;
  /** Null when this person may not tick the note off; tapping then explains why. */
  onToggle: (() => void) | null;
  onBlocked: () => void;
  onOpen: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A note on the door: tap ticks it off (or back on), press and hold opens it. `<Note>`
 * only knows about taps, so the press handling lives here and the note itself is left
 * without a handler (a disabled Pressable never claims the touch).
 */
export function DoorNote({ title, meta, footer, member, paper, tilt, done, smackIn, onToggle, onBlocked, onOpen, style }: Props) {
  const { t } = useTranslation();
  const press = () => {
    if (!onToggle) return onBlocked();
    if (!done) Feel.done();
    onToggle();
  };
  return (
    <Pressable
      onPress={press}
      onLongPress={() => {
        Feel.tick();
        onOpen();
      }}
      delayLongPress={380}
      accessible
      accessibilityRole="button"
      accessibilityLabel={[meta, title, footer].filter(Boolean).join(', ')}
      accessibilityState={{ checked: done }}
      accessibilityHint={t('door.openHint')}
      accessibilityActions={[
        { name: 'activate', label: done ? t('door.undoAction') : t('door.toggleAction') },
        { name: 'longpress', label: t('door.openAction') },
      ]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'longpress' ? onOpen() : press())}
      style={style}>
      <Note title={title} meta={meta} footer={footer} member={member} paper={paper} tilt={tilt} done={done} smackIn={smackIn} />
    </Pressable>
  );
}
