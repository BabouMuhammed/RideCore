import {
  DriverController,
  nextAction,
} from '../src/features/driver/DriverController';
import { AppError } from '../src/services/errors';
import type { DriverApi } from '../src/services/driver-api';
import { tripFixture } from './journey-fixtures';

const approved = {
  profile: {
    verificationStatus: 'approved' as const,
    availabilityStatus: 'offline' as const,
    licenseNumber: 'GMB-1',
    ratingAverage: 0,
    ratingCount: 0,
    location: null,
  },
  vehicle: {
    make: 'Toyota',
    model: 'Corolla',
    year: 2016,
    color: 'Silver',
    plateNumber: 'KM4821B',
    vehicleType: 'economy' as const,
    seats: 4,
    verificationStatus: 'approved' as const,
  },
};
const online = {
  ...approved,
  profile: { ...approved.profile, availabilityStatus: 'online' as const },
};

function harness(overrides: Partial<Record<keyof DriverApi, jest.Mock>> = {}) {
  const api = {
    account: jest.fn().mockResolvedValue(approved),
    saveLicense: jest.fn(),
    saveVehicle: jest.fn(),
    setLocation: jest.fn().mockResolvedValue(undefined),
    setAvailability: jest.fn().mockResolvedValue(undefined),
    requests: jest.fn().mockResolvedValue([]),
    rides: jest.fn().mockResolvedValue([]),
    ride: jest.fn(),
    accept: jest.fn().mockResolvedValue(undefined),
    progress: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    rate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as DriverApi & Record<string, jest.Mock>;
  const link = { sendLocation: jest.fn(), close: jest.fn() };
  const connect = jest.fn().mockReturnValue(link);
  const controller = new DriverController(
    api,
    (work) => work('token', new AbortController().signal),
    connect,
  );
  return { api, link, connect, controller };
}

test('each ride status has exactly one next step for the driver', () => {
  expect(nextAction('accepted')?.action).toBe('arriving');
  expect(nextAction('driver_arriving')?.action).toBe('arrived');
  expect(nextAction('driver_arrived')?.action).toBe('start');
  expect(nextAction('in_progress')?.action).toBe('complete');
  expect(nextAction('requested')).toBeNull();
  expect(nextAction('completed')).toBeNull();
});

test('going online needs a known position, and sends it before going online', async () => {
  const h = harness();
  await h.controller.refresh();
  await h.controller.goOnline();
  expect(h.api.setAvailability).not.toHaveBeenCalled();
  expect(h.controller.getSnapshot().error).toMatch(/location/i);

  h.controller.updateLocation([-16.68, 13.44], 'map');
  await h.controller.goOnline();
  expect(h.api.setLocation).toHaveBeenCalledWith(
    'token',
    [-16.68, 13.44],
    expect.anything(),
  );
  expect(h.api.setAvailability).toHaveBeenCalledWith(
    'token',
    'online',
    expect.anything(),
  );
});

test('a request another driver already took is explained, not shown as a crash', async () => {
  const h = harness({
    account: jest.fn().mockResolvedValue(online),
    accept: jest.fn().mockRejectedValue(new AppError('changed')),
  });
  await h.controller.refresh();
  await h.controller.accept('a'.repeat(24));
  expect(h.controller.getSnapshot().error).toMatch(/another driver/i);
});

test('during a ride, location goes live over the socket; while waiting, to the backend', async () => {
  const active = { ...tripFixture, status: 'accepted' as const };
  const h = harness({
    account: jest.fn().mockResolvedValue({
      ...online,
      profile: { ...online.profile, availabilityStatus: 'busy' },
    }),
    rides: jest.fn().mockResolvedValue([active]),
    ride: jest.fn().mockResolvedValue(active),
  });
  await h.controller.refresh();
  await Promise.resolve();
  expect(h.connect).toHaveBeenCalledWith('token', active._id, expect.anything());
  h.controller.updateLocation([-16.6, 13.45], 'gps');
  expect(h.link.sendLocation).toHaveBeenCalledWith([-16.6, 13.45]);
  expect(h.api.setLocation).not.toHaveBeenCalled();

  // Advancing uses the step that matches the ride's status.
  await h.controller.advance();
  expect(h.api.progress).toHaveBeenCalledWith(
    'token',
    active._id,
    'arriving',
    expect.anything(),
  );
});

test('a finished ride stays on screen for rating until the driver closes it', async () => {
  const done = { ...tripFixture, status: 'completed' as const };
  const active = { ...tripFixture, status: 'in_progress' as const };
  const rides = jest.fn().mockResolvedValue([active]);
  const ride = jest.fn().mockResolvedValue(active);
  const h = harness({ rides, ride });
  await h.controller.refresh();
  rides.mockResolvedValue([done]);
  ride.mockResolvedValue(done);
  await h.controller.refresh();
  expect(h.controller.getSnapshot().ride?.status).toBe('completed');
  await h.controller.rate(5, 'Polite');
  expect(h.api.rate).toHaveBeenCalledWith(
    'token',
    done._id,
    5,
    'Polite',
    expect.anything(),
  );
  expect(h.controller.getSnapshot().ride).toBeNull();
  expect(h.link.close).toHaveBeenCalled();
});
