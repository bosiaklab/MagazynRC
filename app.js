const VALID_PINS = ['1114', '2026', 'Royal2026'];
const SUPABASE_BASE_URL = 'https://gojacqzjkrfjlnwokyeg.supabase.co/rest/v1';
const SUPABASE_KEY = 'sb_publishable_EuUrE98PR8SAVwnrIMP60g_RUAL0KSp';
const GEMINI_API_KEY = 'AQ.Ab8RN6JQHVTxqmEE-mAigOjJGt4ghfMGxGYDTjNUt0MGeq2f5Q';

function el(id) { return document.getElementById(id); }
function safeVal(id, val) { const e = el(id); if (e) { if (val !== undefined) e.value = val; return e.value; } return ''; }
function safeText(id, val) { const e = el(id); if (e) { if (val !== undefined) e.innerText = val; return e.innerText; } return ''; }
function showModal(id) { const m = el(id); if (m) { m.classList.remove('hidden'); m.classList.add('flex'); } }
function hideModal(id) { const m = el(id); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }

function checkAuth() {
  if (localStorage.getItem('magazyn_auth_pin') === 'true') { 
    el('authOverlay')?.classList.add('hidden'); 
    document.body.style.overflow = ''; 
  } else { 
    el('authOverlay')?.classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
  }
}

function handleLogin(e) {
  if (e) e.preventDefault(); 
  const pin = safeVal('authPin').trim();
  if (VALID_PINS.includes(pin)) { 
    localStorage.setItem('magazyn_auth_pin', 'true'); 
    el('authError')?.classList.add('hidden'); 
    el('authOverlay')?.classList.add('hidden'); 
    document.body.style.overflow = ''; 
  } else { 
    el('authError')?.classList.remove('hidden'); 
    safeVal('authPin', ''); 
  }
}

function lockApp() { 
  localStorage.removeItem('magazyn_auth_pin'); 
  safeVal('authPin', ''); 
  checkAuth(); 
}

function toggleToolsMenu() { el('toolsMenuDropdown')?.classList.toggle('hidden'); }
function hideToolsMenu() { el('toolsMenuDropdown')?.classList.add('hidden'); }

let learnedRules = {};
try { learnedRules = JSON.parse(localStorage.getItem('magazyn_learned_rules')) || {}; } catch (e) {}
function learnProductRule(name, category, unit, photo = '', packSize = 0, basePrice = 0, discountPercent = 0) {
  if (!name || !category) return; const key = cleanCanonicalKey(name); if (key.length < 2) return;
  const prev = learnedRules[key] || {};
  learnedRules[key] = { category, unit: unit || prev.unit || 'szt.', photo: photo || prev.photo || '', packSize: packSize > 1 ? packSize : (prev.packSize || 0), basePrice: basePrice > 0 ? basePrice : (prev.basePrice || 0), discountPercent: discountPercent > 0 ? discountPercent : (prev.discountPercent || 0) };
  try { localStorage.setItem('magazyn_learned_rules', JSON.stringify(learnedRules)); } catch (e) {}
}

