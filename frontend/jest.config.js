module.exports = {
  preset: 'jest-expo/android',
  resolver: '<rootDir>/tests/resolver.cjs',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  modulePathIgnorePatterns: ['<rootDir>/.verification/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?(-.*)?|@expo(nent)?/.*|@react-navigation/.*|react-native-.*|@gorhom/.*|lucide-react-native)/)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/types.ts'],
};
