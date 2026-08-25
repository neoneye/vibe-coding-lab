'use strict';
// Ship-check for the Lab E machinery. EVERY printed predicate is folded into
// the exit status -- a check that prints "off" must fail the run.
//
// Part A (exact): idealized orthonormal frame, paper eq (1.2) bookkeeping.
//   Equalities hold exactly: tr G~ = N, rank P1 = s1, n+(Q') = s2+p (at s>0).
//   Inequality: rank P1 >= B = 4 tr G~ - 2N - ||G~||^2_HS.
// Part B (real zeros near t=400): only inequality-scoped claims are asserted,
//   because the d=16 grid truncates frame mass: tr G~ <= N and tr P1 <= s1.
const RH=require('./core.js');

let ok=true;
function check(name,cond){ if(cond){console.log('  OK  ',name);} else {ok=false;console.log('  FAIL',name);} }

// ---------------- Part A ----------------
console.log('Part A: exact chain in an idealized frame');
const N_TOTAL=24;
function buildSynth(s2,p,soff){
  const s1=N_TOTAL-s2-p;
  const dim=s1+s2+2*p;
  const mk=()=>{const M=[];for(let i=0;i<dim;i++)M.push(new Array(dim).fill(0));return M;};
  const G=mk(),P1=mk();
  const outer=(M,x,y,f)=>{for(let i=0;i<dim;i++)for(let j=0;j<dim;j++)M[i][j]+=f*x[i]*y[j];};
  let slot=0;
  for(let k=0;k<s2;k++){ const v=new Array(dim).fill(0); v[slot]=1; slot++; outer(G,v,v,2); }
  for(let k=0;k<p;k++){
    const ei=slot++, fi=slot++;
    const a=new Array(dim).fill(0), b=new Array(dim).fill(0);
    a[ei]=Math.sqrt(1+soff*soff); b[fi]=soff;
    outer(G,a,a,2); outer(G,b,b,-2);
  }
  for(let k=0;k<s1;k++){ const v=new Array(dim).fill(0); v[slot]=1; slot++;
    outer(G,v,v,1); outer(P1,v,v,1); }
  return {G,P1,dim,s1,N:s1+2*s2+2*p};
}
function diag(M,n){let tr=0,hs=0;for(let i=0;i<n;i++){tr+=M[i][i];for(let j=0;j<n;j++)hs+=M[i][j]*M[i][j];}return{tr,hs};}
function posCount(M,n){const ev=RH.jacobiEigen(M,n);
  const sc=Math.max.apply(null,ev.map(Math.abs).concat([1e-12]));
  return ev.filter(e=>e>1e-9*sc).length;}
for(const [s2,p,s] of [[0,0,1],[3,0,1],[2,4,0.72],[5,6,1.5]]){
  console.log(` case s2=${s2} p=${p} s=${s}`);
  const r=buildSynth(s2,p,s);
  const g=diag(r.G,r.dim);
  const rankP1=posCount(r.P1,r.dim);
  const Qp=[];for(let i=0;i<r.dim;i++)Qp.push(r.G[i].map((v,j)=>v-r.P1[i][j]));
  const nplusQp=posCount(Qp,r.dim);
  const B=4*g.tr-2*r.N-g.hs;
  check(`tr G~ = N (${g.tr.toFixed(6)} vs ${r.N})`, Math.abs(g.tr-r.N)<1e-9);
  check(`rank P1 = s1 = ${r.s1}`, rankP1===r.s1);
  check(`n+(Q') <= s2+p (${nplusQp} <= ${s2+p})`, nplusQp<=s2+p);
  check(`n+(Q') = s2+p when every pair offset s>0`, s===0?true:nplusQp===s2+p||s2+p===0);
  check(`rank P1 >= B (${rankP1} vs ${B.toFixed(3)})`, rankP1>=B-1e-9);
}

// ---------------- Part B ----------------
console.log('Part B: real zeros near t=400 (inequality-scoped claims)');
const T0=400,d=16;
const L=Math.log(T0/(2*Math.PI)),step=2*Math.PI/L;
const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
const all=RH.findZeros(395,430,0.18);
const gammaList=all.filter(g=>g>395&&g<430);
const A=Math.SQRT2*Math.sin(1/Math.SQRT2);
const NORM=1/(A*L*L);
function phiHat(x,y){
  const u0=-L/2,u1=L/2,nodes=2400;
  let re=0,im=0;const h=(u1-u0)/nodes;
  for(let i=0;i<=nodes;i++){
    const w=(i===0||i===nodes)?1:(i%2?4:2);
    const u=u0+i*h;
    const c=Math.cos(Math.SQRT2*u/L);
    if(c<=0)continue;
    const e=Math.exp(-y*u)*Math.sqrt(c);
    re+=w*e*Math.cos(-x*u); im+=w*e*Math.sin(-x*u);
  }
  return {re:re*h/3,im:im*h/3};
}
function buildReal(s2,p,beta){
  const n=gammaList.length;
  const mk=()=>{const M=[];for(let i=0;i<d;i++)M.push(new Array(d).fill(0));return M;};
  const G=mk(),P1=mk();
  const addOuter=(M,v,m)=>{for(let i=0;i<d;i++)for(let j=0;j<d;j++)
    M[i][j]+=m*(v[i].re*v[j].re-v[i].im*v[j].im);};
  for(let idx=0;idx<n;idx++){
    const gr=gammaList[idx];
    if(idx<s2){
      const v=alphas.map(al=>phiHat(gr-al,0));
      addOuter(G,v,NORM); addOuter(G,v,NORM);
    }else if(idx<s2+p){
      const dy=0.5-beta;
      const v=alphas.map(al=>phiHat(gr-al,dy));
      addOuter(G,v,NORM);
      const vc=v.map(z=>({re:z.re,im:-z.im}));
      addOuter(G,vc,NORM);
    }else{
      const v=alphas.map(al=>phiHat(gr-al,0));
      addOuter(G,v,NORM); addOuter(P1,v,NORM);
    }
  }
  return {G,P1,N:n+s2+p};
}
{
  const r=buildReal(2,3,0.72);
  const g=diag(r.G,d), p1=diag(r.P1,d);
  const rankP1=posCount(r.P1,d);
  const B=4*g.tr-2*r.N-g.hs;
  // Frame truncation at d=16 loses mass beyond the grid, so only these hold:
  check(`tr G~ <= N (${g.tr.toFixed(3)} <= ${r.N})`, g.tr<=r.N+1e-9);
  check(`tr P1 <= min(s1, d) (${p1.tr.toFixed(3)})`, p1.tr<=Math.min(gammaList.length-5,d)+1e-9);
  check(`rank P1 >= B (${rankP1} vs ${B.toFixed(3)})`, rankP1>=B-1e-9);
}

console.log(ok?'ALL CHECKS PASS':'CHECKS FAILED');
process.exit(ok?0:1);
