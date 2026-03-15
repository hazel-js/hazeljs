module.exports = {
  root: true,
  ignorePatterns: ['src/ui/**', '**/dist/**', '**/ui-dist/**'],
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    'no-console': ['warn', { allow: ['error', 'warn'] }],
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
      parserOptions: { project: null },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
