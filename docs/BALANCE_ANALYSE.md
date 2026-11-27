# BORSTENBOOM! – Balance-Analyse: 4,6 statt 7,5 Tore pro Spiel

Stand: 27. November 2026, Zweig `work/qa-infra`. **Reine Analyse: an Spielmechanik und Balance wurde nichts geändert.** Alle Zahlen sind mit den hier beschriebenen Werkzeugen reproduzierbar.

## 1. Ergebnis in drei Sätzen

- Die Abweichung ist **echt, nicht nur Messrauschen**: Der Stand der HANDOVER-Datei (`1733f5b`) liefert in derselben Messung 7,2 bis 7,5 Tore pro Spiel, der heutige Stand 4,6.
- **Ursache ist im Wesentlichen eine bewusste Änderung am Fahrgefühl**, Commit `3e2608f` („Skating feel“), und zwar vor allem die neue **seitliche Haftung** (`SKATE.grip = 4.5`). Ohne sie liegt der heutige Code wieder bei 6,8 Toren.
- Das ist **eine Entscheidung, kein Fehler**: Entweder wird das Ziel von „etwa 7,5“ auf „etwa 4,5 bis 5“ gesetzt, oder die Haftung wird abgeschwächt. Dafür liefert das Werkzeug unten die Messung.

## 2. Messmethode (reproduzierbar)

Gemessen wird kopflos in Node, ohne Browser, mit derselben Spielschleife wie `tests/simulation.test.mjs`.

| Einstellung | Wert |
|---|---|
| Spiele | 36, Seeds 1000 bis 1035 (jeder Lauf gibt immer dieselben Zahlen) |
| Mannschaften | Blazers gegen Waves, 4 Feldspieler, 2 Reihen, beide von der KI gespielt |
| Mischung | gleich verteilt auf World Skate, USARS, ISHD und auf die Stufen leicht, normal, schwer |
| Spielzeit | Drittel bzw. Hälften zu 5 Minuten (World Skate und USARS 10 min, ISHD 15 min) plus Verlängerung |
| Spielfeld | **Halle (60 × 30 m)**, ohne `BONI_3D`, neutraler Untergrund |

```sh
npm run balance -- --games 36                       # Bericht für den aktuellen Stand
npm run balance -- --games 36 --level normal        # nur eine Stufe (auch --ruleset, --periods, --seed)
npm run balance -- --games 36 --json                # maschinenlesbar
node tools/test/balance-history.mjs --games 18 1733f5b 3e2608f HEAD   # dieselbe Messung an alten Ständen
```

`balance-history.mjs` entpackt jeden Commit mit `git archive` in den Temp-Ordner. Der Arbeitsbaum bleibt unberührt.

**Wichtig zum Zielwert:** Die Dokumente nennen „etwa 7,5 Tore“ unterschiedlich. `HANDOVER.md` sagt *pro 10 Minuten*, der Test-Kommentar sagt *pro Spiel*. Die Messung passt zur Lesart **pro Spiel**: Der Stand `1733f5b` ergibt 7,2 bis 7,5 Tore pro Spiel (die Spiele dauern im Mittel 12 Minuten reine Spielzeit), das sind nur rund 5,8 bis 6,0 Tore je 10 Minuten.

## 3. Heutiger Stand (36 Spiele, `cc67530`)

| Gruppe | Spiele | Spielzeit/Spiel | Tore/Spiel (±SE) | Tore je 10 min | Torschüsse/Spiel | Trefferquote | Paraden |
|---|---|---|---|---|---|---|---|
| **alle** | 36 | 12,0 min | **4,58 ± 0,35** | 3,84 | 43,9 | 10,4 % | 89,6 % |
| World Skate | 12 | 10,6 | 4,17 ± 0,48 | 3,92 | 40,1 | 10,4 % | 89,6 % |
| USARS | 12 | 10,1 | 4,67 ± 0,72 | 4,60 | 38,8 | 12,0 % | 88,0 % |
| ISHD | 12 | 15,1 | 4,92 ± 0,57 | 3,26 | 52,7 | 9,3 % | 90,7 % |
| leicht | 12 | 11,8 | 5,50 ± 0,62 | 4,66 | 32,1 | 17,1 % | 82,9 % |
| normal | 12 | 12,1 | 5,25 ± 0,59 | 4,34 | 45,4 | 11,6 % | 88,4 % |
| **schwer** | 12 | 12,0 | **3,00 ± 0,24** | 2,51 | 54,1 | 5,5 % | 94,5 % |

