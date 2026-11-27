# BORSTENBOOM! – Umwelt- und Untergrundsystem (Konzept)

Stand: 27. November 2026. Beschreibt das heutige System und ein Zielmodell. **Das Zielmodell ist noch nicht umgesetzt.** Die bestehende Boni-Implementierung bleibt die Referenz und muss bei jedem Umbau gleich spielen.

---

## 1. Heute

```
Wetterquelle (live / damals / gewählt)                       src/intro/environment.js
   │  look (sun, partly, clouds, rain, snow, fog), Datum, Temperatur, Wind, Niederschlag
   ▼
visuals(look, date)  ──► Optik: Sonne, Licht, Farbstimmung, nass/Schnee, Jahreszeit, Laubdichte
   │
   ├──► Darstellung: Post-Processing, Boden-Shader, Baumschatten (TREE_LIGHT), Regen-Overlay
   │
   └──► onChange({ air }) ──► photoreal.js onAir()
                                  │
                                  ▼
             surfaceFor({ look, temp, wind, windTo, leaves, amount })   src/game/surface.js
                                  │  Faktoren: grip, accel, speed, glide, brake, slip, tire,
                                  │  ballDrag, ballFriction, ballBounce, boardBounce, wind, label
                                  ▼
             setSurface() → SURF ──► skater.js (Feldspieler), match.js (Ball)
```

`surfaceFor()` vermischt heute vier Dinge in einer Funktion: den Wetterzustand (aus dem Symbol abgeleitet), den Oberflächenzustand (nass, Schnee, Eis, Laub), das Material (immer Asphalt) und die Reaktion zweier Körper (Inline-Rollen und Ball). Das ist für einen Ort und eine Sportart genau richtig. Für mehrere Orte und Sportarten wird es eng.

---

## 2. Zielmodell: vier Schichten

```
 A. Material        B. Zustand              C. Umwelt              D. Reaktion je Körper
 (Ort)              (dynamisch)             (Wetter, Zeit)         (Sportart, Ausrüstung)

 asphalt  ──┐                                                       ┌─► Inline-Rollen
 beton      │   ┌──────────────────┐     Temperatur  ─┐             │   grip, accel, speed,
 pflaster   ├──►│ nässe   0…1      │◄──  Niederschlag ├─ Zeitschritt │   glide, brake, slip
 kunsteis   │   │ schnee  cm       │     Sonne/Schatten│   (Minuten) ├─► Ball
 eis        │   │ eis     0…1      │     Wind         ─┘             │   drag, friction,
 rasen     ─┘   │ laub    0…1      │                                 │   bounce, board, wind
                │ schmutz 0…1      │                                 ├─► Puck
                └──────────────────┘                                 ├─► Kufen (Eishockey)
                         │                                           └─► Schuhe (Spaziergang)
                         └──────────────── Physikfaktoren ◄──────────┘
```

### A. Material (fest, gehört zum Ort)

Grundwerte, die sich nicht mit dem Wetter ändern:

| Material | Haftung trocken | Rollwiderstand | Ballsprung | Wasser bleibt stehen | Wird glatt bei Frost |
|---|---|---|---|---|---|
| Asphalt (Boni) | 1,0 | 1,0 | 1,0 | wenig | ja, wenn nass |
| Beton, glatt | 0,9 | 0,8 | 1,05 | mittel | ja |
| Pflaster | 0,85 | 1,4 | 0,8 (Fugen) | in Fugen | ja |
| Sportboden (Halle) | 1,1 | 0,7 | 1,0 | – | – |
| Kunsteis / Eis | 0,15 (Rollen) | – | 0,3 | – | – |

Die Zahlen sind Startwerte für Versuche, nicht gemessen. Heute ist nur Asphalt umgesetzt, implizit mit 1,0.

### B. Zustand (dynamisch, mit Gedächtnis)

Der wichtigste fehlende Baustein. Heute springt „nass“ mit dem Wettersymbol. Künftig ein kleiner Zustand, der in Spielminuten fortgeschrieben wird:

| Größe | wächst durch | sinkt durch |
|---|---|---|
| `naesse` | Regen (mm/h), Schneeschmelze | Sonne, Wärme, Wind (Abtrocknen in 30 bis 120 min), Frost (→ Eis) |
| `schnee` (cm) | Schneefall unter ca. 1 °C | Tauwetter, Sonne |
| `eis` | Nässe bei Frost, gefrierender Regen | Sonne, Wärme |
| `laub` | Laubfall (aus `season()`), Wind | Regen klebt es fest, Wind verweht es, Fegen |
| `schmutz` | – | später |

Daten: Open-Meteo liefert stündliche Werte. Für Live und „Damals“ können die **letzten 12 bis 24 Stunden** abgerufen und vorwärts gerechnet werden: Nach einem Schauer am Vormittag ist der Platz mittags noch feucht, auch wenn gerade die Sonne scheint. Im Modus „Wählen“ wird der Zustand direkt gesetzt, wie heute.

Örtliche Unterschiede (später): Die Kronenkarte liefert schon heute, wo Schatten fällt. Daraus folgt ohne neue Daten, dass Reif und Nässe **im Baumschatten länger** bleiben und Laub **unter den Kronen und am Zaun** liegt. Physik und Optik können dieselbe Karte nutzen. Dazu braucht die Physik `zustandAn(x, y)` statt eines Werts für den ganzen Platz.

