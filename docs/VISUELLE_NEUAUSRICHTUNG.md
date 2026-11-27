# Visuelle Neuausrichtung: Boni Borstentiere im Comicstil

**Analyse und Migrationskonzept. Stand: Version 24.** Es ist noch nichts implementiert.

Ziel: Weg von 2.5D-Pixel-Art mit Chibi-Kindern, hin zu einem gezeichneten Arcade-Inlinehockeyspiel im frankobelgischen Comicstil (École de Marcinelle). Die Spielarchitektur bleibt erhalten.

---

## 0. Bestandsaufnahme

### 0.1 Was heute existiert

| Bereich | Datei | Zustand | Bezug zur Grafik |
|---|---|---|---|
| Anzeige | `engine/display.js` | Zwei Ebenen. Die Welt läuft in 2× logischer Auflösung, die Oberfläche in 216 Zeilen. Hochskaliert wird pixelgenau (*nearest neighbour*). | Ist auf Pixel-Art ausgelegt und muss erweitert werden. |
| Projektion | `world/projection.js`, `config.js` | `project(x,y,z) = {16x, 8y − 14z}` in logischen Pixeln | Bleibt. |
| Figuren | `world/figures.js` (718 Zeilen) | Skelett aus Hüfte, Knie (IK mit zwei Knochen), Knöchel, Schulter, Ellbogen und Hand. 37 Posen, 6 Stimmungen, lazy Cache, Aufwärmen in Etappen (`warm()`/`warmStep()`). Gezeichnet wird mit Vektorformen; danach wandelt eine Alpha-Schwelle mit automatischer Kontur alles in Pixel-Art um. | **Kern zum Weiterverwenden.** Nur die Zeichenschicht wird getauscht. |
| Posenwahl | `world/skater.js` | Die Zustandsmaschine `pose()` wählt nach Sturz, Jubel, Bully, Ausholen, Schuss, Poke, Bremsen, Übersetzen, Schritt oder Gleiten. Dazu kommen der Schläger (`stickPoint()`) und das Dribbeln. | Bleibt vollständig. |
| Torhüter | `game/goalie.js` + `figures.js` | 8 Posen (Grundstellung, Atmen, Rutschen, Butterfly, Fanghand, Stockhand, Abdecken) | Logik bleibt, Zeichnung wird neu. |
| Halle und Boni | `world/rink.js` | Wird pro Pixel aus Weltkoordinaten gebacken. Die Boni-Variante hat Asphalt, Holzbande, Rasen, Bäume, ein lila Nilpferd und ein Schild. | Geometrie bleibt (`rinkExtentAt`, `goalBox`, `RINK_CORE`). Die Grafik wird neu. |
| Welt zeichnen | `world/view.js` | Ebenen für Hintergrund, Publikum (Frames, La-Ola), nach Tiefe sortierte Objekte und Vordergrund. Dazu Netzwackeln. | Reihenfolge und Logik bleiben, die Bildquellen werden neu. |
| Partikel | `world/particles.js` | Punkte mit `kind` (dot, trail, star, confetti) und einer einfachen Physik | Die Simulation bleibt; dazu kommt ein Comic-Effektsystem. |
| Oberfläche | `engine/font.js`, `ui/*` | Pixelschriften 3×5 und 5×7 (mit ÄÖÜ), Panels, Videowand | Bleibt zunächst; später kommen Comic-Lettering und Sprechblasen-Panels. |
| Wiederholung | `game/replay.js` | Snapshot-Schlüssel für Posen-Felder (`SKATER`, `GOALIE`) | Neue Posen-Felder **müssen** hier ergänzt werden. |

### 0.2 Gemessene Größenordnung

Ein Spieler ist heute ca. 22 logische Pixel hoch, die Kamera steht auf Zoom 1,35. Auf dem Bildschirm bedeutet das:

| Gerät | Gerätepixel je Weltpixel | Spielerhöhe |
|---|---|---|
| Handy quer (720p) | 4,5 | **ca. 100 px** |
| Desktop 1080p | 6,75 | **ca. 150 px** |
| 1440p | 9,0 | **ca. 200 px** |

**Folgerung:** Die Figuren sind auf dem Bildschirm groß genug für echte Comic-Zeichnung mit Tuschekontur und Mimik. Heute wird diese Fläche aber nur mit 44 Grafikpixeln gefüllt. Der Engpass ist nicht die Spielgröße, sondern die Pixel-Pipeline.

### 0.3 Die Referenzen des Vereins (Website-Repo `boni-borstentiere-website/img/`)

