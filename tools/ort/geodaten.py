"""Vektor-Geodaten eines Ortes: amtliche Grundrisse und Flächen (ALKIS, LGLN) und die Details aus
OpenStreetMap, in einem Koordinatensystem (ETRS89 / UTM 32N, EPSG:25832) und mit dem Platzrahmen.

  python3 tools/ort/geodaten.py abrufen tools/ort/boni.json   lädt die Rohdaten (Netz nötig, ca. 1 Minute)
  python3 tools/ort/geodaten.py bauen   tools/ort/boni.json   Rohdaten → Ebenen, Rahmen, Prüfung, Bericht
  python3 tools/ort/geodaten.py pruefen tools/ort/boni.json   baut im Speicher neu und vergleicht mit den Dateien

»bauen« rechnet nur aus den eingecheckten Rohdaten (roh/*.gz) und der Ortskonfiguration: gleicher
Eingang, bitgleiches Ergebnis. Für einen größeren Ausschnitt oder Nachbarblöcke »halbe_seite_m« in
der Konfiguration ändern, dann abrufen und bauen. Ansicht: tools/ort/ansicht.html.
Braucht nur Python 3 (keine Zusatzpakete)."""
import gzip, hashlib, io, json, math, os, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utm import to_utm32, from_utm32, konvergenz_grad, massstab

ALKIS_WFS = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wfs_einfach'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter']
NS = {'a': 'http://repository.gdi-de.org/schemas/adv/produkt/alkis-vereinfacht/2.0',
      'gml': 'http://www.opengis.net/gml/3.2'}
SEITE = 1000                                             # größte Objektzahl je Abfrage, die der Dienst annimmt
LIZENZ_ALKIS = '© GeoBasis-DE / LGLN ({jahr}), CC BY 4.0'
LIZENZ_OSM = '© OpenStreetMap-Mitwirkende, ODbL 1.0'
# OSM: nur Dinge mit Ort und Form; Linien- und Grenzrelationen (Buslinien, Stadtteile) bleiben draußen
OSM_SCHLUESSEL = ['building', 'building:part', 'highway', 'area:highway', 'leisure', 'landuse', 'natural', 'barrier',
                  'playground', 'amenity', 'man_made', 'shop', 'tourism', 'historic', 'railway', 'sport']
r2 = lambda v: round(v + 0.0, 2)


# ------------------------------------------------------------------ Ort, Rahmen, Ausschnitt

def lade_ort(pfad):
    cfg = json.load(open(pfad, encoding='utf-8'))
    wurzel = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(pfad))))
    cfg['_ziel'] = os.path.join(wurzel, cfg['geodaten']['ziel'])
    return cfg

def rahmen(cfg):
    """Platzrahmen wie in den übrigen Werkzeugen: Ursprung im Mittel der Zaunecken, a längs A→D, b quer A→B."""
    P = {k: to_utm32(*v) for k, v in cfg['ecken_wgs84'].items()}
    c = [sum(p[0] for p in P.values()) / 4, sum(p[1] for p in P.values()) / 4]
    ad = (P['D'][0] - P['A'][0], P['D'][1] - P['A'][1])
    l = math.hypot(*ad)
    a = (ad[0] / l, ad[1] / l)
    b = (-a[1], a[0])                                    # rechtwinklig zu a, zeigt von A nach B
    assert b[0] * (P['B'][0] - P['A'][0]) + b[1] * (P['B'][1] - P['A'][1]) > 0
    h = cfg['geodaten']['halbe_seite_m']
    box = [math.floor(c[0]) - h, math.floor(c[1]) - h, math.floor(c[0]) + h, math.floor(c[1]) + h]
    return dict(ecken=P, ursprung=c, a=a, b=b, bbox=box)

def platz_koord(R, e, n):
    de, dn = e - R['ursprung'][0], n - R['ursprung'][1]
    return de * R['a'][0] + dn * R['a'][1], de * R['b'][0] + dn * R['b'][1]


# ------------------------------------------------------------------ abrufen

def gz(daten):
    puffer = io.BytesIO()
    with gzip.GzipFile(fileobj=puffer, mode='wb', mtime=0, filename='') as f:
        f.write(daten)
    return puffer.getvalue()

def hole(url, daten=None):
    req = urllib.request.Request(url, data=daten, headers={'User-Agent': 'borstenboom-tools'})
    return urllib.request.urlopen(req, timeout=180).read()

