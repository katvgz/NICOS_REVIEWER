import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const allowed=new Set(['index.html','styles.css','js/app.js','js/character.js','js/quiz.js','js/questions.js','js/question-selection.js','js/sounds.js','photos/character.png','photos/MSTE.png','photos/QS.png','photos/result.png']);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const file=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    if(!allowed.has(file)){res.writeHead(404);res.end('Not found');return;}
    const body=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(body);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Unable to load file');}
}).listen(port,'0.0.0.0',()=>console.log(`Reviewer running at http://localhost:${port}`));
