import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Reglas de los contratos compartidos.
 *
 * Las mismas que en la API: esto lo importan los dos lados, así que un `any`
 * que se cuele aquí aparece a la vez en el servidor y en la aplicación.
 */
export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylistic,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
