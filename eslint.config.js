import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    // Ignore build output and dependencies
    {
        ignores: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'],
    },

    // Base JS rules applied to all files
    js.configs.recommended,

    // TypeScript rules for src/
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.browser,
                chrome: 'readonly',
            },
        },
        rules: {
            // TypeScript strictness
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'error',

            // General code style
            'no-var': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'always'],
        },
    },

    // Looser rules for legacy JS source (pre-migration)
    // These files will be removed once migration to src/scripts/*.ts is complete.
    {
        files: ['scripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                chrome: 'readonly',
            },
        },
        rules: {
            'no-var': 'error',
            'prefer-const': 'warn',
            'eqeqeq': 'warn',
            // Downgraded to warn — known dead code to clean up during TS migration
            '@typescript-eslint/no-unused-vars': 'warn',
        },
    },
);
