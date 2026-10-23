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

    // Node-run browser harness scripts (Playwright/Selenium)
    {
        files: ['tests/e2e/**/*.mjs'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },

);
