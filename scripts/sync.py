#!/usr/bin/env python3
"""Sincroniza lo aprobado en el panel privado con los datos del sitio.

Uso (desde la raíz del repositorio):

  python3 -I scripts/sync.py pending EXPORT_DIR
      Lista, en JSON, los registros aprobados que todavía no están en data/
      y los campos en inglés que hay que traducir para cada uno.

  python3 -I scripts/sync.py merge EXPORT_DIR TRADUCCIONES.json
      Agrega esos registros a data/*.json con sus traducciones, actualiza
      data/meta.json y valida el resultado. No escribe nada si falta algo.

La traducción puede incluir también desc_es, res_es o nota_es para reescribir
el texto en español en tono neutro (por ejemplo, cambiar "Solo vi resúmenes"
por "Basado solo en resúmenes de prensa"), sin cambiar los hechos ni las cifras.

EXPORT_DIR es la carpeta donde ArtifactData guardó las colecciones con
out_dir: EXPORT_DIR/data/registro/{casos,pistas,operaciones,informes_guyana}/<id>.json
Cada archivo contiene solo los campos del documento; el nombre es su id.
"""
import json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')

PAIS_EN = {
    'Guyana': 'Guyana', 'Brasil': 'Brazil', 'Surinam': 'Suriname', 'Venezuela': 'Venezuela', 'Colombia': 'Colombia',
    'Belice': 'Belize', 'Costa Rica': 'Costa Rica', 'El Salvador': 'El Salvador', 'Guatemala': 'Guatemala',
    'Haití': 'Haiti', 'Honduras': 'Honduras', 'Jamaica': 'Jamaica', 'Nicaragua': 'Nicaragua', 'Panamá': 'Panama',
    'República Dominicana': 'Dominican Republic', 'Trinidad y Tobago': 'Trinidad and Tobago', 'Otro': 'Other',
    'EE.UU.': 'United States', 'Países Bajos': 'Netherlands', 'Ecuador': 'Ecuador', 'México': 'Mexico',
    'Francia': 'France', 'Reino Unido': 'United Kingdom', 'Cuba': 'Cuba', 'Puerto Rico': 'Puerto Rico',
}
MOTIVO_EN = {'Narcotráfico': 'Drug trafficking', 'Minería ilegal': 'Illegal mining',
             'Narcotráfico y minería ilegal': 'Drug trafficking and illegal mining'}
MODOS = {'Aéreo', 'Marítimo', 'Terrestre', 'Sin precisar'}

# Campos en inglés que debe aportar la traducción, por tipo.
NEEDS = {
    'caso': ['desc_en'],
    'pista': ['zona_en', 'accion_en', 'periodo_en', 'agencias_en', 'nota_en'],
    'operacion': ['nombre_en', 'zona_en', 'res_en', 'agencias_en'],
    'informe': ['titulo_en', 'resumen_en', 'puntos_en'],
}


def load(name):
    with open(os.path.join(DATA, name + '.json'), encoding='utf-8') as f:
        return json.load(f)


def save(name, obj):
    path = os.path.join(DATA, name + '.json')
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, path)


def read_export(export_dir, coll):
    d = os.path.join(export_dir, 'data', 'registro', coll)
    out = []
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if fn.endswith('.json'):
            with open(os.path.join(d, fn), encoding='utf-8') as f:
                doc = json.load(f)
            if isinstance(doc, dict) and 'data' in doc and isinstance(doc['data'], dict) and len(doc) <= 6:
                doc = doc['data']
            out.append((fn[:-5], doc))
    return out


def num(v):
    if v is None or v == '':
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def safe_url(u):
    return u if isinstance(u, str) and re.match(r'^https?://', u) else ''


def split(s):
    if isinstance(s, list):
        return [str(x).strip() for x in s if str(x).strip()]
    return [x.strip() for x in str(s or '').split(';') if x.strip()]


