// Simple CRUD for providers dashboard tabs using localStorage
const ROUTES = [
  'Panel','Reservas','Programados','Cuentas','Administrar','Control de Seguridad','Informes','Precios dinámicos','Gestión Pago Proveedores','Precios y Reportes','Banco','Registro de auditoría'
];

const OWNERS = ['Owner 1','Owner 2','Owner 3','Owner 4','Owner 5','Owner 6','Owner 7'];

// Small sample of Chile cities to generate random route combinations for the skip panel
const CITIES = ['Santiago','Curacaví','Puerto Montt','Valparaíso','Viña del Mar','Concepción','La Serena','Iquique'];

// UID generator to avoid duplicate IDs when rendering multiple checkbox lists
let __uidCounter = Date.now();
function uid(){ return __uidCounter++; }

// --- Helpers ---

function qs(sel){return document.querySelector(sel)}

function createCheckboxList(container, items, prefix){
  if (!container) return; // Defensive check
  container.innerHTML = '';
  items.forEach((it, idx)=>{
    const id = `${prefix}-${uid()}`;
    const label = document.createElement('label');
    // use dataset value and escaped label text
    label.innerHTML = `<input type="checkbox" data-val="${escapeHtml(it)}" id="${id}" /> <span>${escapeHtml(it)}</span>`;
    container.appendChild(label);
  })
}

// Toast helper
function showToast(message, type='info', timeout=3000){
  const toasts = qs('#toasts'); if(!toasts) return;
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
  toasts.appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; setTimeout(()=> el.remove(),300); }, timeout);
}

