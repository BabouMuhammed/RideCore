import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';
import { BrandHeader } from '../../../components/layout/BrandHeader';
import { Text } from '../../../components/ui/Text';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { categories, type Category } from '../../../services/journey-api';
import type { Verification } from '../../../services/driver-api';
import { colors, fonts, radius, size, space } from '../../../theme/tokens';
import { useDriver } from '../DriverProvider';

const categoryLabels: Record<Category, string> = {
  economy: 'Ride',
  comfort: 'Comfort',
  xl: 'XL',
};
const statusCopy: Record<Verification | 'missing', { label: string; tone: string; bg: string }> = {
  missing: { label: 'To do', tone: colors.onTaxi, bg: colors.taxi },
  pending: { label: 'Waiting for approval', tone: colors.onTaxi, bg: colors.neutral },
  approved: { label: 'Approved', tone: colors.brand, bg: colors.brandSoft },
  rejected: { label: 'Not approved', tone: colors.error, bg: colors.errorSoft },
};

function Status({ value }: { value: Verification | 'missing' }) {
  const copy = statusCopy[value];
  return (
    <View style={[styles.badge, { backgroundColor: copy.bg }]}>
      <Text style={[styles.badgeText, { color: copy.tone }]}>{copy.label}</Text>
    </View>
  );
}

export function DriverOnboarding() {
  const { controller, state } = useDriver();
  const profile = state.account?.profile ?? null;
  const vehicle = state.account?.vehicle ?? null;
  const [license, setLicense] = useState(profile?.licenseNumber ?? '');
  const [car, setCar] = useState({
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : '',
    color: vehicle?.color ?? '',
    plateNumber: vehicle?.plateNumber ?? '',
    seats: vehicle ? String(vehicle.seats) : '4',
    vehicleType: (vehicle?.vehicleType ?? 'economy') as Category,
  });
  const [problem, setProblem] = useState<string>();

  const licenseStatus: Verification | 'missing' = profile?.licenseNumber
    ? profile.verificationStatus
    : 'missing';
  const vehicleStatus: Verification | 'missing' = vehicle
    ? vehicle.verificationStatus
    : 'missing';
  const thisYear = new Date().getFullYear();

  function saveVehicle() {
    const year = Number(car.year),
      seats = Number(car.seats);
    if (!car.make.trim() || !car.model.trim() || !car.color.trim() || !car.plateNumber.trim())
      return setProblem('Fill in every vehicle detail.');
    if (!Number.isInteger(year) || year < 1980 || year > thisYear + 1)
      return setProblem(`Enter a year between 1980 and ${thisYear + 1}.`);
    if (!Number.isInteger(seats) || seats < 1 || seats > 12)
      return setProblem('Enter between 1 and 12 passenger seats.');
    setProblem(undefined);
    void controller.saveVehicle({
      make: car.make.trim(),
      model: car.model.trim(),
      year,
      color: car.color.trim(),
      plateNumber: car.plateNumber.trim().toUpperCase(),
      vehicleType: car.vehicleType,
      seats,
    });
  }

  const submitted = licenseStatus !== 'missing' && vehicleStatus !== 'missing';
  return (
    <Screen
      edges={['top', 'left', 'right']}
      header={
        <BrandHeader
          title="Start driving"
          subtitle="Add your licence and vehicle. An admin checks them before you can take rides."
        />
      }
    >
      {state.error && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {state.error}
        </Text>
      )}
      {submitted && (
        <View style={styles.notice}>
          <Text variant="label">
            {licenseStatus === 'rejected' || vehicleStatus === 'rejected'
              ? 'Some details were not approved. Update them and save again.'
              : 'Thanks. Your details are with an admin for approval.'}
          </Text>
          <Button
            label="Check approval status"
            variant="secondary"
            disabled={state.busy}
            onPress={() => void controller.refresh()}
          />
        </View>
      )}

      <View style={styles.step}>
        <View style={styles.stepHead}>
          <Text variant="heading" style={{ flex: 1 }}>
            Driving licence
          </Text>
          <Status value={licenseStatus} />
        </View>
        <Input
          label="Licence number"
          value={license}
          onChangeText={setLicense}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!state.busy}
        />
        <Button
          label={profile?.licenseNumber ? 'Update licence' : 'Save licence'}
          variant={profile?.licenseNumber ? 'secondary' : 'primary'}
          disabled={!license.trim() || state.busy}
          onPress={() => void controller.saveLicense(license)}
        />
      </View>

      <View style={styles.step}>
        <View style={styles.stepHead}>
          <Text variant="heading" style={{ flex: 1 }}>
            Vehicle
          </Text>
          <Status value={vehicleStatus} />
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Make" value={car.make} placeholder="Toyota" editable={!state.busy}
              onChangeText={(make) => setCar({ ...car, make })} />
          </View>
          <View style={styles.half}>
            <Input label="Model" value={car.model} placeholder="Corolla" editable={!state.busy}
              onChangeText={(model) => setCar({ ...car, model })} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Year" value={car.year} keyboardType="number-pad" maxLength={4}
              editable={!state.busy} onChangeText={(year) => setCar({ ...car, year })} />
          </View>
          <View style={styles.half}>
            <Input label="Colour" value={car.color} placeholder="Silver" editable={!state.busy}
              onChangeText={(color) => setCar({ ...car, color })} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Plate number" value={car.plateNumber} autoCapitalize="characters"
              autoCorrect={false} editable={!state.busy}
              onChangeText={(plateNumber) => setCar({ ...car, plateNumber })} />
          </View>
          <View style={styles.half}>
            <Input label="Passenger seats" value={car.seats} keyboardType="number-pad"
              maxLength={2} editable={!state.busy}
              onChangeText={(seats) => setCar({ ...car, seats })} />
          </View>
        </View>
        <Text variant="label">Ride type</Text>
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Ride type">
          {categories.map((category) => {
            const checked = car.vehicleType === category;
            return (
              <Pressable
                key={category}
                accessibilityRole="radio"
                accessibilityState={{ checked, disabled: state.busy }}
                disabled={state.busy}
                onPress={() => setCar({ ...car, vehicleType: category })}
                style={[styles.type, checked && styles.typeOn]}
              >
                <Text variant="label" style={checked && { color: colors.brand }}>
                  {categoryLabels[category]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {problem && <Text tone="error">{problem}</Text>}
        {vehicle && (
          <Text variant="caption" tone="secondary">
            Changing your licence or vehicle sends it for approval again.
          </Text>
        )}
        <Button
          label={vehicle ? 'Update vehicle' : 'Save vehicle'}
          variant={vehicle ? 'secondary' : 'primary'}
          loading={state.busy}
          onPress={saveVehicle}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 140 },
  type: {
    flex: 1,
    minHeight: size.touch,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  typeOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  notice: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
  },
});
