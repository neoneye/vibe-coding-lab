'use strict';
/* =====================================================================
   RH LAB CORE — complex arithmetic, logGamma, digamma, theta,
   Euler–Maclaurin zeta, Z(t) on the critical line, zero finding,
   Gram points, von Mangoldt sieve, Weil explicit formula (both sides),
   spacing statistics, symmetric eigenvalues (Jacobi).
   Everything is plain double precision, no external dependencies.
   ===================================================================== */

// ---------- complex helpers (plain objects {re,im}) ----------
const Cadd = (a,b)=>({re:a.re+b.re, im:a.im+b.im});
const Csub = (a,b)=>({re:a.re-b.re, im:a.im-b.im});
const Cmul = (a,b)=>({re:a.re*b.re-a.im*b.im, im:a.re*b.im+a.im*b.re});
const Cdiv = (a,b)=>{const d=b.re*b.re+b.im*b.im; return {re:(a.re*b.re+a.im*b.im)/d, im:(a.im*b.re-a.re*b.im)/d};};
const Cscale=(a,s)=>({re:a.re*s, im:a.im*s});
const Cabs = a=>Math.hypot(a.re,a.im);
const Carg = a=>Math.atan2(a.im,a.re);
function Cexp(a){ const e=Math.exp(a.re); return {re:e*Math.cos(a.im), im:e*Math.sin(a.im)}; }
function Clog(a){ return {re:Math.log(Math.hypot(a.re,a.im)), im:Math.atan2(a.im,a.re)}; }
function Csin(a){ return {re:Math.sin(a.re)*Math.cosh(a.im), im:Math.cos(a.re)*Math.sinh(a.im)}; }
// n^{-s} for real n>0 (fast path)
function npow(n,s){ const l=Math.log(n), r=Math.exp(-s.re*l); return {re:r*Math.cos(-s.im*l), im:r*Math.sin(-s.im*l)}; }

// ---------- binomial + Bernoulli numbers ----------
const BINOM_MAX=48;
let _binomTab=null;
function binom(n,k){
  if(!_binomTab){ _binomTab=[]; for(let i=0;i<=BINOM_MAX;i++){ _binomTab[i]=[1]; for(let j=1;j<=i;j++) _binomTab[i][j]=(_binomTab[i-1][j-1]||0)+(_binomTab[i-1][j]||0); } }
  return _binomTab[n][k];
}
// B[m] = m-th Bernoulli number (float64; odd m>1 give 0)
const BERNOULLI=(function(){
  const M=40, B=[1];
  for(let m=1;m<=M;m++){
    let s=0;
    for(let k=0;k<m;k++) s+=binom(m+1,k)*B[k];
    B.push(-s/(m+1));
  }
  return B;
})();
const FACT=[];
(function(){ let f=1; FACT[0]=1; for(let i=1;i<=60;i++){ f*=i; FACT[i]=f; } })();

// ---------- logGamma: upward recurrence + Stirling (branch-safe everywhere) ----------
// log Gamma(z) = log Gamma(z+n) - sum_{k=0}^{n-1} log(z+k),
// pushed until Re(z)>=12, then Stirling with terms through w^-7.
function stirlingLogGamma(w){
  const l=Clog(w), iw=Cdiv({re:1,im:0},w);
  const iw2=Cmul(iw,iw);
  // (w-1/2)*log w - w + 0.5*log(2pi) + 1/(12w) - 1/(360w^3) + 1/(1260w^5) - 1/(1680w^7)
  let acc={re:Csub(w,{re:0.5,im:0}).re*l.re-Csub(w,{re:0.5,im:0}).im*l.im-w.re+0.5*Math.log(2*Math.PI),
           im:Csub(w,{re:0.5,im:0}).re*l.im+Csub(w,{re:0.5,im:0}).im*l.re-w.im};
  let p=iw;
  acc=Cadd(acc, Cscale(p, 1/12));          p=Cmul(p,iw2);
  acc=Csub(acc, Cscale(p, 1/360));         p=Cmul(p,iw2);
  acc=Cadd(acc, Cscale(p, 1/1260));        p=Cmul(p,iw2);
  acc=Csub(acc, Cscale(p, 1/1680));        p=Cmul(p,iw2);
  acc=Cadd(acc, Cscale(p, 1/1188));
  return acc;
}
function logGamma(z){
  let r={re:z.re, im:z.im}, acc={re:0,im:0};
  while(r.re<12){
    acc=Csub(acc, Clog(r));
    r=Cadd(r,{re:1,im:0});
  }
  return Cadd(stirlingLogGamma(r),acc);
}

