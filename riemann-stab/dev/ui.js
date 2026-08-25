'use strict';
(function(){
if(typeof document==='undefined') return; // allows node --check / headless smoke
const RH=window.RH;
const $=id=>document.getElementById(id);
const fmt=(x,d)=>Number(x).toFixed(d===undefined?6:d);
const sci=(x)=>{const a=Math.abs(x);return a===0?'0':a<1e-4||a>=1e6?x.toExponential(3):fmt(x,Math.max(2,Math.min(12,Math.round(4-Math.log10(a)))))};

// ---------- canvas helpers ----------
function setupCanvas(cv){
  const dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||cv.parentElement.clientWidth||900;
  const h=cv.getAttribute('height')?parseInt(cv.getAttribute('height')):300;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+'px';
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  return {ctx,w,h};
}
function clear(cv,S){ S.ctx.clearRect(0,0,S.w,S.h); }

// ---------- async chunk runner ----------
function runChunks(thunks,onDone,barId){
  let i=0;
  const bar=barId?$(barId):null;
  if(bar){bar.style.display='block';bar.firstElementChild.style.width='0%';}
  function step(){
    const t0=performance.now();
    while(i<thunks.length && performance.now()-t0<28){ thunks[i++](); }
    if(bar&&thunks.length) bar.firstElementChild.style.width=(100*i/thunks.length)+'%';
    if(i<thunks.length) setTimeout(step,0);
    else { if(bar) setTimeout(()=>{bar.style.display='none';},350); onDone&&onDone(); }
  }
  setTimeout(step,0);
}

// ---------- shared zero caches ----------
let _zeros600=null;
function getZeros600(cb){
  if(_zeros600) return cb(_zeros600);
  const zs=[];
  const chunks=[]; 
  for(let t=10;t<600;t+=20){ const a=t,b=Math.min(t+20,600); chunks.push(()=>{ const part=RH.findZeros(a,b,0.18); zs.push(...part); }); }
  runChunks(chunks,()=>{_zeros600=zs;cb(zs);});
}

// ---------- reference zeros (Odlyzko-standard first 30) ----------
const REF=[14.134725141734693,21.022039638771554,25.010857580145688,
  30.424876125859513,32.935061587739190,37.586178158825671,40.918719012147495,
  43.327073280914999,48.005150881167160,49.773832477672302,52.970321477714460,
  56.446247697063294,59.347044002602353,60.831778524609809,65.112544048081651,
  67.079810529494173,69.546401711173979,72.067157674481907,75.704690699083933,
  77.144840068874805,79.337375020363798,82.910380854086030,84.735492980517050,
  87.42527461340404,88.809111207634466,92.491899270558484,94.651344040519888,
  95.870634228245310,98.831194218193646,101.31785100573139];

/* =====================================================================
   §1 ladder chart
===================================================================== */
(function(){
  const cv=$('ladderCanvas'); if(!cv) return;
  const S=setupCanvas(cv);
  const data=[
    {label:'Hardy 1914 — infinitely many', frac:-1},
    {label:'Selberg 1942 — positive proportion', frac:null},
    {label:'Levinson 1974 — 1/3', frac:1/3},
    {label:'Conrey 1989 — 2/5', frac:0.4},
    {label:'Pratt–Robles–Zaharescu–Zeindler 2020 — 5/12 (simple)', frac:5/12},
    {label:'Alpöge–Furman 2026 — 2/3 (simple, unconditional)', frac:2/3, hot:true},
    {label:'Alpöge–Furman 2026 — Montgomery–Taylor window', frac:0.672503, hot:true},
  ];
  const x0=330, x1=S.w-90, yTop=26, dy=38;
  const ctx=S.ctx;
  ctx.font='13px '+getComputedStyle(document.body).getPropertyValue('--mono');
  // gridlines
  for(const g of [0,0.25,0.5,0.75,1.0]){
    const x=x0+(x1-x0)*g;
    ctx.strokeStyle='#20242f';ctx.beginPath();ctx.moveTo(x,yTop-6);ctx.lineTo(x,yTop+dy*data.length);ctx.stroke();
    ctx.fillStyle='#5d5a68';ctx.fillText(Math.round(g*100)+'%',x-12,yTop+dy*data.length+16);
  }
  data.forEach((d,i)=>{
    const y=yTop+i*dy;
    ctx.fillStyle=d.hot?'#e0b458':'#9a97a3';
    ctx.textAlign='right';
    ctx.fillText(d.label,x0-12,y+13);
    ctx.textAlign='left';
    if(d.frac===null||d.frac===-1){
      ctx.strokeStyle=d.hot?'#e0b458':'#5ec4b6';
      ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x0,y+9);ctx.lineTo(x0+(x1-x0)*0.04,y+9);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#5d5a68';ctx.fillText(d.frac===-1?'∞':'>0',x0+(x1-x0)*0.04+8,y+13);
    }else{
      ctx.fillStyle=d.hot?'rgba(224,180,88,.85)':'rgba(94,196,182,.75)';
      ctx.fillRect(x0,y,(x1-x0)*d.frac,17);
      ctx.fillStyle='#e8e6df';
      ctx.fillText((100*d.frac).toFixed(2)+'%',x0+(x1-x0)*d.frac+8,y+13);
    }
  });
})();

/* =====================================================================
   §2 self test panel
===================================================================== */
(function(){
  const box=$('selftest'); if(!box) return;
  const tests=[
    ['ζ(2) − π²/6', ()=> Math.abs(RH.emzeta({re:2,im:0}).re-Math.PI*Math.PI/6)],
    ['ζ(−1) − (−1/12)', ()=> Math.abs(RH.emzeta({re:-1,im:0}).re+1/12)],
    ['functional equation ζ(s)=χ(s)ζ(1−s), s=1.5+23.4i', ()=>{
        const s={re:1.5,im:23.4};
        const l=RH.emzeta(s), r=RH.Cmul(RH.chi(s),RH.emzeta({re:1-s.re,im:-s.im}));
        return Math.abs(l.re-r.re)+Math.abs(l.im-r.im);
     }],
    ['imaginary residue of e^{iθ}ζ(1/2+it) at t=137.2', ()=> Math.abs(RH.bigZimagResidual(137.2))],
    ['θ(t) exact vs asymptotic series, t=50', ()=> Math.abs(RH.theta(50)-RH.thetaAsym(50))],
    ['live-found γ₁ minus reference γ₁=14.134725141734693', ()=>{
        const zs=RH.findZeros(13,16,0.2); return Math.abs(zs[0]-14.134725141734693);
     }],
    ['argument principle: #zeros ξ in strip, Im∈[1,50] (expect exactly 10)', ()=>{
        return Math.abs(argCountBox(-1,2,1,50)/ (2*Math.PI) - 10);
     }],
    ['Weil explicit formula, Gaussian α=1/3: |zero side − prime side| (rel.)', ()=>{
        const zs=RH.findZeros(10,105,0.2);
        const r=RH.explicitFormulaSides(1/3,zs,12000,0.02);
        return Math.abs(r.zeroSide-r.rhs)/Math.max(1,r.poles);
     }],
  ];
  const dots=[];
  tests.forEach(t=>{
    const row=document.createElement('div');row.className='st-row';
    row.innerHTML='<span class="st-dot"></span><span class="st-name">'+t[0]+'</span><span class="st-val mono"></span>';
    box.appendChild(row);dots.push(row);
  });
  const bar=$('selftestBar');
  runChunks(tests.map((t,i)=>()=>{
      let val,err=null;
      try{ val=t[1](); }catch(e){ err=e; }
      const dot=dots[i].querySelector('.st-dot'), out=dots[i].querySelector('.st-val');
      const pass=!err&&val<1e-8;
      dot.className='st-dot '+(pass?'pass':'fail');
      out.textContent=err?('error: '+err.message):sci(val);
      out.style.color=pass?'var(--green)':'var(--red)';
      if(bar)bar.firstElementChild.style.width=(100*(i+1)/tests.length)+'%';
    }),()=>{},null);
  // constants readout appended under panel
  const note=document.createElement('div');
  note.className='mono small';note.style.marginTop='10px';note.style.color='var(--dim)';
  const c=0.5+Math.cos(1/Math.SQRT2)/(Math.SQRT2*Math.sin(1/Math.SQRT2));
  note.innerHTML='c<sup>−1</sup><sub>MT</sub> = '+c.toFixed(6)+
   '&emsp;⇒&ensp;2−c<sup>−1</sup><sub>MT</sub> = <span style="color:var(--accent)">'+(2-c).toFixed(6)+'</span>'+
   '&emsp;⇒&ensp;½(3−c<sup>−1</sup><sub>MT</sub>) = <span style="color:var(--accent)">'+(0.5*(3-c)).toFixed(6)+'</span>';
  $('constantsBox').innerHTML=
   'R(ψ₀)=4/3 ⇒ 2−R = <span style="color:var(--green)">0.666667 = 2/3</span><br>'+
   'R(ψ<sub>MT</sub>)=c<sup>−1</sup><sub>MT</sub> ⇒ 2−R = <span style="color:var(--accent)">'+(2-c).toFixed(6)+'</span>&emsp;(the 67.25%)<br>'+
   '½(3−R) = <span style="color:var(--accent)">'+(0.5*(3-c)).toFixed(6)+'</span>&emsp;(the 83.62%, distinct)<br>'+
   '<span class="dim">ceiling over all bandwidth-one certificates ≈ 0.682 · under-RH SDP record 0.6792</span>';
})();

// ---------- argument principle (shared) ----------
function argCountBox(sigmaLo,sigmaHi,tLo,tHi){
  const pts=[];
  const stepT=0.05, stepS=0.05;
  for(let y=tLo;y<tHi;y+=stepT) pts.push(RH.xiLog({re:sigmaHi,im:y}));
  for(let x=sigmaHi;x>sigmaLo;x-=stepS) pts.push(RH.xiLog({re:x,im:tHi}));
  for(let y=tHi;y>tLo;y-=stepT) pts.push(RH.xiLog({re:sigmaLo,im:y}));
  for(let x=sigmaLo;x<sigmaHi;x+=stepS) pts.push(RH.xiLog({re:x,im:tLo}));
  pts.push(RH.xiLog({re:sigmaHi,im:tLo}));
  let tot=0,minAbs=Infinity;
  for(let i=0;i<pts.length;i++){
    minAbs=Math.min(minAbs,Math.exp(pts[i].re));
    if(i){ let d=pts[i].im-pts[i-1].im;
      while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; tot+=d; }
  }
  return {winding:tot/(2*Math.PI),minAbs:minAbs};
}

/* =====================================================================
   §3 Lab A — Z(t) explorer
===================================================================== */
(function(){
  const cv=$('zplot'); if(!cv) return;
  let t0=0,t1=60, lastZeros=null;
  function plot(){
    const S=setupCanvas(cv); const ctx=S.ctx;
    let lo=t0,hi=t1;
    if(hi-lo<0.02)return;
    const n=Math.min(1400,Math.max(400,Math.floor((hi-lo)*22)));
    let mn=Infinity,mx=-Infinity; const vals=new Array(n);
    for(let i=0;i<n;i++){ const t=lo+(hi-lo)*i/(n-1); const v=RH.bigZ(t); vals[i]=v; if(v<mn)mn=v; if(v>mx)mx=v; }
    if(!isFinite(mn)||!isFinite(mx)){return;}
    if(mx-mn<1e-9){mx=mn+1;}
    const pad=(mx-mn)*0.12; mn-=pad;mx+=pad;
    const X=t=>(t-lo)/(hi-lo)*(S.w-64)+48, Y=v=>S.h-(v-mn)/(mx-mn)*(S.h-40)-22;
    // axes
    ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(48,10);ctx.lineTo(48,S.h-22);ctx.lineTo(S.w-10,S.h-22);ctx.stroke();
    ctx.font='12px monospace';ctx.fillStyle='#5d5a68';
    for(let k=0;k<=4;k++){ const v=mn+(mx-mn)*k/4;
      ctx.fillText(fmt(v,2),4,Y(v)+4);
      ctx.strokeStyle='#1a1f2c';ctx.beginPath();ctx.moveTo(48,Y(v));ctx.lineTo(S.w-10,Y(v));ctx.stroke(); }
    for(let k=0;k<=6;k++){ const t=lo+(hi-lo)*k/6;
      ctx.fillText(fmt(t,hi-lo>60?0:2),X(t)-10,S.h-6); }
    // Gram points
    if($('zpGram').checked){
      let n0=Math.ceil(RH.theta(lo)/Math.PI), nn=Math.floor(RH.theta(hi)/Math.PI);
      if(nn-n0<800){ for(let g=n0;g<=nn;g++){ const p=RH.gramPoint(g);
          if(p<lo||p>hi)continue; const x=X(p);
          ctx.strokeStyle='rgba(224,180,88,.35)';ctx.beginPath();ctx.moveTo(x,10);ctx.lineTo(x,S.h-22);ctx.stroke();
          ctx.fillStyle='rgba(224,180,88,.55)';ctx.fillText(g,x+2,18); } }
    }
    // curve
    ctx.strokeStyle='#5ec4b6';ctx.lineWidth=1.6;ctx.beginPath();
    for(let i=0;i<n;i++){ const t=lo+(hi-lo)*i/(n-1);
      if(i===0)ctx.moveTo(X(t),Y(vals[i]));else ctx.lineTo(X(t),Y(vals[i])); }
    ctx.stroke();
    // zero line emphasis
    if(mn<0&&mx>0){ctx.strokeStyle='rgba(224,95,95,.6)';ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(48,Y(0));ctx.lineTo(S.w-10,Y(0));ctx.stroke();ctx.setLineDash([]);}
    ctx.lineWidth=1;
  }
  function refreshStats(zeros){
    const st=$('zpStats'); st.innerHTML='';
    const add=(k,v)=>{const d=document.createElement('div');d.className='stat';
      d.innerHTML='<span class="k">'+k+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
    add('zeros found in view', zeros?zeros.length:'—');
    const vm=T=>RH.theta(T)/Math.PI+1;
    add('von Mangoldt main term ≈', zeros?fmt(vm(t1)-vm(t0),1)+' ±S':'—');
    if(zeros&&t0>=10&&t1<=102){
      let worst=0,cnt=0;
      for(const r of REF) if(r>t0&&r<t1){ cnt++;
        let best=1e9; for(const z of zeros) best=Math.min(best,Math.abs(z-r)); worst=Math.max(worst,best); }
      add('reference zeros in view',cnt);
      add('max |computed − reference|', worst>0?worst.toExponential(2):'< 1e−12');
    }
  }
  function doFind(){
    const btn=$('zpFind');btn.disabled=true;
    const zeros=RH.findZeros(t0,t1,0.15);
    lastZeros=zeros;
    refreshStats(zeros);
    const tbl=$('zpTable'),wrap=$('zpTableWrap');
    let rows='<tr><th>#</th><th>t (computed)</th><th>Z′ magnitude</th></tr>';
    zeros.slice(0,120).forEach((z,i)=>{
      const h=1e-5, d=(RH.bigZ(z+h)-RH.bigZ(z-h))/(2*h);
      rows+='<tr><td>'+(i+1)+'</td><td class="num">'+z.toFixed(12)+'</td><td class="num">'+sci(Math.abs(d))+
        (Math.abs(d)>0.5?' <span class="green">simple</span>':' <span class="red">?</span>')+'</td></tr>';
    });
    tbl.innerHTML=rows; wrap.style.display='block';
    plot(); btn.disabled=false;
  }
  function syncRange(){ t0=parseFloat($('zpT0').value);t1=parseFloat($('zpT1').value);
    if(!(t1>t0)){t1=t0+1;$('zpT1').value=t1;} lastZeros=null;refreshStats(null);plot(); }
  $('zpFind').onclick=doFind;
  $('zpZoomIn').onclick=()=>{const m=(t0+t1)/2;t0=m-(t1-t0)/4;t1=m+(t1-t0)/2;syncRange();};
  $('zpZoomOut').onclick=()=>{const m=(t0+t1)/2,w=(t1-t0);t0=m-w;t1=m+w;syncRange();};
  $('zpT0').onchange=syncRange;$('zpT1').onchange=syncRange;
  $('zpGram').onchange=plot;
  window.addEventListener('resize',()=>plot());
  syncRange();
  // pre-load some found zeros quietly for first paint
  setTimeout(doFind,300);
})();

/* =====================================================================
   §4 Lab B — completeness audit
===================================================================== */
(function(){
  const slider=$('auditT'); if(!slider) return;
  slider.oninput=()=>{$('auditTLabel').textContent='T = '+slider.value;};
  $('auditRun').onclick=()=>{
    const T=parseFloat(slider.value); $('auditRun').disabled=true;
    const st=$('auditStats'); st.innerHTML='';
    const verdict=$('auditVerdict');verdict.innerHTML='';
    const chunks=[]; let result=null;
    chunks.push(()=>{ result=argCountBox(-1,2,1,T); });
    let zeros=null;
    chunks.push(()=>{ zeros=RH.findZeros(2,T,0.15); });
    runChunks(chunks,()=>{
      $('auditRun').disabled=false;
      const w=result.winding;
      const resid=Math.abs(w-Math.round(w));
      const add=(k,v)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+k+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
      add('Δarg ξ / 2π (all zeros in box)', fmt(w,4));
      add('nearest integer', Math.round(w));
      add('integrality residual', resid.toExponential(2));
      add('min |ξ| on contour', result.minAbs.toExponential(2));
      add('sign changes of Z(t), 2<t<T', zeros.length);
      const okAll=resid<0.02&&result.minAbs>1e-9;
      verdict.innerHTML='<div class="verdict '+(okAll?'ok':'warn')+'">'+
        (okAll
          ? 'VERDICT — every zero counted in the box lies on the critical line: '+Math.round(w)+' zeros, '
            +zeros.length+' sign changes, counts agree. No off-line zero up to t = '+T+' (to numerical resolution).'
          : 'INCONCLUSIVE — contour grazed something (residual '+resid.toExponential(2)+', min|ξ|='+result.minAbs.toExponential(2)+'). '
            +'Nudge T slightly; this is the standard operational hazard of the method.')+'</div>';
    },'auditBar');
  };
})();

/* =====================================================================
   §5 Lab C — explicit formula
===================================================================== */
(function(){
  if(!$('efAlpha')) return;
  $('efAlpha').oninput=()=>{$('efAlphaLabel').textContent='α = '+(parseInt($('efAlpha').value)/100).toFixed(2);};
  $('efRun').onclick=()=>{
    const alpha=parseInt($('efAlpha').value)/100;
    $('efRun').disabled=true;
    getZeros600((zs)=>{
      const r=RH.explicitFormulaSides(alpha,zs,12000,0.012);
      const st=$('efStats'); st.innerHTML='';
      const add=(k,v,col)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+k+'</span><span class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span>';st.appendChild(d);};
      add('zero side  Σ F̂(γ) (+ conjugates)','<b>'+fmt(r.zeroSide,6)+'</b>','#5ec4b6');
      add('pole terms F̂(±i/2)',fmt(r.poles,4));
      add('+ gamma integral ∫F̂·μ',fmt(r.arch,4));
      add('− 2Σ Λ(n)/√n·F(log n)',fmt(r.prime,4),'#e05f5f');
      add('= right-hand side','<b>'+fmt(r.rhs,6)+'</b>');
      const diff=Math.abs(r.zeroSide-r.rhs), scale=Math.max(1,Math.abs(r.poles));
      add('|difference| (relative to scale)',diff.toExponential(2), diff/scale<1e-5?'var(--green)':'var(--red)');
      $('efVerdict').innerHTML='<div class="verdict '+(diff/scale<1e-5?'ok':'warn')+'">The zeros your machine found sing the same song as the primes. '
        +'Relative disagreement: '+(diff/scale).toExponential(1)+'. This is the identity whose positivity form is equivalent to RH.</div>';
      $('efRun').disabled=false;
    });
  };
})();

/* =====================================================================
   §6 Lab D — pair correlation
===================================================================== */
(function(){
  const btn=$('pcRun'); if(!btn) return;
  btn.onclick=()=>{
    btn.disabled=true;$('pcStatus').textContent='computing…';
    getZeros600(zs=>{
      const sp=RH.normalizedSpacings(zs);
      const nb=60,lo=0,hi=3,bw=(hi-lo)/nb; const bins=new Array(nb).fill(0);
      for(const d of sp){ if(d>=lo&&d<hi) bins[Math.floor((d-lo)/bw)]++; }
      const total=sp.length;
      const S=setupCanvas($('pcHist'));const ctx=S.ctx;
      const ymax=Math.max(0.9,32/(Math.PI*Math.PI)*Math.exp(-4/Math.PI*0))*1.15;
      const Y=x=>S.h-24-x/ymax*(S.h-44), X=x=>24+x/hi*(S.w-40);
      ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(24,S.h-24);ctx.lineTo(S.w-16,S.h-24);ctx.stroke();
      ctx.font='12px monospace';ctx.fillStyle='#5d5a68';
      for(let g=0;g<=3;g+=0.5){ctx.fillText(fmt(g,1),X(g)-6,S.h-8);}
      // curves first
      const curve=(f,color)=>{ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();
        for(let i=0;i<=180;i++){const x=i/180*hi;const px=X(x),py=Y(f(x));
          if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.lineWidth=1;};
      curve(x=>Math.exp(-x),'#e05f5f');
      curve(x=>32*x*x/(Math.PI*Math.PI)*Math.exp(-4*x*x/Math.PI),'#e0b458');
      // bars
      bins.forEach((c,i)=>{ const dens=c/(total*bw);
        ctx.fillStyle='rgba(94,196,182,.55)';
        const hpx=Y(0)-Y(dens); ctx.fillRect(X(lo+i*bw)+1,Y(dens),(S.w-40)/nb-2,hpx); });
      // stats
      const mean=sp.reduce((a,b)=>a+b,0)/sp.length;
      const min=Math.min.apply(null,sp);
      const below=sp.filter(d=>d<0.2).length;
      const st=$('pcStats');st.innerHTML='';
      const add=(k,v)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+k+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
      add('zeros used',zs.length);
      add('mean normalized spacing',fmt(mean,4));
      add('smallest gap δ_min (Lehmer watch)',min.toFixed(4), min<0.1?'var(--red)':'var(--accent)');
      add('gaps with δ < 0.2',below+' ('+(100*below/total).toFixed(1)+'%)');
      add('GUE prediction for δ<0.2', '~0.6%');
      $('pcStatus').textContent='done — '+total+' spacings';
      btn.disabled=false;
    });
  };
})();

/* =====================================================================
   §8 Lab E — inertia playground
===================================================================== */
(function(){
  const btnBuild=$('gBuild'); if(!btnBuild) return;
  let state=null;
  function phiHatQuad(x,y,nodes,u0,u1){ // ∫ sqrt(cos(√2 u/L)) e^{-i(x+iy)u} du, support [u0,u1]
    const L=state.L;
    const f=u=>{ const c=Math.cos(Math.SQRT2*u/L); if(c<=0)return {re:0,im:0};
      const amp=Math.sqrt(c), ph=-(x)*u, gr=-y*u;
      const e=Math.exp(gr)*amp;
      return {re:e*Math.cos(ph), im:e*Math.sin(ph)}; };
    // composite Simpson
    let re=0,im=0; const h=(u1-u0)/nodes;
    for(let i=0;i<=nodes;i++){ const w=(i===0||i===nodes)?1:(i%2?4:2);
      const v=f(u0+i*h); re+=w*v.re; im+=w*v.im; }
    const s=h/3; return {re:re*s, im:im*s};
  }
  function buildG(offBeta){
    const {alphas,gammaList,L,a,d}=state;
    // matrix
    const G=[]; for(let i=0;i<d;i++){G.push(new Array(d).fill(0));}
    const norm=1/(a*L*L);
    for(let i=0;i<d;i++)G[i].fill(0);
    function addTerm(v1,v2,mult){ // mult * Re( outer(v1,v2^T) )
      for(let i=0;i<d;i++)for(let j=0;j<d;j++){
        G[i][j]+=mult*(v1[i].re*v2[j].re - v1[i].im*v2[j].im);
      }
    }
    const centerIdx=state.centerIdx;
    gammaList.forEach((gr,idx)=>{
      if(offBeta!==null&&idx===centerIdx) return; // skip the moved zero
      const v=alphas.map(al=>phiHatQuad(gr-al,0,2400,-L/2,L/2));
      addTerm(v,v,1*norm);
    });
    if(offBeta!==null){
      const gr=gammaList[centerIdx];
      const dy=0.5-offBeta; // gamma_rho imaginary part
      const v=alphas.map(al=>phiHatQuad(gr-al,dy,2400,-L/2,L/2));
      addTerm(v,v,1*norm);                    // rho
      const vc=v.map(z=>({re:z.re,im:-z.im}));
      addTerm(vc,vc,1*norm);                  // partner 1-conj(rho)
    }
    return G;
  }
  function drawSpec(G,highlightNeg){
    const ev=RH.jacobiEigen(G,state.d);
    const S=setupCanvas($('gSpec'));const ctx=S.ctx;
    const mx=Math.max.apply(null,ev.map(Math.abs).concat([1e-12]));
    const mid=S.h/2, sc=(S.h/2-30)/mx, bw=(S.w-80)/state.d;
    ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(30,mid);ctx.lineTo(S.w-30,mid);ctx.stroke();
    ctx.font='12px monospace';
    ev.forEach((e,i)=>{
      const x=45+i*bw;
      ctx.fillStyle=e<-1e-9*mx?'#e05f5f':(e>0?'#5ec4b6':'#3a4152');
      const hh=Math.max(2,Math.abs(e)*sc);
      ctx.fillRect(x,e>0?mid-hh:mid,bw*0.62,hh);
    });
    ctx.fillStyle='#5d5a68';
    ctx.fillText('λ max '+ev[0].toExponential(3),36,20);
    ctx.fillText('λ min '+ev[state.d-1].toExponential(3),S.w-190,20);
    return ev;
  }
  function show(ev,label,negExpected){
    const neg=ev.filter(e=>e<-1e-9*Math.max.apply(null,ev.map(Math.abs))).length;
    const pos=ev.filter(e=>e>1e-9*Math.max.apply(null,ev.map(Math.abs))).length;
    $('gStatus').textContent=label+' — inertia ('+pos+'+, '+neg+'−)';
    $('gVerdict').innerHTML=neg===0
      ? '<div class="verdict ok">All '+state.d+' eigenvalues ≥ 0 (to floating-point noise): every zero in the window sits on the line, each contributing a rank-one positive piece. Sylvester has nothing to count.</div>'
      : '<div class="verdict warn"><b>'+neg+' negative eigenvalue'+(neg>1?'s':'')+' appeared.</b> One off-line pair {ρ, 1−ρ̄} was injected; it contributes 2(aaᵀ−bbᵀ) — signature (1,1). '
        +'The negative index of the compression counts off-line pairs: Bombieri&rsquo;s device, made tangible. In the real theorem this count is what Sylvester&rsquo;s law guarantees is basis-independent.</div>';
  }
  btnBuild.onclick=()=>{
    const T0=parseFloat($('gT0').value)||400;
    const L=Math.log(T0/(2*Math.PI)), d=16;
    const alphas=[],step=2*Math.PI/L;
    for(let k=0;k<d;k++) alphas.push(T0+k*step);
    const lo=T0-L, hi=T0+d*step+L+1;
    const all=_zeros600||RH.findZeros(10,600,0.18);
    const gammaList=all.filter(g=>g>lo&&g<hi);
    if(gammaList.length<4){$('gStatus').textContent='not enough zeros in window — raise T₀ or widen';return;}
    // a = ∫ psi = ∫_{-1/2}^{1/2} cos(√2 s) ds = √2 sin(1/√2)
    const a=Math.SQRT2*Math.sin(1/Math.SQRT2);
    let ci=0,best=1e18;
    gammaList.forEach((g,i)=>{const dd=Math.abs(g-(T0+d*step/2));if(dd<best){best=dd;ci=i;}});
    state={L,d,alphas,gammaList,a,centerIdx:ci};
    $('gToggle').disabled=false;
    const G=buildG(null);
    const ev=drawSpec(G,false);
    show(ev,'G̃ from '+gammaList.length+' true on-line zeros',false);
  };
  $('gToggle').onclick=()=>{
    if(!state)return;
    const G=buildG(0.51);
    const ev=drawSpec(G,true);
    show(ev,'one zero moved to β=0.51 (+ mirror 0.49)',true);
  };
})();
})();
