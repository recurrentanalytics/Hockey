# Die Häuser des Viertels – Stilblatt (H1)

Stand: Probe an einem Haus (Bonifatiusplatz 3), **wartet auf Freigabe**. Noch nichts ist ausgerollt.

## Grundsatz

Ein Haus hat zwei Schichten, und sie kommen aus verschiedenen Quellen:

| Schicht | Quelle | Wo |
|---|---|---|
| **Form:** Grundriss, Traufe, Dachform, First, Brandwände, Durchfahrten, Straßen- und Hofseite | Geodaten (ALKIS, OSM), feste Regeln | `src/welt/haeuser.js`, oberer Teil |
| **Zeichnung:** Fassade, Fenster, Türen, Dachziegel, Schornsteine, Putz | **SpriteCook-Sprites** | `assets/welt/haeuser/`, Bausatz `bausatz.json` |

Die erste Fassung von H1 zeichnete auch Fenster, Türen und Ziegel im Shader. Das Ergebnis war klotzig und beliebig und ist als Zielstil **verworfen**. Der Code dafür steckt noch in `haeuser.js` und ist nur hinter `?haeuser=neu` zu sehen; er zeigt die Form der Häuser, die noch keinen Bausatz haben. Neue sichtbare Gestaltung entsteht nicht mehr im Shader.

## Der Bausatz

Eine von SpriteCook gezeichnete Fassade wird in senkrechte Streifen zerlegt und für jede echte Wand neu gesetzt:

| Teil | Bedeutung |
|---|---|
| `links`, `rechts` | Randachsen mit der Hauskante |
| `achsen` | schlichte Fensterachsen, die sich abwechseln |
| `mitte` | das Stück mit Haustür und Balkonen, einmal je Haus, an der längsten Straßenfront |
| `pfeiler` | die Wandspalte zwischen zwei Fenstern; zu kurze Wände tragen nur sie, so laufen Gesimse und Sockel um jede Ecke |

Regeln:

- Kein Pixel der Fassade wird skaliert. Die Achsen stehen nebeneinander wie gezeichnet; die fertige Reihe wird höchstens um wenige Prozent auf die Wandlänge gezogen (im Test: unter 6 %).
- Die Bildhöhe ist die Traufhöhe. Ein Bausatz passt deshalb nur auf Häuser mit seiner Geschosszahl.
- Brandwände zeigen Putz, Dächer Ziegel, beide als Kachel.
- Schornsteine sind kleine Körper mit dem Sprite auf jeder Seite, Dachfenster liegen in der Dachfläche.
- Aus der Ferne übernehmen die kleineren Stufen der Textur, aus der Nähe bleiben die Pixel hart.

## Maßstab

Die Pixeldichte ist eine Eigenschaft des einzelnen Bildes und steht im Bausatz (`px_je_m`). SpriteCook liefert sie nicht auf Bestellung: Derselbe Auftrag kam mit 12,5 und mit 24,7 Pixeln je Meter zurück.

| Bild der Probe | Pixel je Meter |
|---|---|
| Fassade `gruenderzeit-a.png` | 24,7 (316 px für 12,8 m) |
| Schornstein, Dachfenster | wie die Fassade |
| Putz | wie die Fassade |
| Dachziegel | 56 (ein Ziegel etwa 45 cm breit; bewusst größer als echt, damit man ihn liest) |

**Offene Entscheidung:** Der Weltplan nennt 16 Pixel je Meter für die Umgebung. Die gewählte Fassade hat 24,7. Entweder gilt künftig rund 25 für Häuser, oder Fassaden werden so lange erzeugt, bis eine bei 16 liegt.

## Licht

Die Sprites tragen ihr eigenes Licht von links oben. Dazu kommen drei Stufen je nach Seite zur Sonne (100 / 92 / 82 %, Dächer 100 / 93 / 84 %), damit Vorder- und Rückseite auseinanderzuhalten sind. Die Stärke folgt dem Umweltmodul; ein Wechsel von Uhrzeit oder Wetter ändert drei Zahlen und baut nichts neu.

## Für weitere Bausätze

- Auftrag wie in `docs/art/prompts/haus.md`: strikte Frontansicht, nur die Wand von Sockel bis Traufgesims, kein Dach, kein Himmel, freigegebene Assets als Stilreferenz.
- Nach der Erzeugung ausmessen: Pfeilermitten (dort wird geschnitten), sichtbare Ränder, Bildhöhe gegen Traufhöhe. Erst dann den Bausatz schreiben.
- Ein Bausatz je Geschosszahl und Haustyp, die Wandfarbe später als Tauschfarbe, damit ein Bausatz mehrere Häuser bedient, ohne dass die Straße einfarbig wird.