| Datei | Inhalt | Verwendung |
|---|---|---|
| `bonny_comic.png` | 12-Panel-Comic „Bonny und das erste große Spiel“ | **Hauptreferenz** für Bonny: Körperbau, Gesicht, Posen (Sprint, Sturz, Schuss, Jubel) und Ausrüstung |
| `logo.png` | Vereinswappen mit Bonnys Gesicht frontal | Gesichtskonstruktion, Farben, Rüssel und Hauer |
| `jersey_front.png`, `jersey_back.png` | Offizielles Trikot: dunkelgrün, Streifen creme/orange/creme, Schnürkragen, Wappen auf der Brust, Schulter-Patches; hinten „BONI“ und 61 in Creme mit brauner Kontur, 61 auch auf den Ärmeln | Trikot-Design 1:1 übernehmen, vereinfacht für die Spielgröße |
| `balding_borstis_logo_clean.png` | Keiler mit Brille, Bartstoppeln, „Haare optional“, 18+ | Vorlage für die Erwachsenen-Figuren |
| `banner.png` | Banner der Website | Titelbild und Menü-Stimmung |
| `photos/boni-platz.jpg` | Boni mit Platanen, roter Klinkerweg, Bänke, Rindenmulch, Spielgeräte (Drehkreisel, Klettergerüst), Ballfangzaun rechts | Umgebung des Platzes |
| `photos/boni-schale.jpg` | Edelstahl-Drehschale auf Asphalt, **dahinter der umzäunte Bolzplatz** (hoher Maschendraht-Ballfangzaun, Tor im Zaun) | Spielfläche und Umzäunung |
| `photos/boni-spielplatz.jpg` | **Holz-Nilpferd** (graues, verwittertes Schnitzholz) im Sandkasten mit Klinker-Einfassung, Schaukel, Spielhaus mit rotem Dach, liegende Baumstämme, Gründerzeit-Fassaden | Nilpferd-Spielplatz |
| `photos/eilenriede-weg.jpg` | Herbstlicher Waldweg mit hohen Stämmen und Laub | Eilenriede (Titel, Menü, Bonnys Herkunft) |
| `audio/hymne.mp3` | Vereinshymne | Bereits als Torsong im Spiel |

---

## 1. Was an der bisherigen Grafik geändert werden muss

### 1.1 Grundsätzlich
1. **Pixel-Raster als Leitmotiv entfällt.** Heute wird alles auf ein grobes Raster gezwungen: Alpha-Schwelle, Pixelkontur, pixelgenaue Skalierung, Bayer-Dithering im Boden. Comicgrafik braucht dagegen glatte, kantengeglättete Tuschelinien in voller Bildschirmauflösung.
2. **Konturen:** Die Ein-Pixel-Automatikkontur wird zur **Tuschekontur mit variabler Strichstärke**: außen kräftig (Silhouette), innen fein (Falten, Gesichtszüge).
3. **Farbe:** Bisher wurde mit drei Tonstufen, Glanzlicht-Pixeln und Dithering schattiert. Künftig gibt es **flächige Farbe plus genau eine harte Schattenfläche** (Cel-Look) und sparsame weiße Glanzpunkte, ohne Verläufe.
4. **Proportionen:** Statt Chibi-Kindern (Kopf ca. 40 %) kommen **anthropomorphe Tiere mit Marcinelle-Proportionen**: ca. 3 Kopfhöhen, gummiartige, dynamische Glieder, große Füße und Hände, starke Silhouette.
5. **Animation:** Bisher wird die Pose 60-mal pro Sekunde gewechselt. Künftig wird **„auf Zweien“ animiert**: Posenwechsel mit 12–15 Bildern pro Sekunde wie im Zeichentrick, Positionen weiter flüssig mit 60 Hz. Dazu kommen Stauchen und Strecken, Schmier-Bilder (*Smear-Frames*) beim Schuss sowie Bewegungslinien.

### 1.2 Bereichsweise

| Bereich | Heute | Neu |
|---|---|---|
| Spieler | Chibi-Kinder, Pixel | Bonny und die Borstentiere als gezeichnete Tierfiguren |
| Torhüter | Kind mit Riesenmaske | Eigene Tierfigur mit großer Ausrüstung |
| Ball/Puck | 7-px-Pixelball | Gezeichneter roter Ball mit Glanzfleck, Bewegungsstrichen und Verzerrung bei hohem Tempo |
| Spielort | Lila Nilpferd, Holzbande, Pixel-Rasen | Echter Bolzplatz: Asphalt, Ballfangzaun, Platanen, Klinkerweg, **graues Holz-Nilpferd**, Edelstahlschale, Gründerzeit-Häuser |
| Halle („Arena“) | Pixelhalle | Bleibt vorerst als zweite Spielstätte; später ebenfalls im Comicstil oder entfernt (Entscheidung offen) |
| Publikum | 8×12-Pixel-Menschen | Gezeichnete Zuschauer am Zaun (Eltern, Vereinsleute, Waldtiere) |
| Effekte | Pixel-Funken, Konfetti | Comic-Explosionen, Feuerbälle, Blitze, Lautmalerei-Schriftzüge |
| Oberfläche | Pixelschrift | In einer späteren Phase Comic-Lettering, Sprechblasen und Panels. Bis dahin bleibt die Pixelschrift, damit die Bedienung stabil bleibt. |

