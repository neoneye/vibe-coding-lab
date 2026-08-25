'use strict';
// DOM-stub smoke test: executes the UI script EXACTLY as shipped inside
// ../index.html (extracted <script> blocks), drives every control handler,
// waits for async chunks, and verifies the self-test reports all-green.
const fs=require('fs'), path=require('path'), vm=require('vm');

let uncaught=0;
process.on('uncaughtException',e=>{ uncaught++; console.error('UNCAUGHT:',e && e.message || e); });

// ---- minimal but faithful-enough DOM ----
const registry={};
const cvRegistry={};
const call=(id,evt)=>{ try{ const el=registry[id]; if(el&&typeof el[evt]==='function') el[evt](); }
                        catch(e){ uncaught++; console.error('HANDLER FAIL',id,e&&e.message); } };
const DEFAULT_VALUE={
  zpT0:'0', zpT1:'60', auditT:'50', efTau:'300', efW:'20',
  gPairs:'0', gBeta:'72', cS2:'0', cPairs:'0', cOff:'100',
};
function makeCtx(){
  return new Proxy({}, {
    get(t,k){ if(k in t) return t[k]; return (..._a)=>undefined; },
    set(t,k,v){ t[k]=v; return true; }
  });
}
function elStub(id){
  const children=[];
  const el={
    id, style:{}, className:'', innerHTML:'', textContent:'',
    disabled:false, checked:false, value:DEFAULT_VALUE[id]!==undefined?DEFAULT_VALUE[id]:'0',
    clientWidth:980, width:0, height:0,
    appendChild(c){ children.push(c); return c; },
    querySelector(sel){ if(!el._q[sel]) el._q[sel]={className:'',textContent:'',style:{}}; return el._q[sel]; },
    querySelectorAll(){ return []; },
    setAttribute(k,v){ if(k==='max') el._max=v; },
    getAttribute(){ return null; },
    addEventListener(){},
    getContext(){ if(!el._ctx){ el._ctx=makeCtx(); if(id)cvRegistry[id]=el; } return el._ctx; },
    _data:null,
    firstElementChild:{style:{}},
    onclick:null, oninput:null, onchange:null,
    _children:children, _q:{}, _max:null,
  };
  return el;
}
global.window={ devicePixelRatio:1, addEventListener(){}, RH:null };
global.document={
  getElementById:id=>{ if(!registry[id]) registry[id]=elStub(id); return registry[id]; },
  createElement:()=>elStub('anon'),
  body:{},
  addEventListener(){},
};
global.getComputedStyle=()=>({ getPropertyValue:()=>'' });
global.window.RH=require('./core.js');

// ---- load the UI exactly as shipped ----
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const parts=html.split('<script>');
if(parts.length!==3){ console.error('expected 2 script blocks'); process.exit(1); }
const uiCode=parts[2].split('</script>')[0];
vm.runInThisContext(uiCode,{filename:'shipped-ui.js'});
console.log('initializers executed without synchronous crash');

// ---- drive every handler ----
setTimeout(()=>{
  ['zpFind','auditRun','efRun','pcRun','mixRun','convRun'].forEach(id=>call(id,'onclick'));
  ['auditT','efTau','efW','cS2','cPairs','cOff','gPairs','gBeta','zpT0','zpT1','zpGram']
    .forEach(id=>call(id,'oninput'));
  call('zpT0','onchange'); call('zpT1','onchange'); call('zpGram','onchange');
},400);

// ---- settle: re-click, poll until ready, inspect with full assertions ----
setTimeout(()=>{ ['mixRun','convRun'].forEach(id=>call(id,'onclick')); },2600);

const pollStart=Date.now();
function poll(){
  const dataOK=cvRegistry['mixCanvas']&&cvRegistry['mixCanvas']._data;
  const convOK=registry['convTable']&&String(registry['convTable'].innerHTML).indexOf('HS\u00b2/tr G~')>=0;
  if(!(dataOK&&convOK)&&Date.now()-pollStart<15000){ setTimeout(poll,250); return; }
  inspect();
}
setTimeout(poll,100);

function inspect(){
  let fail=0;
  if(uncaught){ fail++; console.error('FAIL uncaught exceptions:',uncaught); }
  const box=registry['selftest'];
  const rows=box ? box._children : [];
  for(const r of rows){
    const dot=r.querySelector('.st-dot');
    const val=r.querySelector('.st-val');
    const pass=dot && String(dot.className).indexOf('pass')>=0;
    if(!pass){ fail++; console.error('SELFTEST FAIL:', r.querySelector('.st-name') && r.querySelector('.st-name').textContent, '->', val && val.textContent); }
    else console.log('selftest pass:', val.textContent);
  }
  if(rows.length!==8){ fail++; console.error('expected 8 self-test rows, saw',rows.length); }
  if(!registry['efStats'] || !registry['efStats']._children.length){ fail++; console.error('Lab C stats empty'); }
  if(!registry['cStats'] || !registry['cStats']._children.length){ fail++; console.error('Lab E-i stats empty'); }
  if(!registry['auditVerdict'] || String(registry['auditVerdict'].innerHTML).indexOf('verdict')<0){ fail++; console.error('Lab B verdict missing'); }
  const ms=registry['mixStats'];
  if(!ms || ms._children.length<5){ fail++; console.error('E-iii mixture stats missing'); }
  else {
    const first=ms._children[0];
    const txt=(first.querySelector('.k')&&first.querySelector('.k').textContent||'')+' '+
              (first.querySelector('.v')?first.querySelector('.v').textContent:'');
    console.log('mixture stat[0]:',txt.slice(0,80));
  }
  const convOK2=registry['convTable']&&String(registry['convTable'].innerHTML).indexOf('HS\u00b2/tr G~')>=0;
  if(!convOK2){ fail++; console.error('convergence table missing'); }
  try{
    const goldenPath=require('path').join(__dirname,'pins.golden.json');
    const golden=JSON.parse(require('fs').readFileSync(goldenPath,'utf8'));
    const data=cvRegistry['mixCanvas'] && cvRegistry['mixCanvas']._data;
    if(!data){ fail++; console.error('mixCanvas._data missing'); }
    else{
      for(const key of ['X','Y','M','bestF','bestG']){
        const rel=Math.abs(data[key]-golden[key])/Math.max(1e-12,Math.abs(golden[key]));
        if(rel>1e-6){ fail++; console.error('PARITY FAIL',key,'browser='+data[key],'golden='+golden[key]); }
        else console.log('parity OK:',key,data[key].toFixed(6));
      }
      if(data.d16zeros!==golden.d16zeros){ fail++; console.error('FAIL d16zeros parity'); }
    }
  }catch(e){ fail++; console.error('pins parity error:',e.message); }

  if(fail){ console.error('DOM SMOKE FAILED,',fail,'issue(s)'); process.exit(1); }
  console.log('DOM SMOKE PASS \u2014 init path clean, self-test green, handlers OK, browser==golden');
  process.exit(0);
}
