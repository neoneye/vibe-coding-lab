"""Independent high-precision oracle for Lab F (Experiment B of the
investigation plan).  Two independent evaluations of the Lamzouri kernel
K(z) = f0-hat(z), f0(u) = cos(sqrt2 u)/(sqrt2 sin(1/sqrt2)) on [-1/2,1/2]:
  (a) direct quadrature of the defining Fourier integral, mpmath, 80 digits
      (160 at the removable-singularity points), on the fixed kernel battery;
  (b) the closed form re-implemented in mpmath at 80 digits, used for every
      pair sum.
Compared against dev/core.js via labf_dump.json.  Errors are reported both
absolutely and scaled by the sum of absolute term magnitudes.
"""
import json, sys, os
from mpmath import mp, mpf, mpc, cos, sin, sqrt, exp, pi, quad, fabs

here=os.path.dirname(os.path.abspath(__file__))
D=json.load(open(os.path.join(here,'labf_dump.json')))
mp.dps=80
# Every constant is recomputed inside the current precision context: raising
# mp.dps after computing sqrt(2) once would silently keep the old digits.
def S2(): return sqrt(2)
def NRM(): return 1/(S2()*sin(1/S2()))
def f0(u): return cos(S2()*u)*NRM()
def tompc(z):
    # binary64 coordinates are converted to mpf EXACTLY (mpf(float)) before any
    # arithmetic; subtracting Python floats first would round.
    if isinstance(z,dict): return mpc(mpf(z['re']),mpf(z['im']))
    return z
def K_quad(z):
    z=tompc(z)
    return quad(lambda u: f0(u)*exp(-2*pi*1j*z*u), [-mpf(1)/2, mpf(1)/2])
def sinc(w):
    if fabs(w)<mpf('1e-30'): return mpf(1)-w*w/6
    return sin(w)/w
def K_closed(z):
    z=tompc(z)
    b=2*pi*z
    return (sinc((S2()-b)/2)+sinc((S2()+b)/2))/(2*S2()*sin(1/S2()))

fail=0
def check(name,cond,detail=''):
    global fail
    print(('  OK   ' if cond else '  FAIL ')+name+('  -- '+detail if detail else ''))
    if not cond: fail+=1

print('--- kernel battery: quadrature vs closed form vs core.js ---')
worst_q=mpf(0); worst_js=mpf(0)
for row in D['kernel']:
    z=row['z']; js=mpc(row['k']['re'],row['k']['im'])
    near_sing = abs(abs(z["re"])-float(1/(sqrt(2)*pi)))<1e-6 and z["im"]==0
    mp.dps = 160 if near_sing else 80
    kq=K_quad(z); kc=K_closed(z)
    worst_q=max(worst_q,fabs(kq-kc)); worst_js=max(worst_js,fabs(kc-js)/max(1,fabs(kc)))
    if row['kreal'] is not None: worst_js=max(worst_js,fabs(kc-mpf(row['kreal']))/max(1,fabs(kc)))
    mp.dps=80
check('quadrature and closed form agree to 1e-60 on the battery',worst_q<mpf('1e-60'),str(worst_q))
check('core.js kernel agrees with the oracle to 4e-15 relative (double precision; K reaches ~20 on the battery)',worst_js<mpf('4e-15'),str(worst_js))
check('K(0) = 1',fabs(K_quad({'re':0,'im':0})-1)<mpf('1e-70'))
kq_dec=K_quad(mpc(0,mpf('0.4')))      # exact decimal 0.4
kq_bin=K_quad(mpc(0,mpf(0.4)))        # the binary64 nearest 0.4
check('||f_z||^2 = K(z - conj z) = K(0.4i) at exact decimal z = 0.2i equals the reviewer\'s 1.26417876513369812067 (20 digits)',
      fabs(kq_dec-mpf('1.26417876513369812067'))<mpf('5e-21'),mp.nstr(kq_dec,30))
check('and at the binary64 0.4 it is 1.264178765133698152…; the two are different inputs, not conflicting evaluations',
      fabs(kq_bin-mpf('1.264178765133698152235'))<mpf('1e-21'),mp.nstr(kq_bin,30))

print('--- Proposition 2.1 on',len(D['multisets']),'multisets, closed form at 80 digits ---')
viol=0; worst_abs=mpf(0); worst_rel=mpf(0); worst_im=mpf(0); asym=0; n_pts=0
tight=[]
for ms in D['multisets']:
    pts=ms['points']; js=ms['r']
    N=sum(p['m'] for p in pts); simple=sum(1 for p in pts if p['im']==0 and p['m']==1)
    key={(p['re'],p['im']):p['m'] for p in pts}
    sym=all(key.get((p['re'],-p['im']))==p['m'] for p in pts if p['im']!=0)
    if not sym: asym+=1
    S=mpc(0); mag=mpf(0)
    for a in pts:
        for b in pts:
            k=K_closed(mpc(mpf(a['re'])-mpf(b['re']),mpf(a['im'])-mpf(b['im'])))
            t=a['m']*b['m']*k*k; S+=t; mag+=fabs(t)
    n_pts+=len(pts)
    worst_im=max(worst_im,fabs(S.imag))
    b1=2*N-S.real; b2=mpf(3)/2*N-S.real/2
    if simple<b1-mpf('1e-40') or len(pts)<b2-mpf('1e-40'): viol+=1; print('   VIOLATION',ms['name'])
    err=fabs(S.real-mpf(js['S'])); worst_abs=max(worst_abs,err); worst_rel=max(worst_rel,err/max(mag,mpf(1)))
    tight.append((simple-b1,ms['name']))
check('every multiset is conjugation-invariant',asym==0,str(asym))
check('the pair sum is real on every multiset (|Im| < 1e-60)',worst_im<mpf('1e-60'),str(worst_im))
check('inequalities (2.4) and (2.5) hold on every multiset at 80 digits',viol==0,str(viol))
check('core.js pair sums agree with the oracle: relative error (scaled by sum of |terms|) < 1e-14',worst_rel<mpf('1e-14'),'abs '+str(worst_abs)+' rel '+str(worst_rel))
tight.sort(key=lambda t:t[0])
print('   tightest slacks:',[(str(mp.nstr(s,6)),n) for s,n in tight[:4]])
ctrl={ms['name']:ms['r']['S'] for ms in D['multisets'] if ms['name'].startswith('control')}
check('translation, reflection and permutation leave S unchanged (core.js)',
      max(abs(ctrl['control: translated +3.7']-ctrl['control: base of the three']),abs(ctrl['control: reflected']-ctrl['control: base of the three']),abs(ctrl['control: permuted']-ctrl['control: base of the three']))<1e-9)
print('\n%s (%d points across all multisets)'%('ORACLE PASS' if not fail else 'ORACLE FAIL %d'%fail,n_pts))
sys.exit(1 if fail else 0)
