import path from 'node:path';

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import boundaries from 'eslint-plugin-boundaries';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CONDICIONES = ['@maun/source', 'types', 'import', 'default'];

const PROHIBIDO_EN_TODO_EL_REPO = [
  { regex: '^@maun/web(/|$)', message: '@maun/web es la app: ningún paquete importa de ella.' },
  {
    regex: '(^|/)apps/',
    message: 'Nada importa código de apps/ por ruta. La dependencia va de apps hacia packages.',
  },
];

function prohibirImports(...patrones) {
  return prohibirImportsYNombres(patrones, []);
}

function prohibirImportsYNombres(patrones, nombres) {
  return {
    'no-restricted-imports': [
      'error',
      { patterns: [...PROHIBIDO_EN_TODO_EL_REPO, ...patrones], paths: nombres },
    ],
  };
}

function base(dir, tsconfigs) {
  const project = tsconfigs.map((tsconfig) => path.join(dir, tsconfig));

  return defineConfig(
    globalIgnores([
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/design-reference/**',
    ]),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
      languageOptions: { parserOptions: { project, tsconfigRootDir: dir } },
      plugins: { 'import-x': importX },
      settings: {
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            project: path.join(dir, 'tsconfig.json'),
            conditionNames: CONDICIONES,
          }),
        ],
      },
      rules: {
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
        'import-x/no-relative-packages': 'error',
        ...prohibirImports(),
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [js.configs.recommended],
      languageOptions: { globals: globals.node },
    },
    prettier,
  );
}

const react = defineConfig({
  files: ['**/*.{ts,tsx}'],
  extends: [reactHooks.configs.flat['recommended-latest']],
  languageOptions: { globals: globals.browser },
});

export function dominio(dir) {
  return defineConfig(
    base(dir, ['tsconfig.test.json']),
    {
      files: ['src/**/*.ts'],
      ignores: ['src/**/*.test.ts'],
      rules: prohibirImports({
        regex: '^(?!\\.{1,2}/)',
        message:
          '@maun/domain es lógica pura: sin framework, red ni base de datos. Solo imports relativos.',
      }),
    },
    {
      files: ['src/**/*.test.ts'],
      rules: prohibirImports({
        regex: '^(?!\\.{1,2}/|vitest$)',
        message: 'Los tests de @maun/domain solo usan vitest y el propio paquete.',
      }),
    },
  );
}

export function db(dir) {
  return defineConfig(base(dir, ['tsconfig.test.json']), globalIgnores(['src/database.types.ts']), {
    files: ['src/**/*.ts'],
    rules: prohibirImports(
      { regex: '^@maun/ui(/|$)', message: '@maun/db no conoce el sistema de diseño.' },
      { regex: '^react(-dom)?(/|$)', message: '@maun/db no depende de React.' },
    ),
  });
}

export function ui(dir) {
  return defineConfig(base(dir, ['tsconfig.test.json']), react, {
    files: ['src/**/*.{ts,tsx}'],
    rules: prohibirImports(
      {
        regex: '^@maun/',
        message:
          '@maun/ui no importa otros paquetes del monorepo: el sistema de diseño no conoce la app, el dominio ni la base.',
      },
      {
        regex: '^(@supabase|@tanstack)/',
        message: '@maun/ui es presentacional: los datos le llegan por props.',
      },
      { regex: '^react-router', message: '@maun/ui no navega: recibe callbacks.' },
    ),
  });
}

const SISTEMA_DE_DISENO = {
  regex: '^@maun/ui$',
  message: 'El sistema de diseño se consume a través de @/shared/ui.',
};

const ACCESO_A_DATOS = {
  regex: '^(@maun/db|@supabase/supabase-js)$',
  message: 'El acceso a Supabase vive en src/shared/api.',
};

const NAVEGAR_POR_EL_ROUTER = {
  name: 'react-router',
  importNames: ['Link', 'NavLink', 'useNavigate'],
  message:
    'Toda navegación pasa por la puerta de @/shared/lib: <Ir>, useIr y useVolver (ADR 0066). Link, NavLink y useNavigate del router solo viven en la puerta, en el coordinador y en los tests.',
};

const TRANSICIONES_DEL_ROUTER = {
  name: 'react-router',
  importNames: ['useViewTransitionState'],
  message:
    'Las transiciones las decide el coordinador de app/navegacion (ADR 0066). La del router arranca las suyas y las repite al volver, a sus espaldas.',
};

const SIN_VIEW_TRANSITION_DEL_ROUTER = [
  {
    selector: "JSXAttribute[name.name='viewTransition']",
    message:
      'Las transiciones las decide el coordinador de app/navegacion (ADR 0066), no la opción viewTransition del router.',
  },
  {
    selector: "Property[key.name='viewTransition']",
    message:
      'Las transiciones las decide el coordinador de app/navegacion (ADR 0066), no la opción viewTransition del router.',
  },
];

const LA_PUERTA_Y_EL_COORDINADOR = [
  'src/shared/lib/puerta.ts',
  'src/shared/lib/Ir.tsx',
  'src/app/navegacion/**/*.{ts,tsx}',
];

export function web(dir) {
  return defineConfig(
    base(dir, [
      'tsconfig.app.json',
      'tsconfig.node.json',
      'tsconfig.sw.json',
      'tsconfig.netlify.json',
    ]),
    react,
    {
      files: ['sw/**/*.ts'],
      languageOptions: { globals: globals.serviceworker },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      extends: [reactRefresh.configs.vite],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': dir,
        'boundaries/include': ['src/**/*'],
        'boundaries/elements': [
          { type: 'app', pattern: 'src/app', partialMatch: false },
          { type: 'pages', pattern: 'src/pages/*', capture: ['slice'], partialMatch: false },
          { type: 'features', pattern: 'src/features/*', capture: ['slice'], partialMatch: false },
          { type: 'entities', pattern: 'src/entities/*', capture: ['slice'], partialMatch: false },
          { type: 'shared', pattern: 'src/shared/*', capture: ['segmento'], partialMatch: false },
        ],
        'import/resolver': {
          typescript: {
            project: path.join(dir, 'tsconfig.app.json'),
            conditionNames: CONDICIONES,
          },
        },
      },
      rules: {
        'boundaries/dependencies': [
          'error',
          {
            default: 'disallow',
            message:
              'Frontera de capas (FSD): app > pages > features > entities > shared. Solo se importa hacia capas de abajo y un slice no importa a otro de su misma capa.',
            policies: [
              {
                from: { element: { type: 'app' } },
                allow: {
                  to: {
                    element: { types: { anyOf: ['pages', 'features', 'entities', 'shared'] } },
                  },
                },
              },
              {
                from: { element: { type: 'pages' } },
                allow: {
                  to: { element: { types: { anyOf: ['features', 'entities', 'shared'] } } },
                },
              },
              {
                from: { element: { type: 'features' } },
                allow: { to: { element: { types: { anyOf: ['entities', 'shared'] } } } },
              },
              {
                from: { element: { type: 'entities' } },
                allow: { to: { element: { type: 'shared' } } },
              },
              {
                from: { element: { type: 'shared' } },
                allow: { to: { element: { type: 'shared' } } },
              },
              {
                disallow: { to: { element: { fileInternalPath: '!index.{ts,tsx}' } } },
                message:
                  'Cada slice se importa por su API pública (index.ts), nunca por un archivo interno.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        ...prohibirImportsYNombres(
          [SISTEMA_DE_DISENO, ACCESO_A_DATOS],
          [NAVEGAR_POR_EL_ROUTER, TRANSICIONES_DEL_ROUTER],
        ),
        'no-restricted-syntax': ['error', ...SIN_VIEW_TRANSITION_DEL_ROUTER],
      },
    },
    {
      files: ['src/shared/ui/**/*.{ts,tsx}'],
      rules: prohibirImportsYNombres(
        [ACCESO_A_DATOS],
        [NAVEGAR_POR_EL_ROUTER, TRANSICIONES_DEL_ROUTER],
      ),
    },
    {
      files: ['src/shared/api/**/*.{ts,tsx}'],
      rules: prohibirImportsYNombres(
        [SISTEMA_DE_DISENO],
        [NAVEGAR_POR_EL_ROUTER, TRANSICIONES_DEL_ROUTER],
      ),
    },
    {
      files: [...LA_PUERTA_Y_EL_COORDINADOR, 'src/**/*.test.{ts,tsx}'],
      ignores: ['src/shared/ui/**', 'src/shared/api/**'],
      rules: prohibirImportsYNombres(
        [SISTEMA_DE_DISENO, ACCESO_A_DATOS],
        [TRANSICIONES_DEL_ROUTER],
      ),
    },
    {
      files: ['src/shared/ui/**/*.test.{ts,tsx}'],
      rules: prohibirImportsYNombres([ACCESO_A_DATOS], [TRANSICIONES_DEL_ROUTER]),
    },
    {
      files: ['src/shared/api/**/*.test.{ts,tsx}'],
      rules: prohibirImportsYNombres([SISTEMA_DE_DISENO], [TRANSICIONES_DEL_ROUTER]),
    },
  );
}
