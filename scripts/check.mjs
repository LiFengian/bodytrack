import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const scripts=['dist/app.mjs','dist/core.mjs','dist/store.mjs','dist/sw.js','scripts/serve.mjs'];
for(const p of scripts){const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL(p,root))],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
const manifest=JSON.parse(await readFile(new URL('dist/manifest.webmanifest',root),'utf8'));
for(const p of manifest.icons)assert((await stat(new URL(`dist/${p.src}`,root))).size>0);
const sw=await readFile(new URL('dist/sw.js',root),'utf8');
const assets=sw.match(/const ASSETS=\[([^;]+)\];/)[1].match(/'[^']+'/g).map(s=>s.slice(1,-1));
for(const p of assets)assert((await stat(new URL(`dist/${p==='./'?'index.html':p}`,root))).size>0,`Missing offline asset: ${p}`);
for(const p of await readdir(new URL('dist/schemas/',root)))JSON.parse(await readFile(new URL(`dist/schemas/${p}`,root),'utf8'));
console.log(`Syntax, ${assets.length} offline assets, manifest and JSON schemas checked.`);
