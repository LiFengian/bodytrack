import * as C from './core.mjs';
import {LocalStore} from './store.mjs';
import {combineFoods,searchFoods} from './food-utils.mjs';
import {photoReady,preparePhoto,decodePhoto,recognizePhoto,cancelPhotoRecognition} from './photo.mjs';
let builtInFoods=[];
const allFoods=()=>combineFoods(builtInFoods,store.state?.foods??[]);

const app=document.querySelector('#app'), modal=document.querySelector('#modal');
const store=new LocalStore();
const ui={page:'home',training:'today',diet:'diary',date:C.dateKey(),range:30,sessionId:null,open:new Set(),effortDetails:false,foodQuery:'',foodCategory:'全部',pendingPlan:null,pendingBackup:null,recipe:[],offline:'正在准备',update:null};
const icons={camera:'M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',dumbbell:'m6 6 12 12M4 9l5-5M15 20l5-5M2 7l5-5M17 22l5-5',food:'M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 21V3c-5 3-5 10 0 10',chart:'M3 3v18h18M7 15l4-5 4 3 6-8',user:'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',arrow:'M4 12h16m-6-6 6 6-6 6',chevron:'m9 5 7 7-7 7',left:'m15 5-7 7 7 7',plus:'M12 5v14M5 12h14',check:'m5 12 4 4 10-10',shield:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7zM8 12l3 3 5-5',leaf:'M20 4c-12-3-20 9-12 14 6 4 13-2 12-14ZM6 20l10-11',flame:'M12 3c2 5 6 5 6 11a6 6 0 0 1-12 0c0-3 1-5 3-7 0 3 2 4 3 4z',calendar:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 11h18',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',download:'M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5',upload:'M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5',close:'m6 6 12 12M6 18 18 6',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',heart:'M20 5a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-5 6 3 12 8 16 5-4 13-10 8-16',edit:'m16 3 5 5-12 12-6 1 1-6zM13 6l5 5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',file:'M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h8',refresh:'M20 7V3l-4 4M4 17v4l4-4M4 9a8 8 0 0 1 14-3M20 15a8 8 0 0 1-14 3',info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',weight:'M4 6h16l2 15H2zM8 6V3h8v3M12 9v4',cloud:'M7 18a6 6 0 1 1 2-12 7 7 0 0 1 12 5 4 4 0 0 1-1 7M12 13v8m-3-3 3 3 3-3',coffee:'M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 8h2a3 3 0 0 1 0 6h-2M6 3v2M11 2v3'};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]??icons.info}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=(value,dec=0)=>value==null?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:dec});
const state=()=>store.state;
const btn=(action,label,style='secondary',attrs='')=>`<button type="button" class="btn ${style}" data-action="${action}" ${attrs}>${label}</button>`;
const ibtn=(action,name,label,attrs='')=>`<button type="button" class="iconbtn" data-action="${action}" aria-label="${esc(label)}" ${attrs}>${icon(name)}</button>`;
const tag=(text,color='')=>`<span class="badge ${color}">${esc(text)}</span>`;
const empty=(name,title,text,action='',label='')=>`<div class="empty">${icon(name,27)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action?btn(action,label):''}</div>`;
const section=(title,action='')=>`<div class="section-head"><h2>${title}</h2>${action}</div>`;
const field=(name,label,value='',type='text',extra='')=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const textarea=(name,label,value='',extra='')=>`<div class="field ${extra}"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" maxlength="10000">${esc(value)}</textarea></div>`;
const select=(name,label,options,value,extra='')=>`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" ${extra}>${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
const numeric=(name,label,value='',extra='')=>field(name,label,value??'','number',`inputmode="decimal" ${/\bstep=/.test(extra)?'':'step="any"'} ${/\bmin=/.test(extra)?'':'min="0"'} ${/\bmax=/.test(extra)?'':'max="10000000"'} ${extra}`);
const callout=(text,orange=false)=>`<div class="callout ${orange?'orange':''}">${icon('info',17)}<p>${text}</p></div>`;
const formFooter=(label='保存')=>`<div class="modal-footer">${btn('close','取消','outline')}<button type="submit" class="btn primary">${label}</button></div>`;
function formModal(title,name,body,label='保存',attrs='') {openModal(`<div class="modal-header"><h2>${title}</h2>${ibtn('close','close','关闭')}</div><form data-form="${name}" ${attrs}><div class="modal-body">${body}</div>${formFooter(label)}</form>`);}
function releasePhotoInput(){
  if(ui.photoPixels)ui.photoPixels.fill(0);ui.photoPixels=null;ui.photoPreview=null;
  modal.querySelectorAll('[data-photo-file]').forEach(input=>input.value='');
  const preview=modal.querySelector('#photo-preview');if(preview){preview.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));preview.replaceChildren();preview.hidden=true;}
  const run=modal.querySelector('[data-action="run-photo"]');if(run)run.disabled=true;
}
let photoTask=0;
function clearTransientPhoto(){photoTask++;cancelPhotoRecognition();releasePhotoInput();}
function openModal(html){clearTransientPhoto();modal.innerHTML=html;if(!modal.open)modal.showModal();}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4500);}
let queue=Promise.resolve();
async function save(mutator,label=null,redraw=true){
  const job=queue.then(()=>store.change(mutator,label));queue=job.catch(()=>{});
  try{const r=await job;setSaved();if(redraw)render();return r;}catch(e){toast(e.message??'保存失败，请保留当前页面并导出备份');throw e;}
}
function setSaved(){document.querySelectorAll('[data-save-status]').forEach(el=>{el.textContent='已保存到本机';});}
function applyTheme(){const theme=state().settings.theme;if(theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;document.querySelector('meta[name=theme-color]').content=matchMedia('(prefers-color-scheme: dark)').matches&&theme!=='light'||theme==='dark'?'#131d20':'#f5f6f8';}
const pages=[['home','home','首页'],['training','dumbbell','训练'],['diet','food','饮食'],['trends','chart','趋势'],['profile','user','我的']];
function navigate(page){ui.page=page;ui.sessionId=null;render();window.scrollTo({top:0});}
function render(){
  applyTheme();
  const today=C.dateKey(),title=pages.find(p=>p[0]===ui.page)?.[2];
  const content=({home:homePage,training:trainingPage,diet:dietPage,trends:trendsPage,profile:profilePage})[ui.page]();
  app.innerHTML=`<aside class="sidebar"><div class="brand"><div class="brand-mark">b.</div><div><div class="brand-name">BodyTrack</div></div></div><nav aria-label="主导航">${pages.map(([id,i,l])=>`<button class="nav-item ${ui.page===id?'active':''}" data-page="${id}" ${ui.page===id?'aria-current="page"':''}>${icon(i,19)}${l}</button>`).join('')}</nav><div class="sidebar-foot"><div class="local-label"><span class="dot"></span><span data-save-status>已保存到本机</span></div></div></aside>
    <main class="shell"><header class="topbar"><div class="breadcrumb">个人空间 ${icon('chevron',11)}<span>${title}</span></div><div class="brand mobile-brand"><div class="brand-mark">b.</div><span class="brand-name">BodyTrack</span></div><div class="row gap8"><div class="date-pill">${icon('calendar',14)}${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(new Date())}</div>${ibtn('backup','download','导出完整备份')}</div></header>${content}</main>
    <nav class="bottomnav" aria-label="底部导航">${pages.map(([id,i,l])=>`<button class="${ui.page===id?'active':''}" data-page="${id}" ${ui.page===id?'aria-current="page"':''}>${icon(i,21)}${l}</button>`).join('')}</nav>`;
}
function pageTitle(title,action=''){return `<div class="page-title"><h1>${title}</h1>${action}</div>`;}
const disclosure=(label,body)=>`<details class="inline-help"><summary>${label}</summary><div>${body}</div></details>`;
function currentSession(){return state().sessions.find(s=>s.status==='inProgress');}
function volume(e){return `${e.perSide?'每侧 ':''}${e.sets} × ${e.repetitions}${e.holdSeconds?` · ${e.holdSeconds}秒`:''}`;}
function cycleCard(occ){
  if(!occ)return '';
  const p=occ.plan;
  return `<section class="card cycle-card">${section('训练有节奏，进步不着急',tag(`第 ${occ.cycleNumber} 轮`))}<div class="cycle-strip">${p.cycleDefinition.trainingDayIds.map((id,i)=>{const d=p.trainingDays.find(d=>d.id===id);return `<div class="cycle-cell ${id===null?'rest':''} ${i===occ.dayNumber-1?'current':''}" ${i===occ.dayNumber-1?'aria-current="step"':''}><div class="day">${String(i+1).padStart(2,'0')}</div><div class="type">${esc(d?.name.replace(/部?日$/,'').replace('手臂','臂').slice(0,2)??'休')}</div></div>`;}).join('')}</div><div class="cycle-foot"><span>● 当前待完成 &nbsp; ◌ 休息日</span><span>${p.cycleDefinition.length} 天循环 · 完成后推进</span></div></section>`;
}
function homePage(){
  const s=state(),today=C.dateKey(),occ=C.nextOccurrence(s,today),running=currentSession();
  const day=occ?.trainingDay,completed=s.sessions.filter(x=>x.status==='completed'&&x.dayId),meals=s.meals.filter(x=>x.date===today),nutrition=C.aggregateNutrition(meals);
  const lastWeight=[...s.body].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const last=s.sessions.filter(x=>x.status==='completed').at(-1);
  const first=!s.settings.introSeen;
  const title=running?`继续${esc(running.name)}`:day?`${esc(day.name)}，稳稳向前。`:'恢复，也是训练的一部分。';
  const pending=occ&&occ.plannedDate<today;
  return `${pageTitle('今天',`<div class="title-icon">${icon('sun',22)}</div>`)}
    ${first?`<div class="install-banner">${icon('leaf',22)}<div class="spacer"><h4>添加到主屏幕，随时记录</h4></div>${btn('intro','使用指南','outline')}</div>`:''}
    <div class="dashboard"><div class="stack"><section class="card hero"><div class="row between"><span>今日训练</span><span class="badge">${occ?`DAY ${String(occ.dayNumber).padStart(2,'0')} / ${occ.plan.cycleDefinition.length}`:'暂无计划'}</span></div><div><h2>${title}</h2><p>${esc(day?.focus??'让身体恢复，为下一次训练积蓄力量。')}</p></div><div class="hero-deco">${icon('dumbbell',100)}</div><div class="hero-bottom"><div class="hero-meta">${day?`${day.exercises.filter(x=>x.module==='main').length} 个训练动作 · ${day.exercises.filter(x=>x.module==='warmup').length} 个热身动作`:'主动恢复 · 自由安排'}<br>${pending?'待完成日期 '+esc(occ.plannedDate)+' · 周期已为你保留':running?'进度已保存，按自己的节奏继续':'动作控制优先 · 保留 2–4 次余力'}</div>${btn('go-training',`${running?'继续训练':day?'开始今天的训练':'记录休息日'} ${icon('arrow',16)}`,'')}</div></section>
      <div class="stats-row">${statCard('dumbbell',completed.length,'次','累计训练')}${statCard('flame',nutrition.kcal.value,'kcal',meals.length?(nutrition.kcal.complete?'今日热量':'今日热量 · 有缺失'):'今日热量 · 尚未记录')}${statCard('weight',lastWeight?.weight??null,'kg',lastWeight?'最近一次体重':'体重 · 尚未记录')}</div>
      ${cycleCard(occ)}
      <section class="card exercises-card">${section('今日动作',`<button class="linkbtn" data-page="training">查看全部 ${icon('chevron',13)}</button>`)}${day?day.exercises.slice(0,4).map((e,i)=>`<div class="exercise-mini"><span class="exercise-number">${String(i+1).padStart(2,'0')}</span><div><h4>${esc(e.name)}</h4>${e.module==='warmup'?'<p>热身</p>':''}</div><span class="volume">${volume(e)}</span></div>`).join(''):empty('leaf','给身体一点恢复时间','休息日也可以记录疲劳、颈部紧张和主观感受。')}</section>
    </div><div class="stack"><section class="card nutrition-card">${section('今日营养',`<button class="linkbtn" data-page="diet">记录饮食 ${icon('plus',13)}</button>`)}${nutritionOverview(nutrition,s.settings.targets)}<div>${C.MEALS.map((name,i)=>{const m=meals.filter(m=>m.meal===name);return `<div class="meal-mini"><div class="row gap8"><div class="meal-icon">${icon(i===0?'coffee':'food',14)}</div><p>${name}</p></div><span class="tiny muted">${m.length?`${m.length} 项已记录`:'等待记录'}</span><button class="linkbtn" data-action="add-meal" data-meal="${name}" aria-label="记录${name}">${icon('plus',15)}</button></div>`;}).join('')}</div></section>
      <section class="card wellbeing-card">${section('训练日记')}<div class="next-record">${icon('file',20)}<div class="spacer"><h4>${last?'最近的训练日记':'写下你的第一篇训练日记'}</h4><p>${last?`${last.date} · ${esc(last.name)}`:'训练结束后，用一分钟回顾今天。'}</p></div>${ibtn(last?'journal-last':'go-training','chevron','查看训练日记')}</div></section>
      ${!s.settings.lastBackupAt||C.daysBetween(s.settings.lastBackupAt.slice(0,10),today)>=7?`<div class="callout orange backup-callout">${icon('download',18)}<div><p>建议每周备份一次。</p><button class="linkbtn" data-action="backup">导出一份备份 ${icon('arrow',13)}</button></div></div>`:''}
    </div></div>`;
}
function statCard(i,value,unit,label){return `<div class="card stat"><div class="stat-icon">${icon(i,16)}</div><div><span class="number">${fmt(value,1)}</span><span class="unit">${unit}</span></div><div class="stat-label">${label}</div></div>`;}
function nutritionOverview(n,targets){
  const kcal=n.kcal,ratio=targets.kcal&&kcal.value!=null?Math.min(1,kcal.value/targets.kcal):0;
  return `<div class="ring-layout"><div class="ring"><svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="60" fill="none" stroke="var(--surface2)" stroke-width="8"/><circle cx="70" cy="70" r="60" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${ratio*377} 377"/></svg><div class="ring-value"><span class="number">${fmt(kcal.value)}</span><span class="small">${kcal.complete?'kcal 已记录':'kcal · 有缺失'}</span><span class="tiny muted" style="margin-top:6px">${targets.kcal?`目标 ${fmt(targets.kcal)}`:'尚未设置目标'}</span></div></div><div class="macro-list">${['protein','carbs','fat'].map(k=>`<div class="macro"><div class="macro-head"><span>${C.NUTRIENTS[k][0]}</span><span class="muted">${fmt(n[k].value,1)}${n[k].complete?'':'*'} / ${targets[k]??'—'} g</span></div><div class="progress"><span style="width:${targets[k]&&n[k].value?Math.min(100,n[k].value/targets[k]*100):0}%"></span></div></div>`).join('')}</div></div>`;
}
function trainingPage(){
  const s=state(),occ=C.nextOccurrence(s),running=currentSession(),viewed=ui.sessionId?s.sessions.find(x=>x.id===ui.sessionId):null;
  return `${pageTitle('训练',ibtn('plan-editor','edit','编辑训练计划'))}<div class="tabs" role="group" aria-label="训练视图">${[['today','今日训练'],['plan','训练计划'],['history','历史记录']].map(([id,l])=>`<button class="tab ${ui.training===id?'active':''}" data-training="${id}">${l}</button>`).join('')}</div>
    ${ui.training==='plan'?planView():ui.training==='history'&&!viewed?historyView():viewed||running?sessionView(viewed??running):preSession(occ)}`;
}
function preSession(occ){
  if(!occ)return `<section class="card">${empty('calendar','尚无生效计划','在「我的」中查看计划生效日期。')}</section>`;
  const d=occ.trainingDay,today=C.dateKey(),past=occ.plannedDate<today;
  return `<div class="grid2"><div class="stack"><section class="card"><div class="training-header"><div><div class="eyebrow muted">DAY ${occ.dayNumber} / ${occ.plan.cycleDefinition.length}</div><h2 style="margin-top:10px">${esc(d?.name??'休息日')}</h2><p class="small muted" style="margin-top:8px">${esc(d?.focus??'恢复与身体觉察')}</p></div>${tag(past?'周期为你保留':occ.plannedDate===today?'今天待完成':'计划未到期',past?'orange':'')}</div><div class="row between"><span class="small muted">当前计划日期：${occ.plannedDate}</span><button class="linkbtn" data-action="reschedule">调整日期 ${icon('calendar',14)}</button></div>${past?callout('漏练已保留，完成后继续周期。'):''}<hr class="divider"><label class="check-label"><input type="checkbox" data-setting="reducedVolume" ${state().settings.reducedVolume?'checked':''}>适应期：约 75% 训练组数，热身不减</label><div class="row wrap" style="margin-top:23px">${btn('start',`${icon(d?'dumbbell':'leaf',17)} ${d?'开始训练':'记录今天的休息'}`,'primary',occ.plannedDate>today?'disabled':'')}${btn('skip','跳过这一天','outline',occ.plannedDate>today?'disabled':'')}</div></section>${cycleCard(occ)}</div><section class="card">${section(d?'动作清单':'恢复日提示')}${d?d.exercises.map((e,i)=>`<div class="exercise-mini"><span class="exercise-number">${String(i+1).padStart(2,'0')}</span><div><h4>${esc(e.name)}</h4><p>${e.module==='warmup'?'热身模块':`训练模块 · 余力 ${e.intensity.rirMin}–${e.intensity.rirMax} 次`}</p></div><span class="volume">${volume(e)}</span></div>`).join(''):callout('可以轻松活动，也可以休息。记录疲劳、疼痛和颈部紧张，帮助下一轮训练做调整。')}</section></div>`;
}
function sessionView(s){
  const progress=C.completion(s),finished=s.status!=='inProgress';
  return `<div class="session-sets ${ui.effortDetails?'':'simple-sets'}"><div class="training-header"><div>${s.makeupFor?tag('补练','orange'):''}<h2 style="margin-top:8px">${esc(s.name)} <span class="small muted">${s.date}</span></h2><p class="small muted" style="margin-top:7px">${finished?'历史记录':'自动保存'} · ${progress.done}/${progress.total} 组</p></div><div class="row gap8">${btn('journal',`${icon('file',15)} 训练感受`,'outline',`data-id="${s.id}"`)}${finished?btn('back-history','返回','secondary'):''}</div></div>
    <div class="effort-guide row between wrap"><button class="linkbtn" data-action="effort-help">吃力与余力 ${icon('info',16)}</button>${btn('toggle-effort',ui.effortDetails?'收起选填项':'展开选填项','outline')}</div><div class="progress" style="margin-bottom:22px;height:5px"><span style="width:${(progress.ratio??0)*100}%"></span></div>
    ${!s.exercises.length?`<section class="card">${empty('leaf','今天，让身体恢复','可以先记录今天的身体感受，再确认完成休息日。')}</section>`:`<div class="stack">${s.exercises.map((e,index)=>`<details class="card exercise-card" data-exercise-details="${e.id}" ${ui.open.has(e.id)||!ui.open.size&&index===0?'open':''}><summary><div class="pill-number">${String(index+1).padStart(2,'0')}</div><div><h3>${esc(e.target.name)}</h3><span class="tiny muted">${e.target.module==='warmup'?'热身':'训练'} · ${e.target.perSide?'每侧 ':''}${e.targetSets} × ${e.target.repetitions}${e.target.holdSeconds?` · 保持 ${e.target.holdSeconds}秒`:''}${e.target.module==='main'?` · 余力 ${e.target.intensity.rirMin}–${e.target.intensity.rirMax} 次`:''}</span></div><span class="badge ${e.sets.every(x=>x.done)?'':'gray'}">${e.sets.filter(x=>x.done).length}/${e.sets.length}</span></summary><div class="exercise-body">${e.target.module==='warmup'?`<div class="exercise-instruction">${esc(e.target.instructions)}<br>${esc(e.target.precautions)}</div>`:disclosure('动作要点',`<p>${esc(e.target.instructions)}</p><p>${esc(e.target.precautions)}</p>`)}<div class="set-grid">${['组 / 侧','实际次数','重量 kg','吃力 0–10','还能做几次','打卡'].map(x=>`<span class="set-label">${x}</span>`).join('')}</div>${e.sets.map(x=>`<div class="set-grid set-row ${x.done?'done':''}"><span class="set-side">${String(x.number).padStart(2,'0')}<br>${{both:'双侧',left:'左侧',right:'右侧'}[x.side]}</span>${['reps','weight','rpe','rir'].map(key=>`<input type="number" inputmode="decimal" min="0" max="${key==='rpe'||key==='rir'?10:key==='weight'?10000:1000}" step="${key==='reps'?1:.5}" value="${esc(x[key])}" placeholder="—" aria-label="${esc(e.target.name)} 第${x.number}组${{both:'',left:'左侧',right:'右侧'}[x.side]} ${ {reps:'实际次数',weight:'重量 kg',rpe:'主观吃力程度 RPE',rir:'感觉还能做几次 RIR'}[key]}" data-set="${x.id}" data-session="${s.id}" data-key="${key}">`).join('')}<button class="check-btn ${x.done?'checked':''}" data-action="toggle-set" data-id="${x.id}" data-session="${s.id}" aria-label="${x.done?'取消完成':'标记完成'}第${x.number}组${x.side==='left'?'左侧':x.side==='right'?'右侧':''}" aria-pressed="${x.done}">${icon('check',17)}</button></div>`).join('')}<div class="input-note field"><label class="sr-only" for="notes-${e.id}">动作备注</label><input id="notes-${e.id}" placeholder="动作备注：今天的控制、呼吸或不适…" value="${esc(e.notes)}" maxlength="10000" data-exercise="${e.id}" data-session="${s.id}" data-key="notes"></div>${e.target.perSide?`<div class="input-note field"><label class="sr-only" for="side-${e.id}">左右侧表现差异</label><input id="side-${e.id}" placeholder="左右侧表现差异" value="${esc(e.sideDifference)}" maxlength="10000" data-exercise="${e.id}" data-session="${s.id}" data-key="sideDifference"></div>`:''}</div></details>`).join('')}</div>`}
    ${!finished?`<div class="row between wrap" style="margin-top:24px"><span class="live-save" data-save-status>已保存到本机</span>${btn('finish',`${icon('check',17)} ${s.dayId?'结束训练，记录感受':'确认休息日完成'}`,'primary',`data-id="${s.id}"`)}</div>`:''}</div>`;
}
function planView(){
  const p=C.activePlan(state());if(!p)return '';
  return `<div class="grid2"><section class="card">${section(esc(p.name),btn('plan-editor','编辑','outline'))}${tag(`版本 ${p.planVersion}`)}${disclosure('计划说明与注意事项',`<p>${esc(p.instructions)}</p><p>${esc(p.precautions)}</p>`)}${cycleCard(C.nextOccurrence(state()))}</section><div class="stack">${p.trainingDays.map(d=>`<section class="card plan-day">${section(esc(d.name))}<p class="small muted">${esc(d.focus)}</p>${d.exercises.map((e,i)=>`<div class="exercise-mini"><span class="exercise-number">${i+1}</span><div><h4>${esc(e.name)}</h4>${e.module==='warmup'?'<p>热身</p>':''}</div><span class="volume">${volume(e)}</span></div>`).join('')}</section>`).join('')}</div></div>`;
}
function historyView(){
  const sessions=[...state().sessions].reverse();
  return `<section class="card">${section('每一次，都有迹可循')}${sessions.length?sessions.map(s=>{const p=C.completion(s);return `<div class="selectable-row"><div class="pill-number">${icon(s.dayId?'dumbbell':'leaf',16)}</div><div class="info"><h3>${esc(s.name)} ${s.makeupFor?tag('补练','orange'):''}</h3><p>${s.date} · ${{completed:'已结束',inProgress:'进行中',skipped:'已跳过'}[s.status]} · ${p.done}/${p.total} 组</p></div>${s.status==='skipped'&&s.dayId&&!state().sessions.some(x=>x.makeupFor===s.id)?btn('makeup','补练','outline',`data-id="${s.id}"`):btn('view-session','查看','secondary',`data-id="${s.id}"`)}</div>`;}).join(''):empty('file','你的训练故事，从今天开始','完成的训练、主动休息和明确跳过的日期都会保留。','go-training','去记录第一天')}</section>`;
}
function dateControl(){return `<div class="date-control">${ibtn('prev-date','left','前一天')}<input type="date" aria-label="记录日期" value="${ui.date}" data-date ${ui.page==='diet'?`max="${C.dateKey()}"`:''}>${ibtn('next-date','chevron','后一天')}</div>`;}
function dietPage(){
  const s=state(),meals=s.meals.filter(m=>m.date===ui.date),nutrition=C.aggregateNutrition(meals);
  return `${pageTitle('饮食',ibtn('add-meal','plus','记录食物'))}<div class="row between wrap" style="margin-bottom:20px"><div class="tabs" style="margin-bottom:0">${[['diary','饮食日记'],['foods','常见食物']].map(([id,l])=>`<button class="tab ${ui.diet===id?'active':''}" data-diet="${id}">${l}</button>`).join('')}</div>${dateControl()}</div>
    <div class="food-shortcuts">${btn('photo-food',`${icon('camera',19)} 拍照识别`,'primary')}${btn('add-meal',`${icon('search',19)} 搜索食物`,'outline')}</div>${ui.diet==='foods'?foodLibrary():`<section class="card">${section(`${ui.date===C.dateKey()?'今日':ui.date}营养概览`,`<button class="linkbtn" data-action="targets">设置目标 ${icon('edit',13)}</button>`)}<div class="nutrition-grid">${C.REQUIRED_NUTRIENTS.map(k=>`<div class="nutrition-tile"><p>${C.NUTRIENTS[k][0]}</p><span class="number">${fmt(nutrition[k].value,k==='kcal'?0:1)} <small class="tiny muted">${C.NUTRIENTS[k][1]}</small></span><p>${!nutrition[k].complete?'数据有缺失':meals.length?'已记录摄入':'尚未记录'}${s.settings.targets[k]?` / 目标 ${s.settings.targets[k]}`:''}</p></div>`).join('')}</div></section>
    <div class="grid2" style="margin-top:4px">${C.MEALS.map((meal,i)=>{const entries=meals.filter(m=>m.meal===meal);return `<section class="card meal-card">${section(`<span class="row gap8">${icon(i===0?'coffee':'food',17)} ${meal}</span>`,ibtn('add-meal','plus',`记录${meal}`,`data-meal="${meal}"`))}${entries.length?entries.map(m=>{const n=C.calculateNutrition(m.per100,m.grams);return `<div class="food-line"><div class="spacer"><h4>${esc(m.name)}</h4><p>${m.grams} g · ${{raw:'生食',cooked:'熟食',packaged:'包装即食'}[m.state]}</p></div><div class="food-kcal">${fmt(n.kcal)} kcal<small>蛋白质 ${fmt(n.protein,1)} g</small></div>${ibtn('edit-meal','edit','修改食物重量',`data-id="${m.id}"`)}${ibtn('delete-meal','trash','删除食物记录',`data-id="${m.id}"`)}</div>`;}).join(''):`<div class="empty" style="padding:22px 0 8px"><p>这一餐，还没有记录。</p><button class="linkbtn" data-action="add-meal" data-meal="${meal}">添加食物 ${icon('plus',13)}</button></div>`}</section>`;}).join('')}</div>`}`;
}
function foodRows(foods,kind='picker'){
  return foods.length?foods.slice(0,60).map(f=>`<div class="food-result"><button class="food-result-main" data-action="${kind==='library'?'use-food':'pick-food'}" data-id="${esc(f.id)}"><span class="food-emoji">${icon('food',20)}</span><span class="spacer"><strong>${esc(f.name)}</strong><small>${{raw:'生 / 未烹调',cooked:'熟 / 可食部分',packaged:'即食'}[f.state]} · 每 100g ${fmt(f.per100.kcal)} kcal · 蛋白 ${fmt(f.per100.protein,1)}g</small></span>${icon('chevron',15)}</button>${kind==='library'&&!f.sourceUrl?`<div class="row gap8">${ibtn('edit-food','edit','修改自定义食物',`data-id="${f.id}"`)}${ibtn('delete-food','trash','删除自定义食物',`data-id="${f.id}"`)}</div>`:''}</div>`).join(''):empty('search','暂未找到匹配食物','试试更短的关键词；没有可靠条目时可录入品牌标签。');
}
function foodLibrary(){
  const foods=searchFoods(allFoods(),ui.foodQuery,ui.foodCategory);
  const categories=['全部','优质蛋白','主食碳水','豆类乳品','蔬菜水果','坚果油脂','饮品','自定义'];
  return `<section class="card">${section('常见食物',btn('new-food','自定义食品','outline'))}<div class="food-search field" style="margin-top:17px"><label class="sr-only" for="library-query">搜索常见食物</label><input id="library-query" type="search" value="${esc(ui.foodQuery)}" placeholder="搜索鸡胸肉、鸡蛋、米饭、燕麦…" data-food-search="library"></div><div class="food-categories">${categories.map(c=>`<button class="${ui.foodCategory===c?'selected':''}" data-action="food-category" data-id="${c}">${c}</button>`).join('')}</div><div id="library-results">${foodRows(foods,'library')}</div>${disclosure('数据来源与记录说明','<p>内置 USDA 食物参考值；每条来源可在确认份量时查看。生熟分开，油、盐和酱料需另记，包装食品以品牌标签为准。缺失值保持未知。</p>')}<button class="linkbtn" data-action="recipe">创建菜谱 ${icon('plus',14)}</button></section>`;
}
function showFoodPicker(meal='加餐'){
  ui.pickerMeal=meal;
  openModal(`<div class="modal-header"><h2>选择食物</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><div class="food-search field"><label class="sr-only" for="picker-query">搜索食物</label><input id="picker-query" type="search" placeholder="搜索鸡胸肉、鸡蛋、米饭、燕麦…" data-food-search="picker"></div><div id="picker-results">${foodRows(allFoods())}</div></div><div class="modal-footer">${btn('photo-food',`${icon('camera',17)} 拍照辅助`,'primary')}${btn('new-food-quick','录入包装营养表','outline',`data-meal="${meal}"`)}</div>`);
}
function effortHelp(){openModal(`<div class="modal-header"><h2>这组，有多吃力？</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><h3>还能做几次（RIR）</h3><p>完成这一组后，感觉还能用同样动作质量再做几次。例如做了 10 次，觉得还能做 3 次，就填 <strong>3</strong>。一般抗阻训练目标保留 2–4 次余力。</p><h3 style="margin:20px 0 10px">吃力程度（RPE）</h3><p>你对这一组的主观吃力评分，0–10 分；数值越高越吃力。抗阻训练中可用下面的近似关系理解：</p><div class="effort-examples">${[['约 6 分','还能做约 4 次'],['约 7 分','还能做约 3 次'],['约 8 分','还能做约 2 次'],['约 9 分','还能做约 1 次'],['约 10 分','已经无法再做一次']].map(([a,b])=>`<div class="row between"><strong>${a}</strong><span>${b}</span></div>`).join('')}</div>${callout('两项都选填，不会自动互相换算，也不要求你做到力竭。热身和控制类动作不必强行打分；不知道就留空。')}<p>例如：上斜推胸做 10 次、重量 30 kg，结束时感觉还能做 3 次。可以只填「次数 10、重量 30」，也可以再填「还能做 3 次」。</p></div><div class="modal-footer">${btn('close','明白了','primary')}</div>`);}
async function showPhotoFood(){
  if(ui.page!=='diet')ui.date=C.dateKey();
  ui.photoMeal=ui.pickerMeal??'加餐';ui.photoResult=null;
  const ready=await photoReady();
  openModal(`<div class="modal-header"><h2>拍照识别</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><p>照片仅在本机识别，用完自动清理。</p><div class="photo-pick-actions"><label class="btn primary" for="camera-food">${icon('camera',18)} 拍一张<input class="sr-only" id="camera-food" type="file" accept="image/*" capture="environment" data-photo-file></label><label class="btn outline" for="album-food">${icon('upload',18)} 选照片<input class="sr-only" id="album-food" type="file" accept="image/*" data-photo-file></label></div><div id="photo-preview" class="photo-preview" hidden></div><p id="photo-status" class="small muted" role="status" aria-live="polite" style="margin:15px 0">${ready?'已就绪 · 可离线识别':'首次需下载约 36 MB 模型'}</p><div id="photo-results"></div>${callout('识别只推荐食物，生熟和重量需你确认。')}${disclosure('拍摄与存储说明','<p>让主要食物位于画面中央，混合餐食请分开近拍。照片无法测量克数、用油或含盐量；油盐需另记。</p><p>照片不上传、不写入记录或备份；识别结束、关闭或切后台时清理。约 36 MB 模型缓存保留，相册原图不受影响。</p>')}</div><div class="modal-footer">${btn('run-photo',ready?'开始识别':'下载并识别','primary','disabled')}${btn('search-from-photo','直接搜索食物','outline')}</div>`);
}
async function runPhoto(){
  if(!ui.photoPixels)throw new Error('请先拍摄或选择照片');
  const task=photoTask;
  const status=modal.querySelector('#photo-status');
  const pickers=[...modal.querySelectorAll('[data-photo-file]')];pickers.forEach(input=>input.disabled=true);
  modal.querySelector('#photo-results').innerHTML='';
  try{
  status.textContent='正在准备本机识别资源…';
  await preparePhoto((done,total)=>{if(status.isConnected)status.textContent=`下载与检查资源 ${done}/${total}，照片始终留在本机…`;});
  if(task!==photoTask||!modal.open||!status.isConnected)return;
  status.textContent='正在本机分析，首次加载可能需要几十秒…';
  const result=await recognizePhoto(ui.photoPixels.slice());ui.photoResult=result;
  if(task!==photoTask||!modal.open||!status.isConnected)return;
  status.textContent=(result.uncertain?'未能可靠匹配，请搜索食物。':'请选择食物。')+' 照片已清理。';
  modal.querySelector('#photo-results').innerHTML=`<h3 style="margin:20px 0 10px">${result.uncertain?'也可以手动选择':'可能是这些食物'}</h3>${result.candidates.map(c=>`<button class="photo-candidate" data-action="photo-candidate" data-id="${esc(c.group)}"><span>${esc(c.name)}</span><span>选状态与份量 ${icon('chevron',14)}</span></button>`).join('')}`;
  modal.querySelector('[data-action="run-photo"]').textContent='请重新拍摄或选照片';
  }catch(error){if(task===photoTask&&modal.open&&status.isConnected)status.textContent=error.message+' 本次照片已清理，可重新选择。';if(error.name!=='AbortError')throw error;}finally{if(task===photoTask)releasePhotoInput();pickers.forEach(input=>input.disabled=false);}
}
function photoCandidate(group){
  const foods=allFoods().filter(f=>f.visualGroup===group);
  openModal(`<div class="modal-header"><h2>确认是哪一种</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><p>选择实际吃的生熟状态。</p><div>${foodRows(foods)}</div></div>`);
  ui.pickerMeal=ui.photoMeal;ui.pickerFromPhoto=true;
}
function chart(points,label,color='var(--green)'){
  if(!points.length)return empty('chart','积累一点记录，再看变化','图表只展示你的真实记录，不用模拟数据填充。');
  const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),floor=min===max?Math.max(0,min-1):Math.max(0,min-(max-min)*.15),ceil=min===max?max+1:max+(max-min)*.15;
  const x=i=>40+i*(470/Math.max(1,points.length-1)),y=v=>145-(v-floor)/Math.max(.001,ceil-floor)*120;
  return `<svg class="chart" viewBox="0 0 540 185" role="img" aria-label="${esc(label)}，${points.map(p=>`${p.date}：${p.value}${p.partial?'，有缺失':''}`).map(esc).join('；')}">${[0,1,2].map(i=>{const val=floor+(ceil-floor)*i/2;return `<path class="grid" d="M40 ${y(val)}H515"/><text x="0" y="${y(val)+3}">${fmt(val,1)}</text>`;}).join('')}<path d="${points.map((p,i)=>`${i?'L':'M'}${x(i)} ${y(p.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="${p.partial?4:3}" fill="${p.partial?'var(--surface)':color}" stroke="${color}" stroke-width="1.5"><title>${esc(p.date)} ${fmt(p.value,1)}${p.partial?'（有缺失）':''}</title></circle>`).join('')}<text x="40" y="177">${points[0].date.slice(5)}</text><text x="475" y="177">${points.at(-1).date.slice(5)}</text></svg>`;
}
function trendsPage(){
  const s=state(),to=C.dateKey(),from=C.addDays(to,-ui.range+1),r=C.exportRecords(s,from,to);
  const sessions=r.sessions.filter(s=>s.dayId&&s.status==='completed'),sets=sessions.flatMap(s=>s.exercises.flatMap(e=>e.sets)).filter(x=>x.done);
  const neck=sessions.filter(s=>s.journal.neck!=null).map(s=>({date:s.date,value:s.journal.neck}));
  const chin=sessions.flatMap(s=>s.exercises.filter(e=>/chin/.test(e.exerciseId)).map(e=>({done:e.sets.filter(s=>s.done).length,total:e.sets.length}))),chinTotal=chin.reduce((a,x)=>a+x.total,0),chinDone=chin.reduce((a,x)=>a+x.done,0);
  const weights=[...r.body].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({date:x.date,value:x.weight}));
  return `${pageTitle('趋势',ibtn('weight','plus','记录体重'))}<div class="row between wrap" style="margin-bottom:22px"><div class="tabs" style="margin-bottom:0">${[7,30,90].map(n=>`<button class="tab ${ui.range===n?'active':''}" data-range="${n}">${n===7?'近一周':n===30?'近一月':'近三月'}</button>`).join('')}</div><span class="tiny muted">${from} — ${to}</span></div><div class="trend-metrics">${[['训练次数',sessions.length,'次'],['逐组打卡',sets.length,'组'],['下巴回收',chinTotal?`${Math.round(chinDone/chinTotal*100)}%`:'—','已结束训练完成率']].map(([label,val,sub])=>`<div class="card"><span class="small muted">${label}</span><span class="number">${val}</span><span class="tiny muted">${sub}</span></div>`).join('')}</div><div class="grid2"><section class="card">${section('体重变化',`<button class="linkbtn" data-action="weight">记录体重 ${icon('plus',13)}</button>`)}${chart(weights,'体重 kg')}</section><section class="card">${section('每日热量')} ${chart(r.dailyNutrition.filter(d=>d.nutrients.kcal.value!=null).map(d=>({date:d.date,value:d.nutrients.kcal.value,partial:!d.nutrients.kcal.complete})),'每日热量 kcal','var(--accent)')}<p class="chart-caption">空心点：数据有缺失</p></section><section class="card">${section('头颈紧张程度')}${chart(neck,'头颈紧张程度 0–10 分')}<p class="chart-caption">主观评分 · 0–10</p></section><section class="card">${section('日均营养')}<div class="stack">${C.REQUIRED_NUTRIENTS.filter(k=>k!=='kcal').map(k=>{const complete=r.dailyNutrition.filter(d=>d.nutrients[k].complete);const avg=complete.length?complete.reduce((a,d)=>a+d.nutrients[k].value,0)/complete.length:null;return `<div class="row between"><span class="small">${C.NUTRIENTS[k][0]}</span><span class="small">${fmt(avg,1)} ${C.NUTRIENTS[k][1]}</span></div>`;}).join('')}</div><p class="chart-caption">日均值仅含该项营养完整的记录日</p></section><section class="card span2">${section('体态记录')}${disclosure('拍照记录建议','<p>每 4 周拍摄一次，保持高度、距离、自然姿势和角度一致。照片暂请保存在系统相册，App 内对比功能尚未开放。</p><p>照片只用于外观记录，不用于诊断疾病或计算 Cobb 角。</p>')}<div class="row between">${btn('weight','记录体重与描述','outline')}</div></section></div>`;
}
function profilePage(){
  const s=state(),a=C.activeActivation(s),p=C.activePlan(s),last=s.settings.lastBackupAt;
  return `${pageTitle('我的')}<div class="grid2"><div class="stack"><section class="card">${section('我的训练计划')}<h3>${esc(p?.name??'暂无生效计划')}</h3><div class="row wrap" style="margin-top:21px">${btn('import-plan',`${icon('upload',16)} 导入新计划`,'primary')}${btn('plan-editor','编辑当前计划','outline')}</div><hr class="divider">${s.plans.slice().reverse().map(v=>{const activation=s.activations.filter(a=>a.planKey===v.key).at(-1);return `<div class="version"><div class="row between"><h3>${esc(v.plan.name)}</h3>${tag(a?.planKey===v.key?'当前':activation&&activation.effectiveDate>C.dateKey()?'待生效':'已保存',a?.planKey===v.key?'':'gray')}</div><p>版本 ${v.plan.planVersion}${activation?` · 最近启用 ${activation.effectiveDate}`:''}</p><div class="row gap8" style="margin-top:9px"><button class="linkbtn" data-action="export-plan" data-id="${esc(v.key)}">导出 JSON</button><button class="linkbtn" data-action="activate-plan" data-id="${esc(v.key)}">${a?.planKey===v.key?'重新安排周期':'启用 / 回滚'}</button></div></div>`;}).join('')}</section><section class="card">${section('导出分析数据')}<div class="row wrap" style="margin-top:18px">${btn('export-records',`${icon('download',16)} 选择日期与格式`,'primary')}${btn('example-plan','下载计划示例','outline')}</div></section></div><div class="stack"><section class="card">${section('完整备份与恢复',icon('shield',20))}<div class="info-list"><div class="info-line">${icon('download',18)}<div><h4>完整备份</h4><p>${last?`上次发起导出：${new Date(last).toLocaleString('zh-CN')}（请确认文件已保存）`:'还没有导出过完整备份。'}</p></div></div><div class="info-line">${icon('refresh',18)}<div><h4>保留恢复前版本</h4><p>最近 14 份本机快照</p></div></div></div><div class="row wrap" style="margin-top:21px">${btn('backup','导出完整备份','primary')}${btn('restore','从文件恢复','outline')}${btn('checkpoints','本机历史快照','outline')}</div></section><section class="card">${section('偏好与本机状态')}<div class="form-grid profile-preferences">${select('theme','显示模式',[['system','跟随系统'],['light','浅色'],['dark','深色']],s.settings.theme,'data-pref="theme"')}<div class="field"><span class="field-label" id="cycle-start-label">当前周期起点</span><output id="f-cycle-start" class="setting-value" aria-labelledby="cycle-start-label">${esc(a?.effectiveDate??'—')}</output></div></div><div class="selectable-row"><div class="info"><h4>营养目标</h4></div>${btn('targets','设置','secondary')}</div><div class="selectable-row"><div class="info"><h4>离线资源</h4><p data-offline>${esc(ui.offline)}</p></div>${btn('check-offline','检查','outline')}</div>${ui.update?btn('update','已下载新版本，重新打开更新','primary','style="margin-top:15px"'):''}<div class="selectable-row"><div class="info"><h4>本地存储保护</h4><p id="persist-status">申请减少被浏览器自动清理的可能</p></div>${btn('persist','申请','outline')}</div><button class="linkbtn" data-action="intro">安装与使用帮助 ${icon('chevron',13)}</button></section><section class="card">${section('关于 BodyTrack')}<p class="small muted">记录只保存在本机，请定期备份。</p>${disclosure('隐私与使用范围','<p>记录不上传，不同设备或浏览器之间不会自动同步。清理网站数据会删除记录与本机快照；请将完整备份另存到「文件」。</p><p>用于一般健身记录，不提供疾病诊断或未经评估的单侧脊柱矫正。</p><p>数据版本 1 · 计划 Schema 1.0</p>')}<p class="small muted">BodyTrack 1.1.3</p></section></div></div>`;
}

