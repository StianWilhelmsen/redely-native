import { Waiting } from '@/components/magneten/waiting';
import { useMeState } from '@/state/household';

/** Shown by the root guards while sign-in state or /api/me is still loading. */
export default function WaitingScreen() {
  const { me, meError, mutateMe } = useMeState();
  return <Waiting error={me ? undefined : meError} onRetry={() => mutateMe()} />;
}
