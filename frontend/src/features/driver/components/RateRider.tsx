import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Icon } from '../../../components/ui/Icon';
import { colors, radius, size } from '../../../theme/tokens';

export function RateRider({
  name,
  busy,
  onRate,
}: {
  name: string | null;
  busy: boolean;
  onRate(rating: number, comment: string): void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <>
      <Text variant="heading">How was {name ?? 'your rider'}?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
            accessibilityState={{ selected: rating === value, disabled: busy }}
            disabled={busy}
            onPress={() => setRating(value)}
            style={{
              minWidth: size.touch,
              minHeight: size.touch,
              borderRadius: radius.pill,
              backgroundColor: value <= rating ? colors.taxi : colors.neutral,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="star"
              size={30}
              color={value <= rating ? colors.onTaxi : colors.disabledText}
            />
          </Pressable>
        ))}
      </View>
      <Input
        label="Comment (optional)"
        value={comment}
        onChangeText={setComment}
        maxLength={1000}
        multiline
        editable={!busy}
      />
      <Button
        label="Submit rating"
        loading={busy}
        disabled={!rating}
        onPress={() => onRate(rating, comment)}
      />
    </>
  );
}