function showIntro(){openModal(`<div class="modal-header"><h2>让 BodyTrack 留在主屏幕</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><div class="info-list"><div class="info-line">${icon('home',21)}<div><h4>01 / 用 Safari 添加到主屏幕</h4><p>打开本站 → 分享 → 添加到主屏幕；如出现「作为网页 App 打开」，请启用。之后从主屏幕图标进入。</p></div></div><div class="info-line">${icon('cloud',21)}<div><h4>02 / 等待离线资源准备完成</h4><p>在「我的」检查离线状态；首次完成后，打开飞行模式重新进入进行真机验证。首次访问及更新仍需联网。</p></div></div><div class="info-line">${icon('dumbbell',21)}<div><h4>03 / 第一天，从胸部训练开始</h4><p>漏练不会自动推进，完成或明确跳过后才进入下一天。休息日也需确认。可以调整日期，跳过后可独立补练。</p></div></div><div class="info-line">${icon('download',21)}<div><h4>04 / 每周保留一份完整备份</h4><p>点击备份后，将文件保存到 iPhone「文件」。浏览器清理、设备丢失或更换网址都可能使本机数据不可访问，备份是恢复的依据。</p></div></div></div>${callout('首次启用日作为周期起点。若要改变起点，请在「我的 → 当前计划 → 重新安排周期」设置生效日期。')}</div><div class="modal-footer">${btn('intro-done','明白了，开始记录','primary')}</div>`);}
function journalForm(id,finishing=false){
  const s=state().sessions.find(s=>s.id===id),j=s.journal,p=C.completion(s);
  const scale=(name,label,min,max)=>select(name,label,[['','尚未记录'],...Array.from({length:max-min+1},(_,i)=>[min+i,`${min+i} 分`])],j[name]??'');
  formModal(finishing?'结束训练 · 听听身体的声音':'训练感受与日记','journal',`${finishing&&s.dayId&&p.done<p.total?callout(`本次已完成 ${p.done}/${p.total} 组。结束训练会推进周期；未完成的组将如实保留。`,true):''}<div class="form-grid">${scale('energy','体能状态 · 1 低 / 5 高',1,5)}${scale('fatigue','疲劳程度 · 1 低 / 10 高',1,10)}${scale('satisfaction','训练满意度 · 1–5',1,5)}${scale('pain','疼痛 · 0 无 / 10 最强',0,10)}${scale('neck','头颈紧张 · 0 无 / 10 最强',0,10)}${field('painLocation','疼痛具体部位',j.painLocation??'')}${field('soreness','肌肉酸痛位置',j.soreness??'')}${field('scapula','肩胛稳定性感受',j.scapula??'')}${field('trunk','躯干控制感受',j.trunk??'')}${field('warmup','下巴回收及胸椎伸展感受',j.warmup??'')}${textarea('diary','今天，想留给自己的话',j.diary??'','wide')}</div>`,finishing?'保存感受并结束训练':'保存感受',`data-id="${id}" data-finishing="${finishing}"`);
}
function newFoodForm(food=null,quickMeal=null){
  const f=food??{name:'',state:'packaged',source:'',per100:{}};
  formModal(food?'修改自定义食物':quickMeal?'记录新食物':'添加自定义食物','food',`<p>填写每 100 g 含量；未知留空。</p>${disclosure('标签换算方法','<p>每份含量 ÷ 每份克数 × 100；热量仅标 kJ 时，kcal = kJ ÷ 4.184。明确为零才填 0。</p>')}<div class="form-grid">${field('name','食物名称',f.name,'text','required maxlength="150"')}${select('state','食用状态',[['raw','生食 / 生重'],['cooked','熟食 / 熟重'],['packaged','包装即食']],f.state)}<div class="wide">${field('source','数据来源',f.source,'text','required maxlength="1000"')}</div></div><h3 class="form-section">每 100 g 营养含量</h3><div class="form-grid">${C.REQUIRED_NUTRIENTS.map(k=>numeric(`n-${k}`,`${C.NUTRIENTS[k][0]} · ${C.NUTRIENTS[k][1]}`,f.per100[k]??'')).join('')}</div><details class="food-source"><summary>可选：矿物质与维生素</summary><div class="form-grid">${Object.entries(C.NUTRIENTS).filter(([k])=>!C.REQUIRED_NUTRIENTS.includes(k)).map(([k,[name,unit]])=>numeric(`n-${k}`,`${name} · ${unit}`,f.per100[k]??'')).join('')}</div></details>${quickMeal?`<h3 class="form-section">本次食用</h3><div class="form-grid">${numeric('grams','实际食用重量 · g','','required min="0.1" max="100000"')}${select('meal','餐次',C.MEALS.map(m=>[m,m]),quickMeal)}</div>`:''}`,quickMeal?'保存食物并记录':'保存食物',`${food?`data-id="${food.id}"`:''} ${quickMeal?'data-quick="true"':''}`);
}
function addMealForm(meal='加餐',foodId=null,fromPhoto=false){
  if(!foodId){ui.pickerFromPhoto=false;showFoodPicker(meal);return;}
  const f=allFoods().find(f=>f.id===foodId);if(!f)throw new Error('该食物暂不可用，请搜索其他条目');
  formModal('确认食物与实际份量','meal',`<div class="chosen-food"><h3>${esc(f.name)}</h3><p>${{raw:'按生重 / 未烹调称重',cooked:'按熟重 / 实际可食部分称重',packaged:'按即食可食部分称重'}[f.state]}</p><button class="linkbtn" data-action="change-food" data-meal="${meal}">换一种食物 ${icon('refresh',13)}</button></div><input type="hidden" name="foodId" value="${esc(f.id)}">${f.portions?.length?`<div style="margin:15px 0">${select('portion','参考份量（估算）',[['','直接填写克数'],...f.portions.map((p,i)=>[i,`${p.label} ≈ ${p.grams} g`])],'','data-portion')}</div>`:''}<div class="form-grid">${numeric('grams','实际食用重量 · g','','required min="0.1" max="100000" data-meal-grams')}${select('measurement','重量依据',[['weighed','实际称重'],['manual-estimate','自己估算'],['household-estimate','数据库参考份量（估算）']],'weighed')}${select('meal','餐次',C.MEALS.map(m=>[m,m]),meal)}${field('date','记录日期',ui.date,'date',`required max="${C.dateKey()}"`)}</div><div id="meal-preview" class="meal-nutrition-preview"><p>填写克数后计算营养</p></div><details class="food-source"><summary>查看每 100g 营养与来源</summary><p class="small muted">${esc(f.source)}</p>${f.sourceUrl?`<p class="tiny muted">${esc(f.sourceDescription)}</p><a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看 USDA 原始条目 ↗</a>`:''}<div class="nutrition-grid">${C.REQUIRED_NUTRIENTS.map(k=>`<div><span>${C.NUTRIENTS[k][0]}</span><strong>${fmt(f.per100[k],1)} ${C.NUTRIENTS[k][1]}</strong></div>`).join('')}</div></details><p class="small muted">油、盐和酱料请另记。</p>`,'确认并记录',`data-method="${fromPhoto?'photo-confirmed':f.sourceUrl?'catalog':'custom'}"`);
}
function updateMealPreview(){
  const f=modal.querySelector('[data-form="meal"]');if(!f)return;
  const food=allFoods().find(x=>x.id===f.elements.foodId.value),g=Number(f.elements.grams.value),preview=modal.querySelector('#meal-preview');
  if(!g||g<.1||g>100000){preview.innerHTML='<p>填入有效份量后，自动计算参考摄入。</p>';return;}
  const n=C.calculateNutrition(food.per100,g);
  preview.innerHTML=`<p>${g} g · 参考摄入</p><div class="row wrap gap24">${['kcal','protein','carbs','fat'].map(k=>`<div><strong>${fmt(n[k],1)} <small>${C.NUTRIENTS[k][1]}</small></strong><span>${C.NUTRIENTS[k][0]}</span></div>`).join('')}</div>`;
}
function recipeForm(){
  if(!allFoods().length){toast('请先添加至少一种食物，再制作菜谱');return;}
  ui.recipe=[];showRecipe();
}
function showRecipe(){
  formModal('创建自定义菜谱','recipe',`<p>逐项加入已称重食材，填写制作完成后的成品总重。任何食材营养缺失时，该项菜谱营养保持未知。</p><div class="form-grid">${field('name','菜谱名称',ui.recipeName??'','text','required maxlength="150"')}${numeric('finalGrams','成品总重量 · g',ui.recipeWeight??'','required min="0.1" max="100000"')}</div><h3 class="form-section">已加入的食材</h3>${ui.recipe.map((x,i)=>`<div class="selectable-row"><span class="spacer small">${esc(x.name)} · ${x.grams} g</span>${ibtn('remove-ingredient','trash','移除食材',`data-index="${i}"`)}</div>`).join('')||'<p class="small muted">尚未添加食材</p>'}<div class="form-grid" style="margin-top:18px">${select('ingredient','选择食材',allFoods().map(f=>[f.id,`${f.name} · ${{raw:'生',cooked:'熟',packaged:'包装'}[f.state]}`]),allFoods()[0].id)}${numeric('ingredientGrams','食材重量 · g','','min="0.1" max="100000"')}</div>${btn('add-ingredient',`${icon('plus',14)} 加入这份食材`,'outline','style="margin-top:12px"')}`,'保存菜谱');
}
function targetsForm(){formModal('自定义每日营养目标','targets',`<p>留空表示不设目标。</p><div class="form-grid">${C.REQUIRED_NUTRIENTS.map(k=>numeric(k,`${C.NUTRIENTS[k][0]} · ${C.NUTRIENTS[k][1]}`,state().settings.targets[k]??'')).join('')}</div>`);}
function showPlanImport(p){
  ui.pendingPlan=p;
  const old=C.activePlan(state()),diff=C.planDiff(old,p);
  formModal('新计划预览 · 由你决定启用','confirm-plan',`<div class="row between wrap"><h3>${esc(p.name)}</h3>${tag(`v${p.planVersion}`)}</div><p class="small muted" style="margin-top:10px">${esc(p.planId)} · ${p.trainingDays.length} 个训练日 · ${p.cycleDefinition.length} 天循环</p><p class="small muted">${esc(p.instructions)}</p>${callout(esc(p.precautions))}<h3 class="form-section">与当前计划的差异</h3><ul class="text-list">${diff.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><details><summary class="small">查看完整计划 JSON</summary><pre class="log">${esc(JSON.stringify(p,null,2))}</pre></details><div style="margin-top:20px">${field('effectiveDate','生效日期（当天从周期第 1 天开始）',p.effectiveDate<C.dateKey()?C.dateKey():p.effectiveDate,'date',`required min="${C.dateKey()}"`)}</div><label class="checkbox-line"><input type="checkbox" name="confirmed" required><span>我已审阅动作、训练量和注意事项，理解这是训练建议，不是诊断或单侧脊柱矫正处方。</span></label><p class="tiny muted">历史训练不会被覆盖。启用后重启一个独立周期；当前进行中的训练需先结束。</p>`,'确认保存并启用');
}
function planEditor(){
  const p=C.clone(C.activePlan(state()));if(!p){toast('请先导入计划');return;}
  p.planVersion=Math.max(...state().plans.filter(x=>x.plan.planId===p.planId).map(x=>x.plan.planVersion))+1;p.generatedAt=new Date().toISOString();p.effectiveDate=C.dateKey();ui.editPlan=p;
  showPlanEditor();
}
function showPlanEditor(){
  const p=ui.editPlan;
  formModal('编辑计划 · 保存为新版本','plan-editor',`<p>保存为版本 ${p.planVersion}，保留历史记录。</p><div class="form-grid">${field('planName','计划名称',p.name,'text','required maxlength="120"')}${field('effectiveDate','建议生效日期',p.effectiveDate,'date',`required min="${C.dateKey()}"`)}</div>${p.trainingDays.map(d=>`<div class="plan-day" style="margin-top:22px"><div class="row between"><h3>${esc(d.name)}</h3><button type="button" class="linkbtn" data-action="add-plan-exercise" data-id="${esc(d.id)}">添加动作 ${icon('plus',13)}</button></div>${d.exercises.map(e=>`<div class="version"><div class="row between"><span class="tiny muted">动作</span>${ibtn('remove-plan-exercise','trash','删除动作',`data-id="${esc(e.id)}"`)}</div><div class="form-grid" style="margin-top:8px"><div class="wide">${field(`e-${e.id}-name`,'动作名称（可直接替换）',e.name,'text','required maxlength="150"')}</div>${numeric(`e-${e.id}-sets`,'组数',e.sets,'required min="1" max="12" step="1"')}${numeric(`e-${e.id}-repetitions`,'每组次数',e.repetitions,'required min="1" max="100" step="1"')}${select(`e-${e.id}-module`,'模块',[['warmup','独立热身'],['main','训练']],e.module)}${select(`e-${e.id}-perSide`,'记录侧别',[['false','双侧 / 不分侧'],['true','左右分别']],e.perSide)}${numeric(`e-${e.id}-holdSeconds`,'每次保持秒数',e.holdSeconds,'required max="300" step="1"')}<div></div><div class="wide">${field(`e-${e.id}-instructions`,'动作说明',e.instructions,'text','required maxlength="2000"')}</div><div class="wide">${field(`e-${e.id}-precautions`,'注意事项',e.precautions,'text','required maxlength="2000"')}</div></div></div>`).join('')}</div>`).join('')}${callout('周期安排、余力范围等高级调整可通过计划 JSON 修改后导入。不要在未获专业评估时指定单侧脊柱矫正。')}`,'预览新版本');
}
function collectPlanEditor(){
  const f=modal.querySelector('form'),fd=new FormData(f),p=ui.editPlan;p.name=fd.get('planName');p.effectiveDate=fd.get('effectiveDate');
  for(const d of p.trainingDays)for(const e of d.exercises)for(const k of ['name','sets','repetitions','module','perSide','holdSeconds','instructions','precautions']){const v=fd.get(`e-${e.id}-${k}`);e[k]=['sets','repetitions','holdSeconds'].includes(k)?Number(v):k==='perSide'?v==='true':v;}
}
function exportForm(){
  const s=state(),dates=[...s.sessions.map(x=>x.date),...s.meals.map(x=>x.date),...s.body.map(x=>x.date)].sort();
  formModal('导出给 ChatGPT 分析','export',`<div class="form-grid">${field('from','开始日期',dates[0]??C.addDays(C.dateKey(),-29),'date','required')}${field('to','结束日期',C.dateKey(),'date','required')}<div class="wide">${select('format','导出格式',[['json','JSON · 完整结构化记录'],['training','CSV · 逐组训练与感受'],['nutrition','CSV · 食物与实际营养'],['report','Markdown · 简明分析报告']], 'json')}</div></div>${callout('分析导出不能用于恢复；请另外保存完整备份。')}`,'导出文件');
}
function showRestore(data){
  ui.pendingBackup=data;
  formModal('恢复前确认','confirm-restore',`<p>这会用备份替换本机当前数据，恢复前会保留一份本机快照。建议先额外导出当前完整备份。</p><div class="nutrition-grid">${[['训练',data.sessions.length],['饮食',data.meals.length],['计划版本',data.plans.length]].map(([name,v])=>`<div class="nutrition-tile"><p>${name}</p><span class="number">${v}</span></div>`).join('')}</div><label class="checkbox-line"><input type="checkbox" required name="confirmed"><span>我已确认文件内容，并理解恢复会替换当前记录。</span></label>`,'确认恢复');
}
function showCheckpoints(){openModal(`<div class="modal-header"><h2>本机历史快照</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><p>最多保留最近 14 份。快照也在这台设备上，无法应对清理网站数据或设备丢失。</p>${store.checkpoints.length?store.checkpoints.slice().reverse().map(c=>`<div class="selectable-row"><div class="info"><h4>${esc(c.label)}</h4><p>${new Date(c.createdAt).toLocaleString('zh-CN')} · ${c.data.sessions.length} 次记录</p></div>${btn('restore-checkpoint','恢复','outline',`data-id="${c.id}"`)}</div>`).join(''):empty('clock','暂无历史快照','首次修改或关键操作前会自动创建。')}</div>`);}
function confirm(title,message,action,id=''){openModal(`<div class="modal-header"><h2>${title}</h2>${ibtn('close','close','关闭')}</div><div class="modal-body"><p>${message}</p></div><div class="modal-footer">${btn('close','取消','outline')}${btn(action,'确认','primary',`data-id="${esc(id)}"`)}</div>`);}

