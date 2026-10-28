import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
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
      <Text variant="heading">Trip receipt</Text>
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
            <Button
              label={(method === 'cash' ? '✓ ' : '') + 'Cash'}
              variant="secondary"
              disabled={busy}
              onPress={() => setMethod('cash')}
            />
            <Button
              label={
                (method === 'mock_wallet' ? '✓ ' : '') +
                'Mock wallet (simulation)'
              }
              variant="secondary"
              disabled={busy}
              onPress={() => setMethod('mock_wallet')}
            />
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
          <View style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                label={
                  (rating === value ? '✓ ' : '') +
                  `${value} ${value === 1 ? 'star' : 'stars'}`
                }
                variant="secondary"
                disabled={busy}
                onPress={() => setRating(value)}
              />
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
