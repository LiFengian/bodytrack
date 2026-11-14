import {initialState,validateState,migrateState,clone,dateKey,uid} from './core.mjs';

const DB_NAME='bodytrack-local';
const STORE='vault';
export class ConflictError extends Error { constructor(){super('另一个窗口已更新数据，请刷新后重试；当前更改未覆盖已有记录。');} }
export class LocalStore {
  constructor(){this.db=null;this.state=null;this.checkpoints=[];}
  async open(){
    if(!globalThis.indexedDB) throw new Error('当前浏览器不支持本地数据库，请使用 Safari 普通浏览模式。');
    this.db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('数据库升级被其他窗口阻塞，请关闭其他 BodyTrack 窗口再打开。'));
    });
    this.db.onversionchange=()=>{this.db.close();location.reload();};
    await new Promise((resolve,reject)=>{
      const tx=this.db.transaction(STORE,'readwrite'),os=tx.objectStore(STORE),req=os.get('state');
      req.onsuccess=()=>{
        try {this.state=req.result?migrateState(req.result):initialState();if(!req.result)os.put(this.state,'state');}
        catch(e){tx.abort();reject(e);}
      };
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('读取本地数据失败'));
    });
    await this.loadCheckpoints();return this.state;
  }
  async loadCheckpoints(){
    this.checkpoints=await new Promise((resolve,reject)=>{
      const tx=this.db.transaction(STORE),r=tx.objectStore(STORE).get('checkpoints');
      r.onsuccess=()=>resolve(r.result??[]);r.onerror=()=>reject(r.error);
    });
    return this.checkpoints;
  }
  async change(mutator,label=null){
    const expected=this.state.revision;
    let result,next,checkpoints;
    await new Promise((resolve,reject)=>{
      const tx=this.db.transaction(STORE,'readwrite'),os=tx.objectStore(STORE),req=os.get('state');
      let failure;
      req.onsuccess=()=>{
        try{
          const current=migrateState(req.result);
          if(current.revision!==expected)throw new ConflictError();
          next=clone(current);result=mutator(next);
          // Mutations must be synchronous to stay within the atomic transaction.
          if(result?.then)throw new Error('数据写入不可使用异步回调');
          next.revision=expected+1;validateState(next);
          const checkpointReq=os.get('checkpoints');
          checkpointReq.onsuccess=()=>{
            checkpoints=checkpointReq.result??[];
            if(label || !checkpoints.some(c=>c.day===dateKey())){
              checkpoints.push({id:uid(),createdAt:new Date().toISOString(),day:dateKey(),label:label??'每日首次修改前',data:clone(current)});
              checkpoints=checkpoints.slice(-14);
              os.put(checkpoints,'checkpoints');
            }
            os.put(next,'state');
          };
        }catch(e){failure=e;tx.abort();}
      };
      tx.oncomplete=resolve;tx.onerror=()=>reject(failure??tx.error);tx.onabort=()=>reject(failure??tx.error??new Error('保存失败，原记录保持不变'));
    });
    this.state=next;this.checkpoints=checkpoints;return result;
  }
  async restore(data,label='恢复备份前'){
    validateState(data);
    return this.change(next=>{const revision=next.revision;for(const key of Object.keys(next))delete next[key];Object.assign(next,clone(data),{revision});},label);
  }
}