// ---------- digamma psi(z) = Gamma'(z)/Gamma(z) ----------
function digamma(z){
  let r={re:z.re, im:z.im}, acc={re:0,im:0};
  while(r.re<12){ acc=Csub(acc, Cdiv({re:1,im:0},r)); r=Cadd(r,{re:1,im:0}); }
  const l=Clog(r), inv=Cdiv({re:1,im:0},r), inv2=Cmul(inv,inv);
  let res=Csub(l, Cscale(inv,0.5));
  let p=inv2;                              // 1/z^2
  res=Csub(res, Cscale(p, 1/12));          p=Cmul(p,inv2);   // 1/z^4
  res=Cadd(res, Cscale(p, 1/120));         p=Cmul(p,inv2);   // 1/z^6
  res=Csub(res, Cscale(p, 1/252));         p=Cmul(p,inv2);   // 1/z^8
  res=Cadd(res, Cscale(p, 1/240));         p=Cmul(p,inv2);   // 1/z^10
  res=Csub(res, Cscale(p, 1/132));
  return Cadd(res,acc);
}

// ---------- Riemann–Siegel theta ----------
const LOG_PI=Math.log(Math.PI);
function thetaAsym(t){ // asymptotic series, excellent for t >~ 13
  return t/2*Math.log(t/(2*Math.PI))-t/2-Math.PI/8+1/(48*t)+7/(5760*t*t*t)+31/(8064*Math.pow(t,5));
}
function theta(t){
  // exact branch-safe evaluation: Im log Gamma(1/4 + it/2) - (t/2) log pi
  return logGamma({re:0.25, im:t/2}).im - t/2*LOG_PI;
}
// completed xi(s) = (1/2)s(s-1)pi^{-s/2} Gamma(s/2) zeta(s)
function chi(s){ // functional-equation factor: zeta(s)=chi(s)*zeta(1-s)
  const l={re:s.re*Math.LN2+(s.re-1)*LOG_PI, im:s.im*(Math.LN2+LOG_PI)}; // log(2^s pi^{s-1})
  const shalf=Cdiv(Csub(Cexp(Cmul({re:0,im:Math.PI},Cscale(s,0.5))),Cexp(Cmul({re:0,im:-Math.PI},Cscale(s,0.5)))),{re:0,im:2});
  const lg=logGamma({re:1-s.re, im:-s.im});
  const tot={re:l.re+lg.re, im:l.im+lg.im};
  return Cmul(Cexp(tot),shalf);
}
function emzetaRaw(s,N,J){
  let sum={re:0,im:0};
  for(let n=1;n<N;n++) sum=Cadd(sum,npow(n,s));
  const t1=Cdiv(npow(N,{re:s.re-1,im:s.im}),{re:s.re-1,im:s.im});   // N^{1-s}/(s-1)
  const t2=Cscale(npow(N,s),0.5);                                    // N^{-s}/2
  let tail={re:0,im:0}, ris={re:1,im:0}, k=0;
  for(let j=1;j<=J;j++){
    while(k<2*j-1){ ris=Cmul(ris,{re:s.re+k,im:s.im}); k++; }
    const coef=BERNOULLI[2*j]/FACT[2*j];
    tail=Cadd(tail, Cscale(Cmul(ris,npow(N,{re:s.re+(2*j-1),im:s.im})),coef)); // N^{-s-(2j-1)}
  }
  return Cadd(Cadd(sum,t1),Cadd(t2,tail));
}
function emzeta(s,tol){
  tol=tol||1e-12;
  const at=Math.abs(s.im);
  let N=Math.max(16, Math.ceil(at/4)+14), J=16;
  let v1=emzetaRaw(s,N,J);
  N=Math.ceil(N*1.5)+8;
  let v2=emzetaRaw(s,N,J);
  let guard=0;
  while((Math.abs(v1.re-v2.re)+Math.abs(v1.im-v2.im))>tol && guard<8){
    v1=v2; N=Math.ceil(N*1.6)+8; v2=emzetaRaw(s,N,J); guard++;
  }
  return v2;
}
// completed xi(s) = (1/2)s(s-1)pi^{-s/2} Gamma(s/2) zeta(s); returns {re,im} value
function xi(s){
  const lz=emzeta(s), lg=logGamma({re:s.re/2,im:s.im/2});
  // log-domain assembly then exponentiate
  const ls1=Clog(s), ls2=Clog(Csub(s,{re:1,im:0}));
  const re=Math.log(0.5)+ls1.re+ls2.re-(s.re/2)*LOG_PI+lg.re;
  const im=ls1.im+ls2.im-(s.im/2)*LOG_PI+lg.im;
  const le={re:re,im:im}, ez=Cexp(lz);
  // multiply exp(le)*zeta
  return Cmul(Cexp(le), lz);
}
// log|xi| + arg via components (used on contours)
function xiLog(s){
  const lzz=Clog(emzeta(s)), lg=logGamma({re:s.re/2,im:s.im/2});
  const ls1=Clog(s), ls2=Clog(Csub(s,{re:1,im:0}));
  return {re:Math.log(0.5)+ls1.re+ls2.re-(s.re/2)*LOG_PI+lg.re+lzz.re,
          im:ls1.im+ls2.im-(s.im/2)*LOG_PI+lg.im+lzz.im};
}