Der Test meldet 4,61: Er zählt den einen Punkt für den Penaltysieger mit, das Werkzeug zählt nur Tore aus dem Spiel.

Weitere Kennzahlen: 63 Schussversuche pro Spiel (davon 44 aufs Tor), Pass-Ankunft 82 %, 6,6 Strafen und 169 Körperkontakte pro Spiel, 6,4 Pfostentreffer, 93 % der Uhrzeit ist Spielzeit.

**Trefferquote nach Schussentfernung:**

| Entfernung | Schüsse | Tore | Tore je Schuss |
|---|---|---|---|
| 0 bis 6 m | 266 | 39 | 0,147 |
| 6 bis 10 m | 1336 | 125 | 0,094 |
| 10 bis 14 m | 437 | **1** | 0,002 |
| ab 14 m | 82 | 0 | 0,000 |

Schüsse von außerhalb 10 m sind praktisch wirkungslos (1 Tor aus 519 Schüssen).

## 4. Wann ist es passiert? (18 Spiele je Stand, gleiche Seeds)

| Commit | Tore/Spiel | Tore je 10 min | Torschüsse | Trefferquote | Pässe | Änderung |
|---|---|---|---|---|---|---|
| `56d925f` bis `f3cdd5a` (inkl. `1733f5b`, Stand der HANDOVER) | **7,50** | 6,05 | 52,2 | 14,4 % | 79 % | Politur: klügere Pässe, stärkere Torhüter |
| **`3e2608f`** | **5,00** | 4,06 | 41,6 | 12,0 % | 81 % | **Fahrgefühl: seitliche Haftung, schnelleres Bremsen** |
| `fe2ba0e`, `6aab538`, `3938495` | 5,00 | 4,06 bis 4,11 | 41,6 bis 42,9 | 11,6 % bis 12,0 % | 81 % | Steuerung, Tor nur von vorn, Wetterphysik (ohne Wirkung in dieser Messung) |
| `cc67530` (heute) | 4,67 | 3,87 | 44,6 | 10,5 % | 81 % | nach dem Zusammenführen beider Entwicklungslinien |

Zwischen `f3cdd5a` und `3e2608f` liegen weitere Commits (Grafik, Ton, Oberfläche), aber am Spielverhalten ändern sie nichts: Es kommen nur eine neue KI-Stufe „kids“ dazu, die diese Messung nicht benutzt, und das Zeichnen von Schatten (geprüft per `git diff`). Der Sprung von 7,50 auf 5,00 hängt deshalb an `3e2608f`. Die Schritte danach liegen innerhalb des Messrauschens (SE 0,5 bis 0,8).

**Hinweis zur Historie:** Sie hat zwei Linien, die bei `7dde6a2` zusammengeführt wurden. Commits wie `2b32f8c` gehören zur Linie der anderen Maschine, die vor den Spielverbesserungen abzweigt. Ihre Zahlen (7,2 Tore, 58 % Pässe) sind mit der Hauptlinie nicht vergleichbar.

## 5. Was genau ist die Ursache? (Was-wäre-wenn auf dem heutigen Code)

Auf Temp-Kopien des heutigen `src/` wurde je ein Wert von `3e2608f` zurückgesetzt, jeweils 36 Spiele, gleiche Seeds:

| Variante | Tore/Spiel (±SE) | Torschüsse | Trefferquote | leicht / normal / schwer |
|---|---|---|---|---|
| Stand `1733f5b` (Referenz) | **7,19 ± 0,46** | 51,0 | 14,1 % | 8,92 / 7,17 / 5,50 |
| heute | 4,58 ± 0,35 | 43,9 | 10,4 % | 5,50 / 5,25 / 3,00 |
| heute ohne Haftung (`grip: 0`) | **6,78 ± 0,54** | 53,6 | 12,6 % | 7,25 / 8,42 / 4,67 |
| heute mit altem Bremswert (`brakeDrag: 2,6`) | 5,36 ± 0,47 | 44,0 | 12,2 % | 7,58 / 5,67 / 2,83 |
| heute ohne beides | 6,56 ± 0,51 | 50,4 | 13,0 % | 8,50 / 7,33 / 3,83 |

