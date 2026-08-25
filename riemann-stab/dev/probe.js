'use strict';
const M=require('./core.js');
// probe 1: gram point mystery
console.log('theta(20.65049407626087)=',M.theta(20.65049407626087),'target pi=',Math.PI);
console.log('theta(23.17028270124629)=',M.theta(23.17028270124629));
console.log('theta(23.32149151881886)=',M.theta(23.32149151881886));
console.log('theta(3)=',M.theta(3),' theta(5)=',M.theta(5),' theta(9)=',M.theta(9),' theta(14)=',M.theta(14));
// probe 2: emzeta at negative sigma
for(const s of [{re:-0.5,im:-23.4},{re:-0.3,im:41.7}]){
  for(const N of [40,80,160,320,640]){
    const v=M.emzetaRaw(s,N,16);
    console.log(`emzetaRaw(${s.re},${s.im}) N=${N}: ${v.re.toFixed(12)} ${v.im.toFixed(12)}`);
  }
}
// probe 3: logGamma(1+i)
const lg=M.logGamma({re:1,im:1});
console.log('logGamma(1+i)=',lg,'expected re=',Math.log(Math.hypot(0.498015668,0.154949828)));
console.log('arg=',lg.im,'expected atan2(-0.154949828,0.498015668)=',Math.atan2(-0.154949828,0.498015668));
// probe 4: chi at real value
console.log('chi(0.5)=',M.chi({re:0.5,im:0}));
console.log('chi(3)=',M.chi({re:3,im:0}),'expected 2^3 pi^2 sin(1.5pi) Gamma(-2)/...',Math.pow(2,3)*Math.pow(Math.PI,2)*Math.sin(1.5*Math.PI)/24*-1);