def abrufen(cfg):
    R = rahmen(cfg)
    w, s, o, n = R['bbox']
    roh = os.path.join(cfg['_ziel'], 'roh')
    os.makedirs(roh, exist_ok=True)
    quellen = []

    def ablegen(name, daten, url, stand, lizenz):
        open(os.path.join(roh, name + '.gz'), 'wb').write(gz(daten))
        quellen.append(dict(datei=f'roh/{name}.gz', url=url, stand=stand, lizenz=lizenz, bytes=len(daten),
                            sha256=hashlib.sha256(daten).hexdigest()))
        print(f'{name}: {len(daten) / 1024:.0f} KB, Stand {stand}')

    for name, typ, srs in (('alkis_gebaeude.gml', 'GebaeudeBauwerk', 25832), ('alkis_nutzung.gml', 'Nutzung', 25832),
                           ('alkis_gebaeude_4258.gml', 'GebaeudeBauwerk', 4258)):
        url = (f'{ALKIS_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ave:{typ}&COUNT={SEITE}'
               f'&SRSNAME=urn:ogc:def:crs:EPSG::{srs}&BBOX={w},{s},{o},{n},urn:ogc:def:crs:EPSG::25832')
        daten = hole(url)
        kopf = daten[:1500].decode('utf-8', 'replace')
        if 'FeatureCollection' not in kopf:
            raise SystemExit(f'ALKIS-Dienst meldet einen Fehler für {typ}:\n{kopf[:400]}')
        if f'numberReturned="{SEITE}"' in kopf:
            raise SystemExit(f'{typ}: {SEITE} Objekte, die Antwort ist vermutlich abgeschnitten. Ausschnitt verkleinern oder in Kacheln abrufen.')
        ablegen(name, daten, url, kopf.split('timeStamp="')[1].split('"')[0], LIZENZ_ALKIS.format(jahr=time.strftime('%Y')))

    ecken = [from_utm32(e, nn) for e in (w, o) for nn in (s, n)]
    lon0, lon1 = min(p[0] for p in ecken), max(p[0] for p in ecken)
    lat0, lat1 = min(p[1] for p in ecken), max(p[1] for p in ecken)
    box = f'{math.floor(lat0 * 1e5) / 1e5},{math.floor(lon0 * 1e5) / 1e5},{math.ceil(lat1 * 1e5) / 1e5},{math.ceil(lon1 * 1e5) / 1e5}'
    frage = (f'[out:json][timeout:120][bbox:{box}];\n(\n' + ''.join(f'  nw["{k}"];\n' for k in OSM_SCHLUESSEL)
             + '  relation[type=multipolygon];\n);\nout body geom qt;\n')
    fehler = []
    for server in OVERPASS * 4:                          # die offenen Server sind oft überlastet: mehrere Runden
        try:
            daten = hole(server, urllib.parse.urlencode({'data': frage}).encode())
            stand = json.loads(daten)['osm3s']['timestamp_osm_base']
            ablegen('osm.json', daten, server + ' mit der Abfrage in abruf.json', stand, LIZENZ_OSM)
            break
        except Exception as e:                           # überlasteter Spiegel: den nächsten versuchen
            fehler.append(f'{server}: {e}')
            print('  wartet,', fehler[-1])
            time.sleep(15)
    else:
        raise SystemExit('Kein Overpass-Server hat geantwortet:\n' + '\n'.join(fehler))
    json.dump(dict(abgerufen=time.strftime('%Y-%m-%d'), bbox_utm32=R['bbox'], overpass_abfrage=frage, quellen=quellen),
              open(os.path.join(roh, 'abruf.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Rohdaten in', roh)


# ------------------------------------------------------------------ Geometrie-Helfer

def flaeche(ring):
    """Vorzeichenbehaftete Fläche. Gerechnet wird relativ zum ersten Punkt: mit den vollen UTM-Werten
    (Millionen Meter) gingen in den Produkten die Zentimeter verloren."""
    x0, y0 = ring[0]
    return sum((ring[i][0] - x0) * (ring[i + 1][1] - y0) - (ring[i + 1][0] - x0) * (ring[i][1] - y0) for i in range(len(ring) - 1)) / 2

def schwerpunkt(ring):
    x0, y0 = ring[0]
    r = [(x - x0, y - y0) for x, y in ring]
    f = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2
    if abs(f) < 1e-9:
        return ring[0]
    cx = sum((r[i][0] + r[i + 1][0]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1))
    cy = sum((r[i][1] + r[i + 1][1]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1))
    return x0 + cx / (6 * f), y0 + cy / (6 * f)

def im_ring(p, ring):
    drin = False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < x1 + (p[1] - y1) * (x2 - x1) / (y2 - y1):
            drin = not drin
    return drin

def im_polygon(p, ringe):
    return im_ring(p, ringe[0]) and not any(im_ring(p, r) for r in ringe[1:])

def abstand_strecke(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    t = 0 if l2 == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)

def ringe_von(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []

def in_box(geom, box, rand=0.0):
    """Berührt die Geometrie den Ausschnitt (über ihre Stützpunkte oder weil sie ihn umschließt)?"""
    def punkte(c):
        if isinstance(c[0], (int, float)):
            yield c
        else:
            for teil in c:
                yield from punkte(teil)
    pts = list(punkte(geom['coordinates']))
    if any(box[0] - rand <= x <= box[2] + rand and box[1] - rand <= y <= box[3] + rand for x, y in pts):
        return True
    mitte = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
    return any(im_polygon(mitte, poly) for poly in ringe_von(geom))


# ------------------------------------------------------------------ ALKIS (GML) lesen

def lies_roh(cfg, name):
    return gzip.open(os.path.join(cfg['_ziel'], 'roh', name + '.gz')).read()

def alkis(cfg, name, typ, lonlat=False):
    wurzel = ET.fromstring(lies_roh(cfg, name))
    aus = []
    for ft in wurzel.iter('{%s}%s' % (NS['a'], typ)):
        eig, polygone = {}, []
        for kind in ft:
            k = kind.tag.split('}')[1]
            if k == 'geometrie':
                for poly in kind.iter('{%s}Polygon' % NS['gml']):
                    ringe = []
                    for rolle in ('exterior', 'interior'):
                        for r in poly.findall('gml:%s/gml:LinearRing/gml:posList' % rolle, NS):
                            z = [float(v) for v in r.text.split()]
                            paare = list(zip(z[0::2], z[1::2]))
                            if lonlat:                   # EPSG:4258 kommt als Breite, Länge
                                paare = [to_utm32(lon, lat) for lat, lon in paare]
                            ringe.append([(x, y) for x, y in paare])
                    polygone.append(ringe)
            elif k not in ('identifier',) and kind.text and kind.text.strip():
                eig[k] = kind.text.strip()
        aus.append((eig, polygone))
    return sorted(aus, key=lambda f: f[0]['oid'])

def geo_polygone(polygone):
    koord = [[[[r2(x), r2(y)] for x, y in ring] for ring in poly] for poly in polygone]
    return dict(type='Polygon', coordinates=koord[0]) if len(koord) == 1 else dict(type='MultiPolygon', coordinates=koord)


# ------------------------------------------------------------------ OSM lesen

def osm_ringe(teile):
    """Wege einer Multipolygon-Rolle an ihren Endpunkten zu geschlossenen Ringen fügen."""
    offen, ringe = [list(t) for t in teile if len(t) > 1], []
    while offen:
        ring = offen.pop(0)
        while ring[0] != ring[-1]:
            for i, t in enumerate(offen):
                if t[0] == ring[-1]:
                    ring += t[1:]; break
                if t[-1] == ring[-1]:
                    ring += t[::-1][1:]; break
            else:
                break                                    # Lücke: Ring bleibt offen und wird verworfen
            offen.pop(i)
        if ring[0] == ring[-1] and len(ring) >= 4:
            ringe.append(ring)
    return ringe

FLAECHEN = ('building', 'building:part', 'leisure', 'landuse', 'amenity', 'area:highway', 'playground', 'man_made', 'tourism', 'historic', 'shop')
NATUR_LINIEN = ('tree_row', 'cliff', 'ridge', 'coastline')

def osm(cfg, R):
    d = json.loads(lies_roh(cfg, 'osm.json'))
    aus = dict(gebaeude=[], wege=[], flaechen=[], baeume=[], einfriedungen=[], ausstattung=[])
    utm = lambda g: [to_utm32(p['lon'], p['lat']) for p in g]
    lin = lambda pts: dict(type='LineString', coordinates=[[r2(x), r2(y)] for x, y in pts])
    pol = lambda ringe: dict(type='Polygon', coordinates=[[[r2(x), r2(y)] for x, y in r] for r in ringe])
    for e in sorted(d['elements'], key=lambda e: (e['type'], e['id'])):
        t = e.get('tags') or {}
        if not any(k in t for k in OSM_SCHLUESSEL):
            continue
        eig = dict(t, osm=f"{e['type']}/{e['id']}")
        if e['type'] == 'node':
            g = dict(type='Point', coordinates=[r2(v) for v in to_utm32(e['lon'], e['lat'])])
            if t.get('natural') == 'tree':
                aus['baeume'].append((eig, g))
            elif 'barrier' in t:
                aus['einfriedungen'].append((eig, g))
            elif 'building' not in t:
                aus['ausstattung'].append((eig, g))
            continue
        if e['type'] == 'way':
            pts = utm(e.get('geometry') or [])
            if len(pts) < 2:
                continue
            zu = pts[0] == pts[-1] and len(pts) >= 4
            ringe = [pts] if zu else None
        else:
            if t.get('type') != 'multipolygon':
                continue
            aussen = osm_ringe([utm(m['geometry']) for m in e['members'] if m['type'] == 'way' and m.get('role') != 'inner' and m.get('geometry')])
            innen = osm_ringe([utm(m['geometry']) for m in e['members'] if m['type'] == 'way' and m.get('role') == 'inner' and m.get('geometry')])
            if not aussen:
                continue
            pts, zu = aussen[0], True
            ringe = None                                 # je Außenring ein Polygon mit seinen Innenringen
            teile = [[a] + [i for i in innen if im_ring(i[0], a)] for a in aussen]
        def flaechen_geom():
            if e['type'] == 'way':
                return pol(ringe)
            k = [[[[r2(x), r2(y)] for x, y in r] for r in teil] for teil in teile]
            return dict(type='Polygon', coordinates=k[0]) if len(k) == 1 else dict(type='MultiPolygon', coordinates=k)
        if t.get('natural') == 'tree_row':
            aus['baeume'].append((eig, lin(pts)))
        if 'barrier' in t:
            aus['einfriedungen'].append((eig, lin(pts)))
        if 'highway' in t and not (zu and t.get('area') == 'yes'):
            aus['wege'].append((eig, lin(pts)))
            continue
        if not zu:
            continue
        if 'building' in t or 'building:part' in t:
            aus['gebaeude'].append((eig, flaechen_geom()))
        elif any(k in t for k in FLAECHEN) or t.get('area') == 'yes' or ('natural' in t and t['natural'] not in NATUR_LINIEN):
            aus['flaechen'].append((eig, flaechen_geom()))
    box = R['bbox']
    return {k: [(eig, g) for eig, g in v if in_box(g, box)] for k, v in aus.items()}


# ------------------------------------------------------------------ bauen

def sammlung(name, titel, quelle, lizenz, merkmale):
    kopf = dict(type='FeatureCollection', name=name, titel=titel, quelle=quelle, lizenz=lizenz,
                crs=dict(type='name', properties=dict(name='urn:ogc:def:crs:EPSG::25832')))
    zeilen = [json.dumps(dict(type='Feature', properties=eig, geometry=g), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
              for eig, g in merkmale]
    text = json.dumps(kopf, ensure_ascii=False, separators=(',', ':'))[:-1] + ',"features":[\n' + ',\n'.join(zeilen) + '\n]}\n'
    return text

def hoehe_osm(t):
    """Gebäudehöhe aus OSM-Angaben: gemessene Höhe, sonst Geschosse × 3,2 m plus Dachgeschosse × 2,8 m (Schätzung)."""
    try:
        if 'height' in t:
            return r2(float(t['height'].replace('m', '').replace(',', '.').strip())), 'OSM height'
        if 'building:levels' in t:
            return r2(float(t['building:levels']) * 3.2 + float(t.get('roof:levels', 0)) * 2.8), 'geschätzt aus OSM-Geschossen'
    except ValueError:
        pass
    return None, None

def baue(cfg):
    R = rahmen(cfg)
    abruf = json.load(open(os.path.join(cfg['_ziel'], 'roh', 'abruf.json'), encoding='utf-8'))
    liz = {os.path.basename(q['datei']): q for q in abruf['quellen']}
    liz_alkis, liz_osm = liz['alkis_gebaeude.gml.gz']['lizenz'], liz['osm.json.gz']['lizenz']
    geb = alkis(cfg, 'alkis_gebaeude.gml', 'GebaeudeBauwerk')
    O = osm(cfg, R)

    # Gebäude: amtlicher Grundriss; Höhe und Dachform aus dem OSM-Gebäude, das den Schwerpunkt enthält
    gebaeude = []
    for eig, polygone in geb:
        g = geo_polygone(polygone)
        f = sum(abs(flaeche(p[0])) - sum(abs(flaeche(i)) for i in p[1:]) for p in polygone)
        e = dict(oid=eig['oid'], art=eig.get('gebnutzbez'), funktion=eig.get('funktion'), stand=eig.get('aktualit', '').rstrip('Z'),
                 flaeche_m2=r2(f))
        for k_alt, k_neu in (('name', 'name'), ('lagebeztxt', 'adresse')):
            if eig.get(k_alt):
                e[k_neu] = eig[k_alt]
        c = schwerpunkt(max((p[0] for p in polygone), key=lambda r: abs(flaeche(r))))
        for oe, og in O['gebaeude']:
            if 'building' in oe and any(im_polygon(c, p) for p in ringe_von(og)):
                h, woher = hoehe_osm(oe)
                if h:
                    e.update(hoehe_m=h, hoehe_quelle=woher)
                for k in ('building:levels', 'roof:levels', 'roof:shape'):
                    if k in oe:
                        e['osm_' + k.replace(':', '_')] = oe[k]
                e['osm'] = oe['osm']
                break
        gebaeude.append((e, g))

    nutzung = []
    for eig, polygone in alkis(cfg, 'alkis_nutzung.gml', 'Nutzung'):
        f = sum(abs(flaeche(p[0])) - sum(abs(flaeche(i)) for i in p[1:]) for p in polygone)
        e = dict(oid=eig['oid'], nutzart=eig.get('nutzart'), stand=eig.get('aktualit', '').rstrip('Z'), flaeche_m2=r2(f))
        if eig.get('bez'):
            e['bezeichnung'] = eig['bez']
        if eig.get('name'):
            e['name'] = eig['name']
        nutzung.append((e, geo_polygone(polygone)))

    # Platz: Zaunecken aus der Ortskonfiguration (Luftbild, vom Verein bestätigt), dazu der Rahmen
    E = R['ecken']
    seiten = {a + b: math.hypot(E[a][0] - E[b][0], E[a][1] - E[b][1]) for a, b in ('AB', 'BC', 'CD', 'DA')}
    ring = [[r2(v) for v in E[k]] for k in 'ABCDA']
    platz = [(dict(art='zaun', name=cfg['name'], quelle='Luftbild DOP20 (LGLN), Lage und Form vom Verein bestätigt', genauigkeit_m=1.0,
                   seiten_m={k: r2(v) for k, v in seiten.items()}), dict(type='Polygon', coordinates=[ring]))]
    platz += [(dict(art='ecke', name=k, platz_ab=[r2(v) for v in platz_koord(R, *E[k])]), dict(type='Point', coordinates=[r2(v) for v in E[k]])) for k in 'ABCD']
    c = R['ursprung']
    platz.append((dict(art='ursprung', name='Platzmitte'), dict(type='Point', coordinates=[r2(c[0]), r2(c[1])])))
    for achse in 'ab':
        platz.append((dict(art='achse', name=achse, laenge_m=10), dict(type='LineString', coordinates=[[r2(c[0]), r2(c[1])],
                      [r2(c[0] + 10 * R[achse][0]), r2(c[1] + 10 * R[achse][1])]])))

    lon, lat = from_utm32(*c)
    azimut = lambda v: (math.degrees(math.atan2(v[0], v[1])) + 360) % 360
    rahmen_json = dict(
        ort=cfg['id'], crs='EPSG:25832', crs_name='ETRS89 / UTM Zone 32N', einheit='Meter',
        ursprung_utm32=[r2(c[0]), r2(c[1])], ursprung_wgs84=[round(lon, 7), round(lat, 7)],
        achse_a=[round(v, 6) for v in R['a']], achse_b=[round(v, 6) for v in R['b']],
        achsen='a längs des Platzes (Ecke A → D), b quer (Ecke A → B); Platzmeter = ((E−E0)·a, (N−N0)·b)',
        gitterazimut_a_grad=round(azimut(R['a']), 2), gitterazimut_b_grad=round(azimut(R['b']), 2),
        meridiankonvergenz_grad=round(konvergenz_grad(lon, lat), 3),
        kompassrichtung_b_grad=round(azimut(R['b']) + konvergenz_grad(lon, lat), 2),
        massstab_utm=round(massstab(c[0]), 6),
        massstab_hinweis='Gitterstrecke = Naturstrecke × massstab_utm (am Boni 0,37 mm je Meter kürzer)',
        ausschnitt_utm32=R['bbox'])

    dateien = {
        'gebaeude.geojson': sammlung('gebaeude', 'Gebäudegrundrisse (ALKIS), Höhe und Dachform aus OSM', 'ALKIS vereinfacht, GebaeudeBauwerk; Höhenangaben OpenStreetMap', f'{liz_alkis}; Felder hoehe_m, hoehe_quelle, osm*: {liz_osm}', gebaeude),
        'nutzung.geojson': sammlung('nutzung', 'Tatsächliche Nutzung (ALKIS): Straßen, Wege, Wohnflächen, Spielplatz', 'ALKIS vereinfacht, Nutzung', liz_alkis, nutzung),
        'platz.geojson': sammlung('platz', 'Bolzplatz: Zaun, Ecken, Platzrahmen', 'tools/ort/' + os.path.basename(cfg.get('_pfad', 'boni.json')), 'Verein; Luftbild ' + liz_alkis, platz),
        'osm_gebaeude.geojson': sammlung('osm_gebaeude', 'Gebäude und Gebäudeteile aus OSM (zum Abgleich, mit Geschossen und Dach)', 'OpenStreetMap', liz_osm, O['gebaeude']),
        'wege.geojson': sammlung('wege', 'Straßen, Fußwege, Treppen (Mittellinien)', 'OpenStreetMap', liz_osm, O['wege']),
        'flaechen.geojson': sammlung('flaechen', 'Flächen: Spielplatz, Bolzplatz, Gärten, Schulhöfe, Parkplätze', 'OpenStreetMap', liz_osm, O['flaechen']),
        'baeume.geojson': sammlung('baeume', 'Einzelbäume und Baumreihen', 'OpenStreetMap', liz_osm, O['baeume']),
        'einfriedungen.geojson': sammlung('einfriedungen', 'Zäune, Mauern, Hecken, Tore, Poller', 'OpenStreetMap', liz_osm, O['einfriedungen']),
        'ausstattung.geojson': sammlung('ausstattung', 'Punkte: Spielgeräte, Bänke, Laternen, Läden und mehr', 'OpenStreetMap', liz_osm, O['ausstattung']),
        'rahmen.json': json.dumps(rahmen_json, ensure_ascii=False, indent=1) + '\n',
    }
    pr = pruefung(cfg, R, geb, nutzung, O, seiten)
    dateien['pruefung.json'] = json.dumps(pr, ensure_ascii=False, indent=1) + '\n'
    zahl = dict({k: len(v) for k, v in O.items()}, gebaeude_osm=len(O['gebaeude']), gebaeude=len(gebaeude), nutzung=len(nutzung))
    dateien['README.md'] = bericht(cfg, R, abruf, zahl, pr, gebaeude, nutzung, O)
    return dateien


# ------------------------------------------------------------------ prüfen

def kanten_index(polygone, zelle=10.0):
    index = {}
    for poly in polygone:
        for ring in poly:
            for i in range(len(ring) - 1):
                a, b = ring[i], ring[i + 1]
                for gx in range(int(min(a[0], b[0]) // zelle), int(max(a[0], b[0]) // zelle) + 1):
                    for gy in range(int(min(a[1], b[1]) // zelle), int(max(a[1], b[1]) // zelle) + 1):
                        index.setdefault((gx, gy), []).append((a, b))
    return index, zelle

def naechste_kante(p, index, zelle):
    gx, gy = int(p[0] // zelle), int(p[1] // zelle)
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for a, b in index.get((gx + dx, gy + dy), ()):
                d = abstand_strecke(p, a, b)
                if best is None or d < best:
                    best = d
    return best

def lage_osm(geb, osm_gebaeude):
    index, zelle = kanten_index([p for _, polygone in geb for p in polygone])
    ecken = [p for oe, og in osm_gebaeude if 'building' in oe for poly in ringe_von(og) for p in poly[0][:-1]]
    def abstaende(dx, dy):
        return sorted(a for a in (naechste_kante((p[0] + dx, p[1] + dy), index, zelle) for p in ecken) if a is not None)
    d = abstaende(0, 0)
    probe = {(i, j): quantil(abstaende(i / 10, j / 10), 0.5) for i in range(-3, 4) for j in range(-3, 4)}
    bi, bj = min(sorted(probe), key=lambda k: probe[k])
    return dict(ecken=len(d), median_m=round(quantil(d, 0.5), 3), p90_m=round(quantil(d, 0.9), 3), max_m=round(max(d), 2),
                beste_verschiebung_m=[bi / 10, bj / 10], median_bei_bester_verschiebung_m=round(probe[(bi, bj)], 3),
                bestanden=quantil(d, 0.5) < 0.25 and math.hypot(bi, bj) <= 1.5)

def quantil(werte, q):
    w = sorted(werte)
    return w[min(len(w) - 1, int(q * len(w)))] if w else None

def pruefung(cfg, R, geb, nutzung, O, seiten):
    pr = {}
    # 1. Projektion: hin und zurück, und gegen die Umrechnung des LGLN-Dienstes (dieselben Gebäude in EPSG:4258)
    c = R['ursprung']
    rund = max(math.hypot(*(u - v for u, v in zip(p, to_utm32(*from_utm32(*p))))) for p in [c] + list(R['ecken'].values()))
    amt = {e['oid']: p for e, p in geb}
    abw = []
    for e, polygone in alkis(cfg, 'alkis_gebaeude_4258.gml', 'GebaeudeBauwerk', lonlat=True):
        soll = amt.get(e['oid'])
        if soll and len(soll) == len(polygone):
            for ps, pi in zip(soll, polygone):
                for rs, ri in zip(ps, pi):
                    if len(rs) == len(ri):
                        abw += [math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(rs, ri)]
    pr['projektion'] = dict(hin_und_zurueck_max_m=round(rund, 6), gegen_lgln_punkte=len(abw),
                            gegen_lgln_max_m=round(max(abw), 5), gegen_lgln_mittel_m=round(sum(abw) / len(abw), 5),
                            bestanden=rund < 0.001 and max(abw) < 0.01)
    # 2. Maßstab und Ausrichtung des Platzes
    E = R['ecken']
    winkel = {}
    for k, (v, n) in dict(A='DB', B='AC', C='BD', D='CA').items():
        u1 = (E[v][0] - E[k][0], E[v][1] - E[k][1]); u2 = (E[n][0] - E[k][0], E[n][1] - E[k][1])
        winkel[k] = round(math.degrees(math.acos((u1[0] * u2[0] + u1[1] * u2[1]) / (math.hypot(*u1) * math.hypot(*u2)))), 2)
    lon, lat = from_utm32(*c)
    kompass = (math.degrees(math.atan2(R['b'][0], R['b'][1])) + 360) % 360 + konvergenz_grad(lon, lat)
    doku = cfg['geodaten'].get('erwartet', {})
    pr['platz'] = dict(seiten_m={k: r2(v) for k, v in seiten.items()}, innenwinkel_grad=winkel,
                       flaeche_m2=r2(abs(flaeche([E[k] for k in 'ABCDA']))), kompassrichtung_b_grad=round(kompass, 2),
                       erwartet=doku,
                       bestanden=(abs(seiten['AB'] - doku.get('quer_m', seiten['AB'])) < 0.3 and abs(seiten['DA'] - doku.get('laengs_m', seiten['DA'])) < 0.3
                                  and abs(kompass - doku.get('blickrichtung_grad', kompass)) < 0.5 and all(abs(w - 90) < 1.5 for w in winkel.values())))
    # 3. Platz in der amtlichen Nutzungsfläche und gegen den Bolzplatz in OSM
    drin = [e for e, g in nutzung if all(any(im_polygon(E[k], p) for p in ringe_von(g)) for k in 'ABCD')]
    pr['platz_in_alkis'] = dict(flaechen=[dict(oid=e['oid'], nutzart=e['nutzart'], bezeichnung=e.get('bezeichnung')) for e in drin],
                                bestanden=len(drin) == 1)
    bolz = [(e, g) for e, g in O['flaechen'] if e.get('leisure') == 'pitch' and im_polygon(c, g['coordinates'])] if O['flaechen'] else []
    if bolz:
        e, g = bolz[0]
        ring = g['coordinates'][0]
        kanten = sorted(((math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]), ring[i], ring[i + 1]) for i in range(len(ring) - 1)), reverse=True)
        l, p, q = kanten[0]
        az = (math.degrees(math.atan2(q[0] - p[0], q[1] - p[1])) + 360) % 180
        az_a = (math.degrees(math.atan2(R['a'][0], R['a'][1])) + 360) % 180
        m = schwerpunkt(ring)
        pr['platz_gegen_osm'] = dict(osm=e['osm'], osm_seiten_m=[r2(k[0]) for k in kanten], osm_flaeche_m2=r2(abs(flaeche(ring))),
                                     mittelpunkt_abstand_m=r2(math.hypot(m[0] - c[0], m[1] - c[1])),
                                     richtung_abweichung_grad=round(min(abs(az - az_a), 180 - abs(az - az_a)), 2),
                                     hinweis='OSM zeichnet nur die Asphaltfläche des Bolzplatzes; der Zaun des Vereins umfasst mehr')
    # 4. Lage von OSM gegen ALKIS: Abstand der OSM-Gebäudeecken zur nächsten amtlichen Kante; dazu die Probe,
    #    ob eine starre Verschiebung (Raster 0,1 m bis ±0,3 m) die Ecken näher an die Kanten brächte
    pr['osm_gegen_alkis'] = lage_osm(geb, O['gebaeude'])
    pr['bestanden'] = all(v.get('bestanden', True) for v in pr.values() if isinstance(v, dict))
    return pr


# ------------------------------------------------------------------ Bericht

def bericht(cfg, R, abruf, zahl, pr, gebaeude, nutzung, O):
    from collections import Counter
    c, box = R['ursprung'], R['bbox']
    mit_hoehe = sum('hoehe_m' in e for e, _ in gebaeude)
    gemessen = sum(e.get('hoehe_quelle') == 'OSM height' for e, _ in gebaeude)
    nutz = Counter(e['nutzart'] + (' / ' + e['bezeichnung'] if e.get('bezeichnung') else '') for e, _ in nutzung)
    wege = Counter(e.get('highway') for e, _ in O['wege'])
    zaun = Counter(e.get('barrier') for e, _ in O['einfriedungen'])
    spiel = sorted({e['playground'] for e, _ in O['ausstattung'] if 'playground' in e})
    nah = lambda g: math.hypot(g['coordinates'][0] - c[0], g['coordinates'][1] - c[1]) if g['type'] == 'Point' else 1e9
    baeume_nah = sum(nah(g) < 60 for _, g in O['baeume'])
    bm = Counter(k for e, g in O['baeume'] if g['type'] == 'Point' for k in e if k not in ('natural', 'osm'))
    baum_merkmale = (' mit ' + ', '.join(f'{k} ({v})' for k, v in bm.most_common(4))) if bm else ' ohne weitere Angaben'
    zaun_nah = sum(any(math.hypot(x - c[0], y - c[1]) < 30 for x, y in g['coordinates']) for _, g in O['einfriedungen'] if g['type'] == 'LineString')
    P, G = pr['projektion'], pr['osm_gegen_alkis']
    pl, po = pr['platz'], pr.get('platz_gegen_osm')
    ok = lambda b: 'bestanden' if b else '**nicht bestanden**'
    q = '\n'.join(f"| `{x['datei']}` | {x['stand']} | {x['lizenz']} | {x['bytes'] // 1024} KB |" for x in abruf['quellen'])
    return f"""# Geodaten {cfg['name']}

Erzeugt von `tools/ort/geodaten.py bauen` aus den Rohdaten in `roh/` (abgerufen am {abruf['abgerufen']}). Nicht von Hand ändern.
Ansicht: `python3 serve.py`, dann http://localhost:8000/tools/ort/ansicht.html

## Koordinaten

- **System:** ETRS89 / UTM Zone 32N (EPSG:25832), Meter. Das ist das amtliche System in Niedersachsen; ALKIS kommt darin an, OSM wird aus WGS84 umgerechnet (`tools/ort/utm.py`). WGS84 und ETRS89 liegen rechnerisch einige Dezimeter auseinander; gemessen an den Gebäuden passt OSM hier aber ohne Verschiebung am besten auf die amtlichen Grundrisse (siehe Prüfung), deshalb wird nichts verschoben.
- **Ausschnitt:** Ost {box[0]}–{box[2]}, Nord {box[1]}–{box[3]} ({box[2] - box[0]} × {box[3] - box[1]} m um den Bolzplatz). Was den Ausschnitt berührt, bleibt ganz erhalten; nichts wird abgeschnitten.
- **Platzrahmen** (`rahmen.json`): Ursprung in der Platzmitte ({r2(c[0])} / {r2(c[1])}), Achse a längs (Ecke A → D), Achse b quer (A → B). So rechnen auch `shadow_casters.py` und das Intro.
- **Maßstab:** Gitterstrecken sind um den Faktor {massstab(c[0]):.6f} kürzer als in der Natur (0,37 mm je Meter, 15 cm auf 400 m). Für das Spiel unerheblich, hier nur festgehalten.

## Ebenen

| Datei | Inhalt | Anzahl | Quelle |
|---|---|---|---|
| `gebaeude.geojson` | Gebäudegrundrisse mit Funktion, Adresse, Fläche; Höhe und Dach aus OSM angehängt | {zahl['gebaeude']} | ALKIS (amtlich) |
| `nutzung.geojson` | Straßen- und Wegeflächen, Wohnflächen, Spielplatzfläche | {zahl['nutzung']} | ALKIS (amtlich) |
| `platz.geojson` | Zaun des Bolzplatzes, Ecken A–D, Achsen | 1 Platz | Verein, Luftbild |
| `wege.geojson` | Mittellinien von Straßen, Fußwegen, Treppen | {zahl['wege']} | OSM |
| `flaechen.geojson` | Spielplatz, Bolzplatz, Gärten, Schulhöfe, Parkplätze | {zahl['flaechen']} | OSM |
| `baeume.geojson` | Einzelbäume und Baumreihen | {zahl['baeume']} | OSM |
| `einfriedungen.geojson` | Zäune, Mauern, Hecken, Tore, Poller | {zahl['einfriedungen']} | OSM |
| `ausstattung.geojson` | Spielgeräte, Bänke, Laternen, Läden | {zahl['ausstattung']} | OSM |
| `osm_gebaeude.geojson` | OSM-Gebäude und Gebäudeteile, nur zum Abgleich | {zahl['gebaeude_osm']} | OSM |
| `daecher.json` | Gemessene Dachform, Trauf- und Firsthöhe über Gelände, Dachneigung, Firstrichtung je Gebäude (für die Häuser der Weltansicht) | je Gebäude mit LoD2-Eintrag | LoD2 (amtlich), eigener Schritt: `tools/ort/lod2.py` |

Amtliche Nutzung: {', '.join(f'{k} ({v})' for k, v in sorted(nutz.items()))}.
Wege aus OSM: {', '.join(f'{k} ({v})' for k, v in sorted(wege.items(), key=lambda kv: str(kv[0])))}.

## Quellen und Lizenzen

| Rohdatei | Stand der Quelle | Lizenz | Größe |
|---|---|---|---|
{q}

- **ALKIS:** offener WFS »ALKIS vereinfacht« des LGLN, `{ALKIS_WFS}`.
- **LoD2:** 3D-Gebäudemodell des LGLN, 1-km-Kacheln `https://lod2.opengeodata.lgln.niedersachsen.de/LoD2_32_<E>_<N>_1_ni.gml`, © GeoBasis-DE / LGLN, Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0). `tools/ort/lod2.py` liest daraus `daecher.json`; Quelle und Stand stehen in der Datei.
- **OSM:** Overpass-Abfrage, Wortlaut in `roh/abruf.json`. Die ODbL verlangt Namensnennung und Weitergabe unter gleichen Bedingungen für die aus OSM abgeleiteten Ebenen; ALKIS-Ebenen und OSM-Ebenen liegen deshalb in getrennten Dateien. In `gebaeude.geojson` stammen nur die Felder `hoehe_m`, `hoehe_quelle` und `osm*` aus OSM.

## Prüfung ({'alles bestanden' if pr['bestanden'] else 'NICHT alles bestanden'})

| Prüfung | Ergebnis | |
|---|---|---|
| Umrechnung UTM → Länge/Breite → UTM (nur für den Abruf-Ausschnitt gebraucht) | größter Fehler {P['hin_und_zurueck_max_m'] * 1000:.3f} mm | {ok(P['bestanden'])} |
| Umrechnung gegen den LGLN-Dienst (dieselben Gebäude in EPSG:4258 und EPSG:25832) | {P['gegen_lgln_punkte']} Punkte, größte Abweichung {P['gegen_lgln_max_m'] * 1000:.2f} mm | {ok(P['bestanden'])} |
| Platzseiten | AB {pl['seiten_m']['AB']} m, BC {pl['seiten_m']['BC']} m, CD {pl['seiten_m']['CD']} m, DA {pl['seiten_m']['DA']} m; erwartet {pl['erwartet'].get('quer_m')} × {pl['erwartet'].get('laengs_m')} m | {ok(pl['bestanden'])} |
| Platzwinkel und Richtung | Innenwinkel {', '.join(f'{k} {v}°' for k, v in pl['innenwinkel_grad'].items())}; Achse b (Blickrichtung des Spiels) {pl['kompassrichtung_b_grad']}° gegen Nord, im Spiel {pl['erwartet'].get('blickrichtung_grad')}° | {ok(pl['bestanden'])} |
| Platz liegt in genau einer amtlichen Fläche | {', '.join(str(f['nutzart']) + ' / ' + str(f['bezeichnung']) for f in pr['platz_in_alkis']['flaechen']) or 'keine'} | {ok(pr['platz_in_alkis']['bestanden'])} |
| Lage von OSM gegen ALKIS | {G['ecken']} OSM-Gebäudeecken: Median {G['median_m']} m neben der amtlichen Kante, 90 % unter {G['p90_m']} m. Probe mit starrer Verschiebung (0,1-m-Raster bis ±0,3 m): bester Wert bei {G['beste_verschiebung_m'][0]} / {G['beste_verschiebung_m'][1]} m mit Median {G['median_bei_bester_verschiebung_m']} m, also kein lohnender Versatz | {ok(G['bestanden'])} |
""" + (f"""| Bolzplatz in OSM (`{po['osm']}`) | Seiten {', '.join(str(s) for s in po['osm_seiten_m'])} m, Mittelpunkt {po['mittelpunkt_abstand_m']} m neben der Platzmitte, Richtung {po['richtung_abweichung_grad']}° neben Achse a | nur Vergleich |
""" if po else '') + f"""
## Was fehlt oder unsicher ist

- **Zaunecken des Bolzplatzes:** aus dem Luftbild abgelesen und vom Verein bestätigt, etwa ±1 m. Die Innenwinkel weichen bis {max(abs(v - 90) for v in pl['innenwinkel_grad'].values()):.1f}° vom rechten Winkel ab. Nicht vermessen.
- **Bolzplatz in OSM kleiner als der Zaun:** OSM zeichnet {f"{po['osm_seiten_m'][0]} × {po['osm_seiten_m'][2]} m" if po else 'ihn nicht'}, der Verein {pl['seiten_m']['DA']} × {pl['seiten_m']['AB']} m. Maßgeblich bleiben die Ecken des Vereins; welche Linie OSM meint (Asphaltkante, Spielfeld), ist offen.
- **Bäume:** OSM kennt im Ausschnitt {zahl['baeume']} Bäume und Baumreihen, davon {baeume_nah} Einzelbäume im Umkreis von 60 m um die Platzmitte. Es sind Punkte{baum_merkmale}; Art, Stamm- und Kronenmaß fehlen, und ob jeder Baum des Platzes erfasst ist, ist nicht geprüft. Kronenhöhen gibt es nur als Raster aus dem amtlichen Oberflächenmodell (`assets/intro/boni_schatten_hoehen.png`, ±46 m um den Platz). Ein Baumkataster der Stadt habe ich nicht geprüft.
- **Zäune und Mauern:** OSM hat {sum(zaun.values())} Einträge ({', '.join(f'{k} {v}' for k, v in sorted(zaun.items(), key=lambda kv: str(kv[0])))}), davon {zaun_nah} Linien näher als 30 m am Platz. Der Zaun des Bolzplatzes selbst und die Klinker-Einfassung des Sandspielplatzes sind nicht kartiert.
- **Spielgeräte:** als Punkte ohne Form und Größe ({', '.join(spiel) or 'keine'}). Nilpferd, Edelstahl-Schale und Spielhaus sind nicht einzeln erkennbar benannt.
- **Gebäudehöhen:** {mit_hoehe} von {zahl['gebaeude']} amtlichen Grundrissen haben eine Höhe, davon {gemessen} als in OSM eingetragene Höhe; der Rest ist aus Geschosszahlen geschätzt (3,2 m je Geschoss, 2,8 m je Dachgeschoss, grob ±2 m). Die Häuser der Weltansicht nehmen, wo vorhanden, die gemessenen Werte des amtlichen 3D-Gebäudemodells (LoD2, `daecher.json`) statt dieser Schätzung; das Höhenmodell als Zahlen ist noch nicht eingebunden.
- **Gelände:** nicht enthalten und hier nicht ausgewertet. Geländehöhen gibt es bisher nur als Farbskala aus dem LGLN-Kartendienst (`tools/ort/abrufen.py`), nicht als Zahlen.
- **Höfe und Durchfahrten:** ALKIS führt Durchfahrten und Arkaden als eigene Bauteile (`art` = Bauteil). Innenhöfe ergeben sich als Lücken zwischen den Grundrissen, nicht als eigene Flächen.
- **Aktualität:** ALKIS-Objekte tragen ihr Fortführungsdatum im Feld `stand`. Der OSM-Stand hängt vom antwortenden Spiegelserver ab und steht oben in der Quellentabelle.
- **Parkplätze, Bordsteine, Straßenmarkierungen:** nur als Flächen (ALKIS Straßenverkehr) und Mittellinien (OSM), nicht im Detail.
"""


# ------------------------------------------------------------------ Aufruf

def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ('abrufen', 'bauen', 'pruefen'):
        raise SystemExit(__doc__)
    cfg = lade_ort(sys.argv[2])
    cfg['_pfad'] = sys.argv[2]
    if sys.argv[1] == 'abrufen':
        return abrufen(cfg)
    dateien = baue(cfg)
    pr = json.loads(dateien['pruefung.json'])
    if sys.argv[1] == 'bauen':
        for name, text in dateien.items():
            open(os.path.join(cfg['_ziel'], name), 'w', encoding='utf-8').write(text)
            print(f'{name}: {len(text.encode()) / 1024:.0f} KB')
    else:
        anders = [n for n, text in dateien.items()
                  if not os.path.exists(os.path.join(cfg['_ziel'], n)) or open(os.path.join(cfg['_ziel'], n), encoding='utf-8').read() != text]
        if anders:
            raise SystemExit('Die eingecheckten Dateien weichen vom Neubau ab: ' + ', '.join(anders))
        print('Neubau aus den Rohdaten ist bitgleich mit den eingecheckten Dateien.')
    for k, v in pr.items():
        if isinstance(v, dict) and 'bestanden' in v:
            print(('ok    ' if v['bestanden'] else 'FEHLER') + ' ' + k)
    if not pr['bestanden']:
        raise SystemExit('Prüfung nicht bestanden, siehe pruefung.json')

if __name__ == '__main__':
    main()