def pending(export_dir):
    have_ev = {e['id'] for e in load('eventos')}
    have_pi = {e['id'] for e in load('pistas_reportes')}
    have_op = {e['id'] for e in load('operaciones')}
    have_in = {e['fecha'] for e in load('informes')}
    items = []
    for doc_id, d in read_export(export_dir, 'casos'):
        rid = 'R-' + doc_id
        if rid not in have_ev:
            items.append({'id': rid, 'tipo': 'caso', 'es': {'descripcion': d.get('descripcion', '')}, 'necesita': NEEDS['caso']})
    for doc_id, d in read_export(export_dir, 'pistas'):
        rid = 'R-' + doc_id
        if rid not in have_pi:
            items.append({'id': rid, 'tipo': 'pista', 'es': {k: d.get(k, '') for k in ('zona', 'accion', 'periodo', 'agencias', 'nota')}, 'necesita': NEEDS['pista']})
    for doc_id, d in read_export(export_dir, 'operaciones'):
        rid = 'R-' + doc_id
        if rid not in have_op:
            items.append({'id': rid, 'tipo': 'operacion', 'es': {'nombre': d.get('nombre', ''), 'zona': d.get('zona', ''), 'resultados': d.get('resultados', ''), 'agencias': split(d.get('agencias'))},
                          'necesita': NEEDS['operacion'], 'nota': 'agencias_en debe ser una lista con el mismo número de elementos que agencias'})
    for doc_id, d in read_export(export_dir, 'informes_guyana'):
        fecha = str(d.get('fecha') or doc_id)
        if fecha not in have_in:
            items.append({'id': fecha, 'tipo': 'informe', 'es': {'titulo': d.get('titulo', ''), 'resumen': d.get('resumen', ''), 'puntos': [p.strip() for p in str(d.get('puntos', '')).split('\n') if p.strip()]},
                          'necesita': NEEDS['informe'], 'nota': 'puntos_en debe ser una lista con el mismo número de elementos que puntos'})
    print(json.dumps(items, ensure_ascii=False, indent=1))


def fail(msg):
    print('ERROR: ' + msg, file=sys.stderr)
    sys.exit(1)


