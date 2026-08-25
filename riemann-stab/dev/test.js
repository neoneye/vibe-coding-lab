'use strict';
const M=require('./core.js');
let pass=0,fail=0;
function ok(name,cond,detail){ if(cond){pass++; console.log('  PASS',name);} else {fail++; console.log('  FAIL',name,detail||'');} }

console.log('--- constants ---');
ok('B2',Math.abs(M.BERNOULLI[2]-1/6)<1e-15);
ok('B16',Math.abs(M.BERNOULLI[16]+3617/510)<1e-10);

console.log('--- logGamma / digamma ---');
{
  const lg=M.logGamma({re:1,im:0});
  ok('logGamma(1)=0',Math.abs(lg.re)<4e-13&&Math.abs(lg.im)<4e-13,JSON.stringify(lg));
  const lg2=M.logGamma({re:0.5,im:0});
  ok('logGamma(1/2)',Math.abs(lg2.re-0.5*Math.log(Math.PI))<4e-13);
  const lg5=M.logGamma({re:5,im:0});
  ok('logGamma(5)=ln24',Math.abs(lg5.re-Math.log(24))<4e-13,lg5.re);
  // complex spot-check: Gamma(1+i) ~ 0.498015668 - 0.154949828i
  // |Gamma(1+i)|^2 = pi/sinh(pi) exactly; arg vs reference digits
  const lg1i=M.logGamma({re:1,im:1});
  const mod2=Math.exp(2*lg1i.re);
  ok('logGamma(1+i) modulus',Math.abs(mod2-Math.PI/Math.sinh(Math.PI))<1e-12,mod2);
  ok('logGamma(1+i) arg',Math.abs(lg1i.im-Math.atan2(-0.15494982830181068512,0.49801566811835604271))<1e-9,lg1i.im);
  const d=M.digamma({re:1,im:0});
  ok('psi(1)=-gamma',Math.abs(d.re+0.5772156649015329)<1e-12,d.re);
}

console.log('--- theta ---');
{
  ok('theta(0)=0',Math.abs(M.theta(0))<1e-12,M.theta(0));
  for(const x of [20,50,137.2]){
    const exact=M.theta(x), asy=M.thetaAsym(x);
    const tol=x<30?5e-9:1e-10;
    ok('theta asym @'+x,Math.abs(exact-asy)<tol,exact+' '+asy+' diff='+Math.abs(exact-asy));
  }
}

console.log('--- emzeta + functional equation ---');
{
  const z2=M.emzeta({re:2,im:0});
  ok('zeta(2)',Math.abs(z2.re-Math.PI*Math.PI/6)<1e-12,z2.re);
  const zm1=M.emzeta({re:-1,im:0});
  ok('zeta(-1)',Math.abs(zm1.re+1/12)<1e-13,zm1.re);
  const zh=M.emzeta({re:0.5,im:0});
  ok('zeta(1/2)',Math.abs(zh.re+1.4603545088095868)<1e-11,zh.re);
  for(const s of [{re:1.5,im:23.4},{re:0.7,im:88.3},{re:-0.3,im:41.7}]){
    const z1=M.emzeta(s);
    const z2f=M.emzeta({re:1-s.re,im:-s.im});
    const prod=M.Cmul(M.chi(s),z2f);
    const err=Math.abs(z1.re-prod.re)+Math.abs(z1.im-prod.im);
    ok('feq s='+s.re+'+'+s.im+'i',err<1e-8,err);
  }
  for(const t of [17.3,101.123,452.07]){
    const th=M.theta(t), z=M.emzeta({re:0.5,im:t});
    const imag=Math.sin(th)*z.re+Math.cos(th)*z.im;
    ok('Z real @'+t,Math.abs(imag)<1e-9,'imag='+imag);
  }
}

const REF=[14.134725141734693,21.022039638771554,25.010857580145688,
  30.424876125859513,32.935061587739190,37.586178158825671,40.918719012147495,
  43.327073280914999,48.005150881167160,49.773832477672302,52.970321477714460,
  56.446247697063294,59.347044002602353,60.831778524609809,65.112544048081651,
  67.079810529494173,69.546401711173979,72.067157674481907,75.704690699083933,
  77.144840068874805,79.337375020363798,82.910380854086030,84.735492980517050,
  87.42527461340404,88.809111207634466,92.491899270558484,94.651344040519888,
  95.870634228245310,98.831194218193646,101.31785100573139];