function exportBackup() {
  const data = { inventory, deliveries, deposits, events, rwTransfers, stockLogs, priceAlerts, learnedRules };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `MagazynRC_Backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
}
function triggerImport() { if (confirm("⚠️ Przywrócenie kopii nadpisze obecne dane. Kontynuować?")) el('backupInput').click(); }
function importBackup(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.inventory) safeSetLocal('magazyn_offline_items', data.inventory);
      if (data.deliveries) safeSetLocal('magazyn_offline_deliveries', data.deliveries);
      if (data.deposits) safeSetLocal('magazyn_offline_deposits', data.deposits);
      if (data.events) safeSetLocal('magazyn_offline_events', data.events);
      if (data.rwTransfers) safeSetLocal('magazyn_offline_rw_transfers', data.rwTransfers);
      if (data.stockLogs) safeSetLocal('magazyn_offline_stock_logs', data.stockLogs);
      if (data.priceAlerts) safeSetLocal('magazyn_offline_price_alerts', data.priceAlerts);
      if (data.learnedRules) localStorage.setItem('magazyn_learned_rules', JSON.stringify(data.learnedRules));
      alert('✅ Baza danych przywrócona!'); location.reload();
    } catch (err) { alert('❌ Błąd pliku: ' + err.message); }
  };
  reader.readAsText(file); e.target.value = '';
}

function handleDragOver(e, zoneEl) { e.preventDefault(); e.stopPropagation(); if (zoneEl) zoneEl.classList.add('drag-over'); }
function handleDragLeave(e, zoneEl) { e.preventDefault(); e.stopPropagation(); if (zoneEl) zoneEl.classList.remove('drag-over'); }
window.handleDropFiles = async function(e, targetMode) {
  e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
  const files = Array.from(e.dataTransfer?.files || []); if (files.length > 0) await routeIncomingFiles(files, targetMode);
}

window.addEventListener('paste', async (e) => {
  const files = Array.from(e.clipboardData?.items || []).filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(Boolean);
  if (files.length === 0) return;
  if (!el('invoiceCaptureModal')?.classList.contains('hidden')) await routeIncomingFiles(files, 'INVOICE');
  else if (!el('shelfCountModal')?.classList.contains('hidden')) await routeIncomingFiles(files, 'SHELF_APPEND');
  else if (!el('newItemModal')?.classList.contains('hidden')) await routeIncomingFiles(files, 'LABEL_NEW');
  else if (!el('editItemModal')?.classList.contains('hidden')) await routeIncomingFiles(files, 'LABEL_EDIT');
  else await routeIncomingFiles(files, 'INVOICE');
});

async function routeIncomingFiles(files, targetMode) {
  if (targetMode === 'INVOICE' || targetMode === 'INVOICE_SLOT_1') { if (el('invoiceCaptureModal').classList.contains('hidden')) openInvoiceUploadModal(); await handleInvoicePhotoSelected({ target: { files, value: '' } }, 1); }
  else if (targetMode === 'INVOICE_SLOT_2') await handleInvoicePhotoSelected({ target: { files, value: '' } }, 2);
  else if (targetMode === 'SHELF') await processShelfCountImage({ target: { files, value: '' } }, false);
  else if (targetMode === 'SHELF_APPEND') await processShelfCountImage({ target: { files, value: '' } }, true);
  else if (targetMode === 'EVENT_AUTO_RETURN') await processAutoEventReturnSheetImage({ target: { files, value: '' } });
  else if (targetMode === 'EVENT_DISPATCH') await processEventDispatchImage({ target: { files, value: '' } });
  else if (targetMode === 'LABEL_NEW') { currentLabelPhotoTarget = 'NEW'; await handleItemLabelPhoto({ target: { files, value: '' } }); }
  else if (targetMode === 'LABEL_EDIT') { currentLabelPhotoTarget = 'EDIT'; await handleItemLabelPhoto({ target: { files, value: '' } }); }
}

let labelPhotosArray = [];
async function handleItemLabelPhoto(e) {
  const file = e.target.files?.[0]; if (!file) return;
  if (labelPhotosArray.length >= 3) { alert("Możesz dodać maksymalnie 3 zdjęcia etykiet."); return; }
  try {
    const prep = await prepareFileForGemini(file);
    labelPhotosArray.push(prep);
    renderLabelPhotos();
  } catch (err) { alert("Błąd zdjęcia: " + err.message); }
  e.target.value = '';
}

function renderLabelPhotos() {
  const listId = currentLabelPhotoTarget === 'NEW' ? 'newLabelPhotosList' : 'editLabelPhotosList';
  const list = el(listId);
  if (!list) return;
  
  if (labelPhotosArray.length === 0) {
    list.innerHTML = `<span class="text-[10px] text-slate-500 italic px-1">Brak zdjęć...</span>`;
    if (currentLabelPhotoTarget === 'NEW') tempNewItemPhoto = ''; else tempEditItemPhoto = '';
    return;
  }
  
  list.innerHTML = labelPhotosArray.map((p, idx) => `
    <div class="relative flex-shrink-0">
      <img src="${p.previewUrl || p}" class="h-14 w-14 object-cover rounded-lg border border-slate-600 bg-black">
      <button type="button" onclick="removeLabelPhoto(${idx})" class="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center cursor-pointer">✕</button>
    </div>
  `).join('');
  
  if (currentLabelPhotoTarget === 'NEW') {
     tempNewItemPhoto = labelPhotosArray.length > 0 ? (labelPhotosArray[0].previewUrl || labelPhotosArray[0]) : '';
  } else {
     tempEditItemPhoto = labelPhotosArray.length > 0 ? (labelPhotosArray[0].previewUrl || labelPhotosArray[0]) : '';
  }
}

window.removeLabelPhoto = function(idx) { labelPhotosArray.splice(idx, 1); renderLabelPhotos(); };

async function processLabelPhotosAI() {
  const validMedia = labelPhotosArray.filter(p => typeof p !== 'string');
  if(validMedia.length === 0) { alert("Dodaj nowe zdjęcia z aparatu lub galerii, aby AI mogło je odczytać."); return; }
  
  const btnId = currentLabelPhotoTarget === 'NEW' ? 'btnProcessLabelAI_NEW' : 'btnProcessLabelAI_EDIT';
  const btn = el(btnId);
  if(btn) { btn.disabled = true; btn.innerText = "⏳ Przetwarzanie..."; }
  
  try {
    const res = await queryGeminiAPI(`Odczytaj etykiety produktów (kod kreskowy, nazwa). Zwróć JSON: { "barcode": string, "name": string }`, validMedia);
    if (currentLabelPhotoTarget === 'NEW') {
       if(res.barcode && res.barcode !== 'null') safeVal('newBarcode', res.barcode);
       if(res.name && res.name !== 'null') { safeVal('newName', res.name); autoPreviewNewItemCategory(); }
    } else {
       if(res.barcode && res.barcode !== 'null') safeVal('editItemBarcode', res.barcode);
       if(res.name && res.name !== 'null') safeVal('editItemName', res.name);
    }
  } catch(err) {
    alert("Błąd analizy etykiet: " + err.message);
  } finally {
    if(btn) { btn.disabled = false; btn.innerText = currentLabelPhotoTarget === 'NEW' ? "🚀 Odczytaj Etykiety" : "🚀 Aktualizuj z Etykiet"; }
  }
}

function cleanCanonicalKey(text) { return (text || '').toLowerCase().replace(/['’`"´]/g, '').replace(/,/g, '.').replace(/\b(\d+)\s*ml\b/gi, (_, ml) => (parseInt(ml, 10) / 1000).toString()).replace(/\b(0\.\d+|1\.5|1)\s*l\b/gi, '$1').replace(/\bx\s*\d+\b/gi, ' ').replace(/\bzgrz\b|\bders\b|\bdrs\b|\bop\b|\bszt\b|\bbut\b/gi, ' ').replace(/[^a-z0-9ąćęłńóśźż.%]/g, ' ').replace(/\s+/g, ' ').trim(); }
const STRICT_VARIETALS_AND_FLAVORS = ['cabernet', 'merlot', 'chardonnay', 'pinot', 'grigio', 'noir', 'shiraz', 'syrah', 'primitivo', 'tempranillo', 'riesling', 'malbec', 'carmenere', 'chianti', 'prosecco', 'cava', 'frizzante', 'muscat', 'moscato', 'zero', 'light', 'max', 'bez laktozy', 'sojowe', 'owsiane', 'perlage', 'niegaz', 'jabłk', 'apple', 'pomarańcz', 'orange', 'cytryn', 'lemon', 'lime', 'grejpfrut', 'porzeczk', 'malin', 'truskawk', 'mango', 'brzoskwin', 'peach', 'berry', 'aromatic', 'tonic', 'tonik', 'ginger'];

function extractProductSpecs(text) {
  const s = cleanCanonicalKey(text), caps = (s.match(/\b0\.\d+\b|\b1\.5\b|\b1\b/g) || []), pack = [];
  if (/\bpet\b/.test(s)) pack.push('pet'); if (/\brgb\b|\bszk[łl]/.test(s)) pack.push('rgb'); if (/\bcan\b|\bpusz/.test(s)) pack.push('can');
  let wineColor = ''; if (/czerwone|rouge|\bred\b|cabernet|merlot|shiraz|syrah|primitivo|malbec|chianti/.test(s)) wineColor = 'red'; else if (/białe|biale|blanc|\bwhite\b|chardonnay|riesling|grigio/.test(s)) wineColor = 'white'; else if (/różowe|rozowe|\brose\b|rosato/.test(s)) wineColor = 'rose';
  return { caps, pack, wineColor, strictTokens: STRICT_VARIETALS_AND_FLAVORS.filter(v => s.includes(v)) };
}

function areSpecsCompatible(nameA, nameB) {
  const a = extractProductSpecs(nameA), b = extractProductSpecs(nameB);
  if (a.caps.length > 0 && b.caps.length > 0 && a.caps[0] !== b.caps[0]) return false;
  if (a.pack.length > 0 && b.pack.length > 0 && a.pack[0] !== b.pack[0]) return false;
  if (a.wineColor && b.wineColor && a.wineColor !== b.wineColor) return false;
  for (const token of STRICT_VARIETALS_AND_FLAVORS) { if (a.strictTokens.includes(token) !== b.strictTokens.includes(token)) return false; } return true;
}

function findBestInventoryMatch(targetName) {
  if (!targetName) return null; const targetKey = cleanCanonicalKey(targetName); if (targetKey.length < 3) return null;
  for (const item of inventory) { if (cleanCanonicalKey(item.name) === targetKey && areSpecsCompatible(targetName, item.name)) return item; }
  const ignore = new Set(['can', 'rgb', 'pet', 'drs', 'szt', 'but', 'zgrz', 'wino', 'wine', '0.187', '0.25', '0.3', '0.33', '0.5', '0.7', '0.75', '0.85', '1.0']);
  const tWords = targetKey.split(' ').filter(w => w.length >= 3 && !ignore.has(w) && !w.includes('%')); if (tWords.length === 0) return null;
  let best = null, bestR = 0;
  for (const item of inventory) {
    if (!areSpecsCompatible(targetName, item.name)) continue;
    const iWords = cleanCanonicalKey(item.name).split(' ').filter(w => w.length >= 3 && !ignore.has(w) && !w.includes('%')); if (iWords.length === 0) continue;
    let ov = 0; for (const tw of tWords) { if (iWords.some(iw => iw === tw || (iw.length >= 5 && tw.length >= 5 && iw.slice(0, 5) === tw.slice(0, 5)))) ov++; }
    const r = ov / Math.max(tWords.length, iWords.length); if ((ov >= 2 && r >= 0.65) || (ov >= 1 && tWords.length === 1 && iWords.length === 1)) { if (r > bestR) { bestR = r; best = item; } }
  } return best;
}

function classifyProductSmartLocal(name, currentCategory = '') {
  const n = (name || '').toLowerCase(); const key = cleanCanonicalKey(name);
  if (learnedRules[key]?.category && !(/cisowianka|perlage|woda/.test(n) && learnedRules[key].category.includes('Alkohole'))) return learnedRules[key].category;
  if (/cisowianka|perlage|kropla beskidu|żywiec zdrój|zywiec zdroj|nałęczowianka|naleczowianka|muszynianka|kinga pienińska|pellegrino|perrier|acqua panna|polaris|\bwoda\b/.test(n)) return 'Napoje • Woda';
  if (/kawa|filcori|lavazza|illy|pellini|segafredo|dallmayr|tchibo|ziarn|mielona|espresso|herbata|lipton|dilmah|richmont|earl grey|mleko|bez laktozy|sojowe|owsiane|śmietank|cukier|syrop|monin|rioba|purée|puree/.test(n)) return 'Napoje • Kawa / Herbata / Dodatki';
  if (/lunchbox|menubox|menu box|lunch box|pojemnik|kubek|kubki|kubeczk|wieczk|dekiel|talerz|sztuć|widelc|widelec|nóż|noże|nożyk|łyżk|łyżecz|mieszadeł|serwet|słomk|rurk|tacka|taca|folia|strecz|alumin|pergamin|rękawicz|worek|worki|wykałacz|szpadk|obrus|świecz|podgrzewacz|paliwo|chafing|czyściw|ręcznik/.test(n)) return /lunchbox|menubox|menu box|lunch box|pojemnik|wieczk|dekiel|tacka/.test(n) ? 'Jednorazówki • Opakowania / Lunchbox' : 'Jednorazówki • Kubki / Sztućce / Serwetki';
  if (/ballantine|grant'?s|johnnie walker|jack daniel|jim beam|jameson|chivas|tullamore|bushmills|glen|monkey shoulder|maker'?s mark|bourbon|whisky|whiskey|scotch/.test(n)) return 'Alkohole • Whisky';
  if (/bacardi|captain morgan|havana|malibu|kraken|diplomatico|bumba|\brum\b/.test(n)) return 'Alkohole • Rum';
  if (/wyborowa|finlandia|absolut|bocian|żubrówka|zubrowka|stoli|belvedere|chopin|baczewski|pan tadeusz|żołądkowa|zoladkowa|soplica|krupnik|stock|amundsen|smirnoff|nemiroff|ostoya|wódka|wodka|\bczysta\b/.test(n)) return 'Alkohole • Wódka';
  if (/lubuski|beefeater|bombay|tanqueray|hendrick|gordon'?s|\bgin\b|tequila|sierra|olmeca|jagermeister|jägermeister|aperol|campari|baileys|kahlua|cointreau|amaretto|limoncello|hennessy|metaxa|koniak|brandy|likier/.test(n)) return 'Alkohole • Gin / Likier / Aperitif';
  if (/\bwino\b|\bwine\b|prosecco|\bcava\b|szampan|champagne|frizzante|martini|cinzano|carlo rossi|fresco|septimo|cero zero|roche mazet|cabernet|merlot|chardonnay|sauvignon|pinot|shiraz|riesling|primitivo|chianti|rioja|tokaj|vermouth/.test(n)) {
    if (/czerwone|cabernet|merlot|shiraz|syrah|primitivo|chianti|malbec|tempranillo|pinot noir|rouge/.test(n)) return 'Alkohole • Wino Czerwone';
    if (/białe|biale|blanc|chardonnay|riesling|pinot grigio|sauvignon/.test(n) && !/cabernet/.test(n)) return 'Alkohole • Wino Białe';
    return 'Alkohole • Wino Różowe / Prosecco';
  }
  if (/\bpiwo\b|heineken|\blech\b|\bżywiec\b|\bzywiec\b|tyskie|\bperła\b|\bperla\b|carlsberg|desperados|corona|kormoran|książęce|ksiazece|zatecky|okocim|harnas|kasztelan|lomza|łomża|namysłów|paulaner|pilsner|guinness|somersby|\bcydr\b|radler/.test(n)) return 'Alkohole • Piwo / Cydr';
  if (/\b(1[1-9]|[2-8][0-9])([.,]\d+)?\s*%/.test(n)) return 'Alkohole • Mocne';
  if (/burn|red bull|redbull|monster|tiger|black energy|rockstar|oshee|energetyk/.test(n)) return 'Napoje • Energetyk';
  if (/c-cola|coca cola|pepsi|fanta|sprite|kinley|schweppes|7up|mirinda|mountain dew|orangina|tonik|tonic|lemoniada|napój gaz/.test(n)) return 'Napoje • Gazowane / Soft';
  if (/\bsok\b|nektar|tymbark|hortex|cappy|tarczyn|fortuna|riviva|tłoczony|jabłko|pomarańcz|grejpfrut|czarna porzeczka|wieloowocowy|pomidor/.test(n)) return 'Napoje • Soki / Nektary';
  if (/\bcan\b|\brgb\b|\bpet\b|\b0\.25\b|\b0\.33\b|\b0\.5\b|\b0\.85\b/.test(n)) return 'Napoje • Gazowane / Soft';
  const c = (currentCategory || '').toLowerCase();
  if (c.includes('alko') || c.includes('jednoraz') || (c.includes('napoje') && c.includes('•'))) return currentCategory;
  return null;
}

function getMainCategoryGroup(item) {
  const s = (classifyProductSmartLocal(item.name, item.category) || item.category || '').toLowerCase();
  if (s.includes('alko') || s.includes('whisky') || s.includes('wódka') || s.includes('rum') || s.includes('wino') || s.includes('piwo')) return 'ALCOHOL';
  if (s.includes('jednoraz') || s.includes('serwis') || s.includes('lunchbox') || s.includes('kubki') || s.includes('sztućce')) return 'DISPOSABLES';
  return 'BEVERAGE';
}

function autoPreviewNewItemCategory() {
  const g = classifyProductSmartLocal(safeVal('newName'));
  if (g) { safeVal('newCategory', g); if (g.startsWith('Jednorazówki')) safeVal('newUnit', 'op.'); }
}

function safeGetLocal(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
function safeSetLocal(k, d) {
  try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) {
    try { localStorage.setItem(k, JSON.stringify(d.map((x, i) => i > 5 ? { ...x, image_url: '', dispatch_image: '', return_image: '' } : x))); } catch (err) {}
  }
}

function normalizeItem(raw) {
  if (!raw) return null;
  const rc = String(raw.category || ''); const key = cleanCanonicalKey(raw.name); const rule = learnedRules[key] || {};
  const price = Number(raw.price) || 0.00, basePrice = Number(raw.basePrice || raw.base_price || rule.basePrice) || price, discountPercent = Number(raw.discountPercent || raw.discount_percent || rule.discountPercent) || 0;
  return {
    id: String(raw.id), barcode: String(raw.barcode || ''), name: String(raw.name || ''), category: classifyProductSmartLocal(raw.name, rc) || rc || 'Napoje • Pozostałe',
    location: String(raw.location || '-'), qty: Number(raw.qty) || 0, inField: Number(raw.inField !== undefined ? raw.inField : raw.in_field) || 0,
    minQty: Number(raw.minQty !== undefined ? raw.minQty : raw.min_qty) || 0, unit: String(raw.unit || rule.unit || 'szt.'), price, basePrice, discountPercent, photo: raw.photo || rule.photo || '',
    expiryDate: raw.expiryDate !== undefined ? raw.expiryDate : (raw.expiry_date || ''), vat: Number(raw.vat) || 23
  };
}

function toDbItem(it) { 
  return { 
    id: it.id, barcode: it.barcode, name: it.name, category: it.category, location: it.location, 
    qty: it.qty, in_field: it.inField, min_qty: it.minQty, unit: it.unit, price: it.price, 
    expiry_date: (it.expiryDate && String(it.expiryDate).trim() !== '') ? it.expiryDate : null, 
    vat: Number(it.vat) || 23, updated_at: new Date() 
  }; 
}

let inventory = safeGetLocal('magazyn_offline_items').map(normalizeItem).filter(Boolean);
let deliveries = safeGetLocal('magazyn_offline_deliveries');
let deposits = safeGetLocal('magazyn_offline_deposits');
let priceAlerts = safeGetLocal('magazyn_offline_price_alerts');
let events = safeGetLocal('magazyn_offline_events');
let rwTransfers = safeGetLocal('magazyn_offline_rw_transfers');
if (rwTransfers.length === 0) { const legacyExpo = safeGetLocal('magazyn_offline_expo_transfers'); if (legacyExpo.length > 0) rwTransfers = legacyExpo.map(x => ({ ...x, destination: x.fair_name || 'Bar EXPO XXI' })); }
let stockLogs = safeGetLocal('magazyn_offline_stock_logs');

let currentCategoryPill = 'ALL', selectedItemId = null, contextMenuItemId = null, html5QrCode = null;
let isCameraRunning = false, isCloudOnline = false, isSelectMode = false;
let currentExtractedDelivery = null, currentExtractedEventDispatch = null, currentActiveReturnEventId = null;
let lastParsedReturnData = null, currentShelfCountItems = [];
let sheetCreatorMap = new Map(), rwCreatorMap = new Map(), currentPreviewSheetData = null, invoiceFilePart1 = null, invoiceFilePart2 = null;
let selectedItemIds = new Set(), editingDeliveryItems = [], editingDeliveryPhotos = [];
let currentLabelPhotoTarget = 'NEW', tempNewItemPhoto = '', tempEditItemPhoto = '';

function triggerScanFeedback() { if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} } }
function normalizeInvoiceNumberKey(docNum) { return String(docNum || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function findExistingDuplicateDelivery(docNum) { const k = normalizeInvoiceNumberKey(docNum); return k.length >= 3 ? (deliveries.find(d => normalizeInvoiceNumberKey(d.doc_number) === k) || null) : null; }

function checkInvoiceDuplicateLive() {
  const ex = findExistingDuplicateDelivery(safeVal('aiDocNumInput')); const btn = el('btnConfirmFullDelivery');
  if (ex) { el('aiDuplicateWarningBanner')?.classList.remove('hidden'); safeText('aiDuplicateWarningText', `Faktura "${ex.doc_number}" (${ex.supplier || ''}) już dodana.`); if (btn) { btn.disabled = true; btn.innerHTML = `⛔ Zablokowano dubel`; } }
  else { el('aiDuplicateWarningBanner')?.classList.add('hidden'); if (btn) { btn.disabled = false; btn.innerHTML = `📥 Nowa dostawa`; } } return ex;
}

function normalizeText(t) { return (t || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
function findBestEventMatch(scannedNumber, scannedName) {
  const cleanNum = (scannedNumber || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase(), cleanName = normalizeText(scannedName), sorted = [...events].sort((a, b) => (a.status === 'W trakcie' ? -1 : 1));
  if (cleanNum.length >= 2) { for (const ev of sorted) { const evNum = (ev.event_number || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase(); if (evNum && (evNum === cleanNum || evNum.includes(cleanNum) || cleanNum.includes(evNum))) return ev; } }
  if (cleanName.length >= 3) { const words = cleanName.split(' ').filter(w => w.length > 2); for (const ev of sorted) { const evName = normalizeText(ev.event_name); if (evName && (evName.includes(cleanName) || cleanName.includes(evName))) return ev; for (const w of words) { if (evName.includes(w)) return ev; } } }
  return sorted.find(e => e.status === 'W trakcie') || null;
}
function findBestDepositMatch(targetName, unitPrice) {
  if (!targetName) return null; const cleanTarget = normalizeText(targetName);
  for (const dep of deposits) { const cleanDep = normalizeText(dep.name); if (cleanTarget === cleanDep) return dep; if (Math.abs(Number(dep.unit_price) - Number(unitPrice)) < 0.02) { if ((cleanTarget.includes('pet') && cleanDep.includes('pet')) || (cleanTarget.includes('can') && cleanDep.includes('can')) || (cleanTarget.includes('skrzynk') && cleanDep.includes('skrzynk')) || (cleanTarget.includes('szk') && cleanDep.includes('szk'))) return dep; } } return null;
}
function detectSmartPackMultiplier(name, rawUnit = '', inferredPackSize = 0, rawPackPrice = 0) {
  const key = cleanCanonicalKey(name); if (learnedRules[key]?.packSize > 1) return learnedRules[key].packSize;
  if (name) { const m = name.match(/\bX\s*(\d+)\b/i) || name.match(/[\s(]X\s*(\d+)/i) || name.match(/\b(\d+)\s*X\b/i) || name.match(/\((\d+)\s*(?:szt|can|rgb|pet|pusz|but)?\)/i) || name.match(/\b(\d+)\s*szt\b/i); if (m && m[1]) { const val = parseInt(m[1], 10); if (val > 1 && val <= 100) return val; } }
  const isZgrz = /zgrz/i.test(rawUnit) || /\bzgrz/i.test(name);
  if (isZgrz) {
    if (inferredPackSize > 1 && inferredPackSize <= 48) return inferredPackSize; const s = cleanCanonicalKey(name);
    if (/\b1\.5\b|\b1\b/.test(s)) return 6; if (/\b0\.5\b|\b0\.33\b|\b0\.3\b|\b0\.25\b|\b0\.2\b/.test(s)) return rawPackPrice > 45 ? 24 : 12; return 6;
  } return 1;
}
function parseDeliveryImages(field) {
  if (!field) return []; if (Array.isArray(field)) return field.filter(Boolean); const s = String(field).trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).filter(Boolean); } catch (e) { return []; } } if (s.startsWith('data:') || s.startsWith('http')) return [s]; return [];
}

function recordStockLog(itemId, itemName, actionType, qtyChange, note = '') {
  const logEntry = { id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000), item_id: String(itemId), item_name: String(itemName), action_type: actionType, qty_change: qtyChange, note: note, created_at: new Date() };
  stockLogs.unshift(logEntry); safeSetLocal('magazyn_offline_stock_logs', stockLogs);
  if (isCloudOnline) { apiRequest('/stock_logs', 'POST', logEntry).catch(()=>{}); }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
  const ctrl = new AbortController(); const tid = setTimeout(() => ctrl.abort(), 6000);
  const opts = { method, headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, signal: ctrl.signal }; if (body) opts.body = JSON.stringify(body);
  try { 
    const res = await fetch(`${SUPABASE_BASE_URL}${endpoint}`, opts); 
    clearTimeout(tid); 
    if (!res.ok) { 
       const errText = await res.text();
       throw new Error(`HTTP ${res.status} - ${errText}`); 
    } 
    return await res.json(); 
  } catch (err) { clearTimeout(tid); throw err; }
}

function fetchAllData() {
  safeText('syncStatus', 'Synchronizacja...');
  const localMap = new Map(inventory.map(i => [String(i.id), i]));
  
  apiRequest('/inventory?select=*&order=name.asc').then(invData => {
    if (invData && invData.length > 0) {
      inventory = invData.map(raw => { const loc = localMap.get(String(raw.id)); return normalizeItem({ ...loc, ...raw, photo: raw.photo || loc?.photo, basePrice: raw.base_price || loc?.basePrice, discountPercent: raw.discount_percent || loc?.discountPercent }); }); safeSetLocal('magazyn_offline_items', inventory);
    } else if (inventory.length > 0) { inventory.forEach(it => { apiRequest('/inventory', 'POST', toDbItem(it)).catch(()=>{}); }); }
    isCloudOnline = true; const syncEl = el('syncStatus'); if (syncEl) { syncEl.innerText = '🟢 Chmura aktywna'; syncEl.className = 'text-[10px] text-emerald-400 font-bold'; }
    
    apiRequest('/deliveries?select=*&order=created_at.desc').then(cd => { if (cd) { deliveries = cd; safeSetLocal('magazyn_offline_deliveries', deliveries); renderDeliveries(); } }).catch(()=>{});
    apiRequest('/deposits?select=*&order=name.asc').then(cdep => { if (cdep) { deposits = cdep; safeSetLocal('magazyn_offline_deposits', deposits); renderDeposits(); } }).catch(()=>{});
    apiRequest('/events?select=*&order=created_at.desc').then(cev => { if (cev) { events = cev; safeSetLocal('magazyn_offline_events', events); renderEvents(); } }).catch(()=>{});
    apiRequest('/price_alerts?select=*&order=created_at.desc').then(cal => { if (cal) { priceAlerts = cal; safeSetLocal('magazyn_offline_price_alerts', priceAlerts); renderPriceAlerts(); } }).catch(()=>{});
    apiRequest('/stock_logs?select=*&order=created_at.desc&limit=100').then(clog => { if (clog) { stockLogs = clog; safeSetLocal('magazyn_offline_stock_logs', stockLogs); renderStockLogs(); } }).catch(()=>{});
    
    renderInventory(); renderRwTransfers();
  }).catch(e => {
    isCloudOnline = false; const syncEl = el('syncStatus'); if (syncEl) { syncEl.innerText = '🟡 Tryb lokalny'; syncEl.className = 'text-[10px] text-amber-400 font-bold'; }
    renderInventory(); renderDeposits(); renderEvents(); renderRwTransfers(); renderPriceAlerts(); renderDeliveries(); renderStockLogs();
  });
}

function setCategoryPill(catKey) { 
  currentCategoryPill = catKey; 
  ['ALL', 'ALCOHOL', 'BEVERAGE', 'DISPOSABLES', 'LOW', 'FIELD', 'EXPIRING'].forEach(k => { 
    const b = el(`pillCat_${k}`); 
    if (b) b.className = (k === catKey) ? (k === 'EXPIRING' ? "bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer pointer-events-auto" : "bg-emerald-600 text-slate-950 font-black px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer pointer-events-auto") : "bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl whitespace-nowrap font-normal cursor-pointer pointer-events-auto"; 
  }); 
  renderInventory(); 
  triggerScanFeedback(); 
}

function renderInventory() {
  const search = safeVal('searchFilter').toLowerCase(); const list = el('inventoryList'); if (!list) return;
  let cAlco = 0, cBev = 0, cDisp = 0, cLow = 0, cField = 0, cExp = 0, totalMagVal = 0, totalFieldQty = 0;
  inventory.forEach(it => {
    const g = getMainCategoryGroup(it); if (g === 'ALCOHOL') cAlco++; else if (g === 'DISPOSABLES') cDisp++; else cBev++;
    if ((Number(it.qty) || 0) <= (Number(it.minQty) || 0)) cLow++; if ((Number(it.inField) || 0) > 0) cField++;
    totalMagVal += ((Number(it.qty) || 0) * (Number(it.price) || 0)); totalFieldQty += (Number(it.inField) || 0);
    if (it.expiryDate) { const expDays = Math.floor((new Date(it.expiryDate) - new Date()) / 86400000); if (expDays <= 30) cExp++; }
  });
  safeText('statTotalItems', inventory.length); safeText('statInField', totalFieldQty); safeText('statTotalValue', `${totalMagVal.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`);
  const totalDepVal = deposits.reduce((sum, d) => sum + ((Number(d.qty) || 0) * (Number(d.unit_price) || 0)), 0); safeText('statTotalDeposits', `${totalDepVal.toFixed(2)} zł`);
  safeText('countCat_ALL', `(${inventory.length})`); safeText('countCat_ALCOHOL', `(${cAlco})`); safeText('countCat_BEVERAGE', `(${cBev})`); safeText('countCat_DISPOSABLES', `(${cDisp})`); safeText('countCat_LOW', `(${cLow})`); safeText('countCat_FIELD', `(${cField})`); safeText('countCat_EXPIRING', `(${cExp})`);
  
  const filtered = inventory.filter(item => {
    const n = String(item.name || '').toLowerCase(), b = String(item.barcode || '').toLowerCase(), c = String(item.category || '').toLowerCase(), l = String(item.location || '').toLowerCase();
    if (!(n.includes(search) || b.includes(search) || c.includes(search) || l.includes(search))) return false;
    if (currentCategoryPill === 'LOW') return (Number(item.qty) || 0) <= (Number(item.minQty) || 0);
    if (currentCategoryPill === 'FIELD') return (Number(item.inField) || 0) > 0;
    if (currentCategoryPill === 'EXPIRING') return item.expiryDate && Math.floor((new Date(item.expiryDate) - new Date()) / 86400000) <= 30;
    if (currentCategoryPill === 'ALCOHOL') return getMainCategoryGroup(item) === 'ALCOHOL';
    if (currentCategoryPill === 'BEVERAGE') return getMainCategoryGroup(item) === 'BEVERAGE';
    if (currentCategoryPill === 'DISPOSABLES') return getMainCategoryGroup(item) === 'DISPOSABLES'; return true;
  });
  if (filtered.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak pozycji w tej kategorii.</div>`; return; }
  list.innerHTML = filtered.map(item => {
    const isLow = (Number(item.qty) || 0) <= (Number(item.minQty) || 0), isChecked = selectedItemIds.has(item.id), itemVal = ((item.qty || 0) * (item.price || 0)).toFixed(2);
    const grp = getMainCategoryGroup(item), badgeColor = grp === 'ALCOHOL' ? 'bg-amber-950 text-amber-300 border border-amber-700/50' : (grp === 'DISPOSABLES' ? 'bg-purple-950 text-purple-300 border border-purple-700/50' : 'bg-sky-950 text-sky-300 border border-sky-700/50'), hasDiscount = Number(item.discountPercent) > 0 || (Number(item.basePrice) > Number(item.price) + 0.01);
    const expDays = item.expiryDate ? Math.floor((new Date(item.expiryDate) - new Date()) / 86400000) : 999;
    const expiryBadge = item.expiryDate ? (expDays < 0 ? `<span class="text-rose-500 font-black text-[9px] bg-rose-950/50 px-1 rounded border border-rose-800">⚠️ PO TERMINIE (${item.expiryDate})</span>` : (expDays <= 30 ? `<span class="text-amber-400 font-bold text-[9px] bg-amber-950/50 px-1 rounded border border-amber-700">⏳ Zostaje ${expDays} dni</span>` : `<span class="text-slate-500 text-[9px]">📅 ${item.expiryDate}</span>`)) : '';
    return `<div oncontextmenu="window.handleItemContextMenu(event, '${item.id}')" onclick="window.handleItemCardClick(event, '${item.id}')" class="bg-slate-800 border ${isChecked ? 'border-amber-400' : (isLow ? 'border-rose-500/60' : 'border-slate-700/80')} rounded-xl p-3 flex items-center justify-between cursor-pointer gap-2.5 pointer-events-auto">${isSelectMode ? `<div onclick="event.stopPropagation()"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleSelectItem('${item.id}', this.checked)" class="w-4 h-4 rounded cursor-pointer pointer-events-auto"></div>` : ''}${item.photo ? `<img src="${item.photo}" class="w-11 h-11 rounded-lg object-cover border border-slate-600 bg-black flex-shrink-0">` : ''}<div class="space-y-1 flex-1 min-w-0"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeColor}">${item.category || 'Napoje'}</span><span class="text-[11px] text-slate-400">📍 ${item.location || '-'}</span><span class="text-[11px] text-slate-500 font-mono">#${item.barcode}</span></div><h4 class="font-bold text-xs text-white truncate">${item.name}</h4><div class="flex items-center gap-2 flex-wrap text-[10px]"><span class="text-emerald-400 font-bold">${Number(item.price || 0).toFixed(2)} zł / ${item.unit || 'szt.'}</span>${hasDiscount ? `<span class="bg-amber-950/80 text-amber-300 border border-amber-700/50 px-1.5 py-0.2 rounded text-[9px] font-bold">🏷️ po rabacie ${item.discountPercent ? `-${item.discountPercent}% ` : ''}${item.basePrice ? `(100%: ${Number(item.basePrice).toFixed(2)} zł)` : ''}</span>` : `<span class="text-slate-500 text-[9px]">(cena reg.)</span>`}<span class="text-slate-400">(Wartość: ${itemVal} zł)</span>${expiryBadge}${isLow ? `<span class="text-rose-400 font-medium">${item.qty === 0 ? '⚪ Stan 0' : `⚠️ Min: ${item.minQty}`}</span>` : ''}</div></div><div class="text-right flex items-center gap-2 flex-shrink-0">${item.inField > 0 ? `<div class="bg-blue-950/60 border border-blue-700/50 px-2 py-0.5 rounded-lg text-center"><span class="text-[9px] text-blue-300 block">W terenie</span><span class="font-bold text-xs text-blue-400">${item.inField}</span></div>` : ''}<div class="bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700 min-w-[56px] text-center"><span class="text-[9px] text-slate-400 block">Magazyn</span><span class="font-black text-sm ${isLow ? 'text-rose-400' : 'text-emerald-400'}">${item.qty}</span><span class="text-[9px] text-slate-400">${item.unit || 'szt.'}</span></div></div></div>`;
  }).join('');
}

window.openEditModal = function(id) {
  const it = inventory.find(i => String(i.id) === String(id)); if (!it) return;
  hideModal('actionModal');
  
  safeVal('editItemId', it.id);
  safeVal('editItemBarcode', it.barcode);
  safeVal('editItemName', it.name);
  safeVal('editItemPrice', Number(it.price || 0).toFixed(2));
  safeVal('editItemBasePrice', Number(it.basePrice || it.price || 0).toFixed(2));
  safeVal('editItemDiscount', Number(it.discountPercent || 0));
  safeVal('editItemCategory', it.category || 'Napoje');
  safeVal('editItemLocation', it.location || '-');
  safeVal('editItemUnit', it.unit || 'szt.');
  safeVal('editItemMinQty', it.minQty || 0);
  safeVal('editItemExpiry', it.expiryDate || '');
  safeVal('editItemVat', it.vat || 23);
  
  currentLabelPhotoTarget = 'EDIT';
  labelPhotosArray = it.photo ? [it.photo] : [];
  renderLabelPhotos();
  showModal('editItemModal');
}

window.saveEditedItem = function(e) {
  e.preventDefault(); 
  const idElem = safeVal('editItemId');
  const it = inventory.find(i => String(i.id) === String(idElem)); if (!it) return;
  
  it.barcode = safeVal('editItemBarcode').trim() || it.barcode; 
  it.name = safeVal('editItemName').trim() || it.name; 
  it.price = parseFloat(safeVal('editItemPrice')) || 0;
  it.basePrice = parseFloat(safeVal('editItemBasePrice')) || it.price; 
  it.discountPercent = parseFloat(safeVal('editItemDiscount')) || 0;
  it.category = safeVal('editItemCategory').trim() || 'Napoje'; 
  it.location = safeVal('editItemLocation').trim() || '-'; 
  it.unit = safeVal('editItemUnit') || 'szt.'; 
  it.minQty = parseInt(safeVal('editItemMinQty')) || 0;
  it.expiryDate = safeVal('editItemExpiry') || ''; 
  it.vat = parseInt(safeVal('editItemVat')) || 23;
  
  if (tempEditItemPhoto) it.photo = tempEditItemPhoto; 
  learnProductRule(it.name, it.category, it.unit, it.photo, 0, it.basePrice, it.discountPercent);
  
  safeSetLocal('magazyn_offline_items', inventory); 
  renderInventory(); 
  hideModal('editItemModal');
  
  if (isCloudOnline) { 
    apiRequest(`/inventory?id=eq.${it.id}`, 'PATCH', toDbItem(it))
    .catch(err => alert("BŁĄD ZAPISU W CHMURZE:\nUpewnij się, że w Supabase jest kolumna 'vat'!\nBłąd: " + err.message)); 
  }
}

window.openActionModal = function(id) {
  const it = inventory.find(i => String(i.id) === String(id)); if (!it) return;
  selectedItemId = it.id;
  
  const thumb = el('modalItemThumb');
  if (thumb) { if(it.photo) { thumb.src = it.photo; thumb.classList.remove('hidden'); } else thumb.classList.add('hidden'); }
  
  safeText('modalItemCategory', `${it.category || 'Napoje'} • ${it.location || '-'}`);
  safeText('modalItemName', it.name);
  safeText('modalItemBarcode', `KOD: ${it.barcode}`);
  safeText('modalItemPrice', `${Number(it.price || 0).toFixed(2)} zł`);
  safeText('modalItemQty', it.qty);
  safeText('modalItemUnit', it.unit || 'szt.');
  safeText('modalItemInField', it.inField || 0);
  safeVal('modalStepQty', 1);
  
  const logsListEl = el('modalItemLogsList');
  if (logsListEl) {
     const logs = stockLogs.filter(l => String(l.item_id) === String(it.id)).slice(0, 10);
     logsListEl.innerHTML = logs.length === 0 ? `<span class="text-slate-500 italic">Brak historii.</span>` : logs.map(l => `<div class="flex justify-between text-slate-300 border-b border-slate-800/60 pb-0.5"><span>${l.action_type} ${l.note ? `(${l.note})` : ''}</span><span class="font-bold ${l.qty_change > 0 ? 'text-emerald-400' : 'text-rose-400'}">${l.qty_change > 0 ? '+' : ''}${l.qty_change}</span></div>`).join('');
  }
  showModal('actionModal');
}

window.adjustStepQty = function(d) { 
   const stepEl = el('modalStepQty');
   if(stepEl) stepEl.value = Math.max(1, (parseInt(stepEl.value) || 1) + d); 
}

window.executeStockAction = async function(type) {
  if (!selectedItemId) return;
  const it = inventory.find(i => String(i.id) === String(selectedItemId)); if (!it) return;
  const stepEl = el('modalStepQty');
  const step = stepEl ? (parseInt(stepEl.value) || 1) : 1;
  
  if (type === 'ADD') {
    it.qty += step;
    recordStockLog(it.id, it.name, 'Przyjęcie ręczne', step);
  } else if (type === 'REMOVE') {
    if (it.qty < step) return alert("Brak wystarczającej ilości w magazynie!");
    it.qty -= step;
    recordStockLog(it.id, it.name, 'Wydanie ręczne', -step);
  } else if (type === 'TO_FIELD') {
    if (it.qty < step) return alert("Brak wystarczającej ilości w magazynie!");
    it.qty -= step; it.inField = (it.inField || 0) + step;
    recordStockLog(it.id, it.name, 'Przesunięcie w teren', -step, 'Szybka akcja');
  } else if (type === 'TO_RW') {
    if (it.qty < step) return alert("Brak wystarczającej ilości w magazynie!");
    it.qty -= step;
    const rwNum = 'RW-AUTO/' + Date.now().toString().slice(-4);
    recordStockLog(it.id, it.name, 'Rozchód RW', -step, rwNum);
    const rwRowVal = step * (it.price || 0);
    const newTransfer = { id: Date.now().toString(), transfer_number: rwNum, destination: 'Szybkie Wydanie RW', transfer_date: new Date().toLocaleDateString('pl-PL'), total_net_value: rwRowVal.toFixed(2), items_json: [{ itemId: it.id, name: it.name, transferredQty: step, returnedQty: 0, unit: it.unit || 'szt.', netPrice: it.price || 0, rowNet: rwRowVal }], created_at: new Date() };
    rwTransfers.unshift(newTransfer); safeSetLocal('magazyn_offline_rw_transfers', rwTransfers);
    if (isCloudOnline) { apiRequest('/rw_transfers', 'POST', newTransfer).catch(()=>{}); }
  } else if (type === 'LOSS') {
    if (it.qty < step) return alert("Brak wystarczającej ilości w magazynie!");
    it.qty -= step;
    recordStockLog(it.id, it.name, 'Strata / Stłuczka', -step);
  }
  
  safeSetLocal('magazyn_offline_items', inventory);
  if (isCloudOnline) { apiRequest(`/inventory?id=eq.${it.id}`, 'PATCH', { qty: it.qty, in_field: it.inField }).catch(()=>{}); }
  renderInventory(); hideModal('actionModal'); triggerScanFeedback();
};

window.openInventoryAuditModal = function() {
  const c = el('auditItemsContainer');
  if(!c) return;
  c.innerHTML = inventory.map(it => `<div class="bg-slate-900 border border-slate-700 p-2 rounded-xl flex items-center justify-between text-xs mb-1.5"><div class="flex-1 truncate"><span class="font-bold text-white block truncate">${it.name}</span><span class="text-[10px] text-slate-400">Aktualnie: ${it.qty} ${it.unit}</span></div><input type="number" id="audit_input_${it.id}" value="${it.qty}" class="w-20 bg-slate-800 border border-cyan-500/70 rounded-lg p-1.5 text-center font-black text-cyan-400 text-xs"></div>`).join('');
  showModal('inventoryAuditModal');
};

window.finalizeInventoryAudit = async function() {
  if(!confirm("Czy na pewno chcesz wyrównać stany dla wszystkich pozycji? Wszelkie różnice zostaną zapisane w dzienniku.")) return;
  let changes = 0;
  for (const it of inventory) {
    const inp = el(`audit_input_${it.id}`);
    if (inp) {
      const newQ = parseInt(inp.value) || 0;
      const diff = newQ - it.qty;
      if (diff !== 0) {
        it.qty = newQ;
        recordStockLog(it.id, it.name, 'Spis z Natury (Korekta)', diff, 'Audyt');
        if (isCloudOnline) { apiRequest(`/inventory?id=eq.${it.id}`, 'PATCH', { qty: it.qty }).catch(()=>{}); }
        changes++;
      }
    }
  }
  safeSetLocal('magazyn_offline_items', inventory);
  renderInventory(); hideModal('inventoryAuditModal');
  alert(`Audyt zakończony. Skorygowano ${changes} pozycji.`);
};

window.clearStockLogs = function() {
  if(!confirm("Wyczyścić cały dziennik operacji?")) return;
  stockLogs = []; safeSetLocal('magazyn_offline_stock_logs', stockLogs); renderStockLogs();
};

window.renderStockLogs = function() {
  const list = el('stockLogsList'); if(!list) return;
  if (stockLogs.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak zapisów w dzienniku.</div>`; return; }
  list.innerHTML = stockLogs.map(l => {
    const date = new Date(l.created_at).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-3 flex justify-between items-center text-xs"><div><h4 class="font-bold text-white">${l.item_name}</h4><p class="text-[10px] text-slate-400">${l.action_type} ${l.note ? `(${l.note})` : ''} • ${date}</p></div><span class="font-black text-sm ${l.qty_change > 0 ? 'text-emerald-400' : (l.qty_change < 0 ? 'text-rose-400' : 'text-slate-400')}">${l.qty_change > 0 ? '+' : ''}${l.qty_change}</span></div>`;
  }).join('');
};