### 1.3 Abweichung des Spielorts vom echten Boni (aus den Fotos)
- Der Bolzplatz ist **mit einem hohen Maschendraht-Ballfangzaun umgeben**, nicht mit einer Holzbande. Im Spiel wird daraus ein Zaun, davor gegebenenfalls eine niedrige mobile Hockeybande, falls der Verein eine nutzt. **Dazu brauchen wir Fotos vom Training.**
- Das Nilpferd ist eine **graubraune Holzskulptur** und nicht lila. Es steht im Sandkasten mit roter Klinker-Einfassung.
- Rund um den Platz: Platanen, ein roter Klinkerweg, Rindenmulch, Holzbänke, Drehkreisel, Edelstahlschale, Spielhaus mit rotem Dach und weiße Gründerzeit-Fassaden.

---

## 2. Welche technischen Systeme weiterverwendet werden

### Unverändert
- Spielschleife (60 Hz fest), Szenen-Stapel und Vollbild (`main.js`)
- Eingabe komplett: Tastatur, Touch, Gamepads mit 8BitDo-Sonderfällen, Belegung, Menü-Steuerung
- Spiellogik: `match.js`, `puck.js` (Physik), `ai.js`, `referee.js`, `rules.js`, `tournament.js`
- Statistik, Drei Sterne, Turnier, Wiederholung (Aufzeichnung, Zeitlupe, Wiederherstellen)
- Kamera und Projektion: Alle Koordinaten bleiben in logischen Weltpixeln.
- Audio: Effekte, Publikum, Hymne
- Szenen- und Menülogik, deutsche Texte

### Mit Anpassung
- **`figures.js`**: Skelett, IK, Posentabelle `P`, Stimmungen und Cache bleiben. **Neu** ist die Zeichenschicht: Körperteile als Comic-Formen, die an den Knochen hängen. Statt `finish()` (Pixel-Schwelle) kommt ein Tusche-Durchgang.
- **`skater.js`**: `pose()`, `stickPoint()` und `drawStick()` bleiben, die Zeichnung des Schlägers wird zur Tuschezeichnung. Neu dazu: Posenwechsel auf Zweien, Bewegungslinien, Stauchen und Strecken.
- **`display.js`**: Neuer Modus **„Comic“** mit einer Weltebene in Gerätepixeln (mit Obergrenze) und weicher Skalierung. Der Pixelmodus bleibt bis zum Abschluss der Umstellung als Einstellung erhalten, damit nichts stillschweigend wegfällt.
- **`view.js`**: Ebenen bleiben (Hintergrund, Zaun hinten, Objekte nach Tiefe, Zaun vorne), die Bildquellen werden neu.
- **`particles.js`**: Physik bleibt; das neue Effektsystem (siehe 5) setzt darauf auf.
- **`replay.js`**: Neue Animationsfelder in die Schlüssellisten aufnehmen.

### Wird ersetzt
- Pixel-Schwelle, Pixelkontur und Dithering
- Gebackene Pixel-Halle, Boni-Kulisse und Pixel-Publikum
- Pixelball und Pixelschatten
- Später: Pixelschrift und Pixel-Panels der Oberfläche

---

## 3. Wie Bonny konkret aussehen sollte

### 3.1 Wiedererkennungsmerkmale aus Comic und Wappen
- **Fell:** warmes Kastanienbraun mit rötlichem Stich. Die Schnauzenpartie ist heller (sandbraun), die Borsten am Kopf und im Nacken sind dunkler.
- **Haarschopf:** Ein stacheliger Borstenschopf oben auf dem Kopf ist das wichtigste Silhouettenmerkmal und wippt bei jeder Bewegung.
- **Ohren:** spitz, leicht schräg nach außen gestellt, innen rosa.
- **Rüssel:** groß, rund, rosa-beige, nach vorn gestellt, mit zwei ovalen Nasenlöchern. Im Profil trägt er die Silhouette.
- **Hauer:** zwei kleine weiße Hauer, die aus dem Unterkiefer nach oben zeigen, je einer links und rechts vom Rüssel.
- **Augen:** groß, rund, dunkelbraun, mit weißem Glanzpunkt und ausdrucksstarken Brauen. Leicht rosa Wangen wie im Wappen.
- **Wesen:** neugierig, mutig, ein bisschen tollpatschig, nie aufgebend („Ich geb nicht auf!“).

### 3.2 Proportionen (Marcinelle statt Chibi)
- **Größe:** ca. **3 Kopfhöhen** groß (Chibi bisher ca. 2,4), so wie die Kinderfiguren in klassischen Abenteuercomics.
- **Körper:** Kopf groß, aber nicht dominant. Der Rumpf ist kompakt und tonnenförmig, typisch Wildschwein: stämmig mit kräftigem Nacken.
- **Gliedmaßen:** Arme gummiartig und eher lang (für ausdrucksstarke Gesten), Beine kurz und kräftig, Skates bewusst groß.
- **Schwanz:** dünn, mit Quaste, schaut hinten aus der Hose. Er ist ein Detail für Charme und Animation.

