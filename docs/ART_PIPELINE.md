# Boni Art-Pipeline (Ligne claire, vollautomatisch)

Alle Spielgrafiken entstehen **per Code**: Es gibt keine externen Bild-KIs, keine API-Schlüssel, keine Grafikprogramme und keine manuellen Exporte. Ein Befehl erzeugt alles, prüft es und baut die Galerie:

```bash
node tools/art/build.cjs              # alle Aufträge
node tools/art/build.cjs bonny_side   # nur einzelne Aufträge
```

Voraussetzungen sind Node und Playwright mit Chromium (in dieser Umgebung vorinstalliert, sonst `npm i -D playwright && npx playwright install chromium`).

Der Rückgabewert ist `0`, wenn die Qualitätskontrolle bestanden ist, sonst `1`. Damit ist die Pipeline CI-tauglich.

## Warum per Code statt per Bild-KI
Ligne claire bedeutet gleichmäßige Linien, flächige Farben und klare Formen. Genau das kann ein Vektor-Renderer exakt. Daraus folgt:
- **Konsistenz:** Jede Ansicht und jede Pose entsteht aus demselben Modell. Es gibt also keine Stilwechsel und kein Flackern zwischen Animationsbildern.
- **Kosten:** null.
- **Wiederholbarkeit:** gleiche Eingabe, gleiches Bild (feste Startwerte).
- **Freistellung:** Die Transparenz ist von Anfang an sauber; es gibt nichts freizustellen.

## Bausteine

| Teil | Datei | Aufgabe |
|---|---|---|
| **A. Style Bible** | `src/art/bible.js` → `STYLE` | Palette (alle erlaubten Farben), Tusche (Farbe `#16110d`, **eine** Linienstärke), flache Kolorierung, Licht, Perspektive, Proportionen, Regeln |
| **B. Character Bible** | `src/art/bible.js` → `CHARACTERS` | Figurenregeln: Erscheinung, Trikot, Nummer, Helm, Schläger, Proportionen, Pflicht-Ansichten und -Posen |
| Tusche-Werkzeug | `src/world/toon/ink.js` | Formen und Glieder, zwei Durchgänge (Kontur, dann Fläche), Ligne-claire-Modus (`uniform`, `flat`) |
| Figur Bonny | `src/world/toon/bonny.js` | Skelett-Rig mit Seitenansicht (alle Posen), Vorder- und Rückansicht, Laufzyklus (`stridePose`), Schläger (`stickParts`) |
| **C. Umgebung** | `src/art/scene.js` | Boni-Platz in der Spielprojektion: Schule, Linden, Stabmattenzaun mit Fußballtor, Straße mit Autos, mobile Bande mit Vereinsflächen, Asphalt mit Linien und Laubschatten, rote Hockeytore mit Netz |
| **D. Asset-Generator** | `tools/art/jobs.json`, `tools/art/render.js`, `tools/art/build.cjs` | Auftragskatalog, Rendern im Headless-Chromium mit dem Spiel-Renderer, Wiederholungen mit gezielter Korrektur, Versionierung |
| **E. Verarbeitung** | `build.cjs` | PNG und WebP (Qualität 0,92), transparente Hintergründe, Sprite Sheets mit Frame-Daten und Ankerpunkt, feste Bildmaße pro Auftrag, Größen im Manifest |
| **F. Qualitätskontrolle** | `render.js` (Messung), `build.cjs` (Bewertung) | automatische Prüfung jedes Assets mit Grenzwerten, gezielte Neu-Erzeugung, Bericht |

## Verzeichnisse und Manifest

```
assets/art/
  manifest.json            maschinenlesbar: alle Assets, Pfade, Maße, Anker, Frames, SHA-256, Quell-Hash
  qa-report.json           alle Prüfungen mit Messwert, Grenze und Versuchen
  gallery.html             automatisch erzeugte Galerie
  v1/                      Stil-Version (STYLE.version)
    characters/bonny/      bonny_front|side|back.{png,webp}
    characters/bonny/poses/ bonny_pose_skate|shot|cheer.{png,webp}
    props/                 stick.{png,webp}
    sprites/               bonny_skate_cycle.{png,webp,json}
    scenes/                boni_court.{png,webp}, boni_court_bonny.{png,webp}
```

