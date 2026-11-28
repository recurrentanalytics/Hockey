// Ortsbeschreibung des Bonifatiusplatzes (Roadmap 0.6, docs/WORLD_ARCHITECTURE.md): die Zahlen und Verweise des Ortes
// an einer Stelle. Nur Daten, kein Code. Pfade sind relativ zu diesem Ordner. Gelesen von src/config.js (Spielfeld, Tor),
// src/welt/* (Blick, Zaun) und, über tests/ort.test.mjs abgeglichen, von tools/ort/boni.json (Ecken).
// Der Rumpf nach `export default` ist reines JSON: Python-Werkzeuge lesen ihn mit tools/ort/ort.py.
export default {
  "id": "boni",
  "name": "Bonifatiusplatz",
  "kurz": "Boni",
  "stadt": "Hannover-List",
  "geo": {
    "ecken_wgs84": {
      "A": [
        9.744614,
        52.389138
      ],
      "B": [
        9.744847,
        52.389062
      ],
      "C": [
        9.744671,
        52.388862
      ],
      "D": [
        9.744438,
        52.388939
      ]
    },
    "rahmen": "geo/rahmen.json"
  },
  "blick": {
    "richtung": 118.2,
    "neigung": 60
  },
  "zaun": {
    "laenge": 25.2,
    "breite": 18.0
  },
  "spielflaeche": {
    "inline": {
      "laenge": 22.8,
      "breite": 17.2,
      "eckradius": 1.0,
      "torlinie": 9.2,
      "bandenhoehe": 1.0,
      "mittelkreis": 3,
      "bullykreis": {
        "x": 6.2,
        "y": 4.2,
        "r": 2
      },
      "torraum": 1.2,
      "tor": {
        "breite": 1.37,
        "hoehe": 1.12,
        "tiefe": 0.6
      },
      "spieler": 3
    }
  },
  "daten": {
    "geodaten": "geo/",
    "daecher": "geo/daecher.json",
    "bausaetze": "../../assets/welt/haeuser/bausaetze.json",
    "boden": "../../assets/welt/boden/boden.json",
    "massstab": "../../assets/welt/massstab.json",
    "platzmodell": "../../assets/intro/boni_platz.glb",
    "kronenkarte": "../../assets/intro/boni_schatten_hoehen.png",
    "luftbild": "../../assets/welt/boni_umgebung.jpg",
    "werkzeuge": "../../tools/ort/boni.json"
  },
  "quellen": [
    "© GeoBasis-DE / LGLN, CC BY 4.0 (Luftbild, ALKIS)",
    "© GeoBasis-DE / LGLN, dl-de/by-2-0 (LoD2-Dächer)",
    "© OpenStreetMap-Mitwirkende, ODbL",
    "Google Photorealistic 3D Tiles"
  ]
};
