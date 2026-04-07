import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// ---------------------------------------------------------------------------
// Architectural import rules (FSD layering + core/agency boundary).
//
// Patterns are defined once and composed into the rule blocks below. ESLint
// flat config does NOT merge rules with the same id across blocks — the
// later block fully replaces the earlier one — so each block must list every
// pattern that should apply to the files it targets.
// ---------------------------------------------------------------------------

const NO_GLOBAL_STORES_LAYER = {
    group: ['@/stores/**', '**/src/stores/**'],
    message:
        'There is no global stores/ layer. Co-locate the store inside the slice that owns it (entities/, features/, or widgets/). See docs/conventions/modular-boundaries.md',
};

const CORE_MUST_NOT_IMPORT_AGENCY = {
    group: [
        '**/features/agency/**',
        '**/entities/agency/**',
        '**/widgets/agency/**',
        '**/(agency)/**',
    ],
    message:
        'Core modules must not import from agency. See docs/conventions/modular-boundaries.md',
};

const SHARED_MUST_NOT_IMPORT_HIGHER_LAYERS = {
    group: [
        '@/stores/**',
        '@/features/**',
        '@/widgets/**',
        '@/entities/**',
        '@/app/**',
    ],
    message:
        'shared/ is the lowest FSD layer and must not import from higher layers (stores, features, widgets, entities, app). Invert the dependency via an event bus or callback registration in shared/lib instead.',
};

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
    // Default block: applies to every file. Bans the global stores/ layer
    // and is the floor that more specific blocks build on.
    {
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [NO_GLOBAL_STORES_LAYER],
                },
            ],
        },
    },
    // Core code: also bans imports from the agency module. Agency files
    // themselves are excluded so they can freely import from each other.
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
                        NO_GLOBAL_STORES_LAYER,
                        CORE_MUST_NOT_IMPORT_AGENCY,
                    ],
                },
            ],
        },
    },
    // shared/ slice: lowest FSD layer; must not depend on anything above it.
    // Higher layers may depend on shared/, but never the reverse — otherwise
    // circular imports re-emerge and dynamic `import()` workarounds creep
    // back in. See `src/shared/lib/authEvents.ts` for the inversion pattern
    // that replaces such cycles.
    {
        files: ['src/shared/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [SHARED_MUST_NOT_IMPORT_HIGHER_LAYERS],
                },
            ],
        },
    },
];

export default eslintConfig;
