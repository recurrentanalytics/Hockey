# BORSTENBOOM! – Geräte- und Leistungstest (Phase 0.3)

Ziel: herausfinden, wie flüssig das Spiel auf echten Tablets und Handys läuft und wie viel Luft für mehr Grafik bleibt. Es geht um ein **stabiles, flüssiges** Spielgefühl, nicht um möglichst hohe Zahlen. **Erst messen, dann entscheiden:** Während dieses Tests wird nichts optimiert und nichts an der Grafik verändert.

---

## 1. Vorbereitung (einmalig)

**Was du brauchst:** das Gerät, geladen oder am Netz, WLAN, dieses Blatt oder die Tabelle in Abschnitt 4 und etwa 30 Minuten.

**Zwei Wege, die Anzeige einzuschalten:**

| Weg | So geht's |
|---|---|
| **Im Browser** (Chrome auf dem Gerät) | An die Adresse `?fps` anhängen, zum Beispiel `https://recurrentanalytics.github.io/Hockey/intro.html?fps`. Beim ersten Mal fragt das Spiel nach dem Cesium-Token. |
| **In der App** (ab Version 0.9) | **Lange auf das App-Symbol drücken** → „Leistungstest“ antippen. Die App startet mit Anzeige. Normal über das Symbol gestartet, bleibt die Anzeige aus. |

Die Messwerte von Chrome und App sind vergleichbar, denn beide nutzen dieselbe Browser-Technik von Android. Wenn möglich, beide einmal messen (Szenario A und B1).

**Vor jeder Messung:**

1. Andere Apps schließen.
2. Energiesparmodus aus.
3. Helligkeit mittel.
4. Das Gerät sollte nicht heiß sein. Nach 10 Minuten Spielen kurz Pause machen, sonst bremst sich das Gerät selbst und die Werte werden schlechter.
5. Gerät quer halten.

## 2. Die Anzeige lesen

Oben links erscheint ein dunkler Kasten. Der Knopf **„Neu messen“** setzt alle Werte auf null. **„Details“** zeigt zusätzlich Bildschirm, 3D und Grafikchip. Auf kleinen Bildschirmen ist das anfangs eingeklappt.

```
FPS  60   Ø 58.9   1%-Low 41
Bild 16.7 ms (Median)  99% 22.1 ms  max 96 ms
Ruckler 1.2 %   Hänger >100 ms: 0   Takt ~60 Hz
Messzeit 0:30   Bilder 1767
Bildschirm 1280×800  Fenster 1280×800  DPR 2          ← nur mit „Details“
Spiel-Canvas 2560×1600
3D 2048×1280  Faktor 0.8  MSAA 1  Schatten an
3D zeichnet nur bei Bedarf: 0/s   Kacheln geladen
GPU Adreno (TM) 650
Szene RinkScene  Platz: trockener Platz
```

| Wert | Bedeutung | gut | Grenzbereich | überlastet |
|---|---|---|---|---|
| **FPS** | Bilder in der letzten Sekunde | stabil nahe dem Takt (meist 60) | schwankt um 45–55 | unter 45 |
| **Ø** | Durchschnitt seit „Neu messen“ | ≥ 55 | 45–55 | < 45 |
| **1%-Low** | Bildrate in den langsamsten 1 % der Bilder: wie schlimm die schlechtesten Momente sind | ≥ 40 | 25–40 | < 25 |
| **Bild … (Median)** | normale Dauer eines Bildes | 16,7 ms (bei 60 Hz) | – | – |
| **99 %** | so lange dauern 99 % aller Bilder höchstens | ≤ 25 ms | 25–40 ms | > 40 ms |
| **Ruckler** | Anteil der Bilder, die deutlich länger als üblich dauern | < 2 % | 2–5 % | > 5 % |
| **Hänger >100 ms** | spürbare Aussetzer (Bild steht kurz) | 0 | 1–2 pro Minute | mehr |
| **Takt** | erkannter Bildtakt des Geräts (60, 90, 120 Hz …) | – | – | – |
| **3D zeichnet** | wie oft die 3D-Welt neu gezeichnet wird; im Spiel meist 0/s, weil sie still steht | – | – | – |

**Woran man Ruckeln auch ohne Zahlen erkennt:** Figuren oder Ball springen statt zu gleiten. Die Kamera zuckt beim Torflug. Die Eingabe fühlt sich verzögert an. Kurze Standbilder treten auf. Das Gerät wird heiß, oder die Bildrate fällt nach einigen Minuten. Bitte in der Tabelle unter „Eindruck“ notieren, auch wenn die Zahlen gut aussehen.

