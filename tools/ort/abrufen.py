"""Holt die amtlichen Geodaten eines Ortes vom LGLN (offene WMS-Dienste, © GeoBasis-DE / LGLN,
CC BY 4.0) und bereitet sie für die Werkzeuge auf. Ersetzt die früheren Handschritte.

Ergebnis im Ausgabeordner (nicht einchecken, siehe .gitignore):
  dom.png, dgm.png      Oberflächen- und Geländemodell als Farbskala (Rohdaten)
  alkis.png             Liegenschaftskarte in Farbe (Rohdaten)
  luftbild.jpg          Digitales Orthophoto DOP20
  hoehe.png             Höhe über Grund: 0,15 m je Graustufe (für shadow_casters.py)
  gebaeude.png          Gebäudemaske, 0/64/128/191/255 (für shadow_casters.py)
  clean_asphalt_diff_2k.jpg  Asphaltfoto (Poly Haven, CC0; für court_glb.py)

Aufruf:  python3 tools/ort/abrufen.py tools/ort/boni.json daten/boni
Danach:  python3 tools/intro/shadow_casters.py daten/boni/hoehe.png daten/boni/gebaeude.png \\
             assets/intro/boni_schatten.glb daten/boni/luftbild.jpg
Benötigt: Python 3, numpy, Pillow, opencv-python (cv2)."""
import io, json, os, sys, urllib.request
import numpy as np, cv2
from PIL import Image

WMS = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/{dienst}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' \
      '&LAYERS={layer}&STYLES=&CRS=EPSG:25832&BBOX={bbox}&WIDTH={px}&HEIGHT={px}&FORMAT={fmt}'

def bbox(cfg):
    """Ausschnitt des Referenzrasters in UTM 32 (West, Süd, Ost, Nord)."""
    r = cfg['referenzraster']; (e0, n0), s, a = r['ursprung_utm32'], r['pixel_m'], r['ausschnitt']
    return e0 + a['x0'] * s, n0 - (a['y0'] + a['h']) * s, e0 + (a['x0'] + a['w']) * s, n0 - a['y0'] * s

def holen(url, ziel):
    if os.path.exists(ziel):
        print('vorhanden', ziel); return
    print('lade', os.path.basename(ziel))
    req = urllib.request.Request(url, headers={'User-Agent': 'borstenboom-tools'})
    data = urllib.request.urlopen(req, timeout=180).read()
    if data[:5] in (b'<?xml', b'<Serv'):
        raise SystemExit(f'Dienst meldet einen Fehler für {ziel}:\n{data[:400].decode(errors="replace")}')
    open(ziel, 'wb').write(data)

def wms(cfg, aus, name, dienst, layer, px, fmt='image/png'):
    b = ','.join(f'{v:.2f}' for v in bbox(cfg))
    holen(WMS.format(dienst=dienst, layer=layer, bbox=b, px=px, fmt=fmt), os.path.join(aus, name))

# --- Höhe über Grund aus den Farbskalen von DOM1 und DGM1 -------------------------------------
# Kalibrierung (damals am Boni bestimmt): Grauwert 82,5 = Boden, Firste der 4- bis 5-geschossigen
# Gründerzeitblöcke (Grauwert ~100) = etwa 21 m → 1,2 m je Graustufe; R+B der Farbskala fällt um
# 4,39 je Graustufe.
M_PRO_SUMME = 1.2 / 4.39

def rampe(pfad):
    a = np.asarray(Image.open(pfad).convert('RGB')).astype(np.float32)
    return a[..., 0] + a[..., 2]

def hoehe(aus):
    dom, dgm = rampe(os.path.join(aus, 'dom.png')), rampe(os.path.join(aus, 'dgm.png'))
    dgm = cv2.GaussianBlur(dgm, (0, 0), 6)                    # Gelände ist glatt; entfernt Stufen der Skala
    h = np.clip((dgm - dom) * M_PRO_SUMME, 0, 38)
    h[h < 0.8] = 0                                            # Bodenrauschen (Bordsteine, Autos) weg
    h = cv2.medianBlur(h.astype(np.float32), 3)
    Image.fromarray(np.round(h / 0.15).astype(np.uint8)).save(os.path.join(aus, 'hoehe.png'), optimize=True)
    print(f'hoehe.png: höchster Punkt {h.max():.1f} m')

# --- Gebäude aus der Liegenschaftskarte -------------------------------------------------------
# Wohngebäude sind grau (178,178,178), öffentliche Gebäude rot (244,132,127) gefüllt. Öffnen entfernt
# dünne graue Linien, Schließen füllt Umrisse; dann 2 × 2 gemittelt (Werte 0, 64, 128, 191, 255).
# Gegen die damals von Hand erzeugte Maske: IoU 0,96.
def gebaeude(aus):
    a = np.asarray(Image.open(os.path.join(aus, 'alkis.png')).convert('RGB')).astype(int)
    farbe = lambda c: np.abs(a - np.array(c)).max(-1) <= 6
    m = (farbe((178, 178, 178)) | farbe((244, 132, 127))).astype(np.uint8)
    k = np.ones((3, 3), np.uint8)
    m = cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    n = m.shape[0] // 2
    klein = m[:2 * n, :2 * n].reshape(n, 2, n, 2).mean((1, 3)) * 255
    Image.fromarray(np.round(klein).astype(np.uint8)).save(os.path.join(aus, 'gebaeude.png'), optimize=True)
    print(f'gebaeude.png: {(klein > 128).mean() * 100:.1f} % Gebäudefläche')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    cfg = json.load(open(sys.argv[1], encoding='utf-8'))
    aus = sys.argv[2]; os.makedirs(aus, exist_ok=True)
    r = cfg['raster']
    wms(cfg, aus, 'dom.png', 'dom_wms', 'ni_dom1_farbe', r['hoehe_px'])
    wms(cfg, aus, 'dgm.png', 'dgm_wms', 'ni_dgm1_farbe', r['hoehe_px'])
    wms(cfg, aus, 'alkis.png', 'alkis_wms', 'ALKIS', r['alkis_px'])
    wms(cfg, aus, 'luftbild.jpg', 'dop_wms', 'ni_dop20', r['luftbild_px'], 'image/jpeg')
    if cfg.get('asphalt'):
        holen(cfg['asphalt'], os.path.join(aus, os.path.basename(cfg['asphalt'])))
    hoehe(aus)
    gebaeude(aus)
    print('fertig:', aus)
