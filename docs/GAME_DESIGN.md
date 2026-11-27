# BORSTENBOOM! – Spieldesign und Vision

Stand: 27. November 2026. Fasst die Vision zusammen und verbindet sie mit dem, was schon gebaut ist. Was davon umgesetzt ist, steht in [ROADMAP.md](ROADMAP.md).

> **Hinweis:** Dieses Repository ist öffentlich. Die Figuren sind hier bewusst neutral beschrieben. Die echte Familiengeschichte mit Namen liegt nur in einer privaten Notiz außerhalb des Repos (siehe Abschnitt 11).

---

## 1. Die Idee in einem Satz

Ein Sport- und Familienabenteuer an echten Orten: fotorealistische Welt, darüber eine liebevolle Pixelart-Spielwelt, in der Wetter, Jahreszeit und Licht nicht nur zu sehen, sondern zu spüren sind. Es beginnt klein auf dem Bonifatiusplatz in Hannover-List und kann groß werden.

## 2. Leitlinien

1. **Echte Orte, eigene Figuren.** Die Kulisse ist echt (Geodaten, 3D-Kacheln, Luftbilder). Alles Lebendige ist Pixelart: Kinder, Ball, Bonny, Effekte. Diese Trennung ist der Stil des Spiels und bleibt.
2. **Die Welt spielt mit.** Regen macht den Platz rutschig, Herbstlaub ebenso, Wind trägt den Ball, die Sonne wirft echte Schatten. Was man sieht, spürt man (siehe [ENVIRONMENT_SYSTEM.md](ENVIRONMENT_SYSTEM.md)).
3. **Wild, aber steuerbar.** Kindgerecht, chaotisch im guten Sinn, nie frustrierend. Stürze sind lustig, nicht strafend.
4. **Erst ein Ort, richtig gut.** Der Boni wird zum Archetyp, bevor ein zweiter Ort kommt.
5. **Die Familie erzählt.** Die Geschichte beruht auf echten Erlebnissen und wächst mit dem Spielen.
6. **Deutsch, warm, ein bisschen episch.** Wie der Introtext: „Eine kleine Kugel im All … und doch so groß.“
7. **Kein vorgegebenes Endziel.** Es gibt keine Karriereleiter, an deren Ende erst das „richtige“ Spiel beginnt (Abschnitt 3).

---

## 3. Spielphilosophie: Lebenswege statt Karriereleiter

Eine der wichtigsten Grundentscheidungen des Projekts.

- **Die NHL ist eine mögliche Geschichte, kein Ziel.** Wer dorthin will, kann sich auf den Weg machen. Wer nicht, verpasst nichts.
- **Leistungssport und Freizeit-Hockey sind gleichwertig.** Ein Abend in der Beer League, Street Hockey vor der Haustür und ein Endspiel im Verein haben im Spiel denselben Wert.
- **Vereinswechsel, Pausen und neue Interessen sind keine Niederlagen.** Wer ein Jahr nicht spielt und dann zurückkommt, hat etwas erlebt, nicht etwas verloren.
- **Viele Wege nebeneinander.** Inlinehockey, Eishockey, Beer League, Street Hockey und ganz andere Abenteuer (Skaten ohne Schläger, Reisen, Entdecken) existieren gleichzeitig und dürfen gewechselt werden.
- **Das Spiel bewertet nicht, welcher Lebensweg der beste ist.** Keine Rangliste der Lebenswege, kein „Game over“, wenn jemand aufhört, keine Belohnung nur für Aufstieg.
- **Die Chronik sammelt Erlebnisse, Beziehungen und Erinnerungen,** nicht nur sportliche Erfolge: der erste Sturz, ein neuer Freund im Team, ein verregnetes Training, ein Ausflug, ein Abschied.

Folgen für Design und Technik:

