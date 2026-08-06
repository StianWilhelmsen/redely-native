import { ConfettiBurst } from '@/components/celebration/confetti-burst';
import { Toast } from '@/components/celebration/toast';

type Props = {
  message: string | null;
  burstKey: number;
  onDismiss: () => void;
};

export function CelebrationOverlay({ message, burstKey, onDismiss }: Props) {
  if (!message) return null;

  return (
    <>
      <ConfettiBurst burstKey={burstKey} />
      <Toast message={message} onHide={onDismiss} />
    </>
  );
}