### C. Umwelt

Temperatur, Niederschlag, Wind (Stärke, Richtung), Sonne (Stand, Wolken), Tageszeit, Jahreszeit. Das liefert `environment.js` heute schon vollständig. Es fehlen nur Luftfeuchte (für Reif) und die Vorgeschichte (für den Zustand). Beides gibt Open-Meteo ohne Schlüssel her.

### D. Reaktion je Körper

Dieselbe Oberfläche wirkt auf jeden Körper anders. Ein **Profil** beschreibt, wie stark ein Körper auf jede Zustandsgröße reagiert:

```js
// Beispiel, nicht umgesetzt
const PROFILE = {
  inlineRollen: { naesse: { grip: 0.42, brake: 0.5, slip: 0.5 }, schnee: { … }, eis: { … }, laub: { … },
                  kaelte: { grip: 0.85 }, hitze: { grip: 1.15, tire: 1.8 } },
  ball:         { naesse: { drag: 1.9, friction: 1.8, bounce: 0.45 }, schnee: { … }, kaelte: { bounce: 1.3 },
                  luft: { masse: 0.06, flaeche: 0.0038 } },
  puck:         { … },
  kufen:        { eis: { grip: 1.0 }, naesse: { grip: 0.9 }, … },     // Eishockey
};
```

`physik = material × zustand × profil × umwelt`. Die heutigen Zahlen in `surface.js` werden unverändert zum Profil `inlineRollen` und `ball` auf Material `asphalt`. Dadurch spielt der Boni nach dem Umbau genau wie vorher, und das lässt sich prüfen.

---

## 3. Physik-Anbindung: was noch fehlt

| Lücke | Wirkung heute | Vorschlag |
|---|---|---|
| Torhüter ignorieren `SURF` | Torhüter sind bei Schnee so beweglich wie bei Sonne | Seitwärtsbewegung und Butterfly mit `grip` und `speed` dämpfen (`goalie.js`) |
| KI kennt den Untergrund nicht | KI-Pässe fallen bei Nässe zu kurz, die KI fährt nicht vorsichtiger | Passstärke über die erwartete Reibung vorhalten; bei `slip > 0.3` engere Wenden meiden (`ai.js`) |
| Schuss- und Passgeschwindigkeit fix | Schnee bremst den Ball erst nach dem Schuss | Schüsse auf Schnee oder Laub ein wenig schwächer und ungenauer (`match.js` `shoot()`, `pass()`) |
| Kein Seed für Zufall | Physikänderungen nicht reproduzierbar testbar | Zufallsquelle mit Seed im Spielkern (siehe TECHNICAL_DEBT) |
| Ein Wert für den ganzen Platz | Laub nur sichtbar am Zaun, rutschig aber überall | später `zustandAn(x, y)` (siehe B) |

---

## 4. Optik und Physik aus einer Quelle

Heute rechnen Optik (`visuals()`, Boden-Shader) und Physik (`surfaceFor()`) **getrennt** aus dem Wettersymbol. Beispiel: Die Laubmenge für den Shader (`u_leaves`) und für die Physik (`air.leaves`) werden an zwei Stellen mit derselben Formel gebildet. Künftig gilt:

```
Umwelt ──► Zustand (B) ──┬──► Optik   (Nässeglanz, Schneedecke, Laub, Reif im Schatten)
                         └──► Physik  (Profile D)
```

Damit sieht der Spieler genau das, was er spürt. Das ist der Kern der Vision „Umwelt beeinflusst tatsächlich die Spielphysik“.

---

## 5. Jahreszeiten und Vegetation

Heute (`season()` in `environment.js`): Laubaustrieb Tag 100 bis 140, Laubfall Tag 288 bis 322, Herbstfärbung Tag 255 bis 334. Das gilt für Laubbäume in Norddeutschland.

Künftig:

- Vegetationsart je Ort (`ort.umgebung.vegetation`): Laubbäume, Nadelbäume (immer grün, kaum Laubfall), gemischt.
- Klima je Ort: Die Tage verschieben sich mit Breite und Höhe. Für weitere deutsche Orte reicht ein Versatz von wenigen Tagen. Erst bei Orten in anderen Klimazonen lohnt ein eigenes Modell.
- Optional: echte Phänologie-Daten des Deutschen Wetterdienstes (Blattaustrieb, Laubfall je Jahr). Das wäre für „Damals“ reizvoll, ist aber nicht nötig.

---

## 6. Umsetzungsschritte (wenn beauftragt)

1. **Profile herauslösen, ohne Verhaltensänderung.** `surfaceFor()` intern in Zustand und Profil aufteilen. Die Ausgabe `SURF` bleibt gleich. Ein Test vergleicht die Faktoren für alle Wetterlagen vor und nach dem Umbau.
2. **Torhüter und KI anbinden** (kleine, spürbare Verbesserung).
3. **Zustand mit Gedächtnis:** Vorgeschichte von Open-Meteo, Abtrocknen und Gefrieren in Spielminuten.
4. **Optik aus dem Zustand:** Boden-Shader bekommt Nässe, Eis und Laub aus dem Zustand statt aus dem Symbol.
5. **Material als Ortsangabe** (erst mit dem zweiten Ort).
6. **Örtliche Verteilung** über die Kronenkarte (erst wenn Schritt 1 bis 4 sich bewährt haben).