**Bei Geräten mit 90 oder 120 Hz:** Dort kann FPS höher als 60 sein. Läuft das Spiel stabil mit 60, ist das trotzdem flüssig. Die Ruckler-Zählung berücksichtigt das.

---

## 3. Die Szenarien

Startadresse für alle Browser-Messungen: `https://recurrentanalytics.github.io/Hockey/`
Ablauf je Szenario: **vorbereiten → „Neu messen“ tippen → Messzeit laufen lassen → Werte ablesen → eintragen.**

Wetter einstellen (C1 bis C5): oben links **⛅** antippen → **„Wählen“** → Wettersymbol antippen → Uhrzeit-Regler setzen → ⛅ wieder antippen, damit das Menü schließt.

### A – Intro

| # | Adresse | Was tun | Messen | Notieren |
|---|---|---|---|---|
| A1 | `intro.html?fps` (App: Kurzbefehl „Leistungstest“) | Seite öffnen. Sobald die Erde zu sehen ist, „Neu messen“ tippen. Nichts antippen, bis der Titel „BORSTENBOOM!“ erscheint. | ganzes Intro, ca. 30 s | Ø, 1%-Low, 99 %, Ruckler, Hänger; Details: 3D-Auflösung, Faktor |
| A2 | wie A1, neu laden | Wenn die Nadel „Boni“ erscheint, „Neu messen“ tippen. Messen bis zum Titel (Kamera kippt in die Spielansicht). | ca. 10 s | wie A1 |

Hinweis: Beim **ersten** Öffnen lädt das Gerät viele 3D-Kacheln. Das gibt meist Hänger. Bitte A1 zweimal messen und beide Werte notieren (1. und 2. Durchgang).

### B – Spielbetrieb

| # | Adresse | Was tun | Messen | Notieren |
|---|---|---|---|---|
| B1 | `intro.html?quick&fps` | „Spiel starten“ → „Gegen KI“ → „Los gehts“. Nach dem ersten Bully „Neu messen“. Ruhig spielen, normal laufen und passen. | 60 s | alle Werte |
| B2 | wie B1 | Viel Bewegung: hinter dem Ball her, alle Figuren in einer Ecke, Schüsse, Zweikämpfe. | 60 s | alle Werte |
| B3 | `index.html?fps` (**Halle**, siehe E) | Spiel starten. In der Halle bewegt sich die Kamera mit dem Ball: schnell von Tor zu Tor spielen. | 60 s | alle Werte |

Auf dem echten Boni steht die Kamera fest. Schnelle Kamerabewegungen gibt es dort nur beim Torflug (D2). B3 deckt die mitfahrende Kamera der Halle ab.

### C – Umwelt (jeweils im laufenden Spiel wie B1)

| # | Einstellung im ⛅-Menü („Wählen“) | Was tun | Messen | Notieren |
|---|---|---|---|---|
| C1 | ☀️ Sonne, Sommer, 13:00 | normal spielen | 30 s | alle Werte, „Schatten an/aus“ (Details) |
| C2 | ☁️ Wolken, 13:00 | normal spielen | 30 s | wie C1 |
| C3 | 🌧️ Regen, 17:00 | normal spielen (Regen fällt über dem Bild) | 30 s | wie C1 |
| C4 | ❄️ Schnee, Winter, 13:00 | normal spielen | 30 s | wie C1 |
| C5 | ☀️ Sonne, 23:00 (Nacht, Laternen) | normal spielen | 30 s | wie C1 |
| C6 | ☀️ Sonne, **Herbst**, 15:00 | normal spielen (bunte Bäume, Laub) | 30 s | wie C1 |

Direkt nach dem Umschalten zeichnet die 3D-Welt einmal neu. Deshalb erst nach 2–3 Sekunden „Neu messen“ tippen.

### D – Belastung

| # | Einstellung | Was tun | Messen | Notieren |
|---|---|---|---|---|
| D1 | ☀️ Sonne, 13:00 | Direkt vor einem Torschuss „Neu messen“ tippen. Tor schießen, Jubel mit „TOOOR!“ und Konfetti abwarten. | bis der Jubel vorbei ist, ca. 8 s | 1%-Low, max, Hänger, Ruckler |
| D2 | ☀️ Sonne, 13:00 | wie D1; achten auf den **Kameraflug um den Platz** nach dem Tor | ca. 8 s | wie D1, dazu „3D zeichnet …/s“ während des Flugs |
| D3 | 🌧️ Regen oder ❄️ Schnee | wie D1: Tor bei Regen (Regentropfen, Konfetti, alle Figuren jubeln) | ca. 8 s | wie D1 |

