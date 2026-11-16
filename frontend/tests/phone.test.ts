import {
  normalizeGambianPhone,
  maskGambianPhone,
  PhoneFormatError,
} from '../src/features/auth/phone';
import {
  loginPayload,
  registrationPayload,
  validatePassword,
} from '../src/features/auth/validation';
import { national } from './fixtures';
const migrated = [
  ['Africell', '87' + '7' + '0'.repeat(6)],
  ['QCell', '83' + '3' + '0'.repeat(6)],
  ['Comium', '86' + '6' + '0'.repeat(6)],
];
test.each(migrated)(
  '%s migrated national structure normalizes without changing digits',
  (_, value) => {
    expect(normalizeGambianPhone(value!)).toBe('+220' + value);
  },
);
test('a seven-digit Gambian number remains seven digits', () => {
  expect(normalizeGambianPhone(national)).toBe('+220' + national);
});
test.each(['+220', '00220'])(
  'explicit %s international form normalizes to the same identity',
  (prefix) => {
    expect(normalizeGambianPhone(prefix + national)).toBe('+220' + national);
  },
);
test('safe separators and surrounding spaces are tolerated', () => {
  expect(normalizeGambianPhone(' +220 (99) 000-00 ')).toBe('+220' + national);
});
test.each([
  '',
  ' ',
  '123',
  '9'.repeat(6),
  '9'.repeat(8),
  '9'.repeat(10),
  '89' + '9'.repeat(7),
  '00' + '0'.repeat(5),
  '+221' + national,
  national + 'x',
  national + '/',
  '+220+220' + national,
])('invalid phone input is rejected (%s)', (value) => {
  expect(() => normalizeGambianPhone(value)).toThrow(PhoneFormatError);
});
test('legacy digits are not automatically assigned a new operator prefix', () => {
  const legacy = '7' + '0'.repeat(6);
  expect(normalizeGambianPhone(legacy)).toBe('+220' + legacy);
});
test('registration, phone login and OTP/account representation share the same normalization', () => {
  const fields = {
    firstName: ' Test ',
    lastName: ' Rider ',
    email: ' RIDER@EXAMPLE.TEST ',
    phone: '99 000-00',
    password: 'test-only-password',
  };
  const registration = registrationPayload(fields);
  expect(registration).toEqual({
    ...fields,
    firstName: 'Test',
    lastName: 'Rider',
    email: 'rider@example.test',
    phone: '+220' + national,
    accountType: 'rider',
  });
  expect(loginPayload('phone', fields.phone, fields.password)).toEqual({
    phone: registration.phone,
    password: fields.password,
  });
  expect(maskGambianPhone(registration.phone)).toBe(
    maskGambianPhone(fields.phone),
  );
  expect(maskGambianPhone(registration.phone)).not.toContain(national);
});
test('email login sends exactly one identity and does not trim the password', () => {
  expect(loginPayload('email', ' RIDER@EXAMPLE.TEST ', ' password ')).toEqual({
    email: 'rider@example.test',
    password: ' password ',
  });
});
test.each(['firstName', 'lastName', 'email', 'phone', 'password'] as const)(
  'required registration %s is validated',
  (key) => {
    expect(() =>
      registrationPayload({
        firstName: 'Test',
        lastName: 'Rider',
        email: 'rider@example.test',
        phone: national,
        password: 'test-only-password',
        [key]: '',
      }),
    ).toThrow();
  },
);
test('password validation respects the backend UTF-8 byte limit', () => {
  expect(() => validatePassword('a'.repeat(72))).not.toThrow();
  expect(() => validatePassword('\u00e9'.repeat(37))).toThrow();
  expect(() => validatePassword('short')).toThrow();
});
