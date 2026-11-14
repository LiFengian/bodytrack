// Reproducible, explicitly fictitious samples. Never loaded into the live app.
import {mkdir,writeFile} from 'node:fs/promises';
import * as C from '../dist/core.mjs';
const out=new URL('../dist/examples/',import.meta.url),schemas=new URL('../dist/schemas/',import.meta.url);
await mkdir(out,{recursive:true});await mkdir(schemas,{recursive:true});
const write=(dir,name,data)=>writeFile(new URL(name,dir),JSON.stringify(data,null,2)+'\n');
if(!process.argv.includes('--schemas-only')){
const plan=C.builtinPlan('2026-11-14');
await write(out,'plan-v1.json',plan);
const v2=C.clone(plan);v2.planVersion=2;v2.effectiveDate='2026-11-30';v2.name='基础计划 · 示例调整版';v2.trainingDays[0].exercises[2].repetitions=12;
await write(out,'plan-v2.json',v2);
await write(out,'invalid-plan.json',{...plan,schemaVersion:'99.0',effectiveDate:'2026-02-30'});
const data=C.initialState('2026-11-14');
const session=C.startSession(data,'2026-11-14');session.exercises[0].sets[0].reps=10;session.exercises[0].sets[0].done=true;session.journal={neck:2,fatigue:4,pain:0,diary:'纯虚构测试记录，不代表用户真实训练。'};C.completeSession(data,session.id);
data.foods.push({id:C.uid(),name:'虚构测试食品（不可用作营养参考）',state:'packaged',source:'软件测试夹具，非真实食品数据',per100:{kcal:120,protein:8,carbs:15,fat:3,fiber:null,sodium:50}});
data.meals.push(C.mealFromFood(data.foods[0],75,'2026-11-14','早餐'));
data.body.push({id:C.uid(),date:'2026-11-14',weight:70,notes:'纯虚构测试体重',createdAt:new Date().toISOString()});
await write(out,'records-v1.json',C.exportRecords(data,'2026-11-14','2026-11-30'));
await write(out,'backup-v1.json',C.createBackup(data));
}

