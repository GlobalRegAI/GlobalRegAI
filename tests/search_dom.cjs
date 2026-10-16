// Interaction checks, not a browser layout/device test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const {JSDOM}=createRequire(process.env.DOM_DEPENDENCY_ROOT+'/probe.cjs')('jsdom');
const html=fs.readFileSync('/tmp/globalregai-home.html','utf8');
const script=fs.readFileSync('static/search.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function setup(handler){const dom=new JSDOM(html,{url:'https://globalregai.info/?lang=ko',runScripts:'outside-only'});dom.window.HTMLElement.prototype.scrollIntoView=function(){};dom.window.AbortController=AbortController;dom.window.fetch=handler;dom.window.eval(script);return dom;}
function submit(d,text){d.getElementById('question').value=text;d.getElementById('ask-form').dispatchEvent(new d.defaultView.Event('submit',{cancelable:true,bubbles:true}));}
const response=data=>({ok:true,json:async()=>data});
(async()=>{
 const requests=[];
 const dom=setup(async(url,opts)=>{const b=JSON.parse(opts.body);requests.push(b);if(requests.length===1)return response({status:'CLARIFICATION_REQUIRED',field:'regions',message:'대상 국가',context:{domain:'Cosmetics',regions:[],details:''},choices:[{label:'미국',value:'FDA'},{label:'한국',value:'MFDS'}]});return response({status:'EVIDENCE_LIMITED',context:b.context,message:'<img src=x onerror=alert(1)>',groups:[{market_label:'미국',claims:[],sources:[]}]});});
 const d=dom.window.document;
 submit(d,'화장품 등록 요건');await tick();
 const buttons=d.querySelectorAll('.choices button');buttons[0].click();buttons[1].click();d.querySelector('.continue').click();await tick();
 assert.equal(requests.length,2);assert.equal(requests[1].query,'화장품 등록 요건');assert.deepEqual(requests[1].context.regions,['FDA','MFDS']);assert.equal(d.querySelectorAll('img').length,0);assert.match(d.getElementById('conversation').textContent,/<img/);
 d.getElementById('new-question').click();assert.equal(d.getElementById('conversation').children.length,0);assert.equal(d.body.classList.contains('started'),false);
 dom.window.close();
 let count=0;const retry=setup(async()=>{count++;if(count===1)throw Error('Connection failed');return response({status:'EVIDENCE_LIMITED',context:{},message:'No evidence',groups:[]});});submit(retry.window.document,'FDA device requirements');await tick();retry.window.document.querySelector('.message .choice').click();await tick();assert.equal(count,2);assert.equal(retry.window.document.getElementById('send').disabled,false);retry.window.close();
 console.log('PASS: progressive market comparison, original question, escaping, reset, retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