| Entscheidung | Folge |
|---|---|
| Keine Leiter | Fortschritt ist ein **Netz aus Orten, Fertigkeiten und Begegnungen**, kein Stufenmodell. Freigeschaltet wird durch Erleben, nicht nur durch Siegen. |
| Gleichwertige Wege | Sportarten und Spielformen teilen Welt, Umwelt und Figuren ([WORLD_ARCHITECTURE.md](WORLD_ARCHITECTURE.md), [ENVIRONMENT_SYSTEM.md](ENVIRONMENT_SYSTEM.md)). Keine Sportart ist das „Hauptspiel“ und die anderen „Minispiele“. |
| Pausen sind erlaubt | Der Spielstand verfällt nicht. Wer lange nicht gespielt hat, wird mit einer Albumseite begrüßt, nicht mit Verlusten. |
| Erinnerungen zählen | Das Familienalbum (Abschnitt 7) ist der eigentliche Fortschrittsspeicher. Siege sind eine Art von Eintrag unter vielen. |
| Keine Wertung | Texte und Kommentare loben Erlebnisse, nicht nur Leistung. Thorsten und Mama kommentieren einen Regentag mit Freunden genauso gern wie einen Turniersieg. |

---

## 4. Was heute schon da ist

- **Spiel:** vollwertiges Inlinehockey mit KI, Regeln, Turnier, Training und 2 Spielern. Der Spielkern ist der stärkste Teil des Projekts.
- **Verein:** die Boni Borstentiere sind fest eingebaut, mit ihren Teams (Borstentiere, Balding Borstis), Maskottchen Bonny (Wildschwein, Nummer 61), Hymne als Torsong und Kommentar von „Thorsten“.
- **Ort:** der echte Boni in 3D, mit Wetter, Jahreszeiten, Licht und Untergrundphysik.
- **Intro:** Flug vom Planeten auf den Boni mit gesprochener Erzählung.

Noch nicht da: Charaktere mit eigener Geschichte, Fortschritt, Familienalbum, weitere Orte, weitere Sportarten.

---

## 5. Charaktere

> Die Figuren beruhen auf einer echten Familie. Hier stehen sie neutral; echte Namen werden nur auf dem Gerät eingetragen. Vorschläge sind als **Vorschlag** markiert und brauchen die Zustimmung der Familie.

| Figur | Rolle im Spiel | Kern |
|---|---|---|
| **Kind A („Hockeyherz“)** | spielbar | Fängt sofort Feuer für Hockey. Der Weg kann vom Boni in einen Verein in der Region führen und von dort weiter, wohin auch immer (Abschnitt 3). |
| **Kind B („eigener Weg“)** | spielbar | Bekommt **eine eigene** Geschichte, keine Kopie des Hockeywegs von Kind A. Vorschlag: etwas Eigenes auf denselben Rollen (zum Beispiel Kunst- oder Freestyle-Skaten, Tricks, Choreografien) oder die Entdeckerin, die neue Orte findet. Die Entscheidung liegt bei der Familie, am besten beim Kind selbst. |
| **Papa** | Auslöser, Nebenfigur | Hat die spontane Idee, Inline-Skaten zu lernen. Ungeschickt, mutig, Grund für viele komische Stürze. |
| **Mama** | Chronistin | Hält die Reise fest. Sie kommentiert die Einträge im Familienalbum (Abschnitt 7). |
| **Bonny** | Maskottchen | Jubelt bei Toren, tröstet nach Stürzen, Bindeglied zum Verein. |
| **Thorsten** | Stimme | Erzähler und Kommentator (freie Piper-Stimme). |

**Fähigkeiten und Fortschritt** (Vorschlag): Statt Zahlenwerten wachsen sichtbare Fertigkeiten: sicher bremsen, übersetzen, rückwärts fahren, Pass, Schuss, Trick. Jede Fertigkeit wird auf dem Boni in kleinen Aufgaben gelernt und schaltet Bewegungen frei, die die vorhandene Posen-Bibliothek (`src/world/figures.js`, 37 Posen) schon kennt. Kind B kann andere Fertigkeiten haben als Kind A. Fertigkeiten gehen nicht verloren, auch nicht nach einer Pause.

**Charaktereditor** (später): Name, Haarfarbe, Helm, Trikot, Rückennummer. Die Figurenzeichnung ist bereits parametrisiert (Teams, Haare, Glatze, Brille in `config.js` und `sprites.js`). Ein Editor ist vor allem eine neue Menüszene. Hier werden auch die echten Namen eingetragen, nur lokal gespeichert.

---

## 6. Prolog

Das Intro ist schon eine Zeitleiste mit Kameraflug, Text, Stimme und Einblendungen (`src/intro/photoreal.js`). Der Prolog erweitert sie, ohne eine neue Engine zu bauen.

