import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Reglas de la API.
 *
 * Las mismas que en la aplicación, menos lo que sólo tiene sentido en Angular.
 * El análisis usa los tipos del proyecto, que es lo que permite ver los errores
 * que de verdad importan aquí: promesas sin esperar y valores `any` que se
 * cuelan desde las bibliotecas.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
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
