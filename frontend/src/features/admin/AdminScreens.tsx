import { useCallback, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { AdminTabParams } from '../../navigation/types';
import { Screen } from '../../components/layout/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/feedback/ConfirmationDialog';
import { colors, radius, space, size } from '../../theme/tokens';
import { useSession } from '../session/SessionProvider';
import { useAdmin, useAdminAction, useAdminResource } from './AdminProvider';
import type {
  AdminDriver,
  AdminOverview,
  AdminRide,
} from '../../services/admin-api';
import type { Verification } from '../../services/driver-api';

const readable = (s: string) =>
  s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : 'Not recorded';
const money = (amount: number | undefined, currency: string) =>
  amount === undefined ? 'Not recorded' : `${currency} ${amount.toFixed(2)}`;
export function Status({ value }: { value: string }) {
  return (
    <Text
      variant="caption"
      style={{
        color: [
          'rejected',
          'suspended',
          'disabled',
          'failed',
          'cancelled',
        ].includes(value)
          ? colors.error
          : colors.text,
      }}
    >
      {readable(value)}
    </Text>
  );
}
function AdminPage({ title, children }: PropsWithChildren<{ title: string }>) {
  const { session } = useSession();
  const [logout, setLogout] = useState(false);
  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLogout(true)}
          style={styles.link}
        >
          <Text variant="label">Sign out</Text>
        </Pressable>
      </View>
      {children}
      <ConfirmationDialog
        visible={logout}
        title="Sign out of administration?"
        description="Administrator information will be cleared from this device."
        confirmLabel="Confirm sign out"
        onConfirm={() => {
          setLogout(false);
          void session.logout();
        }}
        onCancel={() => setLogout(false)}
      />
    </Screen>
  );
}
function DataState({
  loading,
  error,
  refresh,
  empty,
  children,
}: PropsWithChildren<{
  loading: boolean;
  error?: string;
  refresh(): void;
  empty?: boolean;
}>) {
  return (
    <>
      {loading ? (
        <Text accessibilityLiveRegion="polite">Loading records…</Text>
      ) : error ? (
        <>
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
          <Button label="Try again" onPress={refresh} />
        </>
      ) : empty ? (
        <Text tone="secondary">
          No records on this page. New records will appear here when available.
        </Text>
      ) : (
        children
      )}
      {!loading && !error && (
        <Button label="Refresh records" variant="secondary" onPress={refresh} />
      )}
    </>
  );
}
function Pages({
  page,
  count,
  disabled,
  onPage,
}: {
  page: number;
  count: number;
  disabled: boolean;
  onPage(page: number): void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">Page {page} · Up to 50 records per page</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Previous"
            variant="secondary"
            disabled={disabled || page === 1}
            onPress={() => onPage(page - 1)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Next"
            variant="secondary"
            disabled={disabled || count < 50}
            onPress={() => onPage(page + 1)}
          />
        </View>
      </View>
    </View>
  );
}
function RecordBlock({ children }: PropsWithChildren) {
  return <View style={styles.record}>{children}</View>;
}
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text selectable>{value || 'Not recorded'}</Text>
    </View>
  );
}
function ActionFeedback({
  actions,
}: {
  actions: ReturnType<typeof useAdminAction>;
}) {
  return (
    <>
      {actions.notice && (
        <Text accessibilityLiveRegion="polite">{actions.notice}</Text>
      )}
      <ConfirmationDialog
        visible={!!actions.action}
        title={actions.action?.title ?? ''}
        description={actions.action?.description ?? ''}
        confirmLabel="Confirm change"
        destructive={actions.action?.destructive}
        pending={actions.busy}
        onConfirm={() => void actions.confirm()}
        onCancel={actions.cancel}
      />
    </>
  );
}
const metrics: {
  key: keyof AdminOverview;
  title: string;
  section: keyof AdminTabParams;
}[] = [
  { key: 'registeredRiders', title: 'Registered riders', section: 'Users' },
  { key: 'registeredDrivers', title: 'Registered drivers', section: 'Drivers' },
  {
    key: 'pendingDriverApprovals',
    title: 'Pending profile approvals',
    section: 'Drivers',
  },
  {
    key: 'onlineDrivers',
    title: 'Eligible online drivers',
    section: 'Drivers',
  },
  { key: 'activeRides', title: 'Active rides', section: 'Rides' },
  { key: 'completedRides', title: 'Completed rides', section: 'Rides' },
  { key: 'cancelledRides', title: 'Cancelled rides', section: 'Rides' },
  { key: 'recordedPayments', title: 'Recorded payments', section: 'Payments' },
];
export function AdminOverviewScreen() {
  const { api } = useAdmin(),
    navigation = useNavigation<NavigationProp<AdminTabParams>>();
  const resource = useAdminResource(
    useCallback((t: string, s: AbortSignal) => api.overview(t, s), [api]),
  );
  return (
    <AdminPage title="Administration">
      <Text tone="secondary">
        Review driver applications and monitor RideCore.
      </Text>
      <DataState {...resource}>
        {resource.data && (
          <View>
            {metrics.map((metric) => (
              <Pressable
                key={metric.key}
                accessibilityRole="button"
                accessibilityLabel={`${metric.title}: ${resource.data![metric.key]}`}
                onPress={() => navigation.navigate(metric.section)}
                style={styles.metric}
              >
                <Text style={{ flex: 1 }}>{metric.title}</Text>
                <Text variant="heading">{resource.data![metric.key]}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text variant="caption" tone="secondary">
          Global database totals. Online drivers have approved profiles and
          vehicles; this is not nearby GPS availability. Pending approvals count
          profiles, not vehicles. Payments are recorded transactions, not proof
          of money transferred.
        </Text>
      </DataState>
    </AdminPage>
  );
}
export function AdminDriversScreen() {
  const { api } = useAdmin(),
    actions = useAdminAction();
  const [page, setPage] = useState(1),
    [expanded, setExpanded] = useState<string | null>(null);
  const resource = useAdminResource(
    useCallback(
      (t: string, s: AbortSignal) => api.drivers(t, page, s),
      [api, page],
    ),
  );
  const verify = (
    driver: AdminDriver,
    kind: 'drivers' | 'vehicles',
    status: Exclude<Verification, 'pending'>,
  ) => {
    const resourceId = kind === 'drivers' ? driver._id : driver.vehicle?._id;
    if (!resourceId) return;
    actions.choose({
      title: `${readable(status)} ${kind === 'drivers' ? 'driver profile' : 'vehicle'}?`,
      description: `${driver.account ? driver.account.firstName + ' ' + driver.account.lastName : driver.user}. Profile and vehicle approval are separate. This action keeps the driver offline.`,
      destructive: status !== 'approved',
      work: (t, s) => api.verify(t, kind, resourceId, status, s),
    });
  };
  return (
    <AdminPage title="Drivers">
      <Text tone="secondary">
        Review self-reported details. Both profile and vehicle approval are
        needed to drive.
      </Text>
      <ActionFeedback actions={actions} />
      <DataState {...resource} empty={resource.data?.length === 0}>
        {resource.data?.map((driver) => (
          <RecordBlock key={driver._id}>
            <Text variant="heading">
              {driver.account
                ? `${driver.account.firstName} ${driver.account.lastName}`
                : 'Account unavailable'}
            </Text>
            <Text>
              Profile: {readable(driver.verificationStatus)} ·{' '}
              {readable(driver.availabilityStatus)}
            </Text>
            <Text>
              Vehicle:{' '}
              {driver.vehicle
                ? readable(driver.vehicle.verificationStatus)
                : 'Not submitted'}
            </Text>
            <Text>
              Account:{' '}
              {driver.account
                ? driver.account.isActive
                  ? 'Active'
                  : 'Disabled'
                : 'Unavailable'}
            </Text>
            <Button
              label={
                expanded === driver._id
                  ? 'Close application'
                  : 'Review application'
              }
              variant="secondary"
              disabled={actions.busy}
              accessibilityLabel={`Review application ${driver.account?.firstName ?? driver.user}`}
              onPress={() =>
                setExpanded(expanded === driver._id ? null : driver._id)
              }
            />
            {expanded === driver._id && (
              <>
                <Field label="Licence number" value={driver.licenseNumber} />
                <Field label="Driver account ID" value={driver.user} />
                <Text variant="label">Profile decision</Text>
                {(['approved', 'rejected', 'suspended'] as const).map(
                  (status) => (
                    <Button
                      key={status}
                      variant="secondary"
                      label={`${status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Suspend'} profile`}
                      disabled={
                        actions.busy ||
                        !driver.account ||
                        (status === 'approved' && !driver.licenseNumber) ||
                        driver.verificationStatus === status
                      }
                      onPress={() => verify(driver, 'drivers', status)}
                    />
                  ),
                )}
                {!driver.licenseNumber && (
                  <Text tone="secondary">
                    A licence number is required before profile approval.
                  </Text>
                )}
                <Text variant="label">Vehicle decision</Text>
                {driver.vehicle ? (
                  <>
                    <Field
                      label="Vehicle"
                      value={`${driver.vehicle.year ?? ''} ${driver.vehicle.make} ${driver.vehicle.model}`}
                    />
                    <Field
                      label="Colour / plate"
                      value={[driver.vehicle.color, driver.vehicle.plateNumber]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                    <Field
                      label="Category / seats"
                      value={`${driver.vehicle.vehicleType ?? 'Unknown'} · ${driver.vehicle.seats ?? 'Unknown'} seats`}
                    />
                    {(['approved', 'rejected', 'suspended'] as const).map(
                      (status) => (
                        <Button
                          key={status}
                          variant="secondary"
                          label={`${status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Suspend'} vehicle`}
                          disabled={
                            actions.busy ||
                            !driver.account ||
                            driver.vehicle!.verificationStatus === status
                          }
                          onPress={() => verify(driver, 'vehicles', status)}
                        />
                      ),
                    )}
                  </>
                ) : (
                  <Text tone="secondary">No vehicle has been submitted.</Text>
                )}
              </>
            )}
          </RecordBlock>
        ))}
      </DataState>
      <Pages
        page={page}
        count={resource.data?.length ?? 0}
        disabled={resource.loading || actions.busy || !!resource.error}
        onPage={(n) => {
          setPage(n);
          setExpanded(null);
        }}
      />
    </AdminPage>
  );
}
function RideFields({ ride }: { ride: AdminRide }) {
  return (
    <>
      <Status value={ride.status} />
      <Field label="Pickup" value={ride.pickup} />
      <Field label="Destination" value={ride.destination} />
      <Field
        label="Fare"
        value={`${money(ride.fare, ride.currency)} · ${ride.status === 'completed' ? 'Final' : 'Estimated'}`}
      />
      <Field label="Category" value={ride.vehicleType} />
    </>
  );
}
function RideDetail({ id, back }: { id: string; back(): void }) {
  const { api } = useAdmin();
  const resource = useAdminResource(
    useCallback((t: string, s: AbortSignal) => api.ride(t, id, s), [api, id]),
  );
  return (
    <>
      <Button label="Back to rides" variant="secondary" onPress={back} />
      <DataState {...resource}>
        {resource.data && (
          <>
            <Field label="Ride ID" value={resource.data._id} />
            <RideFields ride={resource.data} />
            <Field
              label="Rider"
              value={resource.data.riderName ?? resource.data.rider}
            />
            <Field
              label="Driver"
              value={
                resource.data.driverName ??
                resource.data.driver ??
                'Not assigned'
              }
            />
            {resource.data.vehicle && (
              <Field label="Vehicle" value={resource.data.vehicle} />
            )}
            {resource.data.timestamps.map((stamp) => (
              <Field
                key={stamp.label}
                label={readable(stamp.label)}
                value={date(stamp.value)}
              />
            ))}
          </>
        )}
      </DataState>
    </>
  );
}
export function AdminRidesScreen() {
  const { api } = useAdmin();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const resource = useAdminResource(
    useCallback(
      (t: string, s: AbortSignal) => api.rides(t, page, s),
      [api, page],
    ),
  );
  return (
    <AdminPage title="Rides">
      {selected ? (
        <RideDetail id={selected} back={() => setSelected(null)} />
      ) : (
        <>
          <Text tone="secondary">
            Monitor requests and trips. Drivers control trip progress.
          </Text>
          <DataState {...resource} empty={resource.data?.length === 0}>
            {resource.data?.map((ride) => (
              <RecordBlock key={ride._id}>
                <RideFields ride={ride} />
                <Text variant="caption">
                  Requested:{' '}
                  {date(
                    ride.timestamps.find((t) => t.label === 'requested')?.value,
                  )}
                </Text>
                <Field label="Ride ID" value={ride._id} />
                <Button
                  label="View trip"
                  variant="secondary"
                  accessibilityLabel={`View trip ${ride._id}`}
                  onPress={() => setSelected(ride._id)}
                />
              </RecordBlock>
            ))}
          </DataState>
          <Pages
            page={page}
            count={resource.data?.length ?? 0}
            disabled={resource.loading || !!resource.error}
            onPage={setPage}
          />
        </>
      )}
    </AdminPage>
  );
}
export function AdminUsersScreen() {
  const { api } = useAdmin(),
    actions = useAdminAction();
  const [page, setPage] = useState(1);
  const resource = useAdminResource(
    useCallback(
      (t: string, s: AbortSignal) => api.users(t, page, s),
      [api, page],
    ),
  );
  return (
    <AdminPage title="Accounts">
      <Text tone="secondary">
        Manage rider and driver access. Accounts with active rides cannot be
        changed.
      </Text>
      <ActionFeedback actions={actions} />
      <DataState {...resource} empty={resource.data?.length === 0}>
        {resource.data?.map((user) => (
          <RecordBlock key={user._id}>
            <Text variant="heading">
              {user.firstName} {user.lastName}
            </Text>
            <Text>{readable(user.role)}</Text>
            <Status value={user.isActive ? 'active' : 'disabled'} />
            <Field label="Email" value={user.email} />
            <Field label="Phone" value={user.phone} />
            <Field label="Account ID" value={user._id} />
            {['rider', 'driver'].includes(user.role) ? (
              <Button
                label={user.isActive ? 'Disable account' : 'Restore account'}
                variant="secondary"
                disabled={actions.busy}
                onPress={() =>
                  actions.choose({
                    title: `${user.isActive ? 'Disable' : 'Restore'} account?`,
                    description: `${user.firstName} ${user.lastName}. Restoring access does not put a driver online.`,
                    destructive: user.isActive,
                    work: (t, s) =>
                      api.setActive(t, user._id, !user.isActive, s),
                  })
                }
              />
            ) : (
              <Text variant="caption">Administrator account · Read only</Text>
            )}
          </RecordBlock>
        ))}
      </DataState>
      <Pages
        page={page}
        count={resource.data?.length ?? 0}
        disabled={resource.loading || actions.busy || !!resource.error}
        onPage={setPage}
      />
    </AdminPage>
  );
}
export function AdminPaymentsScreen() {
  const { api } = useAdmin();
  const [page, setPage] = useState(1);
  const resource = useAdminResource(
    useCallback(
      (t: string, s: AbortSignal) => api.payments(t, page, s),
      [api, page],
    ),
  );
  return (
    <AdminPage title="Payment records">
      <Text tone="secondary">
        Simulated payment records. These entries do not confirm a real
        collection or money transfer.
      </Text>
      <DataState {...resource} empty={resource.data?.length === 0}>
        {resource.data?.map((payment) => (
          <RecordBlock key={payment._id}>
            <Text variant="heading">
              {money(payment.amount, payment.currency)}
            </Text>
            <Status value={payment.status} />
            <Text>
              {payment.method === 'mock_wallet' ? 'Mock wallet' : 'Cash'} ·
              Simulated record
            </Text>
            <Field label="Reference" value={payment.transactionReference} />
            <Field label="Ride ID" value={payment.ride} />
            <Field label="Payment ID" value={payment._id} />
            <Field label="Recorded" value={date(payment.createdAt)} />
            <Field label="Paid at" value={date(payment.paidAt)} />
          </RecordBlock>
        ))}
      </DataState>
      <Pages
        page={page}
        count={resource.data?.length ?? 0}
        disabled={resource.loading || !!resource.error}
        onPage={setPage}
      />
    </AdminPage>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  link: {
    minHeight: size.touch,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  record: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.touch + space.md,
    gap: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: space.md,
  },
});
