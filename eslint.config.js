import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            globals: {
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                navigator: 'readonly',
                URL: 'readonly',
                console: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLButtonElement: 'readonly',
                MouseEvent: 'readonly',
                Node: 'readonly',
                HTMLElement: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                AbortController: 'readonly',
                Event: 'readonly',
                PointerEvent: 'readonly',
                MutationObserver: 'readonly',
                location: 'readonly',
                FileReader: 'readonly',
                Blob: 'readonly',
                XMLHttpRequest: 'readonly',
                XMLSerializer: 'readonly',
                getComputedStyle: 'readonly',
                performance: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                queueMicrotask: 'readonly',
                self: 'readonly',
            },
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            'react-hooks': reactHooks,
        },
        rules: {
            ...typescript.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            'react-hooks/exhaustive-deps': 'warn',
            'no-undef': 'error',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'public/**'],
    }
];
