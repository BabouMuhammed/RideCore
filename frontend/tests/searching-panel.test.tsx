import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  SearchingPanel,
  searchMessage,
} from '../src/features/journey/parts/SearchingPanel';
import { headline } from '../src/features/journey/presentation';

const start = '2026-11-18T10:00:00.000Z';
const at = (seconds: number) => Date.parse(start) + seconds * 1000;
const expires = new Date(at(60)).toISOString();

describe('finding a driver', () => {
  it('narrates real progress with a checklist instead of a timer', async () => {
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={3}
        onCheck={jest.fn()}
        now={at(5)}
      />,
    );
    expect(screen.getByText('Notifying 3 drivers near you')).toBeTruthy();
    expect(screen.getByText('Request sent')).toBeTruthy();
    expect(screen.getByText('3 nearby drivers notified')).toBeTruthy();
    expect(screen.getByText('Waiting for a driver to accept')).toBeTruthy();
    expect(screen.getByLabelText('Finding your driver')).toBeTruthy();
    expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
  });

  it('says plainly when no drivers are online and offers a recheck', async () => {
    const onCheck = jest.fn();
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={0}
        onCheck={onCheck}
        now={at(8)}
      />,
    );
    expect(screen.getByText('Looking for drivers near you')).toBeTruthy();
    expect(screen.getByText('No drivers online nearby yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Check again'));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('asks for the outcome once the search window has closed', async () => {
    const onCheck = jest.fn();
    await render(
      <SearchingPanel
        requestedAt={start}
        expiresAt={expires}
        nearbyDrivers={1}
        onCheck={onCheck}
        now={at(62)}
      />,
    );
    expect(screen.getByText('Wrapping up')).toBeTruthy();
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('moves through the stages as time passes', () => {
    expect(searchMessage(1, 2).title).toBe('Sending your request');
    expect(searchMessage(5, 1).title).toBe('Notifying 1 driver near you');
    expect(searchMessage(5, null).title).toBe('Looking for drivers near you');
    expect(searchMessage(15, 2).title).toBe('Waiting for a driver to accept');
    expect(searchMessage(30, 2).title).toBe(
      'Your request is still with nearby drivers',
    );
    expect(searchMessage(50, 2).title).toBe('Still looking');
    expect(searchMessage(20, 0).detail).toMatch(/keep looking/);
    expect(searchMessage(10, 2, true).title).toBe('Wrapping up');
  });

  it('names a search that found no driver', () => {
    expect(
      headline({ status: 'cancelled', cancellationReason: 'no_driver_found' }),
    ).toBe('No driver found');
    expect(
      headline({ status: 'cancelled', cancellationReason: 'Changed plans' }),
    ).toBe('Ride cancelled');
  });
});
