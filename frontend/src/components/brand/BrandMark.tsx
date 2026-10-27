import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../../theme/tokens';
// Original two-way path mark. No reference-app assets or logos.
export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { width: size, height: size }]}
    >
      <Svg width="65%" height="65%" viewBox="0 0 100 100">
        <Path
          d="M25 82V34C25 20 36 15 48 15H75M75 18V66C75 80 64 85 52 85H25"
          stroke={colors.onBrand}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
