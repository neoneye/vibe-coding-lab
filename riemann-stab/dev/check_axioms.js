'use strict';
// Fail-closed axiom whitelist audit.
// Usage: node check_axioms.js <axioms-output-file>
// Exits 1 unless every audited theorem's axiom set is a subset of
// {propext, Quot.sound} (mixture_snapshot must be axiom-free) and all
// expected theorem names are present.
const fs=require('fs'), path=require('path');
const out=fs.readFileSync(process.argv[2],'utf8');
const EXPECT={
  chain_inequality:['propext','Quot.sound'],
  headline_fraction_floor:['propext','Quot.sound'],
  headline_fraction_ceiling:['propext','Quot.sound'],
  improvement_direction:['propext','Quot.sound'],
  mixture_snapshot:[]
};
let bad=0;
for(const name of Object.keys(EXPECT)){
  const line=out.split('\n').find(l=>l.includes(`'${name}'`));
  if(!line){ bad++; console.error('MISSING',name); continue; }
  if(/does not depend on any axioms/.test(line)){
    if(EXPECT[name].length>0){ bad++; console.error('UNEXPECTED AXIOM-FREE',name); }
    else console.log('axiom-free:',name);
    continue;
  }
  const m=line.match(/\[(.*)\]/);
  if(!m){ bad++; console.error('UNPARSEABLE',name,line); continue; }
  const set=m[1].split(',').map(s=>s.trim());
  const extra=set.filter(a=>!['propext','Quot.sound'].includes(a));
  if(extra.length){ bad++; console.error('FORBIDDEN',name,extra.join(',')); }
  else console.log('ok:',name,'->',set.join(','));
}
if(/sorryAx|native_decide/.test(out)){ bad++; console.error('FORBIDDEN TOKEN in output'); }
process.exit(bad?1:0);
