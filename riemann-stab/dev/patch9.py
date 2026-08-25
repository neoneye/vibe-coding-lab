# -*- coding: utf-8 -*-
import io

# ---------- mix_convergence_test.js: immutable golden pins ----------
p='mix_convergence_test.js'
src=io.open(p,encoding='utf-8').read()

old = u"""  // golden-pins regression: compare against reviewed immutable values.
  // Ordinary runs NEVER rewrite the golden file; `node mix_convergence_test.js --update-pins`
  // regenerates it after showing a diff, for explicit manual review.
  const fs=require('fs'), path=require('path');
  const pins={X:st.X,Y:st.Y,M:st.M,bestF:st.bestF,bestG:st.bestG,d16zeros:frame.zs.length,
              d24ratio:r24.hs.mt/r24.tr.mt,d24zeros2:r24.zs.length};
  const goldenPath=path.join(__dirname,'pins.golden.json');
  const updateFlag=process.argv.includes('--update-pins');
  if(updateFlag||!fs.existsSync(goldenPath)){
    if(fs.existsSync(goldenPath)){
      const oldP=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
      console.log('--update-pins diff (old -> new):');
      for(const k of Object.keys(pins)){
        const a=oldP[k],b=pins[k];
        if(typeof b==='number') console.log('  ',k,a&&a.toFixed?a.toFixed(6):a,'->',b.toFixed?b.toFixed(6):b);
        else console.log('  ',k,a,'->',b);
      }
    } else console.log('seeding golden pins');
    fs.writeFileSync(goldenPath,JSON.stringify(pins,null,2));
  }
  const gold=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
  for(const k of Object.keys(pins)){
    if(typeof pins[k]==='number'){
      const rel=Math.abs(pins[k]-gold[k])/Math.max(1e-12,Math.abs(gold[k]));
      check('golden parity '+k, rel<1e-9, 'got '+pins[k]+' expected '+gold[k]);
    } else check('golden parity '+k, pins[k]===gold[k], pins[k]+' vs '+gold[k]);
  }"""

new = u"""  // golden-pins regression: compare against reviewed immutable values.
  // Ordinary runs NEVER rewrite the golden file; --update-pins regenerates it
  // after printing a diff, for explicit manual review.
  const fs=require('fs'), path=require('path');
  const r24=buildPair(zall,24);
  const pins={X:st.X,Y:st.Y,M:st.M,bestF:st.bestF,bestG:st.bestG,d16zeros:frame.zs.length,
              d24ratio:r24.hs.mt/r24.tr.mt,d24count:r24.zs.length};
  const goldenPath=path.join(__dirname,'pins.golden.json');
  const updateFlag=process.argv.includes('--update-pins');
  if(updateFlag||!fs.existsSync(goldenPath)){
    if(fs.existsSync(goldenPath)){
      const oldP=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
      console.log('--update-pins diff (old -> new):');
      for(const k of Object.keys(pins)){
        const a=oldP[k],b=pins[k];
        if(typeof b==='number') console.log('  ',k,a.toFixed?a.toFixed(6):a,'->',(typeof b==='number'&&b.toFixed)?b.toFixed(6):b);
        else console.log('  ',k,a,'->',b);
      }
    } else console.log('seeding golden pins');
    fs.writeFileSync(goldenPath,JSON.stringify(pins,null,2));
  }
  const gold=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
  for(const k of Object.keys(pins)){
    if(typeof pins[k]==='number'){
      const rel=Math.abs(pins[k]-gold[k])/Math.max(1e-12,Math.abs(gold[k]));
      check('golden parity '+k, rel<1e-9, 'got '+pins[k]+' expected '+gold[k]);
    } else check('golden parity '+k, pins[k]===gold[k], pins[k]+' vs '+gold[k]);
  }"""

assert old in src, 'golden block mismatch'
src=src.replace(old,new)
io.open(p,'w',encoding='utf-8').write(src)
print('mix test golden flow OK')