def merge(export_dir, tr_path):
    with open(tr_path, encoding='utf-8') as f:
        tr = json.load(f)
    ev, pi, op, inf = load('eventos'), load('pistas_reportes'), load('operaciones'), load('informes')
    have_ev, have_pi, have_op, have_in = {e['id'] for e in ev}, {e['id'] for e in pi}, {e['id'] for e in op}, {e['fecha'] for e in inf}
    added = {'casos': 0, 'pistas': 0, 'operaciones': 0, 'informes': 0}

    def need(rid, tipo):
        t = tr.get(rid)
        if not isinstance(t, dict):
            fail(f'falta la traducción de {rid}')
        for k in NEEDS[tipo]:
            if k not in t or t[k] in (None, '') and k != 'nota_en':
                fail(f'falta {k} en la traducción de {rid}')
        return t

    for doc_id, d in read_export(export_dir, 'casos'):
        rid = 'R-' + doc_id
        if rid in have_ev:
            continue
        t = need(rid, 'caso')
        pais = str(d.get('pais', 'Otro'))
        modo = d.get('modalidad')
        if modo not in MODOS - {'Sin precisar'}:
            fail(f'{rid}: modalidad no válida {modo!r}')
        ev.append({'id': rid, 'fecha': str(d.get('fecha', '')), 'pais': pais, 'pais_en': PAIS_EN.get(pais, pais), 'modalidad': modo,
                   'kg': num(d.get('kg')), 'desc_es': str(t.get('desc_es') or d.get('descripcion', '')), 'desc_en': str(t['desc_en']),
                   'fuente': str(d.get('fuente', '')), 'url': safe_url(d.get('url'))})
        added['casos'] += 1

    for doc_id, d in read_export(export_dir, 'pistas'):
        rid = 'R-' + doc_id
        if rid in have_pi:
            continue
        t = need(rid, 'pista')
        pais = str(d.get('pais', 'Otro'))
        motivo = str(d.get('motivo') or 'Narcotráfico')
        pi.append({'id': rid, 'fecha': str(d.get('fecha', '')), 'pais': pais, 'pais_en': PAIS_EN.get(pais, pais),
                   'lat': num(d.get('lat')), 'lon': num(d.get('lon')), 'pistas': num(d.get('pistas')),
                   'zona_es': str(d.get('zona', '')), 'zona_en': str(t['zona_en']),
                   'accion_es': str(d.get('accion', '')), 'accion_en': str(t['accion_en']),
                   'periodo_es': str(d.get('periodo', '')), 'periodo_en': str(t['periodo_en']),
                   'motivo': motivo, 'motivo_en': MOTIVO_EN.get(motivo, motivo), 'narco': motivo.startswith('Narcotr'),
                   'agencias_es': str(d.get('agencias', '')), 'agencias_en': str(t['agencias_en']),
                   'operacion': str(d.get('operacion') or ''), 'nota_es': str(t.get('nota_es') or d.get('nota') or ''), 'nota_en': str(t.get('nota_en') or ''),
                   'fuente': str(d.get('fuente', '')), 'url': safe_url(d.get('url'))})
        added['pistas'] += 1

    orden = max([o.get('orden', 0) for o in op] + [1000])
    for doc_id, d in read_export(export_dir, 'operaciones'):
        rid = 'R-' + doc_id
        if rid in have_op:
            continue
        t = need(rid, 'operacion')
        ag_es = split(d.get('agencias'))
        ag_en = split(t['agencias_en'])
        if len(ag_en) != len(ag_es):
            fail(f'{rid}: agencias_en tiene {len(ag_en)} elementos y agencias {len(ag_es)}')
        modo = d.get('modalidad') if d.get('modalidad') in MODOS else 'Sin precisar'
        orden += 1
        op.append({'id': rid, 'fecha': str(d.get('fecha', '')), 'orden': orden, 'nombre_es': str(d.get('nombre', '')), 'nombre_en': str(t['nombre_en']),
                   'paises': split(d.get('paises')), 'agencias_es': ag_es, 'agencias_en': ag_en,
                   'zona_es': str(d.get('zona', '')), 'zona_en': str(t['zona_en']), 'modalidad': modo,
                   'res_es': str(t.get('res_es') or d.get('resultados', '')), 'res_en': str(t['res_en']), 'kg': num(d.get('kg')),
                   'fuente': str(d.get('fuente', '')), 'url': safe_url(d.get('url'))})
        added['operaciones'] += 1

    for doc_id, d in read_export(export_dir, 'informes_guyana'):
        fecha = str(d.get('fecha') or doc_id)
        if fecha in have_in:
            continue
        t = need(fecha, 'informe')
        puntos_es = [p.strip() for p in str(d.get('puntos', '')).split('\n') if p.strip()]
        puntos_en = [str(p).strip() for p in t['puntos_en'] if str(p).strip()]
        if len(puntos_en) != len(puntos_es):
            fail(f'informe {fecha}: puntos_en tiene {len(puntos_en)} elementos y puntos {len(puntos_es)}')
        fuentes = []
        for line in str(d.get('fuentes', '')).split('\n'):
            if '|' in line:
                n, u = line.split('|', 1)
                if safe_url(u.strip()):
                    fuentes.append({'n': n.strip(), 'u': u.strip()})
        inf.append({'fecha': fecha, 'titulo_es': str(d.get('titulo', '')), 'titulo_en': str(t['titulo_en']),
                    'resumen_es': str(d.get('resumen', '')), 'resumen_en': str(t['resumen_en']),
                    'puntos_es': puntos_es, 'puntos_en': puntos_en, 'fuentes': fuentes})
        added['informes'] += 1

    if not any(added.values()):
        print(json.dumps({'agregados': added, 'cambios': False}))
        return
    save('eventos', ev); save('pistas_reportes', pi); save('operaciones', op); save('informes', inf)
    save('meta', {'actualizado': datetime.date.today().isoformat()})
    validate()
    print(json.dumps({'agregados': added, 'cambios': True}))


def validate():
    for name, req in [('eventos', ['id', 'fecha', 'pais', 'modalidad', 'desc_es', 'desc_en', 'url']),
                      ('pistas_reportes', ['id', 'fecha', 'pais', 'zona_es', 'zona_en', 'motivo', 'url']),
                      ('operaciones', ['id', 'fecha', 'nombre_es', 'nombre_en', 'paises', 'agencias_es', 'agencias_en', 'res_es', 'res_en', 'url']),
                      ('informes', ['fecha', 'titulo_es', 'titulo_en', 'puntos_es', 'puntos_en', 'fuentes'])]:
        rows = load(name)
        ids = [r.get('id', r.get('fecha')) for r in rows]
        if len(ids) != len(set(ids)):
            fail(f'{name}: ids repetidos')
        for r in rows:
            for k in req:
                if k not in r:
                    fail(f'{name}: falta {k} en {r.get("id", r.get("fecha"))}')
    print('validación ok', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'pending':
        pending(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == 'merge':
        merge(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 2 and sys.argv[1] == 'validate':
        validate()
    else:
        print(__doc__)
        sys.exit(2)
