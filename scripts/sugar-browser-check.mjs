import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {webkit}=require(process.env.BODYTRACK_PLAYWRIGHT??'playwright');
const browser=await webkit.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},timezoneId:'Asia/Shanghai',colorScheme:'dark'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const nav=id=>page.locator(`.bottomnav [data-page="${id}"]`).click();
const meter=page.locator('.sugar-monitor');
const submit=async()=>{
  await page.locator('#modal [type=submit]').click();
  await page.waitForSelector('#modal',{state:'hidden'});
};
const reading=label=>page.waitForFunction(text=>document.querySelector('.sugar-monitor')?.textContent.includes(text),label);

try{
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await reading('尚未记录');
  await page.evaluate(async()=>{
    const C=await import('./core.mjs');
    const {foods}=await (await fetch('./foods.json')).json();
    const legacy=C.initialState();
    legacy.dataVersion=2;
    const banana=foods.find(f=>f.id==='usda-sr-173944');
    const meal=C.mealFromFood(banana,100,C.dateKey(),'早餐');
    for(const key of C.SUGAR_NUTRIENTS)delete meal.per100[key];
    legacy.meals.push(meal);
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('bodytrack-local',1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('vault','readwrite');
        tx.objectStore('vault').put(legacy,'state');
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error);};
      };
    });
  });
  await page.reload();
  await reading('总糖 · 12.2 g');
  assert.equal(await meter.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  assert.match(await meter.innerText(),/25 g/);
  console.log('PASS legacy preset meal receives known sugars, and fruit counts only toward total sugar');

  await nav('diet');
  await page.getByRole('button',{name:'记录午餐',exact:true}).click();
  await page.locator('[data-action="new-food-quick"]').click();
  await page.locator('#f-name').fill('添加糖测试食品');
  await page.locator('#f-source').fill('虚构测试标签');
  await page.locator('#f-n-totalSugars').fill('20');
  await page.locator('#f-grams').fill('260');
  await page.locator('#f-n-addedSugars').fill('21');
  await page.locator('#modal [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('添加糖不能超过总糖'));
  await page.locator('#f-n-addedSugars').fill('');
  await submit();
  await reading('1 项添加糖含量未知');
  assert.match(await meter.innerText(),/总糖 · 64.2 g/);

  await page.locator('[data-diet=foods]').click();
  await page.locator('[data-action=edit-food]').first().click();
  await page.locator('#f-n-addedSugars').fill('10');
  await submit();
  await page.locator('[data-diet=diary]').click();
  await reading('超出 1 g');
  assert.equal(await meter.getByRole('progressbar').getAttribute('aria-valuenow'),'100');
  assert.match(await meter.innerText(),/总糖 · 64.2 g/);
  console.log('PASS label entry distinguishes the two sugar fields and corrections update saved meals');

  await meter.getByRole('button',{name:'调整每日添加糖红线'}).click();
  await page.locator('#f-addedSugars').fill('30');
  assert(await page.locator('#modal').evaluate(el=>el.scrollWidth<=innerWidth));
  await submit();
  await reading('接近红线');
  await context.setOffline(true);
  await page.reload();
  await reading('接近红线');
  assert.match(await meter.innerText(),/30 g/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS custom redline survives an offline restart and fits the dark mobile viewport');
}finally{
  await browser.close();
}