| # | Station | Umsetzung mit Vorhandenem |
|---|---|---|
| 1 | Die Erde aus dem Weltraum | vorhanden (`ZOOM`, Station `planet`) |
| 2 | Zoom nach Europa, Deutschland, Hannover | vorhanden (Umriss, Nadeln); Europa als zusätzliche Station |
| 3 | Anflug auf den Boni | vorhanden |
| 4 | Der gewählte Charakter allein auf dem Platz | neu: eine **Spielszene ohne Spiel**. Die Spielschicht kann Figuren schon ohne Match zeichnen (`Backdrop` in `src/scenes/backdrop.js` zeigt fahrende Figuren hinter den Menüs). |
| 5 | Montage: misslungene Versuche, Stürze, Frust | neu: kurze Skriptfolgen mit vorhandenen Posen (Sturz `downT`, Bremsen, Gleiten) und Partikeln. Wetter für Stimmung setzbar (`env.set`). |
| 6 | Kurz vor dem Aufgeben | Kamera nah, Erzählzeile, Musik leiser |
| 7 | Rückblende: Papas Idee | Farbfilter „früher“ (CSS-Filter oder Post-Processing wie heute), anderes Datum und Wetter über das Umweltsystem; Papa als Figur |
| 8 | Die Familie beginnt gemeinsam | mehrere Figuren gleichzeitig, wie beim Jubel |
| 9 | Rückkehr in die Gegenwart | Filter aus, Wetter wieder live |
| 10 | Der Spieler übernimmt | Übergang in eine erste Lernaufgabe statt direkt ins Spiel |

**Technischer Vorschlag:** Die Zeitleiste wird eine Liste von Szenen-Bausteinen (`kamera`, `text`, `stimme`, `figuren`, `umwelt`, `filter`), die in `src/intro/zeitleiste.js` abgespielt werden. Die heutigen Konstanten `ZOOM`, `T` und `STORY` werden zu den ersten Einträgen dieser Liste. Neue Stimmen entstehen mit `tools/voice/make_voice.py`.

Wichtig: Der Prolog kommt nur einmal und bleibt überspringbar. Danach startet das Spiel wie heute schnell. Die Botschaft des Prologs passt zur Philosophie: Es geht ums gemeinsame Anfangen, nicht ums Gewinnen.

---

## 7. Das Familienalbum

**Idee:** Ein Album, das sich beim Spielen von selbst füllt. Besondere Momente werden zu Seiten mit einer kleinen Pixel-Szene, Datum, Ort, Wetter und einem Satz von Mama. Es sammelt Erlebnisse, Beziehungen und Erinnerungen, nicht nur Erfolge.

| Auslöser | Beispiel-Eintrag (Namen kommen vom Gerät) |
|---|---|
| erster Sturz | „Der erste Sturz. Und gleich wieder aufgestanden.“ |
| erstes Tor | „{Name}s erstes Tor auf dem Boni. Bei Nieselregen, 9 °C.“ |
| neue Fertigkeit | „Heute hat {Name} zum ersten Mal rückwärts gebremst.“ |
| Spiel bei besonderem Wetter | „Schneehockey! Der Ball blieb ständig liegen.“ |
| gemeinsames Spiel | „Zu dritt auf dem Boni, bis es dunkel wurde.“ |
| neuer Ort | „Zum ersten Mal auf einem neuen Platz.“ |
| Pause und Rückkehr | „Lange nicht hier gewesen. Der Boni hat gewartet.“ |
| Jahrestag | „Vor einem Jahr hat Papa gesagt: Lass uns Inlineskaten lernen.“ |

Anbindung an Vorhandenes:

- **Ereignisse** liefert das Spiel schon: `match.events` (Tor, Sturz `slip`, Pfosten, Parade, Strafe, Sieg) in `src/scenes/rink.js`. Erlebnisse ohne Spiel (Ausflug, gemeinsames Fahren, Rückkehr nach Pause) brauchen eigene Auslöser.
- **Bild:** Die Pixel-Szene kann ein Ausschnitt der Spielebene im Moment des Ereignisses sein (Canvas-Kopie) oder eine eigens gestellte Szene mit den Figuren.
- **Wetter und Ort** kommen aus dem Umweltsystem (`env.state`, `env.air`).
- **Speicher:** nur lokal über `src/engine/storage.js` (neuer Schlüssel `album`). Später als Bild oder PDF exportierbar.
- **Mamas Stimme:** Thorsten ist eine männliche Stimme. Für Mama braucht es eine eigene. Piper hat weitere deutsche Stimmen; deren Lizenz und Qualität müssen vor der Nutzung geprüft werden. Alternativ liest Mama selbst ein, wenn sie mag (Aufnahmen nicht im öffentlichen Repo).

