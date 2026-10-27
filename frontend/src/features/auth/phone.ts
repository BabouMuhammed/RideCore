export const gambia = {
  callingCode: '+220',
  countryName: 'The Gambia',
} as const;
export class PhoneFormatError extends Error {
  constructor() {
    super(
      'Enter a valid Gambian phone number: 7 digits, or 9 digits starting with 87, 83 or 86.',
    );
  }
}
// Structural validation during the migration. Never infer an operator or add digits.
export function normalizeGambianPhone(input: string): string {
  if (!input.trim() || !/^[+\d\s()-]+$/.test(input))
    throw new PhoneFormatError();
  let national = input.replace(/[\s()-]/g, '');
  if (national.startsWith('+220')) national = national.slice(4);
  else if (national.startsWith('00220')) national = national.slice(5);
  if (!/^(?:[2-9]\d{6}|(?:87|83|86)[2-9]\d{6})$/.test(national))
    throw new PhoneFormatError();
  return gambia.callingCode + national;
}
export function maskGambianPhone(input: string): string {
  try {
    const number = normalizeGambianPhone(input).slice(4);
    return '+220 ' + '\u2022'.repeat(number.length - 3) + number.slice(-3);
  } catch {
    return 'your registered phone number';
  }
}
