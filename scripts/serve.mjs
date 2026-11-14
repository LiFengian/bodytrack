import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const port=Number(process.env.PORT??4173),host=process.env.HOST??'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.md':'text/markdown; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),decoded=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+decoded);
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    let file=target;
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('文件不存在');}
});
server.listen(port,host,()=>console.log(`BodyTrack local preview: http://${host}:${port}`));
process.on('SIGTERM',()=>server.close());
