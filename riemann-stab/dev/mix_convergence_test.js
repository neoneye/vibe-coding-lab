'use strict';
// Regression pins for Lab E-iii / E-ii, browser parity (zeros through 600).
// Every predicate folds into the exit status; writes dev/pins.json on success.
const RH=require('./core.js');
const fs=require('fs'), path=require('path');
let ok=true;
function check(name,cond,detail){
  if(cond){console.log('  OK  ',name);}else{ok=false;console.log('  FAIL',name,detail||'');}
}
const T0=400, L=Math.log(T0/(2*Math.PI)), step=2*Math.PI/L;
const zall=RH.findZeros(10,600,0.18);
console.log('zeros to 600:',zall.length);
const EPS_FRAC=0.20;
function quintic(t){t=Math.min(1,Math.max(0,t));return t*t*t*(10-15*t+6*t*t);}
function ampOf(shape,u){
  const au=Math.abs(u);
  if(shape==='mt') return Math.sqrt(Math.max(0,Math.cos(Math.SQRT2*u/L)))*quintic((L/2-au)/EPS_FRAC);
  if(shape==='sind') return quintic((L/2-au)/EPS_FRAC);
  throw new Error('shape');
}
function aIntOf(shape){
  let acc=0;const n=4000,h=(L/2)/n;
  for(let i=0;i<=n;i++){const wt=(i===0||i===n)?0.5:1;acc+=wt*Math.pow(ampOf(shape,i*h),2);}
  return 2*acc*h/L;
}
function phiHatV(shape,x){
  let re=0,im=0;const u0=-L/2,u1=L/2,nodes=2400,h=(u1-u0)/nodes;
  for(let i=0;i<=nodes;i++){
    const wt=(i===0||i===nodes)?1:(i%2?4:2);
    const u=u0+i*h,m=ampOf(shape,u);
    if(m===0)continue;
    re+=wt*m*Math.cos(-x*u); im+=wt*m*Math.sin(-x*u);
  }
  return {re:re*h/3,im:im*h/3};
}
function buildPair(gammaList,d){
  const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
  const lo=T0-L,hi=T0+d*step+L;
  const zs=gammaList.filter(g=>g>lo&&g<hi);
  const out={zs,V:{sind:[],mt:[]},G:{},tr:{},hs:{}};
  for(const shape of ['sind','mt']){
    const normJ=1/(aIntOf(shape)*L*L);
    const G=[];for(let i=0;i<d;i++)G.push(new Array(d).fill(0));
    for(const gr of zs){
      const v=alphas.map(al=>phiHatV(shape,gr-al));
      out.V[shape].push(v);
      for(let i=0;i<d;i++)for(let j=0;j<d;j++)G[i][j]+=normJ*(v[i].re*v[j].re-v[i].im*v[j].im);
    }
    let tr=0,hs=0;for(let i=0;i<d;i++){tr+=G[i][i];}for(let i=0;i<d;i++)for(let j=0;j<d;j++)hs+=G[i][j]*G[i][j];
    out.G[shape]=G;out.tr[shape]=tr;out.hs[shape]=hs;
  }
  return out;
}
function hsOf(M){let s=0;for(const row of M)for(const x of row)s+=x*x;return s;}
function trOf(M){let s=0;for(let i=0;i<M.length;i++)s+=M[i][i];return s;}
function symViol(M){let s=0;for(let i=0;i<M.length;i++)for(let j=0;j<M.length;j++)s=Math.max(s,Math.abs(M[i][j]-M[j][i]));return s;}

// ---- grid-size sensitivity counts (browser parity) ----
console.log('=== frame-length sensitivity (C2-tapered MT window) ===');
const expectCounts={8:14,10:15,12:18,14:20,16:22,18:24,20:26,24:30};
for(const dd of [8,10,12,14,16,18,20,24]){
  const r=buildPair(zall,dd);
  check(`d=${dd} zeros=${expectCounts[dd]}`, r.zs.length===expectCounts[dd], 'got '+r.zs.length);
}

// ---- mixture statistics at d=16 ----
console.log('=== mixture statistics at d=16 (canonical builder) ===');
{
  const frame=RH.windowFramePair(zall,16,T0,L,['sind','mt']);
  const wSamples=[];for(let i=0;i<=100;i++)wSamples.push(i/100);
  const st=RH.mixtureStats(frame,wSamples);
  console.log(`X=${st.X.toFixed(5)} Y=${st.Y.toFixed(5)} M=${st.M.toFixed(5)} min=${Math.min(st.X,st.Y).toFixed(5)}`);
  const predicted=st.M<Math.min(st.X,st.Y);
  const observed=st.bestF<Math.min(st.X,st.Y)-1e-12;
  check('criterion/scan consistency', predicted===observed, `predicted=${predicted} observed=${observed}`);
  check('no dip with admissible C2 windows (observed)', !observed);
  // endpoints reproduce parents exactly
  check('endpoint w=0 == Y', Math.abs(st.gVals[0]-st.Y)<1e-8, st.gVals[0].toFixed(6));
  check('endpoint w=1 == X', Math.abs(st.gVals[st.gVals.length-1]-st.X)<1e-8, st.gVals[st.gVals.length-1].toFixed(6));
  check('bestG <= min(parents)+tol (scan invariant)', st.bestG<=Math.min(st.X,st.Y)+1e-9,
        `bestG=${st.bestG.toFixed(5)}`);
  check('window-mixture symmetric matrices', st.symViol<1e-8*Math.max(1,st.bestG), st.symViol.toExponential(2));
  // reviewer counterexample via same machinery
  {
    const Xc=4,Yc=1,Mc=1.5;let b=Infinity;
    for(let i=0;i<=400;i++){const w=i/400;const f=w*w*Xc+(1-w)*(1-w)*Yc+2*w*(1-w)*Mc;if(f<b)b=f;}
    check('counterexample (4,1,1.5): no dip', b>=Yc-1e-12, b.toFixed(6));
  }
  // golden-pins regression: compare against reviewed immutable values.
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
        if(JSON.stringify(oldP[k])!==JSON.stringify(pins[k]))
          console.log('  ',k,':',JSON.stringify(oldP[k]),'->',JSON.stringify(pins[k]));
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
  }
}

console.log(ok?'ALL VALIDATIONS PASS':'VALIDATIONS FAILED');
process.exit(ok?0:1);