window.deleteCurrentItem = function() {
  if (!confirm('Usunąć pozycję?')) return;
  const tid = selectedItemId; inventory = inventory.filter(i => String(i.id) !== String(tid));
  safeSetLocal('magazyn_offline_items', inventory); renderInventory(); hideModal('actionModal');
  if (isCloudOnline) { apiRequest(`/inventory?id=eq.${tid}`, 'DELETE').catch(()=>{}); }
}

window.generateRandomCode = function() { safeVal('newBarcode', 'RC-' + Math.floor(100000 + Math.random() * 900000)); }
window.openNewItemModal = function(p) {
  currentLabelPhotoTarget = 'NEW'; labelPhotosArray = []; tempNewItemPhoto = ''; renderLabelPhotos();
  safeVal('newBarcode', p || ('RC-' + Math.floor(100000 + Math.random() * 900000)));
  safeVal('newName', ''); safeVal('newPrice', '0.00'); safeVal('newCategory', 'Napoje • Kawa / Herbata / Dodatki');
  safeVal('newUnit', 'szt.'); safeVal('newLocation', ''); safeVal('newQty', 1); safeVal('newExpiry', ''); safeVal('newVat', '23'); 
  showModal('newItemModal');
}

window.saveNewItem = function(e) {
  e.preventDefault(); 
  const name = safeVal('newName').trim() || ''; 
  const existing = findBestInventoryMatch(name);
  
  const q = parseInt(safeVal('newQty')) || 0;
  const p = parseFloat(safeVal('newPrice')) || 0;
  const u = safeVal('newUnit') || 'szt.';
  const chosenCat = safeVal('newCategory').trim() || classifyProductSmartLocal(name) || 'Napoje';
  learnProductRule(name, chosenCat, u, tempNewItemPhoto);
  
  if (existing && cleanCanonicalKey(existing.name) === cleanCanonicalKey(name)) {
    existing.qty += q; if (p > 0) existing.price = p; existing.category = chosenCat; if (tempNewItemPhoto) existing.photo = tempNewItemPhoto;
    const newExp = safeVal('newExpiry');
    if (newExp) existing.expiryDate = newExp;
    safeSetLocal('magazyn_offline_items', inventory); renderInventory(); hideModal('newItemModal');
    if (isCloudOnline) { 
       apiRequest(`/inventory?id=eq.${existing.id}`, 'PATCH', toDbItem(existing))
       .catch(err => alert("BŁĄD ZAPISU W CHMURZE:\nUpewnij się, że dodałeś nową kolumnę 'vat' (typ: int2 / numeric) w Supabase!\n\nBłąd: " + err.message)); 
    }
    return;
  }
  
  const ni = normalizeItem({ 
    id: Date.now().toString(), 
    barcode: safeVal('newBarcode').trim() || '', 
    name, 
    price: p, 
    category: chosenCat, 
    location: safeVal('newLocation').trim() || '-', 
    qty: q, 
    inField: 0, 
    unit: u, 
    minQty: parseInt(safeVal('newMinQty')) || 0, 
    photo: tempNewItemPhoto, 
    expiryDate: safeVal('newExpiry') || '', 
    vat: parseInt(safeVal('newVat')) || 23 
  });
  inventory.push(ni); recordStockLog(ni.id, ni.name, 'Utworzenie pozycji', ni.qty);
  safeSetLocal('magazyn_offline_items', inventory); renderInventory(); hideModal('newItemModal');
  
  if (isCloudOnline) { 
     apiRequest('/inventory', 'POST', toDbItem(ni))
     .catch(err => alert("BŁĄD ZAPISU W CHMURZE:\nUpewnij się, że włączyłeś 'Allow Nullable' dla daty i dodałeś pole 'vat'.\nBłąd: " + err.message)); 
  }
}

