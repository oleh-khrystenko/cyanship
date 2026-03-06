import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
    {
        ignores: [
            'src/app/**/\\(agency\\)/**',
            'src/features/agency/**',
            'src/entities/agency/**',
            'src/widgets/agency/**',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '**/features/agency/**',
                                '**/entities/agency/**',
                                '**/widgets/agency/**',
                                '**/(agency)/**',
                            ],
                            message:
                                'Core modules must not import from agency. See docs/conventions/modular-boundaries.md',
                        },
                    ],
                },
            ],
        },
    },
];

export default eslintConfig;
