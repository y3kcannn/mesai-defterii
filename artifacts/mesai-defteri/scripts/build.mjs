// Static PWA build: public/ -> dist/ with cache-busting and a visible version.
// - version: $APP_VERSION, else git short SHA (Netlify: $COMMIT_REF), else content hash
// - dist/index.html: local <script src>/<link href> get ?v=<version>, plus an inline
//   snippet that sets window.APP_VERSION and checks /version.json for new deploys
// - dist/sw.js: '__APP_VERSION__' replaced (new bytes => browser installs new SW)
// - dist/version.json written
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const dist = join(root, 'dist');

function contentHash(dir) {
  const h = createHash('sha256');
  const walk = d => readdirSync(d).sort().forEach(f => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else { h.update(f); h.update(readFileSync(p)); }
  });
  walk(dir);
  return h.digest('hex').slice(0, 8);
}

function gitSha() {
  const ref = process.env.COMMIT_REF || process.env.GITHUB_SHA;
  if (ref) return ref.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

const version = (process.env.APP_VERSION || gitSha() || contentHash(pub)).replace(/[^\w.-]/g, '');
// Görünen sürüm: 3.<yayın sırası>. GitHub Actions çalıştırma numarasından türetilir (49. yayın = 3.19).
const runNo = Number(process.env.GITHUB_RUN_NUMBER);
const label = process.env.APP_LABEL || (Number.isFinite(runNo) && runNo > 30 ? `3.${runNo - 30}` : 'dev');
const builtAt = new Date().toISOString();

rmSync(dist, { recursive: true, force: true });
cpSync(pub, dist, { recursive: true });
for (const f of readdirSync(dist)) if (f.endsWith('.php')) rmSync(join(dist, f));

// sw.js
const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__APP_VERSION__', version));

// version.json
writeFileSync(join(dist, 'version.json'), JSON.stringify({ version, label, builtAt }) + '\n');

// index.html
const idxPath = join(dist, 'index.html');
let html = readFileSync(idxPath, 'utf8');
html = html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")((?:\.\/|\/)[^"?#]+\.(?:js|css))(")/g,
  (_, a, path, b) => `${a}${path}?v=${version}${b}`);

const snippet = `<meta name="app-version" content="${version}">
<script>
window.APP_VERSION=${JSON.stringify(version)};window.APP_LABEL=${JSON.stringify(label)};window.APP_BUILT_AT=${JSON.stringify(builtAt)};
(function(){
  var V=window.APP_VERSION,K='app-update-reload';
  function reloadFor(v){try{if(sessionStorage.getItem(K)===v)return;sessionStorage.setItem(K,v);}catch(e){}location.reload();}
  function check(){
    if(navigator.onLine===false)return;
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(function(r){r&&r.update().catch(function(){});});
    fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.version&&j.version!==V)reloadFor(j.version);}).catch(function(){});
  }
  if('serviceWorker' in navigator){
    var had=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',function(){if(had)check();had=true;});
    window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(function(){});});
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check();});
  window.addEventListener('pageshow',function(e){if(e.persisted)check();});
  window.addEventListener('load',function(){setTimeout(check,1500);});
})();
</script>
`;
if (!html.includes('</head>')) throw new Error('index.html has no </head>');
html = html.replace('</head>', snippet + '</head>');
writeFileSync(idxPath, html);

// Every local file referenced by index.html and precached by sw.js must exist in dist
// (a removed/renamed file would otherwise only show up as a broken offline install).
const swSrc = readFileSync(swPath, 'utf8');
const shellList = swSrc.match(/const SHELL = \[([^\]]*)\]/);
if (!shellList) throw new Error('sw.js: SHELL list not found');
const refs = [
  ...[...html.matchAll(/\s(?:src|href)="\.\/([^"?#]+)/g)].map(m => m[1]),
  ...[...shellList[1].matchAll(/'([^']*)'/g)].map(m => m[1]).filter(Boolean),
];
const missing = [...new Set(refs)].filter(f => !existsSync(join(dist, f)));
if (missing.length) throw new Error('referenced but missing in dist: ' + missing.join(', '));
if (swSrc.includes('__APP_VERSION__')) throw new Error('sw.js: version placeholder not replaced');

console.log(`built dist/ version=${version} label=${label} builtAt=${builtAt}`);
if (!existsSync(join(dist, 'version.json'))) process.exit(1);
