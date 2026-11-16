import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Pressable, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { colors, radius } from '../../../theme/tokens';
import type { RiderTabParams } from '../../../navigation/types';
import { rideOptions } from './RiderHome';
export function ServicesScreen() {
  const navigation = useNavigation<NavigationProp<RiderTabParams>>();
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Services
      </Text>
      <Text variant="heading">Go anywhere</Text>
      {rideOptions.map((option) => (
        <Pressable
          key={option.category}
          accessibilityRole="button"
          accessibilityLabel={option.title}
          onPress={() =>
            navigation.navigate('Home', { service: option.category })
          }
          style={{
            backgroundColor: colors.neutral,
            borderRadius: radius.lg,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="heading">{option.title}</Text>
            <Text tone="secondary">{option.detail}</Text>
          </View>
          <VehicleArt width={120} premium={option.category === 'comfort'} />
        </Pressable>
      ))}
    </Screen>
  );
}
