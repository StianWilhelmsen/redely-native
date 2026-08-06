import useSWR from 'swr';

import { api } from '@/lib/api';

export function useMe() {
  return useSWR('me', api.me);
}
