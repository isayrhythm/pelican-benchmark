import { DurableObject } from 'cloudflare:workers';
import { WORK_IDS } from './works.js';

const reactions = ["like","love","clap","laugh","wow","sweat-smile","sweat","cry","think","fire","eyes","skull","smile","grin","rolling-laugh","joy","wink","cool","heart-eyes","party","facepalm","shrug","upside-down","neutral","unamused","eye-roll","pleading","sob","angry","scream","sleep","robot","poop","thumbs-down","hundred","rocket"];
const validVisitor = value => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
const allowedOrigin = origin => origin === 'https://isayrhythm.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
function cors(response, origin) {
  const headers = new Headers(response.headers);
  if (allowedOrigin(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {status: response.status, headers});
}
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const respond = (value, status) => cors(json(value, status), origin);
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return respond({ok: true, service: 'pelican-benchmark-reactions'});
    if (!allowedOrigin(origin)) return respond({error: 'Origin not allowed'}, 403);
    if (request.method === 'OPTIONS') return cors(new Response(null, {status: 204}), origin);
    if (url.pathname !== '/reactions') return respond({error: 'Not found'}, 404);
    if (!['GET', 'POST'].includes(request.method)) return respond({error: 'Method not allowed'}, 405);
    try {
      // Rate limits run before storage access. IPs are not saved to the database.
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await env.IP_LIMIT.limit({key: ip})).success) return respond({error: '请求过于频繁，请一分钟后再试'}, 429);
      let payload;
      if (request.method === 'POST') {
        if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return respond({error: 'JSON required'}, 415);
        if (Number(request.headers.get('Content-Length') || 0) > 2048) return respond({error: 'Body too large'}, 413);
        // Bound streamed bodies too, rather than trusting Content-Length.
        const reader = request.body?.getReader();
        if (!reader) return respond({error: 'Invalid JSON'}, 400);
        let size = 0, text = ''; const decoder = new TextDecoder();
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 2048) {await reader.cancel(); return respond({error: 'Body too large'}, 413)}
          text += decoder.decode(value, {stream: true});
        }
        try {payload = JSON.parse(text + decoder.decode())} catch {return respond({error: 'Invalid JSON'}, 400)}
        if (!payload || !WORK_IDS.includes(payload.workId) || !reactions.includes(payload.reaction) || typeof payload.active !== 'boolean') return respond({error: 'Invalid reaction'}, 400);
      } else payload = {visitorId: url.searchParams.get('visitorId')};
      if (!validVisitor(payload.visitorId)) return respond({error: 'Invalid visitor ID'}, 400);
      const visitor = await hash(payload.visitorId);
      if (!(await env.VISITOR_LIMIT.limit({key: visitor})).success) return respond({error: '请求过于频繁，请一分钟后再试'}, 429);
      const store = env.REACTIONS.getByName('pelican-gallery-v1');
      const result = request.method === 'GET' ? await store.summary(visitor) : await store.setReaction(visitor, payload.workId, payload.reaction, payload.active);
      return respond(result);
    } catch {
      return respond({error: '点赞服务暂时不可用，请稍后重试'}, 503);
    }
  }
};

export class ReactionStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS votes (
      visitor TEXT NOT NULL, work TEXT NOT NULL, reaction TEXT NOT NULL,
      PRIMARY KEY(visitor, work, reaction)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS counts (
      work TEXT NOT NULL, reaction TEXT NOT NULL, total INTEGER NOT NULL CHECK(total >= 0),
      PRIMARY KEY(work, reaction)
    ) WITHOUT ROWID;`);
  }
  summary(visitor) {
    const works = Object.fromEntries(WORK_IDS.map(id => [id, {counts: Object.fromEntries(reactions.map(r => [r, 0])), selected: []}]));
    for (const row of this.sql.exec('SELECT work, reaction, total FROM counts')) {
      if (works[row.work]) works[row.work].counts[row.reaction] = row.total;
    }
    for (const row of this.sql.exec('SELECT work, reaction FROM votes WHERE visitor = ?', visitor)) {
      if (works[row.work]) works[row.work].selected.push(row.reaction);
    }
    return {works};
  }
  setReaction(visitor, work, reaction, active) {
    if (!WORK_IDS.includes(work) || !reactions.includes(reaction) || typeof active !== 'boolean') throw new Error('Invalid reaction');
    // Idempotent desired-state updates: retries cannot add duplicate votes.
    this.ctx.storage.transactionSync(() => {
      const exists = this.sql.exec('SELECT 1 FROM votes WHERE visitor=? AND work=? AND reaction=?', visitor, work, reaction).toArray().length > 0;
      if (exists === active) return;
      if (active) {
        this.sql.exec('INSERT INTO votes VALUES (?, ?, ?)', visitor, work, reaction);
        this.sql.exec('INSERT INTO counts VALUES (?, ?, 1) ON CONFLICT(work, reaction) DO UPDATE SET total=total+1', work, reaction);
      } else {
        this.sql.exec('DELETE FROM votes WHERE visitor=? AND work=? AND reaction=?', visitor, work, reaction);
        this.sql.exec('UPDATE counts SET total=total-1 WHERE work=? AND reaction=?', work, reaction);
      }
    });
    const counts = Object.fromEntries(reactions.map(r => [r, 0]));
    for (const row of this.sql.exec('SELECT reaction, total FROM counts WHERE work=?', work)) counts[row.reaction] = row.total;
    const selected = this.sql.exec('SELECT reaction FROM votes WHERE visitor=? AND work=?', visitor, work).toArray().map(row => row.reaction);
    return {workId: work, counts, selected};
  }
}
