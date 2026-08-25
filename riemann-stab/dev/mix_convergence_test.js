'use strict';
// Ship-check + regression pins for Lab E-ii / E-iii (browser-parity).
// Zeros obtained exactly as the page obtains them: through height 600.
// Every printed predicate folds into the exit status.
//
// NOTE on metrics: ||G||^2_HS / tr(G) is NOT scale-invariant -- it scales
// linearly under G -> lambda*G. All cross-window comparisons therefore use
// matrices first normalized to a COMMON trace Nbar.
const RH=require('./core.js');
let ok=true;
function check(name,cond,detail){
  if(cond){console.log('  OK  ',name);}else{ok=false;console.log('  FAIL',name,detail||'');}
}

const T0=400, L=Math.log(T0/(2*Math.PI)), step=2*Math.PI/L;
const zall=RH.findZeros(10,600,0.18);

const EPS_FRAC=0.18;
function ampOf(shape,u){
  const au=Math.abs(u);
  if(shape==='mt') return (c=>c<=0?0:Math.sqrt(c))(Math.cos(Math.SQRT2*u/L));
  const r=Math.min(1,Math.max(0,(L/2-au)/(EPS_FRAC*L)));
  return r*r*(3-2*r);
}
function aIntOf(shape){
  let acc=0; const n=4000,h=(L/2)/n;
  for(let i=0;i<=n;i++){ const wt=(i===0||i===n)?0.5:1; acc+=wt*Math.pow(ampOf(shape,i*h),2); }
  return 2*acc*h/L;
}
function phiHatV(shape,x,y){
  const u0=-L/2,u1=L/2,nodes=2400;
  let re=0,im=0;const h=(u1-u0)/nodes;
  for(let i=0;i<=nodes;i++){
    const wt=(i===0||i===nodes)?1:(i%2?4:2);
    const u=u0+i*h,m=ampOf(shape,u);
    if(m===0)continue;
    const ev=Math.exp(-y*u)*m;
    re+=wt*ev*Math.cos(-x*u); im+=wt*ev*Math.sin(-x*u);
  }
  return {re:re*h/3,im:im*h/3};
}
function buildPair(gammaList,d){
  const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
  const lo=T0-L, hi=T0+d*step+L;
  const zs=gammaList.filter(g=>g>lo&&g<hi);
  const out={zs,V:{sind:[],mt:[]},G:{},tr:{},hs:{}};
  for(const shape of ['sind','mt']){
    const normJ=1/(aIntOf(shape)*L*L);
    const G=[];for(let i=0;i<d;i++)G.push(new Array(d).fill(0));
    for(const gr of zs){
      const v=alphas.map(al=>phiHatV(shape,gr-al,0));
      out.V[shape].push(v);
      for(let i=0;i<d;i++)for(let j=0;j<d;j++)G[i][j]+=normJ*(v[i].re*v[j].re-v[i].im*v[j].im);
    }
    let tr=0,hs=0;for(let i=0;i<d;i++){tr+=G[i][i];}for(let i=0;i<d;i++)for(let j=0;j<d;j++)hs+=G[i][j]*G[i][j];
    out.G[shape]=G; out.tr[shape]=tr; out.hs[shape]=hs;
  }
  return out;
}
function hsOf(M){let s=0;for(const row of M)for(const x of row)s+=x*x;return s;}
function trOf(M){let s=0;for(let i=0;i<M.length;i++)s+=M[i][i];return s;}
// normalize M to trace Nbar
function normTo(M,Nbar){const f=Nbar/trOf(M);return M.map(row=>row.map(x=>x*f));}

// ---- Part 1: grid-size sensitivity, browser parity ----
console.log('=== grid-size sensitivity (smoothed-MT window) ===');
const expectCounts={8:14,10:15,12:18,14:20,16:22,18:24,20:26,24:30};
let ratio24=null;
for(const dd of [8,10,12,14,16,18,20,24]){
  const r=buildPair(zall,dd);
  const nz=r.zs.length;
  const ratio=r.hs.mt/Nbar_dd(r); // normalized to Nbar = mean parent trace of this frame
  function Nbar_dd(rr){return rr.tr.mt;} // per-frame normalization: trace of MT parent itself
  // simpler & consistent: normalize by own trace
  void Nbar_dd;
  const ratio2=r.hs.mt/r.tr.mt;
  void ratio;
  check(`d=${dd} zeros=${expectCounts[dd]}`, nz===expectCounts[dd], 'got '+nz);
  console.log(`   d=${dd} nz=${nz} tr(mt)=${r.tr.mt.toFixed(3)} HS2/tr=${ratio2.toFixed(5)}`);
  if(dd===24) ratio24=ratio2;
}
check('d=24 ratio matches browser 1.2702', Math.abs(ratio24-1.27022)<5e-3, String(ratio24));

