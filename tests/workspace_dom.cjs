// DOM integration tests; these do not claim to test browser layout or live AI quality.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = process.env.DOM_DEPENDENCY_ROOT
  ? createRequire(path.join(process.env.DOM_DEPENDENCY_ROOT, 'probe.cjs'))('jsdom')
  : require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../static/workspace.js'), 'utf8');
const base = 'https://testserver';
const fixtures = JSON.parse(fs.readFileSync(process.env.HTML_FIXTURE_PATH, 'utf8'));
let passed = 0;
async function environment(route, handler) {
  assert.ok(fixtures[route], 'A rendered FastAPI fixture is required');
  const dom = new JSDOM(fixtures[route], { url: base + route, runScripts: 'outside-only' });
  dom.window.fetch = handler;
  dom.window.AbortController = AbortController;
  dom.window.eval(script);
  return dom;
}
const response = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
async function complete(dom, target) {
  const element = dom.window.document.getElementById(target);
  for (let i = 0; i < 100; i++) {
    if (element.getAttribute('aria-busy') === 'false') return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Result did not finish rendering');
}
function submit(dom, id) {
  dom.window.document.getElementById(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}
async function run(name, callback) { await callback(); passed++; console.log('PASS ' + name); }
(async () => {
  await run('Question submits selected scope and renders untrusted text safely', async () => {
    let calls = 0;
    const dom = await environment('/?domain=Standards%20%26%20QMS&lang=ko&region=FDA', async (url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.domain, 'Standards & QMS'); assert.equal(body.target_region, 'FDA'); assert.equal(body.lang, 'ko');
      return response({ status: 'DRAFT', message: '<img src=x onerror=alert(1)>', claims: [{ statement: '<script>bad()</script>', quote: 'A supporting quote', source_id: 'a' }], sources: [{ id: 'a', title: 'Official source', url: 'https://www.fda.gov/', retrieval_status: 'RETRIEVED' }] });
    });
    const doc = dom.window.document;
    doc.getElementById('question').value = '<b>My question</b>';
    submit(dom, 'question-form'); submit(dom, 'question-form');
    await complete(dom, 'research-results');
    assert.equal(calls, 1);
    assert.equal(doc.querySelectorAll('#research-results img,#research-results script,#research-results b').length, 0);
    assert.match(doc.getElementById('research-results').textContent, /<script>bad\(\)<\/script>/);
    assert.equal(doc.querySelector('#question-form button').disabled, false);
    dom.window.close();
  });
  await run('HTTP failures clear loading state and permit retry', async () => {
    const dom = await environment('/', async () => response({ message: 'Provider is unavailable' }, false, 503));
    dom.window.document.getElementById('question').value = 'Test question';
    submit(dom, 'question-form'); await complete(dom, 'research-results');
    assert.match(dom.window.document.getElementById('research-results').textContent, /Provider is unavailable/);
    assert.equal(dom.window.document.querySelector('#question-form button').disabled, false);
    dom.window.close();
  });
  await run('Source-only result contains no invented conclusion', async () => {
    const dom = await environment('/', async () => response({ status: 'SOURCES_ONLY', message: 'AI unavailable', claims: [], sources: [] }));
    dom.window.document.getElementById('question').value = 'Test question';
    submit(dom, 'question-form'); await complete(dom, 'research-results');
    assert.match(dom.window.document.getElementById('research-results').textContent, /SOURCES ONLY/);
    assert.equal(dom.window.document.querySelectorAll('.claim').length, 0);
    dom.window.close();
  });
  await run('Domain and tool navigation retain selected context', async () => {
    const dom = await environment('/?domain=Animal%20%26%20Veterinary&lang=ja', async () => response({}));
    const doc = dom.window.document;
    doc.getElementById('region').value = 'PMDA';
    doc.getElementById('region').dispatchEvent(new dom.window.Event('change'));
    for (const link of doc.querySelectorAll('.tabs a,.domain-link')) {
      const params = new URL(link.href).searchParams;
      assert.equal(params.get('region'), 'PMDA'); assert.equal(params.get('lang'), 'ja');
    }
    const standards = [...doc.querySelectorAll('.domain-link')].find(link => link.textContent === 'Standards & QMS');
    assert.equal(new URL(standards.href).searchParams.get('domain'), 'Standards & QMS');
    dom.window.close();
  });
  await run('GMP review keeps unknown evidence and renders review actions', async () => {
    const dom = await environment('/gmp-core', async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.process_validation_age, null); assert.equal(body.has_hbel_pde, null);
      return response({ product_name: body.product_name, message: 'Evidence needed', checks: [{ topic: 'Process validation', action: 'Review the evidence' }] });
    });
    dom.window.document.getElementById('product').value = 'Example product';
    dom.window.document.getElementById('audit-region').value = 'FDA';
    submit(dom, 'audit-form'); await complete(dom, 'audit-results');
    assert.match(dom.window.document.getElementById('audit-results').textContent, /Review the evidence/);
    dom.window.close();
  });
  await run('Export planning renders returned checklist', async () => {
    const dom = await environment('/export-intelligence', async url => {
      assert.match(url, /category=COSMETIC/);
      return response({ message: 'Planning only', checklist: ['Confirm product scope'], sources: [] });
    });
    dom.window.document.getElementById('category').value = 'COSMETIC';
    dom.window.document.getElementById('export-region').value = 'FDA';
    submit(dom, 'export-form'); await complete(dom, 'export-results');
    assert.match(dom.window.document.getElementById('export-results').textContent, /Confirm product scope/);
    dom.window.close();
  });
  await run('GMP jurisdiction follows shared context in both directions', async () => {
    const dom = await environment('/gmp-core', async () => response({}));
    const doc = dom.window.document;
    assert.equal(doc.getElementById('audit-region').value, 'ALL');
    doc.getElementById('region').value = 'MFDS';
    doc.getElementById('region').dispatchEvent(new dom.window.Event('change'));
    assert.equal(doc.getElementById('audit-region').value, 'MFDS');
    doc.getElementById('audit-region').value = 'MHRA';
    doc.getElementById('audit-region').dispatchEvent(new dom.window.Event('change'));
    assert.equal(doc.getElementById('region').value, 'MHRA');
    assert.equal(new URL(dom.window.location.href).searchParams.get('region'), 'MHRA');
    dom.window.close();
  });
  await run('Export requires an explicit jurisdiction instead of silently using FDA', async () => {
    let calls = 0;
    const dom = await environment('/export-intelligence', async () => { calls++; return response({}); });
    submit(dom, 'export-form'); await complete(dom, 'export-results');
    assert.equal(calls, 0);
    assert.match(dom.window.document.getElementById('export-results').textContent, /Choose a target market/);
    dom.window.close();
  });
  console.log(`${passed} DOM integration checks passed. Visual layout and live provider quality were not tested by this suite.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
