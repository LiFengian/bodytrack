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
    legacy.settings.targets.addedSugars=25;
    const banana=foods.find(f=>f.id==='usda-sr-173944');
    const meal=C.mealFromFood(banana,100,C.dateKey(),'早餐');
    delete meal.per100.totalSugars;
    meal.per100.addedSugars=0;
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
  await reading('12.2 g');
  assert.match(await meter.innerText(),/未设置上限/);
  assert.equal(await meter.getByRole('progressbar').count(),0);
  assert.equal(await page.locator('.dashboard button').count(),0);
  assert.match(await page.locator('.nutrition-card').innerText(),/今日营养/);
  console.log('PASS read-only Home shows known total sugar without reusing an older added-sugar limit');

  await nav('diet');
  await page.getByRole('button',{name:'记录午餐',exact:true}).click();
  await page.locator('[data-action="new-food-quick"]').click();
  await page.locator('#f-name').fill('添加糖测试食品');
  await page.locator('#f-source').fill('虚构测试标签');
  assert.equal(await page.locator('#f-n-addedSugars').count(),0);
  await page.locator('#f-grams').fill('260');
  await submit();
  await reading('1 项总糖含量未知');

  await page.locator('[data-diet=foods]').click();
  await page.locator('[data-action=edit-food]').first().click();
  await page.locator('#f-n-totalSugars').fill('20');
  await submit();
  await page.locator('[data-diet=diary]').click();
  await reading('64.2 g');
  console.log('PASS total sugar entry and corrections recalculate saved meals and preserve unknown values');

  await meter.getByRole('button',{name:'调整每日总糖红线'}).click();
  assert.equal(await page.locator('#f-addedSugars').count(),0);
  await page.locator('#f-totalSugars').fill('60');
  assert(await page.locator('#modal').evaluate(el=>el.scrollWidth<=innerWidth));
  await submit();
  await reading('超出 4.2 g');
  assert.equal(await meter.getByRole('progressbar').getAttribute('aria-valuenow'),'100');
  await context.setOffline(true);
  await page.reload();
  await reading('超出 4.2 g');
  assert.match(await meter.innerText(),/60 g/);
  assert.equal(await page.locator('.dashboard button').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS custom redline survives an offline restart and fits the dark mobile viewport');
}finally{
  await browser.close();
}
