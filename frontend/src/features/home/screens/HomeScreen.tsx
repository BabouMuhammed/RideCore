import { useSession } from '../../session/SessionProvider';
import { BookingHome } from './BookingHome';
export function HomeScreen() {
  const { state } = useSession();
  return state.stage === 'ready' ? <BookingHome /> : null;
}
