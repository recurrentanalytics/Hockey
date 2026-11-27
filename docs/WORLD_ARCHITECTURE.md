# BORSTENBOOM! – Welt- und Ortsarchitektur (Konzept)

Stand: 27. November 2026. **Konzept, noch nicht umgesetzt.** Der Boni läuft unverändert weiter.

Ziel: Ein neuer Ort soll über Daten, eine kleine Konfiguration und vorhandene Bausteine entstehen, nicht durch eine neue Version von `photoreal.js`. Dabei wird nur so viel verallgemeinert, wie der zweite Ort tatsächlich braucht.

---

## 1. Ausgangslage

Der Boni ist heute über acht Stellen verteilt (siehe [PROJECT_AUDIT.md](PROJECT_AUDIT.md) 5.1). Die Spiellogik selbst ist schon ortsneutral: Sie kennt nur `RINK`, `GOAL`, `SKATE`, `SHOT` und die Projektion `project()`. Der Ort steckt im 3D-Teil (`src/intro/`), in den Werkzeugen und im Import-Zeitpunkt von `config.js`.

Was bereits wiederverwendbar ist:

| Baustein | Wiederverwendbar? | Was für einen neuen Ort fehlt |
|---|---|---|
| `project()` und `BONI_3D.toCss` | ja | nichts |
| Platzrahmen `buildFrame()` aus vier Ecken | ja | Ecken als Daten statt Konstante |
| `court_glb.py` | teilweise | Maße, Zaun- und Torlage sind im Skript fest |
| `shadow_casters.py` | teilweise | Rasterausschnitt und Eckpunkte als Pixel fest; braucht Abrufskript |
| `TREE_LIGHT`, `treeUniforms()` | ja, wenn die Kartenmaße als Uniform kommen | Maße `46`, `41.4`, `185`, `167` als Uniform |
| `environment.js` (Sonne, Wetter, Jahreszeit) | ja, bis auf `LAT`/`LON` | Ortskoordinaten übergeben |
| `surface.js` | ja | Materialtyp als Eingabe (siehe [ENVIRONMENT_SYSTEM.md](ENVIRONMENT_SYSTEM.md)) |
| Intro-Zeitleiste | teilweise | Stationen und Erzähltext als Daten |

---

## 2. Das Ortsmodell

Ein Ort ist **ein Ordner** mit einer Beschreibung und den abgeleiteten Assets:

```
locations/
  boni/
    ort.js                    Beschreibung (siehe unten), ein ES-Modul ohne Build
    platz.glb                 Zaun, Tore, Ausstattung       (heute assets/intro/boni_platz.glb)
    boden.glb                 Spielfläche und Umrandung      (heute boni_boden.glb)
    kronen.png                Kronen- und Dachhöhen         (heute boni_schatten_hoehen.png)
    luftboden.glb             Boden unter den Kronen        (heute boni_schatten_luftboden.glb)
    quellen.md                Datenquellen, Lizenzen, Abrufdatum
```

`ort.js` (Beispiel für den Boni, Werte aus dem heutigen Code):

```js
export default {
  id: 'boni',
  name: 'Bonifatiusplatz',
  kurz: 'Boni',
  stadt: 'Hannover-List',
  geo: {
    // Zaunecken A, B, C, D (WGS84), Bodenhöhe als Startwert, wird am Mesh nachgemessen
    ecken: [[9.744614, 52.389138], [9.744847, 52.389062], [9.744671, 52.388862], [9.744438, 52.388939]],
    boden: 97.944,
    blick: { richtung: 118.2, neigung: 60 },          // Spielkamera
    anflug: ['planet', 'deutschland', 'hannover'],     // Stationen der Kamerafahrt (Nadeln, Erzählung)
  },
  zaun: { laenge: 25.2, breite: 18.0, hoehe: 4.0 },
  spielflaechen: {
    inline: { laenge: 22.8, breite: 17.2, eckradius: 1.0, torlinie: 9.2, tor: { breite: 1.37, hoehe: 1.12, tiefe: 0.6 }, spieler: 3 },
  },
  untergrund: { material: 'asphalt', rauheit: 'mittel' },
  physik: {},                                          // optionale Abweichungen vom Materialprofil, meist leer
  umgebung: {
    kronen: { bild: 'kronen.png', ausdehnung: { a: [-46, 46], b: [-41.4, 41.4] }, raster: 0.5, hoehenStufe: 0.2 },
    vegetation: 'laubbaeume',                          // für die Jahreszeit
    laternen: [[-6.5, -8.6], [6.5, -8.6]],             // Platzmeter; Beispielwerte, nicht vermessen
    geraeusche: 'stadtpark',
  },
  quellen: ['© GeoBasis-DE / LGLN, CC BY 4.0', 'Google Photorealistic 3D Tiles'],
};
```