// ---- Part 2: trace-normalized mixture, corrected criterion ----
console.log('=== mixture at d=16, common-trace normalized ===');
{
  const d=16;
  const r=buildPair(zall,d);
  const Nbar=(r.tr.sind+r.tr.mt)/2;
  const A=normTo(r.G.sind,Nbar), B=normTo(r.G.mt,Nbar);
  const X=hsOf(A), Y=hsOf(B);
  let M=0;for(let i=0;i<d;i++)for(let j=0;j<d;j++)M+=A[i][j]*B[j][i];
  console.log(`X=${X.toFixed(5)} Y=${Y.toFixed(5)} M=${M.toFixed(5)} min(X,Y)=${Math.min(X,Y).toFixed(5)}`);
  check('corrected dip criterion holds here: M < min(X,Y)', M<Math.min(X,Y),
        `M-min=${(M-Math.min(X,Y)).toExponential(3)}`);
  let best=Infinity;
  for(let i=0;i<=400;i++){ const w=i/400;
    const f=w*w*X+(1-w)*(1-w)*Y+2*w*(1-w)*M;
    if(f<best)best=f; }
  check('matrix-mixture dips below better parent', best<Math.min(X,Y)-1e-9, best.toFixed(6));
  // reviewer counterexample: X=4,Y=1,M=1.5 must NOT dip
  {
    const Xc=4,Yc=1,Mc=1.5; let b=Infinity;
    for(let i=0;i<=400;i++){const w=i/400;const f=w*w*Xc+(1-w)*(1-w)*Yc+2*w*(1-w)*Mc;if(f<b)b=f;}
    check("counterexample (4,1,1.5): no dip below Y", b>=Yc-1e-12, b.toFixed(6));
  }
}

// ---- Part 3: rank-one-preserving window mixture (certificate-valid family) ----
console.log('=== rank-one-preserving window mixture at d=16 ===');
{
  const d=16;
  const r=buildPair(zall,d);
  const Nbar=(r.tr.sind+r.tr.mt)/2;
  const Xn=hsOf(normTo(r.G.sind,Nbar)), Yn=hsOf(normTo(r.G.mt,Nbar));
  let bestRO=Infinity,bestW=0;
  for(let i=0;i<=100;i++){
    const w=i/100, sw=Math.sqrt(w), sq=Math.sqrt(1-w);
    const G=[];for(let a=0;a<d;a++)G.push(new Array(d).fill(0));
    for(let k=0;k<r.zs.length;k++){
      const va=r.V.sind[k], vb=r.V.mt[k];
      for(let a2=0;a2<d;a2++)for(let b2=0;b2<d;b2++){
        const ur=sw*va[a2].re+sq*vb[a2].re, ui=sw*va[a2].im+sq*vb[a2].im;
        G[a2][b2]+=ur*ur-ui*ui;
      }
    }
    // normalize mixed matrix to the SAME common trace, then measure
    const rr=hsOf(normTo(G,Nbar));
    if(rr<bestRO){bestRO=rr;bestW=w;}
  }
  console.log(`window-mixture best HS2@common-trace = ${bestRO.toFixed(5)} at w=${bestW.toFixed(2)}`);
  console.log(`parents: smoothed-ind ${Xn.toFixed(5)}, MT ${Yn.toFixed(5)} (target asymptote c^-1_MT = 1.32750)`);
  // CCLM17 says MT is optimal among windows; toy scale may deviate, but a large
  // undercut would contradict it. Assert within noise band:
  check('rank-one window mixture does not undercut MT beyond noise', bestRO>Yn-0.01,
        `best-minus-MT=${(bestRO-Yn).toFixed(5)}`);
}

console.log(ok?'ALL VALIDATIONS PASS':'VALIDATIONS FAILED');
process.exit(ok?0:1);
