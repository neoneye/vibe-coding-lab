# -*- coding: utf-8 -*-
import io
p='ui.js'
src=io.open(p,encoding='utf-8').read()
lines=src.split('\n')
start=None; end=None
for i,l in enumerate(lines):
    if l.strip()=='function build(s2,p,soff){': start=i
    if start is not None and l.strip().startswith('function diag(M,n)'): end=i; break
assert start is not None and end is not None,(start,end)
new_block=u'''  function build(s2,p,soff){
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
  }'''
lines[start:end]=new_block.split('\n')
src=u'\n'.join(lines)

old_qp=u'    const rk=posNeg(r.P1,n), qp=posNeg(r.Qp||r.G,n);\n'
assert old_qp in src, 'qp line'
src=src.replace(old_qp,u'')

old_c=u"  function run(){\n    const tau0=parseInt($('efTau').value), w=parseInt($('efW').value)/10;\n    $('efRun').disabled=true;"
new_c=u"  function run(){\n    if($('efRun').disabled) return;\n    const tau0=parseInt($('efTau').value), w=parseInt($('efW').value)/10;\n    $('efRun').disabled=true;"
assert old_c in src, 'labC disable'
src=src.replace(old_c,new_c)

old_c2=u"        !signal?'One of the sides went quiet at this (\u03c4\u2080,w) \u2014 widen w or move \u03c4\u2080.':'Disagreement above quadrature noise \u2014 nudge the sliders.');\n    });"
new_c2=u"        !signal?'One of the sides went quiet at this (\u03c4\u2080,w) \u2014 widen w or move \u03c4\u2080.':'Disagreement above quadrature noise \u2014 nudge the sliders.');\n      $('efRun').disabled=false;\n    });"
assert old_c2 in src, 'labC callback tail'
src=src.replace(old_c2,new_c2)

# remove the stale early re-enable after verdict_html definition inside run()
old_c3=u"""    }
    $('efRun').disabled=false;
  }
  $('efRun').onclick=run;"""
new_c3=u"""    }
  }
  $('efRun').onclick=run;"""
assert old_c3 in src, 'labC stale enable'
src=src.replace(old_c3,new_c3)

io.open(p,'w',encoding='utf-8').write(src)
print('patched OK')