// ---------- Z(t): Hardy's function on the critical line ----------
// Z(t)=e^{i theta(t)} zeta(1/2+it), real-valued up to roundoff.
function bigZ(t){
  const th=theta(t), z=emzeta({re:0.5,im:t});
  const co=Math.cos(th), si=Math.sin(th);
  return co*z.re-si*z.im;      // imaginary residual ~ roundoff
}
function bigZimagResidual(t){
  const th=theta(t), z=emzeta({re:0.5,im:t});
  const co=Math.cos(th), si=Math.sin(th);
  return si*z.re+co*z.im;
}

// ---------- zero finding on the line ----------
function findZeros(t0,t1,step,onProgress){
  const zeros=[];
  let t=t0;
  let fPrev=bigZ(t);
  while(t<t1){
    const tn=Math.min(t+step,t1);
    const f=bigZ(tn);
    if(f===0){ zeros.push(tn); }
    else if(fPrev!==0 && f*fPrev<0){
      // bisection + secant hybrid (Brent-lite)
      let a=t,b=tn,fa=fPrev,fb=f,m=b;
      for(let it=0;it<80;it++){
        m=0.5*(a+b);
        const fm=bigZ(m);
        if(fm===0 || (b-a)<1e-12) break;
        if(fa*fm<0){ b=m; fb=fm; } else { a=m; fa=fm; }
      }
      // polish with Newton using central difference
      let x=m;
      for(let it=0;it<3;it++){
        const h=1e-6, d=(bigZ(x+h)-bigZ(x-h))/(2*h);
        if(d===0) break;
        const nx=x-bigZ(x)/d;
        if(!(nx>a&&nx<b)) break;
        x=nx;
      }
      zeros.push(x);
    }
    t=tn; fPrev=f;
    if(onProgress && (zeros.length&7)===0) onProgress(t);
  }
  return zeros;
}

// ---------- Gram points ----------
function gramPoint(n){ // solve theta(g)=n*pi; bracket outward from previous, then Brent
  const target=n*Math.PI;
  let lo=Math.max(n>0?2*(n+0.5):0.1, 1.5);
  let hi=lo+2;
  let flo=theta(lo)-target;
  while(theta(hi)-target<0){ hi+=Math.max(2,(hi-lo)); }
  for(let it=0;it<100 && (hi-lo)>1e-13;it++){
    const m=0.5*(lo+hi), fm=theta(m)-target;
    if(fm>0) hi=m; else lo=m;
  }
  return 0.5*(lo+hi);
}

// ---------- primes / von Mangoldt ----------
function sieveLambda(X){ // array index n -> Lambda(n) (0 where not prime power)
  const lam=new Float64Array(X+1);
  const lp=new Int32Array(X+1);
  for(let i=2;i<=X;i++) lp[i]=i;
  for(let i=2;i*i<=X;i++) if(lp[i]===i) for(let j=i*i;j<=X;j+=i) if(lp[j]===j) lp[j]=i;
  for(let i=2;i<=X;i++){
    if(lp[i]===i) lam[i]=Math.log(i);
    else{
      let p=lp[i], q=i;
      while(q%p===0) q/=p;
      if(q===1) lam[i]=Math.log(p);
    }
  }
  return lam;
}