console.log('--- Z(t) vanishes at reference zeros ---');
{
  let worst=0,worstIdx=-1;
  REF.forEach((g,i)=>{ const v=Math.abs(M.bigZ(g)); if(v>worst){worst=v;worstIdx=i;} });
  ok('|Z(ref)| small',worst<1e-7,'worst '+worst.toExponential(2)+' at #'+(worstIdx+1));
}
console.log('--- findZeros [10,102] ---');
{
  const t0=Date.now();
  const zs=M.findZeros(10,102,0.2);
  console.log('   found',zs.length,'zeros in',Date.now()-t0,'ms');
  ok('count matches reference',zs.length===REF.length,zs.length+' vs '+REF.length);
  let worst=0;
  zs.forEach((z,i)=>{ worst=Math.max(worst,Math.abs(z-REF[i])); });
  ok('zero positions match ref',worst<1e-8,'worst diff '+worst);
}

console.log('--- Gram points ---');
{
  const g0=M.gramPoint(0), g1=M.gramPoint(1), g2=M.gramPoint(2);
  ok('g0=17.84559954052',Math.abs(g0-17.84559954052400)<1e-7,g0);
  ok('g1=23.17028270125',Math.abs(g1-23.17028270124631)<1e-7,g1);
  ok('g2=27.67018221782',Math.abs(g2-27.67018221781634)<1e-7,g2);
  ok('theta(g0)=0',Math.abs(M.theta(g0))<1e-9);
  let viol=[];
  for(let n=0;n<=150;n++){
    if(M.bigZ(M.gramPoint(n))*M.bigZ(M.gramPoint(n+1))>0) viol.push(n);
  }
  console.log('   Gram violations among n=0..149:',viol.join(',')||'none');
  ok('violations few',viol.length<8,'count='+viol.length);
}

function argCountBox(sigmaLo,sigmaHi,tLo,tHi){
  const pts=[];
  const stepT=0.05, stepS=0.05;
  for(let y=tLo;y<tHi;y+=stepT) pts.push(M.xiLog({re:sigmaHi,im:y}));
  for(let x=sigmaHi;x>sigmaLo;x-=stepS) pts.push(M.xiLog({re:x,im:tHi}));
  for(let y=tHi;y>tLo;y-=stepT) pts.push(M.xiLog({re:sigmaLo,im:y}));
  for(let x=sigmaLo;x<sigmaHi;x+=stepS) pts.push(M.xiLog({re:x,im:tLo}));
  pts.push(M.xiLog({re:sigmaHi,im:tLo}));
  let tot=0;
  for(let i=1;i<pts.length;i++){
    let d=pts[i].im-pts[i-1].im;
    while(d>Math.PI)d-=2*Math.PI;
    while(d<-Math.PI)d+=2*Math.PI;
    tot+=d;
  }
  return tot/(2*Math.PI);
}
console.log('--- argument principle / xi ---');
{
  const c60=argCountBox(-1,2,1,60);
  ok('N_box[1,60]=13',Math.abs(c60-13)<0.05,c60.toFixed(4));
  const c100=argCountBox(-1,2,1,100);
  ok('N_box[1,100]=29',Math.abs(c100-29)<0.05,c100.toFixed(4));
}

console.log('--- explicit formula (centered window: zeros AND primes populated) ---');
{
  const zs=M.findZeros(10,600,0.18);
  console.log('   zeros found up to 600:',zs.length);
  for(const [tau0,w] of [[150,1.5],[300,2],[400,3]]){
    const r=M.explicitFormulaSidesCenter(tau0,w,zs,600,12000,0.002);
    const rel=Math.abs(r.zeroSide-r.rhs)/Math.abs(r.zeroSide);
    const signal=Math.abs(r.prime)>0.05&&Math.abs(r.arch)>0.05;
    console.log(`   tau0=${tau0} w=${w}: zero=${r.zeroSide.toFixed(5)} poles=${r.poles.toFixed(5)} arch=${r.arch.toFixed(5)} prime=${r.prime.toFixed(5)} rhs=${r.rhs.toFixed(5)} rel=${rel.toExponential(2)}`);
    ok('explicit formula tau0='+tau0,rel<1e-9&&signal,'rel='+rel+' signal='+signal);
  }
}

console.log('--- polesCenter vs direct complex evaluation ---');
{
  function direct(t0,w){
    const t1=M.Cexp(M.Cscale(M.Cmul({re:-t0,im:0.5},{re:-t0,im:0.5}),-1/(w*w)));
    const t2=M.Cexp(M.Cscale(M.Cmul({re:t0,im:0.5},{re:t0,im:0.5}),-1/(w*w)));
    return 2*(t1.re+t2.re);
  }
  let worst=0;
  for(const pair of [[3,3],[1,2],[60,20],[150,40]]){
    const d=direct(pair[0],pair[1]), c=M.polesCenter(pair[0],pair[1]);
    worst=Math.max(worst,Math.abs(d-c)/Math.max(1e-300,Math.abs(d)));
  }
  ok('polesCenter exact formula',worst<1e-12,'worst rel '+worst);
  ok('pole term exercised at small tau0',Math.abs(M.polesCenter(3,3))>1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