window.handleScannedCode = function(code) {
  if (!code) return; const clean = code.trim(); triggerScanFeedback();
  const f = inventory.find(i => String(i.barcode).toLowerCase() === clean.toLowerCase());
  if (f) openActionModal(f.id); else if (confirm(`Kod "${clean}" nie istnieje. Dodać?`)) openNewItemModal(clean);
}
window.handleManualBarcodeSubmit = function(e) { e.preventDefault(); handleScannedCode(safeVal('barcodeInput')); safeVal('barcodeInput', ''); }

window.toggleCamera = function() {
  const c = el('cameraContainer'), b = el('btnToggleCamera');
  if (isCameraRunning && html5QrCode) { html5QrCode.stop().then(() => { c.classList.add('hidden'); b.innerText = 'Skaner QR'; isCameraRunning = false; }); return; }
  c.classList.remove('hidden'); b.innerText = 'Zatrzymaj';
  html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 140 } }, (d) => { html5QrCode.stop().then(() => { c.classList.add('hidden'); b.innerText = 'Skaner QR'; isCameraRunning = false; handleScannedCode(d); }); }, () => {}).then(() => { isCameraRunning = true; }).catch(() => { alert("Błąd kamery."); c.classList.add('hidden'); b.innerText = 'Skaner QR'; });
}

window.openPrintLabelModal = function() {
  const it = inventory.find(i => String(i.id) === String(selectedItemId)); if (!it) return;
  safeText('printItemName', it.name); safeText('printItemCategory', `${it.category} • ${it.location}`); safeText('printItemBarcode', it.barcode);
  const qrel = el('printQRCode');
  if (qrel) { qrel.innerHTML = ''; new QRCode(qrel, { text: it.barcode, width: 140, height: 140 }); }
  document.body.classList.remove('print-mode-sheet'); document.body.classList.add('print-mode-qr'); window.print();
}

window.openInvoiceUploadModal = function() { resetInvoicePhotos(); showModal('invoiceCaptureModal'); };
window.closeInvoiceUploadModal = function() { hideModal('invoiceCaptureModal'); };
window.resetInvoicePhotos = function() { invoiceFilePart1 = null; invoiceFilePart2 = null; [1, 2].forEach(s => { el(`invoiceSlot${s}Empty`)?.classList.remove('hidden'); el(`invoiceSlot${s}Preview`)?.classList.add('hidden'); el(`invoiceSlot${s}Done`)?.classList.add('hidden'); safeVal(`invoicePhotoInput${s}`, ''); }); if (el('btnProcessInvoice')) el('btnProcessInvoice').disabled = true; };

window.handleInvoicePhotoSelected = async function(e, slot) {
  const files = Array.from(e.target.files || []); if (files.length === 0) return;
  try {
    if (files.length >= 2 && slot === 1) { invoiceFilePart1 = await prepareFileForGemini(files[0]); invoiceFilePart2 = await prepareFileForGemini(files[1]); updateSlotUI(1, invoiceFilePart1); updateSlotUI(2, invoiceFilePart2); }
    else { const prep = await prepareFileForGemini(files[0]); if (slot === 1) { invoiceFilePart1 = prep; updateSlotUI(1, prep); } else { invoiceFilePart2 = prep; updateSlotUI(2, prep); } }
    if (el('btnProcessInvoice')) el('btnProcessInvoice').disabled = !(invoiceFilePart1 || invoiceFilePart2);
  } catch (err) { alert(err.message || "Błąd pliku."); } e.target.value = '';
};
function updateSlotUI(slot, prep) { el(`invoiceSlot${slot}Empty`)?.classList.add('hidden'); const prev = el(`invoiceSlot${slot}Preview`); if (prev && !prep.isPdf) { prev.src = prep.previewUrl; prev.classList.remove('hidden'); } el(`invoiceSlot${slot}Done`)?.classList.remove('hidden'); }

function prepareFileForGemini(file, maxW = 950, q = 0.65) {
  return new Promise((res, rej) => {
    if (!file) return rej(new Error("Brak pliku"));
    if (file.name?.toLowerCase().endsWith('.xls') || file.name?.toLowerCase().endsWith('.xlsx')) return rej(new Error("Zapisz Excel jako PDF lub zrzut ekranu."));
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      const r = new FileReader(); r.onload = () => res({ mimeType: 'application/pdf', base64: r.result.split(',')[1], previewUrl: r.result, isPdf: true }); r.onerror = rej; r.readAsDataURL(file);
    } else {
      const img = new Image(); img.onload = () => {
        let w = img.width, h = img.height; if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const url = cv.toDataURL('image/jpeg', q); res({ mimeType: 'image/jpeg', base64: url.split(',')[1], previewUrl: url, isPdf: false });
      }; img.onerror = rej; img.src = URL.createObjectURL(file);
    }
  });
}

window.queryGeminiAPI = async function(promptText, mediaParts = []) {
  const models = ['gemini-3.5-flash-lite', 'gemini-1.5-flash', 'gemini-3.8-flash', 'gemini-1.5-pro'];
  const parts = [{ text: promptText }, ...mediaParts.map(m => typeof m === 'string' ? { inline_data: { mime_type: 'image/jpeg', data: m } } : { inline_data: { mime_type: m.mimeType || 'image/jpeg', data: m.base64 } })];
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const m of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: "application/json", temperature: 0.1 } })
        });
        const j = await res.json(); 
        if (j.error) { lastErr = j.error.message; continue; }
        if (j.candidates?.[0]?.content) { return JSON.parse(j.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim()); }
      } catch (e) { lastErr = e.message; }
    }
    if (attempt < 4) {
       safeText('aiLoadingText', `Serwery przeciążone. Ponawiam próbę (${attempt}/4)...`);
       await new Promise(r => setTimeout(r, 2500));
    }
  }
  throw new Error("Serwery Google AI są przeciążone (" + lastErr + "). Spróbuj ponownie za chwilę.");
}

window.startMultiInvoiceProcessing = function() {
  const parts = [invoiceFilePart1, invoiceFilePart2].filter(Boolean); if (parts.length === 0) return;
  hideModal('invoiceCaptureModal'); showModal('aiModal'); el('aiLoadingState')?.classList.remove('hidden'); el('aiItemsContainer')?.classList.add('hidden'); el('aiModalActions')?.classList.add('hidden');
  window.queryGeminiAPI(`Przeanalizuj fakturę/WZ. SZCZEGÓŁOWE ZASADY: 1) ZIGNORUJ CAŁKOWICIE wszystkie wiersze zaczynające się słowami "Opłata" (np. OplataCukier, OplataKofeinaTauryna), "Cena zaokrąglona za sztuke" oraz "Kaucja". Traktuj je jako część głównego produktu, absolutnie NIE twórz z nich osobnych pozycji. 2) Kolumnę z ilością (qty) pobierz jako całkowitą sumę zgrzewek lub sztuk (zależnie od głównej kolumny Ilość). 3) CENA NETTO (netUnitPrice): Odczytaj całkowitą "Wartość Netto" dla danej pozycji z faktury i samodzielnie podziel ją przez wyczytaną wcześniej ilość (netUnitPrice = WartoscNetto / Ilość). Zwróć ściśle JSON: { "supplier": string, "docNumber": string, "items": [{ "name": string, "qty": number, "unit": string, "packSize": number, "netUnitPrice": number, "vatRate": number, "baseUnitPrice": number, "discountPercent": number }], "deposits": [{ "name": string, "qty": number, "unitPrice": number, "category": string }] }`, parts).then(parsed => {
    const processedItems = (parsed.items || []).map(it => {
      const mult = detectSmartPackMultiplier(it.name, it.unit, Number(it.packSize) || 1, Number(it.netUnitPrice) || 0), rawQty = Number(it.qty) || 1, rawPrice = Number(it.netUnitPrice) || 0, rawBase = Number(it.baseUnitPrice) || rawPrice, finalQty = mult > 1 ? rawQty * mult : rawQty, finalPrice = mult > 1 ? +(rawPrice / mult).toFixed(2) : +rawPrice.toFixed(2), finalBase = mult > 1 ? +(rawBase / mult).toFixed(2) : +rawBase.toFixed(2);
      return { name: String(it.name || '').trim(), qty: finalQty, unit: mult > 1 ? 'szt.' : (it.unit || 'szt.'), packSize: mult, price: finalPrice, vat: Number(it.vatRate) || 23, basePrice: finalBase, discountPercent: Number(it.discountPercent) || 0, category: classifyProductSmartLocal(it.name) || 'Napoje • Pozostałe' };
    });
    currentExtractedDelivery = { supplier: parsed.supplier || 'Hurtownia', docNumber: parsed.docNumber || ('FV/' + new Date().toLocaleDateString('pl-PL')), receiver: '', items: processedItems, deposits: (parsed.deposits || []).map(d => ({ name: d.name || 'Kaucja', qty: Number(d.qty) || 1, unitPrice: Number(d.unitPrice) || 0.50, category: d.category || (Number(d.unitPrice) === 1 ? 'BUTELKA_SZKLO' : (Number(d.unitPrice) === 0.5 ? 'PET_CAN_050' : 'SKRZYNKA')) })), images: parts.map(p => p.previewUrl) };
    safeVal('aiSupplierInput', currentExtractedDelivery.supplier); safeVal('aiDocNumInput', currentExtractedDelivery.docNumber); safeVal('aiReceiverInput', 'Bartek'); renderAiModalItems(); checkInvoiceDuplicateLive();
    el('aiLoadingState')?.classList.add('hidden'); el('aiItemsContainer')?.classList.remove('hidden'); el('aiModalActions')?.classList.remove('hidden');
  }).catch(err => { hideModal('aiModal'); alert("Błąd AI: " + err.message); });
};

window.closeAiModal = function() { hideModal('aiModal'); currentExtractedDelivery = null; };
window.renderAiModalItems = function() {
  if (!currentExtractedDelivery) return; const list = el('aiItemsList');
  if (list) {
      list.innerHTML = currentExtractedDelivery.items.map((it, idx) => {
        const match = findBestInventoryMatch(it.name);
        return `<div class="bg-slate-900 border border-slate-700 p-2.5 rounded-xl space-y-1.5 text-xs"><div class="flex justify-between items-center gap-2"><input type="text" value="${it.name.replace(/"/g, '&quot;')}" oninput="currentExtractedDelivery.items[${idx}].name=this.value" class="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 font-bold text-white"><button type="button" onclick="currentExtractedDelivery.items.splice(${idx},1);window.renderAiModalItems()" class="text-rose-400 font-bold px-1.5 cursor-pointer">✕</button></div><div class="grid grid-cols-4 gap-1.5 items-center"><div><span class="text-[9px] text-slate-400 block">Ilość (${it.unit}):</span><input type="number" value="${it.qty}" oninput="currentExtractedDelivery.items[${idx}].qty=parseFloat(this.value)||0;window.recalcAiModalTotals()" class="w-full bg-slate-800 border border-emerald-600/60 rounded p-1 text-center font-black text-emerald-400"></div><div><span class="text-[9px] text-slate-400 block">Netto szt.:</span><input type="number" step="0.01" value="${it.price}" oninput="currentExtractedDelivery.items[${idx}].price=parseFloat(this.value)||0;window.recalcAiModalTotals()" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold text-white"></div><div><span class="text-[9px] text-slate-400 block">VAT %:</span><input type="number" value="${it.vat || 23}" oninput="currentExtractedDelivery.items[${idx}].vat=parseInt(this.value)||23;window.recalcAiModalTotals()" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold text-amber-300"></div><div><span class="text-[9px] text-slate-400 block">Kat:</span><input type="text" list="categoryPresetsList" value="${it.category}" onchange="currentExtractedDelivery.items[${idx}].category=this.value" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-[10px] text-slate-200"></div></div><div class="text-[10px] ${match ? 'text-indigo-300' : 'text-amber-300'}">${match ? `🔗 Połączy z: ${match.name} (Stan: ${match.qty})` : `✨ Nowa pozycja`} ${it.packSize > 1 ? `• Zgrzewka (x${it.packSize})` : ''}</div></div>`;
      }).join('');
  }
  const depList = el('aiDepositsList');
  if(depList) {
      depList.innerHTML = currentExtractedDelivery.deposits.map((d, idx) => `<div class="bg-slate-900 border border-cyan-800/60 p-2 rounded-xl grid grid-cols-12 gap-1.5 items-center text-xs"><input type="text" value="${d.name.replace(/"/g, '&quot;')}" oninput="currentExtractedDelivery.deposits[${idx}].name=this.value" class="col-span-6 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-bold"><input type="number" value="${d.qty}" oninput="currentExtractedDelivery.deposits[${idx}].qty=parseInt(this.value)||0;window.recalcAiModalTotals()" class="col-span-2 bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold text-cyan-400"><input type="number" step="0.01" value="${d.unitPrice}" oninput="currentExtractedDelivery.deposits[${idx}].unitPrice=parseFloat(this.value)||0;window.recalcAiModalTotals()" class="col-span-3 bg-slate-800 border border-slate-700 rounded p-1 text-center text-white"><button type="button" onclick="currentExtractedDelivery.deposits.splice(${idx},1);window.renderAiModalItems()" class="col-span-1 text-rose-400 font-bold text-center cursor-pointer">✕</button></div>`).join('');
  }
  window.recalcAiModalTotals();
};
window.addManualDepositRowToModal = function() { if (!currentExtractedDelivery) return; currentExtractedDelivery.deposits.push({ name: 'Kaucja PET / Puszka', qty: 12, unitPrice: 0.50, category: 'PET_CAN_050' }); renderAiModalItems(); };
window.recalcAiModalTotals = function() {
  if (!currentExtractedDelivery) return;
  let totalNet = 0, totalVat = 0;
  currentExtractedDelivery.items.forEach(i => {
     const net = (Number(i.qty) || 0) * (Number(i.price) || 0);
     totalNet += net; totalVat += net * ((Number(i.vat) || 23) / 100);
  });
  const depSum = currentExtractedDelivery.deposits.reduce((s, d) => s + ((Number(d.qty) || 0) * (Number(d.unitPrice) || 0)), 0);
  currentExtractedDelivery.totalNet = totalNet;
  currentExtractedDelivery.totalGross = totalNet + totalVat + depSum;
  
  safeVal('aiTotalNetInput', totalNet.toFixed(2));
  safeVal('aiTotalDepositsSumInput', depSum.toFixed(2));
  safeVal('aiTotalNetWithDepInput', (totalNet + depSum).toFixed(2));
  safeVal('aiTotalGrossInput', (totalNet + totalVat + depSum).toFixed(2));
};
window.confirmAndApplyDelivery = async function(mode) {
  if (!currentExtractedDelivery) return; const docNum = safeVal('aiDocNumInput').trim() || 'FV', supplier = safeVal('aiSupplierInput').trim() || 'Dostawca', receiver = safeVal('aiReceiverInput').trim() || 'Magazyn';
  if (mode === 'FULL_DELIVERY' && checkInvoiceDuplicateLive()) return;
  for (const it of currentExtractedDelivery.items) {
    const existing = findBestInventoryMatch(it.name), cat = classifyProductSmartLocal(it.name, it.category) || it.category || 'Napoje';
    learnProductRule(it.name, cat, it.unit, '', it.packSize, it.basePrice, it.discountPercent);
    if (existing) {
      if (Number(existing.price) > 0 && Number(it.price) > 0 && Math.abs(Number(existing.price) - Number(it.price)) >= 0.05) { const alertObj = { id: Date.now().toString() + Math.random().toString().slice(2, 5), item_name: existing.name, old_price: existing.price, new_price: it.price, supplier, doc_number: docNum, created_at: new Date() }; priceAlerts.unshift(alertObj); if (isCloudOnline) { apiRequest('/price_alerts', 'POST', alertObj).catch(()=>{}); } }
      if (mode === 'FULL_DELIVERY') { existing.qty = (Number(existing.qty) || 0) + (Number(it.qty) || 0); recordStockLog(existing.id, existing.name, 'Dostawa FV', Number(it.qty) || 0, `${docNum} (${supplier})`); }
      if (Number(it.price) > 0) existing.price = Number(it.price); if (Number(it.basePrice) > 0) existing.basePrice = Number(it.basePrice); if (Number(it.discountPercent) >= 0) existing.discountPercent = Number(it.discountPercent); existing.category = cat; existing.vat = it.vat || 23;
      if (isCloudOnline) { apiRequest(`/inventory?id=eq.${existing.id}`, 'PATCH', toDbItem(existing)).catch(()=>{}); }
    } else {
      const newItem = normalizeItem({ id: Date.now().toString() + Math.floor(Math.random() * 1000), barcode: 'RC-' + Math.floor(100000 + Math.random() * 900000), name: it.name, category: cat, location: '-', qty: mode === 'FULL_DELIVERY' ? (Number(it.qty) || 0) : 0, inField: 0, minQty: 6, unit: it.unit || 'szt.', price: Number(it.price) || 0, basePrice: Number(it.basePrice) || Number(it.price) || 0, discountPercent: Number(it.discountPercent) || 0, vat: it.vat || 23 });
      inventory.push(newItem); if (mode === 'FULL_DELIVERY') recordStockLog(newItem.id, newItem.name, 'Nowy z FV', newItem.qty, docNum);
      if (isCloudOnline) { apiRequest('/inventory', 'POST', toDbItem(newItem)).catch(()=>{}); }
    }
  }
  if (mode === 'FULL_DELIVERY') {
    for (const d of currentExtractedDelivery.deposits) {
      const exDep = findBestDepositMatch(d.name, d.unitPrice);
      if (exDep) { exDep.qty = (Number(exDep.qty) || 0) + (Number(d.qty) || 0); if (isCloudOnline) { apiRequest(`/deposits?id=eq.${exDep.id}`, 'PATCH', { qty: exDep.qty }).catch(()=>{}); } }
      else { const newDep = { id: Date.now().toString() + Math.floor(Math.random() * 999), name: d.name, category: d.category || 'PET_CAN_050', unit_price: Number(d.unitPrice) || 0.50, qty: Number(d.qty) || 0, created_at: new Date() }; deposits.push(newDep); if (isCloudOnline) { apiRequest('/deposits', 'POST', newDep).catch(()=>{}); } }
    }
    const newDeliv = { id: Date.now().toString(), supplier, doc_number: docNum, receiver, total_net: safeVal('aiTotalNetInput'), total_net_with_dep: safeVal('aiTotalNetWithDepInput'), total_gross: safeVal('aiTotalGrossInput'), items_json: JSON.stringify({ items: currentExtractedDelivery.items, deposits: currentExtractedDelivery.deposits, receiver }), image_url: JSON.stringify(currentExtractedDelivery.images || []), created_at: new Date() };
    deliveries.unshift(newDeliv); safeSetLocal('magazyn_offline_deliveries', deliveries); if (isCloudOnline) { apiRequest('/deliveries', 'POST', newDeliv).catch(()=>{}); }
  }
  safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_deposits', deposits); safeSetLocal('magazyn_offline_price_alerts', priceAlerts); closeAiModal(); renderInventory(); renderDeliveries(); renderDeposits(); renderPriceAlerts(); triggerScanFeedback(); alert(mode === 'FULL_DELIVERY' ? `📥 Przyjęto fakturę!` : `📚 Zaktualizowano katalog!`);
};

