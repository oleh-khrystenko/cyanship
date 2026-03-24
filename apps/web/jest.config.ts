import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@cyanship/types$': '<rootDir>/../../packages/types/src/index.ts',
        '^@cyanship/types/agency$': '<rootDir>/../../packages/types/src/agency.ts',
    },
    testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