### 3.3 Ausrüstung (nach dem offiziellen Trikot)
- **Trikot:**
  - dunkelgrün, **Streifenfolge Creme–Orange–Creme** an Saum und Ärmeln, Schnürkragen in Creme und Orange
  - vorne ein vereinfachtes Wappen (in Spielgröße ein Bonny-Kopf im runden Patch)
  - hinten „BONI“ und **61** in Creme mit brauner Kontur, die **61 auch auf den Ärmeln**
- **Hose:** dunkelbraun bis schwarz. **Stutzen:** grün mit cremefarbenen und orangen Ringen.
- **Handschuhe:** grün mit oranger Stulpe. **Schläger:** Holzschaft mit schwarzem Tape am Blatt.
- **Skates:** schwarze Schuhe mit cremefarbenen Nähten und **orangen Rollen** (Vereinsfarbe).
- **Helm:** Im Comic trägt Bonny **keinen** Helm, die Vorgabe verlangt einen. Vorschlag: ein dunkelgrüner, offener Helm mit **Aussparungen, durch die die Ohren schauen**, und der Borstenschopf ragt hinten heraus. Gitter und Visier entfallen, damit die Mimik sichtbar bleibt. Für Menüs, Comicszenen und den Jubel kann er den Helm abnehmen.

### 3.4 Farbpalette (Vorschlag)

| Element | Grundton | Schatten | Licht |
|---|---|---|---|
| Fell | `#8A4B22` | `#5C3015` | `#B5703A` |
| Schnauze/Rüssel | `#E9B08C` | `#C98A68` | `#F7D3B8` |
| Ohr innen, Wangen | `#F29A9A` | – | – |
| Hauer, Augenglanz | `#FFF6E4` | – | – |
| Trikot grün | `#1F5A33` | `#143D22` | `#2E7A47` |
| Creme | `#F3E3B5` | `#D8C48E` | – |
| Orange | `#D2642A` | `#A8481A` | – |
| Tusche | `#1A120C` | – | – |

### 3.5 Charakterstudie (Schritt 2)
Die Studie wird **mit dem Spiel-Renderer selbst** gezeichnet, nicht als separate Illustration. Was in der Studie zu sehen ist, sieht man auch im Spiel.

- **Ort:** ein Entwickler-Bildschirm „Figurenstudio“, erreichbar über `?studio`.
- **Ansichten:** Vorder-, Seiten- und Rückansicht (*Turnaround*).
- **Posen:** Stand (Idle), Laufen, Sprint, Schuss (Ausholen, Abschuss, Durchschwung), Jubel, Sturz.
- **Zusätzlich:** jede Pose in Spielgröße auf Asphalt, damit die Lesbarkeit geprüft werden kann.
- **Abnahme:** Screenshots zur Freigabe, bevor irgendetwas ins Spiel kommt.

---

## 4. Wie der neue Renderer funktionieren könnte

### 4.1 Empfehlung: Rig aus Ausschnitt-Teilen (*Cutout*), gezeichnet als Vektor
Das ist ein Hybrid aus dem vorhandenen Skelett und einer neuen Zeichenschicht.

- **Körperteile als Vektorformen** (Path2D mit Bézierkurven), jeweils im lokalen Raum eines Knochens definiert: Kopf in den Ansichten Profil, 3/4 vorne und 3/4 hinten, Rumpf, Oberarm, Unterarm, Handschuh, Oberschenkel, Schienbein, Skate, Schopf, Schwanz.
- **Gesichtsvarianten:** pro Stimmung eigene Augen-, Brauen- und Mundformen.
- **Zeichenreihenfolge** wie heute: ferne Seite, Rumpf, nahe Seite, Kopf, nahe Hand.
- **Tusche-Technik:**
  1. *Silhouetten-Durchgang:* die gesamte Figur einmal mit dicker Tusche (`stroke` mit großer Strichstärke, runden Ecken). Das ergibt die kräftige Außenkontur.
  2. *Farb-Durchgang:* Teile flächig füllen, dann die Schattenfläche als zweite, beschnittene Form (*Clip*), dann Glanzpunkte.
  3. *Innenlinien:* feine Tusche für Falten, Trikotstreifen, Gesicht und Rückennummer.
  4. Optional: eine minimal „kochende“ Linie (drei leicht verwackelte Varianten im Wechsel) für den handgezeichneten Eindruck.
- **Ansichten:** Neben dem Profil (links/rechts gespiegelt) kommen **3/4-vorne und 3/4-hinten** dazu. Die Wahl richtet sich nach der Laufrichtung, wenn jemand auf die Kamera zu oder von ihr weg fährt. Die Rückennummer 61 ist dann wirklich von hinten zu sehen.
- **Animation:** Posenwechsel auf Zweien (12–15 Bilder pro Sekunde), Stauchen und Strecken über Knochenskalierung, Schmier-Bilder als eigene Posen, Schopf und Schwanz mit verzögerter Nachbewegung.

