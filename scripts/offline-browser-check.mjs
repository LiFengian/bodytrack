// Reproduce the production host's canonical index.html redirect and failed
// downloads without changing the published site or using personal records.
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{webkit}=require(process.env.BODYTRACK_PLAYWRIGHT??'playwright');
const root=fileURLToPath(new URL('../dist/',import.meta.url)),artifacts=new URL('../artifacts/',import.meta.url);
await mkdir(artifacts,{recursive:true});
const originalWorker=await readFile(path.join(root,'sw.js'),'utf8');
let worker=originalWorker,failAsset=false,indexRedirects=0;
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/index.html'){indexRedirects++;res.writeHead(308,{Location:'/'}).end();return;}
    if(failAsset&&pathname==='/icons/icon-512.png'){res.writeHead(503).end('test interruption');return;}
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root)){res.writeHead(403).end();return;}
    const body=pathname==='/sw.js'?worker:await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await webkit.launch({headless:true,...(process.env.BODYTRACK_WEBKIT?{executablePath:process.env.BODYTRACK_WEBKIT}:{})});
const checks=[],errors=[];
const pass=message=>{checks.push(message);console.log('PASS',message);};
const open=async(options={})=>{
  const context=await browser.newContext({viewport:{width:393,height:852},locale:'zh-CN',...options});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
};
const ready=async page=>{await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.locator('.bottomnav [data-page="profile"]').click();await page.locator('[data-action="check-offline"]').click();try{await page.waitForFunction(()=>document.querySelector('[data-offline]')?.textContent.includes('已就绪'));}catch(e){console.log(JSON.stringify(await page.evaluate(async()=>({status:document.querySelector('[data-offline]')?.textContent,body:document.body.innerText.slice(-500),workers:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,waiting:r.waiting?.state})),caches:await Promise.all((await caches.keys()).map(async k=>({name:k,paths:(await (await caches.open(k)).keys()).map(r=>r.url)})))}))));throw e;}};
const state=page=>page.evaluate(async()=>{const {LocalStore}=await import('./store.mjs'),store=new LocalStore();await store.open();const s=store.state;store.db.close();return s;});
try{
  const {context,page}=await open();
  await page.goto(base+'index.html');await page.waitForSelector('.dashboard');await ready(page);
  assert.equal(indexRedirects,1,'SW must not request redirected index.html');
  const cached=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('bodytrack-shell-'));return (await (await caches.open(name)).keys()).map(r=>new URL(r.url).pathname);});
  assert.equal(cached.length,13);assert(cached.includes('/'));assert(!cached.includes('/index.html'));
  pass('Canonical index.html redirect no longer prevents complete shell installation');
  await page.evaluate(async()=>{await (await caches.open('bodytrack-photo-test')).put('./models/food-labels.json',await fetch('./models/food-labels.json'));});
  await page.locator('.bottomnav [data-page="training"]').click();await page.locator('[data-action="start"]').first().click();
  await page.locator('[data-key="reps"]').first().fill('7');await page.locator('[data-key="reps"]').first().blur();
  const saved=await state(page);assert.equal(saved.sessions[0].exercises[0].sets[0].reps,7);
  await context.setOffline(true);await page.close();
  const cold=await context.newPage();cold.on('pageerror',e=>errors.push(e.message));
  await cold.goto(base+'?from=home-screen');await cold.waitForSelector('.dashboard');
  assert.deepEqual((await state(cold)).sessions,saved.sessions);
  await cold.locator('.bottomnav [data-page="diet"]').click();await cold.locator('[data-action="add-meal"]').first().click();await cold.waitForSelector('#picker-results [data-action="pick-food"]');
  pass('Offline cold window opens with training records and built-in food catalog');
  await cold.locator('[data-action="close"]').first().click();await context.setOffline(false);
  // A failed replacement must leave the previously activated shell available.
  failAsset=true;worker=originalWorker.replace(/bodytrack-shell-[a-f0-9]+/,'bodytrack-shell-interrupted-test');
  await cold.evaluate(async()=>{window.failedUpdate=new Promise(resolve=>navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OFFLINE_INSTALL_FAILED')resolve(e.data);},{once:true}));await (await navigator.serviceWorker.getRegistration()).update();});
  const failure=await cold.evaluate(()=>window.failedUpdate);assert.equal(failure.asset,'./icons/icon-512.png');
  await cold.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).installing);
  await context.setOffline(true);await cold.reload();await cold.waitForSelector('.dashboard');assert.deepEqual((await state(cold)).sessions,saved.sessions);
  pass('Interrupted update preserves working offline shell and saved training');
  await context.setOffline(false);failAsset=false;
  await cold.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await cold.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  await cold.locator('.bottomnav [data-page="profile"]').click();await cold.locator('[data-action="update"]').click();await cold.waitForSelector('.dashboard');await ready(cold);
  assert.deepEqual((await state(cold)).sessions,saved.sessions);
  const keys=await cold.evaluate(()=>caches.keys());assert.equal(keys.filter(k=>k.startsWith('bodytrack-shell-')).length,1);assert(keys.includes('bodytrack-photo-test'));
  assert(await cold.evaluate(async()=>!!await (await caches.open('bodytrack-photo-test')).match('./models/food-labels.json')));
  pass('Successful update keeps records and optional photo-model cache, removes old shells');
  await context.close();
  // Test a first install failure, then the user's explicit retry.
  failAsset=true;const retry=await open();await retry.page.goto(base);await retry.page.waitForSelector('.dashboard');await retry.page.locator('.bottomnav [data-page="profile"]').click();
  await retry.page.waitForFunction(()=>document.querySelector('[data-offline]')?.textContent.includes('离线准备失败'));
  await retry.page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration())?.installing);
  failAsset=false;await retry.page.locator('[data-action="check-offline"]').click();await ready(retry.page);
  pass('Failed first installation reports failure and the check button retries successfully');
  await retry.context.close();
  // A hung food request must not block the database or destroy an active input.
  const delayed=await open({serviceWorkers:'block'});let releaseCatalog;
  const catalogGate=new Promise(resolve=>releaseCatalog=resolve);
  await delayed.context.route('**/foods.json',async route=>{await catalogGate;await route.fulfill({contentType:'application/json',body:await readFile(path.join(root,'foods.json'))});});
  await delayed.page.goto(base,{waitUntil:'domcontentloaded'});await delayed.page.waitForSelector('.dashboard',{timeout:2000});
  await delayed.page.locator('.bottomnav [data-page="training"]').click();await delayed.page.locator('[data-action="start"]').first().click();
  const input=delayed.page.locator('[data-key="reps"]').first();await input.fill('8');
  releaseCatalog();await delayed.page.waitForResponse('**/foods.json');
  // A subsequent picker confirms the asynchronous catalog has been processed.
  await delayed.page.locator('.bottomnav [data-page="diet"]').click();await delayed.page.locator('[data-action="add-meal"]').first().click();await delayed.page.waitForSelector('#picker-results [data-action="pick-food"]');
  await delayed.page.locator('[data-action="close"]').first().click();await delayed.page.locator('.bottomnav [data-page="training"]').click();assert.equal(await delayed.page.locator('[data-key="reps"]').first().inputValue(),'8');
  pass('Stalled catalog does not block startup or overwrite training input when it arrives');
  await delayed.context.close();assert.deepEqual(errors,[]);
  await writeFile(new URL('offline-browser-results.json',artifacts),JSON.stringify({engine:'WebKit',checks,errors},null,2));
  console.log(`Offline regression: ${checks.length} checks passed.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