window.renderDeliveries = function() {
  const list = el('deliveriesList'); if (!list) return; if (deliveries.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak faktur.</div>`; return; }
  list.innerHTML = deliveries.map(d => {
    let parsed = { items: [], deposits: [], receiver: d.receiver || '' };
    try { const raw = typeof d.items_json === 'string' ? JSON.parse(d.items_json) : (d.items_json || {}); if (Array.isArray(raw)) parsed.items = raw; else { parsed.items = raw.items || []; parsed.deposits = raw.deposits || []; parsed.receiver = raw.receiver || d.receiver || ''; } } catch (e) {}
    const imgs = parseDeliveryImages(d.image_url), dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString('pl-PL') : '-';
    return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 space-y-2.5 shadow cursor-pointer"><div class="flex justify-between items-start gap-2 flex-wrap"><div><div class="flex items-center gap-2 flex-wrap"><span class="font-mono text-xs font-black text-amber-400">${d.doc_number || 'FV'}</span><span class="text-xs font-bold text-white">${d.supplier || 'Dostawca'}</span><span class="text-[10px] text-slate-400">📅 ${dateStr}</span>${parsed.receiver ? `<span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded font-bold">👤 ${parsed.receiver}</span>` : ''}</div><div class="flex items-center gap-3 text-[11px] mt-1"><span class="text-emerald-400 font-bold">Netto: ${d.total_net || '0.00'} zł</span>${d.total_net_with_dep ? `<span class="text-cyan-300 font-bold">Z kaucją: ${d.total_net_with_dep} zł</span>` : ''}<span class="text-slate-300">Brutto: ${d.total_gross || '0.00'} zł</span></div></div><div class="flex gap-1.5">${imgs.length > 0 ? `<button type="button" onclick="window.openDeliveryPreview('${d.id}')" class="bg-slate-700 text-indigo-300 text-xs px-2.5 py-1.5 rounded-xl font-bold cursor-pointer">🖼️ (${imgs.length})</button>` : ''}<button type="button" onclick="window.openEditDeliveryModal('${d.id}')" class="bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl font-bold cursor-pointer relative z-50">✏️ Edytuj</button><button type="button" onclick="window.deleteDelivery('${d.id}')" class="bg-rose-950 text-rose-300 border border-rose-700/50 text-xs px-2.5 py-1.5 rounded-xl font-bold cursor-pointer">🗑️</button></div></div><div class="bg-slate-900 rounded-xl p-2 text-[11px] space-y-1 max-h-40 overflow-y-auto">${parsed.items.map((it, i) => `<div class="flex justify-between text-slate-300 border-b border-slate-800/50 pb-0.5"><span>${i + 1}. ${it.name}</span><span class="font-bold text-emerald-400">${it.qty} ${it.unit || 'szt.'} • ${Number(it.price || 0).toFixed(2)} zł</span></div>`).join('')}${parsed.deposits.map(dep => `<div class="flex justify-between text-cyan-300 border-b border-slate-800/50 pb-0.5"><span>♻️ ${dep.name}</span><span class="font-bold">${dep.qty} szt. • ${Number(dep.unitPrice || 0).toFixed(2)} zł</span></div>`).join('')}</div></div>`;
  }).join('');
};
window.openDeliveryPreview = function(id) { const d = deliveries.find(x => String(x.id) === String(id)); if (!d) return; const imgs = parseDeliveryImages(d.image_url); if (imgs.length > 0) openImagePreviewModal(`${d.doc_number}`, imgs); };

window.openEditDeliveryModal = function(id) {
  const d = deliveries.find(x => String(x.id) === String(id)); if (!d) return;
  let parsed = { items: [], deposits: [], receiver: d.receiver || '' };
  try { const raw = typeof d.items_json === 'string' ? JSON.parse(d.items_json) : (d.items_json || {}); if (Array.isArray(raw)) parsed.items = raw; else { parsed.items = raw.items || []; parsed.deposits = raw.deposits || []; parsed.receiver = raw.receiver || d.receiver || ''; } } catch (e) {}
  
  const modalIdField = document.getElementById('editDelivId');
  if(modalIdField) {
    modalIdField.value = d.id; 
    safeVal('editDelivSupplier', d.supplier || ''); 
    safeVal('editDelivDocNum', d.doc_number || ''); 
    safeVal('editDelivReceiver', parsed.receiver || ''); 
    safeVal('editDelivTotalNet', d.total_net || '0.00'); 
    safeVal('editDelivTotalNetWithDep', d.total_net_with_dep || '0.00'); 
    safeVal('editDelivTotalGross', d.total_gross || '0.00');
    editingDeliveryItems = JSON.parse(JSON.stringify(parsed.items || [])); 
    editingDeliveryPhotos = parseDeliveryImages(d.image_url); 
    renderEditDeliveryItems(); 
    renderEditDeliveryPhotos(); 
    showModal('editDeliveryModal');
  }
};

window.renderEditDeliveryItems = function() { const l = el('editDelivItemsList'); if(l) l.innerHTML = editingDeliveryItems.map((it, idx) => `<div class="grid grid-cols-12 gap-1.5 items-center bg-slate-900 p-1.5 rounded-lg"><input type="text" value="${(it.name || '').replace(/"/g, '&quot;')}" oninput="editingDeliveryItems[${idx}].name=this.value" class="col-span-6 bg-slate-800 border border-slate-700 rounded p-1 text-white"><input type="number" value="${it.qty || 0}" oninput="editingDeliveryItems[${idx}].qty=parseFloat(this.value)||0" class="col-span-2 bg-slate-800 border border-slate-700 rounded p-1 text-center text-emerald-400 font-bold"><input type="number" step="0.01" value="${it.price || 0}" oninput="editingDeliveryItems[${idx}].price=parseFloat(this.value)||0" class="col-span-3 bg-slate-800 border border-slate-700 rounded p-1 text-center text-white"><button type="button" onclick="editingDeliveryItems.splice(${idx},1);window.renderEditDeliveryItems()" class="col-span-1 text-rose-400 font-bold cursor-pointer">✕</button></div>`).join(''); };
window.addEditDeliveryItemRow = function() { editingDeliveryItems.push({ name: 'Nowa pozycja', qty: 1, unit: 'szt.', price: 0 }); renderEditDeliveryItems(); };
window.renderEditDeliveryPhotos = function() { const p = el('editDelivPhotosList'); if(p) p.innerHTML = editingDeliveryPhotos.map((src, idx) => `<div class="relative flex-shrink-0"><img src="${src}" class="h-16 w-16 object-cover rounded-lg border border-slate-600"><button type="button" onclick="editingDeliveryPhotos.splice(${idx},1);window.renderEditDeliveryPhotos()" class="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-[10px] font-bold cursor-pointer">✕</button></div>`).join(''); };
window.handleEditDeliveryAddPhoto = async function(e) { const file = e.target.files[0]; if (!file) return; prepareFileForGemini(file).then(p => { editingDeliveryPhotos.push(p.previewUrl); renderEditDeliveryPhotos(); }).catch(()=>{}); e.target.value = ''; };

window.saveEditedDelivery = async function(e) {
  e.preventDefault(); const d = deliveries.find(x => String(x.id) === String(safeVal('editDelivId'))); if (!d) return; let depositsBackup = [];
  try { const raw = typeof d.items_json === 'string' ? JSON.parse(d.items_json) : (d.items_json || {}); depositsBackup = raw.deposits || []; } catch (err) {}
  d.supplier = safeVal('editDelivSupplier').trim(); d.doc_number = safeVal('editDelivDocNum').trim(); d.receiver = safeVal('editDelivReceiver').trim(); d.total_net = safeVal('editDelivTotalNet').trim(); d.total_net_with_dep = safeVal('editDelivTotalNetWithDep').trim(); d.total_gross = safeVal('editDelivTotalGross').trim(); d.items_json = JSON.stringify({ items: editingDeliveryItems, deposits: depositsBackup, receiver: d.receiver }); d.image_url = JSON.stringify(editingDeliveryPhotos);
  safeSetLocal('magazyn_offline_deliveries', deliveries); renderDeliveries(); hideModal('editDeliveryModal'); if (isCloudOnline) { apiRequest(`/deliveries?id=eq.${d.id}`, 'PATCH', d).catch(()=>{}); }
};

window.deleteDelivery = async function(id) {
  const d = deliveries.find(x => String(x.id) === String(id)); if (!d) return; if (!confirm(`Usunąć fakturę i cofnąć towary?`)) return;
  try {
    const raw = typeof d.items_json === 'string' ? JSON.parse(d.items_json) : (d.items_json || {}); const items = Array.isArray(raw) ? raw : (raw.items || []), deps = Array.isArray(raw) ? [] : (raw.deposits || []);
    for (const it of items) { const inv = findBestInventoryMatch(it.name); if (inv) { inv.qty = Math.max(0, (Number(inv.qty) || 0) - (Number(it.qty) || 0)); if (isCloudOnline) { apiRequest(`/inventory?id=eq.${inv.id}`, 'PATCH', { qty: inv.qty }).catch(()=>{}); } } }
    for (const dep of deps) { const exDep = findBestDepositMatch(dep.name, dep.unitPrice); if (exDep) { exDep.qty = Math.max(0, (Number(exDep.qty) || 0) - (Number(dep.qty) || 0)); if (isCloudOnline) { apiRequest(`/deposits?id=eq.${exDep.id}`, 'PATCH', { qty: exDep.qty }).catch(()=>{}); } } }
  } catch (e) {}
  deliveries = deliveries.filter(x => String(x.id) !== String(id)); safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_deposits', deposits); safeSetLocal('magazyn_offline_deliveries', deliveries); renderInventory(); renderDeposits(); renderDeliveries(); if (isCloudOnline) { apiRequest(`/deliveries?id=eq.${id}`, 'DELETE').catch(()=>{}); }
};