### 4.2 Bildspeicher und Performance
- Jede Kombination aus Pose, Stimmung, Ansicht und **Maßstabsstufe** wird einmal in eine Offscreen-Canvas gezeichnet und gecacht, wie heute.
- **Maßstabsstufen:** Der Cache wird bei Zoom- oder Fensterwechsel neu aufgebaut (z. B. in Stufen von 0,75×, 1×, 1,5×, 2×), damit die Tuschelinien immer gleich dick wirken.
- **Weltebene:** wird in Gerätepixeln gerendert, mit **Obergrenze** (z. B. 1920×1080; auf Handys 1280×720) und weicher Skalierung (`imageSmoothingEnabled = true`). Die Comic-Optik verträgt das, Pixel-Art nicht.
- **Hintergrund:** wird in **Kacheln** vorgerendert (Asphalt, Linien, Zaun, Bäume) statt als eine Riesen-Canvas. Bei 60 × 30 m und 6,75 px pro Weltpixel wären es sonst über 7000 px Breite.
- **Detailstufen:** volle Details für Menü, Studio, Wiederholung und Jubel-Nahaufnahme; vereinfachte Spielgröße (ohne Wappen-Details, Nähte und Schnürung).

### 4.3 Simulation bleibt unabhängig
Physik, Kollisionen, KI und Schiedsrichter arbeiten weiter in Metern bei 60 Hz. Der Renderer liest nur Zustände (Position, Richtung, Posen-Felder). Die Auflösung beeinflusst weder Bewegung noch Spielverlauf. Das ist heute schon so und bleibt so.

### 4.4 Ist der Pixel-Renderer weiter sinnvoll?
- **Im Endausbau nicht.** Er wird zur Übergangslösung.
- **Während der Umstellung** bleibt er als Einstellung „Grafikstil: Pixel / Comic“ erhalten. Dafür gibt es drei Gründe:
  1. Es fällt nichts stillschweigend weg.
  2. Gemischte Zwischenstände bleiben spielbar.
  3. Der Pixelmodus dient als Vergleich für die Lesbarkeit.
- Nach vollständiger Umstellung und Freigabe entscheiden wir, ob er entfernt wird.

---

## 5. Wie wir die Comic-Explosionen technisch umsetzen

### 5.1 Prinzip
Comic-Effekte bestehen aus **wenigen gezeichneten Phasen** (4–8 Bilder, abgespielt mit 12–15 Bildern pro Sekunde) mit Tuschekontur und Farbflächen. Es gibt keine weichen Partikel, keine Transparenzverläufe und keine Realfeuer-Simulation.

- **Neues Modul:** `world/comicfx.js`. Jede Effektart ist eine Zeichenfunktion `draw(ctx, phase, seed, scale)` und wird mit demselben Tusche-Werkzeug gezeichnet wie die Figuren. Dadurch wirkt alles wie vom selben Zeichner.
- **Ausrichtung:** Effekte leben im Weltraum (Position, Höhe z) und werden nach Tiefe mit den Figuren sortiert.
- **Grenzen:** Ein fester Pool (z. B. höchstens 24 gleichzeitig) verhindert Performance-Einbrüche.

### 5.2 Erstes Effekt-Set

| Effekt | Aufbau | Auslöser im Spiel |
|---|---|---|
| **Explosion** | Gezackter Stern (Strahlen per Startwert variiert) in drei Lagen (Weiß-Gelb innen, Orange, Rot) mit dicker Tusche, dazu Rauchwölkchen als Kreisgruppen mit Kontur, Trümmerstriche und radiale Speedlines; Phasen: aufblähen, Spitze, zerfallen | Tor, Pfostentreffer mit vollem Schuss |
| **Feuerschuss** | Ball mit hellem Kern, Flammenzungen als Tropfenformen entgegen der Flugrichtung, Rauchpuffs entlang der Spur | Schuss mit voller Aufladung |
| **Blitz** | Zickzack mit Verästelungen, doppelt gezeichnet (dicker blauer Strich, dünner weißer Kern), pro Phase neu erzeugt (Flackern) | Elektro-Schuss, Bully-Gewinn, Kombos |
| **Einschlag** | Sternförmiger Aufprall-Kranz mit Lautschrift („RUMMS!“, „BÄM!“, „KLONG!“, „PATSCH!“, „WUSCH!“) | Checks, Pfosten, Paraden, Schüsse |
| **Sturz** | Staubwolke, kreisende Sterne und Vögelchen über dem Kopf, verdrehte Augen | Sturz (`downT`) |
| **Bewegungslinien** | Tuschestriche hinter schnellen Figuren und dem Ball, Länge abhängig vom Tempo | Sprint, schnelle Schüsse |
| **Torjubel** | Riesen-Explosion und Lautschrift „TOOORRR!!!“ in Comic-Lettering mit Konfetti-Streifen | Tor |

