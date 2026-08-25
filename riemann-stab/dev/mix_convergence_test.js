'use strict';
// Ship-check + regression pins for Lab E-ii / E-iii / asymptotic functionals.
// Uses ONLY canonical builders in core.js (windowFramePair/mixtureStats/
// winFunctionalR/winCrossFunctional). Golden-pins regression: ordinary runs
// compare against reviewed immutable pins.golden.json; --update-pins
// regenerates after printing a diff. All predicates fold into exit status.
const RH=require('./core.js');
const fs=require('fs'), path=require('path');
let ok=true;
function check(name,cond,detail){
  if(cond){console.log('  OK  ',name);}else{ok=false;console.log('  FAIL',name,detail||'');}
}
function approx(a,b,tol){return Math.abs(a-b)<=tol;}

const T0=400, L=Math.log(T0/(2*Math.PI));
const zall=RH.findZeros(10,600,0.18);
console.log('zeros to 600:',zall.length);

// ---- Part 1: frame-length sensitivity counts ----
console.log('=== frame-length sensitivity (canonical C2-tapered MT) ===');
const expectCounts={8:14,10:15,12:18,14:20,16:22,18:24,20:26,24:30};
for(const dd of [8,10,12,14,16,18,20,24]){
  const fr=RH.windowFramePair(zall,dd,T0,L,['mt']);
  check(`d=${dd} zeros=${expectCounts[dd]}`, fr.zs.length===expectCounts[dd], 'got '+fr.zs.length);
}

// ---- Part 2: mixture statistics at d=16 ----
console.log('=== mixture statistics at d=16 ===');
const frame=RH.windowFramePair(zall,16,T0,L,['sind','mt']);
const wSamples=[];for(let i=0;i<=100;i++)wSamples.push(i/100);
const st=RH.mixtureStats(frame,wSamples);
console.log(`X=${st.X.toFixed(5)} Y=${st.Y.toFixed(5)} M=${st.M.toFixed(5)} min=${Math.min(st.X,st.Y).toFixed(5)}`);
check('bestF <= X', st.bestF<=st.X+1e-9, String(st.bestF));
check('bestF <= Y', st.bestF<=st.Y+1e-9, String(st.bestF));
{
  // interior-gain characterization
  let interior=false;
  for(let i=1;i<wSamples.length-1;i++) if(Math.abs(st.fVals[i]-st.bestF)<1e-10) interior=true;
  const noDip=st.M>=Math.min(st.X,st.Y)-1e-9;
  console.log('   minimizer '+(interior?'interior':'at endpoint')+'; dip below better parent = '+(!noDip));
  check('no interior gain below endpoints (observed)', !interior && noDip,
        `interior=${interior} M-min=${(st.M-Math.min(st.X,st.Y)).toExponential(3)}`);
}
check('endpoint w=0 == Y', approx(st.gVals[0],st.Y,1e-8), st.gVals[0].toFixed(6)+' vs '+st.Y.toFixed(6));
check('endpoint w=last == X', approx(st.gVals[st.gVals.length-1],st.X,1e-8),
      st.gVals[st.gVals.length-1].toFixed(6)+' vs '+st.X.toFixed(6));

// ---- Part 3: asymptotic window functionals ----
console.log('=== asymptotic window functionals ===');
const Ra=RH.winFunctionalR('ind',2000);
const Rb=RH.winFunctionalR('mt',2000);
const Rx=RH.winCrossFunctional('ind','mt',1500);
{
  console.log(`R0=${Ra.toFixed(10)} R_MT=${Rb.toFixed(10)} R0MT=${Rx.toFixed(10)}`);
}
check('R0 anchor 4/3', Math.abs(Ra-4/3)<3e-7, Ra.toExponential(3));
{
  const cMT=0.5+Math.cos(1/Math.SQRT2)/(Math.SQRT2*Math.sin(1/Math.SQRT2));
  check('R_MT == c_MT^{-1} closed form', Math.abs(Rb-cMT)<3e-6, Rb+' vs '+cMT);
}
check('R0MT ~ 1.3268234250', Math.abs(Rx-1.3268234250)<3e-6, Rx.toExponential(3));
{
  const wStarL=(Rb-Rx)/(Ra+Rb-2*Rx);
  const fStar=Rb-(Rb-Rx)*(Rb-Rx)/(Ra+Rb-2*Rx);
  const nominal=2-fStar;
  let best=Infinity;
  for(let i=0;i<=400;i++){const w=i/400;const f=w*w*Ra+(1-w)*(1-w)*Rb+2*w*(1-w)*Rx;if(f<best)best=f;}
  check('algebra vs numeric optimum', approx(fStar,best,5e-8), fStar.toFixed(9)+' vs '+best.toFixed(9));
  console.log(`w*=${wStarL.toFixed(6)} mixed moment=${fStar.toFixed(9)} nominal 2-R=${nominal.toFixed(9)} delta=+${(nominal-(2-Rb)).toFixed(9)}`);
}

// ---- Part 4: golden pins (browser parity targets) ----
const Nbar=(frame.sind.tr+frame.mt.tr)/2;
function wStar(){ return (Rb-Rx)/(Ra+Rb-2*Rx); }
function fStar(){ return Rb-(Rb-Rx)*(Rb-Rx)/(Ra+Rb-2*Rx); }
const pins={
  X:st.X, Y:st.Y, M:st.M, bestF:st.bestF, bestG:st.bestG,
  d16zeros:frame.zs.length,
  Ra:Ra, Rb:Rb, Rx:Rx, wStar:wStar(), nominal:(2-fStar()),
};
const goldenPath=path.join(__dirname,'pins.golden.json');
if(process.argv.includes('--update-pins')||!fs.existsSync(goldenPath)){
  if(fs.existsSync(goldenPath)){
    const oldP=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
    console.log('--update-pins diff (old -> new):');
    for(const k of Object.keys(pins))
      if(JSON.stringify(oldP[k])!==JSON.stringify(pins[k]))
        console.log('  ',k,':',JSON.stringify(oldP[k]),'->',JSON.stringify(pins[k]));
  } else console.log('seeding golden pins');
  fs.writeFileSync(goldenPath,JSON.stringify(pins,null,2));
}
const gold=JSON.parse(fs.readFileSync(goldenPath,'utf8'));
for(const k of Object.keys(pins)){
  check('golden parity '+k, JSON.stringify(gold[k])===JSON.stringify(pins[k]),
    'got '+JSON.stringify(pins[k])+' expected '+JSON.stringify(gold[k]));
}

console.log(ok?'ALL VALIDATIONS PASS':'VALIDATIONS FAILED');
process.exit(ok?0:1);
