import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Real local Auth + HTTP + PostgREST verification. No mocked auth, RLS or model.
// --ask explicitly invokes the configured real model and verifies its persistence.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.LOCAL_APP_URL || 'http://127.0.0.1:3200';
// Endpoints must stay loopback-only; this override only aligns the SSR cookie
// name when the loopback ports tunnel to a production host.
const publicCookieUrl = process.env.DAOFLOW_PUBLIC_SUPABASE_URL || url;
function cookieNameFor(value) { try { const ref = new URL(value).hostname.split('.')[0]; return ref ? `sb-${ref}-auth-token` : undefined; } catch { return undefined; } }
const cookieName = cookieNameFor(publicCookieUrl);
const results = [];
const runId = randomUUID();
function check(ok, name) { if (!ok) throw new Error(name); results.push({ assertion: name, status: 'PASS' }); }
function local(value) { return value && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname); }
async function api(user, path, method = 'GET', body, statuses = [200]) {
  const response = await fetch(origin + path, { method, headers: { 'content-type': 'application/json', ...(user ? { cookie: [...user.cookies].map(([n,v]) => `${n}=${v}`).join('; ') } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000), redirect: 'error' });
  const text = await response.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`${method} ${path}: non-JSON HTTP ${response.status}`); }
  check(statuses.includes(response.status), `${method} ${path}: HTTP ${response.status}, expected ${statuses.join('/')}${data?.error?.code ? ' code=' + data.error.code : ''}${data?.error?.message ? ' message=' + data.error.message : ''}`);
  return { data, status: response.status, headers: response.headers };
}
async function main() {
  check(local(url) && local(origin) && key && serviceKey, 'Only loopback local services with injected credentials');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function fixture(label) {
    const email = `functions-${runId}-${label}@example.test`, password = randomUUID() + 'aA1!';
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(!made.error && made.data.user, `fixture ${label}: real Auth user created`);
    const cookies = new Map();
    const client = createServerClient(url, key, { ...(cookieName ? { cookieOptions: { name: cookieName } } : {}), cookies: { getAll: () => [...cookies].map(([name,value]) => ({name,value})), setAll: rows => rows.forEach(({name,value}) => cookies.set(name,value)) } });
    const signed = await client.auth.signInWithPassword({ email, password });
    check(!signed.error && signed.data.session && signed.data.user.id === made.data.user.id, `fixture ${label}: real password sign-in and JWT`);
    return { id: made.data.user.id, client, cookies };
  }
  const a = await fixture('a'), b = await fixture('b');
  // Fixture users intentionally remain in isolated local DB for independent review.
  await api(null, '/api/journal/entries', 'GET', undefined, [401]);
  let volume = (await api(a, '/api/journal/volumes', 'POST', {id:randomUUID(),title:'虚构验收卷册'}, [201])).data.volume;
  let entry = (await api(a, '/api/journal/entries', 'POST', {id:randomUUID(),title:'虚构心笺',body:'虚构验收正文 初稿',mood:'calm',volumeId:volume.id}, [201])).data.entry;
  check(entry.version === 1 && entry.volumeId === volume.id, 'entry create: persisted version and volume link');
  check((await api(a, `/api/journal/entries/${entry.id}`)).data.entry.body === entry.body, 'entry read-after-write');
  await api(b, `/api/journal/entries/${entry.id}`, 'GET', undefined, [404]);
  await api(b, `/api/journal/entries/${entry.id}`, 'PATCH', {version:1,body:'越权改写'}, [404]);
  await api(b, `/api/journal/volumes/${volume.id}`, 'GET', undefined, [404]);
  await api(b, `/api/journal/volumes/${volume.id}`, 'PATCH', {version:1,title:'越权改写'}, [404]);
  await api(b, '/api/journal/entries', 'POST', {id:randomUUID(),body:'越权关联',volumeId:volume.id}, [404]);
  const edits = await Promise.all(['虚构验收正文 版本甲','虚构验收正文 版本乙'].map(body => api(a, `/api/journal/entries/${entry.id}`, 'PATCH', {version:1,body}, [200,409])));
  check(edits.filter(x=>x.status===200).length===1 && edits.filter(x=>x.status===409).length===1, 'concurrent entry CAS exactly one winner');
  entry = edits.find(x=>x.status===200).data.entry;
  check(entry.version===2, 'entry edit increments version exactly once');
  check((await api(a,'/api/journal/entries?q='+encodeURIComponent('虚构验收正文'))).data.items.some(x=>x.id===entry.id),'Chinese body search finds persisted entry');
  const idem = {id:randomUUID(),body:'并发幂等虚构正文'};
  const retries = await Promise.all([api(a,'/api/journal/entries','POST',idem,[200,201]),api(a,'/api/journal/entries','POST',idem,[200,201])]);
  check(retries.every(x=>x.data.entry.id===idem.id),'concurrent entry idempotency returns same ID');
  await api(a,'/api/journal/entries','POST',{...idem,body:'不同正文'},[409]);
  const page = (await api(a,'/api/journal/entries?limit=1')).data;
  check(page.items.length===1 && page.nextCursor,'entries pagination produces cursor');
  const page2 = (await api(a,'/api/journal/entries?limit=1&cursor='+encodeURIComponent(page.nextCursor))).data;
  check(page2.items.length===1 && page2.items[0].id!==page.items[0].id,'entries pagination has no repeated first item');
  entry = (await api(a,`/api/journal/entries/${entry.id}`,'PATCH',{version:entry.version,deleted:true})).data.entry;
  check(entry.deletedAt && (await api(a,'/api/journal/entries?filter=trash')).data.items.some(x=>x.id===entry.id),'soft delete enters trash');
  check(!(await api(a,'/api/journal/entries')).data.items.some(x=>x.id===entry.id),'soft delete leaves active list');
  entry = (await api(a,`/api/journal/entries/${entry.id}`,'PATCH',{version:entry.version,deleted:false})).data.entry;
  check(entry.deletedAt===null,'restore clears deletedAt');
  await api(a,`/api/journal/entries/${entry.id}`,'DELETE',{version:entry.version},[409]);
  await api(a,'/api/journal/preferences','PATCH',{lastVolumeId:volume.id});
  check((await api(a,'/api/journal/preferences')).data.lastVolumeId===volume.id,'last volume preference persists');
  await api(b,'/api/journal/preferences','PATCH',{lastVolumeId:volume.id},[404]);
  volume=(await api(a,`/api/journal/volumes/${volume.id}`,'PATCH',{version:volume.version,title:'虚构验收卷册 改名'})).data.volume;
  check(volume.title==='虚构验收卷册 改名','volume rename persists');
  const chapters = await a.client.from('chapters').select('id,original_text').eq('id',1).single();
  check(!chapters.error && chapters.data?.original_text,'trusted chapter fixture exists in real DB');
  const favoriteInput = {id:randomUUID(),chapterId:1,excerpt:chapters.data.original_text.slice(0,8),note:'虚构批注初稿'};
  let favorite=(await api(a,'/api/journal/favorites','POST',favoriteInput,[200,201])).data.favorite;
  const duplicate=(await api(a,'/api/journal/favorites','POST',{...favoriteInput,id:randomUUID()},[200,201])).data.favorite;
  check(duplicate.id===favorite.id,'favorite deduplicates same chapter and excerpt');
  await api(b,`/api/journal/favorites/${favorite.id}`,'PATCH',{version:favorite.version,note:'越权'},[404]);
  await api(b,`/api/journal/favorites/${favorite.id}`,'DELETE',{version:favorite.version},[404]);
  favorite=(await api(a,`/api/journal/favorites/${favorite.id}`,'PATCH',{version:favorite.version,note:'虚构批注修改'})).data.favorite;
  check(favorite.note==='虚构批注修改' && favorite.version===2,'favorite annotation versioned update');
  await api(a,`/api/journal/favorites/${favorite.id}`,'PATCH',{version:1,note:'旧版'},[409]);
  await api(a,'/api/journal/favorites','POST',{...favoriteInput,id:randomUUID(),excerpt:'不在经典中的虚构句子'},[400]);
  for (const table of ['journal_entries','journal_volumes','journal_preferences','journal_favorites','journal_ask_requests','ask_sessions']) {
    const read=await b.client.from(table).select('*').eq('user_id',a.id);
    check(!read.error && read.data.length===0,`${table}: user B JWT cannot read user A rows`);
    for (const operation of ['insert','update','delete']) {
      const query=operation==='insert'?a.client.from(table).insert({user_id:a.id}):operation==='update'?a.client.from(table).update({user_id:b.id}).eq('user_id',a.id):a.client.from(table).delete().eq('user_id',a.id);
      const denied=await query;
      check(denied.error?.code==='42501',`${table}: direct authenticated ${operation} denied by privilege`);
    }
  }
  const deniedRpc=await a.client.rpc('claim_ask_request',{p_user_id:a.id,p_request_id:randomUUID(),p_question:'虚构'});
  check(deniedRpc.error?.code==='42501','authenticated cannot invoke service-only claim RPC');
  if (process.argv.includes('--ask')) {
    const payload={question:'这是虚构验收情境：面对工作中的急躁，怎样慢下来？',requestId:randomUUID(),sourceEntryId:entry.id,volumeId:volume.id};
    await api(b,'/api/ask','POST',payload,[404]);
    const parallel=await Promise.all([api(a,'/api/ask','POST',payload,[200,202]),api(a,'/api/ask','POST',payload,[200,202])]);
    check(parallel.some(x=>x.status===200),'real ask concurrent generation completes');
    const answer=(await api(a,'/api/ask','POST',payload)).data;
    check(answer.meta?.persistence==='saved' && answer.sessionId,'ask result persisted and idempotent retry returns session');
    check(answer.meta?.degraded===false && answer.meta?.provider==='agnes','ask actually used non-degraded Agnes model');
    const saved=await a.client.from('ask_sessions').select('*').eq('request_id',payload.requestId);
    check(!saved.error && saved.data.length===1 && saved.data[0].id===answer.sessionId && saved.data[0].source_entry_id===entry.id && saved.data[0].volume_id===volume.id,'exactly one authoritative ask session with owned links');
    const retry=(await api(a,`/api/journal/ask-requests/${payload.requestId}/retry-save`,'POST',{})).data;
    check(retry.sessionId===answer.sessionId,'retry-save preserves same session ID');
    await api(a,'/api/ask','POST',{...payload,question:'不同问题'},[409]);
    await api(b,`/api/journal/ask-requests/${payload.requestId}`,'GET',undefined,[404]);
    await api(b,`/api/journal/ask-requests/${payload.requestId}/retry-save`,'POST',{},[404]);
    const hidden=await b.client.from('ask_sessions').select('id').eq('id',answer.sessionId);
    check(!hidden.error && hidden.data.length===0,'saved ask row RLS isolation after actual generation');
    check((await api(a,`/api/journal/volumes/${volume.id}/timeline`)).data.items.some(x=>x.id===answer.sessionId && x.type==='ask'),'volume timeline includes saved ask');
    check((await api(a,'/api/journal/timeline?kind=ask&q='+encodeURIComponent('急躁'))).data.items.some(x=>x.id===answer.sessionId),'ask question search finds saved session');
    check((await api(a,'/api/journal/export')).data.askSessions.some(x=>x.id===answer.sessionId && x.sourceEntryId===entry.id && x.response===answer.interpretation),'export contains exact saved model answer and source link');
  } else results.push({assertion:'Real model and ask persistence (rerun with --ask)',status:'NOT_EXECUTED'});
  volume=(await api(a,`/api/journal/volumes/${volume.id}`,'PATCH',{version:volume.version,archived:true})).data.volume;
  check(volume.archivedAt,'volume archive persisted');
  check((await api(a,'/api/journal/preferences')).data.lastVolumeId===null,'archived volume no longer suggested');
  await api(a,'/api/journal/entries','POST',{id:randomUUID(),body:'归档卷不可新关联',volumeId:volume.id},[404]);
  check((await api(a,`/api/journal/volumes/${volume.id}/timeline`)).data.items.some(x=>x.id===entry.id),'archival retains volume timeline');
  const exported=await api(a,'/api/journal/export');
  check(exported.headers.get('content-disposition')?.includes('attachment'),'export delivered as file attachment');
  check(exported.data.entries.some(x=>x.id===entry.id && x.body===entry.body) && exported.data.favorites.some(x=>x.id===favorite.id && x.note===favorite.note) && exported.data.volumes.some(x=>x.id===volume.id && x.archivedAt),'export snapshot preserves entry, annotation and archive');
  const other=(await api(b,'/api/journal/export')).data;
  check(other.entries.length===0 && other.volumes.length===0 && other.favorites.length===0 && other.askSessions.length===0,'other user export contains no private fixture data');
  await api(a,'/api/journal/export?from=2026-01-02&to=2026-01-01','GET',undefined,[400]);
  await api(a,`/api/journal/favorites/${favorite.id}`,'DELETE',{version:favorite.version},[204]);
  check(!(await api(a,'/api/journal/favorites')).data.items.some(x=>x.id===favorite.id),'favorite cancellation persists');
  let purge=(await api(a,`/api/journal/entries/${idem.id}`,'PATCH',{version:1,deleted:true})).data.entry;
  await api(a,`/api/journal/entries/${purge.id}`,'DELETE',{version:purge.version});
  await api(a,`/api/journal/entries/${purge.id}`,'GET',undefined,[404]);
}
let failure;
try { await main(); } catch(error) { failure = error instanceof Error ? error.message : 'Unknown verification failure'; results.push({assertion:failure,status:'FAIL'}); process.exitCode=1; }
console.log(JSON.stringify({runId,timestamp:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'loopback-local-real-auth-http-postgrest',status:failure?'FAIL':results.some(x=>x.status==='NOT_EXECUTED')?'PARTIAL':'PASS',results},null,2));