### 5.3 Spielgefühl
- **Trefferstopp (*Hit-Stop*):** 3–6 Bilder Spielpause bei großen Treffern. Die Simulation steht dabei still; sie bleibt deterministisch, weil einfach Schritte ausgelassen werden.
- **Kamera:** Wackeln bei großen Treffern gibt es schon; dazu kommt ein kurzes Zoom-Pulsieren.
- **Schalter:** neue Einstellung „Comic-Effekte: Viel / Normal / Aus“. Für Barrierefreiheit und schwache Geräte.
- **Realismus:** Die Effekte sind zunächst **rein visuell**. Ein „Superschuss“ mit Spielwirkung (z. B. eine Energieleiste) wäre eine eigene, spätere Entscheidung (Modus „Arcade“ statt „Realistisch“), damit die Regelwerk-Treue nicht leidet.

---

## 6. Welche vorhandenen Assets als Referenz dienen

1. **`bonny_comic.png`:** verbindlich für Bonnys Gestalt, Mimik und Posen.
   - Panel 1 und 9: Laufen und Ballführung
   - Panel 6: Sturz
   - Panel 10: Torschuss und Jubel
   - Panel 11: Jubel im Team
   - Panel 8: Rückennummer 61
2. **`logo.png`:** verbindlich für die Frontalansicht des Gesichts und die Farben von Fell und Rüssel.
3. **`jersey_front.png` und `jersey_back.png`:** verbindlich für das Trikot.
4. **`balding_borstis_logo_clean.png`:** für die Borstis (Brille, Bartstoppeln, schütteres Haar).
5. **`photos/boni-schale.jpg`, `boni-platz.jpg`, `boni-spielplatz.jpg`:** für den Spielort und seine Umgebung.
6. **`photos/eilenriede-weg.jpg`:** für Titel, Menüs und Zwischenszenen.
7. **`audio/hymne.mp3`:** bleibt Torsong und Titelmusik.

**Hinweis zur Verwendung:** Die Vereinsbilder dienen als **Vorlage**. Sie werden nicht als Rastergrafik ins Spielfeld kopiert, weil ihr Malstil (weich schattiert) nicht zum Tuschestil passt. Das Wappen kann im Menü als echtes Vereinswappen erscheinen.

**Fehlende Referenzen (bitte nachliefern):**
- Fotos des **Bolzplatzes selbst**: Belag, Linien, Tore, Zaun, ob es eine mobile Bande gibt
- Fotos vom **Training**: wie die Spielfläche genutzt wird
- Gegebenenfalls **Skizzen oder Vorlagen** weiterer Vereinsfiguren, falls es welche gibt

---

## 7. Migrationsplan

| Schritt | Inhalt | Ergebnis | Abnahme |
|---|---|---|---|
| 1 | Bestandsaufnahme | Dieses Dokument | Entscheidungen zu den offenen Fragen (Abschnitt 9) |
| 2a | Infrastruktur: Comic-Modus in `display.js` (Gerätepixel, Obergrenze, weiche Skalierung), Tusche-Werkzeug `world/ink.js` (Silhouetten-Durchgang, Füllen, Schattenfläche, Innenlinien), Einstellung „Grafikstil“ | Unsichtbar für das Spiel; bestehende Tests grün | Tests und Performance-Messung |
| 2b | **Bonny-Rig und Figurenstudio**: Turnaround und 6 Posen, gezeichnet mit dem Spiel-Renderer | Screenshots der Charakterstudie | **Freigabe Bonny** |
| 3 | Integration: Nur Nummer 61 wird gezeichnet, alle anderen bleiben vorerst Pixel. Tests für Bewegung, Schuss, Sturz, Kollisionen, Zoomstufen und Tempo | Spielbare Version mit Comic-Bonny | Lesbarkeit, Performance (Handy) |
| 4 | Comic-Effekte, Set 1 (Explosion, Feuerschuss, Blitz, Einschlag, Sturz, Bewegungslinien, Torjubel) | Effekt-Galerie im Studio und im Spiel | Freigabe Effekte |
| 5 | Spielort Bonifatiusplatz neu: Asphalt, Zaun, Platanen, Holz-Nilpferd, Schale, Häuser | Neue Boni-Kulisse | Abgleich mit den Fotos |
| 6 | Weitere Figuren (erst nach Freigabe von Bonny), Torhüter, Gegner-Teams | Komplette Mannschaften | je Figur |
| 7 | Oberfläche: Comic-Lettering, Sprechblasen, Panels, Titelbild als Comic-Cover | Einheitlicher Look | Freigabe |
| 8 | Aufräumen: Pixel-Pfad entfernen oder als Retro-Option behalten | – | Entscheidung |

