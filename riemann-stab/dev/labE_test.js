'use strict';
const RH=require('./core.js');
// Replicates ui.js Lab E algorithm exactly
const T0=400, d=16;
const L=Math.log(T0/(2*Math.PI)), step=2*Math.PI/L;
const alphas=[]; for(let k=0;k<d;k++) alphas.push(T0+k*step);
const lo=T0-L, hi=T0+d*step+L+1;
const all=RH.findZeros(10,600,0.18);
const gammaList=all.filter(g=>g>lo&&g<hi);
console.log('zeros in window:',gammaList.length,'range',gammaList[0].toFixed(3),'..',gammaList[gammaList.length-1].toFixed(3));
const a=Math.SQRT2*Math.sin(1/Math.SQRT2);
let ci=0,best=1e18;
gammaList.forEach((g,i)=>{const dd=Math.abs(g-(T0+d*step/2));if(dd<best){best=dd;ci=i;}});
const state={L,d,alphas,gammaList,a,centerIdx:ci};

function phiHatQuad(x,y,nodes,u0,u1){
  const f=u=>{ const c=Math.cos(Math.SQRT2*u/L); if(c<=0)return {re:0,im:0};
    const amp=Math.sqrt(c), ph=-(x)*u, gr=-y*u;
    const e=Math.exp(gr)*amp;
    return {re:e*Math.cos(ph), im:e*Math.sin(ph)}; };
  let re=0,im=0; const h=(u1-u0)/nodes;
  for(let i=0;i<=nodes;i++){ const w=(i===0||i===nodes)?1:(i%2?4:2);
    const v=f(u0+i*h); re+=w*v.re; im+=w*v.im; }
  const s=h/3; return {re:re*s, im:im*s};
}
function buildG(offBeta){
  const {alphas,gammaList,L,a,d}=state;
  const G=[]; for(let i=0;i<d;i++){G.push(new Array(d).fill(0));}
  const norm=1/(a*L*L);
  function addTerm(v1,v2,mult){
    for(let i=0;i<d;i++)for(let j=0;j<d;j++)
      G[i][j]+=mult*(v1[i].re*v2[j].re - v1[i].im*v2[j].im);
  }
  gammaList.forEach((gr,idx)=>{
    if(offBeta!==null&&idx===ci) return;
    const v=alphas.map(al=>phiHatQuad(gr-al,0,2400,-L/2,L/2));
    addTerm(v,v,1*norm);
  });
  if(offBeta!==null){
    const gr=gammaList[ci];
    const dy=0.5-offBeta;
    const v=alphas.map(al=>phiHatQuad(gr-al,dy,2400,-L/2,L/2));
    addTerm(v,v,1*norm);
    const vc=v.map(z=>({re:z.re,im:-z.im}));
    addTerm(vc,vc,1*norm);
  }
  return G;
}
function analyze(G,label){
  const ev=RH.jacobiEigen(G,d);
  const scale=Math.max.apply(null,ev.map(Math.abs));
  const neg=ev.filter(e=>e<-1e-9*scale).length;
  const pos=ev.filter(e=>e>1e-9*scale).length;
  console.log(label,'| λmax='+ev[0].toExponential(4),'λmin='+ev[d-1].toExponential(4),'inertia ('+pos+'+,'+neg+'−)');
  return {ev,neg};
}
const gOn=buildG(null);
const rOn=analyze(gOn,'on-line   ');
if(rOn.neg!==0){console.log('FAIL: on-line compression must be PSD');process.exit(1);}
const gOff=buildG(0.51);
const rOff=analyze(gOff,'off β=0.51');
console.log('trace before:',d*0, 'tr G̃ ≈ #zeros =',gammaList.length, ' computed tr =',gOn.reduce((s,row,i)=>s+row[i],0).toFixed(3));
if(rOff.neg===1){console.log('PASS: exactly one negative direction born from one off-line pair — Sylvester counts it.');}
else{console.log('RESULT: negative count =',rOff.neg);process.exit(1);}