Tipp für schnelle Tore: Im Spielaufbau (vor „Los gehts“) die Schwierigkeit auf „Kids“ stellen.

### E – Halle zum Vergleich (ohne 3D)

| # | Adresse | Was tun | Messen | Notieren |
|---|---|---|---|---|
| E1 | `index.html?fps` | Spiel gegen KI starten, ruhig spielen | 60 s | alle Werte |
| E2 | `test.html?fps` (Testplatz: Boni-Regeln, flach) | Spiel gegen KI starten | 60 s | alle Werte |

E zeigt, was das Spiel ohne Cesium und Google-Kulisse kostet. Der Unterschied zu B1 ist die Last der 3D-Welt.

---

## 4. Tabelle zum Eintragen

Je Gerät eine Tabelle. Gerätedaten aus „Details“ einmal oben eintragen.

**Gerät:** ____________  **Android-Version:** ____  **App oder Chrome:** ____  **Takt:** ___ Hz  **DPR:** ___  **GPU:** ____________
**Spiel-Canvas:** ________  **3D-Auflösung / Faktor:** ________ / ___

| # | Ø FPS | 1%-Low | 99 % ms | Ruckler % | Hänger | Eindruck (flüssig / leicht ruckelig / ruckelig) | Bemerkung |
|---|---|---|---|---|---|---|---|
| A1 (1.) | | | | | | | |
| A1 (2.) | | | | | | | |
| A2 | | | | | | | |
| B1 | | | | | | | |
| B2 | | | | | | | |
| B3 | | | | | | | |
| C1 Sonne | | | | | | | Schatten: |
| C2 Wolken | | | | | | | |
| C3 Regen | | | | | | | |
| C4 Schnee | | | | | | | |
| C5 Nacht | | | | | | | |
| C6 Herbst | | | | | | | |
| D1 Tor | | | | | | | |
| D2 Torflug | | | | | | | 3D/s: |
| D3 Tor bei Regen | | | | | | | |
| E1 Halle | | | | | | | |
| E2 Testplatz | | | | | | | |
| Gerät nach dem Test warm? | | | | | | | ja / nein |

Ein Foto der ausgefüllten Tabelle oder Bildschirmfotos der Anzeige genügen als Rückmeldung.

---

## 5. Wie gemessen wird (technisch)

- **Modul:** `src/diag/fps.js`. Es wird nur geladen, wenn die Adresse `fps` enthält (je eine Zeile in `index.html`, `test.html`, `intro.html`). Ohne `?fps` existiert es im Spiel nicht. Das ist geprüft: kein Abruf, kein Element, keine Fehler.
- **Bildabstand:** Ein eigener `requestAnimationFrame`-Takt misst die Zeit zwischen zwei ausgegebenen Bildern. Spiel-Canvas und Cesium zeichnen im selben Takt des Browsers. Der Wert erfasst also die Gesamtlast.
- **Speicher:** Ringpuffer mit 8 192 Werten (über 60 s bei 120 Hz). Ausgewertet und angezeigt wird einmal pro Sekunde (Sortieren einer Zahlenliste, unter einer Millisekunde).
- **Kennzahlen:**
  - **FPS:** Bilder der letzten Sekunde.
  - **Ø:** Bilder geteilt durch die gemessene Zeit.
  - **1%-Low:** 1000 geteilt durch die mittlere Dauer der langsamsten 1 % der Bilder.
  - **99 %:** 99. Perzentil der Bilddauer.
  - **Ruckler:** Bilder, die länger als das 1,5-Fache des Grundtakts dauern. Grundtakt ist das Maximum aus Median und Display-Intervall.
  - **Hänger:** Bilder über 100 ms.
