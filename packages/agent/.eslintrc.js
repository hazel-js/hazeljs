module.exports = {
  extends: ['../../.eslintrc.js'],
  ignorePatterns: ['**/*.d.ts'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
