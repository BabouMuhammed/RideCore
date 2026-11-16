import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import X from 'lucide-react-native/icons/x';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Home from 'lucide-react-native/icons/house';
import Clock3 from 'lucide-react-native/icons/clock-3';
import UserRound from 'lucide-react-native/icons/user-round';
import MapPin from 'lucide-react-native/icons/map-pin';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Car from 'lucide-react-native/icons/car';
import Search from 'lucide-react-native/icons/search';
import Grid2x2 from 'lucide-react-native/icons/grid-2x2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Mail from 'lucide-react-native/icons/mail';
import Star from 'lucide-react-native/icons/star';
import Share2 from 'lucide-react-native/icons/share-2';
import type { LucideIcon } from 'lucide-react-native';
import { Platform } from 'react-native';
import { colors, size as sizes } from '../../theme/tokens';
const icons = {
  share: Share2,
  car: Car,
  search: Search,
  services: Grid2x2,
  shield: ShieldCheck,
  mail: Mail,
  star: Star,
  eye: Eye,
  eyeOff: EyeOff,
  back: ArrowLeft,
  close: X,
  chevron: ChevronRight,
  home: Home,
  activity: Clock3,
  account: UserRound,
  pin: MapPin,
  error: AlertCircle,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof icons;
export function Icon({
  name,
  color = colors.text,
  size = sizes.icon,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      color={color}
      size={size}
      strokeWidth={1.8}
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true }
        : { accessible: false })}
    />
  );
}
