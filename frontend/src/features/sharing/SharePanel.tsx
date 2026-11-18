import { useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { Icon } from '../../components/ui/Icon';
import { ListRow } from '../../components/ui/ListRow';
import { colors, radius } from '../../theme/tokens';
import type { ShareGrant, Trip } from '../../services/journey-api';
import { safeError } from '../../services/errors';
import { useJourney } from '../journey/JourneyProvider';
import { useDemo } from '../../demo/DemoProvider';
import { statusLabels } from '../journey/presentation';
import { isLocalNetworkHost } from '../../services/server-config';

export function recipientUrl(
  token: string,
  base = process.env.EXPO_PUBLIC_SHARE_WEB_URL ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : undefined),
) {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      // Release builds share https links, except on a home network (a
      // laptop demo), where the link only works on that network anyway.
      (!__DEV__ &&
        url.protocol !== 'https:' &&
        !isLocalNetworkHost(url.hostname))
    )
      return null;
    // Keep the bearer capability out of server request URLs and referrers.
    return url.toString().replace(/\/$/, '') + '/#track=' + token;
  } catch {
    return null;
  }
}
type Props = {
  trip: Trip;
  onClose(): void;
  initialGrant?: ShareGrant | null;
  onGrantChange?(grant: ShareGrant | null): void;
};

export function SharePanel({
  trip,
  onClose,
  initialGrant = null,
  onGrantChange,
}: Props) {
  const { runtime } = useDemo(),
    { controller } = useJourney();
  const [grant, setGrant] = useState<ShareGrant | null>(initialGrant);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>(),
    [now, setNow] = useState(() => Date.now());
  const [preview, setPreview] = useState(false),
    [recover, setRecover] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  function retain(value: ShareGrant | null) {
    setGrant(value);
    onGrantChange?.(value);
  }
  async function act(revoke: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (revoke) {
        await controller.run((token, signal) =>
          controller.api.revoke(token, trip._id, signal),
        );
        if (mounted.current) {
          retain(null);
          setRecover(false);
          setNotice('Sharing has been stopped for this ride.');
        }
      } else {
        const value = await controller.run((token, signal) =>
          controller.api.share(token, trip._id, signal),
        );
        if (mounted.current) {
          retain(value);
          setRecover(false);
          setNotice(
            'Your tracking link is ready. Send it to someone you trust.',
          );
        }
      }
    } catch (failure) {
      if (mounted.current) {
        const problem = safeError(failure);
        if (
          !revoke &&
          ['changed', 'network', 'server'].includes(problem.kind)
        ) {
          setRecover(true);
          setError(
            problem.kind === 'changed'
              ? 'A link may already be active, or your ride may have ended. Stop sharing before creating a new link.'
              : 'We could not confirm whether the link was created. Stop sharing before trying again.',
          );
        } else setError(problem.message);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const active = grant && Date.parse(grant.expiresAt) > now;
  const url = active ? recipientUrl(grant.token) : null;
  const canCopy =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard?.writeText;
  async function send(copy = false) {
    if (!url || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (copy) {
        await navigator.clipboard.writeText(url);
        if (mounted.current)
          setNotice(
            'Tracking link copied. Paste it into a message to your friend or family.',
          );
      } else if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.share
      ) {
        await navigator.share({
          title: 'Follow my RideCore ride',
          text: 'Follow my journey with RideCore. No account needed.',
          url,
        });
      } else
        await Share.share({
          message: 'Follow my RideCore ride. No account needed: ' + url,
        });
    } catch (failure) {
      if (
        mounted.current &&
        !(failure instanceof Error && failure.name === 'AbortError')
      )
        setError(
          copy
            ? 'The link could not be copied. Try sending it instead.'
            : Platform.OS === 'web'
              ? 'The share menu could not open. Copy the tracking link into a message instead.'
              : 'The share menu could not open. Please try again.',
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Text variant="heading">Share my ride</Text>
      <View style={styles.hero}>
        <View style={styles.symbol}>
          <Icon name="share" size={30} />
        </View>
        <Text variant="heading" style={styles.center}>
          Someone along for the ride
        </Text>
        <Text tone="secondary" style={styles.center}>
          Send a tracking link to a friend or family member. They can follow
          your journey without a RideCore account.
        </Text>
      </View>
      <ListRow
        icon="pin"
        title="Heading to"
        subtitle={trip.destination.address}
      />
      <View style={styles.explanation}>
        <Icon name="shield" size={22} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          Anyone with the link can see your pickup, destination, ride status,
          driver and vehicle details, and the latest shared driver location. The
          link expires automatically and stops working when the ride ends or you
          stop sharing.
        </Text>
      </View>
      {runtime ? (
        <>
          <Text variant="caption" tone="secondary">
            Demo preview · No public link is created or sent.
          </Text>
          <Button
            label={preview ? 'Hide tracking preview' : "Preview friend's view"}
            onPress={() => setPreview(!preview)}
          />
          {preview && (
            <View style={styles.preview}>
              <Text variant="heading">{"Your friend's view"}</Text>
              <Text variant="label" accessibilityLiveRegion="polite">
                {statusLabels[trip.status]}
              </Text>
              {trip.driverDetails && (
                <Text>Driver · {trip.driverDetails.firstName}</Text>
              )}
              {trip.vehicle && (
                <Text>
                  {trip.vehicle.color} {trip.vehicle.make} {trip.vehicle.model}{' '}
                  · {trip.vehicle.plateNumber}
                </Text>
              )}
              <ListRow
                icon="pin"
                title="Pickup"
                subtitle={trip.pickup.address}
              />
              <ListRow
                icon="pin"
                title="Destination"
                subtitle={trip.destination.address}
              />
              <Text variant="caption" tone="secondary">
                Read-only demo tracking. Live links show the latest driver
                location when it is available.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {active ? (
            <>
              <Text variant="label">Tracking link ready</Text>
              <Text variant="caption" tone="secondary">
                Available until {new Date(grant.expiresAt).toLocaleTimeString()}{' '}
                or until this ride ends.
              </Text>
              <Button
                label="Send tracking link"
                disabled={busy}
                onPress={() => void send()}
              />
              {canCopy && (
                <Button
                  label="Copy tracking link"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void send(true)}
                />
              )}
              {Platform.OS === 'web' && !canCopy && (
                <>
                  <Text variant="caption" tone="secondary">
                    Select and copy this link into a message.
                  </Text>
                  <Text selectable accessibilityLabel="Tracking link">
                    {url}
                  </Text>
                </>
              )}
            </>
          ) : (
            <>
              {grant && <Text>This sharing link has expired.</Text>}
              <Button
                label="Create tracking link"
                loading={busy}
                disabled={recover || !recipientUrl('configuration-check')}
                onPress={() => void act(false)}
              />
            </>
          )}
          {!recipientUrl('configuration-check') && (
            <Text tone="secondary">
              A tracking website needs to be configured before links can be
              shared.
            </Text>
          )}
          <Text variant="caption" tone="secondary">
            Your link stays available while you use this trip screen. After an
            app restart, stop sharing to replace any existing link.
          </Text>
          <Button
            label="Stop sharing this ride"
            variant="secondary"
            disabled={busy}
            onPress={() => void act(true)}
          />
        </>
      )}
      {error && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      <Button
        label="Back to trip"
        variant="secondary"
        disabled={busy}
        onPress={onClose}
      />
    </>
  );
}
const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.neutral,
    borderRadius: radius.lg,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  symbol: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  explanation: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  preview: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
    gap: 12,
  },
});
