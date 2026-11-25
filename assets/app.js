(function () {
  'use strict';
  const I18N = window.NW_I18N;
  const MODES = ['Aéreo', 'Marítimo', 'Terrestre'];
  const COLOR = { 'Aéreo': 'var(--air)', 'Marítimo': 'var(--sea)', 'Terrestre': 'var(--land)', 'Sin precisar': 'var(--muted)' };
  const DASH = { 'Aéreo': '7 4', 'Marítimo': null, 'Terrestre': '2 4' };
  const state = { lang: 'es', modo: '', pais: '', anio: '' };
  let D = null;

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
  const link = (url, text) => { if (!safeUrl(url)) return el('span', null, text || ''); const a = el('a', null, text || url); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const t = (k) => I18N[state.lang][k];
  const L = (o, base) => o[base + '_' + state.lang] ?? o[base + '_es'] ?? o[base];
  const fmt = (v) => (v == null || isNaN(+v)) ? '—' : new Intl.NumberFormat(state.lang === 'es' ? 'es' : 'en', { maximumFractionDigits: 0, useGrouping: 'always' }).format(+v);
  const fmt1 = (v) => new Intl.NumberFormat(state.lang === 'es' ? 'es' : 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(+v);
  const fmt2 = (v) => new Intl.NumberFormat(state.lang === 'es' ? 'es' : 'en', { maximumFractionDigits: 2 }).format(+v);
  const paisName = (p) => { if (state.lang === 'es') return p; const all = [...D.eventos, ...D.incautaciones, ...D.pistas_reportes]; const f = all.find((x) => x.pais === p && x.pais_en); return f ? f.pais_en : ({ 'EE.UU.': 'United States', 'Países Bajos': 'Netherlands', 'Surinam': 'Suriname', 'Ecuador': 'Ecuador', 'Colombia': 'Colombia', 'Venezuela': 'Venezuela', 'Brasil': 'Brazil', 'Guyana': 'Guyana', 'Trinidad y Tobago': 'Trinidad and Tobago', 'México': 'Mexico' }[p] || p); };
  const modeName = (m) => t('mode')[m] || m;
  const year = (f) => String(f || '').slice(0, 4);
  const pass = (r, opts = {}) => (!state.modo || opts.ignoreModo || r.modalidad === state.modo) && (!state.pais || opts.ignorePais || (r.paises ? r.paises.includes(state.pais) : r.pais === state.pais)) && (!state.anio || year(r.fecha) === state.anio);
  const pill = (m) => { const p = el('span', 'pill', modeName(m)); p.style.setProperty('--c', COLOR[m] || 'var(--muted)'); return p; };
  const tt = $('#tt');
  const tip = { show(ev, text) { tt.textContent = text; tt.hidden = false; const w = tt.offsetWidth; tt.style.left = Math.min(ev.clientX + 12, window.innerWidth - w - 8) + 'px'; tt.style.top = (ev.clientY - 36) + 'px'; }, hide() { tt.hidden = true; } };

  // ---------- language ----------
  function initLang() {
    let l = null;
    try { l = localStorage.getItem('nw-lang'); } catch (e) {}
    const h = location.hash.replace('#', '');
    if (h === 'en' || h === 'es') l = h;
    if (!l) l = (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
    state.lang = l;
  }
  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => { const v = t(n.getAttribute('data-i18n')); if (typeof v === 'string') n.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach((n) => { const v = t(n.getAttribute('data-i18n-html')); if (typeof v === 'string') n.innerHTML = v; }); // trusted strings from i18n.js only
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    const m = $('#method'); m.replaceChildren(...t('method').map((x) => el('li', null, x)));
  }

  // ---------- filters ----------
  function buildFilters() {
    const paises = new Set();
    D.eventos.forEach((e) => paises.add(e.pais)); D.incautaciones.forEach((e) => paises.add(e.pais)); D.pistas_reportes.forEach((e) => paises.add(e.pais));
    const sp = $('#sel-pais');
    sp.replaceChildren(new Option(t('all_countries'), ''), ...Array.from(paises).sort((a, b) => paisName(a).localeCompare(paisName(b), state.lang)).map((p) => new Option(paisName(p), p)));
    sp.value = state.pais;
    const years = new Set([...D.eventos, ...D.operaciones, ...D.pistas_reportes].map((x) => year(x.fecha)).filter((y) => /^\d{4}$/.test(y)));
    const sa = $('#sel-anio');
    sa.replaceChildren(new Option(t('all_years'), ''), ...Array.from(years).sort().reverse().map((y) => new Option(y, y)));
    sa.value = state.anio;
    document.querySelectorAll('#chips-modo button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.modo || '') === state.modo)));
  }
  function wire() {
    document.querySelectorAll('#chips-modo button').forEach((b) => b.addEventListener('click', () => { state.modo = b.dataset.modo || ''; render(); }));
    $('#sel-pais').addEventListener('change', (e) => { state.pais = e.target.value; render(); });
    $('#sel-anio').addEventListener('change', (e) => { state.anio = e.target.value; render(); });
    $('#btn-reset').addEventListener('click', () => { state.modo = state.pais = state.anio = ''; render(); });
    document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { state.lang = b.dataset.lang; try { localStorage.setItem('nw-lang', state.lang); } catch (e) {} applyStatic(); render(); }));
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderCharts, 150); });
  }

  // ---------- sections ----------
  function variacion() {
    const by = {};
    D.incautaciones.forEach((r) => { (by[r.pais] = by[r.pais] || []).push(r); });
    return Object.keys(by).filter((p) => by[p].length >= 2).map((p) => { const s = by[p].sort((a, b) => a.anio - b.anio); const a = s[s.length - 2], b = s[s.length - 1]; return { pais: p, a, b, pct: Math.round((b.t - a.t) / a.t * 1000) / 10 }; }).sort((x, y) => y.b.t - x.b.t);
  }
  function renderLede() {
    const v = variacion();
    const ev = D.eventos.filter((e) => pass(e));
    const tot = ev.reduce((s, e) => s + (e.kg || 0), 0), mar = ev.filter((e) => e.modalidad === 'Marítimo').reduce((s, e) => s + (e.kg || 0), 0);
    $('#lede').innerHTML = t('lede')(v.filter((x) => x.pct < 0).length, v.length, tot ? Math.round(mar / tot * 100) : 0);
    $('#updated').textContent = D.meta.actualizado;
  }
  function renderKpis() {
    const ev = D.eventos.filter((e) => pass(e, { ignoreModo: true }));
    $('#kpis').replaceChildren(...MODES.map((m) => {
      const rows = ev.filter((e) => e.modalidad === m);
      const k = el('div', 'kpi'); k.style.setProperty('--c', COLOR[m]);
      if (state.modo && state.modo !== m) k.style.opacity = '.45';
      k.append(el('span', 'k-name', modeName(m)), el('span', 'k-val', fmt(rows.reduce((s, e) => s + (e.kg || 0), 0)) + ' kg'), el('span', 'k-sub', rows.length + ' ' + t('cases') + ' · ' + t('kpi_sub')[m]));
      return k;
    }));
  }
  function renderLegend() {
    const sw = (m) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '22'); s.setAttribute('height', '8'); s.innerHTML = `<line x1="1" y1="4" x2="21" y2="4" stroke="${COLOR[m]}" stroke-width="3" ${DASH[m] ? `stroke-dasharray="${DASH[m]}"` : ''}/>`; return s; };
    const item = (node, text) => { const s = el('span'); s.append(node, document.createTextNode(text)); return s; };
    const x = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); x.setAttribute('width', '12'); x.setAttribute('height', '12'); x.innerHTML = '<path d="M2 2L10 10M10 2L2 10" stroke="var(--ink)" stroke-width="2.2"/>';
    $('#legend').replaceChildren(...MODES.map((m) => item(sw(m), modeName(m))), item(x, t('leg_strips')), el('span', null, t('leg_decl')));
  }
  function renderMap() {
    const box = $('#map'); box.replaceChildren();
    const W = box.clientWidth || 360, H = Math.max(320, Math.round(W * 0.66));
    const frame = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[-93.5, -1.5], [-49, 25.5]] } };
    const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], frame).clipExtent([[0, 0], [W, H]]);
    const path = d3.geoPath(proj);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('h_map'));
    svg.append('g').selectAll('path').data(D.geo.features).join('path').attr('d', path)
      .attr('fill', (f) => f.properties.name === 'Guyana' ? 'var(--guy-fill)' : f.properties.name === 'Brazil' ? 'var(--bra-fill)' : 'var(--land-fill)')
      .attr('stroke', 'var(--line)').attr('stroke-width', 0.7);
    const rutas = D.rutas.filter((x) => (!state.modo || x.modalidad === state.modo) && (!state.pais || x.paises.includes(state.pais)));
    const cap = el('div', 'map-cap');
    const setCap = (node) => { cap.replaceChildren(); if (node) cap.append(...node); else cap.textContent = rutas.length ? t('map_count')(rutas.length) : t('map_none'); };
    const g = svg.append('g');
    rutas.forEach((x) => {
      const a = proj([x.o_lon, x.o_lat]), b = proj([x.d_lon, x.d_lat]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = x.modalidad === 'Aéreo' ? 0.22 : 0.12;
      const d = `M${a[0]},${a[1]} Q${mx - dy * k},${my + dx * k} ${b[0]},${b[1]}`;
      const op = x.declive ? 0.4 : 0.95;
      g.append('path').attr('d', d).attr('fill', 'none').attr('stroke', COLOR[x.modalidad]).attr('stroke-width', 2.4).attr('stroke-opacity', op).attr('stroke-dasharray', DASH[x.modalidad]);
      g.append('circle').attr('cx', b[0]).attr('cy', b[1]).attr('r', 3.5).attr('fill', COLOR[x.modalidad]).attr('fill-opacity', op);
      g.append('path').attr('class', 'hit').attr('d', d).attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 14)
        .on('mousemove', (ev) => tip.show(ev, `${L(x, 'o')} → ${L(x, 'd')} · ${modeName(x.modalidad)} · ${x.estado[state.lang]}`))
        .on('mouseleave', tip.hide)
        .on('click', () => setCap([el('b', null, `${L(x, 'o')} → ${L(x, 'd')}`), document.createTextNode(` · ${modeName(x.modalidad)} · ${x.estado[state.lang]}. ${L(x, 'desc')}. `), link(x.url, x.fuente)]));
    });
    if (!state.modo || state.modo === 'Aéreo') {
      D.pistas_reportes.filter((x) => x.lat != null && (!state.pais || x.pais === state.pais) && (!state.anio || year(x.fecha) === state.anio)).forEach((x) => {
        const [px, py] = proj([x.lon, x.lat]); const s = 5;
        g.append('path').attr('d', `M${px - s},${py - s}L${px + s},${py + s}M${px + s},${py - s}L${px - s},${py + s}`).attr('stroke', 'var(--ink)').attr('stroke-width', 2.2).attr('stroke-opacity', x.narco ? 0.9 : 0.4);
        const n = x.pistas == null ? t('no_figure') : x.pistas + ' ' + t('strips');
        g.append('circle').attr('class', 'hit').attr('cx', px).attr('cy', py).attr('r', 10).attr('fill', 'transparent')
          .on('mousemove', (ev) => tip.show(ev, `${paisName(x.pais)} · ${L(x, 'zona')}: ${n}`)).on('mouseleave', tip.hide)
          .on('click', () => setCap([el('b', null, `${paisName(x.pais)} · ${L(x, 'zona')}`), document.createTextNode(` · ${n} · ${L(x, 'accion').toLowerCase()} · ${L(x, 'periodo')} · ${L(x, 'agencias')}. `), link(x.url, x.fuente)]));
      });
    }
    const labels = [['Guyana', 'Guyana', -59.0, 5.2], ['Venezuela', 'Venezuela', -66.0, 6.2], ['Colombia', 'Colombia', -74.0, 5.0], ['Panamá', 'Panama', -80.6, 8.0], ['Honduras', 'Honduras', -86.8, 14.6], ['Guatemala', 'Guatemala', -90.6, 15.4], ['Cuba', 'Cuba', -79.0, 21.9], ['Jamaica', 'Jamaica', -77.4, 18.5], ['La Española', 'Hispaniola', -71.0, 19.6], ['Belice', 'Belize', -88.7, 17.0], ['Trinidad y Tobago', 'Trinidad & Tobago', -61.2, 11.2], ['Brasil', 'Brazil', -63.5, 0.6], ['Surinam', 'Suriname', -55.9, 4.0], ['México', 'Mexico', -92.0, 18.6]];
    svg.append('g').selectAll('text').data(labels).join('text').attr('x', (d) => proj([d[2], d[3]])[0]).attr('y', (d) => proj([d[2], d[3]])[1]).attr('text-anchor', 'middle').attr('class', (d) => d[0] === 'Guyana' ? 'strong' : null).text((d) => state.lang === 'es' ? d[0] : d[1]);
    box.appendChild(cap); setCap(null);
  }
  function caseList(target, pais) {
    const rows = D.eventos.filter((e) => e.pais === pais && pass(e, { ignorePais: true })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    target.replaceChildren();
    if (!rows.length) { target.appendChild(el('li', 'note', t('none'))); return rows; }
    rows.forEach((e) => { const li = el('li'); const body = el('div'); body.append(pill(e.modalidad), el('b', null, e.kg == null ? 's/d' : fmt(e.kg) + ' kg'), document.createTextNode(' · ' + L(e, 'desc') + ' '), link(e.url, e.fuente)); li.append(el('span', 'date', e.fecha), body); target.appendChild(li); });
    return rows;
  }
  function renderGuyana() {
    const rep = $('#report'); rep.replaceChildren(el('h3', null, t('weekly')));
    const r = D.informes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    if (r) {
      rep.append(el('p', 'note', t('week_of') + ' ' + r.fecha), el('p', null, null)); rep.lastChild.appendChild(el('b', null, L(r, 'titulo')));
      rep.append(el('p', null, L(r, 'resumen')));
      const ul = el('ul'); (r['puntos_' + state.lang] || r.puntos_es).forEach((x) => ul.appendChild(el('li', null, x))); rep.appendChild(ul);
      const fp = el('p', 'note', t('sources') + ': '); r.fuentes.forEach((f, i) => { if (i) fp.append(' · '); fp.append(link(f.u, f.n)); }); rep.appendChild(fp);
    }
    const rows = caseList($('#guy-list'), 'Guyana');
    $('#guy-sum').textContent = t('guy_sum')(fmt(rows.reduce((s, e) => s + (e.kg || 0), 0)));
    const q1 = D.guyana_canu.find((x) => x.orden === 1);
    $('#canu-note').textContent = t('canu_note')(q1 ? fmt2(q1.cocaina_kg) : '—');
  }
  function renderBalloon() {
    const ul = $('#decisions'); ul.replaceChildren();
    D.decisiones.slice().sort((a, b) => a.orden - b.orden).forEach((r) => { const li = el('li'); const body = el('div'); const ef = el('span', 'note', t('effect') + ': ' + L(r, 'efecto') + '. '); ef.appendChild(link(r.url, r.fuente)); body.append(el('div', 'actor', L(r, 'actor')), el('div', null, L(r, 'hecho')), ef); li.append(el('span', 'date', r.fecha), body); ul.appendChild(li); });
    caseList($('#bra-list'), 'Brasil');
  }
  function renderStrips() {
    const rows = D.pistas_reportes.filter((r) => (!state.pais || r.pais === state.pais) && (!state.anio || year(r.fecha) === state.anio) && (!state.modo || state.modo === 'Aéreo')).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const by = {}; rows.filter((r) => r.pistas != null && r.narco).forEach((r) => { if (!by[r.pais] || r.fecha > by[r.pais].fecha) by[r.pais] = r; });
    $('#strip-cards').replaceChildren(...Object.values(by).sort((a, b) => b.pistas - a.pistas).map((r) => { const c = el('div', 'card'); c.append(el('b', null, paisName(r.pais)), el('span', 'v', fmt(r.pistas)), el('span', 'note', `${L(r, 'accion')} · ${L(r, 'periodo')} (${r.fecha})`)); return c; }));
    const tb = $('#tbl-pistas tbody'); tb.replaceChildren();
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'note', t('none')); td.colSpan = 9; tr.appendChild(td); tb.appendChild(tr); return; }
    rows.forEach((r) => {
      const tr = el('tr'); const c = (x, cls) => { const td = el('td', cls, x); tr.appendChild(td); return td; };
      c(r.fecha); c(paisName(r.pais)); c(L(r, 'zona') + (r.operacion ? ' · ' + r.operacion : '')); c(r.pistas == null ? 's/d' : fmt(r.pistas), 'num'); c(L(r, 'accion')); c(L(r, 'periodo')); c(L(r, 'agencias'));
      const tm = c(''); const p = el('span', 'tag' + (r.narco ? ' c' : ''), state.lang === 'es' ? r.motivo : r.motivo_en); tm.appendChild(p);
      const tf = c(''); tf.appendChild(link(r.url, r.fuente)); const n = L(r, 'nota'); if (n) tf.appendChild(el('div', 'note', n));
      tb.appendChild(tr);
    });
  }
  function renderOps() {
    const rows = D.operaciones.filter((r) => pass(r)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.orden - a.orden);
    const ps = new Set(); rows.forEach((r) => r.paises.forEach((p) => ps.add(p)));
    $('#ops-sum').innerHTML = t('ops_sum')(rows.length, ps.size, fmt(rows.reduce((s, r) => s + (r.kg || 0), 0)), rows.filter((r) => r.paises.includes('EE.UU.')).length);
    const ul = $('#ops'); ul.replaceChildren();
    if (!rows.length) { ul.appendChild(el('li', 'note', t('none'))); return; }
    rows.forEach((r) => {
      const li = el('li');
      const tags = (arr, cls) => { const d = el('div', 'tags'); arr.forEach((x) => d.appendChild(el('span', cls, x))); return d; };
      const src = el('span', 'note', t('source') + ': '); src.appendChild(link(r.url, r.fuente));
      const top = el('div'); top.appendChild(pill(r.modalidad));
      li.append(el('span', 'note', r.fecha + ' · ' + L(r, 'zona')), el('b', null, L(r, 'nombre')), top, el('span', 'kg', r.kg == null ? t('no_coke') : fmt(r.kg) + ' kg'), el('p', null, L(r, 'res')),
        tags(r.paises.map(paisName), 'tag c'), tags(r['agencias_' + state.lang] || r.agencias_es, 'tag'), src);
      ul.appendChild(li);
    });
  }
  function renderCases() {
    const rows = D.eventos.filter((e) => pass(e)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tb = $('#tbl-casos tbody'); tb.replaceChildren();
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'note', t('none')); td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr); return; }
    rows.forEach((e) => { const tr = el('tr'); const c = (x, cls) => { const td = el('td', cls, x); tr.appendChild(td); return td; }; c(e.fecha); c(paisName(e.pais)); c('').appendChild(pill(e.modalidad)); c(L(e, 'desc')); c(e.kg == null ? 's/d' : fmt(e.kg), 'num'); c('').appendChild(link(e.url, e.fuente)); tb.appendChild(tr); });
  }

  // ---------- charts ----------
  function chartCanu() {
    const box = $('#chart-canu'); box.replaceChildren();
    const rows = D.guyana_canu.slice().sort((a, b) => a.orden - b.orden);
    const W = box.clientWidth || 300, rowH = 34, H = rowH * rows.length + 6;
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('h_canu'));
    const names = svg.append('g'); names.selectAll('text').data(rows).join('text').attr('y', (r, i) => i * rowH + rowH / 2 + 4).text((r) => L(r, 'periodo'));
    let ml = 0; names.selectAll('text').each(function () { ml = Math.max(ml, this.getComputedTextLength()); }); ml += 10;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.narcoticos_kg)]).range([ml, Math.max(ml + 40, W - 64)]);
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', ml).attr('y', (r, i) => i * rowH + 8).attr('height', rowH - 16).attr('width', (r) => x(r.narcoticos_kg) - ml).attr('rx', 2).attr('fill', 'var(--accent)');
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'strong').attr('x', (r) => x(r.narcoticos_kg) + 6).attr('y', (r, i) => i * rowH + rowH / 2 + 4).text((r) => fmt(r.narcoticos_kg) + ' kg');
  }
  function chartPaises() {
    const box = $('#chart-paises'); box.replaceChildren();
    const rows = variacion(), sel = state.pais;
    const W = box.clientWidth || 360, rowH = 40, top = 8, H = top + rows.length * rowH + 24;
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('h_trend'));
    const names = svg.append('g'); names.selectAll('text').data(rows).join('text').attr('class', 'strong').attr('y', (r, i) => top + i * rowH + rowH / 2 + 4).text((r) => paisName(r.pais)).style('opacity', (r) => !sel || r.pais === sel ? 1 : 0.35);
    let ml = 0; names.selectAll('text').each(function () { ml = Math.max(ml, this.getComputedTextLength()); }); ml += 12;
    const mr = 116;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(r.a.t, r.b.t)) * 1.05]).range([ml, Math.max(ml + 60, W - mr)]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - 20})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - ml - mr) / 70))).tickSize(-(H - 28)).tickFormat((v) => v + ' t'));
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${top + i * rowH + rowH / 2})`).style('opacity', (r) => !sel || r.pais === sel ? 1 : 0.25);
    g.append('line').attr('x1', (r) => x(r.a.t)).attr('x2', (r) => x(r.b.t)).attr('stroke', 'var(--muted)').attr('stroke-opacity', .5).attr('stroke-width', 3);
    g.append('circle').attr('cx', (r) => x(r.a.t)).attr('r', 5).attr('fill', 'var(--muted)');
    g.append('circle').attr('cx', (r) => x(r.b.t)).attr('r', 6).attr('fill', 'var(--accent)');
    g.append('text').attr('x', (r) => Math.max(x(r.a.t), x(r.b.t)) + 10).attr('y', 4).attr('fill', (r) => r.pct < 0 ? 'var(--bad)' : 'var(--ok)').style('fill', (r) => r.pct < 0 ? 'var(--bad)' : 'var(--ok)')
      .text((r) => `${fmt1(r.b.t)} t (${r.pct > 0 ? '+' : ''}${fmt1(r.pct)}%)`);
    g.append('rect').attr('y', -rowH / 2).attr('width', W).attr('height', rowH).attr('fill', 'transparent')
      .on('mousemove', (ev, r) => tip.show(ev, t('tt_trend')(paisName(r.pais), fmt1(r.a.t), r.a.anio, fmt1(r.b.t), r.b.anio))).on('mouseleave', tip.hide);
  }
  function chartPistas() {
    const box = $('#chart-pistas'); box.replaceChildren();
    const rows = D.pistas_serie; const paises = Array.from(new Set(rows.map((r) => r.pais)));
    const W = box.clientWidth || 360, H = 240, m = { t: 14, r: 100, b: 24, l: 32 };
    const x = d3.scaleLinear().domain(d3.extent(rows, (r) => r.anio)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.pistas) * 1.1]).nice().range([H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('h_strip_series'));
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)));
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d')).tickSize(0));
    const col = ['var(--sea)', 'var(--land)'];
    paises.forEach((p, i) => {
      const s = rows.filter((r) => r.pais === p).sort((a, b) => a.anio - b.anio), full = s.filter((r) => !r.parcial), part = s.filter((r) => r.parcial);
      const line = d3.line().x((r) => x(r.anio)).y((r) => y(r.pistas));
      svg.append('path').attr('d', line(full)).attr('fill', 'none').attr('stroke', col[i]).attr('stroke-width', 2.5);
      if (part.length) svg.append('path').attr('d', line([full[full.length - 1], ...part])).attr('fill', 'none').attr('stroke', col[i]).attr('stroke-width', 2).attr('stroke-dasharray', '4 4');
      svg.append('g').selectAll('circle').data(s).join('circle').attr('cx', (r) => x(r.anio)).attr('cy', (r) => y(r.pistas)).attr('r', 4.5).attr('fill', (r) => r.parcial ? 'var(--bg)' : col[i]).attr('stroke', col[i]).attr('stroke-width', 2)
        .on('mousemove', (ev, r) => tip.show(ev, t('tt_strip')(paisName(r.pais), r.anio, r.pistas, r.parcial))).on('mouseleave', tip.hide);
      const last = s[s.length - 1];
      svg.append('text').attr('class', 'strong').attr('x', x(last.anio) + 10).attr('y', y(last.pistas) + (i === 0 ? -6 : 14)).text(`${paisName(p)} ${last.pistas}`);
    });
  }
  function renderCharts() { if (!D) return; renderMap(); chartCanu(); chartPaises(); chartPistas(); }

  function render() { buildFilters(); renderLede(); renderKpis(); renderLegend(); renderGuyana(); renderBalloon(); renderStrips(); renderOps(); renderCases(); renderCharts(); }

  // ---------- boot ----------
  async function boot() {
    initLang(); applyStatic(); wire();
    const names = ['eventos', 'rutas', 'incautaciones', 'pistas_serie', 'guyana_canu', 'decisiones', 'pistas_reportes', 'operaciones', 'informes', 'meta'];
    try {
      const res = await Promise.all([...names.map((n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })), fetch('data/region.geo.json').then((r) => r.json())]);
      D = {}; names.forEach((n, i) => { D[n] = res[i]; }); D.geo = res[names.length];
      render();
    } catch (e) {
      $('#lede').textContent = t('load_err');
    }
  }
  boot();
})();
