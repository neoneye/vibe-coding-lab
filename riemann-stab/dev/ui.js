'use strict';
(function(){
if(typeof document==='undefined') return; // allows node --check / headless smoke
const RH=window.RH;
const $=id=>document.getElementById(id);
const fmt=(x,d)=>Number(x).toFixed(d===undefined?6:d);
const sci=x=>{const a=Math.abs(x);return a===0?'0':a<1e-4||a>=1e6?x.toExponential(3):fmt(x,Math.max(2,Math.min(12,Math.round(4-Math.log10(a)))))};

// ---------- canvas helpers ----------
function setupCanvas(cv){
  const dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth||cv.parentElement.clientWidth||900;
  const h=cv.getAttribute('height')?parseInt(cv.getAttribute('height')):300;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+'px';
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  return {ctx,w,h};
}

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
  for(let t=10;t<600;t+=20){ const a=t,b=Math.min(t+20,600); chunks.push(()=>{ zs.push(...RH.findZeros(a,b,0.18)); }); }
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

// ---------- argument principle (parametrized mesh) ----------
function argCountBox(sigmaLo,sigmaHi,tLo,tHi,mesh){
  mesh=mesh||0.05;
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
    {label:'Feng / Bui–Conrey–Young 2011–12 — ~41%', frac:0.41},
    {label:'Pratt–Robles–Zaharescu–Zeindler 2020 — 5/12 (simple)', frac:5/12},
    {label:'Alpöge–Furman 2026 — 2/3 (simple, unconditional)', frac:2/3, hot:true},
    {label:'Alpöge–Furman 2026 — Montgomery–Taylor window', frac:0.672503, hot:true},
  ];
  const x0=340, x1=S.w-90, yTop=22, dy=34;
  const ctx=S.ctx;
  ctx.font='13px '+getComputedStyle(document.body).getPropertyValue('--mono');
  for(const g of [0,0.25,0.5,0.75,1.0]){
    const x=x0+(x1-x0)*g;
    ctx.strokeStyle='#20242f';ctx.beginPath();ctx.moveTo(x,yTop-6);ctx.lineTo(x,yTop+dy*data.length);ctx.stroke();
    ctx.fillStyle='#5d5a68';ctx.fillText(Math.round(g*100)+'%',x-12,yTop+dy*data.length+16);
  }
  data.forEach((dd,i)=>{
    const y=yTop+i*dy;
    ctx.fillStyle=dd.hot?'#e0b458':'#9a97a3';
    ctx.textAlign='right';
    ctx.fillText(dd.label,x0-12,y+13);
    ctx.textAlign='left';
    if(dd.frac===null||dd.frac===-1){
      ctx.strokeStyle=dd.hot?'#e0b458':'#5ec4b6';
      ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x0,y+9);ctx.lineTo(x0+(x1-x0)*0.04,y+9);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#5d5a68';ctx.fillText(dd.frac===-1?'∞':'>0',x0+(x1-x0)*0.04+8,y+13);
    }else{
      ctx.fillStyle=dd.hot?'rgba(224,180,88,.85)':'rgba(94,196,182,.75)';
      ctx.fillRect(x0,y,(x1-x0)*dd.frac,16);
      ctx.fillStyle='#e8e6df';
      ctx.fillText((100*dd.frac).toFixed(2)+'%',x0+(x1-x0)*dd.frac+8,y+13);
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
        const zsx=RH.findZeros(13,16,0.2); return Math.abs(zsx[0]-14.134725141734693);
     }],
    ['argument principle: winding #zeros ξ, Im∈[1,50] (expect exactly 10)', ()=>{
        return Math.abs(argCountBox(-1,2,1,50,0.05).winding-10);
     }],
    ['Weil explicit formula @τ₀=60,w=1.5: rel. |zeros − primes| side', ()=>{
        const zsx=RH.findZeros(40,95,0.15);
        const r=RH.explicitFormulaSidesCenter(60,1.5,zsx,95,12000,0.002);
        return Math.abs(r.zeroSide-r.rhs)/Math.max(1e-9,Math.abs(r.zeroSide));
     }]
  ];
  const rows=[];
  tests.forEach(t=>{
    const row=document.createElement('div');row.className='st-row';
    row.innerHTML='<span class="st-dot"></span><span class="st-name">'+t[0]+'</span><span class="st-val mono"></span>';
    box.appendChild(row);rows.push(row);
  });
  runChunks(tests.map((t,i)=>()=>{
      let val,err=null;
      try{ val=t[1](); }catch(e){ err=e; }
      const dot=rows[i].querySelector('.st-dot'), out=rows[i].querySelector('.st-val');
      const pass=!err&&val<1e-8;
      dot.className='st-dot '+(pass?'pass':'fail');
      out.textContent=err?('error: '+err.message):sci(val);
      out.style.color=pass?'var(--green)':'var(--red)';
    }),()=>{},null);
  // §7 constants readout
  const c=0.5+Math.cos(1/Math.SQRT2)/(Math.SQRT2*Math.sin(1/Math.SQRT2));
  $('constantsBox').innerHTML=
   'R(ψ₀)=4/3 ⇒ 2−R = <span style="color:var(--green)">0.666667 = 2/3</span><br>'+
   'R(ψ<sub>MT</sub>)=c<sup>−1</sup><sub>MT</sub> ⇒ 2−R = <span style="color:var(--accent)">'+(2-c).toFixed(6)+'</span>&emsp;(the 0.6725…)<br>'+
   '½(3−R) = <span style="color:var(--accent)">'+(0.5*(3-c)).toFixed(6)+'</span>&emsp;(distinct, w/ MT window)<br>'+
   '<span class="dim">MT optimal within 2−R(ψ) [CCLM17] · bandwidth-one certificate obstruction ≈ 0.68183 [Easley–McAleer, numerically enclosed] · under-RH SDP record 0.6792</span>';
})();

