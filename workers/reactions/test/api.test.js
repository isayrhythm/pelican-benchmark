import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {WORK_IDS} from '../src/works.js';

// Tests deliberately accept only a loopback server, never the live database.
const base = process.env.TEST_API || 'http://127.0.0.1:8791';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Tests require localhost');
const origin = 'http://127.0.0.1:8765';
async function call(path, init={}) {
  return fetch(base + path, {...init, headers:{Origin:origin, ...init.headers}});
}
const summary = async visitor => (await call('/reactions?visitorId='+visitor)).json();
const vote = (visitorId, workId, reaction, active) => call('/reactions', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({visitorId,workId,reaction,active})});

test('backend catalog matches gallery work IDs', ()=>{
  const html=readFileSync(new URL('../../../index.html',import.meta.url),'utf8');
  const ids=[...html.matchAll(/file:'svgs\/([^']+)\.html'/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(WORK_IDS,ids);
});

test('emoji reactions persist, deduplicate and cancel atomically', async()=>{
  const a=randomUUID(),b=randomUUID(),work=WORK_IDS[0],reaction='sweat-smile';
  const initial=(await summary(a)).works[work].counts[reaction];
  try{
    assert.equal((await vote(a,work,reaction,true)).status,200);
    assert.equal((await vote(a,work,reaction,true)).status,200);
    assert.equal((await summary(a)).works[work].counts[reaction],initial+1);
    assert.deepEqual((await summary(a)).works[work].selected,[reaction]);
    assert.deepEqual((await summary(b)).works[work].selected,[]);
    const responses=await Promise.all([vote(b,work,reaction,true),vote(b,work,reaction,true),vote(b,work,reaction,true)]);
    responses.forEach(r=>assert.equal(r.status,200));
    assert.equal((await summary(a)).works[work].counts[reaction],initial+2);
    await vote(a,work,reaction,false);await vote(a,work,reaction,false);
    assert.equal((await summary(a)).works[work].counts[reaction],initial+1);
    assert.deepEqual((await summary(a)).works[work].selected,[]);
    assert.equal((await vote(a,work,'invented',true)).status,400);
    assert.equal((await vote(a,'unknown-work',reaction,true)).status,400);
    assert.equal((await vote('not-a-uuid',work,reaction,true)).status,400);
  }finally{await vote(a,work,reaction,false);await vote(b,work,reaction,false)}
  assert.equal((await summary(a)).works[work].counts[reaction],initial);
});
test('CORS, methods and input bounds', async()=>{
  const result=await call('/reactions?visitorId='+randomUUID());
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal((await fetch(base+'/reactions',{headers:{Origin:'https://evil.example'}})).status,403);
  const preflight=await call('/reactions',{method:'OPTIONS'});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Max-Age'),'86400');
  assert.equal((await call('/reactions',{method:'DELETE'})).status,405);
  assert.equal((await call('/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{oops'})).status,400);
  assert.equal((await call('/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(3000)})).status,413);
});
test('visitor rate limit protects storage', async()=>{
  const id=randomUUID();let limited=false;
  for(let i=0;i<65;i++){const response=await call('/reactions?visitorId='+id);if(response.status===429){limited=true;break}}
  assert.equal(limited,true);
});
