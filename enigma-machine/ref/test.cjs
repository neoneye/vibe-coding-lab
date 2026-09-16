'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length,2);
scripts.forEach(script => new vm.Script(script));
const context = vm.createContext({console});
vm.runInContext(scripts[0],context);
const run = code => vm.runInContext(code,context);
run(`
const base = {rotors:['I','II','III'],rings:'AAA',pos:'AAA',reflector:'B',plugs:''};
`);
assert.equal(run("new Enigma(base).process('AAAAA')"),'BDZGO');
assert.equal(run("new Enigma(base).process('HELLOWORLD')"),'ILBDAAMTAZ');
for (const result of run('verifyDemos()')) assert.ok(result.passed,result.name);
assert.equal(run("new Enigma({...DEMOS[0],pos:'FOL'}).process('PKPJXI')"),'ABLABL');
assert.equal(run("new Enigma({...DEMOS[4],rings:'AAEL',pos:'YOSZ'}).process(DEMOS[4].ct)"),run('clean(DEMOS[4].pt)'));
assert.equal(run("(() => { const m=new Enigma({...base,pos:'ADU'}); return [1,2,3].map(() => { m.step(); return m.windows(); }).join(','); })()"),'ADV,AEW,BFX');
assert.equal(run("(() => { const m=new Enigma({...base,rings:'XYZ',pos:'ADU'}); return [1,2,3].map(() => { m.step(); return m.windows(); }).join(','); })()"),'ADV,AEW,BFX');
for (const rotor of ['VI','VII','VIII']) {
  for (const notch of ['M','Z']) {
    assert.equal(run(`(() => { const m=new Enigma({...base,rotors:['I','II','${rotor}'],pos:'AA${notch}'}); m.step(); return m.windows(); })()`),notch==='M'?'ABN':'ABA');
  }
}
assert.equal(run("prepare('Grüße, café! 123','natural')"),'GRUESSECAFEXONETWOTHREE');
assert.equal(run("prepare('ab cd 12!? äß','raw')"),'ABCD');
assert.equal(run("prepare('你好','natural')"),'');
assert.equal(run("parseLetters('24 13 22',3,'Rings')"),'XMV');
assert.equal(run("parseLetters('01-02-26',3,'Rings')"),'ABZ');
assert.equal(run("parseLetters('a b c',3,'Rings')"),'ABC');
for (const value of ['00 01 02','27 01 01','AAA!','AA','1.5 2 3','01,02,']) assert.throws(() => run(`parseLetters(${JSON.stringify(value)},3,'Rings')`));
for (const value of ['AA','AB AC','AB BA','ABC','A1','AB,CD']) assert.throws(() => run(`plugboard(${JSON.stringify(value)})`));
assert.equal(run("plugboard('AB CD EF GH IJ KL MN OP QR ST UV WX YZ').length"),26);
assert.throws(() => run("new Enigma({...base,rotors:['I','I','III']})"));
assert.throws(() => run("new Enigma({...base,reflector:'BTHIN'})"));
assert.throws(() => run("new Enigma({...DEMOS[2],reflector:'B'})"));
assert.throws(() => run("new Enigma({...DEMOS[2],rotors:['I','II','III','IV']})"));
assert.equal(run("new Enigma(base).process('')"),'');
const reference = JSON.parse(execFileSync('python3',['-B','-c',`
import json, random
from enigma_ref import Enigma, A, msgs, clean
random.seed(1930)
vectors = []
for index in range(120):
    names = random.sample(['I','II','III','IV','V','VI','VII','VIII'],3)
    naval = index % 2 == 0
    if naval:
        names.insert(0,random.choice(['BETA','GAMMA']))
    rings = ''.join(random.choices(A,k=len(names)))
    pos = ''.join(random.choices(A,k=len(names)))
    reflector = random.choice(['BTHIN','CTHIN'] if naval else ['A','B','C'])
    letters = random.sample(list(A),26)
    plugs = ' '.join(''.join(letters[i:i+2]) for i in range(0,2*(index%14),2))
    text = ''.join(random.choices(A,k=1000))
    machine = Enigma(names,rings,reflector,plugs,pos)
    output = machine.process(text)
    vectors.append(dict(settings=dict(rotors=names,rings=rings,pos=pos,reflector=reflector,plugs=plugs),text=text,output=output,windows=''.join(A[p] for p in machine.pos)))
print(json.dumps(dict(vectors=vectors,messages=[dict(ct=clean(m['ct']),pt=clean(m['pt'])) for m in msgs])))
`],{cwd:__dirname,encoding:'utf8',maxBuffer:1024*1024}));
reference.messages.forEach((message,i) => {
  assert.equal(run(`clean(DEMOS[${i}].ct)`),message.ct);
  assert.equal(run(`clean(DEMOS[${i}].pt)`),message.pt);
});
for (const vector of reference.vectors) {
  context.vector = vector;
  const result = run('(() => { const m=new Enigma(vector.settings); return {output:m.process(vector.text),windows:m.windows()}; })()');
  assert.equal(result.output,vector.output);
  assert.equal(result.windows,vector.windows);
  assert.equal(run('new Enigma(vector.settings).process(vector.output)'),vector.text);
  assert.ok([...vector.text].every((c,i) => c!==result.output[i]));
  if (vector.settings.rotors.length===4) assert.equal(result.windows[0],vector.settings.pos[0]);
}
console.log('PASS: 5 historical fixtures, canonical vectors, double stepping, naval notches, validation, preparation, and 120 Python-reference comparisons.');
const elements = [];
class Element {
  constructor(tag) {
    this.tagName=tag; this.children=[]; this.value=''; this.textContent=''; this.className=''; this.dataset={}; this.listeners={}; this.attributes={}; this.hidden=false; this.disabled=false;
    this.classList={
      toggle:(name,force) => { const set=new Set(this.className.split(' ').filter(Boolean)); const on=force===undefined?!set.has(name):force; if(on) set.add(name); else set.delete(name); this.className=[...set].join(' '); },
      remove:name => this.classList.toggle(name,false),
      contains:name => this.className.split(' ').includes(name)
    };
    elements.push(this);
  }
  append(...nodes) { for (const node of nodes) { node.parent=this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children=[]; this.append(...nodes); }
  setAttribute(name,value) { this.attributes[name]=value; }
  addEventListener(name,listener) { (this.listeners[name] ||= []).push(listener); }
  async dispatch(name) { for(const listener of this.listeners[name]||[]) await listener({target:this}); }
  click() { if(!this.disabled) return this.dispatch('click'); }
  focus() { this.focused=true; }
  select() { this.selected=true; }
  after(node) { node.parent=this.parent; this.parent.children.splice(this.parent.children.indexOf(this)+1,0,node); }
  remove() { this.parent.children=this.parent.children.filter(node=>node!==this); elements.splice(elements.indexOf(this),1); }
}
for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
  const element=new Element(match[1]); element.id=match[2];
}
const get = id => elements.find(element=>element.id===id) || null;
new Element('p').append(get('demo-source'));
get('input').value='Hello world'; get('mode').value='natural'; get('grouping').value='5'; get('greek').value='BETA';
context.document={getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:selector=>elements.filter(element=>element.classList.contains(selector.slice(1)))};
context.navigator={};
run(scripts[1]);
(async () => {
  assert.equal(get('output').value,'ILBDA AMTAZ');
  assert.match(get('verification').textContent,/5 \/ 5 verified/);
  assert.equal(get('demos').children.length,5);
  assert.equal(elements.filter(e=>e.classList.contains('lamp')).length,26);
  assert.equal(elements.filter(e=>e.classList.contains('key')).length,26);
  for (let i=0;i<5;i++) {
    await get('demos').children[i].click();
    assert.equal(get('output').value.replaceAll(' ',''),reference.messages[i].pt);
    assert.match(get('status').textContent,/Verified against source plaintext/);
    assert.equal(get('rotors').children.length,i===2||i===4?4:3);
    await get('reverse').click();
    assert.equal(get('output').value.replaceAll(' ',''),reference.messages[i].ct);
  }
  await get('defaults').click(); await get('clear').click();
  assert.equal(get('output').value,''); assert.ok(get('copy').disabled);
  await elements.find(e=>e.classList.contains('key')&&e.textContent==='A').click();
  assert.equal(get('input').value,'A'); assert.equal(get('output').value,'B');
  get('plugs').value='AB AC'; await get('plugs').dispatch('input');
  assert.ok(get('status').classList.contains('error')); assert.equal(get('output').value,'');
  get('plugs').value=''; await get('plugs').dispatch('input');
  assert.equal(get('output').value,'B');
  get('model').value='M4'; await get('model').dispatch('change');
  assert.equal(get('positions').value,'AAAA'); assert.equal(get('rotors').children.length,4);
  get('model').value='M3'; await get('model').dispatch('change');
  assert.equal(get('positions').value,'AAA'); assert.equal(get('rotors').children.length,3);
  get('input').value='A'.repeat(100001); await get('input').dispatch('input');
  assert.ok(get('status').classList.contains('error'));
  get('input').value=''; await get('input').dispatch('input');
  assert.equal(get('output').value,'');
  get('input').value='hello'; await get('input').dispatch('input');
  await get('copy').click(); assert.ok(get('output').selected);
  let copied=''; context.navigator.clipboard={writeText:async text=>{copied=text;}};
  await get('copy').click(); assert.equal(copied,get('output').value);
  console.log('PASS: DOM smoke tests for initial render, all demo buttons, reverse, keyboard, clear, validation recovery, model switching, length limit and clipboard fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
