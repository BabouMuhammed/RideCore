import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import type { ShareGrant, Trip } from '../../services/journey-api';
import { safeError } from '../../services/errors';
import { useJourney } from '../journey/JourneyProvider';
export function recipientUrl(
  token: string,
  base = process.env.EXPO_PUBLIC_SHARE_WEB_URL,
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
      (!__DEV__ && url.protocol !== 'https:')
    )
      return null;
    // The bearer share capability stays in the fragment, not server URL logs/referrers.
    return url.toString().replace(/\/$/, '') + '/#track=' + token;
  } catch {
    return null;
  }
}
export function SharePanel({ trip, onClose }: { trip: Trip; onClose(): void }) {
  const { controller } = useJourney();
  const [grant, setGrant] = useState<ShareGrant | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
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
  async function act(revoke: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (revoke) {
        await controller.run((token, signal) =>
          controller.api.revoke(token, trip._id, signal),
        );
        if (mounted.current) setGrant(null);
      } else {
        const grant = await controller.run((token, signal) =>
          controller.api.share(token, trip._id, signal),
        );
        if (mounted.current) setGrant(grant);
      }
    } catch (error) {
      if (mounted.current) setError(safeError(error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const active = grant && Date.parse(grant.expiresAt) > now;
  return (
    <>
      <Text variant="heading">Safety and sharing</Text>
      <Text>
        Send a read-only trip link to someone you trust. Anyone with the link
        can see this trip’s route and shared driver location until it expires,
        is stopped or the ride ends.
      </Text>
      <Text>
        RideCore does not provide emergency dispatch or in-app calling.
      </Text>
      {active ? (
        <>
          <Text>
            Sharing expires at {new Date(grant.expiresAt).toLocaleTimeString()}.
          </Text>
          <Button
            label="Share trip link"
            disabled={busy}
            onPress={() => {
              const url = recipientUrl(grant.token);
              if (url)
                void Share.share({
                  message: 'Follow my RideCore trip: ' + url,
                }).catch(() =>
                  setError('The link could not be shared. Please try again.'),
                );
            }}
          />
        </>
      ) : (
        <>
          {grant && <Text>This sharing link has expired.</Text>}
          <Button
            label="Create sharing link"
            loading={busy}
            disabled={!recipientUrl('configuration-check')}
            onPress={() => void act(false)}
          />
        </>
      )}
      {!recipientUrl('configuration-check') && (
        <Text>
          Trip link sharing is unavailable until the recipient viewer is
          configured.
        </Text>
      )}
      <Text variant="caption" tone="secondary">
        Links are not saved on this device. If a link already exists, stop
        sharing before creating another.
      </Text>
      <Button
        label="Stop sharing this ride"
        variant="secondary"
        disabled={busy}
        onPress={() => void act(true)}
      />
      {error && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Button
        label="Back to trip"
        variant="secondary"
        disabled={busy}
        onPress={onClose}
      />
    </>
  );
}
