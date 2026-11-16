import { useSession } from '../../session/SessionProvider';
import { useCallback } from 'react';
import { BookingHome } from './BookingHome';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RiderTabParams } from '../../../navigation/types';
export function HomeScreen({
  route,
  navigation,
}: BottomTabScreenProps<RiderTabParams, 'Home'>) {
  const clearService = useCallback(
    () => navigation.setParams({ service: undefined }),
    [navigation],
  );
  const { state } = useSession();
  return state.stage === 'ready' ? (
    <BookingHome service={route.params?.service} onServiceUsed={clearService} />
  ) : null;
}
