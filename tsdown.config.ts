import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['es'],
  platform: 'node',
  sourcemap: true,
  fixedExtension: false,
})