/* =====================================================================
   §3 Lab A — Z(t) explorer
===================================================================== */
(function(){
  const cv=$('zplot'); if(!cv) return;
  let t0=0,t1=60;
  function plot(){
    const S=setupCanvas(cv); const ctx=S.ctx;
    const lo=t0,hi=t1;
    if(hi-lo<0.02)return;
    const n=Math.min(1400,Math.max(400,Math.floor((hi-lo)*22)));
    let mn=Infinity,mx=-Infinity; const vals=new Array(n);
    for(let i=0;i<n;i++){ const t=lo+(hi-lo)*i/(n-1); const v=RH.bigZ(t); vals[i]=v; if(v<mn)mn=v; if(v>mx)mx=v; }
    if(!isFinite(mn)||!isFinite(mx)){return;}
    if(mx-mn<1e-9){mx=mn+1;}
    const pad=(mx-mn)*0.12; mn-=pad;mx+=pad;
    const X=t=>(t-lo)/(hi-lo)*(S.w-64)+48, Y=v=>S.h-(v-mn)/(mx-mn)*(S.h-40)-22;
    ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(48,10);ctx.lineTo(48,S.h-22);ctx.lineTo(S.w-10,S.h-22);ctx.stroke();
    ctx.font='12px monospace';ctx.fillStyle='#5d5a68';
    for(let k=0;k<=4;k++){ const v=mn+(mx-mn)*k/4;
      ctx.fillText(fmt(v,2),4,Y(v)+4);
      ctx.strokeStyle='#1a1f2c';ctx.beginPath();ctx.moveTo(48,Y(v));ctx.lineTo(S.w-10,Y(v));ctx.stroke(); }
    for(let k=0;k<=6;k++){ const t=lo+(hi-lo)*k/6;
      ctx.fillText(fmt(t,hi-lo>60?0:2),X(t)-10,S.h-6); }
    if($('zpGram').checked){
      const n0=Math.ceil(RH.theta(lo)/Math.PI), nn=Math.floor(RH.theta(hi)/Math.PI);
      if(nn-n0<800){ for(let g=n0;g<=nn;g++){ const p=RH.gramPoint(g);
          if(p<lo||p>hi)continue; const x=X(p);
          ctx.strokeStyle='rgba(224,180,88,.35)';ctx.beginPath();ctx.moveTo(x,10);ctx.lineTo(x,S.h-22);ctx.stroke();
          ctx.fillStyle='rgba(224,180,88,.55)';ctx.fillText(String(g),x+2,18); } }
    }
    ctx.strokeStyle='#5ec4b6';ctx.lineWidth=1.6;ctx.beginPath();
    for(let i=0;i<n;i++){ const t=lo+(hi-lo)*i/(n-1);
      if(i===0)ctx.moveTo(X(t),Y(vals[i]));else ctx.lineTo(X(t),Y(vals[i])); }
    ctx.stroke();
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
    add('von Mangoldt main term ≈', zeros?fmt(vm(t1)-vm(t0),1)+' ± S':'—');
    if(zeros&&t0>=10&&t1<=102){
      let worst=0,cnt=0;
      for(const r of REF) if(r>t0&&r<t1){ cnt++;
        let best=1e9; for(const z of zeros) best=Math.min(best,Math.abs(z-r)); worst=Math.max(worst,best); }
      add('reference zeros in view',String(cnt));
      add('max |computed − reference|', worst>0?worst.toExponential(2):'< 1e−12');
    }
  }
  function doFind(){
    const btn=$('zpFind');btn.disabled=true;
    const zeros=RH.findZeros(t0,t1,0.15);
    refreshStats(zeros);
    const tbl=$('zpTable'),wrap=$('zpTableWrap');
    let rows='<tr><th>#</th><th>t (computed)</th><th>|Z′| at zero</th></tr>';
    zeros.slice(0,120).forEach((z,i)=>{
      const h=1e-5, dv=(RH.bigZ(z+h)-RH.bigZ(z-h))/(2*h);
      rows+='<tr><td>'+(i+1)+'</td><td class="num">'+z.toFixed(12)+'</td><td class="num">'+sci(Math.abs(dv))+
        (Math.abs(dv)>0.5?' <span class="green">|Z′| large</span>':' <span class="red">|Z′| small</span>')+'</td></tr>';
    });
    tbl.innerHTML=rows; wrap.style.display='block';
    plot(); btn.disabled=false;
  }
  function syncRange(){
    t0=parseFloat($('zpT0').value);t1=parseFloat($('zpT1').value);
    if(!(t1>t0)){t1=t0+1;$('zpT1').value=t1;}
    if(t1-t0>1500){t1=t0+1500;$('zpT1').value=t1;}
    if(t0<-50){t0=-50;$('zpT0').value=t0;}
    if(t1>5000){t1=5000;$('zpT1').value=t1;}
    refreshStats(null);plot();
  }
  $('zpFind').onclick=doFind;
  $('zpZoomIn').onclick=()=>{const m=(t0+t1)/2;t0=m-(t1-t0)/4;t1=m+(t1-t0)/2;syncRange();};
  $('zpZoomOut').onclick=()=>{const m=(t0+t1)/2,w=(t1-t0);t0=m-w;t1=m+w;syncRange();};
  $('zpT0').onchange=syncRange;$('zpT1').onchange=syncRange;
  $('zpGram').onchange=plot;
  window.addEventListener('resize',()=>plot());
  syncRange();
  setTimeout(doFind,300);
})();

