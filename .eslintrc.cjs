/* ESLint 8 config — focalizzato sulla CORRETTEZZA (rules-of-hooks, ecc.),
 * non sullo stile. Le regole stilistiche rumorose sul codice legacy sono
 * declassate a warning o spente per non bloccare la CI. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    'dist', 'dev-dist', 'build', 'node_modules', 'public',
    'ios', 'android', 'coverage',
    '*.cjs', 'vite.config.ts', 'vitest.config.ts',
  ],
  rules: {
    // Correttezza React — questi restano ERRORI
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Rumore stilistico/legacy → warn o off
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-types': 'off', // deprecata; un cast legacy a Function
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': ['error', { checkLoops: false }],
    'prefer-const': 'warn',
  },
};