Das Album ist der emotionale Kern, der Sport, Orte und Familie verbindet. Technisch ist es klein: eine Menüszene, ein Speicherschlüssel und eine Liste von Auslösern.

---

## 8. Orte und Reise

1. **Der Boni** – erster Archetyp, Heimat, Lernort.
2. **Weitere Orte in Hannover** – Trainingsorte und Plätze befreundeter Vereine.
3. **Ein Vereinsort in der Region** – wo ein Weg weitergehen kann, aber nicht muss.
4. **Turnierorte, Eishallen, Street-Hockey-Plätze, Ausflugsziele** – gleichwertig nebeneinander.
5. **Ferne Orte** – große Arenen, andere Länder, wenn eine Geschichte dorthin führt.

Die Erdkugel des Intros wird zur Weltkarte („Die Reise der roten Kugel“). Technisch siehe [WORLD_ARCHITECTURE.md](WORLD_ARCHITECTURE.md).

## 9. Sportarten und Spielformen

| Form | Stand | Was sie braucht |
|---|---|---|
| Inlinehockey | vorhanden | – |
| Freies Skaten, Lernaufgaben | Vorschlag | Aufgaben-Szenen, keine Regeln, Fertigkeiten |
| Street Hockey, Beer League (lockere Spiele) | Idee | vorhandener Spielkern mit lockeren Regeln, andere Teams und Orte |
| Kunst- oder Freestyle-Skaten (Kind B, Vorschlag) | Idee | Bewertung von Tricks statt Toren, Musik |
| Eishockey | lange Vision | Profil `kufen`, Eisfläche, andere Maße (60 × 30 m, die Halle hat sie schon), Bodycheck-Regeln (ISHD-Regeln gibt es schon in `rules.js`) |

Die Hallenversion (`index.html`) hat bereits die Maße eines Eishockeyfelds (60 × 30 m) und Regeln mit Bodycheck. Sie ist ein guter Ausgangspunkt für spätere Eishockey-Versuche.

## 10. Fortschritt als Netz

```
                 ┌──── Verein ──── Turniere ──── Eis ──── (große Arena?)
erste Versuche ──┼──── Street Hockey ──── Beer League
 (Boni, Prolog)  ├──── Tricks, Freestyle ──── Auftritte
                 └──── Entdecken ──── neue Orte ──── Reisen
        ▲                       │
        └── Pausen, Rückkehr, Wechsel: jederzeit möglich ◄──┘
```

Jeder Weg hinterlässt Albumseiten. Wege lassen sich wechseln, ohne etwas zu verlieren. Fortschritt wird lokal gespeichert. Ein Konto oder Online-Funktionen sind nicht nötig.

---

## 11. Datenschutz und Öffentlichkeit

Das Repository `recurrentanalytics/hockey` ist **öffentlich**, ebenso die Seite auf GitHub Pages. Alles, was im Repo steht, kann jeder lesen und kopieren.

- **Im öffentlichen Repo nur neutrale Figuren.** Keine echten Namen der Kinder, keine Vereine der Familie, keine Fotos, Geburtsdaten, Schulen oder Adressen.
- **Die echte Familiengeschichte** (Namen, Verein, persönliche Albumtexte) liegt in einer privaten Notiz außerhalb des Repositorys.
- **Echte Namen im Spiel** werden nur auf dem Gerät eingetragen (Charaktereditor) und nur dort gespeichert. So erscheinen sie weder im Code noch auf GitHub Pages.
- **Das Familienalbum** speichert nur lokal.
- **Stimmaufnahmen von Kindern** nur mit Einverständnis und nie im öffentlichen Repo.
- **Für Kinder aus dem Verein** gilt wie bisher: nur Vor- oder Spitznamen, Einverständnis der Eltern (siehe [ROADMAP.md](ROADMAP.md)).
- **Git vergisst nicht von selbst.** Was einmal gepusht war, muss aus der Historie entfernt werden; Kopien oder Forks lassen sich danach trotzdem nicht ausschließen. Deshalb gehören persönliche Angaben gar nicht erst ins Repo.