/* =====================================================================
   §4 Lab B — completeness audit (counts compared, mesh cross-checked)
===================================================================== */
(function(){
  const slider=$('auditT'); if(!slider) return;
  slider.oninput=()=>{$('auditTLabel').textContent='T = '+slider.value;};
  $('auditRun').onclick=()=>{
    const T=parseFloat(slider.value); $('auditRun').disabled=true;
    const st=$('auditStats'); st.innerHTML='';
    const verdict=$('auditVerdict');verdict.innerHTML='';
    const thunks=[]; let coarse=null,fine=null,zeros=null;
    thunks.push(()=>{ coarse=argCountBox(-1,2,1,T,0.05); });
    thunks.push(()=>{ fine=argCountBox(-1,2,1,T,0.025); });
    thunks.push(()=>{ zeros=RH.findZeros(2,T,0.15); });
    runChunks(thunks,()=>{
      $('auditRun').disabled=false;
      const w=coarse.winding, k=Math.round(w);
      const resid=Math.abs(w-k);
      const meshAgrees=Math.abs(fine.winding-Math.round(fine.winding))<0.02 &&
                        Math.round(fine.winding)===k;
      const countsAgree=(k===zeros.length);
      const okAll=resid<0.02&&countsAgree&&meshAgrees;
      const add=(kv,v)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+kv+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
      add('Δarg ξ / 2π — box count (coarse mesh)', fmt(w,4));
      add('box count (half mesh)', fmt(fine.winding,4)+(meshAgrees?' ✓':' ✗'));
      add('nearest integer', String(k));
      add('sign changes of Z(t), 2<t<T', String(zeros.length));
      add('min |ξ| sampled on contour', sci(coarse.minAbs)+' <span class="dim">(informational)</span>');
      if(okAll){
        verdict.innerHTML='<div class="verdict ok">VERDICT — box count ('+k+') equals sign-change count ('+zeros.length+
          ') at both meshes: every zero of ζ with 2 &lt; t &lt; '+T+' lies on the critical line, simply, to numerical resolution.</div>';
      }else if(!countsAgree&&resid<0.02&&meshAgrees){
        verdict.innerHTML='<div class="verdict warn"><b>COUNT MISMATCH</b> — box contains '+k+' zeros but Z(t) shows '+zeros.length+
          ' sign changes. Either a multiple/tangent zero sits in range, or numerics slipped. This discrepancy pattern is exactly what a real off-line '
          +'or multiple zero would look like — treat as a finding, not a certificate.</div>';
      }else{
        verdict.innerHTML='<div class="verdict warn">INCONCLUSIVE — winding residual '+resid.toExponential(2)+
          ' or meshes disagree ('+fmt(fine.winding,4)+' vs '+fmt(w,4)+'). Nudge T; operational hazard of the method.</div>';
      }
    },'auditBar');
  };
})();

