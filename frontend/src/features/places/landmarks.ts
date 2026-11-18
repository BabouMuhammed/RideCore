import type { Stop } from '../../services/journey-api';
import type { IconName } from '../../components/ui/Icon';

// Well-known places riders can pick with one tap, without typing.
// Positions are from OpenStreetMap (looked up November 2026); the icon
// helps riders who find reading hard recognise the place.
export type Landmark = {
  id: string;
  name: string;
  area: string;
  icon: IconName;
  stop: Stop;
};

const place = (
  id: string,
  name: string,
  area: string,
  icon: IconName,
  lng: number,
  lat: number,
): Landmark => ({
  id,
  name,
  area,
  icon,
  stop: {
    address: `${name}, ${area}`,
    location: { type: 'Point', coordinates: [lng, lat] },
  },
});

export const landmarks: Landmark[] = [
  place(
    'westfield',
    'Westfield',
    'Serrekunda',
    'junction',
    -16.67556,
    13.44512,
  ),
  place(
    'serrekunda-market',
    'Serrekunda Market',
    'Serrekunda',
    'market',
    -16.68216,
    13.44085,
  ),
  place('senegambia', 'Senegambia', 'Kololi', 'beach', -16.72099, 13.44173),
  place('airport', 'Airport', 'Yundum', 'plane', -16.65234, 13.34383),
  place(
    'albert-market',
    'Albert Market',
    'Banjul',
    'market',
    -16.57152,
    13.45389,
  ),
  place('arch-22', 'Arch 22', 'Banjul', 'landmark', -16.58244, 13.46032),
  place(
    'efsth',
    'Teaching Hospital',
    'Banjul',
    'hospital',
    -16.57725,
    13.45749,
  ),
  place('utg', 'University (UTG)', 'Kanifing', 'school', -16.6771, 13.4605),
  place(
    'brikama-market',
    'Brikama Market',
    'Brikama',
    'market',
    -16.64829,
    13.27294,
  ),
];