function download(content,name,type='application/json'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast('已发起文件导出，请确认保存到「文件」或下载目录');
}
async function pickFile(kind){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.addEventListener('change',async()=>{
    try{const f=input.files?.[0];if(!f)return;const limit=kind==='plan'?2_000_000:50_000_000;if(f.size>limit)throw new Error(`文件过大，最多 ${limit/1e6} MB`);const text=await f.text();if(kind==='plan')showPlanImport(C.parsePlan(text));else showRestore(C.parseBackup(text));}
    catch(e){toast(e.message);}
  },{once:true});input.click();
}
async function action(name,el){
  const id=el?.dataset.id;
  switch(name){
    case 'close':modal.close();break;
    case 'effort-help':effortHelp();break;
    case 'toggle-effort':ui.effortDetails=!ui.effortDetails;render();break;
    case 'food-category':ui.foodCategory=id;render();break;
    case 'pick-food':addMealForm(ui.pickerMeal??'加餐',id,!!ui.pickerFromPhoto);break;
    case 'change-food':ui.pickerFromPhoto=false;showFoodPicker(el.dataset.meal);break;
    case 'photo-food':await showPhotoFood();break;
    case 'run-photo':await runPhoto();break;
    case 'photo-candidate':photoCandidate(id);break;
    case 'search-from-photo':ui.pickerFromPhoto=false;showFoodPicker(ui.photoMeal);break;
    case 'intro':showIntro();break;
    case 'intro-done':await save(s=>s.settings.introSeen=true);modal.close();break;
    case 'go-training':ui.page='training';ui.training='today';ui.sessionId=null;render();window.scrollTo({top:0});break;
    case 'start':{await save(s=>C.startSession(s));ui.open.clear();render();break;}
    case 'skip':confirm('明确跳过这一天？','跳过会留下记录并进入下一天；跳过的训练之后可以独立补练，不会再次推进周期。','skip-confirm');break;
    case 'skip-confirm':await save(s=>C.skipOccurrence(s));modal.close();break;
    case 'reschedule':{const occ=C.nextOccurrence(state());formModal('调整当前待完成日期','reschedule',`${field('date','新的计划日期',occ.plannedDate<C.dateKey()?C.dateKey():occ.plannedDate,'date',`required min="${C.dateKey()}"`)}${callout('调整后从新日期继续，保留历史记录。')}`);break;}
    case 'toggle-set':await save(s=>{const set=s.sessions.find(x=>x.id===el.dataset.session)?.exercises.flatMap(e=>e.sets).find(x=>x.id===id);if(!set)throw new Error('找不到该组');if(!set.done&&!(set.reps>0))throw new Error('先填写实际完成次数，再标记打卡');set.done=!set.done;});break;
    case 'finish':journalForm(id,true);break;
    case 'journal':journalForm(id);break;
    case 'journal-last':journalForm(state().sessions.filter(s=>s.status==='completed').at(-1).id);break;
    case 'view-session':ui.sessionId=id;ui.training='history';ui.open.clear();render();window.scrollTo({top:0});break;
    case 'back-history':ui.sessionId=null;ui.training='history';render();break;
    case 'makeup':await save(s=>C.makeupSession(s,id));ui.training='today';ui.sessionId=null;render();break;
    case 'prev-date':ui.date=C.addDays(ui.date,-1);render();break;
    case 'next-date':if(ui.date<C.dateKey())ui.date=C.addDays(ui.date,1);render();break;
    case 'add-meal':if(ui.page!=='diet')ui.date=C.dateKey();addMealForm(el.dataset.meal??'加餐');break;
    case 'new-food':newFoodForm();break;
    case 'new-food-quick':newFoodForm(null,el.dataset.meal);break;
    case 'edit-food':newFoodForm(state().foods.find(f=>f.id===id));break;
    case 'delete-food':confirm('删除自定义食物？','只从食物库移除。已有饮食记录保留营养快照。','delete-food-confirm',id);break;
    case 'delete-food-confirm':await save(s=>s.foods=s.foods.filter(f=>f.id!==id));modal.close();break;
    case 'use-food':addMealForm('加餐',id);break;
    case 'delete-meal':confirm('删除这条饮食记录？','删除后当天营养汇总会重新计算。','delete-meal-confirm',id);break;
    case 'delete-meal-confirm':await save(s=>s.meals=s.meals.filter(m=>m.id!==id),'删除饮食前');modal.close();break;
    case 'edit-meal':{const m=state().meals.find(m=>m.id===id);formModal('修改食用记录','edit-meal',`<p>${esc(m.name)}</p>${disclosure('记录时的数据来源',`<p>${esc(m.source)}</p>`)}<div class="form-grid">${numeric('grams','实际重量 · g',m.grams,'required min="0.1" max="100000"')}${select('meal','餐次',C.MEALS.map(m=>[m,m]),m.meal)}${field('date','日期',m.date,'date',`required max="${C.dateKey()}"`)}</div>`,'保存修改',`data-id="${id}"`);break;}
    case 'recipe':ui.recipeName='';ui.recipeWeight='';recipeForm();break;
    case 'add-ingredient':{const fd=new FormData(modal.querySelector('form'));ui.recipeName=fd.get('name');ui.recipeWeight=fd.get('finalGrams');const f=allFoods().find(f=>f.id===fd.get('ingredient'));const grams=Number(fd.get('ingredientGrams'));if(!grams||grams<.1||grams>100000)throw new Error('请填写有效食材重量');ui.recipe.push({...C.clone(f),grams});showRecipe();break;}
    case 'remove-ingredient':{const fd=new FormData(modal.querySelector('form'));ui.recipeName=fd.get('name');ui.recipeWeight=fd.get('finalGrams');ui.recipe.splice(Number(el.dataset.index),1);showRecipe();break;}
    case 'targets':targetsForm();break;
    case 'weight':formModal('记录体重与身体感受','weight',`<div class="form-grid">${field('date','日期',C.dateKey(),'date',`required max="${C.dateKey()}"`)}${numeric('weight','体重 · kg','','required min="1" max="500"')}${textarea('notes','围度、自然姿势、肩颈或单腿稳定性观察','','wide')}</div>${callout('记录自然姿势和主观变化即可，不从外观推断脊柱角度、肱骨头位置或颈椎结构异常。')}`);break;
    case 'import-plan':await pickFile('plan');break;
    case 'plan-editor':planEditor();break;
    case 'add-plan-exercise':collectPlanEditor();{const d=ui.editPlan.trainingDays.find(d=>d.id===id);d.exercises.push({id:C.uid(),name:'新动作',module:'main',sets:2,repetitions:10,perSide:false,holdSeconds:0,intensity:{rirMin:2,rirMax:4},instructions:'在舒适范围内缓慢完成。',precautions:'避免疼痛与明显代偿。'});}showPlanEditor();break;
    case 'remove-plan-exercise':collectPlanEditor();ui.editPlan.trainingDays.forEach(d=>d.exercises=d.exercises.filter(e=>e.id!==id));showPlanEditor();break;
    case 'activate-plan':formModal('启用计划 / 回滚版本','activate',`<p>${esc(state().plans.find(p=>p.key===id).plan.name)} · ${esc(id)}</p>${field('date','生效日期',C.dateKey(),'date',`required min="${C.dateKey()}"`)}${callout('启用后从该版本的周期第 1 天重新开始。旧计划、逐组记录和补练历史都保留；后续已安排的其他生效日期也会保留，请留意版本列表。')}<label class="checkbox-line"><input type="checkbox" required><span>确认启用此版本并开始新的周期。</span></label>`,'确认启用',`data-id="${esc(id)}"`);break;
    case 'export-plan':download(JSON.stringify(state().plans.find(p=>p.key===id).plan,null,2),`BodyTrack-plan-${id.replace(/[^a-zA-Z0-9@.-]/g,'_')}.json`);break;
    case 'example-plan':download(JSON.stringify(C.builtinPlan(C.dateKey()),null,2),'BodyTrack-plan-example.json');break;
    case 'export-records':exportForm();break;
    case 'backup':{download(JSON.stringify(C.createBackup(state()),null,2),`BodyTrack-backup-${C.dateKey()}-${Date.now()}.json`);await save(s=>s.settings.lastBackupAt=new Date().toISOString());break;}
    case 'restore':await pickFile('backup');break;
    case 'checkpoints':await store.loadCheckpoints();showCheckpoints();break;
    case 'restore-checkpoint':showRestore(C.clone(store.checkpoints.find(c=>c.id===id).data));break;
    case 'persist':{const granted=await navigator.storage?.persist?.();toast(granted?'已获得持久存储保护，仍请保留外部备份':'浏览器未授予持久存储，请定期导出备份');document.querySelector('#persist-status').textContent=granted?'已获得持久存储保护；手动清理仍会删除数据。':'未获持久存储保护；请定期备份。';break;}
    case 'check-offline':await offlineCheck();break;
    case 'update':if(ui.update){ui.update.postMessage('ACTIVATE_UPDATE');toast('正在切换已下载的新版本…');}break;
  }
}

