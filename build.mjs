import { build } from 'esbuild';

const entries = [
  { entryPoints: ['es6/enscribe.js'],         name: 'enscribe' },
  { entryPoints: ['es6/enscribe-html5.js'],   name: 'enscribeHTML5' },
  { entryPoints: ['es6/enscribe-vimeo.js'],   name: 'enscribeVimeo' },
  { entryPoints: ['es6/enscribe-youtube.js'], name: 'enscribeYouTube' },
];

for (const { entryPoints, name } of entries) {
  await build({ entryPoints, bundle: true, format: 'esm',   outfile: `dist/${name}.esm.js`,   sourcemap: true, minify: false });
  await build({ entryPoints, bundle: true, format: 'iife',  outfile: `dist/${name}.iife.js`,  globalName: name, sourcemap: true, minify: false });
  await build({ entryPoints, bundle: true, format: 'cjs',   outfile: `dist/${name}.cjs.js`,   sourcemap: true, minify: false });
  // UMD isn’t a native esbuild target; use iife for browsers or cjs for Node.
}
