import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContext, useMemo } from 'react';
import { NavigationContext } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Rect, Stop as GradientStop } from 'react-native-svg';
import { Text } from '../../../components/ui/Text';
import { Icon } from '../../../components/ui/Icon';
import { Wordmark } from '../../../components/brand/Wordmark';
import { MapCanvas } from '../../map/MapCanvas';
import { DemoMap } from '../../../demo/DemoMap';
import { useDemo } from '../../../demo/DemoProvider';
import { initialCenter } from '../../../services/geo';
import type { RiderTabParams } from '../../../navigation/types';
import { colors, elevation, fonts, radius, size, space } from '../../../theme/tokens';
import { useSession } from '../../session/SessionProvider';
import type {
  Category,
  Coordinate,
  Stop,
  Trip,
} from '../../../services/journey-api';
import type { MapPin } from '../../map/MapCanvas.types';

export const rideOptions: {
  category: Category;
  title: string;
  detail: string;
}[] = [
  { category: 'economy', title: 'Economy', detail: 'Affordable everyday rides' },
  { category: 'comfort', title: 'Comfort', detail: 'More space and comfort' },
  { category: 'xl', title: 'XL', detail: 'For larger groups' },
];

/** Recent destinations, newest first, without repeating the same place. */
function recentPlaces(history: Trip[]) {
  const seen = new Set<string>();
  const places: Stop[] = [];
  for (const trip of history) {
    const key = trip.destination.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(trip.destination);
    if (places.length === 2) break;
  }
  return places;
}

// The Figma Home: orange gradient header with the search card, recent
// destinations, and a live map preview.
// Well-known places offered before the rider has any history. Tapping one
// searches for it by name, so its position always comes from the map data.
const popularPlaces = [
  { name: 'Westfield Junction', area: 'Serrekunda' },
  { name: 'Serrekunda Market', area: 'Serrekunda' },
  { name: 'Senegambia', area: 'Kololi' },
  { name: 'Banjul International Airport', area: 'Yundum' },
];

export function RiderHome({
  onPlan,
  history,
  center = initialCenter,
  located = false,
  cars = [],
}: {
  onPlan(category?: Category, destination?: Stop, search?: string): void;
  history: Trip[];
  /** Where to centre the map preview: the rider's position when known. */
  center?: Coordinate;
  /** True when `center` is the rider's real position. */
  located?: boolean;
  /** Nearby available drivers to draw on the preview. */
  cars?: MapPin[];
}) {
  const { state } = useSession();
  const { runtime } = useDemo();
  const insets = useSafeAreaInsets();
  // Optional: the screen also renders outside a navigator (tests, previews).
  const navigation = useContext(NavigationContext);
  const firstName = state.stage === 'ready' ? state.user.firstName : undefined;
  const lastPickup = history[0]?.pickup;
  const places = recentPlaces(history);
  const mapPins = useMemo<MapPin[]>(
    () => [
      ...(located ? [{ id: 'me', point: center, label: 'You' }] : []),
      ...cars,
    ],
    [located, center, cars],
  );
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="0">
              <GradientStop offset="0" stopColor={colors.heroStart} />
              <GradientStop offset="0.5" stopColor={colors.heroMid} />
              <GradientStop offset="1" stopColor={colors.heroEnd} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hero)" />
        </Svg>
        <View style={styles.inner}>
          <View style={styles.brandRow}>
            <Wordmark markColor={colors.text} />
            {navigation && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open account menu"
                onPress={() =>
                  navigation.navigate('Account' satisfies keyof RiderTabParams)
                }
                hitSlop={10}
                style={styles.menu}
              >
                <Icon name="menu" />
              </Pressable>
            )}
          </View>
          <View style={styles.greeting}>
            <Text variant="display" accessibilityRole="header">
              {firstName ? `Hello, ${firstName}` : 'Hello'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose pickup location"
              onPress={() => onPlan()}
              style={styles.location}
              hitSlop={8}
            >
              <Icon name="pin" size={16} />
              <Text style={styles.locationText} numberOfLines={1}>
                {located
                  ? 'Current location'
                  : (lastPickup?.address ?? 'Set pickup location')}
              </Text>
              <Icon name="chevronDown" size={14} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Where to?"
            onPress={() => onPlan()}
            style={({ pressed }) => [styles.search, pressed && { opacity: 0.9 }]}
          >
            <Icon name="search" size={22} />
            <Text style={styles.searchText}>Where to?</Text>
            <Icon name="arrowUpRight" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.recent}>
        <View style={styles.inner}>
          <Text style={styles.sectionHeading} accessibilityRole="header">
            {places.length === 0 ? 'Popular places' : 'Recent destinations'}
          </Text>
          {places.length === 0 ? (
            popularPlaces.slice(0, 3).map((place) => (
              <Pressable
                key={place.name}
                accessibilityRole="button"
                accessibilityLabel={`${place.name}, ${place.area}, popular place`}
                onPress={() =>
                  onPlan(undefined, undefined, `${place.name}, ${place.area}`)
                }
                style={({ pressed }) => [styles.place, pressed && { backgroundColor: colors.neutral }]}
              >
                <View style={styles.tile}>
                  <Icon name="pin" size={20} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="label">{place.name}</Text>
                  <Text variant="caption" tone="secondary">
                    {place.area}
                  </Text>
                </View>
                <Icon name="chevron" size={16} color={colors.secondary} />
              </Pressable>
            ))
          ) : (
            places.map((place) => {
              const [name, ...rest] = place.address.split(',');
              return (
                <Pressable
                  key={place.address}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.address}, recent destination`}
                  onPress={() => onPlan(undefined, place)}
                  style={({ pressed }) => [styles.place, pressed && { backgroundColor: colors.neutral }]}
                >
                  <View style={styles.tile}>
                    <Icon name="activity" size={20} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="label" numberOfLines={2}>
                      {name!.trim()}
                    </Text>
                    {rest.length > 0 && (
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {rest.join(',').trim()}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron" size={16} color={colors.secondary} />
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.map} accessibilityLabel="Map preview">
        {runtime ? (
          <DemoMap center={center} pins={mapPins} />
        ) : (
          <MapCanvas center={center} pins={mapPins} />
        )}
        <View style={styles.mapCaption}>
          <Text variant="small">
            {cars.length === 0
              ? 'No drivers nearby right now'
              : `${cars.length} driver${cars.length === 1 ? '' : 's'} nearby`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan a ride from the map"
          onPress={() => onPlan()}
          style={styles.recenter}
        >
          <Icon name="locate" size={20} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  inner: { width: '100%', maxWidth: size.contentMax, alignSelf: 'center' },
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xl, overflow: 'hidden' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menu: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  greeting: { marginTop: space.xl, gap: space.sm },
  location: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 32 },
  locationText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text, maxWidth: 240 },
  search: {
    marginTop: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 64,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.floating,
  },
  searchText: { flex: 1, fontFamily: fonts.medium, fontSize: 24, lineHeight: 30, color: colors.text, letterSpacing: -0.6 },
  recent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.md, backgroundColor: colors.surface },
  sectionHeading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text, marginBottom: space.sm },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: space.sm },
  tile: {
    width: size.tile,
    height: size.tile,
    borderRadius: radius.tile,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: { flexGrow: 1, minHeight: 280, backgroundColor: colors.neutral, overflow: 'hidden' },
  mapCaption: {
    position: 'absolute',
    left: space.xl,
    bottom: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  recenter: {
    position: 'absolute',
    right: space.xl,
    bottom: space.lg,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
