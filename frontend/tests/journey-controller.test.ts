import {
  JourneyController,
  type Runner,
} from '../src/features/journey/JourneyController';
import type { RideWatcher } from '../src/services/realtime';
import { AppError } from '../src/services/errors';
import { deferred, rider } from './fixtures';
import { journeyApi, tripFixture as trip } from './journey-fixtures';
function harness() {
  const api = journeyApi(),
    cleanup = jest.fn();
  let handlers: Parameters<RideWatcher>[2];
  const watch = jest.fn<ReturnType<RideWatcher>, Parameters<RideWatcher>>(
    (_token, _id, value) => {
      handlers = value;
      return cleanup;
    },
  );
  const run: Runner = (work) =>
    work('test-only-credential', new AbortController().signal);
  const controller = new JourneyController(api, run, rider._id, null, watch);
  return { api, controller, watch, cleanup, handlers: () => handlers };
}
test('no active ride remains empty without inventing assignment', async () => {
  const h = harness();
  await h.controller.refresh();
  expect(h.controller.getSnapshot().trip).toBeNull();
  expect(h.watch).not.toHaveBeenCalled();
});
test('request adopts only the real returned ride and prevents another active request', async () => {
  const h = harness();
  await h.controller.refresh();
  const input = {
    pickup: trip.pickup,
    destination: trip.destination,
    vehicleType: trip.vehicleType,
  };
  await h.controller.request(input);
  expect(h.controller.getSnapshot().trip?.status).toBe('requested');
  expect(h.api.create).toHaveBeenCalledTimes(1);
  await expect(h.controller.request(input)).rejects.toMatchObject({
    kind: 'changed',
  });
  expect(h.api.create).toHaveBeenCalledTimes(1);
});
test('uncertain create response reconciles an existing request without repeating POST', async () => {
  const h = harness();
  h.api.create.mockRejectedValue(new AppError('network'));
  h.api.list.mockResolvedValue([trip]);
  await expect(
    h.controller.request({
      pickup: trip.pickup,
      destination: trip.destination,
      vehicleType: 'economy',
    }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(h.api.create).toHaveBeenCalledTimes(1);
  expect(h.controller.getSnapshot().trip?._id).toBe(trip._id);
});
test('socket hints reconcile REST rather than fabricating transitions', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([trip]);
  await h.controller.refresh();
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'accepted',
    driver: 'd'.repeat(24),
  });
  h.handlers().changed();
  await h.controller.refresh();
  expect(h.controller.getSnapshot().trip?.status).toBe('accepted');
  h.handlers().connection(true);
  expect(h.controller.getSnapshot().connected).toBe(true);
  h.handlers().connection(false);
  expect(h.controller.getSnapshot().connected).toBe(false);
});
test('only real assigned-driver location samples move forward in timestamp order', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([trip]);
  await h.controller.refresh();
  const first = {
    point: [0, 0] as [number, number],
    timestamp: '2026-10-28T12:00:01Z',
  };
  h.handlers().location(first);
  expect(h.controller.getSnapshot().location).toBeNull();
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'accepted',
    driver: 'd'.repeat(24),
  });
  await h.controller.refresh();
  h.handlers().location(first);
  expect(h.controller.getSnapshot().location).toEqual(first);
  h.handlers().location({ point: [1, 1], timestamp: '2026-10-28T12:00:00Z' });
  expect(h.controller.getSnapshot().location).toEqual(first);
});
test('completed REST state clears tracking, disconnects room and retains receipt', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([trip]);
  await h.controller.refresh();
  h.api.list.mockResolvedValue([{ ...trip, status: 'completed' }]);
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'completed',
    finalFare: 125,
  });
  await h.controller.refresh();
  expect(h.controller.getSnapshot().trip?.status).toBe('completed');
  expect(h.controller.getSnapshot().location).toBeNull();
  expect(h.cleanup).toHaveBeenCalled();
  h.controller.dismiss();
  expect(h.controller.getSnapshot().trip).toBeNull();
});
test('a started ride cannot be cancelled by the rider client', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([{ ...trip, status: 'in_progress' }]);
  h.api.detail.mockResolvedValue({ ...trip, status: 'in_progress' });
  await h.controller.refresh();
  await expect(h.controller.cancel('Changed plans')).rejects.toMatchObject({
    kind: 'changed',
  });
  expect(h.api.cancel).not.toHaveBeenCalled();
});
test('multiple active rides or unrelated owners produce recovery instead of a guessed ride', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([trip, { ...trip, _id: 'c'.repeat(24) }]);
  await h.controller.refresh();
  expect(h.controller.getSnapshot().error?.kind).toBe('contract');
  h.api.list.mockResolvedValue([{ ...trip, rider: 'e'.repeat(24) }]);
  await h.controller.refresh();
  expect(h.controller.getSnapshot().error?.kind).toBe('contract');
  expect(h.watch).not.toHaveBeenCalled();
});
test('disposal drops late private state and closes socket work', async () => {
  const h = harness();
  const gate = deferred<(typeof trip)[]>();
  h.api.list.mockReturnValue(gate.promise);
  const pending = h.controller.refresh();
  h.controller.dispose();
  gate.resolve([trip]);
  await pending;
  expect(h.controller.getSnapshot().trip).toBeNull();
  expect(h.watch).not.toHaveBeenCalled();
});
test('no-driver feedback uses only the backend category snapshot and leaves the request unassigned', async () => {
  const h = harness();
  // An XL ride: a Comfort car nearby can't take it, so no drivers count.
  h.api.list.mockResolvedValue([{ ...trip, vehicleType: 'xl' }]);
  h.api.detail.mockResolvedValue({ ...trip, vehicleType: 'xl' });
  h.api.nearby.mockResolvedValue(['comfort']);
  await h.controller.refresh();
  await Promise.resolve();
  expect(h.controller.getSnapshot().nearbyDrivers).toBe(0);
  expect(h.controller.getSnapshot().trip?.status).toBe('requested');
  h.api.nearby.mockRejectedValue(new AppError('network'));
  await h.controller.refresh();
  await Promise.resolve();
  expect(h.controller.getSnapshot().nearbyDrivers).toBeNull();
});
test('REST recovery replaces stale GPS with a newer stored sample and never rolls back a newer socket sample', async () => {
  const h = harness();
  h.api.list.mockResolvedValue([trip]);
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'accepted',
    driver: 'd'.repeat(24),
    trackingLocation: {
      location: { coordinates: [0, 0] },
      updatedAt: '2026-10-28T12:00:00Z',
    },
  });
  await h.controller.refresh();
  h.handlers().location({ point: [1, 1], timestamp: '2026-10-28T12:00:01Z' });
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'accepted',
    driver: 'd'.repeat(24),
    trackingLocation: {
      location: { coordinates: [2, 2] },
      updatedAt: '2026-10-28T12:00:02Z',
    },
  });
  await h.controller.refresh();
  expect(h.controller.getSnapshot().location?.point).toEqual([2, 2]);
  h.api.detail.mockResolvedValue({
    ...trip,
    status: 'accepted',
    driver: 'd'.repeat(24),
    trackingLocation: {
      location: { coordinates: [0, 0] },
      updatedAt: '2026-10-28T12:00:00Z',
    },
  });
  await h.controller.refresh();
  expect(h.controller.getSnapshot().location?.point).toEqual([2, 2]);
});
