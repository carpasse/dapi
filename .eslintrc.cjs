module.exports = {
  env: {
    browser: false,
    es2022: true,
    node: true
  },
  extends: ['ts-mailonline'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.eslint.json'],
    tsconfigRootDir: __dirname
  },
  plugins: ['import'],
  root: true,
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  rules: {
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    'prefer-arrow/prefer-arrow-functions': 'off'
  }
};
