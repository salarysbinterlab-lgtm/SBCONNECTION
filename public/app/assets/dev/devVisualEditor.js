// SB Connect Visual Low-code Editor - classic script version
// IMPORTANT: This file is in /public, so it must NOT be loaded as type="module".

(function () {
  var scriptEl = document.currentScript;
  var ASSET_BASE = new URL('./', scriptEl ? scriptEl.src : location.href).href;
  var PROJECT_ROOT = new URL('../../../', ASSET_BASE).href;

  var STATE_URL = new URL('visual-editor-state.json', ASSET_BASE).href;
  var CSS_URL = new URL('devVisualEditor.css', ASSET_BASE).href;
  var OVERRIDE_CSS_URL = new URL('visual-overrides.css', ASSET_BASE).href;

  var DEV_HOSTS = { localhost: true, '127.0.0.1': true };
  var isDev = Boolean(DEV_HOSTS[location.hostname] || location.search.indexOf('sbdev=1') >= 0);

  var modes = {
    desktop: { label: 'Desktop', width: 1440, height: 900 },
    ipad: { label: 'iPad', width: 1024, height: 1366 },
    tablet: { label: 'Tablet', width: 768, height: 1024 },
    mobile: { label: 'Mobile', width: 390, height: 844 }
  };

  var state = { version: 1, elements: {}, inserts: [] };
  var selected = null;
  var selectedId = '';
  var editMode = false;
  var currentTab = 'style';
  var dragData = null;
  var resizeData = null;

  function addLink(href, id) {
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadCss() {
    addLink(CSS_URL, 'sbve-dev-css');
    addLink(OVERRIDE_CSS_URL + '?t=' + Date.now(), 'sbve-override-css');
  }

  function isEditorNode(node) {
    return Boolean(node && node.closest && node.closest('.sbve-ui'));
  }

  function isEditableCandidate(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (isEditorNode(el)) return false;
    var tag = el.tagName && el.tagName.toLowerCase();
    if (['script', 'style', 'link', 'meta', 'html', 'body'].indexOf(tag) >= 0) return false;
    return true;
  }

  function isTextLike(el) {
    var tag = el.tagName && el.tagName.toLowerCase();
    if (['p','span','b','strong','em','small','a','button','label','h1','h2','h3','h4','h5','h6','li','td','th'].indexOf(tag) >= 0) return true;
    var text = (el.innerText || '').trim();
    return text.length > 0 && text.length < 160 && el.children.length <= 2;
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function escapeCss(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function makeSelector(el) {
    if (el.id && document.querySelectorAll('#' + cssEscape(el.id)).length === 1) {
      return '#' + cssEscape(el.id);
    }

    if (el.dataset.sbEditId) {
      return '[data-sb-edit-id="' + escapeCss(el.dataset.sbEditId) + '"]';
    }

    var parts = [];
    var node = el;

    while (node && node.nodeType === 1 && node !== document.body) {
      var tag = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (!parent) break;

      var siblings = Array.prototype.slice.call(parent.children).filter(function (child) {
        return child.tagName === node.tagName;
      });
      var index = siblings.indexOf(node) + 1;
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      node = parent;

      if (parts.length >= 7) break;
    }

    return 'body > ' + parts.join(' > ');
  }

  function ensureId(el) {
    if (!el.dataset.sbEditId) {
      el.dataset.sbEditId = 'sbve_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }
    return el.dataset.sbEditId;
  }

  function getPageKey() {
    return location.pathname.replace(/\/+/g, '/');
  }

  function loadState() {
    return fetch(STATE_URL + '?t=' + Date.now())
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data) state = data;
        applyState();
      })
      .catch(function () {
        state = { version: 1, elements: {}, inserts: [] };
        applyState();
      });
  }

  function applyStyle(el, styles) {
    Object.keys(styles || {}).forEach(function (key) {
      var value = styles[key];
      if (value !== undefined && value !== null && value !== '') {
        el.style[key] = value;
      }
    });
  }

  function applyState() {
    Object.keys(state.elements || {}).forEach(function (id) {
      var item = state.elements[id];
      var el = document.querySelector('[data-sb-edit-id="' + escapeCss(id) + '"]');
      if (!el && item.selector) {
        try { el = document.querySelector(item.selector); } catch (e) {}
      }
      if (!el) return;

      el.dataset.sbEditId = id;

      if (typeof item.html === 'string') el.innerHTML = item.html;
      if (item.attrs) {
        Object.keys(item.attrs).forEach(function (key) {
          var value = item.attrs[key];
          if (value === null || value === undefined || value === '') el.removeAttribute(key);
          else el.setAttribute(key, value);
        });
      }
      applyStyle(el, item.styles);
      el.classList.toggle('sbve-hidden', Boolean(item.hidden));
    });

    (state.inserts || [])
      .filter(function (item) { return !item.page || item.page === '*' || item.page === getPageKey(); })
      .forEach(function (item) {
        if (document.querySelector('[data-sb-insert-id="' + escapeCss(item.id) + '"]')) return;
        var wrap = document.createElement('div');
        wrap.className = 'sbve-inserted';
        wrap.dataset.sbInsertId = item.id;
        wrap.dataset.sbEditId = item.id;
        wrap.innerHTML = item.html || '<div>Text</div>';
        applyStyle(wrap, item.styles);
        document.body.appendChild(wrap);
      });
  }

  function saveElement(el) {
    var id = ensureId(el);
    var selector = makeSelector(el);
    var styles = {};
    [
      'position','left','top','right','bottom','width','height','zIndex',
      'fontSize','fontWeight','fontFamily','lineHeight','letterSpacing',
      'color','background','backgroundColor','border','borderRadius',
      'padding','margin','boxShadow','opacity','transform','display'
    ].forEach(function (key) {
      if (el.style[key]) styles[key] = el.style[key];
    });

    var attrs = {};
    ['src','href','alt','title'].forEach(function (attr) {
      if (el.hasAttribute(attr)) attrs[attr] = el.getAttribute(attr);
    });

    state.elements[id] = {
      id: id,
      page: getPageKey(),
      selector: selector,
      tag: el.tagName.toLowerCase(),
      html: el.innerHTML,
      styles: styles,
      attrs: attrs,
      hidden: el.classList.contains('sbve-hidden')
    };

    selectedId = id;
  }

  function selectElement(el) {
    if (!isEditableCandidate(el)) return;
    if (selected) selected.classList.remove('sbve-selected');

    selected = el;
    selectedId = ensureId(el);
    selected.classList.add('sbve-selected');
    saveElement(selected);
    renderSelectionBox();
    updatePanel();
  }

  function clearSelection() {
    if (selected) selected.classList.remove('sbve-selected');
    selected = null;
    selectedId = '';
    removeSelectionBox();
    updatePanel();
  }

  function startTextEdit(el) {
    if (!el) return;
    el.contentEditable = 'true';
    el.classList.add('sbve-editing-text');
    el.focus();

    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    var finish = function () {
      el.contentEditable = 'false';
      el.classList.remove('sbve-editing-text');
      saveElement(el);
      updatePanel();
    };

    el.addEventListener('blur', finish, { once: true });
  }

  function removeSelectionBox() {
    document.querySelectorAll('.sbve-box,.sbve-handle,.sbve-move').forEach(function (el) { el.remove(); });
  }

  function renderSelectionBox() {
    removeSelectionBox();
    if (!selected || !document.body.contains(selected)) return;

    var rect = selected.getBoundingClientRect();

    var box = document.createElement('div');
    box.className = 'sbve-box sbve-ui';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    document.body.appendChild(box);

    var move = document.createElement('div');
    move.className = 'sbve-move sbve-ui';
    move.textContent = 'DRAG';
    move.style.left = rect.left + 'px';
    move.style.top = Math.max(0, rect.top - 28) + 'px';
    move.addEventListener('pointerdown', startDrag);
    document.body.appendChild(move);

    var handle = document.createElement('div');
    handle.className = 'sbve-handle sbve-ui';
    handle.style.left = rect.right - 9 + 'px';
    handle.style.top = rect.bottom - 9 + 'px';
    handle.addEventListener('pointerdown', startResize);
    document.body.appendChild(handle);
  }

  function startDrag(event) {
    if (!selected) return;
    event.preventDefault();
    event.stopPropagation();
    var rect = selected.getBoundingClientRect();

    selected.style.position = 'absolute';
    selected.style.left = rect.left + window.scrollX + 'px';
    selected.style.top = rect.top + window.scrollY + 'px';
    selected.style.width = rect.width + 'px';
    selected.style.zIndex = selected.style.zIndex || '1000';

    dragData = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY
    };

    document.addEventListener('pointermove', onDrag);
    document.addEventListener('pointerup', stopDrag, { once: true });
  }

  function onDrag(event) {
    if (!dragData || !selected) return;
    selected.style.left = dragData.left + (event.clientX - dragData.startX) + 'px';
    selected.style.top = dragData.top + (event.clientY - dragData.startY) + 'px';
    renderSelectionBox();
  }

  function stopDrag() {
    document.removeEventListener('pointermove', onDrag);
    dragData = null;
    if (selected) saveElement(selected);
  }

  function startResize(event) {
    if (!selected) return;
    event.preventDefault();
    event.stopPropagation();
    var rect = selected.getBoundingClientRect();

    resizeData = {
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height
    };

    document.addEventListener('pointermove', onResize);
    document.addEventListener('pointerup', stopResize, { once: true });
  }

  function onResize(event) {
    if (!resizeData || !selected) return;
    selected.style.width = Math.max(20, resizeData.width + (event.clientX - resizeData.startX)) + 'px';
    selected.style.height = Math.max(20, resizeData.height + (event.clientY - resizeData.startY)) + 'px';
    renderSelectionBox();
  }

  function stopResize() {
    document.removeEventListener('pointermove', onResize);
    resizeData = null;
    if (selected) saveElement(selected);
  }

  function insertElement(type) {
    var id = 'insert_' + Date.now().toString(36);
    var html = '<div>New Text</div>';

    if (type === 'image') {
      var src = prompt('Image path / URL', './image/index_1.png') || './image/index_1.png';
      html = '<img src="' + src + '" alt="" style="width:100%;height:100%;object-fit:contain;">';
    } else if (type === 'button') {
      html = '<button style="border:0;border-radius:14px;padding:12px 18px;background:#10b981;color:white;font-weight:900;">Button</button>';
    } else if (type === 'card') {
      html = '<div style="padding:18px;border-radius:22px;background:rgba(255,255,255,.28);backdrop-filter:blur(14px);color:white;box-shadow:0 20px 50px rgba(0,0,0,.22);"><h3>New Card</h3><p>Editable content</p></div>';
    } else {
      html = '<div style="font-size:28px;font-weight:900;color:white;">New Text</div>';
    }

    var item = {
      id: id,
      type: type,
      page: getPageKey(),
      html: html,
      styles: {
        position: 'absolute',
        left: Math.round(window.scrollX + window.innerWidth / 2 - 110) + 'px',
        top: Math.round(window.scrollY + window.innerHeight / 2 - 60) + 'px',
        width: type === 'image' ? '220px' : '260px',
        height: type === 'image' ? '220px' : 'auto',
        zIndex: '1000'
      }
    };

    state.inserts.push(item);
    applyState();
    var el = document.querySelector('[data-sb-insert-id="' + escapeCss(id) + '"]');
    if (el) selectElement(el);
  }

  function deleteSelected() {
    if (!selected || !confirm('ลบ/ซ่อน element นี้?')) return;

    var id = selected.dataset.sbEditId || selected.dataset.sbInsertId;
    if (selected.dataset.sbInsertId) {
      state.inserts = (state.inserts || []).filter(function (item) { return item.id !== selected.dataset.sbInsertId; });
      selected.remove();
    } else {
      selected.classList.add('sbve-hidden');
      saveElement(selected);
      state.elements[id].hidden = true;
    }

    clearSelection();
    updatePanel();
  }

  function generateCssFromState(inputState) {
    var lines = ['/* Generated by SB Visual Low-code Editor */'];

    Object.keys(inputState.elements || {}).forEach(function (id) {
      var item = inputState.elements[id];
      var styles = item.styles || {};
      if (!Object.keys(styles).length && !item.hidden) return;

      lines.push('[data-sb-edit-id="' + id.replace(/"/g, '\\"') + '"] {');
      Object.keys(styles).forEach(function (key) {
        var value = styles[key];
        if (value !== undefined && value !== null && value !== '') {
          lines.push('  ' + key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ': ' + value + ';');
        }
      });
      if (item.hidden) lines.push('  display: none !important;');
      lines.push('}');
    });

    return lines.join('\n') + '\n';
  }

  function saveToFiles() {
    if (selected) saveElement(selected);

    return fetch('/__sb_visual_editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sb-visual-editor': '1' },
      body: JSON.stringify({ state: state })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok || result.data.status !== 'success') {
          throw new Error(result.data.message || 'Save failed');
        }

        var override = document.getElementById('sbve-override-css');
        if (override) override.href = OVERRIDE_CSS_URL + '?t=' + Date.now();
        setStatus('Saved project files: visual-editor-state.json / visual-overrides.css');
      });
  }

  function setStatus(message) {
    var el = document.querySelector('.sbve-status');
    if (el) el.textContent = message;
  }

  function currentStyle(prop) {
    if (!selected) return '';
    return selected.style[prop] || getComputedStyle(selected)[prop] || '';
  }

  function applyField(prop, value) {
    if (!selected) return;

    if (prop === 'html') selected.innerHTML = value;
    else if (prop === 'src') selected.setAttribute('src', value);
    else if (prop === 'href') selected.setAttribute('href', value);
    else if (prop === 'hidden') selected.classList.toggle('sbve-hidden', value === 'yes');
    else selected.style[prop] = value;

    saveElement(selected);
    renderSelectionBox();
  }

  function updatePanel() {
    var panel = document.querySelector('.sbve-panel');
    if (!panel) return;

    var title = panel.querySelector('.sbve-selected-title');
    if (title) {
      title.textContent = selected
        ? selected.tagName.toLowerCase() + ' #' + (selectedId || '')
        : 'No element selected';
    }

    var body = panel.querySelector('.sbve-panel-body');
    if (!body) return;

    if (!selected) {
      body.innerHTML =
        '<div class="sbve-actions">' +
        '<button onclick="window.SBVE.insert(\\'text\\')">Insert Text</button>' +
        '<button onclick="window.SBVE.insert(\\'image\\')">Insert Image</button>' +
        '<button onclick="window.SBVE.insert(\\'button\\')">Insert Button</button>' +
        '<button onclick="window.SBVE.insert(\\'card\\')">Insert Card</button>' +
        '</div><p class="sbve-status">เปิด Edit แล้วคลิกสิ่งที่ต้องการแก้</p>';
      return;
    }

    var textValue = selected.innerHTML.replace(/"/g, '&quot;');
    body.innerHTML =
      '<div class="sbve-tabs">' +
      tabButton('style', 'Style') +
      tabButton('text', 'Text') +
      tabButton('position', 'Position') +
      tabButton('insert', 'Insert') +
      '</div>' +
      renderTab(textValue);
  }

  function tabButton(key, label) {
    return '<button class="' + (currentTab === key ? 'active' : '') + '" onclick="window.SBVE.tab(\\'' + key + '\\')">' + label + '</button>';
  }

  function input(prop, label) {
    return '<label class="sbve-field">' + label + '<input value="' + String(currentStyle(prop) || '').replace(/"/g, '&quot;') + '" onchange="window.SBVE.apply(\\'' + prop + '\\', this.value)"></label>';
  }

  function renderTab(textValue) {
    if (currentTab === 'text') {
      return '' +
        '<div class="sbve-grid">' +
        '<label class="sbve-field wide">HTML/Text<textarea onchange="window.SBVE.apply(\\'html\\', this.value)">' + textValue + '</textarea></label>' +
        '<label class="sbve-field">Image src<input value="' + (selected.getAttribute('src') || '') + '" onchange="window.SBVE.apply(\\'src\\', this.value)"></label>' +
        '<label class="sbve-field">Link href<input value="' + (selected.getAttribute('href') || '') + '" onchange="window.SBVE.apply(\\'href\\', this.value)"></label>' +
        '</div><div class="sbve-actions"><button onclick="window.SBVE.textEdit()">Click type edit</button></div>';
    }

    if (currentTab === 'position') {
      return '' +
        '<div class="sbve-grid">' +
        '<label class="sbve-field">Position<select onchange="window.SBVE.apply(\\'position\\', this.value)">' +
        '<option>static</option><option>relative</option><option>absolute</option><option>fixed</option></select></label>' +
        input('left', 'Left') + input('top', 'Top') + input('width', 'Width') + input('height', 'Height') +
        input('zIndex', 'Z Index') + input('opacity', 'Opacity') + input('transform', 'Transform') +
        '</div>';
    }

    if (currentTab === 'insert') {
      return '' +
        '<div class="sbve-actions">' +
        '<button onclick="window.SBVE.insert(\\'text\\')">Insert Text</button>' +
        '<button onclick="window.SBVE.insert(\\'image\\')">Insert Image</button>' +
        '<button onclick="window.SBVE.insert(\\'button\\')">Insert Button</button>' +
        '<button onclick="window.SBVE.insert(\\'card\\')">Insert Card</button>' +
        '<button onclick="window.SBVE.duplicate()">Duplicate</button>' +
        '<button class="danger" onclick="window.SBVE.delete()">Delete/Hide</button>' +
        '</div>';
    }

    return '' +
      '<div class="sbve-grid">' +
      input('fontSize', 'Font size') + input('fontWeight', 'Font weight') + input('color', 'Color') +
      input('background', 'Background') + input('borderRadius', 'Radius') + input('padding', 'Padding') +
      input('margin', 'Margin') + input('boxShadow', 'Shadow') + input('border', 'Border') +
      '<label class="sbve-field">Hidden<select onchange="window.SBVE.apply(\\'hidden\\', this.value)"><option value="no">no</option><option value="yes">yes</option></select></label>' +
      '</div>';
  }

  function duplicateSelected() {
    if (!selected) return;
    var clone = selected.cloneNode(true);
    var id = 'insert_' + Date.now().toString(36);
    clone.dataset.sbInsertId = id;
    clone.dataset.sbEditId = id;
    clone.classList.add('sbve-inserted');
    clone.style.position = 'absolute';
    clone.style.left = (selected.getBoundingClientRect().left + window.scrollX + 28) + 'px';
    clone.style.top = (selected.getBoundingClientRect().top + window.scrollY + 28) + 'px';
    document.body.appendChild(clone);

    state.inserts.push({
      id: id,
      page: getPageKey(),
      html: clone.innerHTML,
      styles: {
        position: clone.style.position,
        left: clone.style.left,
        top: clone.style.top,
        width: clone.style.width,
        height: clone.style.height,
        zIndex: clone.style.zIndex || '1000'
      }
    });

    selectElement(clone);
  }

  function openDevicePreview(mode) {
    var current = location.pathname + location.search + location.hash;
    if (location.pathname.endsWith('/dev-preview.html')) return;
    location.href = PROJECT_ROOT + 'dev-preview.html?mode=' + encodeURIComponent(mode) + '&url=' + encodeURIComponent(current);
  }

  function makeToolbar() {
    if (document.querySelector('.sbve-toolbox')) return;

    var toolbox = document.createElement('aside');
    toolbox.className = 'sbve-toolbox sbve-ui';
    toolbox.innerHTML =
      '<div class="sbve-toolbox-head"><b>Visual Tools</b><button onclick="window.SBVE.toolbox()">×</button></div>' +
      '<button class="primary" onclick="window.SBVE.toggleEdit()">Edit OFF</button>' +
      '<button onclick="window.SBVE.device(\\'desktop\\')">Desktop</button>' +
      '<button onclick="window.SBVE.device(\\'ipad\\')">iPad</button>' +
      '<button onclick="window.SBVE.device(\\'tablet\\')">Tablet</button>' +
      '<button onclick="window.SBVE.device(\\'mobile\\')">Mobile</button>' +
      '<button onclick="window.SBVE.insert(\\'text\\')">+ Text</button>' +
      '<button onclick="window.SBVE.insert(\\'image\\')">+ Pic</button>' +
      '<button onclick="window.SBVE.insert(\\'button\\')">+ Button</button>' +
      '<button onclick="window.SBVE.insert(\\'card\\')">+ Card</button>' +
      '<button onclick="window.SBVE.panel()">Tools Panel</button>' +
      '<button class="save" onclick="window.SBVE.save()">Save</button>';
    document.body.appendChild(toolbox);

    var fab = document.createElement('button');
    fab.className = 'sbve-fab sbve-ui';
    fab.textContent = 'TOOLS';
    fab.onclick = function () { toolbox.classList.toggle('open'); };
    document.body.appendChild(fab);

    var panel = document.createElement('aside');
    panel.className = 'sbve-panel sbve-ui hidden';
    panel.innerHTML =
      '<div class="sbve-panel-head">' +
      '<div class="sbve-panel-title"><b>Element Tools</b><span class="sbve-selected-title">No element selected</span></div>' +
      '<button class="sbve-close" onclick="window.SBVE.panel(false)">×</button>' +
      '</div><div class="sbve-panel-body"></div><p class="sbve-status">พร้อมใช้งาน</p>';
    document.body.appendChild(panel);

    updatePanel();
  }

  function updateToolbar() {
    var btn = document.querySelector('.sbve-toolbox .primary');
    if (btn) {
      btn.textContent = editMode ? 'Edit ON' : 'Edit OFF';
      btn.classList.toggle('active', editMode);
    }
  }

  function toggleEdit(force) {
    editMode = typeof force === 'boolean' ? force : !editMode;
    document.body.classList.toggle('sbve-edit-active', editMode);
    if (!editMode) clearSelection();
    updateToolbar();
  }

  function toggleToolbox(force) {
    var toolbox = document.querySelector('.sbve-toolbox');
    if (!toolbox) return;
    var show = typeof force === 'boolean' ? force : !toolbox.classList.contains('open');
    toolbox.classList.toggle('open', show);
  }

  function togglePanel(force) {
    var panel = document.querySelector('.sbve-panel');
    if (!panel) return;
    var show = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    updatePanel();
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      if (!editMode) return;
      if (isEditorNode(event.target)) return;

      var el = event.target.closest('*');
      if (!isEditableCandidate(el)) return;

      event.preventDefault();
      event.stopPropagation();

      selectElement(el);
      togglePanel(true);

      if (isTextLike(el)) startTextEdit(el);
    }, true);

    document.addEventListener('keydown', function (event) {
      if (!editMode) return;
      if (event.key === 'Escape') clearSelection();
      if (event.key === 'Delete') deleteSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveToFiles().catch(function (err) { alert(err.message); });
      }
    });

    window.addEventListener('resize', renderSelectionBox);
    window.addEventListener('scroll', renderSelectionBox, true);
  }

  function init() {
    loadCss();

    loadState().then(function () {
      window.setTimeout(applyState, 450);
      window.setTimeout(applyState, 1200);

      if (isDev) {
        makeToolbar();
        bindEvents();
        console.log('[SBVE] Visual Low-code Editor enabled - classic public script');
      }
    });
  }

  window.SBVE = {
    toggleEdit: toggleEdit,
    toolbox: toggleToolbox,
    panel: togglePanel,
    insert: insertElement,
    apply: applyField,
    save: function () {
      saveToFiles().catch(function (err) {
        setStatus('Save failed: ' + err.message);
        alert('Save failed: ' + err.message);
      });
    },
    tab: function (name) { currentTab = name; updatePanel(); },
    textEdit: function () { if (selected) startTextEdit(selected); },
    delete: deleteSelected,
    duplicate: duplicateSelected,
    device: openDevicePreview,
    getState: function () { return state; },
    setState: function (next) { state = next; applyState(); },
    generateCss: function () { return generateCssFromState(state); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