**Ein Manifest-Eintrag** enthält:
- `id`, `type`, `title`, `category`
- die Dateien `png` und `webp`
- `width`, `height`, `bytes`, `sha256`
- `spec` (die genauen Render-Parameter)
- `anchor` (Bodenpunkt für die Platzierung)
- bei Sprites zusätzlich `frames` und `fps`
- `qa`

**Versionierung:**
- `styleVersion` und `sourceHash` (Hash über Bible, Renderer und Aufträge) machen jeden Build nachvollziehbar.
- Eine neue Stil-Version schreibt in einen neuen Ordner (`v2/`). Die alte bleibt erhalten.

**Austauschbarkeit:** Das Spiel liest künftig nur das Manifest (Anker und Frames). Die Grafik hängt nicht an der Physik: Kollisionen, Positionen und Tempo bleiben in Metern in `game/`.

## Qualitätskontrolle (automatisch)

| Prüfung | Messung | Grenze |
|---|---|---|
| Nicht abgeschnitten | Pixel am Bildrand | 0 |
| Saubere Freistellung | Anteil halbtransparenter Pixel | ≤ 0,22 |
| Geschlossene Tuschekontur | Anteil dunkler Pixel an der Silhouettenkante | ≥ 0,85 |
| Farben aus der Palette | Pixel nahe Palettenfarbe oder Tusche-Mischung (Kantenglättung) | ≥ 0,95 (Szenen ≥ 0,88) |
| Pflichtfarben der Figur | Trikot, Fell, Helm vorhanden | > 1 % |
| Konsistenz zur Referenz | Farbverteilung im Vergleich zur Seitenansicht (Kosinus) | ≥ 0,75 |
| Gleiche Figurengröße | Höhe der Vorder- und Rückansicht im Vergleich zur Referenz | ± 15 % |
| Animation: vollständig | kein Frame abgeschnitten | – |
| Animation: Bodenkontakt | Streuung der Fußlinie | ≤ 4 px |
| Animation: kein Springen | Silhouetten-Überlappung benachbarter Frames | ≥ 0,5 |
| Animation: echte Bewegung | Überlappung benachbarter Frames | ≤ 0,995 |
| Szene deckend und detailreich | Deckung 100 %, Kantendichte | ≥ 0,02 |

**Gezielte Neu-Erzeugung:** Schlägt eine Prüfung fehl und es gibt eine bekannte Korrektur, rendert die Pipeline mit angepassten Parametern neu, bis zu dreimal. Ist eine Figur abgeschnitten, wird sie um 10 % verkleinert. Beispiel aus dem ersten Lauf: Beim Jubel ragte der Schläger aus dem Bild, der zweite Versuch bestand.

## Erweitern
1. **Neue Figur:** Eintrag in `CHARACTERS` (bible.js) und ein Rig-Modul nach dem Muster von `bonny.js`, mit Farben ausschließlich aus `STYLE.palette`. Dazu Aufträge in `jobs.json` mit `checks: [..., "character:<id>"]`, eine Ansicht davon mit `"reference": true`.
2. **Neue Pose:** Eintrag in `POSES` (bonny.js). Sie steht sofort für Einzelbilder und Animationen bereit.
3. **Neue Umgebung:** eine Zeichenfunktion nach dem Muster `drawCourtScene` und ein Auftrag vom Typ `scene`.
4. **Neue Farbe:** nur über `STYLE.palette`. Die Palettenprüfung meldet jede fremde Farbe.

## Grenzen und bekannte Punkte
- **Schriften:** Die Nummern und Schriftzüge nutzen Systemschriften („Arial Black“, Ersatz: sans-serif). Auf anderen Rechnern können sie minimal anders aussehen. Der `sourceHash` erfasst das nicht. Abhilfe: eine freie Schrift (SIL OFL) ins Repo legen.
- **Gespiegelte Figuren:** Beim Spiegeln nach links stehen Nummern spiegelverkehrt. Bei der Spiel-Integration werden Nummern deshalb getrennt gezeichnet.
- **Was die Prüfung nicht misst:** Sie prüft Technik und Konsistenz, nicht Ästhetik. Die Galerie dient der Abnahme durch Menschen.
- **Spiel:** Noch nicht ins Spiel eingebaut (nächster Meilenstein, nach Freigabe).