**Qualitätssicherung in jedem Schritt:**
- alle Playwright-Tests (e2e, sn30, rawpad, mobile2, rules_ui, tourney, wall, boni, replay)
- Screenshot-Vergleich alt/neu in drei Auflösungen (720p, 1080p, 1440p)
- Performance-Messung (Zeichenzeit pro Bild, Startzeit, Speicher)
- Lesbarkeit bei schnellen Szenen
- Gamepad und Touch
- **Neu:** Die Testskripte kommen ins Repo (`tests/`), statt nur im Scratchpad zu liegen.

---

## 8. Technische Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| **Qualitätsgrenze prozeduraler Vektorzeichnung** | Code-gezeichnete Figuren erreichen nicht automatisch die Lebendigkeit von Handzeichnungen. | Formen pro Körperteil sorgfältig gestalten (nicht nur Kapseln), Silhouetten-Tusche, auf Zweien animieren, Schmier-Bilder, Abnahme über das Figurenstudio. Alternative: einzelne Teile (Kopf, Hände) als handgezeichnete SVG-Pfade importieren, falls eine Zeichnerin oder ein Zeichner mitwirkt. |
| **Zeichenaufwand für Ansichten** | Drei Ansichten mal 37 Posen mal 6 Stimmungen ist viel. | Rig-Ansatz: Pro Ansicht werden nur Kopf und Rumpf neu gezeichnet, Gliedmaßen kommen aus dem Skelett. Posen werden geteilt. |
| **Performance auf Handys** | Eine Canvas in Gerätepixeln braucht viel Füllrate, Caches pro Maßstab brauchen Speicher. | Auflösungs-Obergrenze, Cache pro Maßstabsstufe mit Begrenzung (LRU), Hintergrund in Kacheln, Effekt-Pool, Messung in jedem Schritt |
| **Lesbarkeit im Gewühl** | Detailreiche Figuren verschwimmen, der Ball geht verloren. | Silhouetten-Tusche, kontrastreiche Teamfarben, Detailstufen, Ball mit Kontur und Bewegungsstrichen; der durchscheinende Ball und der Randpfeil bleiben. |
| **Stilmix in der Übergangszeit** | Comic-Bonny in Pixelwelt wirkt uneinheitlich. | Bewusst akzeptiert; der Grafikstil-Schalter hält den alten Zustand sauber. Schritt 5 (Spielort) früh nachziehen. |
| **Wiederholungssystem** | Neue Animationsfelder fehlen in Snapshots, die Wiederholung zeigt dann falsche Posen. | Felder in `replay.js` ergänzen, Wiederholungstest erweitern. |
| **Urheberrecht/Stil** | Inspiration durch Franquin und Marcinelle ist zulässig. Figuren wie der Marsupilami, Spirou oder Gaston dürfen nicht nachgebildet werden. | Eigene Figuren, eigene Formen, keine Zitate fremder Figuren |
| **Herkunft der Vereinsbilder** | Comic, Wappen und Trikot sind Vereinsmaterial (vermutlich KI-gestützt erstellt). | Klären, dass der Verein sie freigibt. Sie dienen nur als Vorlage. |
| **Echte Kinder** | Erkennbare Darstellung realer Kinder wäre datenschutzrechtlich heikel. | Tierfiguren statt realer Kinder; echte Namen nur mit Einverständnis |
| **Schriften** | Comic-Lettering braucht eine Schrift mit passender Lizenz. | Freie Schrift (SIL OFL) lokal einbinden oder eigene Lettering-Glyphen zeichnen; ÄÖÜ prüfen |

---

## 9. Offene Entscheidungen

1. **Tierfiguren oder Comic-Kanon?** Im Comic ist Bonny das *einzige Tier* unter Menschenkindern; die Geschichte lebt davon. Die neue Vorgabe ersetzt die Kinder durch Waldtiere. Mögliche Wege:
   - **A)** Die Borstentiere als **Rotte junger Wildschweine** (Frischlinge mit Streifen, unterschiedliche Größen, Frisuren und Eigenheiten). Das passt am stärksten zum Namen „Borstentiere“.
   - **B)** Eine **gemischte Eilenriede-Bande**: Bonny plus Fuchs, Dachs, Eichhörnchen, Igel, Reh, Waldkauz. Die Silhouetten wären sehr unterschiedlich und gut lesbar.
   - **C)** Comic-Kanon: Bonny plus Menschenkinder im Comicstil.
2. **Helm für Bonny:** offener Helm mit Ohr-Aussparungen (Vorschlag) oder wie im Comic ohne Helm.
3. **Balding Borstis:** erwachsene Keiler mit Brille und Bartstoppeln (Vorschlag).
4. **Gegner-Teams:** Sie haben schon Tier-Embleme (Blazers = Fuchs, Waves = Robbe, Vipers = Schlange, Storm = Eule). Vorschlag: Daraus werden echte Tier-Teams.
5. **Spielwirkung der Effekte:** zunächst nur visuell (Vorschlag); ein Arcade-Superschuss als spätere Option.
6. **Halle:** behalten (im Comicstil) oder ausschließlich der Boni.

