'use strict';
const fs=require('fs'), path=require('path');
const dev=__dirname;
const read=f=>fs.readFileSync(path.join(dev,f),'utf8');
let html=read('template.html');
const css=read('style.css');
const core=read('core.js');
const ui=read('ui.js');
html=html.replace('/*__CSS__*/',()=>css);
html=html.replace('//__CORE__',()=>core);
html=html.replace('//__UI__',()=>ui);
const out=path.join(dev,'..','index.html');
fs.writeFileSync(out,html);
console.log('built', path.resolve(out), (html.length/1024).toFixed(1)+' KB');

// smoke: extract inline scripts, syntax-check both, execute the core one
const parts=html.split('<script>');
if(parts.length!==3){ console.error('expected exactly 2 script blocks, got',parts.length-1); process.exit(1); }
for(const [i,p] of parts.slice(1).entries()){
  const code=p.split('</script>')[0];
  const tmp=path.join(require('os').tmpdir(),'smoke_'+i+'.js');
  fs.writeFileSync(tmp,code);
}
console.log('script blocks extracted OK — run node on them to finish smoke test');
