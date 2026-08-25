'use strict';
const RH=require('./core.js');
const T0=400, L=Math.log(T0/(2*Math.PI)), step=2*Math.PI/L;
const all=RH.findZeros(395,435,0.18);
const A=Math.SQRT2*Math.sin(1/Math.SQRT2);

// two window shapes on the same grid:
//   shape 'ind': psi^1/2 = indicator  -> phi = 1 on [-L/2,L/2]
//   shape 'mt' : psi^1/2 = sqrt(cos(sqrt(2) u/L))
function phiHatQuad(shape,x,y,nodes){
  const u0=-L/2,u1=L/2;
  const amp=u=>shape==='ind'?1:(c=>c<=0?0:Math.sqrt(c))(Math.cos(Math.SQRT2*u/L));
  let re=0,im=0;const h=(u1-u0)/nodes;
  for(let i=0;i<=nodes;i++){
    const wt=(i===0||i===nodes)?1:(i%2?4:2);
    const u=u0+i*h, m=amp(u);
    if(m===0)continue;
    const e=Math.exp(-y*u)*m;
    re+=wt*e*Math.cos(-x*u); im+=wt*e*Math.sin(-x*u);
  }
  return {re:re*h/3,im:im*h/3};
}
function buildG(shape,d,gammaList){
  const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
  const lo=T0-L,hi=T0+d*step+L;
  const zs=gammaList.filter(g=>g>lo&&g<hi);
  const mk=()=>{const M=[];for(let i=0;i<d;i++)M.push(new Array(d).fill(0));return M;};
  const G=mk(); const norm=1/(A*L*L);
  const aInt=(()=>{ // int psi over [-1/2,1/2]: ind ->1 ; mt -> sqrt2 sin(1/sqrt2)
    return shape==='ind'?1:Math.SQRT2*Math.sin(1/Math.SQRT2);})();
  const normJ=1/(aInt*L*L);
  for(const gr of zs){
    const v=alphas.map(al=>phiHatQuad(shape,gr-al,0,2400));
    for(let i=0;i<d;i++)for(let j=0;j<d;j++)G[i][j]+=normJ*(v[i].re*v[j].re-v[i].im*v[j].im);
  }
  let tr=0,hs=0;for(let i=0;i<d;i++){tr+=G[i][i];for(let j=0;j<d;j++)hs+=G[i][j]*G[i][j];}
  return {G,tr,hs,nz:zs.length};
}
console.log('=== convergence study (MT window): HS^2 / tr G~  vs c_MT^-1 = 1.32750 ===');
for(const d of [8,10,12,14,16,18,20,24]){
  const r=buildG('mt',d,all);
  console.log('d='+String(d).padStart(2),'zeros='+r.nz,'tr='+r.tr.toFixed(3),'ratio='+(r.hs/r.tr).toFixed(5));
}
console.log('=== same for indicator window (R(psi0)=4/3=1.33333 predicted) ===');
for(const d of [12,16,20]){
  const r=buildG('ind',d,all);
  console.log('d='+String(d).padStart(2),'ratio='+(r.hs/r.tr).toFixed(5));
}
console.log('=== mixture experiment at d=16 ===');
const d=16;
const g0=buildG('ind',d,all), g2=buildG('mt',d,all);
const M12=(()=>{let t=0;for(let i=0;i<d;i++)for(let j=0;j<d;j++)t+=g0.G[i][j]*g2.G[j][i];return t;})();
console.log('X/N(ind)=',(g0.hs/g0.tr).toFixed(4),'Y/N(mt)=',(g2.hs/g2.tr).toFixed(4),
  'M12/N=',(M12/g0.tr).toFixed(4),'sqrt(XY)/N=',Math.sqrt(g0.hs*g2.hs)/g0.tr.toFixed(4));
let bestW=0,bestV=Infinity;
for(let i=0;i<=100;i++){
  const w=i/100;
  const v=(w*w*g0.hs+(1-w)*(1-w)*g2.hs+2*w*(1-w)*M12)/Math.max(1e-9,(w*g0.tr+(1-w)*g2.tr));
  if(v<bestV){bestV=v;bestW=w;}
}
console.log('best mixture ratio:',bestV.toFixed(5),'at w=',bestW,
  '| dips below both parents?', bestV<Math.min(g0.hs/g0.tr,g2.hs/g2.tr)?'YES':'NO');
