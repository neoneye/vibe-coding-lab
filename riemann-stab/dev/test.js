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

console.log('--- cross-window functional factorisation ---');
{
  // R12 = R(G) * kappa exactly, with G the pointwise geometric mean of the two
  // windows and kappa = (int G)^2 / (int A int B) <= 1 by Cauchy-Schwarz.  The
  // point of the split is attribution: it says how much of the observed dip
  // R12 < min(R_A, R_B) is the mixed window's shape and how much is the
  // normalisation the cross formula was inferred with.
  const parts = M.crossFunctionalParts('ind', 'mt', 900);
  ok('R12 factors as R(G) * kappa',
    Math.abs(parts.cross - parts.product) < 1e-15,
    `${parts.cross} vs ${parts.product}`);
  ok('kappa obeys Cauchy-Schwarz', parts.kappa <= 1 && parts.kappa > 0.99, `${parts.kappa}`);
  ok('the mixed window is proportional to neither parent', parts.kappa < 1, `${parts.kappa}`);
  // The finding worth pinning: the geometric-mean window is WORSE than the
  // better parent, so the whole reported dip comes from the normalisation.
  ok('geometric-mean window sits above the better parent',
    parts.geometricR > Math.min(parts.parentA, parts.parentB),
    `${parts.geometricR} vs ${Math.min(parts.parentA, parts.parentB)}`);
  ok('dip is attributable to normalisation, not shape',
    parts.dipFromShape < 0 && parts.dipFromNormalisation > -parts.dipFromShape,
    `shape ${parts.dipFromShape}, normalisation ${parts.dipFromNormalisation}`);
  ok('R12 still lands below both parents',
    parts.cross < Math.min(parts.parentA, parts.parentB), `${parts.cross}`);
}

console.log('--- why sqrt(2): the Euler-Lagrange equation ---');
{
  // Stationarity of R gives  psi(s) + int |s-v| psi(v) dv = const  on the
  // interior.  Since d^2/ds^2 int |s-v| f = 2f, differentiating twice leaves
  // psi'' + 2 psi = 0, whose even solution is cos(sqrt(2) s).  So the residual
  // -- the spread of that expression over s -- vanishes exactly at sqrt(2).
  const n = 4000;
  const atRoot = M.eulerLagrangeResidual(Math.SQRT2, n);
  // The floor is midpoint-quadrature error on the |s-v| kink, not the residual
  // itself, so the meaningful test is the separation from any other frequency.
  let nearest = Infinity;
  for (const c of [0.5, 1, 2, 3]) {
    const off = M.eulerLagrangeResidual(c, n);
    ok(`Euler-Lagrange residual is nonzero at c=${c}`, off.spread > 1e-3, `${off.spread}`);
    nearest = Math.min(nearest, off.spread);
  }
  ok('Euler-Lagrange residual vanishes at sqrt(2)', atRoot.spread < 1e-7, `${atRoot.spread}`);
  ok('and is smaller there by five orders of magnitude than anywhere else',
    nearest / atRoot.spread > 1e5, `${nearest / atRoot.spread}`);
  // The constant it settles at is R(psi) * int psi, which is what the
  // derivation says it must be.
  const R = M.cosineWindowFunctional(Math.SQRT2, n);
  let integral = 0;
  for (let i = 0; i < n; i++) integral += Math.cos(Math.SQRT2 * (-0.5 + (i + 0.5) / n));
  integral /= n;
  ok('and it settles at R(psi) * int psi',
    Math.abs(atRoot.value - R * integral) < 1e-6, `${atRoot.value} vs ${R * integral}`);

  // Uniqueness: the twice-differentiated equation admits A cos + B sin, but the
  // undifferentiated one forces B = 0.  The residual spread is linear in |B|.
  let linear = true;
  const base = M.eulerLagrangeResidual(Math.SQRT2, n, 0.1).spread;
  for (const b of [0.1, 0.3, 1]) {
    const spread = M.eulerLagrangeResidual(Math.SQRT2, n, b).spread;
    if (Math.abs(spread - base * (b / 0.1)) > 1e-6) linear = false;
    if (spread < 1e-3) linear = false;
  }
  ok('the odd component is forced to zero, with residual linear in |B|', linear, `${base}`);
  ok('so the critical window is unique up to scale',
    M.eulerLagrangeResidual(Math.SQRT2, n, 0).spread < base / 1e5);

  // Evaluating the Euler-Lagrange equation at s = 0 gives R in closed form,
  // and it is exactly the complement of the Montgomery-Taylor constant.
  //   psi(0) + int |v| psi(v) dv = R * int psi,  with psi = cos(a s), a^2 = 2
  //   => R = (a/2) cot(a/2) + 1/2 = cot(1/sqrt2)/sqrt2 + 1/2
  const cot = x => Math.cos(x) / Math.sin(x);
  const closedForm = 0.5 + cot(1 / Math.SQRT2) / Math.SQRT2;
  const quadrature = M.cosineWindowFunctional(Math.SQRT2, 6000);
  ok('R(psi_MT) matches its closed form 1/2 + cot(1/sqrt2)/sqrt2',
    Math.abs(quadrature - closedForm) < 1e-7, `${quadrature} vs ${closedForm}`);
  const HMT = 1.5 - cot(1 / Math.SQRT2) / Math.SQRT2;
  ok('H_MT + R(psi_MT) = 2 exactly', Math.abs(HMT + closedForm - 2) < 1e-15,
    `${HMT + closedForm}`);
  ok('and H_MT is the published constant 0.6725007036794116457',
    Math.abs(HMT - 0.6725007036794116457) < 1e-15, `${HMT}`);
}

