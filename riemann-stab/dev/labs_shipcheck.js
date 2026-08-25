'use strict';
// Headless ship-check of the two reworked labs
const RH=require('./core.js');

console.log('=== Lab B audit replica: counts must agree at both meshes ===');
function argCountBox(sl,sh,tl,th,mesh){
  const pts=[];
  for(let y=tl;y<th;y+=mesh) pts.push(RH.xiLog({re:sh,im:y}));
  for(let x=sh;x>sl;x-=mesh) pts.push(RH.xiLog({re:x,im:th}));
  for(let y=th;y>tl;y-=mesh) pts.push(RH.xiLog({re:sl,im:y}));
  for(let x=sl;x<sh;x+=mesh) pts.push(RH.xiLog({re:x,im:tl}));
  pts.push(RH.xiLog({re:sl===-1?sh:sl,im:tl})); // corner close handled below properly
  // rebuild exactly as ui.js does:
  return null;
}
// replicate EXACTLY the ui.js version:
function argBox(sigmaLo,sigmaHi,tLo,tHi,mesh){
  const pts=[];
  for(let y=tLo;y<tHi;y+=mesh) pts.push(RH.xiLog({re:sigmaHi,im:y}));
  for(let x=sigmaHi;x>sigmaLo;x-=mesh) pts.push(RH.xiLog({re:x,im:tHi}));
  for(let y=tHi;y>tLo;y-=mesh) pts.push(RH.xiLog({re:sigmaLo,im:y}));
  for(let x=sigmaLo;x<sigmaHi;x+=mesh) pts.push(RH.xiLog({re:x,im:tLo}));
  pts.push(RH.xiLog({re:sigmaHi,im:tLo}));
  let tot=0,minAbs=Infinity;
  for(let i=0;i<pts.length;i++){
    minAbs=Math.min(minAbs,Math.exp(pts[i].re));
    if(i){ let dd=pts[i].im-pts[i-1].im;
      while(dd>Math.PI)dd-=2*Math.PI; while(dd<-Math.PI)dd+=2*Math.PI; tot+=dd; }
  }
  return {winding:tot/(2*Math.PI),minAbs:minAbs};
}
let allOk=true;
for(const T of [30,50,80,100]){
  const coarse=argBox(-1,2,1,T,0.05);
  const fine=argBox(-1,2,1,T,0.025);
  const zeros=RH.findZeros(2,T,0.15);
  const k=Math.round(coarse.winding);
  const resid=Math.abs(coarse.winding-k);
  const meshAgrees=Math.abs(fine.winding-Math.round(fine.winding))<0.02&&Math.round(fine.winding)===k;
  const countsAgree=(k===zeros.length);
  const okAll=resid<0.02&&countsAgree&&meshAgrees;
  if(!okAll) allOk=false;
  console.log('T='+T,'box='+coarse.winding.toFixed(4),'fine='+fine.winding.toFixed(4),
    'signChanges='+zeros.length,'verdict:',okAll?'OK':'PROBLEM',
    countsAgree?'':' COUNT-MISMATCH',meshAgrees?'':' MESH-DISAGREE');
}

console.log('=== Lab E-i exact chain replica ===');
const N_TOTAL=24;
function build(s2,p,soff){
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
  const r=build(s2,p,s);
  const g=diag(r.G,r.dim), p1d=diag(r.P1,r.dim);
  const rankP1=posCount(r.P1,r.dim);
  const Qp=[];for(let i=0;i<r.dim;i++){Qp.push(r.G[i].map((v,j)=>v-r.P1[i][j]));}
  const nplusQp=posCount(Qp,r.dim);
  const B=4*g.tr-2*r.N-g.hs;
  const c1=Math.abs(g.tr-r.N)<1e-9;
  const c2=rankP1===r.s1;
  const c3=nplusQp<=s2+p;
  const c4=rankP1>=B-1e-9;
  if(!(c1&&c2&&c3&&c4)) allOk=false;
  console.log('s2='+s2,'p='+p,'s='+s,'| trG=N:'+c1,'rankP1=s1:'+c2,
    'n+(Qp)='+nplusQp+'<='+'s2+p='+(s2+p)+':'+c3,'rankP1>=B('+B.toFixed(2)+'):'+c4,
    '| slack='+(rankP1-B).toFixed(3));
}
console.log(allOk?'ALL SHIP-CHECKS PASS':'FAILURES PRESENT');
process.exit(allOk?0:1);