// ---------- Weil explicit formula, normalization of arXiv:2608.13637 -------
// F even Schwartz (Gaussian). FT convention: Fhat(xi)=int F(u)e^{-iu xi}du.
// sum_rho m_rho Fhat(gamma_rho) =
//   Fhat(i/2)+Fhat(-i/2) + int Fhat(tau) mu(tau)dtau - 2 sum_n>=1 Lambda(n)/sqrt(n) F(log n)
// mu(tau) = (1/(2pi)) Re psi(1/4 + i tau/2) - log(pi)/(2pi)
function muArch(tau){
  return digamma({re:0.25, im:tau/2}).re/(2*Math.PI) - LOG_PI/(2*Math.PI);
}
function gaussF(u,alpha){ return Math.exp(-alpha*u*u); }                 // F(u)
function gaussFhat(x,alpha){ return Math.sqrt(Math.PI/alpha)*Math.exp(-x*x/(4*alpha)); } // analytic

function explicitFormulaSides(alpha, zerosUpTo, Xmax, quadStep){
  // zero side: sum over computed ordinates (+ symmetric conjugates), Gaussian => even Fhat
  let sz=0;
  for(const g of zerosUpTo) sz += gaussFhat(g,alpha);
  sz*=2; // conjugate zeros rho_bar
  // Fhat(± i/2) = int e^{-alpha u^2} e^{± u/2} du = sqrt(pi/a) e^{+1/(16 a)}, both signs equal
  const pole=Math.sqrt(Math.PI/alpha)*Math.exp(1/(16*alpha));
  const poles=2*pole;
  // archimedean integral (even integrand)
  let arch=0;
  const TAU_MAX=600;
  for(let tau=quadStep/2; tau<TAU_MAX; tau+=quadStep){
    arch += gaussFhat(tau,alpha)*muArch(tau);
  }
  arch *= 2*quadStep;
  // prime side
  const lam=sieveLambda(Xmax);
  let prime=0;
  for(let n=2;n<=Xmax;n++){
    const L=lam[n];
    if(L>0) prime += L/Math.sqrt(n)*gaussF(Math.log(n),alpha);
  }
  prime*=2;
  const rhs=poles+arch-prime;
  return {zeroSide:sz, rhs:rhs, poles:poles, arch:arch, prime:prime};
}

// ---------- spacing statistics ----------
function normalizedSpacings(zeros){
  const out=[];
  for(let i=0;i<zeros.length-1;i++){
    const g=zeros[i], meanSpacing=2*Math.PI/Math.log(g/(2*Math.PI));
    out.push((zeros[i+1]-g)/meanSpacing);
  }
  return out;
}

// ---------- Jacobi eigenvalues for small real symmetric matrices ----------
function jacobiEigen(Ain,n){
  const A=Ain.map(r=>r.slice());
  for(let sweep=0;sweep<100;sweep++){
    let off=0;
    for(let p=0;p<n;p++)for(let q=p+1;q<n;q++) off+=A[p][q]*A[p][q];
    if(off<1e-26) break;
    for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){
      if(Math.abs(A[p][q])<1e-15*Math.sqrt(Math.abs(A[p][p]*A[q][q])+1e-30)) continue;
      const theta_=(A[q][q]-A[p][p])/(2*A[p][q]);
      const t=Math.sign(theta_||1)/(Math.abs(theta_)+Math.sqrt(theta_*theta_+1));
      const c=1/Math.sqrt(t*t+1), s=t*c;
      for(let k=0;k<n;k++){
        const akp=A[k][p], akq=A[k][q];
        A[k][p]=c*akp-s*akq; A[k][q]=s*akp+c*akq;
      }
      for(let k=0;k<n;k++){
        const apk=A[p][k], aqk=A[q][k];
        A[p][k]=c*apk-s*aqk; A[q][k]=s*apk+c*aqk;
      }
    }
  }
  const ev=[]; for(let i=0;i<n;i++) ev.push(A[i][i]);
  return ev.sort((a,b)=>b-a);
}


