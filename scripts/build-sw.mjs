import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const index = await readFile('dist/index.html','utf8');
const assets = (await readdir('dist/assets')).filter(f=>!f.endsWith('.map')).map(f=>'/assets/'+f);
const wordpacks = (await readdir('dist/wordpacks'))
  .filter(f => /^core-academic-\d+\.json$/.test(f))
  .map(f => '/wordpacks/' + f);
const wordpackContents = await Promise.all(wordpacks.map(path => readFile('dist' + path)));
const files=['/','/index.html','/manifest.webmanifest','/icon.svg',...wordpacks,...assets];
const template=await readFile('public/sw.js','utf8');
const hash=createHash('sha256').update(index+assets.join('\n')+template).update(Buffer.concat(wordpackContents)).digest('hex').slice(0,12);
const output=template.replace(/const CACHE\s*=\s*[^;]+;/,`const CACHE = "cijian-shell-${hash}";`).replace(/const PRECACHE\s*=\s*\[[\s\S]*?\];/,`const PRECACHE = ${JSON.stringify(files)};`);
if(!output.includes(hash)||!assets.every(asset=>output.includes(asset))||!output.includes('cache.addAll(PRECACHE)'))throw new Error('Offline precache injection failed');
await writeFile('dist/sw.js',output);
console.log(`Offline shell: ${files.length} resources, build ${hash}`);