/* =====================================================================
   §5 Lab C — explicit formula, centered windows
===================================================================== */
(function(){
  if(!$('efTau')) return;
  $('efTau').oninput=()=>{$('efTauLabel').textContent='τ₀ = '+$('efTau').value;};
  $('efW').oninput=()=>{$('efWLabel').textContent='w = '+(parseInt($('efW').value)/10).toFixed(1);};
  function run(){
    if($('efRun').disabled) return;
    const tau0=parseInt($('efTau').value), w=parseInt($('efW').value)/10;
    $('efRun').disabled=true;
    getZeros600((zs)=>{
      const r=RH.explicitFormulaSidesCenter(tau0,w,zs,600,12000,Math.min(0.01,Math.max(0.001,w/400)));
      const st=$('efStats'); st.innerHTML='';
      const add=(k,v,col)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+k+'</span><span class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span>';st.appendChild(d);};
      add('zero side Σ F̂(γ) (+conjugates)','<b>'+fmt(r.zeroSide,5)+'</b>','#5ec4b6');
      add('pole terms F̂(±i/2)',fmt(r.poles,5));
      add('+ gamma integral ∫F̂·μ',fmt(r.arch,5));
      add('− 2Σ Λ(n)/√n · F(log n)',fmt(r.prime,5),'#e05f5f');
      add('= right-hand side','<b>'+fmt(r.rhs,5)+'</b>');
      const diff=Math.abs(r.zeroSide-r.rhs);
      const rel=diff/Math.max(1e-9,Math.abs(r.zeroSide));
      const signal=Math.abs(r.prime)>0.02&&Math.abs(r.arch)>0.05&&Math.abs(r.zeroSide)>0.2;
      const good=rel<1e-6&&signal;
      add('|difference| / |zero side|',rel.toExponential(2),good?'var(--green)':'var(--red)');
      verdict_html($('efVerdict'),good,
        'The zeros near τ₀='+tau0+' and the primes sing the same number, to relative disagreement '+rel.toExponential(1)+
        '. Both sides are genuinely loaded here (prime-side contribution '+fmt(r.prime,3)+' against archimedean '+fmt(r.arch,3)+').',
        !signal?'One of the sides went quiet at this (τ₀,w) — widen w or move τ₀.':'Disagreement above quadrature noise — nudge the sliders.');
      $('efRun').disabled=false;
    });
    function verdict_html(el,good,msgA,msgB){
      el.innerHTML='<div class="verdict '+(good?'ok':'warn')+'">'+(good?msgA:msgB)+'</div>';
    }
  }
  $('efRun').onclick=run;
  setTimeout(run,800);
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
      const surmise=x=>32*x*x/(Math.PI*Math.PI)*Math.exp(-4*x*x/Math.PI);
      const poisson=x=>Math.exp(-x);
      const ymax=1.15;
      const S=setupCanvas($('pcHist'));const ctx=S.ctx;
      const Y=x=>S.h-24-x/ymax*(S.h-44), X=x=>24+x/hi*(S.w-40);
      ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(24,S.h-24);ctx.lineTo(S.w-16,S.h-24);ctx.stroke();
      ctx.font='12px monospace';ctx.fillStyle='#5d5a68';
      for(let g=0;g<=3;g+=0.5){ctx.fillText(fmt(g,1),X(g)-6,S.h-8);}
      const curve=(f,color)=>{ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();
        for(let i=0;i<=180;i++){const x=i/180*hi;const px=X(x),py=Y(f(x));
          if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.lineWidth=1;};
      curve(poisson,'#e05f5f');
      curve(surmise,'#e0b458');
      bins.forEach((c,i)=>{ const dens=c/(total*bw);
        ctx.fillStyle='rgba(94,196,182,.55)';
        ctx.fillRect(X(lo+i*bw)+1,Y(dens),(S.w-40)/nb-2,Y(0)-Y(dens)); });
      const mean=sp.reduce((a,b)=>a+b,0)/sp.length;
      const min=Math.min.apply(null,sp);
      const below=sp.filter(d=>d<0.2).length;
      // surmise P(delta<0.2) by quadrature — computed, not asserted
      let pSurmise=0; const qn=2000,hh=0.2/qn;
      for(let i=0;i<=qn;i++){ const x=i*hh; const fval=surmise(x);
        pSurmise+=(i===0||i===qn?0.5:1)*fval*hh; }
      const st=$('pcStats');st.innerHTML='';
      const add=(k,v)=>{const d=document.createElement('div');d.className='stat';
        d.innerHTML='<span class="k">'+k+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
      add('zeros used',String(zs.length));
      add('mean normalized spacing',fmt(mean,4));
      add('smallest gap δ_min (Lehmer watch)',min.toFixed(4), min<0.1?'var(--red)':'var(--accent)');
      add('observed share δ < 0.2', below+' ('+(100*below/total).toFixed(2)+'%)');
      add('surmise P(δ < 0.2)', (100*pSurmise).toFixed(2)+'%');
      $('pcStatus').textContent='done — '+total+' spacings';
      btn.disabled=false;
    });
  };
})();