// ---------- Weil explicit formula, centered-window test (strong zero signal) ------
// Fhat(xi) = exp(-(xi-tau0)^2/w^2) + exp(-(xi+tau0)^2/w^2)   (even, Schwartz)
// F(u)     = (w/sqrt(pi)) exp(-w^2 u^2 /4) cos(tau0 u)        (exact inverse transform)
function fhatPair(tau,tau0,w){ const d1=(tau-tau0)/w, d2=(tau+tau0)/w;
  return Math.exp(-d1*d1)+Math.exp(-d2*d2); }
function fCenter(u,tau0,w){ return (w/Math.sqrt(Math.PI))*Math.exp(-w*w*u*u/4)*Math.cos(tau0*u); }
function polesCenter(tau0,w){ // Fhat(i/2)+Fhat(-i/2): 2 points x 2e^{(1/4-tau0^2)/w^2} cos(tau0/w^2)
  return 4*Math.exp((0.25-tau0*tau0)/(w*w))*Math.cos(tau0/(w*w));
}
function explicitFormulaSidesCenter(tau0,w, zerosUpTo, Tzeros, Xmax, quadStep){
  // zero side: 2 * sum over computed ordinates (conjugates included)
  let sz=0;
  for(const g of zerosUpTo) sz += fhatPair(g,tau0,w);
  sz*=2;
  // tail estimate: zeros above Tzeros contribute ~ int density * fhat
  let tail=0;
  for(let t=Tzeros;t<Tzeros+2200;t+=1){
    tail += (Math.log(t/(2*Math.PI))/(2*Math.PI))*fhatPair(t,tau0,w);
  }
  tail*=2; // conjugates
  const poles=polesCenter(tau0,w);
  // archimedean integral over the effective support of Fhat
  let arch=0;
  const TAU_MAX=Math.max(700, tau0+3.5*w);
  for(let tau=quadStep/2; tau<TAU_MAX; tau+=quadStep){
    arch += fhatPair(tau,tau0,w)*muArch(tau);
  }
  arch *= 2*quadStep;
  const lam=sieveLambda(Xmax);
  let prime=0;
  for(let n=2;n<=Xmax;n++){
    const Lv=lam[n];
    if(Lv>0) prime += Lv/Math.sqrt(n)*fCenter(Math.log(n),tau0,w);
  }
  prime*=2;
  return {zeroSide:sz, rhs:poles+arch-prime, poles:poles, arch:arch, prime:prime,
          tailEst:tail, zeroSidePlusTail: sz+tail};
}


