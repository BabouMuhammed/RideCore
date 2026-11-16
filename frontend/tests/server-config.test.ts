import {
  acceptableApiUrl,
  expandServerInput,
  isLocalNetworkHost,
} from '../src/services/server-config';

test.each([
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
  '192.168.1.20',
  '172.20.10.3',
  'ridecore-laptop.local',
])('%s is on the local network', (host) => {
  expect(isLocalNetworkHost(host)).toBe(true);
});
test.each(['8.8.8.8', '172.32.0.1', 'api.ridecore.gm', '192.169.1.1', '999.1.1.1'])(
  '%s is not on the local network',
  (host) => {
    expect(isLocalNetworkHost(host)).toBe(false);
  },
);

test('release builds accept plain http only to the local network', () => {
  expect(acceptableApiUrl('http://192.168.1.20:5050/api', false)).toBe(
    'http://192.168.1.20:5050/api',
  );
  expect(acceptableApiUrl('http://api.ridecore.gm/api', false)).toBeNull();
  expect(acceptableApiUrl('https://api.ridecore.gm/api', false)).toBe(
    'https://api.ridecore.gm/api',
  );
  // Development keeps its existing freedom.
  expect(acceptableApiUrl('http://api.ridecore.gm/api', true)).not.toBeNull();
});

test('malformed or unsafe addresses are refused', () => {
  for (const bad of [
    'not a url',
    'ftp://192.168.1.20/api',
    'http://user:pass@192.168.1.20/api',
    'http://192.168.1.20:5050/other',
    'http://192.168.1.20/api?x=1',
  ])
    expect(acceptableApiUrl(bad, false)).toBeNull();
});

test('a bare laptop IP becomes the full backend address', () => {
  expect(expandServerInput('192.168.1.20')).toBe('http://192.168.1.20:5050/api');
  expect(expandServerInput('192.168.1.20:8080')).toBe(
    'http://192.168.1.20:8080/api',
  );
  expect(expandServerInput('https://api.ridecore.gm/api')).toBe(
    'https://api.ridecore.gm/api',
  );
});
