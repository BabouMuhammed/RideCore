import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, size, radius, space } from '../../theme/tokens';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
import { Icon } from '../../components/ui/Icon';
import type { Payment, Trip } from '../../services/journey-api';
import { safeError } from '../../services/errors';
import { useJourney } from '../journey/JourneyProvider';
import { money } from '../journey/presentation';
export function Receipt({
  trip,
  onUpdated,
}: {
  trip: Trip;
  onUpdated(): void;
}) {
  const { controller } = useJourney();
  const [payment, setPayment] = useState<Payment | null>(null),
    [loaded, setLoaded] = useState(false);
  const [method, setMethod] = useState<Payment['method']>('cash'),
    [rating, setRating] = useState(0),
    [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [rated, setRated] = useState(!!trip.myRating);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    try {
      const value = await controller.run((token, signal) =>
        controller.api.payment(token, trip._id, signal),
      );
      if (mounted.current) {
        setPayment(value);
        setLoaded(true);
        setError(undefined);
      }
    } catch (error) {
      if (mounted.current) setError(safeError(error).message);
    }
  }, [controller, trip._id]);
  useEffect(() => {
    let alive = true;
    void controller
      .run((token, signal) => controller.api.payment(token, trip._id, signal))
      .then((value) => {
        if (alive) {
          setPayment(value);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (alive) setError(safeError(error).message);
      });
    return () => {
      alive = false;
    };
  }, [controller, trip._id]);
  async function pay() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const value = await controller.run((token, signal) =>
        controller.api.pay(token, trip._id, method, signal),
      );
      if (mounted.current) setPayment(value);
    } catch (error) {
      if (mounted.current) {
        setError(safeError(error).message);
        await load();
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function rate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await controller.run((token, signal) =>
        controller.api.rate(token, trip._id, rating, comment, signal),
      );
      if (mounted.current) {
        setRated(true);
        onUpdated();
      }
    } catch (error) {
      if (mounted.current) {
        setError(safeError(error).message);
        onUpdated();
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Text variant="title" accessibilityRole="header">
        Trip receipt
      </Text>
      <View style={styles.total}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text tone="inverse" variant="caption">
            Your total
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: fonts.medium,
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: -1,
              color: colors.onInk,
            }}
          >
            {money(trip.finalFare ?? trip.estimatedFare, trip.currency)}
          </Text>
        </View>
        <View style={styles.totalIcon}>
          <Icon name="banknote" size={20} color={colors.onBrand} />
        </View>
      </View>
      {!loaded && (
        <Button
          label="Reload payment result"
          variant="secondary"
          onPress={() => void load()}
        />
      )}
      {payment ? (
        <>
          <Text variant="label">
            Payment recorded · {money(payment.amount, payment.currency)}
          </Text>
          <Text>
            {payment.method === 'cash'
              ? 'Cash · simulated payment record'
              : 'Mock wallet · simulated payment, no real funds moved'}
          </Text>
        </>
      ) : (
        loaded && (
          <>
            <Text>
              Choose how to record this payment. Both methods are simulated for
              this project; no payment gateway or wallet balance is connected.
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Payment method"
              style={{ gap: space.sm }}
            >
              {(
                [
                  ['cash', 'Cash', 'Pay the driver directly'],
                  [
                    'mock_wallet',
                    'Mock wallet (simulation)',
                    'Stands in for Wave, QMoney or Africell Money',
                  ],
                ] as const
              ).map(([value, label, detail]) => {
                const checked = method === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked, disabled: busy }}
                    disabled={busy}
                    onPress={() => setMethod(value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      minHeight: size.touch,
                      padding: space.lg,
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor: checked ? colors.brand : colors.border,
                      backgroundColor: checked ? colors.brandSoft : colors.surface,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: checked ? colors.brand : colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.brand,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{label}</Text>
                      <Text variant="caption" tone="secondary">
                        {detail}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Button
              label="Record simulated payment"
              loading={busy}
              onPress={() => void pay()}
            />
          </>
        )
      )}
      {rated || trip.myRating ? (
        <Text>Thank you. Your rating has been recorded.</Text>
      ) : (
        <>
          <Text variant="heading">How was your ride?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                accessibilityState={{
                  selected: rating === value,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => setRating(value)}
                style={{
                  minWidth: size.touch,
                  minHeight: size.touch,
                  borderRadius: radius.pill,
                  backgroundColor:
                    value <= rating ? colors.brand : colors.neutral,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name="star"
                  size={30}
                  color={value <= rating ? colors.onBrand : colors.disabledText}
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
            onPress={() => void rate()}
          />
        </>
      )}
      {error && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingLeft: 20,
    paddingRight: space.md,
  },
  totalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