Grundsätze:

- **Bewusst schlicht.** Eine nachvollziehbare Datei je Ort genügt. Kein Ladesystem, keine Welt-Engine, solange es nur einen Ort gibt.
- **Ein Ort beschreibt, ein Modul rechnet.** In `ort.js` stehen nur Zahlen und Verweise. Kein Code.
- **Spielflächen gehören zum Ort, Regeln zur Sportart.** Der Boni hat eine Inline-Fläche. Ein Eisstadion hätte eine Eis-Fläche mit anderen Maßen. Die Regeln (World Skate, ISHD …) bleiben in `src/game/rules.js`.
- **Eine Quelle der Wahrheit.** `config.js`, `flat.js`, `photoreal.js`, die Shader und die Werkzeuge lesen dieselbe Beschreibung. Die Python-Werkzeuge lesen sie als JSON (ein kleines Exportskript oder eine parallele `ort.json`).

---

## 3. Trennung der Eigenschaften

| Eigenschaft | Heute | Künftig |
|---|---|---|
| Geografische Lage | `COURT` in `photoreal.js` | `ort.geo` |
| Geometrie und Höhen | Google-Kacheln, gemessene Bodenhöhe | unverändert, Startwert aus `ort.geo.boden` |
| Gebäude und Vegetation | Kronenkarte (Dachmarke im Grünkanal) | `ort.umgebung.kronen`, Vegetationsart für Jahreszeiten |
| Spielfeldgeometrie | `BONI_RINK`, `GOAL` in `config.js` | `ort.spielflaechen[sportart]` |
| Oberflächen und Materialien | Asphalt implizit in `surface.js` | `ort.untergrund.material` → Materialprofil |
| Lokale Umwelt | `LAT`/`LON` in `environment.js` | aus `ort.geo` abgeleitet |
| Beleuchtung und Schatten | `TREE_LIGHT` mit festen Maßen, Laternen im Shader | Uniforms aus `ort.umgebung` |
| Wetter und Jahreszeit | ortsunabhängig bis auf Koordinaten | unverändert; Klimazone später als Option |
| Physik | `SURF` aus Wetter | Material × Zustand × Profil (siehe ENVIRONMENT_SYSTEM) |
| Sportartspezifische Fläche | nur Inline | `spielflaechen.inline`, später `spielflaechen.eis` |

---

## 4. Ortswechsel zur Laufzeit

Heute wird der Ort beim Import festgelegt (`config.js`, `projection.js`, `ai.js`, `scenes/rink.js`). Für eine Reise zwischen Orten gibt es zwei Wege:

| Weg | Aufwand | Bewertung |
|---|---|---|
| **A. Neu laden je Ort.** `intro.html?ort=boni` setzt `BONI_3D` (künftig `ORT`) und lädt das Spiel. Ein Ortswechsel ist ein Seitenwechsel mit kurzer Überblendung. | klein | **Empfohlen für Phase 3 und 4.** Kein Umbau des Spielkerns nötig. Cesium-Bibliothek kommt aus dem Cache. |
| **B. Ort als Laufzeitobjekt.** `RINK`, `GOAL`, `SKATE` werden zu Eigenschaften eines `Spielfeld`-Objekts, das `Match` übergeben bekommt. | mittel bis groß | Erst nötig, wenn innerhalb einer Sitzung ohne Neuladen gewechselt werden soll, etwa auf der Weltkarte mit Kameraflug. |

Empfehlung: **A jetzt, B vorbereiten.** Neue Module sollten Maße als Parameter bekommen statt sie zu importieren. `Match` bekommt heute schon eine Optionsliste. Dort können `rink` und `goal` später ergänzt werden, ohne dass Altcode bricht.

---

## 5. Zielbild der 3D-Welt-Module