document.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el||el.disabled)return;
  try{
    if(el.dataset.page){navigate(el.dataset.page);return;}
    if(el.dataset.training){ui.training=el.dataset.training;ui.sessionId=null;render();return;}
    if(el.dataset.diet){ui.diet=el.dataset.diet;render();return;}
    if(el.dataset.range){ui.range=Number(el.dataset.range);render();return;}
    if(el.dataset.action){el.disabled=true;try{await queue;await action(el.dataset.action,el);}finally{if(el.isConnected)el.disabled=el.dataset.action==='run-photo'&&!ui.photoPixels;}}
  }catch(e){toast(e.message??'操作失败，请重试');}
});
document.addEventListener('toggle',event=>{const d=event.target;if(d.dataset?.exerciseDetails){if(d.open)ui.open.add(d.dataset.exerciseDetails);else ui.open.delete(d.dataset.exerciseDetails);}},true);
document.addEventListener('change',async event=>{
  const el=event.target;
  try{
    if(el.hasAttribute('data-photo-file')){const file=el.files?.[0];if(!file)return;clearTransientPhoto();const task=photoTask;const decoded=await decodePhoto(file);if(task!==photoTask||!modal.open||!el.isConnected){decoded.pixels.fill(0);return;}ui.photoPixels=decoded.pixels;ui.photoPreview=decoded.preview;const target=modal.querySelector('#photo-preview');if(target){target.hidden=false;modal.querySelector('#photo-results').innerHTML='';target.innerHTML=`<img src="${decoded.preview}" alt="本机识别的中央裁切预览"><p>识别区域</p>`;modal.querySelector('[data-action="run-photo"]').disabled=false;modal.querySelector('[data-action="run-photo"]').textContent='开始识别';}return;}
    if(el.hasAttribute('data-portion')){const f=modal.querySelector('[data-form="meal"]'),food=allFoods().find(x=>x.id===f.elements.foodId.value);if(el.value!==''){f.elements.grams.value=food.portions[Number(el.value)].grams;f.elements.measurement.value='household-estimate';}updateMealPreview();return;}
    if(el.hasAttribute('data-meal-grams'))updateMealPreview();
    if(el.hasAttribute('data-date')){if(C.isDate(el.value)){ui.date=el.value;render();}return;}
    if(el.dataset.pref==='theme'){await save(s=>s.settings.theme=el.value);return;}
    if(el.dataset.setting){await save(s=>s.settings[el.dataset.setting]=el.checked);return;}
    if(el.dataset.set){
      const value=el.value===''?null:Number(el.value),key=el.dataset.key;
      if(value!==null&&(!Number.isFinite(value)||value<0||value>Number(el.max)||(key==='reps'&&!Number.isInteger(value))))throw new Error('请输入有效数值；次数为整数，吃力程度 0–10 分，余力 0–10 次');
      await save(s=>{const set=s.sessions.find(s=>s.id===el.dataset.session).exercises.flatMap(e=>e.sets).find(s=>s.id===el.dataset.set);set[key]=value;if(key==='reps'&&!(value>0))set.done=false;},null,false);
    }
    if(el.dataset.exercise)await save(s=>{s.sessions.find(s=>s.id===el.dataset.session).exercises.find(e=>e.id===el.dataset.exercise)[el.dataset.key]=el.value;},null,false);
  }catch(e){toast(e.message);if(el.dataset.set){const set=state().sessions.find(s=>s.id===el.dataset.session)?.exercises.flatMap(e=>e.sets).find(s=>s.id===el.dataset.set);el.value=set?.[el.dataset.key]??'';}}
});