- **Bildwiederholrate:** Der Takt wird aus dem schnellen Ende der Verteilung (10. Perzentil) geschätzt und auf übliche Raten gerundet (60, 90, 120 … Hz). Weil Ruckler am Median gemessen werden, gilt ein 120-Hz-Gerät, das stabil 60 Bilder zeigt, als flüssig. Mit künstlichen Daten geprüft: 0 % Ruckler bei stabilen 60 Bildern auf 120 Hz, 3,2 % bei 120 Hz mit 3 % Aussetzern.
- **Hintergrund und Pausen:** Ist die Seite verborgen (Tab gewechselt, Bildschirm aus), wird nicht gezählt. Das erste Bild danach wird verworfen. Die Lücke gilt also nicht als Hänger. Die Anzeige zählt sie unter „Pausen“. Geprüft: 3 s verborgen erhöhten die Messzeit nicht.
- **3D-Zustand:** gelesen aus `window.introDebug.viewer` (Cesium):
  - Zeichenfläche und Auflösungsfaktor, MSAA, Schatten
  - Zeichenmodus („nur bei Bedarf“ oder „durchgehend“)
  - gezeichnete 3D-Bilder pro Sekunde (über `scene.postRender`)
  - Kachelstatus
- **GPU:** `WEBGL_debug_renderer_info` aus Cesiums eigenem WebGL-Kontext. Ohne 3D wird ein kurzlebiger Hilfskontext angelegt und sofort wieder freigegeben. Manche Browser verbergen den Namen, dann steht dort „nicht auslesbar“.
- **Datenschutz:** Nichts wird gespeichert, protokolliert oder übertragen. Die Werte stehen nur auf dem Bildschirm.
- **Keine Wirkung auf das Spiel:** keine Änderung an Physik, Grafikqualität oder Rendering; keine automatische Qualitätsanpassung. Die Knöpfe der Anzeige halten ihre Berührungen vom Spiel fern. Geprüft: Die Szene bleibt beim Tippen unverändert.
- **App:** Der Kurzbefehl „Leistungstest“ (`android/app/src/main/res/xml/shortcuts.xml`) startet `MainActivity` mit einer eigenen Aktion. Die App lädt dann die Seite mit `?fps`, auch die mitgelieferte Kopie. Fällt das Intro auf die Halle zurück, bleibt `?fps` erhalten (`src/intro/main.js`).

## 6. Bekannte Einschränkungen der Messung

- **Hauptthread-Takt, nicht GPU-Zeit.** Gemessen wird, wann der Browser ein Bild ausgibt. Ist die GPU der Engpass, zeigt sich das als längere Bildabstände, aber ohne Aufschlüsselung, welcher Teil (Spiel, Cesium, Shader) die Zeit braucht. Dafür wären Entwicklerwerkzeuge nötig.
- **Cesium zeichnet im Spiel meist gar nicht.** Nach der Landung zeichnet die 3D-Welt nur bei Änderungen (Wetterwechsel, Torflug). Die 3D-Last zeigt sich deshalb vor allem in A und D2. Gleichmäßige Werte in B heißen nicht, dass die 3D-Welt billig ist.
- **Startphase:** Beim Laden entstehen Hänger (Shader übersetzen, Figuren zeichnen, Kacheln laden). Deshalb in jedem Szenario erst „Neu messen“ tippen, wenn es läuft. A1 im 1. Durchgang ist bewusst ein Start-Messwert.
- **Kurze Messungen schwanken.** Das 1%-Low beruht bei 8 Sekunden nur auf etwa 5 Bildern. D-Werte sind deshalb grob. Für B und E mindestens 60 s messen.
- **Wärme.** Nach mehreren Minuten kann das Gerät drosseln. Die Werte vom Anfang und Ende einer langen Sitzung unterscheiden sich dann.
- **Energiesparmodus und adaptive Bildrate** können den Takt auf 60 oder 30 Hz senken. Bitte notieren, falls eingeschaltet.
- **Die Anzeige selbst** kostet sehr wenig, aber nicht nichts (ein zusätzlicher Bildtakt, ein Text pro Sekunde).
- **Speicher und Akku** werden nicht gemessen.
- **Live-Wetter:** Ohne „Wählen“ hängt das Bild vom aktuellen Wetter ab (Schatten nur bei Sonne). Für vergleichbare Werte immer „Wählen“ nutzen.
- **Neue Version nötig:** Die Anzeige wirkt erst, wenn der neue Stand auf GitHub Pages veröffentlicht ist. Für die App braucht es dazu Version 0.9 (Kurzbefehl).
- **Werte aus der Entwicklungsumgebung** (Software-Rendering, ohne Grafikkarte) sagen über echte Geräte nichts aus und sind hier nicht aufgeführt.