window.renderDeposits = function() {
  const list = el('depositsList'); if (!list) return;
  let petQty = 0, petVal = 0, glassQty = 0, glassVal = 0, crateQty = 0, crateVal = 0;
  deposits.forEach(d => { const q = Number(d.qty) || 0, p = Number(d.unit_price) || 0, v = q * p; if (d.category === 'PET_CAN_050' || Math.abs(p - 0.5) < 0.05) { petQty += q; petVal += v; } else if (d.category === 'BUTELKA_SZKLO' || Math.abs(p - 1.0) < 0.05) { glassQty += q; glassVal += v; } else { crateQty += q; crateVal += v; } });
  safeText('depStatPetQty', `${petQty} szt.`); safeText('depStatPetVal', `${petVal.toFixed(2)} zł`); safeText('depStatGlassQty', `${glassQty} szt.`); safeText('depStatGlassVal', `${glassVal.toFixed(2)} zł`); safeText('depStatCratesQty', `${crateQty} szt.`); safeText('depStatCratesVal', `${crateVal.toFixed(2)} zł`);
  const totalVal = petVal + glassVal + crateVal; safeText('statTotalDeposits', `${totalVal.toFixed(2)} zł`);
  const badge = el('depositsCountBadge'); if (badge) { if (deposits.length > 0) { badge.innerText = deposits.length; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
  if (deposits.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak pozycji kaucyjnych.</div>`; return; }
  list.innerHTML = deposits.map(d => {
    const val = ((Number(d.qty) || 0) * (Number(d.unit_price) || 0)).toFixed(2);
    return `<div class="bg-slate-800 border border-cyan-800/50 rounded-xl p-3 flex items-center justify-between gap-2"><div><h4 class="font-bold text-xs text-white">${d.name}</h4><p class="text-[10px] text-cyan-400 font-bold">${Number(d.unit_price).toFixed(2)} zł / szt. • Wartość: ${val} zł</p></div><div class="flex items-center gap-1.5"><button type="button" onclick="window.adjustDepositQty('${d.id}', -1)" class="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold text-xs cursor-pointer">-</button><span class="font-black text-sm text-cyan-300 min-w-[36px] text-center">${d.qty}</span><button type="button" onclick="window.adjustDepositQty('${d.id}', 1)" class="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold text-xs cursor-pointer">+</button><button type="button" onclick="window.deleteDeposit('${d.id}')" class="text-rose-400 text-xs ml-1 cursor-pointer">🗑️</button></div></div>`;
  }).join('');
};
window.openNewDepositModal = function() { safeVal('depModalId', ''); safeVal('depModalName', 'Kaucja PET / Puszka 0,50 zł'); safeVal('depModalCategory', 'PET_CAN_050'); safeVal('depModalPrice', '0.50'); safeVal('depModalQty', '12'); showModal('depositModal'); };
window.handleDepCategoryPreset = function() { const c = safeVal('depModalCategory'); if (c === 'PET_CAN_050') { safeVal('depModalPrice', '0.50'); safeVal('depModalName', 'Kaucja PET / Puszka 0,50 zł'); } else if (c === 'BUTELKA_SZKLO') { safeVal('depModalPrice', '1.00'); safeVal('depModalName', 'Kaucja Butelka Szkło 1,00 zł'); } else if (c === 'SKRZYNKA') { safeVal('depModalPrice', '15.00'); safeVal('depModalName', 'Skrzynka plastikowa zwrotna'); } else { safeVal('depModalPrice', '50.00'); safeVal('depModalName', 'Paleta EURO'); } };
window.saveDepositModal = async function(e) {
  e.preventDefault(); const name = safeVal('depModalName').trim(), category = safeVal('depModalCategory'), unit_price = parseFloat(safeVal('depModalPrice')) || 0, qty = parseInt(safeVal('depModalQty')) || 0; const ex = findBestDepositMatch(name, unit_price); 
  if (ex) { ex.qty = (Number(ex.qty) || 0) + qty; if (isCloudOnline) { apiRequest(`/deposits?id=eq.${ex.id}`, 'PATCH', { qty: ex.qty }).catch(()=>{}); } } else { const nd = { id: Date.now().toString(), name, category, unit_price, qty, created_at: new Date() }; deposits.push(nd); if (isCloudOnline) { apiRequest('/deposits', 'POST', nd).catch(()=>{}); } } safeSetLocal('magazyn_offline_deposits', deposits); renderDeposits(); hideModal('depositModal'); 
};
window.adjustDepositQty = async function(id, delta) { const d = deposits.find(x => String(x.id) === String(id)); if (!d) return; d.qty = Math.max(0, (Number(d.qty) || 0) + delta); safeSetLocal('magazyn_offline_deposits', deposits); renderDeposits(); if (isCloudOnline) { apiRequest(`/deposits?id=eq.${d.id}`, 'PATCH', { qty: d.qty }).catch(()=>{}); } };
window.deleteDeposit = async function(id) { if (!confirm("Usunąć tę pozycję kaucyjną?")) return; deposits = deposits.filter(x => String(x.id) !== String(id)); safeSetLocal('magazyn_offline_deposits', deposits); renderDeposits(); if (isCloudOnline) { apiRequest(`/deposits?id=eq.${id}`, 'DELETE').catch(()=>{}); } };

window.renderEvents = function() {
  const list = el('eventsList'); if (!list) return;
  const activeCount = events.filter(e => e.status === 'W trakcie').length; const badge = el('activeEventsBadge'); if (badge) { if (activeCount > 0) { badge.innerText = activeCount; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
  if (events.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak zarejestrowanych wydań eventowych.</div>`; return; }
  list.innerHTML = events.map(ev => {
    let items = []; try { items = typeof ev.items_json === 'string' ? JSON.parse(ev.items_json) : (ev.items_json || []); } catch (e) {}
    const isActive = ev.status === 'W trakcie';
    const cost = items.reduce((sum, it) => sum + (it.consumed !== undefined ? it.consumed : (it.dispatched || 0)) * (it.netPrice || 0), 0);
    return `<div class="bg-slate-800 border ${isActive ? 'border-blue-500/70' : 'border-slate-700'} rounded-2xl p-3.5 space-y-2.5 shadow cursor-pointer"><div class="flex justify-between items-start gap-2 flex-wrap"><div><div class="flex items-center gap-2"><span class="font-mono text-xs font-black text-amber-400">${ev.event_number || '#EV'}</span><span class="text-[9px] font-bold px-2 py-0.5 rounded ${isActive ? 'bg-blue-950 text-blue-300 border border-blue-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}">${ev.status || 'W trakcie'}</span></div><h4 class="font-bold text-sm text-white mt-1">${ev.event_name || 'Realizacja'}</h4><p class="text-[10px] text-slate-400">Wydano: ${ev.dispatch_date || '-'} ${ev.return_date ? `• Rozliczono: ${ev.return_date}` : ''}</p>${ev.return_date ? `<p class="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded inline-block font-bold mt-1">Koszt towaru netto: ${cost.toFixed(2)} zł</p>` : ''}</div><div class="flex gap-1.5 flex-wrap">${isActive ? `<button type="button" onclick="window.openEventReturnModal('${ev.id}')" class="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow cursor-pointer">📥 Rozlicz</button>` : ''}<button type="button" onclick="window.printEventSheet('${ev.id}', '${isActive ? 'DISPATCH' : 'RETURN'}')" class="bg-slate-700 text-slate-200 font-bold text-xs px-2.5 py-1.5 rounded-xl cursor-pointer">🖨️ Karta</button><button type="button" onclick="window.deleteEvent('${ev.id}')" class="text-rose-400 text-xs px-1.5 cursor-pointer">🗑️</button></div></div><div class="bg-slate-900 rounded-xl p-2 text-[11px] space-y-1 max-h-44 overflow-y-auto">${items.map((it, i) => `<div class="flex justify-between text-slate-300 border-b border-slate-800/50 pb-0.5"><span>${i + 1}. ${it.name}</span><span class="font-bold text-blue-300">Wyd: ${it.dispatched} ${it.returned !== undefined ? `• Zwr: ${it.returned} • Zuż: ${it.consumed || 0}` : ''}</span></div>`).join('')}</div></div>`;
  }).join('');
};
window.processEventDispatchImage = async function(e) {
  const file = e.target.files[0]; if (!file) return; showModal('eventDispatchModal'); el('eventDispatchLoading').classList.remove('hidden'); el('eventDispatchContent').classList.add('hidden'); el('eventDispatchActions').classList.add('hidden');
  prepareFileForGemini(file).then(prep => {
    queryGeminiAPI(`Odczytaj Kartę Wydania. Zwróć JSON: { "eventNumber": string, "eventName": string, "dispatchDate": string, "items": [{ "name": string, "dispatched": number, "unit": string }] }`, [prep]).then(res => {
      currentExtractedEventDispatch = { ...res, image: prep.previewUrl }; safeVal('evDispNum', res.eventNumber || '#EV'); safeVal('evDispDate', res.dispatchDate || new Date().toLocaleDateString('pl-PL')); safeVal('evDispName', res.eventName || 'Realizacja'); el('evDispItemsList').innerHTML = (res.items || []).map((it, idx) => `<div class="flex justify-between items-center bg-slate-900 p-2 rounded-lg text-xs"><input type="text" value="${it.name}" oninput="currentExtractedEventDispatch.items[${idx}].name=this.value" class="bg-slate-800 border border-slate-700 rounded p-1 text-white flex-1 mr-2"><input type="number" value="${it.dispatched || 1}" oninput="currentExtractedEventDispatch.items[${idx}].dispatched=parseInt(this.value)||0" class="w-16 bg-slate-800 border border-blue-500 rounded p-1 text-center font-bold text-blue-400"></div>`).join(''); el('eventDispatchLoading').classList.add('hidden'); el('eventDispatchContent').classList.remove('hidden'); el('eventDispatchActions').classList.remove('hidden');
    }).catch(err => { hideModal('eventDispatchModal'); alert(err.message); });
  }).catch(err => { hideModal('eventDispatchModal'); alert(err.message); });
  e.target.value = '';
};
window.confirmAndApplyEventDispatch = async function() {
  if (!currentExtractedEventDispatch) return; const evNum = safeVal('evDispNum').trim(), evDate = safeVal('evDispDate').trim(), evName = safeVal('evDispName').trim(), items = currentExtractedEventDispatch.items || [];
  for (const it of items) { const inv = findBestInventoryMatch(it.name); if (inv) { const q = Number(it.dispatched) || 0; inv.qty = Math.max(0, inv.qty - q); inv.inField = (inv.inField || 0) + q; it.netPrice = inv.price || 0; if (isCloudOnline) { apiRequest(`/inventory?id=eq.${inv.id}`, 'PATCH', { qty: inv.qty, in_field: inv.inField }).catch(()=>{}); } } }
  const newEv = { id: Date.now().toString(), event_number: evNum, event_name: evName, dispatch_date: evDate, return_date: '', status: 'W trakcie', items_json: items, dispatch_image: currentExtractedEventDispatch.image || '', return_image: '', created_at: new Date() }; events.unshift(newEv); safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_events', events); if (isCloudOnline) { apiRequest('/events', 'POST', newEv).catch(()=>{}); } hideModal('eventDispatchModal'); renderInventory(); renderEvents();
};
window.openEventReturnModal = function(eventId) { currentActiveReturnEventId = String(eventId); el('evReturnLoading').classList.add('hidden'); el('evReturnContent').classList.remove('hidden'); el('evReturnActions').classList.remove('hidden'); safeVal('evReturnDateInput', new Date().toLocaleDateString('pl-PL')); el('evReturnEventSelect').innerHTML = events.map(ev => `<option value="${ev.id}" ${String(ev.id) === String(eventId) ? 'selected' : ''}>${ev.event_number} - ${ev.event_name}</option>`).join(''); handleReturnEventSelectChange(); showModal('eventReturnModal'); };
window.handleReturnEventSelectChange = function() {
  currentActiveReturnEventId = safeVal('evReturnEventSelect'); const ev = events.find(x => String(x.id) === String(currentActiveReturnEventId)); if (!ev) return;
  let items = []; try { items = typeof ev.items_json === 'string' ? JSON.parse(ev.items_json) : (ev.items_json || []); } catch (e) {}
  lastParsedReturnData = items.map(it => ({ ...it, returned: it.returned !== undefined ? it.returned : 0, consumed: it.consumed !== undefined ? it.consumed : it.dispatched, netPrice: it.netPrice || 0 })); renderEventReturnItems();
};
window.renderEventReturnItems = function() {
  if (!lastParsedReturnData) return;
  el('evReturnItemsList').innerHTML = lastParsedReturnData.map((it, idx) => `<div class="bg-slate-900 border border-slate-700 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"><div class="flex-1 truncate"><span class="font-bold text-white block truncate">${idx + 1}. ${it.name}</span><span class="text-[10px] text-slate-400">Wydano: ${it.dispatched} ${it.unit || 'szt.'} • Konsumpcja: <strong class="text-amber-400">${Math.max(0, it.dispatched - (it.returned || 0))}</strong></span></div><div class="flex items-center gap-1.5"><span class="text-[10px] text-emerald-300">Zwrot:</span><input type="number" min="0" max="${it.dispatched}" value="${it.returned || 0}" oninput="lastParsedReturnData[${idx}].returned=Math.max(0,parseInt(this.value)||0);lastParsedReturnData[${idx}].consumed=Math.max(0,lastParsedReturnData[${idx}].dispatched-lastParsedReturnData[${idx}].returned);window.renderEventReturnItems()" class="w-16 bg-slate-800 border border-emerald-500 rounded p-1 text-center font-black text-emerald-400"></div></div>`).join('');
};
window.processAutoEventReturnSheetImage = async function(e) {
  const file = e.target.files[0]; if (!file) return; showModal('eventReturnModal'); el('evReturnLoading').classList.remove('hidden'); el('evReturnContent').classList.add('hidden'); el('evReturnActions').classList.add('hidden');
  prepareFileForGemini(file).then(prep => {
    queryGeminiAPI(`Odczytaj Rozliczenie Zwrotu. Zwróć JSON: { "eventNumber": string, "eventName": string, "items": [{ "name": string, "dispatched": number, "returned": number, "consumed": number }] }`, [prep]).then(res => {
      const matchedEv = findBestEventMatch(res.eventNumber, res.eventName) || events[0]; if (!matchedEv) throw new Error("Brak aktywnych eventów."); currentActiveReturnEventId = matchedEv.id;
      let exItemsMap = new Map(); try { let exIt = typeof matchedEv.items_json === 'string' ? JSON.parse(matchedEv.items_json) : matchedEv.items_json; exIt.forEach(x => exItemsMap.set(cleanCanonicalKey(x.name), x.netPrice || 0)); } catch(e){}
      safeVal('evReturnDateInput', new Date().toLocaleDateString('pl-PL')); el('evReturnEventSelect').innerHTML = events.map(ev => `<option value="${ev.id}" ${String(ev.id) === String(matchedEv.id) ? 'selected' : ''}>${ev.event_number} - ${ev.event_name}</option>`).join('');
      lastParsedReturnData = (res.items || []).map(it => ({ name: it.name, dispatched: Number(it.dispatched) || 0, returned: Number(it.returned) || 0, consumed: Math.max(0, (Number(it.dispatched) || 0) - (Number(it.returned) || 0)), unit: 'szt.', netPrice: exItemsMap.get(cleanCanonicalKey(it.name)) || 0 }));
      renderEventReturnItems(); el('evReturnLoading').classList.add('hidden'); el('evReturnContent').classList.remove('hidden'); el('evReturnActions').classList.remove('hidden');
    }).catch(err => { hideModal('eventReturnModal'); alert(err.message); });
  }).catch(err => { hideModal('eventReturnModal'); alert(err.message); }); e.target.value = '';
};
window.processEventReturnSheetImage = async function(e) { return processAutoEventReturnSheetImage(e); };
window.processEventReturnProductsImage = async function(e) { return processAutoEventReturnSheetImage(e); };
window.confirmAndApplyEventReturn = async function() {
  const ev = events.find(x => String(x.id) === String(currentActiveReturnEventId)); if (!ev || !lastParsedReturnData) return;
  for (const it of lastParsedReturnData) {
    const inv = findBestInventoryMatch(it.name);
    if (inv) { const disp = Number(it.dispatched) || 0, ret = Number(it.returned) || 0; inv.inField = Math.max(0, (inv.inField || 0) - disp); inv.qty = (Number(inv.qty) || 0) + ret; recordStockLog(inv.id, inv.name, 'Zwrot z Eventu', ret, `${ev.event_number}`); if (isCloudOnline) { apiRequest(`/inventory?id=eq.${inv.id}`, 'PATCH', { qty: inv.qty, in_field: inv.inField }).catch(()=>{}); } }
  }
  ev.status = 'Rozliczony'; ev.return_date = safeVal('evReturnDateInput').trim() || new Date().toLocaleDateString('pl-PL'); ev.items_json = lastParsedReturnData; safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_events', events); if (isCloudOnline) { apiRequest(`/events?id=eq.${ev.id}`, 'PATCH', { status: ev.status, return_date: ev.return_date, items_json: ev.items_json }).catch(()=>{}); } hideModal('eventReturnModal'); renderInventory(); renderEvents(); alert(`✓ Rozliczono zwrot!`);
};
window.deleteEvent = async function(id) { if (!confirm("Usunąć ten event z historii?")) return; events = events.filter(x => String(x.id) !== String(id)); safeSetLocal('magazyn_offline_events', events); renderEvents(); if (isCloudOnline) { apiRequest(`/events?id=eq.${id}`, 'DELETE').catch(()=>{}); } };

window.processShelfCountImage = async function(e, append = false) {
  const files = Array.from(e.target.files || []); if (files.length === 0) return; if (!append) currentShelfCountItems = [];
  showModal('shelfCountModal'); el('shelfCountLoading').classList.remove('hidden'); el('shelfCountContent').classList.add('hidden'); el('shelfCountActions').classList.add('hidden');
  Promise.all(files.map(f => prepareFileForGemini(f))).then(preps => {
    queryGeminiAPI(`Policz produkty na zdjęciu. Zwróć JSON: { "items": [{ "name": string, "qty": number }] }`, preps).then(res => {
      (res.items || []).forEach(det => { const ex = currentShelfCountItems.find(x => cleanCanonicalKey(x.name) === cleanCanonicalKey(det.name)); if (ex) ex.qty += (Number(det.qty) || 1); else currentShelfCountItems.push({ name: det.name, qty: Number(det.qty) || 1 }); });
      renderShelfCountItems(); el('shelfCountLoading').classList.add('hidden'); el('shelfCountContent').classList.remove('hidden'); el('shelfCountActions').classList.remove('hidden');
    }).catch(err => { hideModal('shelfCountModal'); alert(err.message); });
  }).catch(err => { hideModal('shelfCountModal'); alert(err.message); }); e.target.value = '';
};
window.renderShelfCountItems = function() { el('shelfCountItemsList').innerHTML = currentShelfCountItems.map((it, idx) => { const match = findBestInventoryMatch(it.name); return `<div class="bg-slate-900 border border-slate-700 p-2 rounded-xl flex items-center justify-between gap-2 text-xs"><div class="flex-1 truncate"><input type="text" value="${it.name}" oninput="currentShelfCountItems[${idx}].name=this.value" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white font-bold"><span class="text-[10px] text-slate-400">${match ? `Baza: ${match.name} (Stan: ${match.qty})` : 'Nowy towar'}</span></div><input type="number" value="${it.qty}" oninput="currentShelfCountItems[${idx}].qty=parseInt(this.value)||0" class="w-16 bg-slate-800 border border-purple-500 rounded p-1 text-center font-black text-purple-300"><button type="button" onclick="currentShelfCountItems.splice(${idx},1);window.renderShelfCountItems()" class="text-rose-400 font-bold px-1 cursor-pointer">✕</button></div>`; }).join(''); };
window.applyShelfCountResults = async function(mode) {
  for (const it of currentShelfCountItems) { const match = findBestInventoryMatch(it.name); if (match) { match.qty = mode === 'SET' ? (Number(it.qty) || 0) : ((Number(match.qty) || 0) + (Number(it.qty) || 0)); if (isCloudOnline) { apiRequest(`/inventory?id=eq.${match.id}`, 'PATCH', { qty: match.qty }).catch(()=>{}); } } else { const ni = normalizeItem({ id: Date.now().toString() + Math.random().toString().slice(2, 5), barcode: 'RC-' + Math.floor(100000 + Math.random() * 900000), name: it.name, qty: Number(it.qty) || 0, minQty: 6, unit: 'szt.' }); inventory.push(ni); if (isCloudOnline) { apiRequest('/inventory', 'POST', toDbItem(ni)).catch(()=>{}); } } }
  safeSetLocal('magazyn_offline_items', inventory); hideModal('shelfCountModal'); renderInventory();
};

window.renderPriceAlerts = function() {
  const list = el('alertsList'); if (!list) return; const badge = el('alertsCountBadge'); if (badge) { if (priceAlerts.length > 0) { badge.innerText = priceAlerts.length; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
  if (priceAlerts.length === 0) { list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Brak alertów cenowych.</div>`; return; }
  list.innerHTML = priceAlerts.map(a => { const diff = (Number(a.new_price) || 0) - (Number(a.old_price) || 0); return `<div class="bg-slate-800 border ${diff > 0 ? 'border-rose-500/60' : 'border-emerald-500/60'} rounded-xl p-3 flex justify-between items-center text-xs"><div><h4 class="font-bold text-white">${a.item_name}</h4><p class="text-[10px] text-slate-400">${a.supplier || ''} • ${a.doc_number || ''}</p></div><div class="text-right"><span class="text-slate-400 line-through mr-1">${Number(a.old_price).toFixed(2)} zł</span><span class="font-black ${diff > 0 ? 'text-rose-400' : 'text-emerald-400'}">${Number(a.new_price).toFixed(2)} zł (${diff > 0 ? '+' : ''}${diff.toFixed(2)} zł)</span></div></div>`; }).join('');
};
window.clearPriceAlerts = function() { if (!confirm("Wyczyścić historię?")) return; priceAlerts = []; safeSetLocal('magazyn_offline_price_alerts', priceAlerts); renderPriceAlerts(); };
window.openImagePreviewModal = function(title, images) { safeText('imagePreviewTitle', title || 'Podgląd'); const tabs = el('imagePreviewTabs'); if (images.length > 1) { tabs.classList.remove('hidden'); tabs.innerHTML = images.map((src, i) => `<button type="button" onclick="el('imagePreviewElement').src='${src}'" class="bg-slate-800 border border-slate-600 text-xs px-3 py-1 rounded-lg text-white font-bold cursor-pointer">Strona ${i + 1}</button>`).join(''); } else tabs.classList.add('hidden'); el('imagePreviewElement').src = images[0] || ''; showModal('imagePreviewModal'); };
window.closeImagePreviewModal = function() { hideModal('imagePreviewModal'); };

window.switchMainTab = function(tab) {
  const allTabs = ['Stock', 'Events', 'Rw', 'Deliveries', 'Deposits', 'Logs', 'Alerts'];
  allTabs.forEach(t => {
    el(`view${t}`)?.classList.add('hidden');
    if (el(`tab${t}HeaderBtn`)) el(`tab${t}HeaderBtn`).className = 'pb-2 border-b-2 border-transparent text-slate-400 whitespace-nowrap font-bold cursor-pointer';
    if (el(`navBtn${t}`)) el(`navBtn${t}`).className = 'flex flex-col items-center gap-1 text-slate-400 py-1 px-2 cursor-pointer';
  });
  const styles = { stock: ['Stock', 'emerald'], events: ['Events', 'blue'], rw: ['Rw', 'amber'], deliveries: ['Deliveries', 'indigo'], deposits: ['Deposits', 'cyan'], logs: ['Logs', 'purple'], alerts: ['Alerts', 'rose'] };
  const [name, col] = styles[tab] || styles.stock;
  el(`view${name}`)?.classList.remove('hidden');
  if (el(`tab${name}HeaderBtn`)) el(`tab${name}HeaderBtn`).className = `pb-2 border-b-2 border-${col}-500 text-${col}-400 font-bold whitespace-nowrap cursor-pointer`;
  if (el(`navBtn${name}`)) el(`navBtn${name}`).className = `flex flex-col items-center gap-1 text-${col}-400 py-1 px-2 cursor-pointer`;

  if (tab === 'stock') renderInventory();
  else if (tab === 'events') renderEvents();
  else if (tab === 'rw') renderRwTransfers();
  else if (tab === 'deliveries') renderDeliveries();
  else if (tab === 'deposits') renderDeposits();
  else if (tab === 'logs') renderStockLogs();
  else if (tab === 'alerts') renderPriceAlerts();
  triggerScanFeedback();
};

window.handleItemContextMenu = function(e, id) { e.preventDefault(); contextMenuItemId = id; selectedItemId = id; const m = el('customContextMenu'); m.classList.remove('hidden'); m.style.left = `${Math.min(e.clientX, window.innerWidth - 230)}px`; m.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`; };
window.hideContextMenu = function() { el('customContextMenu')?.classList.add('hidden'); };
window.contextActionEdit = function() { hideContextMenu(); if (contextMenuItemId) window.openEditModal(contextMenuItemId); };
window.contextActionOpenStock = function() { hideContextMenu(); if (contextMenuItemId) window.openActionModal(contextMenuItemId); };
window.contextActionPrintQR = function() { hideContextMenu(); if (contextMenuItemId) { selectedItemId = contextMenuItemId; window.openPrintLabelModal(); } };
window.contextActionDelete = function() { hideContextMenu(); if (contextMenuItemId) { selectedItemId = contextMenuItemId; window.deleteCurrentItem(); } };
window.handleItemCardClick = function(e, id) { if (isSelectMode) { window.toggleSelectItem(id, !selectedItemIds.has(id)); window.renderInventory(); } else window.openActionModal(id); };

window.toggleSelectMode = function() {
  isSelectMode = !isSelectMode; const b = el('btnToggleSelectMode'), bar = el('bulkActionBar');
  if (isSelectMode) { b.innerHTML = "✕ Zakończ"; bar.classList.remove('hidden'); }
  else { b.innerHTML = "Wybór"; bar.classList.add('hidden'); selectedItemIds.clear(); }
  safeText('bulkSelectedCount', `Wybrano: ${selectedItemIds.size}`); renderInventory();
};
window.toggleSelectItem = function(id, c) { if (c) selectedItemIds.add(id); else selectedItemIds.delete(id); safeText('bulkSelectedCount', `Wybrano: ${selectedItemIds.size}`); };
window.toggleSelectAll = function() { if (selectedItemIds.size === inventory.length) selectedItemIds.clear(); else inventory.forEach(i => selectedItemIds.add(i.id)); safeText('bulkSelectedCount', `Wybrano: ${selectedItemIds.size}`); renderInventory(); };
window.deleteSelectedItems = function() {
  if (selectedItemIds.size === 0 || !confirm(`Usunąć ${selectedItemIds.size} pozycji?`)) return;
  const ids = Array.from(selectedItemIds); inventory = inventory.filter(i => !selectedItemIds.has(i.id));
  safeSetLocal('magazyn_offline_items', inventory); window.toggleSelectMode(); renderInventory();
  if (isCloudOnline) { ids.forEach(id => { apiRequest(`/inventory?id=eq.${id}`, 'DELETE').catch(()=>{}); }); }
};

window.buildRoyalCateringSheetHTML = function(data) {
  const isRw = data.isRwDoc;
  const title = isRw ? "DOKUMENT RW<br>ROZCHÓD WEWNĘTRZNY / KOSZTY" : (data.isReturn ? "ROZLICZENIE ZWROTU<br>I KONSUMPCJI<br>Z REALIZACJI" : "WYDANIE NAPOJÓW<br>I ALKOHOLU<br>NA REALIZACJĘ");
  const items = data.items || [];
  let rows = items.map((it, idx) => `<tr style="height:24px;text-align:center;"><td style="border:1px solid #000;font-weight:bold;">${idx + 1}</td><td style="border:1px solid #000;text-align:left;padding-left:6px;font-weight:bold;">${it.name}</td><td style="border:1px solid #000;">${it.unit || 'szt.'}</td><td style="border:1px solid #000;font-weight:bold;font-size:12px;">${it.dispatched !== undefined ? it.dispatched : ''}</td>${isRw ? `<td style="border:1px solid #000;font-weight:bold;">${it.netPrice ? Number(it.netPrice).toFixed(2)+' zł' : '-'}</td><td colspan="5" style="border:1px solid #000;font-weight:bold;text-align:right;padding-right:8px;">${it.rowNet ? Number(it.rowNet).toFixed(2)+' zł' : '-'}</td>` : `<td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;font-weight:bold;">${data.isReturn && it.consumed !== undefined ? it.consumed : ''}</td><td style="border:1px solid #000;background:#d9ead3;font-weight:bold;">${data.isReturn && it.returned !== undefined ? it.returned : ''}</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td>`}</tr>`).join('');
  for (let i = 0; i < Math.max(0, 15 - items.length); i++) { rows += `<tr style="height:24px;text-align:center;"><td style="border:1px solid #000;">${items.length + i + 1}</td><td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td>${isRw ? '<td colspan="6" style="border:1px solid #000;">&nbsp;</td>' : '<td style="border:1px solid #000;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;background:#d9ead3;">&nbsp;</td><td style="border:1px solid #000;">&nbsp;</td>'}</tr>`; }
  return `<div style="border:2px solid #000;width:100%;box-sizing:border-box;background:white;color:black;font-family:Arial,sans-serif;"><table style="width:100%;border-collapse:collapse;text-align:center;font-size:11px;"><tr><td rowspan="4" style="width:20%;border:2px solid #000;font-size:15px;font-weight:bold;padding:4px;">ROYAL CATERING</td><td colspan="2" style="background:#ffff00;font-weight:bold;border:1px solid #000;padding:4px;">DATA WYDANIA:</td><td rowspan="4" style="width:30%;background:#ffff00;font-size:12px;font-weight:900;border:2px solid #000;padding:5px;">${title}</td><td colspan="2" style="background:#ffff00;font-weight:bold;border:1px solid #000;padding:4px;">CEL / ODBIORCA:</td></tr><tr><td colspan="2" style="border:1px solid #000;font-weight:bold;padding:4px;">${data.dispatchDate || '-'}</td><td colspan="2" style="border:1px solid #000;padding:4px;font-weight:bold;">${isRw ? (data.eventName || 'Użytek wewnętrzny') : (data.returnDate || '-')}</td></tr><tr><td colspan="2" style="background:#ffff00;font-weight:bold;border:1px solid #000;padding:4px;">DOKUMENT, #NUMER:</td><td colspan="2" style="border:1px solid #000;padding:4px;">&nbsp;</td></tr><tr><td colspan="2" style="border:1px solid #000;font-weight:bold;padding:4px;">${data.eventNumber || ''} ${isRw ? '' : data.eventName}</td><td colspan="2" style="border:1px solid #000;padding:4px;">&nbsp;</td></tr></table><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr style="background:#ffff00;font-weight:bold;text-align:center;"><th style="border:1px solid #000;width:4%;padding:4px;">Nr</th><th style="border:1px solid #000;width:36%;padding:4px;text-align:left;">NAZWA</th><th style="border:1px solid #000;width:6%;padding:4px;">Jedn.</th><th style="border:1px solid #000;width:8%;padding:4px;">Ilość</th>${isRw ? '<th style="border:1px solid #000;width:12%;padding:4px;">Cena netto</th><th colspan="5" style="border:1px solid #000;width:34%;padding:4px;">Wartość netto</th>' : '<th style="border:1px solid #000;width:9%;padding:4px;">Podpis Magazyn</th><th style="border:1px solid #000;width:9%;background:#d9ead3;padding:4px;">Sprawdzenie</th><th style="border:1px solid #000;width:9%;background:#d9ead3;padding:4px;">Konsumpcja</th><th style="border:1px solid #000;width:7%;background:#d9ead3;padding:4px;">Zwrot</th><th style="border:1px solid #000;width:6%;background:#d9ead3;padding:4px;">Podpis</th><th style="border:1px solid #000;width:6%;padding:4px;">Odbiór</th>'}</tr></thead><tbody>${rows}</tbody></table></div>`;
};

window.openSheetPreviewModal = function(sheetData) {
  currentPreviewSheetData = sheetData;
  const html = window.buildRoyalCateringSheetHTML(sheetData);
  safeText('sheetPreviewModalTitle', `${sheetData.isRwDoc ? 'Dokument RW' : (sheetData.isReturn ? 'Rozliczenie' : 'Karta Wydania')}: ${sheetData.eventNumber} ${sheetData.eventName}`);
  el('sheetPreviewContainer').innerHTML = html; el('printableSheet').innerHTML = html; showModal('sheetPreviewModal');
};
window.triggerBrowserPrintSheet = function() { document.body.classList.remove('print-mode-qr'); document.body.classList.add('print-mode-sheet'); window.print(); };
window.downloadCurrentSheetAsExcel = function() {
  if (!currentPreviewSheetData) return;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>${window.buildRoyalCateringSheetHTML(currentPreviewSheetData)}</body></html>`;
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `${(currentPreviewSheetData.isRwDoc ? 'Dokument_RW_' : (currentPreviewSheetData.isReturn ? 'Rozliczenie_' : 'Karta_Wydania_')) + currentPreviewSheetData.eventNumber}.xls`.replace(/[^a-zA-Z0-9._-]/g, '_');
  link.click();
};

window.openRwTransferModal = function(allowEmpty = false) {
  if (!allowEmpty && selectedItemIds.size === 0 && rwCreatorMap.size === 0) return alert("Zaznacz pozycje.");
  selectedItemIds.forEach(id => { if (!rwCreatorMap.has(String(id))) { const it = inventory.find(x => String(x.id) === String(id)); rwCreatorMap.set(String(id), Math.min(it?.qty || 1, 1) || 1); } });
  safeVal('rwTransferNum', 'RW-' + String(rwTransfers.length + 1).padStart(2, '0') + '/' + new Date().getFullYear().toString().slice(-2));
  safeVal('rwTransferDate', new Date().toLocaleDateString('pl-PL')); safeVal('rwTransferDestination', '');
  el('rwTransferAddSelect').innerHTML = `<option value="">-- Wybierz towar (${inventory.length}) --</option>` + inventory.map(it => `<option value="${it.id}">[${it.category}] ${it.name} (Stan: ${it.qty} ${it.unit})</option>`).join('');
  window.renderRwCreatorItems(); showModal('rwTransferModal');
};
window.addItemToRwCreator = function() {
  const id = safeVal('rwTransferAddSelect'); if (!id) return;
  const it = inventory.find(x => String(x.id) === String(id)); if (!it) return;
  rwCreatorMap.set(String(id), (rwCreatorMap.get(String(id)) || 0) + 1);
  safeVal('rwTransferAddSelect', ''); window.renderRwCreatorItems();
};
window.renderRwCreatorItems = function() {
  const list = el('rwTransferItemsList');
  if (rwCreatorMap.size === 0) { list.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">Lista jest pusta. Wybierz towar powyżej.</div>`; safeText('rwTransferTotalValLabel', '0.00 zł netto'); return; }
  let sum = 0;
  list.innerHTML = Array.from(rwCreatorMap.entries()).map(([id, qty], idx) => {
    const it = inventory.find(x => String(x.id) === String(id)); if (!it) return '';
    const rowVal = qty * (Number(it.price) || 0); sum += rowVal;
    return `<div class="bg-slate-900 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between text-xs gap-2"><div class="flex-1 truncate"><span class="font-bold text-white block truncate">${idx + 1}. ${it.name}</span><span class="text-[10px] text-slate-400">Magazyn: ${it.qty} ${it.unit} • Koszt: ${Number(it.price).toFixed(2)} zł</span></div><div class="flex items-center gap-1.5"><span class="text-[10px] text-amber-300 font-bold">${rowVal.toFixed(2)} zł</span><input type="number" value="${qty}" min="1" max="${it.qty || 9999}" oninput="rwCreatorMap.set('${it.id}', Math.max(1, parseInt(this.value)||1)); window.renderRwCreatorItems();" class="w-16 bg-slate-800 border border-amber-500/70 rounded-lg p-1.5 text-center font-black text-amber-400 text-xs"><button type="button" onclick="rwCreatorMap.delete('${it.id}'); window.renderRwCreatorItems();" class="text-rose-400 font-bold px-1.5 cursor-pointer">✕</button></div></div>`;
  }).join('');
  safeText('rwTransferTotalValLabel', sum.toFixed(2) + ' zł netto');
};
window.finalizeRwTransfer = async function() {
  if (rwCreatorMap.size === 0) return alert("Dodaj przynajmniej jedną pozycję do RW.");
  const rwNum = safeVal('rwTransferNum').trim() || 'RW', rwDate = safeVal('rwTransferDate').trim() || new Date().toLocaleDateString('pl-PL'), rwDest = safeVal('rwTransferDestination').trim() || 'Biuro / Baza';
  const payload = []; let totalNetVal = 0;
  for (const [id, qty] of rwCreatorMap.entries()) {
    const it = inventory.find(x => String(x.id) === String(id)); if (!it) continue;
    const p = Number(it.price) || 0; const rowVal = qty * p; totalNetVal += rowVal;
    payload.push({ itemId: it.id, name: it.name, transferredQty: qty, returnedQty: 0, unit: it.unit || 'szt.', netPrice: p, rowNet: rowVal });
    it.qty = Math.max(0, it.qty - qty); recordStockLog(it.id, it.name, 'Rozchód RW', -qty, `${rwNum} • ${rwDest}`);
    if (isCloudOnline) { apiRequest(`/inventory?id=eq.${it.id}`, 'PATCH', { qty: it.qty, updated_at: new Date() }).catch(()=>{}); }
  }
  const newTransfer = { id: Date.now().toString(), transfer_number: rwNum, destination: rwDest, transfer_date: rwDate, total_net_value: totalNetVal.toFixed(2), items_json: payload, created_at: new Date() };
  rwTransfers.unshift(newTransfer); safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_rw_transfers', rwTransfers);
  rwCreatorMap.clear(); hideModal('rwTransferModal'); if (isSelectMode) window.toggleSelectMode();
  window.renderInventory(); renderRwTransfers(); window.switchMainTab('rw'); window.openSheetPreviewModal({ eventNumber: newTransfer.transfer_number, eventName: newTransfer.destination, dispatchDate: newTransfer.transfer_date, isReturn: false, isRwDoc: true, items: payload }); alert(`🏢 Zarejestrowano RW (${rwDest})!`);
};

window.openCreatorFromEventsTab = function() { sheetCreatorMap.clear(); window.openGenerateSheetModal(true); };
window.openGenerateSheetModal = function(allowEmpty = false) {
  selectedItemIds.forEach(id => { if (!sheetCreatorMap.has(String(id))) { const it = inventory.find(x => String(x.id) === String(id)); sheetCreatorMap.set(String(id), Math.min(it?.qty || 12, 12) || 1); } });
  if (!allowEmpty && sheetCreatorMap.size === 0) return alert("Wybierz pozycje z listy.");
  safeVal('genSheetNum', '#' + Math.floor(100 + Math.random() * 899));
  safeVal('genSheetDate', new Date().toLocaleDateString('pl-PL')); safeVal('genSheetName', '');
  el('genSheetAddSelect').innerHTML = `<option value="">-- Wybierz towar (${inventory.length}) --</option>` + inventory.map(it => `<option value="${it.id}">[${it.category}] ${it.name} (Stan: ${it.qty})</option>`).join('');
  window.renderSheetCreatorItems(); showModal('generateSheetModal');
};
window.addItemToSheetCreator = function() {
  const id = safeVal('genSheetAddSelect'); if (!id) return;
  const it = inventory.find(x => String(x.id) === String(id)); if (!it) return;
  sheetCreatorMap.set(String(id), (sheetCreatorMap.get(String(id)) || 0) + (Math.min(it.qty, 6) || 1));
  safeVal('genSheetAddSelect', ''); window.renderSheetCreatorItems();
};
window.renderSheetCreatorItems = function() {
  const list = el('genSheetItemsList');
  if (sheetCreatorMap.size === 0) { list.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">Wybierz towar powyżej.</div>`; return; }
  list.innerHTML = Array.from(sheetCreatorMap.entries()).map(([id, qty], idx) => {
    const it = inventory.find(x => String(x.id) === String(id)); if (!it) return '';
    return `<div class="bg-slate-900 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between text-xs gap-2"><div class="flex-1 truncate"><span class="font-bold text-white block truncate">${idx + 1}. ${it.name}</span><span class="text-[10px] text-slate-400">Stan: ${it.qty} ${it.unit}</span></div><div class="flex items-center gap-1.5"><input type="number" value="${qty}" min="1" oninput="sheetCreatorMap.set('${it.id}', Math.max(1, parseInt(this.value)||1))" class="w-16 bg-slate-800 border border-amber-500/70 rounded-lg p-1.5 text-center font-black text-amber-400 text-xs"><button type="button" onclick="sheetCreatorMap.delete('${it.id}');window.renderSheetCreatorItems()" class="text-rose-400 font-bold px-1.5 cursor-pointer">✕</button></div></div>`;
  }).join('');
};
window.finalizeSheetCreator = async function(createEvent = true) {
  if (sheetCreatorMap.size === 0) return alert("Dodaj przynajmniej jedną pozycję.");
  const evNum = safeVal('genSheetNum').trim() || '#EVENT', evDate = safeVal('genSheetDate').trim() || new Date().toLocaleDateString('pl-PL'), evName = safeVal('genSheetName').trim() || 'Realizacja Cateringowa';
  const payload = [];
  for (const [id, qty] of sheetCreatorMap.entries()) {
    const it = inventory.find(x => String(x.id) === String(id)); if (!it) continue;
    payload.push({ name: it.name, dispatched: qty, unit: it.unit || 'szt.', netPrice: it.price || 0 });
    if (createEvent) {
      it.qty = Math.max(0, it.qty - qty); it.inField = (it.inField || 0) + qty;
      recordStockLog(it.id, it.name, 'Event Wyjazd', -qty, `${evNum} ${evName}`);
      if (isCloudOnline) { apiRequest(`/inventory?id=eq.${it.id}`, 'PATCH', { qty: it.qty, in_field: it.inField, updated_at: new Date() }).catch(()=>{}); }
    }
  }
  if (createEvent) {
    const newEv = { id: Date.now().toString(), event_number: evNum, event_name: evName, dispatch_date: evDate, return_date: '', status: 'W trakcie', items_json: payload, dispatch_image: '', return_image: '', created_at: new Date() };
    events.unshift(newEv); safeSetLocal('magazyn_offline_items', inventory); safeSetLocal('magazyn_offline_events', events);
    if (isCloudOnline) { apiRequest('/events', 'POST', newEv).catch(()=>{}); }
  }
  sheetCreatorMap.clear(); hideModal('generateSheetModal'); if (isSelectMode) window.toggleSelectMode();
  window.renderInventory(); renderEvents(); window.openSheetPreviewModal({ eventNumber: evNum, eventName: evName, dispatchDate: evDate, returnDate: '', isReturn: false, items: payload });
};

// --- GŁÓWNA FUNKCJA INICJALIZACYJNA PODPINACZKA ---
function initAppBindings() {
  const bind = (id, event, func) => {
    const element = el(id);
    if (element) {
      element.addEventListener(event, func);
    }
  };

  bind('loginForm', 'submit', window.handleLogin);
  bind('btnLearnAI', 'click', () => window.queryGeminiAPI('', []).catch(()=>{ alert("AI uczy się automatycznie podczas odczytu i wprowadzania etykiet.") }));
  bind('btnMergeDups', 'click', window.mergeExistingDuplicates || function(){});
  bind('btnAudit', 'click', window.openInventoryAuditModal);
  bind('btnToolsMenu', 'click', (e) => { e.stopPropagation(); window.toggleToolsMenu(); });
  
  bind('btnCopyLowStock', 'click', window.copyLowStockWhatsApp);
  bind('btnExportCsv', 'click', window.exportCSV || function(){});
  bind('btnExportBackup', 'click', window.exportBackup);
  bind('btnImportBackup', 'click', window.triggerImport);
  bind('btnLockApp', 'click', window.lockApp);
  bind('backupInput', 'change', window.importBackup);

  ['ALL', 'ALCOHOL', 'BEVERAGE', 'DISPOSABLES', 'EXPIRING', 'LOW'].forEach(cat => {
    bind(`pillCat_${cat}`, 'click', () => window.setCategoryPill(cat));
  });

  bind('btnCountFromPhoto', 'click', () => el('shelfCountInput')?.click());
  bind('btnToggleCamera', 'click', window.toggleCamera);
  bind('barcodeSearchForm', 'submit', window.handleManualBarcodeSubmit);
  bind('searchFilter', 'input', window.renderInventory);
  bind('btnToggleSelectMode', 'click', window.toggleSelectMode);
  bind('btnSelectAll', 'click', window.toggleSelectAll);
  bind('btnBulkEvent', 'click', () => window.openGenerateSheetModal(false));
  bind('btnBulkRw', 'click', () => window.openRwTransferModal(false));
  bind('btnBulkDelete', 'click', window.deleteSelectedItems);

  bind('btnNewEventTab', 'click', window.openCreatorFromEventsTab);
  bind('dropZoneEventDisp', 'click', () => el('eventDispatchInput')?.click());
  bind('dropZoneEventRet', 'click', () => el('eventAutoReturnSheetInput')?.click());

  bind('btnNewRwTab', 'click', () => window.openRwTransferModal(true));
  
  bind('btnAddInvoice', 'click', window.openInvoiceUploadModal);
  bind('dropZoneInvoice', 'click', (e) => { if(e.target.id !== 'btnAddInvoice') window.openInvoiceUploadModal(); });

  bind('btnAddDeposit', 'click', window.openNewDepositModal);
  bind('btnClearLogs', 'click', window.clearStockLogs);
  bind('btnClearAlerts', 'click', window.clearPriceAlerts);

  bind('btnCloseInvCap', 'click', window.closeInvoiceUploadModal);
  bind('btnCloseAiModal', 'click', window.closeAiModal);
  bind('btnCloseActModal', 'click', () => hideModal('actionModal'));
  bind('btnCloseNewModal', 'click', () => hideModal('newItemModal'));
  bind('btnCloseEditModal', 'click', () => hideModal('editItemModal'));
  bind('btnCloseAudit', 'click', () => hideModal('inventoryAuditModal'));
  bind('btnCloseEdDeliv', 'click', () => hideModal('editDeliveryModal'));
  bind('btnCloseSheetPrev', 'click', () => hideModal('sheetPreviewModal'));
  bind('btnCloseImgPrev', 'click', window.closeImagePreviewModal);
  bind('btnCloseDepModal', 'click', () => hideModal('depositModal'));
  bind('btnCloseEvDisp', 'click', () => hideModal('eventDispatchModal'));
  bind('btnCloseEvRet', 'click', () => hideModal('eventReturnModal'));
  bind('btnCloseGenSheet', 'click', () => hideModal('generateSheetModal'));
  bind('btnCloseRwModal', 'click', () => hideModal('rwTransferModal'));

  bind('dropZoneSlot1', 'click', () => el('invoicePhotoInput1')?.click());
  bind('dropZoneSlot2', 'click', () => el('invoicePhotoInput2')?.click());
  bind('btnResetInv', 'click', window.resetInvoicePhotos);
  bind('btnProcessInvoice', 'click', window.startMultiInvoiceProcessing);

  bind('btnCancelAiModal', 'click', window.closeAiModal);
  bind('btnConfirmCatalogOnly', 'click', () => window.confirmAndApplyDelivery('CATALOG_ONLY'));
  bind('btnConfirmFullDelivery', 'click', () => window.confirmAndApplyDelivery('FULL_DELIVERY'));
  bind('btnAddAiDeposit', 'click', window.addManualDepositRowToModal);

  bind('btnMinusQty', 'click', () => window.adjustStepQty(-1));
  bind('btnPlusQty', 'click', () => window.adjustStepQty(1));
  bind('btnActAdd', 'click', () => window.executeStockAction('ADD'));
  bind('btnActRem', 'click', () => window.executeStockAction('REMOVE'));
  bind('btnActFld', 'click', () => window.executeStockAction('TO_FIELD'));
  bind('btnActRw', 'click', () => window.executeStockAction('TO_RW'));
  bind('btnActLoss', 'click', () => window.executeStockAction('LOSS'));
  bind('btnActDel', 'click', window.deleteCurrentItem);
  bind('btnActQr', 'click', window.openPrintLabelModal);
  bind('btnActEdit', 'click', () => window.openEditModal(window.selectedItemId));

  bind('newItemForm', 'submit', window.saveNewItem);
  bind('btnCancelNew', 'click', () => hideModal('newItemModal'));
  bind('btnNewLblPh', 'click', () => { window.currentLabelPhotoTarget = 'NEW'; el('itemLabelPhotoInput')?.click(); });
  bind('btnProcessLabelAI_NEW', 'click', window.processLabelPhotosAI);
  bind('btnNewRandCd', 'click', window.generateRandomCode);
  bind('newName', 'input', window.autoPreviewNewItemCategory);

  bind('editItemForm', 'submit', window.saveEditedItem);
  bind('btnCancelEdit', 'click', () => hideModal('editItemModal'));
  bind('btnEditLblPh', 'click', () => { window.currentLabelPhotoTarget = 'EDIT'; el('itemLabelPhotoInput')?.click(); });
  bind('btnProcessLabelAI_EDIT', 'click', window.processLabelPhotosAI);

  bind('btnCancelAudit', 'click', () => hideModal('inventoryAuditModal'));
  bind('btnFinalizeAudit', 'click', window.finalizeInventoryAudit);

  bind('editDeliveryForm', 'submit', window.saveEditedDelivery);
  bind('btnCancelEdDel', 'click', () => hideModal('editDeliveryModal'));
  bind('btnEdDelPh', 'click', () => el('editDelivPhotoInput')?.click());
  bind('btnEdDelRow', 'click', window.addEditDeliveryItemRow);

  bind('btnCancelSheetPrev', 'click', () => hideModal('sheetPreviewModal'));
  bind('btnDlExcel', 'click', window.downloadCurrentSheetAsExcel);
  bind('btnPrintPdf', 'click', window.triggerBrowserPrintSheet);
  
  bind('btnCancelImgPrev', 'click', window.closeImagePreviewModal);

  bind('depositForm', 'submit', window.saveDepositModal);
  bind('btnCancelDep', 'click', () => hideModal('depositModal'));
  bind('depModalCategory', 'change', window.handleDepCategoryPreset);

  bind('btnCancelEvDisp', 'click', () => hideModal('eventDispatchModal'));
  bind('btnConfirmEvDisp', 'click', window.confirmAndApplyEventDispatch);

  bind('btnCancelEvRet', 'click', () => hideModal('eventReturnModal'));
  bind('btnConfirmEvRet', 'click', window.confirmAndApplyEventReturn);
  bind('evReturnEventSelect', 'change', window.handleReturnEventSelectChange);

  bind('btnCancelGenSheet', 'click', () => hideModal('generateSheetModal'));
  bind('btnConfirmGenSheet', 'click', () => window.finalizeSheetCreator(true));
  bind('btnGenSheetAdd', 'click', window.addItemToSheetCreator);

  bind('btnCancelRw', 'click', () => hideModal('rwTransferModal'));
  bind('btnConfirmRw', 'click', window.finalizeRwTransfer);
  bind('btnRwAdd', 'click', window.addItemToRwCreator);

  ['Stock', 'Events', 'Rw', 'Deposits', 'Deliveries'].forEach(t => {
    bind(`navBtn${t}`, 'click', () => window.switchMainTab(t.toLowerCase()));
    bind(`tab${t}HeaderBtn`, 'click', () => window.switchMainTab(t.toLowerCase()));
  });
  bind('tabLogsHeaderBtn', 'click', () => window.switchMainTab('logs'));
  bind('tabAlertsHeaderBtn', 'click', () => window.switchMainTab('alerts'));
  
  bind('navBtnInvoice', 'click', window.openInvoiceUploadModal);
  bind('navBtnNewItem', 'click', () => window.openNewItemModal(''));
  
  bind('statBoxStock', 'click', () => window.switchMainTab('stock'));
  bind('statBoxVal', 'click', () => window.switchMainTab('stock'));
  bind('statBoxDep', 'click', () => window.switchMainTab('deposits'));
  bind('statBoxRw', 'click', () => window.switchMainTab('rw'));
  bind('statBoxEvents', 'click', () => window.switchMainTab('events'));

  bind('ctxEdit', 'click', window.contextActionEdit);
  bind('ctxStock', 'click', window.contextActionOpenStock);
  bind('ctxQr', 'click', window.contextActionPrintQR);
  bind('ctxDel', 'click', window.contextActionDelete);
  
  document.body.addEventListener('click', () => { window.hideContextMenu(); window.hideToolsMenu(); });
}

// ODPALENIE INICJALIZACJI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppBindings);
} else {
  initAppBindings();
}

// URUCHOMIENIE APLIKACJI
checkAuth();
fetchAllData();
