import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import importX from 'eslint-plugin-import-x';
import checkFile from 'eslint-plugin-check-file';

/**
 * features 清单：新增一个 feature 时必须同步加到这里，
 * 否则「feature 之间禁止互相导入」的约束对该 feature 不生效。
 */
const FEATURES = [
  'account',
  'analytics',
  'answering',
  'auth',
  'editor',
  'logs',
  'members',
  'publish',
  'questionnaire',
  'responses',
  'workspace',
];

/** 共享层：不得反向依赖 features 或 app */
const SHARED = [
  './src/components',
  './src/config',
  './src/hooks',
  './src/lib',
  './src/types',
  './src/utils',
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // 本项目新增：
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    // Prisma 生成的客户端代码
    'src/generated/**',
  ]),

  {
    plugins: { 'import-x': importX, 'check-file': checkFile },
    /**
     * import-x 内置的 node resolver 默认只认 .js/.mjs/.cjs/.json/.node，
     * 既解析不了本项目的无扩展名 .ts/.tsx 导入，也不认 tsconfig 的 `@/*` 别名 ——
     * 解析失败时 `no-restricted-paths` 会静默跳过（规则里直接 return），
     * 于是「反向依赖禁止」这条红线长期没有守卫。
     * 这两个选项（extensions + tsconfig）把它补回来；不需要额外安装 resolver 包。
     */
    settings: {
      'import-x/resolver': {
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
          tsconfig: { configFile: './tsconfig.json' },
        },
      },
    },
    rules: {
      // 单向依赖：app -> features -> shared，反向禁止
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            // 1. 禁止跨 feature 导入
            ...FEATURES.map((feature) => ({
              target: `./src/features/${feature}`,
              from: './src/features',
              except: [`./${feature}`],
            })),
            // 2. features 不得依赖 app
            { target: './src/features', from: './src/app' },
            // 3. shared 不得依赖 features 或 app
            { target: SHARED, from: ['./src/features', './src/app'] },
          ],
        },
      ],

      // 禁止 barrel 文件
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/index'],
              message:
                '禁止 barrel 文件：请直接从具体文件导入，例如 @/features/comments/api/get-comments。',
            },
          ],
        },
      ],

      // 命名：文件与目录 kebab-case（__tests__ 目录除外）
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      // 只约束业务目录：src/app 下的 Next 路由约定（(route-group)、[param]、
      // _private）与 kebab-case 天然冲突，因此不在命名规则的管辖范围内。
      'check-file/folder-naming-convention': [
        'error',
        {
          'src/features/**/!(__tests__)': 'KEBAB_CASE',
          'src/components/**/!(__tests__)': 'KEBAB_CASE',
          'src/hooks/**/!(__tests__)': 'KEBAB_CASE',
          'src/lib/**/!(__tests__)': 'KEBAB_CASE',
          'src/stores/**/!(__tests__)': 'KEBAB_CASE',
          'src/types/**/!(__tests__)': 'KEBAB_CASE',
          'src/utils/**/!(__tests__)': 'KEBAB_CASE',
        },
      ],
    },
  },

  // 必须放最后：关掉所有与 Prettier 冲突的格式化规则
  prettier,
]);

export default eslintConfig;
