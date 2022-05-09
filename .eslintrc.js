module.exports = {
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  extends: ['plugin:editorconfig/all', 'eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['editorconfig', '@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
  },

  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:playwright/playwright-test',
      ],
      parserOptions: {
        project: ['./tsconfig.json'], // Specify it only for TypeScript files
      },
      rules: {
        'prettier/prettier': 'error',
      },
    },
  ],
};
