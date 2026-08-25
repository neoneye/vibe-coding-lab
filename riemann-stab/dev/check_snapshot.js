const fs=require('fs'),path=require('path');
const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'pins.golden.json'),'utf8'));
const lsrc=fs.readFileSync(path.join(__dirname,'lean','ZetaClaims.lean'),'utf8');
function lit(name){
  const m=lsrc.match(new RegExp('abbrev '+name+' : Int := (\\d+)'));
  if(!m) throw new Error('literal missing: '+name);
  return BigInt(m[1]);
}
let bad=0;
for(const [name,val,pin] of [['XScaled',lit('XScaled'),Math.round(pins.X*1e10)],
                             ['YScaled',lit('YScaled'),Math.round(pins.Y*1e10)],
                             ['MScaled',lit('MScaled'),Math.round(pins.M*1e10)]]){
  if(val!==BigInt(pin)){console.error('SNAPSHOT DRIFT',name,val,'vs golden-scaled',pin);process.exit(1);}
  console.log('coupling OK:',name,'=',val.toString());
}
console.log('snapshot literals match golden pins (scale 1e10)');
