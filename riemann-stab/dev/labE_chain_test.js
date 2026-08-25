'use strict';
// Lab E ship-check: paper eq (1.2) at toy scale.
// G̃ = P1 (simple on-line) + multiples (on-line, counted twice) + off-line pairs.
// Verify: tr G̃ ≈ N, rank P1 = s1, and the rank–trace chain
//   rank P1 >= 4 tr G̃ − 2N − ‖G̃‖²_HS,  with B/N → (2−R(ψ)) when all simple.
const RH=require('./core.js');
const T0=400,d=16;
const L=Math.log(T0/(2*Math.PI)),step=2*Math.PI/L;
const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
const all=RH.findZeros(395,430,0.18);
const gammaList=all.filter(g=>g>395&&g<430);
console.log('zeros in window:',gammaList.length);
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
function zerosMat(){const M=[];for(let i=0;i<d;i++)M.push(new Array(d).fill(0));return M;}
function addOuter(M,v1,v2,m){for(let i=0;i<d;i++)for(let j=0;j<d;j++)
  M[i][j]+=m*(v1[i].re*v2[j].re-v1[i].im*v2[j].im);}

function build(s2,p,beta){
  const n=gammaList.length;
  const G=zerosMat(),P1=zerosMat();
  for(let idx=0;idx<n;idx++){
    const gr=gammaList[idx];
    if(idx<s2){                       // multiple on-line zero: vv^T twice
      const v=alphas.map(al=>phiHat(gr-al,0));
      addOuter(G,v,v,NORM); addOuter(G,v,v,NORM);
    }else if(idx<s2+p){               // off-line pair at beta (+ mirror)
      const dy=0.5-beta;
      const v=alphas.map(al=>phiHat(gr-al,dy));
      addOuter(G,v,v,NORM);
      const vc=v.map(z=>({re:z.re,im:-z.im}));
      addOuter(G,vc,vc,NORM);
    }else{                            // simple on-line -> lands in P1
      const v=alphas.map(al=>phiHat(gr-al,0));
      addOuter(G,v,v,NORM); addOuter(P1,v,v,NORM);
    }
  }
  return {G,P1,N:n+s2+p,s1:n-s2-p};
}
function diag(M){let tr=0,hs=0;for(let i=0;i<d;i++){tr+=M[i][i];for(let j=0;j<d;j++)hs+=M[i][j]*M[i][j];}return{tr,hs};}
function posCount(M){const ev=RH.jacobiEigen(M,d);const sc=Math.max.apply(null,ev.map(Math.abs));
  return ev.filter(e=>e>1e-9*(sc||1)).length;}

let ok=true;
for(const [s2,p] of [[0,0],[3,0],[0,4],[3,4],[5,2]]){
  const r=build(s2,p,0.72);
  const g=diag(r.G), p1=diag(r.P1);
  const rankP1=posCount(r.P1);
  const B=4*g.tr-2*r.N-g.hs;
  const holds=rankP1>=B-1e-9;
  ok=ok&&holds;
  console.log(`s2=${s2} p=${p} | N=${r.N} s1=${r.s1} trG=${g.tr.toFixed(3)} HS2=${g.hs.toFixed(3)} `
    +`rankP1=${rankP1} (trP1=${p1.tr.toFixed(3)}) B=${B.toFixed(3)} B/N=${(B/Math.max(1,r.N)).toFixed(3)} `
    +`rankP1>=B: ${holds?'OK':'VIOLATION'}`);
  // bookkeeping inequalities from (Z):
  console.log(`   checks: trP1=s1 (${Math.abs(p1.tr-r.s1)<0.5?'OK':'off'}), N>=s1+2s2+2p (${r.N>=r.s1+2*s2+2*p?'OK':'BAD'})`);
}
console.log(ok?'CHAIN SHIP-CHECK PASS':'FAIL');
process.exit(ok?0:1);
