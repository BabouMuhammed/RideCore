import { normalizeGambianPhone } from './phone';
import type { Credentials, Registration } from '../../services/contracts';
export class FormError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}
export function validatePassword(password: string) {
  // Encode to UTF-8 explicitly to match bcrypt's backend byte limit without trimming.
  const bytes = Array.from(password).reduce(
    (n, c) =>
      n +
      ((c.codePointAt(0) ?? 0) <= 0x7f
        ? 1
        : (c.codePointAt(0) ?? 0) <= 0x7ff
          ? 2
          : (c.codePointAt(0) ?? 0) <= 0xffff
            ? 3
            : 4),
    0,
  );
  if (password.length < 8)
    throw new FormError('password', 'Use at least 8 characters.');
  if (password.length > 72 || bytes > 72)
    throw new FormError(
      'password',
      'This password is too long. Try a shorter password.',
    );
}
function email(value: string) {
  const result = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) || result.length > 254)
    throw new FormError('email', 'Enter a valid email address.');
  return result;
}
function phone(value: string) {
  try {
    return normalizeGambianPhone(value);
  } catch {
    throw new FormError(
      'phone',
      'Enter a valid Gambian number: 7 digits, or 9 digits starting with 87, 83 or 86.',
    );
  }
}
export function loginPayload(
  mode: 'email' | 'phone',
  identifier: string,
  password: string,
): Credentials {
  validatePassword(password);
  return mode === 'email'
    ? { email: email(identifier), password }
    : { phone: phone(identifier), password };
}
export function registrationPayload(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  accountType?: string;
}): Registration {
  for (const key of ['firstName', 'lastName'] as const)
    if (!input[key].trim() || input[key].trim().length > 120)
      throw new FormError(key, 'Enter a name between 1 and 120 characters.');
  validatePassword(input.password);
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: email(input.email),
    phone: phone(input.phone),
    password: input.password,
    accountType: input.accountType === 'driver' ? 'driver' : 'rider',
  };
}
