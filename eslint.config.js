'use strict';

const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**', 'dist/**', 'vendor/**']
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
                importScripts: 'readonly'
            }
        },
        rules: {
            'no-constant-condition': 'error',
            'no-debugger': 'error',
            'no-dupe-else-if': 'error',
            'no-fallthrough': 'error',
            'no-global-assign': 'error',
            'no-redeclare': 'error',
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^(_|error$)',
                    varsIgnorePattern: '^_'
                }
            ]
        }
    },
    {
        files: ['src/content/**/*.js', 'src/popup/**/*.js'],
        languageOptions: {
            globals: {
                Chartist: 'readonly',
                Constants: 'readonly',
                CandidateUtils: 'readonly',
                CsvUtils: 'readonly',
                DomUtils: 'readonly',
                I18n: 'readonly',
                RunStateUtils: 'readonly',
                SafetyWindow: 'readonly',
                UserDetection: 'readonly'
            }
        }
    },
    {
        files: ['src/shared/i18n.js'],
        languageOptions: {
            globals: { Constants: 'readonly' }
        }
    },
    {
        files: ['tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: globals.node
        },
        rules: {
            'no-debugger': 'error',
            'no-redeclare': 'error',
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
        }
    },
    {
        files: ['tests/e2e/**/*.js'],
        languageOptions: {
            globals: { chrome: 'readonly' }
        }
    }
];
