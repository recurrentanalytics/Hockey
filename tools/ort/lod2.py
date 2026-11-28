"""Echte Dächer: liest aus dem LoD2-Gebäudemodell des LGLN (CityGML, 1-km-Kachel) für jedes Haus des Ortes
die gemessene Dachform, Trauf- und Firsthöhe über Gelände, Dachneigung und Firstrichtung und schreibt sie nach
locations/<ort>/geo/daecher.json. Die Regeln der Häuser (src/bau/haus.js) nehmen diese Werte statt der
Schätzungen aus OpenStreetMap.

Daten: © GeoBasis-DE / LGLN (Jahr der letzten Änderung), Datenlizenz Deutschland – Namensnennung – Version 2.0
(dl-de/by-2-0). Kacheln: https://lod2.opengeodata.lgln.niedersachsen.de/LoD2_32_<E km>_<N km>_1_ni.gml
(Übersicht: https://opengeodata.lgln.niedersachsen.de, Datensatz „3D-Gebäudemodell (LoD2)“).

Aufruf:  python3 tools/ort/lod2.py tools/ort/boni.json daten/boni
         lädt die nötigen Kacheln nach daten/boni/ (nicht einchecken) und schreibt locations/boni/geo/daecher.json
Benötigt: Python 3 (nur Standardbibliothek).
"""
import json, math, os, sys, urllib.request
import xml.etree.ElementTree as ET

KACHEL = 'https://lod2.opengeodata.lgln.niedersachsen.de/LoD2_32_{e}_{n}_1_ni.{endung}'
NS = {'bldg': 'http://www.opengis.net/citygml/building/1.0', 'core': 'http://www.opengis.net/citygml/1.0',
      'gen': 'http://www.opengis.net/citygml/generics/1.0', 'gml': 'http://www.opengis.net/gml'}
# AdV-Dachformschlüssel → Form der Regeln (sattel, walm, flach); None = keine sichere Zuordnung, die Regeln schätzen weiter
FORMEN = {'1000': ('Flachdach', 'flach'), '2100': ('Pultdach', 'flach'), '2200': ('versetztes Pultdach', 'flach'),
          '3100': ('Satteldach', 'sattel'), '3200': ('Walmdach', 'walm'), '3300': ('Krüppelwalmdach', 'walm'),
          '3400': ('Mansardendach', None), '3500': ('Zeltdach', 'walm'), '3600': ('Kegeldach', None),
          '3700': ('Kuppeldach', None), '3800': ('Sheddach', None), '3900': ('Bogendach', None),
          '4000': ('Turmdach', None), '5000': ('Mischform', None), '9999': ('Sonstiges', None)}

def holen(url, ziel):
    if os.path.exists(ziel):
        print('vorhanden', ziel); return
    print('lade', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'borstenboom-tools'})
    data = urllib.request.urlopen(req, timeout=600).read()
    if b'NoSuchKey' in data[:400]:
        raise SystemExit(f'Kachel nicht vorhanden: {url}')
    open(ziel, 'wb').write(data)

def attribute(el):
    return {a.get('name'): a.findtext('gen:value', namespaces=NS) for a in el.findall('gen:stringAttribute', NS)}

def zahl(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def dachflaechen(el):
    """Alle Dachflächen eines Gebäudes oder Gebäudeteils als Listen von (x, y, z) in UTM 32 / DHHN2016."""
    aus = []
    for rs in el.iter('{%s}RoofSurface' % NS['bldg']):
        for pos in rs.iter('{%s}posList' % NS['gml']):
            v = [float(x) for x in pos.text.split()]
            aus.append([tuple(v[i:i + 3]) for i in range(0, len(v) - 2, 3)])
    return aus

def firstrichtung(flaechen):
    """Richtung des Firsts (Einheitsvektor Ost, Nord): die längste waagerechte Kante in Höhe des höchsten Punkts."""
    if not flaechen: return None
    zmax = max(p[2] for f in flaechen for p in f)
    best, laenge = None, 0.0
    for f in flaechen:
        for a, b in zip(f, f[1:]):
            if abs(a[2] - zmax) < 0.2 and abs(b[2] - zmax) < 0.2:
                dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy)
                if l > laenge: best, laenge = (dx / l, dy / l), l
    if not best or laenge < 1.0: return None
    if best[0] < 0 or (best[0] == 0 and best[1] < 0): best = (-best[0], -best[1])  # eine Richtung, kein Vorzeichen
    return [round(best[0], 4), round(best[1], 4)], round(laenge, 2)