document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.foodSearch){
    const query=el.value,target=el.dataset.foodSearch;
    if(target==='library')ui.foodQuery=query;
    const results=searchFoods(allFoods(),query,target==='library'?ui.foodCategory:'全部');
    document.querySelector(target==='library'?'#library-results':'#picker-results').innerHTML=foodRows(results,target);
  }
  if(el.hasAttribute('data-meal-grams')){const f=el.closest('form');if(f.elements.portion)f.elements.portion.value='';if(f.elements.measurement.value==='household-estimate')f.elements.measurement.value='manual-estimate';updateMealPreview();}
});

document.addEventListener('submit',async event=>{
  const f=event.target;if(!f.dataset.form)return;event.preventDefault();
  const submit=f.querySelector('[type=submit]');submit.disabled=true;
  const fd=new FormData(f),val=k=>fd.get(k),num=k=>val(k)===''||val(k)===null?null:Number(val(k));
  try{
    await queue;
    switch(f.dataset.form){
      case 'reschedule':await save(s=>{if(!C.isDate(val('date'))||val('date')<C.dateKey())throw new Error('请选择今天或之后的日期');const o=C.nextOccurrence(s);s.adjustments[`${o.activation.id}:${o.index}`]=val('date');});break;
      case 'journal':await save(s=>{const session=s.sessions.find(s=>s.id===f.dataset.id);for(const key of ['energy','fatigue','satisfaction','pain','neck'])session.journal[key]=num(key);for(const key of ['painLocation','soreness','scapula','trunk','warmup','diary'])session.journal[key]=String(val(key)??'');if(f.dataset.finishing==='true')C.completeSession(s,session.id);});ui.sessionId=null;break;
      case 'food':{const food={id:f.dataset.id??C.uid(),name:val('name').trim(),state:val('state'),source:val('source').trim(),per100:Object.fromEntries(Object.keys(C.NUTRIENTS).map(k=>[k,num(`n-${k}`)]))};const errors=C.validateFood(food);if(errors.length)throw new Error(errors.join('\n'));await save(s=>{const index=s.foods.findIndex(x=>x.id===food.id);if(index<0)s.foods.push(food);else s.foods[index]=food;if(f.dataset.quick==='true')s.meals.push(C.mealFromFood(food,num('grams'),ui.date,val('meal')));});break;}
      case 'meal':await save(s=>{const food=allFoods().find(f=>f.id===val('foodId'));const entry=C.mealFromFood(food,num('grams'),val('date'),val('meal'));entry.entryMethod=f.dataset.method;entry.portionBasis=val('measurement');if(val('portion')!==null&&val('portion')!=='')entry.portionReference=C.clone(food.portions[Number(val('portion'))]);s.meals.push(entry);});break;
      case 'edit-meal':await save(s=>{const m=s.meals.find(x=>x.id===f.dataset.id);m.grams=num('grams');m.meal=val('meal');m.date=val('date');});break;
      case 'recipe':{const recipe=C.composeRecipe(val('name'),'用户菜谱：'+ui.recipe.map(x=>`${x.name} ${x.grams}g [${x.source}]`).join('；'),ui.recipe,num('finalGrams'));await save(s=>s.foods.push(recipe));break;}
      case 'targets':await save(s=>{for(const k of C.REQUIRED_NUTRIENTS)s.settings.targets[k]=num(k);});break;
      case 'weight':await save(s=>s.body.push({id:C.uid(),date:val('date'),weight:num('weight'),notes:val('notes'),createdAt:new Date().toISOString()}));break;
      case 'confirm-plan':{const p=ui.pendingPlan;await save(s=>{C.savePlan(s,p);C.activatePlan(s,C.planKey(p),val('effectiveDate'));},'启用新计划前');ui.pendingPlan=null;break;}
      case 'activate':await save(s=>C.activatePlan(s,f.dataset.id,val('date')),'启用 / 回滚计划前');break;
      case 'plan-editor':collectPlanEditor();{const errors=C.validatePlan(ui.editPlan);if(errors.length)throw new Error(errors.join('\n'));showPlanImport(ui.editPlan);}return;
      case 'confirm-restore':{await store.restore(ui.pendingBackup);ui.pendingBackup=null;ui.sessionId=null;render();toast('已恢复，恢复前的数据已保留为本机快照');break;}
      case 'export':{const r=C.exportRecords(state(),val('from'),val('to')),name=`BodyTrack-${val('from')}-${val('to')}`;switch(val('format')){case 'json':download(JSON.stringify(r,null,2),`${name}.json`);break;case 'training':download(C.trainingCSV(r),`${name}-training.csv`,'text/csv;charset=utf-8');break;case 'nutrition':download(C.nutritionCSV(r),`${name}-nutrition.csv`,'text/csv;charset=utf-8');break;case 'report':download(C.summaryReport(r),`${name}-report.md`,'text/markdown;charset=utf-8');break;}break;}
    }
    modal.close();render();
  }catch(e){toast(e.message??'操作失败，原有数据未被覆盖');}finally{if(submit.isConnected)submit.disabled=false;}
});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
modal.addEventListener('close',()=>{if(!modal.open)clearTransientPhoto();});
window.addEventListener('pagehide',clearTransientPhoto);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')clearTransientPhoto();});
window.addEventListener('online',()=>offlineCheck());
window.addEventListener('offline',()=>{toast('已离线，继续在本机记录');});
if('BroadcastChannel' in window){const channel=new BroadcastChannel('bodytrack-revisions');const original=store.change.bind(store);store.change=async(...args)=>{const r=await original(...args);channel.postMessage({revision:state().revision});return r;};channel.onmessage=event=>{if(event.data.revision!==state().revision)toast('其他窗口的数据已更新；请刷新本窗口后继续记录。');};}
let registration;
async function offlineCheck(){
  if(!registration?.active || !navigator.serviceWorker.controller){ui.offline='准备中，请稍后检查';}
  else{
    const result=await new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(null),4000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};registration.active.postMessage('CHECK_SHELL',[channel.port2]);});
    ui.offline=result?.complete?'已就绪 · 可离线使用':'资源不完整，请联网重新打开';
  }
  document.querySelectorAll('[data-offline]').forEach(el=>el.textContent=ui.offline);
}
async function setupOffline(){
  if(!('serviceWorker' in navigator)||!isSecureContext){ui.offline='需使用 HTTPS 地址或本机 localhost 才能启用离线。';return;}
  try{
    registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    if(registration.waiting){ui.update=registration.waiting;toast('新版本已下载，可在「我的」中更新');}
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller){ui.update=worker;toast('新版本已下载，可在「我的」中更新');if(ui.page==='profile')render();}else offlineCheck();}});});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(ui.update)location.reload();else offlineCheck();});
    await navigator.serviceWorker.ready;await offlineCheck();
  }catch{ui.offline='离线资源下载失败，请联网重新打开；当前记录仍可保存在本机。';}
}
try{await store.open();try{const response=await fetch('./foods.json');if(response.ok){const catalog=await response.json();if(catalog.foods.every(f=>!C.validateFood(f).length))builtInFoods=catalog.foods;}}catch{}render();setupOffline();}
catch(e){app.innerHTML=`<main class="error-screen"><div class="brand-mark">b.</div><h1 style="margin-top:24px">本地记录暂时无法打开</h1><p>${esc(e.message)}</p><p class="small muted">请先关闭其他窗口再重试。不要清除网站数据；如需恢复，请在可用的浏览器中使用之前导出的完整备份。</p>${btn('reload','重新打开','primary')}</main>`;app.querySelector('[data-action=reload]').onclick=()=>location.reload();}