const text=(maxLength=2000)=>({type:'string',minLength:1,maxLength});
const date={type:'string',format:'date',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const datetime={type:'string',format:'date-time'};
const nonnegative={type:'number',minimum:0,maximum:10000000};
const nullable=n=>({anyOf:[n,{type:'null'}]});
const obj=(properties,required=Object.keys(properties))=>({type:'object',required,properties});
const arr=(items,minItems=0,maxItems=100000)=>({type:'array',items,minItems,maxItems});
const id=text(200);
const exercise=obj({id:text(100),name:text(150),module:{enum:['warmup','main']},sets:{type:'integer',minimum:1,maximum:12},repetitions:{type:'integer',minimum:1,maximum:100},perSide:{type:'boolean'},holdSeconds:{type:'integer',minimum:0,maximum:300},intensity:obj({rirMin:{type:'number',minimum:0,maximum:10},rirMax:{type:'number',minimum:0,maximum:10}}),instructions:text(),precautions:text()});
const planProperties={schemaVersion:{const:'1.0'},planId:text(100),planVersion:{type:'integer',minimum:1,maximum:1000000},generatedAt:datetime,effectiveDate:date,name:text(120),instructions:text(6000),precautions:text(6000),cycleDefinition:obj({name:text(120),length:{type:'integer',minimum:1,maximum:90},trainingDayIds:arr(nullable(text(100)),1,90)}),trainingDays:arr(obj({id:text(100),name:text(100),focus:text(1000),exercises:arr(exercise,1,40)}),1,30)};
const header=(title,description)=>({$schema:'https://json-schema.org/draft/2020-12/schema',title,description});
await write(schemas,'plan.schema.json',{...header('BodyTrack plan import v1.0','训练建议；语义校验另检查唯一 ID、周期长度、引用及 RIR 下界不高于上界。用户确认后才可启用。'),...obj(planProperties)});
const nutrientProperties=Object.fromEntries(Object.keys(C.NUTRIENTS).map(k=>[k,nullable(nonnegative)]));
const nutrients={...obj(nutrientProperties,C.REQUIRED_NUTRIENTS),additionalProperties:false};
const foodProperties={id,name:text(150),state:{enum:['raw','cooked','packaged']},source:text(1000),per100:nutrients};
const food=obj(foodProperties);
const meal=obj({...foodProperties,date,meal:{enum:C.MEALS},grams:{type:'number',exclusiveMinimum:0,maximum:100000},foodId:nullable(id),createdAt:datetime});
Object.assign(meal.properties,{
 sourceUrl:{type:'string',format:'uri',pattern:'^https://'},sourceDescription:{type:'string'},catalogVersion:{type:'integer',minimum:1},
 entryMethod:{enum:['catalog','custom','photo-confirmed']},portionBasis:{enum:['weighed','manual-estimate','household-estimate']},
 portionReference:obj({label:text(200),originalLabel:{type:'string'},grams:{type:'number',minimum:.1,maximum:100000},sourcePortionId:{type:'string'}},['label','grams'])
});
const set=obj({id,number:{type:'integer',minimum:1,maximum:12},side:{enum:['both','left','right']},targetReps:{type:'integer',minimum:1,maximum:100},reps:nullable({type:'number',minimum:0,maximum:1000}),weight:nullable({type:'number',minimum:0,maximum:10000}),rpe:nullable({type:'number',minimum:0,maximum:10}),rir:nullable({type:'number',minimum:0,maximum:10}),done:{type:'boolean'}});
const score=(min,max)=>nullable({type:'number',minimum:min,maximum:max});
const journal={...obj({energy:score(1,5),fatigue:score(1,10),satisfaction:score(1,5),pain:score(0,10),neck:score(0,10),...Object.fromEntries(['painLocation','soreness','scapula','trunk','warmup','diary'].map(k=>[k,{type:'string',maxLength:10000}]))},[]),additionalProperties:false};
const completion=obj({done:{type:'integer',minimum:0},total:{type:'integer',minimum:0},ratio:nullable({type:'number',minimum:0,maximum:1})});
const sessionProperties={id,activationId:id,planKey:id,occurrenceIndex:{type:'integer',minimum:0,maximum:10000000},dayId:nullable(text(100)),name:text(100),date,scheduledDate:date,status:{enum:['inProgress','completed','skipped']},createdAt:datetime,completedAt:nullable(datetime),reducedVolume:{type:'boolean'},makeupFor:nullable(id),exercises:arr(obj({id,exerciseId:text(100),target:exercise,targetSets:{type:'integer',minimum:1,maximum:12},notes:{type:'string'},sideDifference:{type:'string'},sets:arr(set,1,24)}),0,40),journal};
const sessionDef=obj(sessionProperties);
const version=obj({key:id,plan:obj(planProperties),importedAt:datetime});
const activation=obj({id,planKey:id,effectiveDate:date,createdAt:datetime});
const body=obj({id,date,weight:{type:'number',minimum:1,maximum:500},notes:{type:'string'},createdAt:datetime});
const totals=obj(Object.fromEntries(Object.keys(C.NUTRIENTS).map(k=>[k,obj({value:nullable({type:'number',minimum:0}),unknownCount:{type:'integer',minimum:0},complete:{type:'boolean'}})])));
const adjustments={type:'object',additionalProperties:date};
const records=obj({schemaVersion:{const:'1.0'},type:{const:'bodytrack.records'},exportedAt:datetime,range:obj({from:date,to:date}),plans:arr(version,1),activations:arr(activation,1),cycleAdjustments:adjustments,cycle:obj({asOf:date,next:nullable(obj({activation,plan:obj(planProperties),index:{type:'integer',minimum:0},cycleNumber:{type:'integer',minimum:1},dayNumber:{type:'integer',minimum:1},trainingDay:nullable(obj({id:text(100),name:text(100),focus:text(1000),exercises:arr(exercise,1,40)})),plannedDate:date}))}),sessions:arr(obj({...sessionProperties,completion})),meals:arr(meal),body:arr(body),nutritionTargets:{type:'object',additionalProperties:nullable(nonnegative)},dailyNutrition:arr(obj({date,nutrients:totals})),completion:obj({completed:{type:'integer',minimum:0},plannedResolved:{type:'integer',minimum:0},ratio:nullable({type:'number',minimum:0,maximum:1}),definition:text()}),mediaIncluded:{const:false}});
await write(schemas,'records.schema.json',{...header('BodyTrack records export v1.0','用于分析，不可用于恢复。date 为本地日历日期，时间戳为 ISO。未知营养用 null；不完整汇总仅为已知部分。周期快照截至所选结束日期，并非当时的历史数据库快照。'),...records});
const state=obj({dataVersion:{const:1},revision:{type:'integer',minimum:0},createdAt:datetime,settings:obj({theme:{enum:['system','light','dark']},introSeen:{type:'boolean'},reducedVolume:{type:'boolean'},lastBackupAt:nullable(datetime),targets:{type:'object',additionalProperties:nullable(nonnegative)}}),plans:arr(version,1),activations:arr(activation,1),sessions:arr(sessionDef),foods:arr(food),meals:arr(meal),body:arr(body),adjustments});
await write(schemas,'backup.schema.json',{...header('BodyTrack full backup v1.0','恢复前还必须通过 validateState 的引用、数值、唯一 ID 与关系校验。设备内回退快照不包含在外部备份中。'),...obj({schemaVersion:{const:'1.0'},type:{const:'bodytrack.backup'},exportedAt:datetime,data:state})});
console.log(process.argv.includes('--schemas-only')?'Updated 3 JSON schemas; existing sample files preserved.':'Generated 5 example fixtures and 3 separate JSON schemas. All sample records are fictitious.');
