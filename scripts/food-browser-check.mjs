import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{webkit}=require(process.env.BODYTRACK_PLAYWRIGHT??'playwright');
const browser=await webkit.launch({headless:true,...(process.env.BODYTRACK_WEBKIT?{executablePath:process.env.BODYTRACK_WEBKIT}:{})});
const context=await browser.newContext({viewport:{width:393,height:852},timezoneId:'Asia/Shanghai',locale:'zh-CN'}),page=await context.newPage();
await context.addInitScript(()=>{
  const OriginalWorker=window.Worker;window.__photoWorkers=0;
  window.Worker=class extends OriginalWorker{
    constructor(...args){super(...args);this.photo=String(args[0]).includes('photo-worker.mjs');if(this.photo)window.__photoWorkers++;}
    postMessage(message,...args){
      if(this.photo&&window.__failNextPhoto){window.__failNextPhoto=false;setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{id:message.id,error:'测试：识别失败'}})),0);return;}
      return super.postMessage(message,...args);
    }
    terminate(){if(this.photo){window.__photoWorkers--;this.photo=false;}return super.terminate();}
  };
});
const outbound=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='http://127.0.0.1:4173')outbound.push(r.url());assert.equal(r.method(),'GET','Photo flow must not upload images');});
page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER',msg.text().slice(0,600));});
const artifacts=new URL('../artifacts/',import.meta.url);await mkdir(artifacts,{recursive:true});
const nav=async id=>page.locator(`.bottomnav [data-page="${id}"]`).click();
const action=async id=>{await page.locator(`[data-action="${id}"]:visible`).first().click();if(id==='photo-food')await page.locator('#modal[open] #album-food').waitFor({state:'attached'});};
const readState=()=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bodytrack-local');r.onsuccess=()=>{const db=r.result,q=db.transaction('vault').objectStore('vault').get('state');q.onsuccess=()=>{resolve(q.result);db.close();};};}));
try{
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.dashboard');await page.evaluate(async()=>await navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await nav('training');await action('start');assert.equal(await page.locator('[data-key="rpe"]:visible').count(),0);await action('effort-help');assert.match(await page.locator('#modal').innerText(),/还能做 3 次/);await action('close');await action('toggle-effort');assert(await page.locator('[data-key="rpe"]:visible').count()>0);
  await page.screenshot({path:fileURLToPath(new URL('training-effort-help.png',artifacts)),fullPage:true});
  console.log('PASS Plain-language effort help; optional advanced fields hidden by default');
  await nav('diet');await action('add-meal');await page.locator('#picker-query').fill('鸡胸');assert.equal(await page.locator('#picker-results .food-result').count(),2);await page.locator('#picker-results [data-action="pick-food"]').first().click();await page.locator('#f-grams').fill('150');await page.locator('[data-form="meal"] [type=submit]').click();await page.waitForSelector('#modal',{state:'hidden'});
  let data=await readState();assert.equal(data.meals[0].grams,150);assert.match(data.meals[0].source,/USDA/);assert.equal(data.meals[0].entryMethod,'catalog');assert.match(data.meals[0].sourceUrl,/fdc.nal.usda.gov/);
  console.log('PASS Search gym food, select cooked state, auto-calculate without entering nutrients');
  await action('add-meal');await page.locator('#picker-query').fill('生全蛋');await page.locator('#picker-results [data-action="pick-food"]').click();await page.locator('#f-portion').selectOption('0');assert.equal(await page.locator('#f-grams').inputValue(),'50');assert.equal(await page.locator('#f-measurement').inputValue(),'household-estimate');await page.locator('[data-form="meal"] [type=submit]').click();await page.waitForSelector('#modal',{state:'hidden'});
  data=await readState();assert.equal(data.meals[1].portionBasis,'household-estimate');assert.equal(data.meals[1].portionReference.grams,50);
  console.log('PASS USDA household portion converts to grams and is recorded as estimated');
  await page.screenshot({path:fileURLToPath(new URL('diet-presets-iphone.png',artifacts)),fullPage:true});
  const photo=fileURLToPath(new URL('food-assets/coffee-test.png',artifacts));
  await action('photo-food');await page.locator('#album-food').setInputFiles(photo);await page.waitForSelector('#photo-preview img');await action('run-photo');
  try{await page.waitForSelector('#photo-results .photo-candidate',{timeout:120000});}catch(e){console.log('PHOTO STATUS',await page.locator('#photo-status').innerText());console.log('TOAST',await page.locator('#toast').innerText());throw e;}
  const labels=await page.locator('#photo-results .photo-candidate').allTextContents();console.log('REAL PHOTO CANDIDATES',labels);
  assert(labels.slice(0,3).some(s=>s.includes('咖啡')),'Real coffee photo must suggest coffee in top 3');
  assert.equal((await readState()).meals.length,2,'Recognition alone must not record nutrition');
  assert.equal(await page.locator('#photo-preview img').count(),0);
  assert.equal(await page.locator('#album-food').inputValue(),'');assert.equal(await page.locator('#camera-food').inputValue(),'');
  assert(await page.locator('[data-action="run-photo"]').isDisabled());assert.equal(await page.evaluate(()=>window.__photoWorkers),0);
  assert.match(await page.locator('#photo-status').innerText(),/照片已清理/);
  assert(!JSON.stringify(await readState()).includes('data:image/'));
  console.log('PASS Recognition releases previews, selected files and worker memory; no photo in saved records');
  await page.screenshot({path:fileURLToPath(new URL('photo-real-inference-iphone.png',artifacts)),fullPage:true});
  await page.locator('[data-action="photo-candidate"][data-id="coffee"]').click();await page.locator('#modal [data-action="pick-food"]').click();await page.locator('#f-grams').fill('200');await page.locator('#f-measurement').selectOption('manual-estimate');await page.locator('[data-form="meal"] [type=submit]').click();await page.waitForSelector('#modal',{state:'hidden'});
  data=await readState();assert.equal(data.meals[2].entryMethod,'photo-confirmed');assert.equal(data.meals[2].portionBasis,'manual-estimate');assert.equal(data.meals[2].name,'黑咖啡 · 冲煮无糖无奶');
  console.log('PASS Real ONNX inference in WebKit; food and portion require confirmation before write');
  await context.setOffline(true);await page.reload();await page.waitForSelector('.dashboard');await nav('diet');await action('photo-food');await page.locator('#album-food').setInputFiles(photo);await page.waitForSelector('#photo-preview img');await action('run-photo');await page.waitForSelector('#photo-results .photo-candidate',{timeout:120000});
  assert.match((await page.locator('#photo-results').innerText()),/咖啡/);assert.equal((await readState()).meals.length,3);await context.setOffline(false);
  console.log('PASS Offline reload and real photo recognition from cached model/runtime, without upload');
  // Closing without recognition must release the selected image as well.
  await action('close');await action('photo-food');await page.locator('#album-food').setInputFiles(photo);await page.waitForSelector('#photo-preview img');await action('close');
  await page.waitForFunction(()=>!document.querySelector('#photo-preview img'));
  assert.equal(await page.locator('#album-food').inputValue(),'');assert.equal(await page.evaluate(()=>window.__photoWorkers),0);
  // Exercise the application's error/finally path, after real inference above.
  await action('photo-food');await page.locator('#album-food').setInputFiles(photo);await page.waitForSelector('#photo-preview img');
  await page.evaluate(()=>window.__failNextPhoto=true);await action('run-photo');
  await page.waitForFunction(()=>document.querySelector('#photo-status').textContent.includes('测试：识别失败'));
  assert.match(await page.locator('#photo-status').innerText(),/照片已清理/);
  assert.equal(await page.locator('#photo-preview img').count(),0);assert.equal(await page.locator('#album-food').inputValue(),'');assert.equal(await page.evaluate(()=>window.__photoWorkers),0);
  // A hidden/unloaded page must not keep selected photos, even before inference.
  await page.locator('#album-food').setInputFiles(photo);await page.waitForSelector('#photo-preview img');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert.equal(await page.locator('#photo-preview img').count(),0);assert.equal(await page.locator('#album-food').inputValue(),'');
  // Cancel while the worker's readiness check or initialization is pending.
  const canceled=await page.evaluate(async()=>{
    const {recognizePhoto,cancelPhotoRecognition}=await import('./photo.mjs');
    const result=recognizePhoto(new Float32Array(3*224*224)).then(()=>false,e=>e.name==='AbortError');cancelPhotoRecognition();return await result;
  });assert.equal(canceled,true);assert.equal(await page.evaluate(()=>window.__photoWorkers),0);
  // Cancel a running worker as well as the pending-readiness case.
  await page.evaluate(async()=>{const m=await import('./photo.mjs');window.__pendingPhoto=m.recognizePhoto(new Float32Array(3*224*224)).then(()=>false,e=>e.name==='AbortError');});
  await page.waitForFunction(()=>window.__photoWorkers===1);
  assert.equal(await page.evaluate(async()=>{const m=await import('./photo.mjs');m.cancelPhotoRecognition();return await window.__pendingPhoto;}),true);
  assert.equal(await page.evaluate(()=>window.__photoWorkers),0);
  const cacheState=await page.evaluate(async()=>{
    const module=await import('./photo.mjs');
    const old=await caches.open('bodytrack-photo-obsolete-test');await old.put('/obsolete-model',new Response('old'));
    const ready=await module.photoReady(),keys=await caches.keys(),photoKeys=keys.filter(k=>k.startsWith('bodytrack-photo-'));
    const cache=await caches.open(photoKeys[0]),requests=await cache.keys();
    return {ready,oldRemoved:!keys.includes('bodytrack-photo-obsolete-test'),photoCaches:photoKeys.length,hasModel:requests.some(r=>r.url.endsWith('/models/food-clip-q8.onnx')),hasPhoto:requests.some(r=>/data:|blob:|coffee-test|photo-preview/.test(r.url))};
  });
  assert.deepEqual(cacheState,{ready:true,oldRemoved:true,photoCaches:1,hasModel:true,hasPhoto:false});
  console.log('PASS Failure, close, pagehide and worker cancellation clean photos; the reusable model cache remains');
  assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS No image uploads, third-party network requests or JavaScript errors');
  await writeFile(new URL('food-browser-results.json',artifacts),JSON.stringify({engine:'WebKit',realImage:'scikit-image coffee.png',candidates:labels,checks:8,noImageUpload:true,transientPhotosReleased:true,modelCacheRetained:true,outboundRequests:outbound,errors},null,2));
}finally{await browser.close();}