# ---------- ui_dom_smoke.js: polling waits + golden parity ----------
p='ui_dom_smoke.js'
src=io.open(p,encoding='utf-8').read()

start=src.find(u"// re-click handlers once async caches have had a chance to settle")
assert start>=0
new_tail=u"""// re-click handlers once async caches have had a chance to settle
setTimeout(()=>{ ['mixRun','convRun'].forEach(id=>call(id,'onclick')); },2600);

// poll until settled, then run full assertions
setTimeout(()=>{
  const started=Date.now();
  function poll(){
    const dataOK=cvRegistry['mixCanvas']&&cvRegistry['mixCanvas']._data;
    const convOK=registry['convTable']&&String(registry['convTable'].innerHTML).indexOf('HS\u00b2/tr G~')>=0;
    if(!(dataOK&&convOK)&&Date.now()-started<15000){ setTimeout(poll,250); return; }
    inspect();
  }
  poll();
},100);

function inspect(){
  let fail=0;
  const uncaughtN=uncaught;
  if(uncaughtN){ fail++; console.error('FAIL uncaught exceptions:',uncaughtN); }

  // self-test rows
  {
    const rows=registry['selftest']?registry['selftest']._children:[];
    if(rows.length!==8){ fail++; console.error('expected 8 self-test rows, saw',rows.length); }
    for(const r of rows){
      const dot=r.querySelector('.st-dot');
      if(!dot||String(dot.className).indexOf('pass')<0){
        fail++;
        const nm=r.querySelector('.st-name'), vl=r.querySelector('.st-val');
        console.error('SELFTEST FAIL:',nm&&nm.textContent,'->',vl&&vl.textContent);
      }
    }
  }

  // Lab C stats
  if(!registry['efStats']||!registry['efStats']._children.length){ fail++; console.error('Lab C stats empty'); }

  // Lab E-i stats
  if(!registry['cStats']||!registry['cStats']._children.length){ fail++; console.error('Lab E-i stats empty'); }

  // Lab B verdict
  if(registry['auditVerdict']&&String(registry['auditVerdict'].innerHTML).indexOf('verdict')<0){ fail++; console.error('Lab B verdict missing'); }

  // E-iii mixture stats
  const ms=registry['mixStats'];
  if(!ms||ms._children.length<5){ fail++; console.error('E-iii mixture stats missing'); }
  else{
    const f0=ms._children[0];
    const txt=(f0.querySelector('.k')||{textContent:''}).textContent+' '+((f0.querySelector('.v')||{textContent:''}).textContent);
    console.log('mixture stat[0]:',txt.slice(0,80));
  }

  // convergence table
  if(!registry['convTable']||String(registry['convTable'].innerHTML).indexOf('HS\u00b2/tr G~')<0){ fail++; console.error('convergence table missing'); }

  // browser <-> golden parity
  try{
    const goldenPath=require('path').join(__dirname,'pins.golden.json');
    const gold=JSON.parse(require('fs').readFileSync(goldenPath,'utf8'));
    const data=cvRegistry['mixCanvas']&&cvRegistry['mixCanvas']._data;
    if(!data){ fail++; console.error('mixCanvas._data missing'); }
    else for(const key of ['X','Y','M','bestF','bestG']){
      const rel=Math.abs(data[key]-gold[key])/Math.max(1e-12,Math.abs(gold[key]));
      if(rel>1e-6){ fail++; console.error('PARITY FAIL',key,'browser='+data[key],'golden='+gold[key]); }
      else console.log('parity OK:',key,data[key].toFixed(6));
    }
  }catch(e){ fail++; console.error('parity error:',e.message); }

  if(fail){ console.error('DOM SMOKE FAILED,',fail,'issue(s)'); process.exit(1); }
  console.log('DOM SMOKE PASS \u2014 init path clean, self-test green, handlers OK, browser==golden');
  process.exit(0);
}
"""
src=src[:start]+new_tail
io.open(p,'w',encoding='utf-8').write(src)
print('smoke rewritten')
PYEOF