// Tooltip helpers
function showTooltip(content, clientX=0, clientY=0){
  let tip = qs('#tooltip'); if(!tip){ tip = document.createElement('div'); tip.id='tooltip'; document.body.appendChild(tip); }
  tip.innerHTML = content.replace(/\n/g,'<br/>'); tip.classList.remove('hidden');
  // position near cursor but keep inside viewport
  const pad = 12; const w = tip.offsetWidth; const h = tip.offsetHeight;
  let left = clientX + pad; let top = clientY + pad;
  if(left + w + 20 > window.innerWidth) left = clientX - w - pad;
  if(top + h + 20 > window.innerHeight) top = clientY - h - pad;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function moveTooltip(clientX, clientY){ const tip = qs('#tooltip'); if(!tip || tip.classList.contains('hidden')) return; showTooltip(tip.innerText, clientX, clientY); }
function hideTooltip(){ const tip = qs('#tooltip'); if(tip) tip.classList.add('hidden'); }

// HTML Escaper
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// --- Route Generation Helpers (Movidos a Global) ---
function makeCombinations(cities){
  const combos = [];
  for(let i=0;i<cities.length;i++){
    for(let j=0;j<cities.length;j++){
      if(i===j) continue;
      combos.push(`${cities[i]}-${cities[j]}`);
    }
  }
  return combos;
}

function shuffle(a){
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Eficiencia: Generar combinaciones una sola vez
const ALL_COMBINATIONS = makeCombinations(CITIES);


// --- LocalStorage CRUD ---

function getSaved(){
  try{ return JSON.parse(localStorage.getItem('providersTabs')||'[]') }catch(e){return []}
}

function saveAll(list){ localStorage.setItem('providersTabs', JSON.stringify(list)) }

function renderList(){
  const list = getSaved();
  const container = qs('#tabs-list');
  container.innerHTML = '';
  // Ensure the left-side Gestión menu always shows Dashboard General
  // even when there are no saved configurations.
  try{ renderGestionTabs(list); }catch(e){}
  // Mejorado: Estado vacío con clase CSS
  if(!list.length){ container.innerHTML = '<div class="empty-state">No hay configuraciones guardadas.</div>'; return }

  // build table
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Nombre</th><th>Creado el</th><th>Última modificación</th><th>Rutas</th><th>Owners</th><th>Acciones</th></tr>`;
  table.appendChild(thead);
  const tb = document.createElement('tbody');

  list.forEach(item=>{
    const tr = document.createElement('tr');

    const tdName = document.createElement('td'); tdName.innerHTML = `<strong>${escapeHtml(item.name)}</strong>`;
    const tdCreated = document.createElement('td'); tdCreated.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
    const tdUpdated = document.createElement('td'); tdUpdated.textContent = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-';

    const tdRoutes = document.createElement('td');
    const routesView = document.createElement('span'); routesView.className='view'; routesView.textContent = item.routes && item.routes.length ? `${item.routes.length} rutas` : '0';
    routesView.setAttribute('data-content', item.routes && item.routes.length ? escapeHtml(item.routes.join('\n')) : '');
    tdRoutes.appendChild(routesView);

    const tdOwners = document.createElement('td');
    const ownersView = document.createElement('span'); ownersView.className='view'; ownersView.textContent = item.owners && item.owners.length ? `${item.owners.length} owners` : '0';
    ownersView.setAttribute('data-content', item.owners && item.owners.length ? escapeHtml(item.owners.join('\n')) : '');
    tdOwners.appendChild(ownersView);

    const tdActions = document.createElement('td');
    const edit = document.createElement('button'); edit.textContent='Editar';
    edit.onclick = ()=> {
      if(window.openModal) window.openModal('edit', item);
      else showToast('La aplicación aún no está lista para editar', 'error');
    };
    const del = document.createElement('button'); del.textContent='Borrar'; del.style.marginLeft='8px'; del.className = 'secondary';
    del.onclick = ()=> removeItem(item.id);
    tdActions.appendChild(edit); tdActions.appendChild(del);

    tr.appendChild(tdName);
    tr.appendChild(tdCreated);
    tr.appendChild(tdUpdated);
    tr.appendChild(tdRoutes);
    tr.appendChild(tdOwners);
    tr.appendChild(tdActions);

    tb.appendChild(tr);
  });

  table.appendChild(tb);
  container.appendChild(table);
  // also update the left-side Gestión Pago Proveedores menu
  renderGestionTabs(list);
  // NOTE: tooltip event handling is delegated from the container (see init)
}

function addItem(data){
  const list = getSaved();
  const id = Date.now().toString();
  const now = new Date().toISOString();
  list.push({id, createdAt: now, updatedAt: now, ...data});
  saveAll(list); renderList();
  showToast('Configuración creada', 'success');
}

function updateItem(id, data){
  const list = getSaved();
  const idx = list.findIndex(x=>x.id===id); if(idx===-1) return;
  list[idx] = {...list[idx], ...data, updatedAt: new Date().toISOString()};
  saveAll(list); renderList();
  showToast('Configuración actualizada', 'success');
}

function removeItem(id){
  if(!confirm('¿Borrar esta configuración?')) return;
  const list = getSaved().filter(x=>x.id!==id);
  saveAll(list);
  renderList();
  showToast('Configuración borrada', 'success');
}

// Render saved tabs into the left-side "Gestión Pago Proveedores" menu
function renderGestionTabs(list){
  const parent = qs('#gestion-tabs');
  if(!parent) return;
  parent.innerHTML = '';
  // render dashboard regardless of list contents
  const current = getCurrentTab();
  // Always render permanent Dashboard General at top
  const dashLi = document.createElement('li');
  dashLi.className = 'gestion-tab-item';
  const dashBtn = document.createElement('button');
  dashBtn.type = 'button';
  dashBtn.textContent = 'Dashboard General';
  dashBtn.dataset.id = 'dashboard-general';
  dashBtn.style.background = 'transparent';
  dashBtn.style.border = 'none';
  dashBtn.style.color = 'inherit';
  dashBtn.style.textAlign = 'left';
  dashBtn.style.padding = '6px 8px';
  dashBtn.style.width = '100%';
  dashBtn.style.cursor = 'pointer';
  if(current === 'dashboard-general') dashBtn.classList.add('active');
  dashBtn.addEventListener('click', ()=>{ setCurrentTab('dashboard-general'); showToast('Dashboard General seleccionado','info'); });
  dashLi.appendChild(dashBtn);
  parent.appendChild(dashLi);
  if(list && list.length){
    list.forEach(item=>{
    const li = document.createElement('li');
    li.className = 'gestion-tab-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.name;
    btn.dataset.id = item.id;
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.color = 'inherit';
    btn.style.textAlign = 'left';
    btn.style.padding = '6px 8px';
    btn.style.width = '100%';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', ()=>{
      // set as current selection
      setCurrentTab(item.id);
      showToast(`Pestaña seleccionada: ${item.name}`, 'info');
    });
    li.appendChild(btn);
    parent.appendChild(li);
  });
  }
  // update the toggle label and open/close state
  updateGestionToggle();
}

function updateGestionToggle(){
  const toggle = qs('#gestion-toggle');
  const current = getCurrentTab();
  const currentLabel = qs('#gestion-current');
  if(currentLabel){
    if(current === 'dashboard-general') currentLabel.textContent = 'Dashboard General';
    else {
      const found = getSaved().find(x=>x.id===current);
      currentLabel.textContent = found ? found.name : 'Dashboard General';
    }

  }

}

function getCurrentTab(){
  try{ return localStorage.getItem('providersCurrent') || 'dashboard-general' }catch(e){ return 'dashboard-general' }
}

function setCurrentTab(id){
  try{ localStorage.setItem('providersCurrent', id); }catch(e){}
  // update UI active state
  const parent = qs('#gestion-tabs'); if(!parent) return;
  parent.querySelectorAll('button').forEach(b=> b.classList.remove('active'));
  const btn = parent.querySelector(`button[data-id="${id}"]`);
  if(btn) btn.classList.add('active');
}

// --- App Initialization ---

function init(){
  // Navigation: sidebar config link and right-column options
  const navConfig = qs('#nav-config');
  const optTabs = qs('#opt-tabs');
  const optSkip = qs('#opt-skip');

  function setActiveOption(id){
    [optTabs, optSkip].forEach(b=> b && b.classList.remove('active'));
    const el = document.getElementById(id); if(el) el.classList.add('active');
  }

  function showPanel(name){
    const tabs = qs('#config-panel');
    const skip = qs('#skip-panel');
    if(name==='tabs'){
      tabs.classList.remove('hidden'); skip.classList.add('hidden'); setActiveOption('opt-tabs');
    } else if(name==='skip'){
      skip.classList.remove('hidden'); tabs.classList.add('hidden'); setActiveOption('opt-skip');
    }
  }

  if(navConfig) navConfig.addEventListener('click', (e)=>{ e.preventDefault(); showPanel('tabs'); window.scrollTo({top:0,behavior:'smooth'}); });
  if(optTabs) optTabs.addEventListener('click', ()=> showPanel('tabs'));
  if(optSkip) optSkip.addEventListener('click', ()=> showPanel('skip'));

  // default: show tabs panel
  showPanel('tabs');

  // Tooltip delegation for views inside #tabs-list
  const tabsListContainer = qs('#tabs-list');
  if(tabsListContainer){
    tabsListContainer.addEventListener('mouseover', (e)=>{
      const v = e.target.closest && e.target.closest('.view');
      if(v){ const c = v.getAttribute('data-content') || ''; if(c) showTooltip(c, e.clientX, e.clientY); }
    });
    tabsListContainer.addEventListener('mouseout', (e)=>{ const v = e.target.closest && e.target.closest('.view'); if(v) hideTooltip(); });
    tabsListContainer.addEventListener('mousemove', (e)=>{ const v = e.target.closest && e.target.closest('.view'); if(v) moveTooltip(e.clientX, e.clientY); });
  }

  // --- SKIP panel: generate and save random routes ---
  const skipSearch = qs('#skip-search');
  const skipListContainer = qs('#skip-routes-list');
  const skipNoResults = qs('#skip-no-results');

  function renderSkipRoutes(list){
    const container = skipListContainer; // Mejorado: Target al nuevo contenedor
    if(!container) return;
    container.innerHTML = '';
    list.forEach((r, idx)=>{
      const id = `skip-route-${idx}`;
      const item = document.createElement('div'); item.className = 'multiselect-item';
      item.innerHTML = `<label><input type="checkbox" data-val="${r}" id="${id}" /> <span>${escapeHtml(r)}</span></label>`;
      container.appendChild(item);
    });
    // update toggle placeholder text with selected count
    updateSkipToggleText();
  }

  function getSavedSkip(){
    try{return JSON.parse(localStorage.getItem('providersSkip')||'{}')}catch(e){return {routes:[]}}
  }

  function saveSkip(routes){
    localStorage.setItem('providersSkip', JSON.stringify({routes}));
    showToast('Selección de skip guardada', 'success');
  }

  // initial generation: take a shuffled subset
  function generateAndRender(n=8){
    const combos = [...ALL_COMBINATIONS];
    const sample = shuffle(combos).slice(0,n);
    renderSkipRoutes(sample);
    // Mejorado: Limpiar búsqueda al regenerar
    if(skipSearch) {
      skipSearch.value = '';
      skipSearch.dispatchEvent(new Event('input'));
    }
  }

  // wire buttons
  const btnGenerate = qs('#generate-skip');
  const btnSaveSkip = qs('#save-skip');
  if(btnGenerate) btnGenerate.addEventListener('click', ()=> generateAndRender(8));
  if(btnSaveSkip) btnSaveSkip.addEventListener('click', ()=>{
    const selected = Array.from(document.querySelectorAll('#skip-routes-list input[type=checkbox]:checked')).map(i=>i.dataset.val);
    saveSkip(selected);
    updateSkipToggleText();
  });

  // on load: if the user previously saved skip routes, restore them; otherwise generate a sample
  const saved = getSavedSkip();
  if(saved && Array.isArray(saved.routes) && saved.routes.length){
    // render the saved routes (so the same checkboxes exist) and mark them checked
    renderSkipRoutes(saved.routes);
    // mark checkboxes (renderSkipRoutes created inputs with data-val)
    document.querySelectorAll('#skip-routes-list input[type=checkbox]').forEach(ch=> ch.checked = saved.routes.includes(ch.dataset.val));
    updateSkipToggleText();
  } else {
    generateAndRender(8);
  }

  // Multiselect toggle behavior
  const toggle = qs('#skip-toggle');
  const dropdown = qs('#skip-routes');
  const multiselect = qs('#skip-multiselect');

  function openDropdown(){ dropdown.classList.remove('hidden'); multiselect.classList.add('open'); }
  function closeDropdown(){
    dropdown.classList.add('hidden');
    multiselect.classList.remove('open');
    // Mejorado: Limpiar búsqueda al cerrar
    if(skipSearch) {
       skipSearch.value = '';
       skipSearch.dispatchEvent(new Event('input'));
    }
  }
  function toggleDropdown(){ dropdown.classList.toggle('hidden'); multiselect.classList.toggle('open'); }

  function updateSkipToggleText(){
    const checked = Array.from(document.querySelectorAll('#skip-routes-list input[type=checkbox]:checked')).map(i=>i.dataset.val);
    const localToggle = qs('#skip-toggle');
    if(!localToggle) return;
    if(checked.length===0){ localToggle.textContent = 'Seleccione rutas...'; localToggle.classList.add('placeholder'); }
    else if(checked.length<=3){ localToggle.textContent = checked.join(', '); localToggle.classList.remove('placeholder'); }
    else { localToggle.textContent = `${checked.length} rutas seleccionadas`; localToggle.classList.remove('placeholder'); }
  }

  const toggleEl = qs('#skip-toggle');
  if(toggleEl) toggleEl.addEventListener('click', (e)=>{ e.stopPropagation(); toggleDropdown(); const d = qs('#skip-routes'); toggleEl.setAttribute('aria-expanded', String(!d.classList.contains('hidden'))); });
  if(toggleEl) toggleEl.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault(); toggleDropdown(); const d = qs('#skip-routes'); toggleEl.setAttribute('aria-expanded', String(!d.classList.contains('hidden')));
    }
  });
  if(multiselect) multiselect.addEventListener('click', (e)=>{
    if(e.target === multiselect || e.target.closest('.multiselect-toggle')){
      e.stopPropagation(); toggleDropdown(); const d = qs('#skip-routes'); if(toggleEl) toggleEl.setAttribute('aria-expanded', String(!d.classList.contains('hidden')));
    }
  });
  document.addEventListener('click', (e)=>{
    if(!multiselect) return;
    if(!multiselect.contains(e.target)){
      closeDropdown();
      if(toggle) toggle.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('change', (e)=>{
    if(e.target && e.target.closest && e.target.closest('#skip-routes-list')){
      updateSkipToggleText();
    }
  });

  // Mejorado: Lógica de filtro para multiselect "skip"
  if (skipSearch) {
    skipSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const items = skipListContainer.querySelectorAll('.multiselect-item');
      let visibleCount = 0;

      items.forEach(item => {
        const labelEl = item.querySelector('span');
        if (labelEl) {
          const label = labelEl.textContent.toLowerCase();
          if (label.includes(searchTerm)) {
            item.style.display = 'flex'; // Show
            visibleCount++;
          } else {
            item.style.display = 'none'; // Hide
          }
        }
      });

      if (skipNoResults) {
        skipNoResults.classList.toggle('hidden', visibleCount > 0);
      }
    });
  }


  // --- Modal for create/edit tabs ---
  const modalOverlay = qs('#modal-overlay');
  const modal = qs('#modal');
  const modalForm = qs('#modal-form');
  const modalTitle = qs('#modal-title');

  // Focus trap helpers for accessibility
  let __lastFocusedBeforeModal = null;
  const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let __modalKeyHandler = null;

  function trapFocus(){
    const focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTORS)).filter(el => !el.disabled && el.offsetParent !== null);
    if(!focusable.length) return;
    let first = focusable[0];
    let last = focusable[focusable.length - 1];
    __modalKeyHandler = function(e){
      if(e.key === 'Tab'){
        if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
        else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
      }
    };
    document.addEventListener('keydown', __modalKeyHandler);
    // move focus to first element
    first.focus();
  }

  function releaseFocus(){ if(__modalKeyHandler) { document.removeEventListener('keydown', __modalKeyHandler); __modalKeyHandler = null; } }

  function populateModalCheckboxes(){
    const mr = qs('#modal-routes');
    const mo = qs('#modal-owners');
    if(mr) createCheckboxList(mr, ALL_COMBINATIONS, 'modal-route');
    if(mo) createCheckboxList(mo, OWNERS, 'modal-owner');
  }

  populateModalCheckboxes();
  
  // Mejorado: Lógica para "Seleccionar todo"
  function setupSelectAll(allCheckboxId, listContainerSelector) {
    const allCheckbox = qs(allCheckboxId);
    const listContainer = qs(listContainerSelector);
    if (!allCheckbox || !listContainer) return;
    
    const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
    
    allCheckbox.addEventListener('change', (e) => {
      checkboxes.forEach(chk => { chk.checked = e.target.checked; });
    });
    
    listContainer.addEventListener('change', () => {
      const allChecked = Array.from(checkboxes).every(chk => chk.checked);
      const someChecked = Array.from(checkboxes).some(chk => chk.checked);
      
      if (allChecked && checkboxes.length > 0) {
        allCheckbox.checked = true;
        allCheckbox.indeterminate = false;
      } else if (someChecked) {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = true;
      } else {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = false;
      }
    });
  }

  setupSelectAll('#modal-routes-all', '#modal-routes');
  setupSelectAll('#modal-owners-all', '#modal-owners');

  // Modal search/filter for routes
  const modalSearch = qs('#modal-search');
  const modalRoutesContainer = qs('#modal-routes');
  const modalNoResults = qs('#modal-routes-no-results');
  if(modalSearch && modalRoutesContainer){
    modalSearch.addEventListener('input', (e)=>{
      const term = e.target.value.toLowerCase();
      const items = modalRoutesContainer.querySelectorAll('label');
      let visible = 0;
      items.forEach(it=>{
        const txt = (it.textContent||'').toLowerCase();
        if(txt.includes(term)) { it.style.display = 'flex'; visible++; }
        else { it.style.display = 'none'; }
      });
      if(modalNoResults) modalNoResults.classList.toggle('hidden', visible>0);
    });
  }


  function openModal(mode='create', data){
    if(!modalOverlay) return;
    // store last focused element to restore after close
    __lastFocusedBeforeModal = document.activeElement;
    
    const allRoutes = qs('#modal-routes-all');
    const allOwners = qs('#modal-owners-all');

    if(mode === 'create'){
      modalTitle.textContent = 'Crear nueva pestaña';
      qs('#modal-tab-name').value = '';
      qs('#modal-edit-id').value = '';
      // uncheck all
      document.querySelectorAll('#modal-routes input[type=checkbox], #modal-owners input[type=checkbox]').forEach(ch=> ch.checked=false);
      // Reset select-all checks
      if(allRoutes) { allRoutes.checked = false; allRoutes.indeterminate = false; }
      if(allOwners) { allOwners.checked = false; allOwners.indeterminate = false; }
    } else if(mode === 'edit' && data){
      modalTitle.textContent = 'Editar pestaña';
      qs('#modal-tab-name').value = data.name || '';
      qs('#modal-edit-id').value = data.id || '';
      // check relevant
      document.querySelectorAll('#modal-routes input[type=checkbox]').forEach(ch=> ch.checked = data.routes.includes(ch.dataset.val));
      document.querySelectorAll('#modal-owners input[type=checkbox]').forEach(ch=> ch.checked = data.owners.includes(ch.dataset.val));
      
      // Mejorado: Disparar evento para actualizar estado de "Seleccionar todo"
      qs('#modal-routes').dispatchEvent(new Event('change'));
      qs('#modal-owners').dispatchEvent(new Event('change'));
    }
    modalOverlay.classList.remove('hidden');
    modal.classList.add('open');
    // trap focus once modal is visible
    setTimeout(()=> trapFocus(), 10);
  }

  function closeModal(){ 
    if(modalOverlay) modalOverlay.classList.add('hidden');
    if(modal) modal.classList.remove('open');
    releaseFocus();
    // restore focus to opener
    try{ if(__lastFocusedBeforeModal && __lastFocusedBeforeModal.focus) __lastFocusedBeforeModal.focus(); }catch(e){}
  }

  window.closeModal = closeModal;

  // wire create button
  const btnCreate = qs('#create-new');
  if(btnCreate) btnCreate.addEventListener('click', ()=> openModal('create'));

  // modal close/cancel
  const modalClose = qs('#modal-close');
  const modalCancel = qs('#modal-cancel');
  if(modalClose) modalClose.addEventListener('click', ()=> closeModal());
  if(modalCancel) modalCancel.addEventListener('click', ()=> closeModal());
  if(modalOverlay) modalOverlay.addEventListener('click', (e)=>{ if(e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  // handle modal submit
  if(modalForm) modalForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const id = qs('#modal-edit-id').value;
    const name = qs('#modal-tab-name').value.trim();
    const routes = Array.from(document.querySelectorAll('#modal-routes input[type=checkbox]:checked')).map(i=>i.dataset.val);
    const owners = Array.from(document.querySelectorAll('#modal-owners input[type=checkbox]:checked')).map(i=>i.dataset.val);
    if(!name){ showToast('Nombre es requerido','error'); return }
    if(!routes.length){ showToast('Seleccione al menos 1 ruta','error'); return }
    if(!owners.length){ showToast('Seleccione al menos 1 owner','error'); return }
    const data = {name, routes, owners};
    if(id){ updateItem(id, data); } else { addItem(data); }
    closeModal();
  });

  window.openModal = openModal;
  renderList();

  // Wire Gestión toggle: expand/collapse submenu on click (default collapsed)
  const gParent = qs('#gestion-parent');
  const gToggle = qs('#gestion-toggle');
  const gTabs = qs('#gestion-tabs');
  if (gToggle && gParent && gTabs) {
    // ensure initial collapsed state
    gParent.classList.remove('open');
    gTabs.classList.add('hidden');
    gToggle.setAttribute('aria-expanded','false');

    gToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const opened = gParent.classList.toggle('open');
      gTabs.classList.toggle('hidden', !opened);
      gToggle.setAttribute('aria-expanded', String(opened));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);