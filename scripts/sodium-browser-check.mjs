import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{webkit}=require(process.env.BODYTRACK_PLAYWRIGHT??'playwright');
const browser=await webkit.launch({headless:true,...(process.env.BODYTRACK_WEBKIT?{executablePath:process.env.BODYTRACK_WEBKIT}:{})});
const context=await browser.newContext({viewport:{width:393,height:852},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage();
const artifacts=new URL('../artifacts/',import.meta.url);await mkdir(artifacts,{recursive:true});
const checks=[],errors=[],nav=id=>page.locator(`.bottomnav [data-page="${id}"]`).click();
const pass=text=>{checks.push(text);console.log('PASS',text);};
const meter=()=>page.locator('.sodium-monitor'),bar=()=>meter().locator('[role="progressbar"]');
const formSave=async()=>{await page.locator('#modal [type=submit]').click();await page.waitForSelector('#modal',{state:'hidden'});};
const grams=async value=>{await page.locator('[data-action="edit-meal"]').first().click();await page.locator('#f-grams').fill(String(value));await formSave();};
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.dashboard');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.match(await meter().innerText(),/尚未记录/);assert.equal(await bar().getAttribute('aria-valuenow'),'0');
  await page.evaluate(async()=>{const C=await import('./core.mjs'),{LocalStore}=await import('./store.mjs'),s=new LocalStore();await s.open();await s.change(state=>{
    const f={id:C.uid(),name:'钠测试食品',state:'packaged',source:'测试标签',per100:{kcal:100,protein:5,carbs:10,fat:3,fiber:1,sodium:500}};state.foods.push(f);
    state.meals.push(C.mealFromFood(f,100,C.dateKey(),'早餐'),C.mealFromFood(f,2000,C.addDays(C.dateKey(),-1),'午餐'));
  });s.db.close();});await page.reload();await page.waitForSelector('.dashboard');
  assert.equal(await bar().getAttribute('aria-valuenow'),'25');await nav('diet');assert.equal(await bar().getAttribute('aria-valuenow'),'25');
  pass('Home and diet show today only with a 2,000 mg default reference and a visible red marker');
  await grams(320);assert(await meter().evaluate(el=>el.classList.contains('near')));assert.equal(await bar().getAttribute('aria-valuenow'),'80');assert.match(await meter().innerText(),/接近红线/);
  await grams(400);assert(await meter().evaluate(el=>el.classList.contains('limit')));assert.match(await meter().innerText(),/已到红线/);
  await grams(500);assert(await meter().evaluate(el=>el.classList.contains('exceeded')));assert.equal(await bar().getAttribute('aria-valuenow'),'100');assert.match(await meter().innerText(),/超出 500 mg/);assert.match(await bar().getAttribute('aria-valuetext'),/2,500/);
  await meter().screenshot({path:fileURLToPath(new URL('sodium-over-limit-light.png',artifacts))});
  pass('80% warns early, 100% reaches redline, excess is red and exposes the true amount accessibly');
  await meter().locator('[data-action="targets"]').click();await page.locator('#f-sodium').fill('1000');await formSave();assert.match(await meter().innerText(),/超出 1,500 mg/);
  await meter().locator('[data-action="targets"]').click();await page.locator('#f-sodium').fill('');await formSave();assert.match(await meter().innerText(),/超出 500 mg/);
  await page.locator('[data-diet="foods"]').click();await page.locator('[data-action="edit-food"]').first().click();await page.locator('#f-n-sodium').fill('700');await formSave();await page.locator('[data-diet="diary"]').click();assert.match(await meter().innerText(),/超出 1,500 mg/);
  await nav('home');assert.match(await meter().innerText(),/超出 1,500 mg/);
  pass('Custom limits, clearing to reference and automatic food corrections update the meter immediately');
  await page.evaluate(async()=>{const C=await import('./core.mjs'),{LocalStore}=await import('./store.mjs'),s=new LocalStore();await s.open();await s.change(state=>{
    const f={id:C.uid(),name:'钠含量未知测试食品',state:'packaged',source:'测试标签',per100:{kcal:100,protein:5,carbs:10,fat:3,fiber:null,sodium:null}};state.foods.push(f);state.meals.push(C.mealFromFood(f,100,C.dateKey(),'午餐'));
  });s.db.close();});
  await page.reload();await page.waitForSelector('.dashboard');assert.match(await meter().innerText(),/至少超出 1,500 mg/);assert.match(await meter().innerText(),/1 项钠含量未知/);
  await nav('diet');await grams(100);assert.match(await meter().innerText(),/仅统计已知部分/);assert(await meter().evaluate(el=>el.classList.contains('partial')));assert.equal(await bar().getAttribute('aria-valuenow'),'35');
  await page.locator('[data-action="delete-meal"]').first().click();await page.locator('[data-action="delete-meal-confirm"]').click();await page.waitForSelector('#modal',{state:'hidden'});
  assert.match(await meter().innerText(),/钠含量未知/);assert.equal(await bar().getAttribute('aria-valuenow'),null);
  pass('Partial intake stays a lower bound; all-unknown meals never appear as zero or a complete safe total');
  await page.locator('[data-action="prev-date"]').click();assert.match(await meter().innerText(),/超出 12,000 mg/);await page.locator('[data-action="next-date"]').click();assert.match(await meter().innerText(),/钠含量未知/);
  await nav('profile');await page.locator('[data-pref="theme"]').selectOption('dark');await nav('diet');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await meter().evaluate(el=>el.scrollIntoView({block:'center'}));await meter().screenshot({path:fileURLToPath(new URL('sodium-unknown-dark.png',artifacts))});
  await context.setOffline(true);await page.reload();await page.waitForSelector('.dashboard');await nav('diet');assert.match(await meter().innerText(),/钠含量未知/);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  pass('Date switching, dark mode and offline restart preserve the correct sodium state');
  assert.deepEqual(errors,[]);await writeFile(new URL('sodium-results.json',artifacts),JSON.stringify({engine:'WebKit',checks,errors},null,2));
}finally{await browser.close();}