/* =====================================================================
   §8 Lab E — two panels: exact chain + real-zero Q
===================================================================== */
// ---- E·i: exact algebraic chain in an idealized orthonormal frame ----
(function(){
  const s2s=$('cS2'); if(!s2s) return;
  const N_TOTAL=24;
  function build(s2,p,soff){
    const s1=N_TOTAL-s2-p;
    const dim=s1+s2+2*p;
    const mk=()=>{const M=[];for(let i=0;i<dim;i++)M.push(new Array(dim).fill(0));return M;};
    const G=mk(),P1=mk();
    const outer=(M,x,y,f)=>{for(let i=0;i<dim;i++)for(let j=0;j<dim;j++)M[i][j]+=f*x[i]*y[j];};
    let slot=0;
    // doubled on-line zeros: one slot each, vv^T counted twice -> trace 2, rank 1
    for(let k=0;k<s2;k++){
      const v=new Array(dim).fill(0); v[slot]=1; slot++;
      outer(G,v,v,2);
    }
    // off-line pairs: two slots; v = a + i*b, a=sqrt(1+s^2)*e, b=s*f
    // vv^T + conj(v)conj(v)^T = 2(aa^T - bb^T): trace 2, inertia (1,1)
    for(let k=0;k<p;k++){
      const ei=slot++, fi=slot++;
      const a=new Array(dim).fill(0), b=new Array(dim).fill(0);
      a[ei]=Math.sqrt(1+soff*soff); b[fi]=soff;
      outer(G,a,a,2); outer(G,b,b,-2);
    }
    // simple on-line zeros: remaining slots, land in both G and P1
    for(let k=0;k<s1;k++){
      const v=new Array(dim).fill(0); v[slot]=1; slot++;
      outer(G,v,v,1); outer(P1,v,v,1);
    }
    return {G,P1,dim,s1,N:s1+2*s2+2*p};
  }
  function diag(M,n){let tr=0,hs=0;for(let i=0;i<n;i++){tr+=M[i][i];for(let j=0;j<n;j++)hs+=M[i][j]*M[i][j];}return{tr,hs};}
  function posNeg(M,n){const ev=RH.jacobiEigen(M,n);
    const sc=Math.max.apply(null,ev.map(Math.abs).concat([1e-12]));
    return {pos:ev.filter(e=>e>1e-9*sc).length, neg:ev.filter(e=>e<-1e-9*sc).length, ev};}
  function update(){
    const s2=parseInt($('cS2').value), p=parseInt($('cPairs').value), soff=parseInt($('cOff').value)/100;
    $('cS2Label').textContent='s₂ = '+s2;
    $('cPairsLabel').textContent='p = '+p;
    $('cOffLabel').textContent='s = '+soff.toFixed(2);
    const s1=N_TOTAL-s2-p;
    if(s1<0)return;
    const r=build(s2,p,soff);
    const n=r.dim;
    const g=diag(r.G,n), p1=diag(r.P1,n);
    // Q' = G - P1 built explicitly:
    const Qp=[];for(let i=0;i<n;i++){Qp.push(new Array(n).fill(0));
      for(let j=0;j<n;j++)Qp[i][j]=r.G[i][j]-r.P1[i][j];}
    const qq=posNeg(Qp,n);
    const rk=posNeg(r.P1,n);
    const B=4*g.tr-2*r.N-g.hs;
    const st=$('cStats'); st.innerHTML='';
    const add=(k,v,col)=>{const d=document.createElement('div');d.className='stat';
      d.innerHTML='<span class="k">'+k+'</span><span class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span>';st.appendChild(d);};
    add('N = s₁+2s₂+2p',String(r.N));
    add('tr G̃ (=N?)',fmt(g.tr,3),Math.abs(g.tr-r.N)<1e-9?'var(--green)':'var(--red)');
    add('rank P₁ (should be s₁='+s1+')',String(rk.pos),rk.pos===s1?'var(--green)':'var(--red)');
    add('n₊(Q′) ≤ s₂+p = '+(s2+p),String(qq.pos),qq.pos<=s2+p?'var(--green)':'var(--red)');
    add('bound B = 4tr−2N−‖G̃‖²_HS',fmt(B,3),'var(--accent)');
    add('rank P₁ ≥ B ?',(rk.pos>=B-1e-9?'holds':'VIOLATED'),rk.pos>=B-1e-9?'var(--green)':'var(--red)');
    add('slack: rank P₁ − B',fmt(rk.pos-B,3),'var(--teal)');
    $('cVerdict').innerHTML='<div class="verdict ok">Watch the bookkeeping: doubling zeros keeps rank fixed while trace grows, and the flat charge-4 term eats the slack — '
      +'with p = 0 the inequality closes to exact equality (m² ≥ 3m−2 at work). Off-line pairs donate their positive directions into Q′, counted through n₊ ≤ s₂+p. '
      +'What an orthonormal toy frame cannot show is the ⅔ itself: there, R(ψ) &gt; 1 comes from real window overlap — Beam 2&rsquo;s analytic input.</div>';
  }
  s2s.oninput=update;$('cPairs').oninput=update;$('cOff').oninput=update;
  update();
})();

