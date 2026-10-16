const assert=require('node:assert/strict');const fs=require('node:fs');const {createRequire}=require('node:module');const {JSDOM}=createRequire(process.env.DOM_DEPENDENCY_ROOT+'/probe.cjs')('jsdom');
const dom=new JSDOM(fs.readFileSync('/tmp/globalregai-home.html','utf8'),{url:'https://globalregai.info/?lang=ko',runScripts:'outside-only'});
const w=dom.window,d=w.document;w.HTMLElement.prototype.scrollIntoView=function(){};w.AbortController=AbortController;
let translateCalls=0,extractCalls=0;
w.fetch=async(url,opts)=>{if(url==='/api/files/extract'){extractCalls++;return {ok:true,json:async()=>({documents:[{name:'terms.txt',status:'EXTRACTED',characters:2500,notes:[],sections:[{label:'Document',text:'a'.repeat(2500)}]}]})};}
if(url==='/api/files/translate'){translateCalls++;if(translateCalls===2)throw Error('provider unavailable');return {ok:true,json:async()=>({translation:'<img src=x onerror=alert(1)>',terms:[{english:'GMP',localized:'제조 및 품질관리기준'}],notes:[]})};}throw Error(url);};
w.eval(fs.readFileSync('static/search.js','utf8')+'\n'+fs.readFileSync('static/file-translation.js','utf8'));
const tick=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
const file=new w.File(['GMP requirements'],'terms.txt',{type:'text/plain'});Object.defineProperty(d.getElementById('file-input'),'files',{value:[file]});d.getElementById('file-input').dispatchEvent(new w.Event('change'));
assert.equal(d.getElementById('question').required,false);assert.equal(d.getElementById('file-options').hidden,false);
await w.fileTranslator.start();assert.equal(extractCalls,0);d.getElementById('file-consent').checked=true;await w.fileTranslator.start();assert.equal(extractCalls,1);assert.equal(translateCalls,2);assert.match(d.getElementById('conversation').textContent,/1 \/ 3/);assert.equal(d.querySelectorAll('img').length,0);
const resume=[...d.querySelectorAll('button')].find(b=>b.textContent==='남은 부분 이어서 번역');assert.ok(resume);resume.click();await tick();assert.equal(translateCalls,4);assert.match(d.getElementById('conversation').textContent,/3 \/ 3/);assert.equal(extractCalls,1);
d.getElementById('new-question').click();assert.equal(w.fileTranslator.hasFiles(),false);assert.equal(d.getElementById('question').required,true);assert.equal(d.getElementById('file-options').hidden,true);
console.log('PASS: attachment-only submit, consent, sequential translation, partial failure, resume without retranslating, escaping, reset');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