Heute erledigt `photoreal.js` alles. Vorgeschlagene Aufteilung, schrittweise und ohne Verhaltensänderung:

```
src/welt/
  cesium.js         Cesium laden, Viewer, Google-Kacheln, Auflösungsprofile (FLIGHT)
  rahmen.js         buildFrame, courtMatrix, Bodenhöhe nachmessen, ecToCourt, toCss
  ort.js            Ortsbeschreibung laden, Modelle platzieren
  shader/
    durchsicht.js   seeThrough (Dither über dem Platz)
    jahreszeit.js   SEASON, groundSeason
    licht.js        TREE_LIGHT, treeUniforms, Pfosten-Schatten
  spielbruecke.js   BONI_3D/ORT-Objekt, Torkamera, Figurenschatten (lit)
src/intro/
  zeitleiste.js     Stationen, Kamera-Spline, Einblendungen (heute place, ZOOM, T)
  erzaehlung.js     STORY, Stimme, Untertitel
  main.js           Start, Token
src/umwelt/
  modell.js         sunPosition, season, visuals, fetchWeather (reine Funktionen)
  darstellung.js    Post-Processing, Boden-Shader, Regen-Overlay
  menue.js          weatherPanel
```

Reihenfolge: zuerst reine Funktionen herauslösen (Umweltmodell, Rahmen), dann Shader, zuletzt die Zeitleiste. Jeder Schritt wird mit denselben Standbildern verglichen (siehe TECHNICAL_DEBT T2).

---

## 6. Einen neuen Ort hinzufügen (Zielablauf)

1. **Grundriss:** Zaun im amtlichen Luftbild nachzeichnen → vier Ecken. Ein Hilfsskript zeigt Ecken über dem Luftbild zur Kontrolle (heute von Hand gemacht, siehe `docs/BONI_ORT.md`).
2. **Daten holen:** Abrufskript lädt DOP, DOM1, DGM1 und ALKIS-Gebäude für die Ecken (heute nicht im Repo, siehe TECHNICAL_DEBT T3).
3. **Assets bauen:** `court_glb.py` und `shadow_casters.py` lesen `ort.json` und schreiben in `locations/<id>/`.
4. **Beschreibung:** `ort.js` ausfüllen (Spielfläche, Material, Blick, Laternen).
5. **Prüfen:** Standbild-Skript für den Ort (Sommer, Winter, Nacht) und eine Spielrunde auf dem Testplatz mit den Ortsmaßen.

Außerhalb Niedersachsens gibt es andere Landesvermessungen mit eigenen Diensten und Lizenzen. Die Abrufskripte brauchen dann je Bundesland einen Adapter. Für Orte ohne offene Höhendaten bleibt nur die Google-Kulisse ohne berechnete Baumschatten. `TREE_LIGHT` wird dann einfach abgeschaltet.

---

## 7. Weltkarte und Reise

Die Erdkugel des Intros ist bereits die richtige Grundlage für die Weltkarte („Die Reise der roten Kugel“, [ROADMAP.md](ROADMAP.md)):

- Die Kamerafahrt `place(t)` kann mit beliebigen Start- und Zielorten parametrisiert werden. Die Zeitleiste wird dafür eine Liste von Stationen statt fester Konstanten.
- Kartennadeln sind schon vorhanden (`pin()`).
- Ein Ortswechsel ist zunächst ein Neuladen mit `?ort=…` (Weg A). Der Flug zwischen zwei Orten kann im alten Ort beginnen und im neuen nach dem Laden mit der Landung weitergehen.
- Freischaltung und Fortschritt liegen im Spielstand (siehe [GAME_DESIGN.md](GAME_DESIGN.md)).

---

## 8. Was ausdrücklich nicht verallgemeinert werden sollte

- **Die Halle (`index.html`)** bleibt eine eigene, ortsfreie Spielvariante und Offline-Rückfall. Sie muss kein „Ort“ werden.
- **Die alte Pixel-Variante des Boni** in `world/rink.js` (`venue: 'boni'`) sollte nicht zum Ortsmodell ausgebaut werden. Sie ist durch den echten Platz und den Testplatz ersetzt.
- **Klimazonen, Zeitzonen, andere Kontinente** erst, wenn ein Ort dort geplant ist. `sunPosition()` und Open-Meteo können das bereits.
