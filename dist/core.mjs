// Pure domain logic. No browser globals, network, or persistence side effects.
export const DATA_VERSION = 2;
export const SCHEMA_VERSION = '1.0';
export const RECORDS_SCHEMA_VERSION = '1.1';
export const BACKUP_SCHEMA_VERSION = '1.1';
export const CARDIO_EFFORT = {easy:'轻松',moderate:'适中',hard:'吃力',veryHard:'很吃力'};
export const NUTRIENTS = {
  kcal: ['热量', 'kcal'], protein: ['蛋白质', 'g'], carbs: ['碳水', 'g'], fat: ['脂肪', 'g'],
  fiber: ['膳食纤维', 'g'], sodium: ['钠', 'mg'], calcium: ['钙', 'mg'], iron: ['铁', 'mg'],
  zinc: ['锌', 'mg'], magnesium: ['镁', 'mg'], potassium: ['钾', 'mg'], vitaminC: ['维生素 C', 'mg'], vitaminD: ['维生素 D', 'μg']
};
export const REQUIRED_NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium'];
export const MEALS = ['早餐', '午餐', '晚餐', '加餐'];
export const uid = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function addDays(day, n) {
  if (!isDate(day) || !Number.isInteger(n)) throw new Error('无效日期');
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
export function daysBetween(a,b) { return Math.round((new Date(`${b}T12:00:00Z`)-new Date(`${a}T12:00:00Z`))/86400000); }
const finite = (n,min=0,max=1e7) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n,min,max) => Number.isInteger(n) && finite(n,min,max);
const str = (x,max=2000) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nowISO = () => new Date().toISOString();
const unique = a => new Set(a).size === a.length;
function assert(ok, message) { if (!ok) throw new Error(message); }
export function validatePlan(p) {
  const errors = [];
  const check = (ok,msg) => { if(!ok) errors.push(msg); };
  if(!object(p)) return ['计划必须是 JSON 对象'];
  check(p.schemaVersion === SCHEMA_VERSION, '不支持的 schemaVersion，仅支持 1.0');
  check(str(p.planId,100), 'planId 必须是 1–100 字符');
  check(integer(p.planVersion,1,1e6), 'planVersion 必须是正整数');
  check(typeof p.generatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(p.generatedAt) && Number.isFinite(Date.parse(p.generatedAt)), 'generatedAt 必须是 ISO 时间');
  check(isDate(p.effectiveDate), 'effectiveDate 必须是有效的 YYYY-MM-DD');
  check(str(p.name,120), '计划名称必填');
  check(str(p.instructions,6000), 'instructions 必填');
  check(str(p.precautions,6000), 'precautions 必填');
  const ds = Array.isArray(p.trainingDays) ? p.trainingDays : [];
  check(ds.length > 0 && ds.length <= 30, 'trainingDays 需有 1–30 个训练日');
  check(unique(ds.map(d=>d?.id)), '训练日 ID 不能重复');
  const exerciseIds = [];
  ds.forEach((d,i)=> {
    if (!object(d)) { check(false,`训练日 ${i+1} 无效`); return; }
    check(str(d.id,100) && str(d.name,100) && str(d.focus,1000), `训练日 ${i+1} 信息不完整`);
    const es = Array.isArray(d.exercises) ? d.exercises : [];
    check(es.length > 0 && es.length <= 40, `${d.name} 需有 1–40 个动作`);
    es.forEach((e,j)=> {
      const path = `${d.name} 动作 ${j+1}`;
      if(!object(e)) {check(false,`${path} 无效`);return;}
      exerciseIds.push(e.id);
      check(str(e.id,100) && str(e.name,150), `${path} 缺少 ID 或名称`);
      check(['warmup','main'].includes(e.module), `${path} module 只能是 warmup/main`);
      check(integer(e.sets,1,12) && integer(e.repetitions,1,100), `${path} 组数 1–12、次数 1–100`);
      check(typeof e.perSide === 'boolean', `${path} perSide 必须为布尔值`);
      check(integer(e.holdSeconds,0,300), `${path} holdSeconds 范围 0–300`);
      check(object(e.intensity) && finite(e.intensity.rirMin,0,10) && finite(e.intensity.rirMax,0,10) && e.intensity.rirMin<=e.intensity.rirMax, `${path} RIR 范围无效`);
      check(str(e.instructions,2000) && str(e.precautions,2000), `${path} 动作说明和注意事项必填`);
    });
  });
  check(unique(exerciseIds), '动作 ID 必须在整个计划内唯一');
  const c = p.cycleDefinition;
  check(object(c) && str(c.name,120) && integer(c.length,1,90) && Array.isArray(c.trainingDayIds) && c.trainingDayIds.length === c.length, 'cycleDefinition 长度或定义无效');
  if (Array.isArray(c?.trainingDayIds)) {
    const ids = new Set(ds.map(d=>d?.id));
    check(c.trainingDayIds.every(x=>x===null || ids.has(x)), '周期引用了不存在的训练日');
    check(c.trainingDayIds.some(x=>x!==null), '周期至少需包含一个训练日');
  }
  return errors;
}
export function parsePlan(text) {
  assert(typeof text === 'string' && text.length <= 2_000_000, '计划文件过大（最多 2 MB）');
  let p; try {p=JSON.parse(text);} catch {throw new Error('JSON 格式无效，请检查括号、逗号和引号');}
  const errors=validatePlan(p); assert(!errors.length, errors.join('\n'));
  return p;
}
export const planKey = p => `${p.planId}@${p.planVersion}`;
function exercise(id,name,sets,repetitions,perSide=false,module='main',holdSeconds=0,instructions='以可控速度完成，动作全程保持舒适。',precautions='避免疼痛与明显代偿，按实际能力调整负荷。') {
  return {id,name,sets,repetitions,perSide,module,holdSeconds,intensity:{rirMin:2,rirMax:4},instructions,precautions};
}
export function builtinPlan(day = dateKey()) {
  const warmup = prefix => [
    exercise(`${prefix}-chin`,'下巴回收 Chin Tuck',2,10,false,'warmup',5,'轻轻收回下巴，保持呼吸；每次保持 5 秒。','不强迫颈部后仰，不用力挤压颈部。'),
    exercise(`${prefix}-thoracic`,'胸椎伸展',2,10,false,'warmup',0,'在舒适范围内缓慢伸展胸椎，保持肋骨与骨盆稳定。','不强迫腰部代偿，不追求最大伸展幅度。')
  ];
  return {schemaVersion:SCHEMA_VERSION,planId:'bodytrack-foundation',planVersion:1,generatedAt:'2026-11-14T00:00:00.000Z',effectiveDate:day,
    name:'体态与力量 · 基础计划',instructions:'练两天、休一天，15 天为一循环。前 14 天可选 75% 组数；后续逐渐采用完整训练量。抗阻训练通常保留 2–4 次余力。',
    precautions:'本计划用于一般健身与动作控制记录，不诊断或治疗疾病。脊柱侧弯专项矫正需专业评估；不据照片判断结构异常，不擅自指定单侧矫正。出现疼痛时停止相关动作并根据情况寻求专业评估。',
    cycleDefinition:{name:'五分化 · 练二休一',length:15,trainingDayIds:['chest','shoulder',null,'back','arms',null,'legs','chest',null,'shoulder','back',null,'arms','legs',null]},
    trainingDays:[
      {id:'chest',name:'胸部日',focus:'上胸形态 · 前锯肌 · 颈胸姿势控制',exercises:[...warmup('chest'),exercise('chest-incline','上斜推胸机',3,10),exercise('chest-flat','平板器械推胸',2,10),exercise('chest-fly','低位绳索夹胸',2,12),exercise('chest-plus','俯卧撑 Plus',3,12),exercise('chest-deadbug','死虫式',2,10,true)]},
      {id:'shoulder',name:'肩部日',focus:'肩胛控制 · 肩袖稳定 · 头前倾改善',exercises:[...warmup('shoulder'),exercise('shoulder-wall','靠墙滑手',2,12),exercise('shoulder-rotation','绳索肩袖外旋',3,12,true),exercise('shoulder-lateral','绳索侧平举',3,12),exercise('shoulder-y','俯卧 Y 字抬手',2,12),exercise('shoulder-reverse','反向蝴蝶机',3,12)]},
      {id:'back',name:'背部日',focus:'肩背力量 · 躯干稳定 · 颈胸姿势控制',exercises:[...warmup('back'),exercise('back-row','胸托划船',4,10),exercise('back-pulldown','中立握高位下拉',3,12),exercise('back-single','单臂绳索划船',3,10,true),exercise('back-reverse','反向蝴蝶机',3,12),exercise('back-birddog','鸟狗式',2,10,true)]},
      {id:'arms',name:'手臂日',focus:'上肢力量 · 躯干抗旋转',exercises:[exercise('arms-curl','哑铃弯举',3,12),exercise('arms-hammer','锤式弯举',2,12),exercise('arms-pushdown','绳索三头下压',3,12),exercise('arms-extension','过顶绳索臂屈伸',2,12),exercise('arms-facepull','绳索面拉',2,15),exercise('arms-pallof','Pallof Press',3,10,true)]},
      {id:'legs',name:'腿部日',focus:'髋膝稳定 · 下肢力量',exercises:[exercise('legs-press','坐姿蹬腿',3,12),exercise('legs-split','扶支撑分腿蹲',3,10,true),exercise('legs-thrust','臀推',3,12),exercise('legs-curl','坐姿腿弯举',3,12),exercise('legs-step','台阶下踩',2,8,true),exercise('legs-calf','站姿提踵',2,15)]}
    ]};
}
export function initialState(day=dateKey()) {
  const p=builtinPlan(day);
  return {dataVersion:DATA_VERSION,revision:0,createdAt:nowISO(),settings:{theme:'system',introSeen:false,reducedVolume:false,lastBackupAt:null,targets:{kcal:null,protein:null,carbs:null,fat:null,fiber:null,sodium:null}},
    plans:[{key:planKey(p),plan:p,importedAt:nowISO()}],activations:[{id:uid(),planKey:planKey(p),effectiveDate:day,createdAt:nowISO()}],
    sessions:[],cardio:[],foods:[],meals:[],body:[],adjustments:{}};
}
export function validateCardio(entry) {
  const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
  if(!object(entry))return ['有氧记录无效'];
  check(Object.keys(entry).every(k=>['id','type','date','mode','durationMinutes','floors','level','effort','notes','createdAt','updatedAt'].includes(k)),'有氧记录包含未知字段');
  check(str(entry.id,200)&&entry.type==='stair-climbing','有氧类型或 ID 无效');
  check(isDate(entry.date),'请选择有效的有氧日期');
  check(['stairs','stair-machine'].includes(entry.mode),'请选择楼梯或楼梯机');
  check(finite(entry.durationMinutes,.1,1440),'有氧时长需为 0.1–1440 分钟');
  check(entry.floors===null||integer(entry.floors,1,10000),'累计层数需为 1–10000 的整数，或留空');
  check(entry.level===null||entry.mode==='stair-machine'&&integer(entry.level,1,100),'器械档位仅用于楼梯机，范围 1–100');
  check(entry.effort===null||Object.hasOwn(CARDIO_EFFORT,entry.effort),'吃力程度无效');
  check(typeof entry.notes==='string'&&entry.notes.length<=10000,'有氧备注过长');
  for(const key of ['createdAt','updatedAt'])check(typeof entry[key]==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(entry[key])&&Number.isFinite(Date.parse(entry[key])),'有氧时间戳无效');
  return errors;
}
export function saveCardio(state,values,id=null,today=dateKey()) {
  const old=id===null?null:state.cardio.find(x=>x.id===id);
  assert(id===null||old,'找不到这条有氧记录');
  const stamp=nowISO(),entry={id:old?.id??uid(),type:'stair-climbing',date:values.date,mode:values.mode,durationMinutes:values.durationMinutes,
    floors:values.floors??null,level:values.level??null,effort:values.effort??null,notes:values.notes??'',createdAt:old?.createdAt??stamp,updatedAt:stamp};
  const errors=validateCardio(entry);assert(!errors.length,errors.join('\n'));assert(entry.date<=today,'有氧记录日期不能晚于今天');
  if(old)state.cardio[state.cardio.indexOf(old)]=entry;else state.cardio.push(entry);
  return entry;
}
export function cardioSummary(entries) {
  const days=new Map();let totalMinutes=0;
  for(const x of entries){totalMinutes+=x.durationMinutes;days.set(x.date,(days.get(x.date)??0)+x.durationMinutes);}
  return {count:entries.length,totalMinutes,daily:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,minutes])=>({date,minutes}))};
}
export function activeActivation(state, day=dateKey()) {
  return state.activations.filter(a=>a.effectiveDate<=day).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)).at(-1) ?? null;
}
export function activePlan(state, day=dateKey()) {
  const a=activeActivation(state,day); return a ? state.plans.find(p=>p.key===a.planKey)?.plan : null;
}
export function cycleDay(plan,index) {
  assert(integer(index,0,1e7),'周期序号无效');
  const dayId=plan.cycleDefinition.trainingDayIds[index % plan.cycleDefinition.length];
  return dayId === null ? null : plan.trainingDays.find(d=>d.id===dayId);
}
export function nextOccurrence(state, day=dateKey()) {
  const a=activeActivation(state,day); if(!a) return null;
  const p=state.plans.find(p=>p.key===a.planKey).plan;
  const resolved = state.sessions.filter(s=>s.activationId===a.id && s.date<=day && !s.makeupFor && ['completed','skipped'].includes(s.status));
  const indices=new Set(resolved.map(s=>s.occurrenceIndex));
  let index=0; while(indices.has(index)) index++;
  let plannedDate=addDays(a.effectiveDate,index);
  const previous=resolved.find(s=>s.occurrenceIndex===index-1);
  if(previous && addDays(previous.date,1)>plannedDate) plannedDate=addDays(previous.date,1);
  plannedDate=state.adjustments[`${a.id}:${index}`] ?? plannedDate;
  const trainingDay=cycleDay(p,index);
  return {activation:a,plan:p,index,cycleNumber:Math.floor(index/p.cycleDefinition.length)+1,dayNumber:index%p.cycleDefinition.length+1,trainingDay,plannedDate};
}
export function newSession(occ,date=dateKey(),reduced=false) {
  assert(isDate(date), '训练日期无效');
  const snapshots = occ.trainingDay?.exercises.map(e=> {
    const count=reduced && e.module!=='warmup' ? Math.max(1,Math.round(e.sets*.75)) : e.sets;
    return {id:uid(),exerciseId:e.id,target:clone(e),targetSets:count,notes:'',sideDifference:'',sets:Array.from({length:count},(_,i)=>e.perSide ? ['left','right'] : ['both']).flatMap((sides,i)=>sides.map(side=>({id:uid(),number:i+1,side,targetReps:e.repetitions,reps:null,weight:null,rpe:null,rir:null,done:false})))};
  }) ?? [];
  return {id:uid(),activationId:occ.activation.id,planKey:planKey(occ.plan),occurrenceIndex:occ.index,dayId:occ.trainingDay?.id ?? null,name:occ.trainingDay?.name ?? '休息日',
    date,scheduledDate:occ.plannedDate,status:'inProgress',createdAt:nowISO(),completedAt:null,reducedVolume:reduced,makeupFor:null,exercises:snapshots,journal:{}};
}
export function startSession(state,day=dateKey()) {
  const unfinished=state.sessions.find(s=>s.status==='inProgress'); if(unfinished) return unfinished;
  const occ=nextOccurrence(state,day); assert(occ,'当前日期没有生效的计划');
  assert(day>=occ.plannedDate,'尚未到计划日期，可先调整日期');
  const session=newSession(occ,day,state.settings.reducedVolume); state.sessions.push(session); return session;
}
export function completion(session) {
  const sets=session.exercises.flatMap(e=>e.sets);
  return {done:sets.filter(s=>s.done).length,total:sets.length,ratio:sets.length?sets.filter(s=>s.done).length/sets.length:null};
}
export function completeSession(state,id) {
  const s=state.sessions.find(s=>s.id===id); assert(s?.status==='inProgress','找不到进行中的训练');
  s.status='completed'; s.completedAt=nowISO();
}
export function skipOccurrence(state,day=dateKey()) {
  assert(!state.sessions.some(s=>s.status==='inProgress'),'请先结束进行中的训练');
  const occ=nextOccurrence(state,day); assert(occ && day>=occ.plannedDate,'尚未到计划日期');
  const s=newSession(occ,day,state.settings.reducedVolume);s.status='skipped';state.sessions.push(s);return s;
}
export function makeupSession(state,id,day=dateKey()) {
  assert(!state.sessions.some(s=>s.status==='inProgress'),'请先结束进行中的训练');
  const old=state.sessions.find(s=>s.id===id);
  assert(old?.status==='skipped' && old.dayId, '只有跳过的训练日可以补练');
  assert(!state.sessions.some(s=>s.makeupFor===id),'该记录已经安排过补练');
  const s=clone(old);s.id=uid();s.date=day;s.status='inProgress';s.makeupFor=id;s.createdAt=nowISO();s.completedAt=null;
  s.exercises.forEach(e=>{e.id=uid();e.sets.forEach(x=>{x.id=uid();x.done=false;x.reps=x.weight=x.rpe=x.rir=null;});});
  state.sessions.push(s); return s;
}
export function savePlan(state,p) {
  const errors=validatePlan(p); assert(!errors.length,errors.join('\n'));
  assert(!state.plans.some(x=>x.key===planKey(p)),'该 planId / planVersion 已存在，请使用新版本号');
  state.plans.push({key:planKey(p),plan:clone(p),importedAt:nowISO()});
}
export function activatePlan(state,key,effectiveDate,day=dateKey()) {
  assert(state.plans.some(p=>p.key===key),'计划不存在');
  assert(isDate(effectiveDate) && effectiveDate>=day,'生效日期不能早于今天');
  assert(!state.sessions.some(s=>s.status==='inProgress'),'请先结束当前训练，再启用或回滚计划');
  state.activations.push({id:uid(),planKey:key,effectiveDate,createdAt:nowISO()});
}
export function planDiff(old,p) {
  if(!old) return ['首次导入计划'];
  const lines=[];
  if(old.name!==p.name)lines.push(`计划名称：${old.name} → ${p.name}`);
  if(JSON.stringify(old.cycleDefinition)!==JSON.stringify(p.cycleDefinition)) lines.push('训练周期或安排发生变化');
  if(old.instructions!==p.instructions) lines.push('计划说明已修改');
  if(old.precautions!==p.precautions) lines.push('计划注意事项已修改');
  const before=new Map(old.trainingDays.flatMap(d=>d.exercises.map(e=>[e.id,{...e,day:d.name}])));
  for(const day of p.trainingDays){const previous=old.trainingDays.find(d=>d.id===day.id);if(!previous)lines.push(`新增训练日：${day.name}`);else if(previous.name!==day.name||previous.focus!==day.focus)lines.push(`训练日目标或名称修改：${day.name}`);}
  for(const day of old.trainingDays)if(!p.trainingDays.some(d=>d.id===day.id))lines.push(`移除训练日：${day.name}`);
  const after=new Set();
  for(const d of p.trainingDays) for(const e of d.exercises) {
    after.add(e.id);const b=before.get(e.id);
    if(!b) lines.push(`新增 ${d.name}：${e.name}`);
    else {
      const changes=[];
      if(b.name!==e.name)changes.push(`原名 ${b.name}`);
      if(b.sets!==e.sets||b.repetitions!==e.repetitions)changes.push(`${b.sets}×${b.repetitions} → ${e.sets}×${e.repetitions}`);
      if(b.day!==d.name)changes.push('训练日改变');
      if(b.module!==e.module)changes.push('热身 / 训练模块改变');
      if(b.perSide!==e.perSide)changes.push('左右侧记录方式改变');
      if(b.holdSeconds!==e.holdSeconds)changes.push(`保持 ${b.holdSeconds}秒 → ${e.holdSeconds}秒`);
      if(JSON.stringify(b.intensity)!==JSON.stringify(e.intensity))changes.push(`RIR ${b.intensity.rirMin}–${b.intensity.rirMax} → ${e.intensity.rirMin}–${e.intensity.rirMax}`);
      if(b.instructions!==e.instructions)changes.push('动作说明改变');
      if(b.precautions!==e.precautions)changes.push('动作注意事项改变');
      if(changes.length)lines.push(`修改 ${e.name}：${changes.join('；')}`);
    }
  }
  for(const [id,e] of before) if(!after.has(id)) lines.push(`移除 ${e.name}`);
  return lines.length?lines:['动作与训练量一致（计划标识、名称或日期可能变化）'];
}
export function validateFood(f) {
  const errors=[];
  if(!object(f)) return ['食物记录无效'];
  if(!str(f.name,150)) errors.push('请填写食物名称');
  if(!['raw','cooked','packaged'].includes(f.state)) errors.push('请选择生食、熟食或包装即食');
  if(!str(f.source,1000)) errors.push('请填写营养数据来源');
  if(f.sourceUrl!==undefined&&!(typeof f.sourceUrl==='string'&&/^https:\/\//.test(f.sourceUrl)))errors.push('数据来源链接必须为 HTTPS');
  if(f.portions!==undefined&&!(Array.isArray(f.portions)&&f.portions.length<=100&&f.portions.every(p=>object(p)&&str(p.label,200)&&finite(p.grams,.1,100000))))errors.push('参考份量数据无效');
  if(!object(f.per100)) errors.push('每 100 g 营养数据无效');
  else {
    for(const k of REQUIRED_NUTRIENTS) if(!(k in f.per100)) errors.push(`缺少 ${k}，未知请用 null`);
    for(const [k,v] of Object.entries(f.per100)) if(!(k in NUTRIENTS) || !(v===null || finite(v))) errors.push(`${k} 数值无效；未知请留空`);
  }
  return errors;
}
export function calculateNutrition(per100,grams) {
  assert(finite(grams,0,100000),'食用重量无效');
  return Object.fromEntries(Object.keys(NUTRIENTS).map(k=>[k,per100[k] == null ? null : per100[k]*grams/100]));
}
export function aggregateNutrition(meals) {
  return Object.fromEntries(Object.keys(NUTRIENTS).map(k=> {
    let known=0,unknown=0;
    for(const m of meals) { const v=calculateNutrition(m.per100,m.grams)[k];if(v===null) unknown++;else known+=v; }
    return [k,{value:unknown===meals.length && meals.length?null:known,unknownCount:unknown,complete:unknown===0}];
  }));
}
export function mealFromFood(food,grams,date,meal) {
  assert(!validateFood(food).length,'食物数据无效'); assert(finite(grams,.1,100000),'食用重量需大于 0');
  assert(isDate(date)&&MEALS.includes(meal),'用餐日期或餐次无效');
  return {id:uid(),date,meal,foodId:food.id??null,name:food.name,state:food.state,source:food.source,per100:clone(food.per100),grams,createdAt:nowISO(),...(food.sourceUrl?{sourceUrl:food.sourceUrl,sourceDescription:food.sourceDescription??'',catalogVersion:1}:{})};
}
export function saveCustomFood(state,food) {
  const errors=validateFood(food);assert(!errors.length,errors.join('\n'));
  assert(str(food.id,200),'食物缺少唯一 ID');
  const index=state.foods.findIndex(f=>f.id===food.id);
  const updated=clone(food);
  if(index<0)state.foods.push(updated);else state.foods[index]=updated;
  return synchronizeFoodMeals(state,{foodId:food.id});
}
export function synchronizeFoodMeals(state,{foodId=null,checkOnly=false}={}) {
  // Never match by name: raw/cooked foods and different brands may share it.
  const foods=new Map(state.foods.filter(f=>foodId===null||f.id===foodId).map(f=>[f.id,f]));
  let changed=0;
  for(const meal of state.meals){
    const food=foods.get(meal.foodId);if(!food)continue;
    const same=['name','state','source','sourceUrl'].every(k=>(meal[k]??null)===(food[k]??null))&&Object.keys(NUTRIENTS).every(k=>(meal.per100[k]??null)===(food.per100[k]??null));
    if(same)continue;changed++;if(checkOnly)continue;
    for(const key of ['name','state','source','per100'])meal[key]=clone(food[key]);
    for(const key of ['sourceUrl','sourceDescription','catalogVersion'])delete meal[key];
    if(food.sourceUrl)Object.assign(meal,{sourceUrl:food.sourceUrl,sourceDescription:food.sourceDescription??'',catalogVersion:1});
    // Keep actual grams, date, meal, stable ID and entry/portion provenance.
  }
  return changed;
}
export function composeRecipe(name,source,ingredients,finalGrams) {
  assert(str(name,150)&&str(source,1000)&&ingredients.length>0,'菜谱名称、来源及食材必填');
  assert(finite(finalGrams,.1,100000),'请填写成品总重量');
  const total=aggregateNutrition(ingredients);
  return {id:uid(),name,source,state:'cooked',per100:Object.fromEntries(Object.entries(total).map(([k,v])=>[k,v.complete?v.value/finalGrams*100:null])),ingredients:clone(ingredients),finalGrams};
}
export function validateState(s) {
  assert(object(s)&&s.dataVersion===DATA_VERSION,'不支持的数据版本');
  assert(Object.keys(s).every(k=>['dataVersion','revision','createdAt','settings','plans','activations','sessions','cardio','foods','meals','body','adjustments'].includes(k)),'备份包含无法识别的顶层字段，请检查数据版本');
  for(const key of ['plans','activations','sessions','cardio','foods','meals','body']) assert(Array.isArray(s[key])&&s[key].length<=100000,`${key} 数据无效或过多`);
  assert(s.plans.length>0&&s.activations.length>0&&integer(s.revision,0,1e12),'备份缺少计划、启用记录或修订号');
  assert(object(s.settings)&&['light','dark','system'].includes(s.settings.theme)&&typeof s.settings.introSeen==='boolean'&&typeof s.settings.reducedVolume==='boolean'&&object(s.settings.targets),'设置无效');
  for(const [k,v] of Object.entries(s.settings.targets)) assert(k in NUTRIENTS && (v===null||finite(v)), '营养目标无效');
  assert(s.settings.lastBackupAt===null || typeof s.settings.lastBackupAt==='string'&&Number.isFinite(Date.parse(s.settings.lastBackupAt)),'备份日期无效');
  assert(object(s.adjustments)&&Object.values(s.adjustments).every(isDate),'日期调整无效');
  const allIds=[];
  const addId = id => {assert(str(id,200),'记录缺少唯一 ID');allIds.push(id);};
  const keys=new Set();
  for(const entry of s.cardio){addId(entry.id);const errors=validateCardio(entry);assert(!errors.length,errors.join('\n'));}
  for(const p of s.plans) {assert(object(p)&&!validatePlan(p.plan).length&&p.key===planKey(p.plan),'备份内计划无效');assert(!keys.has(p.key),'计划版本重复');keys.add(p.key);}
  for(const a of s.activations) {addId(a.id);assert(keys.has(a.planKey)&&isDate(a.effectiveDate),'启用记录无效');}
  for(const item of s.sessions) {
    addId(item.id);assert(isDate(item.date)&&isDate(item.scheduledDate)&&keys.has(item.planKey)&&s.activations.some(a=>a.id===item.activationId&&a.planKey===item.planKey),'训练引用或日期无效');
    assert(integer(item.occurrenceIndex,0,1e7)&&['inProgress','completed','skipped'].includes(item.status)&&Array.isArray(item.exercises)&&item.exercises.length<=40&&str(item.name,100),'训练记录无效');
    assert(object(item.journal)&&Object.keys(item.journal).every(k=>['energy','fatigue','satisfaction','pain','painLocation','soreness','scapula','trunk','neck','warmup','diary'].includes(k)),'训练感受无效');
    for (const [k,v] of Object.entries(item.journal)) {
      const ranges={energy:[1,5],fatigue:[1,10],satisfaction:[1,5],pain:[0,10],neck:[0,10]};
      assert(ranges[k] ? v===null||finite(v,...ranges[k]) : typeof v==='string'&&v.length<=10000,'训练感受范围无效');
    }
    for(const e of item.exercises) {
      addId(e.id);assert(object(e.target)&&str(e.target.name,150)&&str(e.exerciseId,100)&&integer(e.targetSets,1,12)&&Array.isArray(e.sets)&&e.sets.length<=24&&typeof e.notes==='string'&&typeof e.sideDifference==='string','动作快照无效');
      const probe={...s.plans.find(p=>p.key===item.planKey).plan,trainingDays:[{id:'snapshot',name:'快照',focus:'快照',exercises:[e.target]}],cycleDefinition:{name:'快照',length:1,trainingDayIds:['snapshot']}};
      assert(!validatePlan(probe).length,'动作目标快照无效');
      assert(e.sets.length===e.targetSets*(e.target.perSide?2:1),'动作组数不匹配');
      for(const [position,set] of e.sets.entries()) {
        addId(set.id);assert(integer(set.number,1,12)&&['left','right','both'].includes(set.side)&&integer(set.targetReps,1,100)&&typeof set.done==='boolean','组记录无效');
        assert(set.number===(e.target.perSide?Math.floor(position/2)+1:position+1)&&set.side===(e.target.perSide?(position%2?'right':'left'):'both'),'组号或左右侧记录不匹配');
        for(const key of ['reps','weight','rpe','rir']) assert(set[key]===null || finite(set[key],0,key==='rpe'||key==='rir'?10:key==='reps'?1000:10000)&&(key!=='reps'||Number.isInteger(set[key])),'组数值无效');
        assert(!set.done || finite(set.reps,1,1000),'已完成组必须有实际次数');
      }
    }
  }
  assert(s.sessions.filter(x=>x.status==='inProgress').length<=1,'存在多条未结束训练');
  assert(unique(s.sessions.filter(x=>!x.makeupFor).map(x=>`${x.activationId}:${x.occurrenceIndex}`)),'周期记录重复');
  for(const x of s.sessions.filter(x=>x.makeupFor)) assert(s.sessions.some(y=>y.id===x.makeupFor&&y.status==='skipped'&&y.planKey===x.planKey&&y.occurrenceIndex===x.occurrenceIndex),'补练引用无效');
  assert(unique(s.sessions.filter(x=>x.makeupFor).map(x=>x.makeupFor)),'补练记录重复');
  for(const x of [...s.foods,...s.meals]) {addId(x.id);assert(!validateFood(x).length,'食物营养数据无效');}
  for(const x of s.meals){
    assert(isDate(x.date)&&MEALS.includes(x.meal)&&finite(x.grams,.1,100000),'饮食记录无效');
    if(x.entryMethod!==undefined)assert(['catalog','custom','photo-confirmed'].includes(x.entryMethod),'饮食记录方式无效');
    if(x.portionBasis!==undefined)assert(['weighed','manual-estimate','household-estimate'].includes(x.portionBasis),'份量依据无效');
    if(x.portionReference!==undefined)assert(object(x.portionReference)&&str(x.portionReference.label,200)&&finite(x.portionReference.grams,.1,100000),'参考份量快照无效');
  }
  for(const x of s.body) {addId(x.id);assert(isDate(x.date)&&finite(x.weight,1,500)&&typeof x.notes==='string','体重记录无效');}
  assert(unique(allIds),'备份内的记录 ID 重复');
  return s;
}
export function migrateState(s) {
  assert(s?.dataVersion===1||s?.dataVersion===DATA_VERSION,'数据版本高于或不同于当前版本，请升级应用；未修改本地数据');
  if(s.dataVersion===1){
    assert(!Object.hasOwn(s,'cardio'),'版本 1 数据不应包含有氧字段，请检查备份版本');
    // Never mutate the supplied backup or the pre-upgrade snapshot.
    return validateState({...clone(s),dataVersion:2,cardio:[]});
  }
  return validateState(s);
}
export function createBackup(state) {validateState(state);return {schemaVersion:BACKUP_SCHEMA_VERSION,type:'bodytrack.backup',exportedAt:nowISO(),data:clone(state)};}
export function parseBackup(text) {
  assert(typeof text==='string'&&text.length<=50_000_000,'备份超过 50 MB');
  let data;try{data=JSON.parse(text);}catch{throw new Error('备份 JSON 格式无效');}
  assert(data?.type==='bodytrack.backup'&&['1.0',BACKUP_SCHEMA_VERSION].includes(data.schemaVersion),'请选择 BodyTrack 完整备份，分析导出不能用于恢复');
  assert(data.schemaVersion!=='1.0'||data.data?.dataVersion===1,'旧备份 Schema 与数据版本不匹配');
  assert(data.schemaVersion!=='1.1'||data.data?.dataVersion===2,'备份 Schema 与数据版本不匹配');
  return migrateState(data.data);
}
export function exportRecords(state,from,to) {
  assert(isDate(from)&&isDate(to)&&from<=to,'导出日期范围无效');
  const within=x=>x.date>=from&&x.date<=to;
  const sessions=state.sessions.filter(within).map(s=>({...clone(s),completion:completion(s)}));
  const meals=state.meals.filter(within);
  const dates=[...new Set(meals.map(x=>x.date))].sort();
  const planned=sessions.filter(s=>s.dayId&&!s.makeupFor&&s.status!=='inProgress');
  const completed=planned.filter(s=>s.status==='completed').length;
  return {schemaVersion:RECORDS_SCHEMA_VERSION,type:'bodytrack.records',exportedAt:nowISO(),range:{from,to},
    plans:clone(state.plans),activations:clone(state.activations),cycleAdjustments:clone(state.adjustments),
    cycle:{asOf:to,next:nextOccurrence(state,to)},sessions,cardio:clone(state.cardio.filter(within)),meals:clone(meals),body:clone(state.body.filter(within)),nutritionTargets:clone(state.settings.targets),
    dailyNutrition:dates.map(date=>({date,nutrients:aggregateNutrition(meals.filter(x=>x.date===date))})),
    completion:{completed,plannedResolved:planned.length,ratio:planned.length?completed/planned.length:null,definition:'仅统计范围内已结束或明确跳过的周期训练日；休息、补练及未处理日期不进入分母。逐组完成率另列。'},
    mediaIncluded:false};
}
export function csv(rows) {
  return '\uFEFF'+rows.map(row=>row.map(v=>{
    let s=v==null?'':String(v);
    if(/^[\s]*[=+@-]/.test(s)) s="'"+s; // prevent spreadsheet formula injection
    return '"'+s.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
export function trainingCSV(records) {
  const rows=[['训练ID','日期','计划版本','训练日','状态','补练来源','动作ID','动作','模块','目标组数','组号','侧别','目标次数','实际次数','重量kg','RPE','RIR','完成','保持秒数','动作备注','左右差异','训练感受JSON']];
  for(const s of records.sessions){
    const prefix=[s.id,s.date,s.planKey,s.name,s.status,s.makeupFor];
    if(!s.exercises.length)rows.push([...prefix,...Array(15).fill(''),JSON.stringify(s.journal)]);
    for(const e of s.exercises)for(const x of e.sets)rows.push([...prefix,e.exerciseId,e.target.name,e.target.module,e.targetSets,x.number,x.side,x.targetReps,x.reps,x.weight,x.rpe,x.rir,x.done,e.target.holdSeconds,e.notes,e.sideDifference,JSON.stringify(s.journal)]);
  }
  return csv(rows);
}
export function nutritionCSV(records) {
  const keys=Object.keys(NUTRIENTS);
  return csv([['日期','餐次','食物','重量g','生熟','来源','来源链接','记录方式','重量依据',...keys.map(k=>`${NUTRIENTS[k][0]}(${NUTRIENTS[k][1]})`)],
    ...records.meals.map(m=>{const n=calculateNutrition(m.per100,m.grams);return [m.date,m.meal,m.name,m.grams,m.state,m.source,m.sourceUrl??'',m.entryMethod??'手动',m.portionBasis??'未注明',...keys.map(k=>n[k]??'未知')];})]);
}
export function cardioCSV(records) {
  return csv([['有氧ID','日期','项目','场景','时长分钟','累计层数','器械档位','吃力程度','备注','创建时间','更新时间'],
    ...(records.cardio??[]).map(x=>[x.id,x.date,'爬楼梯',x.mode==='stairs'?'楼梯':'楼梯机',x.durationMinutes,x.floors,x.level,CARDIO_EFFORT[x.effort]??'',x.notes,x.createdAt,x.updatedAt])]);
}
export function summaryReport(r) {
  const lines=[`# BodyTrack 个人记录 ${r.range.from} 至 ${r.range.to}`,'','数据为用户自报记录，不能据此诊断脊柱、颈椎结构或治疗效果。','',
    `已结束训练 ${r.completion.completed}/${r.completion.plannedResolved}（${r.completion.definition}）`,`计划版本：${r.plans.map(x=>x.key).join('、')}`,'','## 每次训练'];
  for(const s of r.sessions) lines.push(`${s.date} ${s.name} · ${s.status}${s.makeupFor?' · 补练':''} · 已打卡 ${s.completion.done}/${s.completion.total} 组`,...s.exercises.map(e=>`- ${e.target.name}：${e.sets.filter(x=>x.done).map(x=>`${x.side} ${x.reps}次/${x.weight??'未知'}kg RPE${x.rpe??'?'} RIR${x.rir??'?'}`).join('；')||'未打卡'}；备注：${e.notes}；左右差异：${e.sideDifference}`),`训练感受：${JSON.stringify(s.journal)}`,'');
  const cardio=cardioSummary(r.cardio??[]);
  lines.push('## 有氧 · 爬楼梯',`共 ${cardio.count} 次，${cardio.totalMinutes} 分钟；独立记录，不推进力量训练周期。`,
    ...(r.cardio??[]).map(x=>`${x.date} ${x.mode==='stairs'?'楼梯':'楼梯机'} ${x.durationMinutes} 分钟${x.floors===null?'':` · ${x.floors} 层`}${x.level===null?'':` · 档位 ${x.level}`}${x.effort===null?'':` · ${CARDIO_EFFORT[x.effort]}`} · 备注：${x.notes}`),'');
  lines.push('## 每日营养（不完整数据仅为已知部分，未知不作 0）');
  for(const d of r.dailyNutrition) lines.push(`${d.date}：${REQUIRED_NUTRIENTS.map(k=>`${NUTRIENTS[k][0]} ${d.nutrients[k].value??'未知'}${NUTRIENTS[k][1]}${d.nutrients[k].complete?'':'（有缺失）'}`).join('，')}`);
  lines.push('','## 食物来源与份量依据','营养为数据库或标签参考值，非照片实测。照片辅助条目经用户确认；参考份量和用户估重都属于估算。',...r.meals.map(m=>`${m.date} ${m.meal} ${m.name} ${m.grams}g · ${m.portionBasis??'重量依据未注明'} · ${m.entryMethod??'手动'} · ${m.source}`));
  lines.push('','## 体重与用户描述',...r.body.map(x=>`${x.date} ${x.weight}kg ${x.notes}`),'','分析建议：结合实际完成率、疲劳、疼痛、颈部紧张及动作感受调整一般训练。新的训练建议请遵守 plan.schema.json；不要自动指定单侧脊柱矫正。');
  return lines.join('\n');
}
