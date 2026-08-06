import { useCallback, useState } from 'react';

export function useCelebration() {
  const [message, setMessage] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const celebrate = useCallback((text: string) => {
    setMessage(text);
    setBurstKey((k) => k + 1);
  }, []);

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, burstKey, celebrate, dismiss };
}