def gebaeude(el):
    """Gemessene Dachdaten eines Gebäudes; bei mehreren Teilen zählt der Teil mit der größten Dachfläche."""
    teile = el.findall('bldg:consistsOfBuildingPart/bldg:BuildingPart', NS) or [el]
    kandidaten = []
    for t in teile:
        a = attribute(t) or attribute(el)
        code = t.findtext('bldg:roofType', namespaces=NS) or el.findtext('bldg:roofType', namespaces=NS)
        boden, traufe, first = zahl(a.get('AbsoluteHoehe')), zahl(a.get('MittlereTraufHoehe')), zahl(a.get('Firsthoehe'))
        if boden is None or traufe is None or first is None: continue
        fl = dachflaechen(t)
        name, form = FORMEN.get(code, (f'Schlüssel {code}', None))
        eintrag = {'dachform': name, 'schluessel': code, 'form': form, 'traufe_m': round(traufe - boden, 2), 'first_m': round(first - boden, 2),
                   'neigung_grad': zahl(a.get('Dachneigung')), 'dachflaeche_m2': zahl(a.get('Dachflaeche')), 'gelaende_m': round(boden, 2)}
        r = firstrichtung(fl) if form in ('sattel', 'walm') else None
        if r: eintrag['first'], eintrag['firstlaenge_m'] = r
        kandidaten.append(eintrag)
    if not kandidaten: return None
    haupt = max(kandidaten, key=lambda k: k['dachflaeche_m2'] or 0)
    haupt['teile'] = len(kandidaten)
    return haupt

def main(cfg_pfad, aus):
    cfg = json.load(open(cfg_pfad)); os.makedirs(aus, exist_ok=True)
    ziel = cfg['geodaten']['ziel']
    oids = {f['properties']['oid'][:16]: f['properties']['oid'] for f in json.load(open(os.path.join(ziel, 'gebaeude.geojson')))['features']}
    e0, n0 = cfg['referenzraster']['ursprung_utm32']; h = cfg['geodaten']['halbe_seite_m']
    kacheln = sorted({(e, n) for e in range(int((e0 - h) // 1000), int((e0 + h) // 1000) + 1) for n in range(int((n0 - h) // 1000), int((n0 + h) // 1000) + 1)})
    daecher, staende = {}, set()
    for e, n in kacheln:
        gml = os.path.join(aus, f'LoD2_32_{e}_{n}_1_ni.gml'); meta = gml[:-3] + 'json'
        holen(KACHEL.format(e=e, n=n, endung='gml'), gml); holen(KACHEL.format(e=e, n=n, endung='json'), meta)
        staende.add(json.load(open(meta)).get('LetzteAenderung'))
        for _, el in ET.iterparse(gml):
            if el.tag != '{%s}Building' % NS['bldg']: continue
            name = el.findtext('core:externalReference/core:externalObject/core:name', namespaces=NS)
            if name in oids:
                d = gebaeude(el)
                if d: daecher[oids[name]] = d
            el.clear()
    stand = max(s for s in staende if s)
    aus_pfad = os.path.join(ziel, 'daecher.json')
    json.dump({'quelle': f'© GeoBasis-DE / LGLN ({stand[:4]}), dl-de/by-2-0: 3D-Gebäudemodell LoD2, Kacheln ' + ', '.join(f'{e}/{n}' for e, n in kacheln),
               'stand': stand, 'erklaerung': 'Je ALKIS-Gebäude (oid): gemessene Dachform (AdV-Schlüssel), Trauf- und Firsthöhe über Gelände (m), Dachneigung, '
               'Firstrichtung als Einheitsvektor (Ost, Nord). Erzeugt von tools/ort/lod2.py.',
               'haeuser': dict(sorted(daecher.items()))}, open(aus_pfad, 'w'), ensure_ascii=False, indent=0)
    formen = {}
    for d in daecher.values(): formen[d['dachform']] = formen.get(d['dachform'], 0) + 1
    print(f'{aus_pfad}: {len(daecher)} von {len(oids)} Häusern mit LoD2-Dach', formen)

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
