import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'node',
      testMatch: ['<rootDir>/src/__tests__/lib/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'jsdom',
      testMatch: ['<rootDir>/src/__tests__/api/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/db.ts',
    '!src/lib/redis.ts',
    '!src/lib/auth.ts',
  ],
};

export default config;
