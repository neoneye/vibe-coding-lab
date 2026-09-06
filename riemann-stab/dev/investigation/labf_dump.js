'use strict';
// Dump the page's Lamzouri kernel values and Proposition 2.1 pair sums on a
// fixed battery plus seeded random multisets, for the independent mpmath
// oracle in labf_oracle.py.  Output: investigation/labf_dump.json.
const fs=require('fs'), path=require('path');
const M=require('../core.js');
const out={kernel:[], multisets:[]};
const pts=[{re:0,im:0},{re:0.3,im:0},{re:1/(Math.SQRT2*Math.PI),im:0},{re:-1/(Math.SQRT2*Math.PI),im:0},
  {re:1/(Math.SQRT2*Math.PI)+1e-9,im:0},{re:0,im:0.2},{re:0,im:0.4},{re:0.7,im:0.3},{re:0.7,im:-0.3},
  {re:2.5,im:0},{re:12.25,im:0},{re:0,im:1.5},{re:3,im:2},{re:1e-7,im:0},{re:0,im:1e-7}];
for(const z of pts){ const k=M.lamzouriKernelC(z); out.kernel.push({z,k,kreal:z.im===0?M.lamzouriKernel(z.re):null}); }
function add(name,points){ const r=M.lamzouriMultiset(points); out.multisets.push({name,points,r}); }
add('one simple real',[{re:3.1,im:0,m:1}]);
add('one double real',[{re:3.1,im:0,m:2}]);
add('one triple real',[{re:0,im:0,m:3}]);
add('isolated conjugate pair',[{re:1,im:0.25,m:1},{re:1,im:-0.25,m:1}]);
add('conjugate pair, multiplicity 2',[{re:1,im:0.25,m:2},{re:1,im:-0.25,m:2}]);
add('two distant reals',[{re:0,im:0,m:1},{re:400,im:0,m:1}]);
add('close cluster',[{re:0,im:0,m:1},{re:1e-3,im:0,m:1},{re:2e-3,im:0,m:1},{re:0.05,im:0,m:1}]);
add('unequal multiplicities',[{re:0,im:0,m:1},{re:1.3,im:0,m:2},{re:2.1,im:0,m:3},{re:4,im:0,m:1}]);
add('repeated pairs, small y',[{re:0,im:1e-4,m:1},{re:0,im:-1e-4,m:1},{re:2,im:1e-4,m:1},{re:2,im:-1e-4,m:1}]);
add('large imaginary parts',[{re:0,im:1.5,m:1},{re:0,im:-1.5,m:1},{re:1,im:0,m:1}]);
add('mixed',[{re:0,im:0,m:1},{re:0.9,im:0,m:2},{re:1.7,im:0.3,m:1},{re:1.7,im:-0.3,m:1},{re:5,im:0,m:1}]);
for(let seed=1;seed<=1000;seed++){ const p=M.randomLamzouriMultiset(seed); add('random seed '+seed,p); }
// translation / reflection / permutation controls on one multiset
const base=M.randomLamzouriMultiset(77);
add('control: translated +3.7',base.map(q=>({re:q.re+3.7,im:q.im,m:q.m})));
add('control: reflected',base.map(q=>({re:-q.re,im:q.im,m:q.m})));
add('control: permuted',base.slice().reverse());
add('control: base of the three',base);
fs.writeFileSync(path.join(__dirname,'labf_dump.json'),JSON.stringify(out));
console.log('dumped',out.kernel.length,'kernel points and',out.multisets.length,'multisets');