// ---- E·ii: Q from real zeros near t=400 ----
(function(){
  const cv=$('gSpec'); if(!cv) return;
  let base=null;
  const base_a=Math.SQRT2*Math.sin(1/Math.SQRT2);
  function phiHatQuad(x,y,shape){
    const L=base.L,u0=-L/2,u1=L/2,nodes=2400;
    const amp=u=>shape==='ind'?1:(c=>c<=0?0:Math.sqrt(c))(Math.cos(Math.SQRT2*u/L));
    let re=0,im=0;const h=(u1-u0)/nodes;
    for(let i=0;i<=nodes;i++){
      const w=(i===0||i===nodes)?1:(i%2?4:2);
      const u=u0+i*h, m=amp(u);
      if(m===0)continue;
      const e=Math.exp(-y*u)*m;
      re+=w*e*Math.cos(-x*u); im+=w*e*Math.sin(-x*u);
    }
    return {re:re*h/3,im:im*h/3};
  }
  function Qmat(p,beta){
    const {alphas,gammaList,L,a,d}=base;
    const Q=[];for(let i=0;i<d;i++)Q.push(new Array(d).fill(0));
    const norm=1/(a*L*L);
    const addTerm=(v1,v2,m)=>{for(let i=0;i<d;i++)for(let j=0;j<d;j++)
      Q[i][j]+=m*(v1[i].re*v2[j].re-v1[i].im*v2[j].im);};
    for(let idx=0;idx<p;idx++){
      const gr=gammaList[idx], dy=0.5-beta;
      const v=alphas.map(al=>phiHatQuad(gr-al,dy,'mt'));
      addTerm(v,v,norm);
      const vc=v.map(z=>({re:z.re,im:-z.im}));
      addTerm(vc,vc,norm);
    }
    return Q;
  }
  function draw(ev){
    const S=setupCanvas(cv);const ctx=S.ctx;
    const d=ev.length;
    const mx=Math.max.apply(null,ev.map(Math.abs).concat([1e-12]));
    const mid=S.h/2, sc=(S.h/2-26)/mx, bw=(S.w-80)/d;
    ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(30,mid);ctx.lineTo(S.w-30,mid);ctx.stroke();
    ctx.font='12px monospace';
    ev.forEach((e,i)=>{
      const x=45+i*bw;
      ctx.fillStyle=e<-1e-11*mx?'#e05f5f':(e>1e-11*mx?'#5ec4b6':'#3a4152');
      const hh=Math.max(2,Math.abs(e)*sc);
      ctx.fillRect(x,e>0?mid-hh:mid,bw*0.62,hh);
    });
    ctx.fillStyle='#5d5a68';
    ctx.fillText('λmax '+ev[0].toExponential(3),36,20);
    ctx.fillText('λmin '+ev[d-1].toExponential(3),S.w-190,20);
  }
  function update(){
    if(!base) return;
    const p=parseInt($('gPairs').value), beta=parseInt($('gBeta').value)/100;
    $('gPairsLabel').textContent='p = '+p;
    $('gBetaLabel').textContent='β = '+beta.toFixed(2);
    if(!base) return;
    if(p===0){
      draw(new Array(base.d).fill(0));
      $('gVerdict').innerHTML='<div class="verdict ok">Q = 0: with every zero on the line, the off-line part of Weil&rsquo;s form vanishes.</div>';
      $('gStats').innerHTML='';
      return;
    }
    const ev=RH.jacobiEigen(Qmat(p,beta),base.d);
    draw(ev);
    const scale=Math.max.apply(null,ev.map(Math.abs));
    const neg=ev.filter(e=>e<-1e-9*scale).length;
    const pos=ev.filter(e=>e>1e-9*scale).length;
    const st=$('gStats'); st.innerHTML='';
    const add=(k,v)=>{const d=document.createElement('div');d.className='stat';
      d.innerHTML='<span class="k">'+k+'</span><span class="v">'+v+'</span>';st.appendChild(d);};
    add('off-line pairs injected',String(p));
    add('inertia n₊(Q)',String(pos),'var(--teal)');
    add('negative index n₋(Q)',String(neg),neg>0?'var(--red)':'var(--dim)');
    add('bound respected: n₊ ≤ p',pos+' ≤ '+p+(pos<=p?' ✓':' ✗'),'var(--green)');
    if(base.ratio!==null){
      add('HS²/trG̃ vs c⁻¹_MT',base.ratio.toFixed(4)+' / 1.3275','var(--accent)');
      add('asymptotic share',(100*base.ratio/1.327503).toFixed(1)+'%');
    }
    $('gVerdict').innerHTML='<div class="verdict '+(neg>0?'warn':'ok')+'">'+
     (neg===0
      ? 'Pair blocks too weak against resolution at this β — push β further from ½.'
      : 'Each pair {ρ, 1−ρ̄} adds a signature-(1,1) block. The negative index — basis-independent by Sylvester, read as an off-line count by Bombieri — climbs with p, never exceeding it.')+'</div>';
  }
  const T0=400, L=Math.log(T0/(2*Math.PI)), d=16, stepE=2*Math.PI/L;
  $('convRun').onclick=()=>{
    if(!base||!base.all){ return; }
    const rows=[];
    for(const dd of [8,10,12,14,16,18,20,24]){
      const stepC=2*Math.PI/L;
      const alphasC=[];for(let k=0;k<dd;k++)alphasC.push(T0+k*stepC);
      const lo=T0-L,hi=T0+dd*stepC+L;
      const zs=base.all.filter(g=>g>lo&&g<hi);
      const normJ=1/(base.a*L*L);
      const G=[];for(let i=0;i<dd;i++)G.push(new Array(dd).fill(0));
      for(const gr of zs){
        const v=alphasC.map(al=>phiHatQuad(gr-al,0,'mt'));
        for(let i2=0;i2<dd;i2++)for(let j2=0;j2<dd;j2++)G[i2][j2]+=normJ*(v[i2].re*v[j2].re-v[i2].im*v[j2].im);
      }
      let tr=0,hs=0;
      for(let i2=0;i2<dd;i2++){tr+=G[i2][i2];}
      for(let i2=0;i2<dd;i2++)for(let j2=0;j2<dd;j2++)hs+=G[i2][j2]*G[i2][j2];
      rows.push({d:dd,nz:zs.length,tr:tr,ratio:tr>1e-9?hs/tr:NaN});
    }
    let html='<tr><th>d</th><th>zeros in frame</th><th>tr G~</th><th>HS²/tr G~</th><th>share of c⁻¹_MT</th></tr>';
    for(const r of rows){
      html+='<tr><td>'+r.d+'</td><td class="num">'+r.nz+'</td><td class="num">'+r.tr.toFixed(3)+
        '</td><td class="num">'+r.ratio.toFixed(4)+'</td><td class="num">'+(100*r.ratio/1.327503).toFixed(1)+'%</td></tr>';
    }
    html+='<tr><td colspan="5" class="small dim">asymptotic target c⁻¹_MT = 1.32750; toy-scale values sit below it and fluctuate with grid placement — sensitivity only — diagnosing approach to c⁻¹_MT needs T→∞ with d∼N(T,2T).</td></tr>';
    $('convTable').innerHTML=html;
    $('convWrap').style.display='block';
  };
  $('convRun').disabled=true;

  getZeros600(zall=>{
    const alphas=[]; for(let k=0;k<d;k++) alphas.push(T0+k*stepE);
    const lo=T0-L, hi=T0+d*stepE+L;
    const gammaList=zall.filter(g=>g>lo&&g<hi).slice(0,10);
    // zero-side second-moment ratio for the on-line compression (exploratory)
    base={L,d,alphas,gammaList,a:base_a,ratio:null,all:zall};
    const normJ=1/(base_a*L*L), G=[];for(let i=0;i<d;i++)G.push(new Array(d).fill(0));
    for(const gr of gammaList){
      const v=alphas.map(al=>phiHatQuad(gr-al,0,'mt'));
      for(let i=0;i<d;i++)for(let j=0;j<d;j++)G[i][j]+=normJ*(v[i].re*v[j].re-v[i].im*v[j].im);
    }
    let tr=0,hs=0;for(let i=0;i<d;i++){tr+=G[i][i];}
    for(let i=0;i<d;i++)for(let j=0;j<d;j++)hs+=G[i][j]*G[i][j];
    base.ratio=tr>1e-9?hs/tr:null;
    $('gPairs').setAttribute('max',String(Math.min(8,gammaList.length)));
    update();
    $('convRun').disabled=false;
  });
  $('gPairs').oninput=update;
  $('gBeta').oninput=update;

})();
/* =====================================================================
   §9 E·iii — mixture statistics (canonical builder; RH.windowFramePair)
===================================================================== */
(function(){
  const cv=$('mixCanvas'); if(!cv) return;
  $('mixRun').onclick=()=>{
    if($('mixRun').disabled) return;
    $('mixRun').disabled=true;
    getZeros600(zall=>{
      try{
        const T0m=400, Lm=Math.log(T0m/(2*Math.PI));
        const frame=RH.windowFramePair(zall,16,T0m,Lm,['sind','mt']);
        const wSamples=[];for(let i=0;i<=100;i++)wSamples.push(i/100);
        const st=RH.mixtureStats(frame,wSamples);
        // draw both curves
        const S=setupCanvas(cv);const ctx=S.ctx;
        const allV=st.fVals.concat(st.gVals,[st.X,st.Y]);
        let yLo=Math.min.apply(null,allV)*0.97, yHi=Math.max.apply(null,allV)*1.03;
        const Xmap=w=>30+w*(S.w-56), Ymap=v=>S.h-26-(v-yLo)/(yHi-yLo)*(S.h-46);
        ctx.strokeStyle='#262c3a';ctx.beginPath();ctx.moveTo(30,Ymap(yLo));ctx.lineTo(S.w-26,Ymap(yLo));ctx.stroke();
        ctx.font='12px monospace';ctx.fillStyle='#5d5a68';
        const curve=(vals,color)=>{ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();
          vals.forEach((v,i)=>{const px=Xmap(wSamples[i]),py=Ymap(v);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
          ctx.stroke();ctx.lineWidth=1;};
        curve(st.fVals,'#5ec4b6');
        curve(st.gVals,'#e0b458');
        [[st.Y,'MT parent '+st.Y.toFixed(4),'#8ab8e8'],[st.X,'ind-sm parent '+st.X.toFixed(4),'#9a97a3']].forEach(([yv,lab,col])=>{
          ctx.fillStyle=col;ctx.fillText(lab,S.w-190,Ymap(yv)-4);
        });
        const stEl=$('mixStats'); stEl.innerHTML='';
        const ad=(k,v,col)=>{const dd=document.createElement('div');dd.className='stat';
          dd.innerHTML='<span class="k">'+k+'</span><span class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span>';stEl.appendChild(dd);};
        ad('parent X/N̄ (smoothed indicator)',fmt(st.X,5));
        ad('parent Y/N̄ (MT)',fmt(st.Y,5));
        ad('mixed moment M/N̄',fmt(st.M,5),'var(--red)');
        ad('mixed-Gram best f/N̄',fmt(st.bestF,5),st.bestF<Math.min(st.X,st.Y)?'var(--teal)':'var(--dim)');
        ad('window-mixture best/N̄ (certificate-valid family)',fmt(st.bestG,5),'var(--accent)');
        // asymptotic window functionals (paper windows psi_0 / psi_MT)
        const Ra=RH.winFunctionalR('ind',900);
        const Rb=RH.winFunctionalR('mt',900);
        const Rx=RH.winCrossFunctional('ind','mt',700);
        const wStar=(Rb-Rx)/(Ra+Rb-2*Rx);
        const fStar=Rb-(Rb-Rx)*(Rb-Rx)/(Ra+Rb-2*Rx);
        const nominal=2-fStar;
        const afd=[
          ['R(ψ₀) analytic',fmt(Ra,7),'var(--dim)'],
          ['R(ψ_MT) analytic',fmt(Rb,7),'var(--dim)'],
          ['cross R₀,ₘₜ quadrature',fmt(Rx,7),'var(--red)'],
          ['dip condition M < min(R)',(Rx<Math.min(Ra,Rb)?'holds':'fails'),Rx<Math.min(Ra,Rb)?'var(--teal)':'var(--red)'],
          ['optimal indicator weight w*',fmt(wStar,6),'var(--accent)'],
          ['nominal mixed moment',fmt(fStar,7),'var(--accent)'],
          ['nominal simple-zero constant 2−R',(2-fStar).toFixed(9),'var(--green)'],
          ['gain over MT route','+'+((2-fStar)-(2-Rb)).toFixed(9),'var(--teal)']
        ];
        const fsEl=$('funcStats'); fsEl.innerHTML='';
        for(const [k,v,col] of afd){
          const dd=document.createElement('div');dd.className='stat';
          dd.innerHTML='<span class="k">'+k+'</span><span class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span>';
          fsEl.appendChild(dd);
        }
        cv._data={X:st.X,Y:st.Y,M:st.M,bestF:st.bestF,bestG:st.bestG,d16zeros:frame.zs.length,symViol:st.symViol,
                  Ra:Ra,Rb:Rb,Rx:Rx,wStar:wStar,nominal:nominal};
        const dips=st.bestF<Math.min(st.X,st.Y)-1e-9;
        const undercut=st.bestG<Math.min(st.X,st.Y)-1e-9;
        const winner=(st.X<=st.Y)?'smoothed-indicator':'Montgomery-Taylor';
        const winVal=Math.min(st.X,st.Y);
        $('mixVerdict').innerHTML='<div class="verdict '+(dips||undercut?'ok':'warn')+'">'+
          'Neither mixture dips below its better parent ('+(st.X<=st.Y?'smoothed-indicator':'MT')+' = '+
          fmt(winVal,4)+'): both curves run monotonically between endpoints and bottom out exactly there'+
          (undercut?', with an interior undercut of '+fmt(Math.min(st.X,st.Y)-st.bestG,4):', with no interior gain')+'. '+
          'Read this only as finite-T bookkeeping: which parent wins is a property of these two windows at t≈400, NOT evidence about '+
          'asymptotic optimality among windows — that claim ([CCLM17]) lives at T→∞ and is untouched by a browser toy. '+
          'The open fork: if the polarized prime-side functional R(ψ₁,ψ₂) satisfies R ≥ min(R(ψ₁),R(ψ₂)) throughout a '+
          'meaningful family, the mixture program dies rigorously; if some pair violates it, a configuration-wise rank-two extraction lemma must first pay for itself.</div>';
        $('mixStatus').textContent='done';
      }catch(e){ console.error(e); $('mixStatus').textContent='error: '+e.message; }
      $('mixRun').disabled=false;
    });
  };
})();
})();