---

## 10. Entscheidungen (Runde 2) und Hybrid-Ansatz

**Entscheidungen**

| Frage | Entscheidung |
|---|---|
| Mannschaft | **B: gemischte Eilenriede-Bande** (Bonny plus weitere Waldtiere) |
| Helm | **Alle Spieler mit Helm**, bei Bonny mit Ohr-Aussparungen |
| Umgebung | **Fotorealistische Umgebung mit gezeichneten Figuren und Effekten** (Prinzip „Roger Rabbit / Space Jam“) |
| Referenzen | Luftbild, freie Fotos sowie Fotos vom Training (vom Nutzer) |

**Was die Trainingsfotos und das Luftbild zeigen**
- Gespielt wird auf **offenem, dunkelgrauem Asphalt ohne Bande**, mit ausgeblichenen weißen Linien.
- Der Platz liegt fast vollständig **unter Baumkronen**. Typisch sind runde Sonnenflecken auf dem Boden.
- Rundherum steht ein **hoher grüngrauer Stabmattenzaun** mit Schrägstreben. Darin sind **große graue Stahl-Fußballtore** eingebaut.
- Gespielt wird mit **roten Bauer-Hockeytoren** (weißes Netz), **roten Bällen** und einem **grünen Lochpuck**.
- Hintergrund: helle Linden, die **weiße Gründerzeit-Schule mit rotem Ziegeldach und Gauben**, parkende Autos.
- Das Luftbild zeigt kaum Boden. Es dient nur zur Lage (Sandkasten mit Nilpferd nordwestlich, Straße mit Parkreihe diagonal südwestlich).

**Hybrid-Rendering („gezeichnete Figuren in echter Welt“)**

1. **Boden:**
   - fotorealistischer Asphalt (Körnung, Steinchen, Abnutzung), prozedural erzeugt in Bildschirmauflösung
   - darauf ausgeblichene Linien und **Sonnenflecken durch das Laub**, die sich langsam im Wind bewegen
2. **Kulisse hinter dem Zaun:**
   - eine **Foto-Platte** (frontale Ansicht von Schule, Linden und Autos) mit leichter Parallaxe
   - **Quelle:** eigene Fotos ohne Personen oder Fotos unter CC BY-SA mit Namensnennung (zum Beispiel von Axel Hindemith auf Wikimedia Commons). Kennzeichen und Personen werden unkenntlich gemacht.
3. **Zaun und Tore:** realistisch gezeichnet (dünne Stabmatten, Pfosten, Streben), halbtransparent. Die Fußballtore im Zaun und die roten Hockeytore kommen als realistische Objekte dazu.
4. **Figuren und Effekte im Comicstil:**
   - Tuschekontur und Cel-Farben (`src/world/toon/`)
   - **Verankerung in der echten Welt:** weicher Kontaktschatten auf dem Asphalt, Figuren im Laubschatten etwas dunkler, warme Sonnenflecken, die über die Figur wandern (wie bei Roger Rabbit)
5. **Rechte und Datenschutz:**
   - Fotos mit Kindern dienen **nur als Vorlage** und kommen nicht ins Repository.
   - Kartendienst-Bilder (Google) werden nicht als Asset verwendet.
   - Amtliche Luftbilder (LGLN) nur nach Klärung der Lizenz.

**Stand des Prototyps** (`studio.html`, Code in `src/world/toon/ink.js`, `src/world/toon/bonny.js`)
- Bonny als Modellblatt: Vorder-, Seiten- und Rückansicht, 6 Gesichtsausdrücke, 7 Aktionsposen (Stand, Laufen, Sprint, Ausholen, Schuss, Jubel, Sturz)
- Vorschau in Spielgröße auf Boni-Asphalt mit Sonnenflecken und Kontaktschatten
- **Noch offen:**
  - Die Posen sind noch zu steif für den Franquin-Schwung (mehr Linienschwung, Stauchen und Strecken).
  - Beim Spiegeln muss die Rückennummer getrennt gezeichnet werden.
  - Das Brustwappen ist noch zu schlicht.
  - Ins Spiel eingebaut ist Bonny noch nicht (Schritt 3).

**Nachtrag: Banden**
Banden sind ausdrücklich erlaubt.
- **Spiel:** Die Physik nutzt sie heute schon (Abpraller, Bandenspiel) und bleibt so.
- **Optik:** Auf dem Boni wird daraus eine **mobile Inlinehockey-Bande**. Sie steht innerhalb des Stabmattenzauns auf dem Asphalt, mit abgerundeten Ecken, so wie Vereine sie für Turniere aufbauen. Sie wird realistisch dargestellt: helle Kunststoff-Elemente mit sichtbaren Verbindungsstellen, Vereins- und Sponsorenflächen im Borstentiere-Grün und leichten Gebrauchsspuren. Der Zaun bleibt dahinter sichtbar.
