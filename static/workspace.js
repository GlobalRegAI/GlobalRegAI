'use strict';
const $ = (id) => document.getElementById(id);
const ui = JSON.parse(document.body.dataset.ui || '{}');
const tr = text => ui[text] || text;
const page = document.body.dataset.page;
const domain = document.body.dataset.domain;
const initialLang = document.body.dataset.lang;
const region = $('region');
const queryParams = new URLSearchParams(location.search);
if ([...region.options].some(option => option.value === queryParams.get('region'))) region.value = queryParams.get('region');
function retainContext() {
  const url = new URL(location.href);
  url.searchParams.set('region', region.value);
  url.searchParams.set('lang', $('answer-language').value);
  history.replaceState(null, '', url);
  document.querySelectorAll('.tabs a,.domain-link').forEach(link => {
    const target = new URL(link.href);
    target.searchParams.set('region', region.value);
    target.searchParams.set('lang', $('answer-language').value);
    link.href = target.toString();
  });
}
region.addEventListener('change', retainContext);
// Keep tool-specific jurisdiction controls consistent with the shared context.
const toolRegions = ['audit-region', 'export-region'].map($).filter(Boolean);
function syncToolRegions() {
  for (const select of toolRegions) {
    if (![...select.options].some(option => option.value === 'ALL')) {
      const placeholder = document.createElement('option');
      placeholder.value = 'ALL'; placeholder.textContent = tr('Choose a jurisdiction');
      placeholder.disabled = true; select.prepend(placeholder);
    }
    select.value = region.value;
  }
}
for (const select of toolRegions) select.addEventListener('change', () => {
  region.value = select.value; retainContext(); syncToolRegions();
});
region.addEventListener('change', syncToolRegions);
syncToolRegions();
$('answer-language').addEventListener('change', () => { retainContext(); location.reload(); });
retainContext();
if ($('category')) {
  const categories = {'Pharmaceuticals':'PHARMA','Medical Devices':'DEVICE','Cosmetics':'COSMETIC','Food Safety':'FOOD','Chemicals':'CHEMICAL'};
  $('category').value = categories[domain] || 'PHARMA';
}
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = tr(text);
  if (className) element.className = className;
  return element;
};
async function api(path, options = {}, timeout = 35000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, {credentials: 'same-origin', ...options, signal: controller.signal});
    const data = await response.json();
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : data.message;
      throw new Error(detail || (response.status === 422 ? 'Please check the required fields and input limits.' : 'Request failed. Please retry.'));
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(tr('The request timed out. No result was confirmed. Please retry.'));
    throw error;
  } finally { clearTimeout(timer); }
}
const post = (path, body) => api(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
function showError(target, error) {
  target.replaceChildren(node('h2','Unable to complete the request'), node('p',error.message,'error-message'));
}
function sourceLink(source) {
  const link = node('a', source.title);
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:') throw new Error('Invalid URL');
    link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  } catch (_) { return node('span', source.title); }
  return link;
}
function originalQuote(text) {
  const details = node('details'); details.append(node('summary', initialLang === 'ko' ? '원문 근거 확인' : 'View original evidence'), node('blockquote', text)); return details;
}
function renderSources(target, sources) {
  if (!sources.length) return;
  target.append(node('h3', 'Official sources'));
  for (const source of sources) {
    const card = node('div', undefined, 'source-card');
    card.append(sourceLink(source));
    if (source.format) card.append(node('p', source.format + (initialLang === 'ko' ? ' 원본 파일 · 번역본 아님' : ' original file'), 'source-meta'));
    if (source.retrieval_status) card.append(node('p', source.retrieval_status === 'RETRIEVED' ? 'Retrieved for this request' : 'Official navigation link — open the page to check current information', 'source-meta'));
    if (source.catalogue_reviewed_at) card.append(node('p', (initialLang === 'ko' ? '링크 확인일: ' : 'Directory reviewed: ')+source.catalogue_reviewed_at, 'source-meta'));
    if (source.excerpt) card.append(originalQuote(source.excerpt));
    if (source.retrieved_at) card.append(node('p', (initialLang === 'ko' ? '조회: ' : 'Retrieved: ')+new Date(source.retrieved_at).toLocaleString(), 'source-meta'));
    card.append(node('p', 'Effective date: not independently verified', 'source-meta'));
    target.append(card);
  }
}
function bindForm(id, targetId, callback) {
  const form = $(id);
  if (!form) return;
  let busy = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const target = $(targetId), button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    busy = true; button.disabled = true; button.textContent = tr('Working…');
    target.setAttribute('aria-busy', 'true');
    target.replaceChildren(node('p', 'Processing your request…', 'loading'));
    try { await callback(target); }
    catch (error) { showError(target, error); }
    finally { busy = false; button.disabled = false; button.textContent = label; target.setAttribute('aria-busy', 'false'); }
  });
}
bindForm('question-form', 'research-results', async target => {
  const question = $('question').value.trim();
  const selectedRegion = region.value;
  const data = await post('/api/search', {query:question,domain,target_region:selectedRegion,lang:$('answer-language').value});
  const card = node('article', undefined, 'card answer-card');
  card.append(node('span', data.status.replaceAll('_',' '), 'status-label'), node('h2',question), node('p', data.message, 'notice'));
  if (data.provider_status && data.provider_status !== 'RESPONDED') {
    card.append(node('p', 'AI service status: '+data.provider_status, 'source-meta'));
  }
  for (const claim of data.claims || []) {
    const block = node('div', undefined, 'claim');
    block.append(node('p', claim.statement, 'answer-text'), originalQuote(claim.quote));
    const source = (data.sources || []).find(item => item.id === claim.source_id);
    if (source) block.append(sourceLink(source));
    card.append(block);
  }
  renderSources(card, data.sources || []);
  for (const choice of data.choices || []) {
    const button = node('button', choice.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      region.value = choice.target_region;
      retainContext(); syncToolRegions();
      $('question').value = question;
      $('question-form').requestSubmit();
    });
    card.append(button);
  }
  target.replaceChildren(card);
});
bindForm('audit-form','audit-results', async target => {
  if ($('audit-region').value === 'ALL') throw new Error('Choose a target jurisdiction before creating a review list.');
  const age = $('pv-age').value;
  const data = await post('/api/audit/diagnose', {product_name:$('product').value.trim(), target_region:$('audit-region').value,
    has_hbel_pde:$('hbel').value === '' ? null : $('hbel').value === 'true', process_validation_age:age === '' ? null : Number(age),
    hvac_status:$('hvac').value, lang:$('answer-language').value});
  target.replaceChildren(node('span','Review required','status-label'), node('h2',data.product_name), node('p',data.message));
  for (const check of data.checks) target.append(node('h3',check.topic),node('p',check.action));
});
bindForm('export-form','export-results', async target => {
  if ($('export-region').value === 'ALL') throw new Error(tr('Choose a target market before preparing planning questions.'));
  const params = new URLSearchParams({category:$('category').value,country:$('export-region').value,lang:$('answer-language').value});
  const data = await api('/api/export/checklist?'+params);
  target.replaceChildren(node('span','Planning only','status-label'),node('h2','Questions to resolve'),node('p',data.message));
  const list = node('ol'); data.checklist.forEach(text => list.append(node('li',text))); target.append(list);
  for (const claim of data.claims || []) {
    target.append(node('p',claim.statement,'answer-text'), originalQuote(claim.quote));
    const source = (data.sources || []).find(item => item.id === claim.source_id);
    if (source) target.append(sourceLink(source));
  }
  renderSources(target,data.sources || []);
  if (!data.sources.length) target.append(node('p','This jurisdiction is not yet covered by the official-source catalogue.','notice'));
});
bindForm('translation-form','translation-results', async target => {
  const file = $('translation-file').files[0];
  const text = $('translation-text').value;
  if (file && text.trim()) throw new Error(tr('Choose a file or pasted text, not both.'));
  if (!file && !text.trim()) throw new Error(tr('Paste text or select a document.'));
  let data;
  if (file) {
    if (file.size > 2*1024*1024) throw new Error(tr('The document exceeds the 2 MB limit.'));
    const form = new FormData();
    form.append('file',file); form.append('source_lang',$('source-language').value); form.append('target_lang',$('target-language').value);
    form.append('consent', String($('translation-consent').checked));
    data = await api('/api/certification/translate-file',{method:'POST',body:form});
  } else data = await post('/api/translate',{text,source_lang:$('source-language').value,target_lang:$('target-language').value,consent:$('translation-consent').checked});
  target.replaceChildren(node('span', data.status === 'UNCHANGED' ? 'Unchanged' : 'Machine translation','status-label'),node('h2','Result for review'),node('p',data.message,'notice'),node('div',data.translated_text || data.translated_content,'answer-text'));
});
const loginForm = $('login-form');
if (loginForm) loginForm.addEventListener('submit', async event => {
  event.preventDefault(); const button = loginForm.querySelector('button'); button.disabled = true;
  try { await post('/api/auth/login',{username:$('username').value,password:$('password').value}); location.reload(); }
  catch (error) { $('login-result').textContent = error.message; }
  finally { button.disabled = false; $('password').value = ''; }
});
if ($('logout')) $('logout').addEventListener('click', async () => { try { await post('/api/auth/logout',{}); location.reload(); } catch (error) { $('admin-status').textContent = error.message; } });
if ($('admin-status')) api('/api/mcp/status').then(data => { $('admin-status').textContent = JSON.stringify(data,null,2); }).catch(error => { $('admin-status').textContent = error.message; });
