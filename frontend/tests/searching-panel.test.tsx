import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  SearchingPanel,
  clock,
} from '../src/features/journey/parts/SearchingPanel';
import { headline } from '../src/features/journey/presentation';

const start = '2026-11-18T10:00:00.000Z';
const at = (seconds: number) => Date.parse(start) + seconds * 1000;
const expires = new Date(at(180)).toISOString();

describe('searching for a driver', () => {
  it('shows elapsed time and how many drivers can see the request', async () => {
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={3}
        onCheck={jest.fn()}
        now={at(42)}
      />,
    );
    expect(screen.getByText('0:42')).toBeTruthy();
    expect(
      screen.getByText('3 drivers nearby can see your request.'),
    ).toBeTruthy();
    expect(
      screen.getByText('We’ll keep looking for up to 3 minutes.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Searching for a driver')).toBeTruthy();
  });

  it('reassures after a while when drivers are nearby but busy', async () => {
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={1}
        onCheck={jest.fn()}
        now={at(70)}
      />,
    );
    expect(
      screen.getByText('1 driver nearby can see your request.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Nearby drivers may be finishing other trips. Hang on.'),
    ).toBeTruthy();
  });

  it('says plainly when no drivers are online and offers a recheck', async () => {
    const onCheck = jest.fn();
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={0}
        onCheck={onCheck}
        now={at(30)}
      />,
    );
    expect(
      screen.getByText('No drivers are online near your pickup right now.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'We’ll keep looking for 2:30 in case a driver comes online.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Check again'));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('asks for the outcome once the search window has closed', async () => {
    const onCheck = jest.fn();
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={0}
        onCheck={onCheck}
        now={at(185)}
      />,
    );
    expect(screen.getByText('Closing this search…')).toBeTruthy();
    expect(screen.queryByText('Check again')).toBeNull();
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('falls back to a one-minute window for older requests', async () => {
    await render(
      <SearchingPanel
        requestedAt={start}
        nearbyDrivers={null}
        onCheck={jest.fn()}
        now={at(5)}
      />,
    );
    expect(
      screen.getByText('Checking for drivers near your pickup…'),
    ).toBeTruthy();
    expect(
      screen.getByText('We’ll keep looking for up to 1 minute.'),
    ).toBeTruthy();
  });

  it('formats the clock and names a search that found no driver', async () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(125)).toBe('2:05');
    expect(
      headline({ status: 'cancelled', cancellationReason: 'no_driver_found' }),
    ).toBe('No driver found');
    expect(
      headline({ status: 'cancelled', cancellationReason: 'Changed plans' }),
    ).toBe('Ride cancelled');
  });
});
