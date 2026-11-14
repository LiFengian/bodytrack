// Optional integration checks. Install Playwright separately or point
// BODYTRACK_PLAYWRIGHT at an existing Playwright module. No browser dependency
// is shipped to the application or required by the domain tests.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as C from '../dist/core.mjs';
const require=createRequire(import.meta.url);
const {webkit}=require(process.env.BODYTRACK_PLAYWRIGHT??'playwright');
const root=new URL('../artifacts/',import.meta.url);await mkdir(root,{recursive:true});
const {fileURLToPath}=await import('node:url');
const browser=await webkit.launch({headless:true,...(process.env.BODYTRACK_WEBKIT?{executablePath:process.env.BODYTRACK_WEBKIT}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',locale:'zh-CN',acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const checkpoints=[];
const checkpoint=message=>{checkpoints.push(message);console.log('PASS',message);};
const dbState=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('bodytrack-local',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('vault'),q=tx.objectStore('vault').get('state');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};}));
const nav=async id=>{await page.locator(`.bottomnav [data-page="${id}"]`).click();};
const click=async action=>page.locator(`[data-action="${action}"]:visible`).first().click();
try{
  const response=await page.goto(process.env.BODYTRACK_URL??'http://127.0.0.1:4173');assert.equal(response.status(),200);
  await page.waitForSelector('.dashboard');assert.match(await page.title(),/BodyTrack/);
  await page.screenshot({path:fileURLToPath(new URL('home-desktop.png',root)),fullPage:true});
  checkpoint('Desktop home loads without seeded health data');
  await page.setViewportSize({width:393,height:852});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:fileURLToPath(new URL('home-iphone.png',root)),fullPage:true});
  checkpoint('iPhone 15 Pro viewport has no horizontal overflow');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  checkpoint('Service worker installs and controls the page');
  await nav('training');await click('start');await page.waitForSelector('.exercise-card');
  const reps=page.locator('[data-set][data-key="reps"]:visible').first();await reps.fill('10');await reps.blur();
  await click('toggle-set');await page.waitForSelector('.check-btn.checked');
  let data=await dbState();assert.equal(data.sessions[0].exercises[0].sets[0].reps,10);assert.equal(data.sessions[0].exercises[0].sets[0].done,true);
  await page.reload();await page.waitForSelector('.dashboard');await nav('training');
  assert.equal(await page.locator('[data-set][data-key="reps"]:visible').first().inputValue(),'10');
  const last=page.locator('.exercise-card').last();await last.locator('summary').click();
  await last.locator('[data-key="reps"]').nth(0).fill('9');await last.locator('[data-key="reps"]').nth(0).blur();
  await last.locator('[data-key="reps"]').nth(1).fill('10');await last.locator('[data-key="reps"]').nth(1).blur();
  await last.locator('[data-key="sideDifference"]').fill('左侧控制略难（自动化测试）');await last.locator('[data-key="sideDifference"]').blur();
  await page.screenshot({path:fileURLToPath(new URL('training-iphone.png',root)),fullPage:true});
  await click('finish');await page.locator('#f-energy').selectOption('4');await page.locator('#f-neck').selectOption('2');await page.locator('#f-warmup').fill('轻柔完成，无颈部后仰');await page.locator('#f-diary').fill('自动化验证记录');await page.locator('#modal [type=submit]').click();
  await page.waitForSelector('#modal', {state:'hidden'});data=await dbState();assert.equal(data.sessions[0].status,'completed');assert.equal(data.sessions[0].journal.neck,2);assert.deepEqual(data.sessions[0].exercises.at(-1).sets.slice(0,2).map(x=>x.reps),[9,10]);
  checkpoint('Set actuals, left/right differences and neck diary persist across reload');
  await nav('diet');await click('add-meal');await click('new-food-quick');
  await page.locator('#f-name').fill('测试标签食物');await page.locator('#f-source').fill('测试夹具，非真实食品');await page.locator('#f-n-kcal').fill('120');await page.locator('#f-n-protein').fill('8');await page.locator('#f-n-carbs').fill('15');await page.locator('#f-n-fat').fill('3');await page.locator('#f-n-sodium').fill('50');await page.locator('#f-grams').fill('75');await page.locator('#modal [type=submit]').click();await page.waitForSelector('#modal', {state:'hidden'});
  data=await dbState();assert.equal(data.meals.length,1);assert.equal(C.calculateNutrition(data.meals[0].per100,data.meals[0].grams).kcal,90);assert.equal(data.meals[0].per100.fiber,null);
  await page.screenshot({path:fileURLToPath(new URL('diet-iphone.png',root)),fullPage:true});
  checkpoint('Manual label entry calculates 75 g correctly and preserves unknown fiber');
  // Editing the food library must not change the existing meal snapshot.
  await page.locator('[data-diet="foods"]').click();await click('edit-food');await page.locator('#f-n-kcal').fill('200');await page.locator('#modal [type=submit]').click();await page.waitForSelector('#modal', {state:'hidden'});data=await dbState();assert.equal(data.foods[0].per100.kcal,200);assert.equal(data.meals[0].per100.kcal,120);
  checkpoint('Food-library changes leave historical nutrient snapshots intact');
  // Plan file preview must not mutate data before user confirmation.
  await nav('profile');let before=await dbState();
  const plan=C.builtinPlan(C.dateKey());plan.planVersion=2;plan.trainingDays[0].exercises[2].repetitions=12;
  const chooserPromise=page.waitForEvent('filechooser');await click('import-plan');const chooser=await chooserPromise;
  await chooser.setFiles({name:'plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(plan))});await page.waitForSelector('[data-form="confirm-plan"]');
  assert.equal((await dbState()).plans.length,before.plans.length);
  await page.locator('[name="confirmed"]').check();await page.locator('#modal [type=submit]').click();await page.waitForSelector('#modal', {state:'hidden'});data=await dbState();assert.equal(data.plans.length,2);assert.equal(data.sessions[0].planKey,before.sessions[0].planKey);assert.equal(C.activePlan(data).planVersion,2);
  checkpoint('Plan import previews before confirmation and preserves historical training');
  // Invalid JSON/Schema cannot open an activation preview or change records.
  const invalidChooser=page.waitForEvent('filechooser');await click('import-plan');await (await invalidChooser).setFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":"99"}')});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('schemaVersion'));
  assert.equal((await dbState()).plans.length,2);checkpoint('Malformed plan rejected without mutation');
  // Download then restore in a completely separate browser context.
  const downloadPromise=page.waitForEvent('download');await click('backup');const dl=await downloadPromise;const backupPath=fileURLToPath(new URL('test-backup.json',root));await dl.saveAs(backupPath);
  const fresh=await browser.newContext({viewport:{width:393,height:852},timezoneId:'Asia/Shanghai'}),p2=await fresh.newPage();
  await p2.goto('http://127.0.0.1:4173');await p2.waitForSelector('.dashboard');await p2.locator('.bottomnav [data-page="profile"]').click();
  const restoreChooser=p2.waitForEvent('filechooser');await p2.locator('[data-action="restore"]').click();await (await restoreChooser).setFiles(backupPath);await p2.waitForSelector('[data-form="confirm-restore"]');await p2.locator('[name="confirmed"]').check();await p2.locator('#modal [type=submit]').click();await p2.waitForSelector('#modal', {state:'hidden'});
  assert.match(await p2.locator('body').innerText(),/v2/);await p2.locator('.bottomnav [data-page="training"]').click();await p2.locator('[data-training="history"]').click();assert.match(await p2.locator('body').innerText(),/已结束/);
  await fresh.close();checkpoint('Complete backup downloads and restores in a clean browser database');
  await nav('trends');await page.screenshot({path:fileURLToPath(new URL('trends-iphone.png',root)),fullPage:true});
  await nav('profile');await page.locator('[data-pref="theme"]').selectOption('dark');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#131d20');await page.screenshot({path:fileURLToPath(new URL('profile-dark-iphone.png',root)),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  checkpoint('Trends and dark mode render within the mobile viewport');
  await context.setOffline(true);await page.reload();await page.waitForSelector('.page-title');await nav('diet');assert.match(await page.locator('body').innerText(),/测试标签食物|我的食物/);await click('add-meal');await page.locator(`#picker-results [data-action="pick-food"][data-id="${data.foods[0].id}"]`).click();await page.locator('#f-grams').fill('100');await page.locator('#modal [type=submit]').click();await page.waitForSelector('#modal', {state:'hidden'});data=await dbState();assert.equal(data.meals.length,2);await context.setOffline(false);
  checkpoint('Offline reload, navigation and new nutrition writes work');
  const atomic=await page.evaluate(async()=>{
    const {LocalStore}=await import('./store.mjs');
    const a=new LocalStore(),b=new LocalStore();await a.open();await b.open();
    await a.change(s=>s.settings.introSeen=true);
    let conflict=false;try{await b.change(s=>s.settings.introSeen=false);}catch(e){conflict=e.constructor.name==='ConflictError';}
    const old=JSON.stringify(a.state);let invalid=false;try{await a.change(s=>s.meals[0].grams=-1);}catch{invalid=true;}
    let restoreRejected=false;try{await a.restore({...a.state,dataVersion:99});}catch{restoreRejected=true;}
    const unchanged=old===JSON.stringify(a.state);
    a.db.close();b.db.close();return {conflict,invalid,restoreRejected,unchanged};
  });
  assert.deepEqual(atomic,{conflict:true,invalid:true,restoreRejected:true,unchanged:true});
  checkpoint('Concurrent writes, invalid mutations and invalid restores cannot overwrite saved data');
  assert.deepEqual(errors,[],'Browser JavaScript errors');
  await writeFile(new URL('browser-results.json',root),JSON.stringify({engine:'WebKit',viewport:'393 × 852',checks:checkpoints,errors},null,2));
  console.log(`Browser integration: ${checkpoints.length} checks passed, no JavaScript errors.`);
}finally{await browser.close();}
