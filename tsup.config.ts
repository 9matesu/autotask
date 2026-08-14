import { defineConfig } from 'tsup';

const stubOptionalDepsPlugin = {
  name: 'stub-optional-deps',
  setup(build: any) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => {
      return { path: 'react-devtools-core', namespace: 'stub-optional' };
    });
    build.onLoad({ filter: /.*/, namespace: 'stub-optional' }, () => {
      return {
        contents: 'export default undefined; export const connectToDevTools = () => {};',
        loader: 'js',
      };
    });
  },
};

export default defineConfig([
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    target: 'node20',
    clean: true,
    dts: false,
    splitting: false,
    banner: {
      js: `import { createRequire as __tsup_createRequire } from "node:module";\nconst require = __tsup_createRequire(import.meta.url);`,
    },
    // Bundle all dependencies (React 18, Ink, React-Reconciler, etc.) into the CLI
    // so that it never clashes with host project React versions (e.g. React 19 in Next.js apps)
    noExternal: [/(.*)/],
    esbuildPlugins: [stubOptionalDepsPlugin],
    sourcemap: false,
    minify: false,
    platform: 'node',
  },
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    target: 'node20',
    clean: false,
    dts: true,
    sourcemap: false,
    platform: 'node',
  },
]);