console.log('--- sqrt(2) is the stationary frequency of the second-moment functional ---');
{
  // R(cos(c s)) is stationary exactly at c = sqrt(2): dR/dc vanishes there to
  // 26 digits under mpmath quadrature, and a root-find on dR/dc returns
  // sqrt(2).  Here, at working precision, it is checked as a strict minimum.
  const n = 900, root = Math.SQRT2;
  const at = M.cosineWindowFunctional(root, n);
  let strict = true;
  for (const delta of [1e-2, 3e-2, 1e-1, 3e-1]) {
    if (M.cosineWindowFunctional(root - delta, n) <= at) strict = false;
    if (M.cosineWindowFunctional(root + delta, n) <= at) strict = false;
  }
  ok('cos(sqrt(2) s) is a strict local minimum over the cosine family', strict, `${at}`);
  // symmetric second difference: the first derivative vanishes
  const d = (M.cosineWindowFunctional(root + 1e-3, n) - M.cosineWindowFunctional(root - 1e-3, n)) / 2e-3;
  ok('dR/dc vanishes at sqrt(2)', Math.abs(d) < 1e-6, `${d}`);
}

console.log('--- the honest mixture functional has no interior optimum ---');
{
  // No inferred cross formula here: R of the linear mixture, computed directly.
  const n = 900;
  let previous = Infinity, monotone = true, argmin = {w: 0, R: Infinity};
  for (let k = 0; k <= 20; k++) {
    const w = k / 20;
    const R = M.mixtureWindowFunctional('ind', 'mt', w, n);
    if (R > previous + 1e-12) monotone = false;
    previous = R;
    if (R < argmin.R) argmin = {w, R};
  }
  ok('mixture functional is monotone decreasing in w', monotone);
  ok('its minimum is the pure Montgomery-Taylor endpoint, not an interior point',
    argmin.w === 1, `argmin at w=${argmin.w}`);

  // The algebraic equivalence: R'(1) = 2(N_BB P_A - N_AB P_B)/P_B^3 vanishes
  // exactly when the bilinear cross term equals the parent.  It does, and that
  // is why no mixture can improve on psi_MT to first order.
  const st = M.mixtureStationarity('ind', 'mt', n);
  ok('bilinear cross term equals R(psi_MT)', Math.abs(st.gap) < 1e-8, `${st.gap}`);
  ok('so w=1 is a critical point of the mixture functional',
    Math.abs(st.slopeAtB) < 1e-5, `${st.slopeAtB}`);
  // And the geometric-mean cross formula does dip, which is the discrepancy.
  const parts = M.crossFunctionalParts('ind', 'mt', n);
  ok('the inferred cross formula dips where the honest one does not',
    parts.cross < st.parentB - 1e-6 && st.bilinear > st.parentB - 1e-6,
    `inferred ${parts.cross}, honest ${st.bilinear}, parent ${st.parentB}`);

  // And the whole reported interior optimum is that substitution.  Expanding R
  // at a mixture needs a cross term: with the inferred R12 the expansion has an
  // interior minimum below both parents; with the bilinear term it does not.
  const withInferred = M.mixtureExpansion('ind', 'mt', parts.cross, n);
  const withBilinear = M.mixtureExpansion('ind', 'mt', st.bilinear, n);
  ok('with the inferred cross term the expansion has an interior optimum',
    withInferred.interior && withInferred.minimum < Math.min(withInferred.parentA, withInferred.parentB),
    `w*=${withInferred.argmin}, value ${withInferred.minimum}`);
  ok('with the bilinear cross term it does not',
    !withBilinear.interior && withBilinear.argmin === 1,
    `w*=${withBilinear.argmin}`);
  ok('and the bilinear expansion bottoms out exactly at the parent',
    Math.abs(withBilinear.minimum - withBilinear.parentB) < 1e-9,
    `${withBilinear.minimum} vs ${withBilinear.parentB}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
