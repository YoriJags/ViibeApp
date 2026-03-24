/** @type {import('jest').Config} */
module.exports = {
  preset: undefined,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js}'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.config.test.js' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Silence native module imports that don't work in Node
    '^expo-.*': '<rootDir>/src/__tests__/__mocks__/expo.js',
    '^@expo/.*': '<rootDir>/src/__tests__/__mocks__/expo.js',
    '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__tests__/__mocks__/async-storage.js',
    '^socket\\.io-client$': '<rootDir>/src/__tests__/__mocks__/socket-io.js',
    '^@rnmapbox/maps$': '<rootDir>/src/__tests__/__mocks__/empty.js',
    '^@shopify/react-native-skia$': '<rootDir>/src/__tests__/__mocks__/empty.js',
    '^posthog-react-native$': '<rootDir>/src/__tests__/__mocks__/empty.js',
    '^react-native-.*': '<rootDir>/src/__tests__/__mocks__/empty.js',
    // Path aliases
    '^~/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/data/demoData.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