Lesart:

- Die **seitliche Haftung** (`grip: 4.5` in `src/config.js`, wirkt in `skater.js`) erklärt gut 2 der 2,6 fehlenden Tore und stellt auch die Zahl der Torschüsse wieder her (53,6 gegenüber 51,0). Wer sauber um Kurven fährt, kommt seltener frei vor das Tor.
- Der **Bremswert** allein bringt etwa 0,8 Tore, das liegt knapp über dem Rauschen.
- Ein Rest von 0,4 bis 0,6 Toren (6,56 bis 6,78 gegenüber 7,19) liegt innerhalb der Unsicherheit (SE 0,5). Er kann auch von der Zusammenführung der beiden Linien kommen; das wurde nicht einzeln geprüft.

## 6. Weitere Beobachtungen

- **Die Stufe „schwer“ ist deutlich torärmer:** 3,0 Tore bei den meisten Schüssen (54 pro Spiel) und 94,5 % Paraden. Leicht und normal liegen nahe beieinander (5,5 und 5,3), schwer fällt stark ab. Vermutlich wirken die Torhüter-Werte der Stufen (`goalie.js`, `SKILL`) stärker als die Unterschiede in der KI. Das ist eine Vermutung und nicht gemessen.
- **Der Korridor im Test (4 bis 12 Tore) sitzt knapp am heutigen Wert.** Mit 36 Spielen (4,61) besteht er, mit 9 Spielen (3,89) nicht. Deshalb läuft die CI mit der Standardgröße. Der Test-Kommentar („etwa 7,5 Tore und 42 Schüsse“) ist veraltet: Aktuell sind es 4,6 Tore und 44 Schüsse.
- **Sehr viele Strafen und Kontakte:** 6,6 Strafen und 169 Kontakte pro Spiel in der Halle. Das ist ein eigener Punkt, der die Spielzeit der Überzahl beeinflusst. Ob es gewollt ist, kann ich nicht beurteilen.
- **Auf dem echten Boni (kleiner Platz, 3 gegen 3, langsamer, Untergrund) wurde nie gemessen.** Das Werkzeug misst die Halle. Ein Boni-Lauf bräuchte `BONI_3D` vor dem Import und wäre eine eigene Erweiterung.
- Unabhängig davon: Der Boni spielt heute 4 gegen 4 statt 3 gegen 3 (siehe `tests/lineup.test.mjs`).

## 7. Grenzen der Aussage

- Standardfehler von 0,35 bis 0,55 bei 36 Spielen: Unterschiede unter etwa 1 Tor sind nicht belastbar.
- Nur ein Mannschaftspaar (Blazers gegen Waves), nur Halle, nur KI gegen KI. Menschliches Spiel (Schuss aufladen, Zielhilfe) kommt nicht vor.
- Ob 7,5 oder 4,6 Tore „besser“ spielen, sagt die Messung nicht. Das ist eine Spielgefühl-Entscheidung.

## 8. Empfehlung (nichts davon ist umgesetzt)

1. **Zielwert festlegen:** War das Fahrgefühl mit seitlicher Haftung gewollt, den Zielwert in `HANDOVER.md` und im Test-Kommentar auf „etwa 4,5 bis 5 Tore pro Spiel“ setzen. Sonst die Haftung in kleinen Schritten senken.
2. **Parameter-Lauf:** Mit `balance-history.mjs` oder einem kleinen Lauf über `grip` (zum Beispiel 4,5 / 3 / 2 / 1) und `brakeDrag` die Kurve Tore gegen Fahrgefühl messen. Die Messung dauert pro Wert rund zwei Minuten.
3. **Stufen angleichen:** Die Torhüter-Werte der Stufe „schwer“ gegen die der anderen Stufen prüfen.
4. **Nachts messen:** `.github/workflows/simulation.yml` hängt den Balance-Bericht an jeden nächtlichen Lauf, damit Verschiebungen früh auffallen.