// ---------- canonical window-frame builder (single source of truth) ----------
// C^2-quintic boundary tapers on BOTH windows (admissible per Remark 4.4).
// Returns per-shape {G,tr,hs,V,normJ,aInt} on a shared grid/zeros, plus zs.
function windowFramePair(gammaList,d,T0,L,shapes){
  const step=2*Math.PI/L;
  const EPS=L*0.20;
  function quintic(t){t=Math.min(1,Math.max(0,t));return t*t*t*(10-15*t+6*t*t);}
  function ampOf(shape,u){
    const au=Math.abs(u);
    if(shape==='mt') return Math.sqrt(Math.max(0,Math.cos(Math.SQRT2*u/L)))*quintic((L/2-au)/EPS);
    if(shape==='sind') return quintic((L/2-au)/EPS);
    throw new Error('shape');
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
  const alphas=[];for(let k=0;k<d;k++)alphas.push(T0+k*step);
  const lo=T0-L,hi=T0+d*step+L;
  const zs=gammaList.filter(g=>g>lo&&g<hi);
  const out={zs:zs,alphas:alphas,d:d};
  for(const shape of shapes||['sind','mt']){
    // int_{-1/2}^{1/2} psi(s) ds = (1/L)*int_{-L/2}^{L/2} psi(u) du
    const n=4000,h=(L)/n;
    let acc=0;
    for(let i=0;i<=n;i++){const wt=(i===0||i===n)?0.5:1;acc+=wt*Math.pow(ampOf(shape,-L/2+i*h),2);}
    const aIntExact=acc*h/L;
    const normJ=1/(aIntExact*L*L);
    const G=[];for(let i=0;i<d;i++)G.push(new Array(d).fill(0));
    const V=[];
    for(const gr of zs){
      const v=alphas.map(al=>phiHatV(shape,gr-al));
      V.push(v);
      for(let i=0;i<d;i++)for(let j=0;j<d;j++)G[i][j]+=normJ*(v[i].re*v[j].re-v[i].im*v[j].im);
    }
    let tr=0,hs=0;for(let i=0;i<d;i++){tr+=G[i][i];}for(let i=0;i<d;i++)for(let j=0;j<d;j++)hs+=G[i][j]*G[i][j];
    out[shape]={G:G,V:V,tr:tr,hs:hs,normJ:normJ,aInt:aIntExact};
  }
  return out;
}
// common-trace-normalized copies + mixture statistics (all values divided by Nbar)
function mixtureStats(frame,wSamples){
  const d=frame.d;
  const Nbar=(frame.sind.tr+frame.mt.tr)/2;
  function normTo(M){const f=Nbar/trOf_(M);return M.map(r=>r.map(x=>x*f));}
  function trOf_(M){let s=0;for(let i=0;i<M.length;i++)s+=M[i][i];return s;}
  const An=normTo(frame.sind.G), Bn=normTo(frame.mt.G);
  const X=hsOf_(An)/Nbar, Y=hsOf_(Bn)/Nbar;
  let M=0;for(let i=0;i<d;i++)for(let j=0;j<d;j++)M+=An[i][j]*Bn[j][i];
  M/=Nbar;
  function hsOf_(M){let s=0;for(const row of M)for(const x of row)s+=x*x;return s;}
  const fVals=[],gVals=[];
  let bestF=Infinity,bestWf=0,bestG=Infinity,bestWg=0,symViol=0;
  for(const w of wSamples){
    fVals.push(w*w*X+(1-w)*(1-w)*Y+2*w*(1-w)*M);
    if(fVals[fVals.length-1]<bestF){bestF=fVals[fVals.length-1];bestWf=w;}
    const sw=Math.sqrt(w)*(Nbar/frame.sind.tr), sq=Math.sqrt(1-w)*(Nbar/frame.mt.tr);
    const Gw=[];for(let a=0;a<d;a++)Gw.push(new Array(d).fill(0));
    for(let k=0;k<frame.zs.length;k++){
      const va=frame.sind.V[k], vb=frame.mt.V[k];
      for(let a2=0;a2<d;a2++)for(let b2=0;b2<d;b2++){
        const ur=sw*va[a2].re+sq*vb[a2].re, ui=sw*va[a2].im+sq*vb[a2].im;
        const vr=sw*va[b2].re+sq*vb[b2].re, vi=sw*va[b2].im+sq*vb[b2].im;
        Gw[a2][b2]+=(ur*vr-ui*vi)/Nbar;
      }
    }
    symViol=Math.max(symViol,(()=>{let s=0;for(let a=0;a<d;a++)for(let b=0;b<d;b++)s=Math.max(s,Math.abs(Gw[a][b]-Gw[b][a]));return s;})());
    // rescale G_w to the common trace Nbar BEFORE measuring (HS^2/tr is scale-dependent)
    const tW=trOf_(Gw);
    const g=(tW>1e-12)?(hsOf_(Gw)*Math.pow(Nbar/tW,2))/Nbar:NaN;
    gVals.push(g);
    if(isFinite(g)&&g>0&&g<bestG){bestG=g;bestWg=w;}
  }
  return {Nbar:Nbar,X:X,Y:Y,M:M,fVals:fVals,gVals:gVals,
          bestF:bestF,bestWf:bestWf,bestG:bestG,bestWg:bestWg,symViol:symViol};
}

const RH={Cadd,Csub,Cmul,Cdiv,Cscale,Cabs,Carg,Cexp,Clog,Csin,npow,
  BERNOULLI,binom,logGamma,digamma,theta,thetaAsym,chi,
  emzetaRaw,emzeta,xi,xiLog,bigZ,bigZimagResidual,
  findZeros,gramPoint,sieveLambda,muArch,
  windowFramePair,mixtureStats,gaussF,gaussFhat,explicitFormulaSides,fhatPair,fCenter,polesCenter,explicitFormulaSidesCenter,normalizedSpacings,jacobiEigen};
if(typeof module!=='undefined'&&module.exports) module.exports=RH;
if(typeof window!=='undefined') window.RH=RH;
