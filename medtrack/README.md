# MedTrack

Lokaler Tracker für Hormontherapie, Blutwerte, Körperdaten und Training – mit
berechneten Wirkstoff- und Halbwertszeitkurven.

Die App richtet sich an Menschen, die eine ärztlich verordnete Testosterontherapie (TRT)
führen, und ebenso an alle, die andere Substanzen dieses Bereichs verwenden und ihr
Risiko dabei so klein wie möglich halten wollen. Sie dokumentiert, rechnet und warnt –
sie empfiehlt keine Dosierungen.

## Was sie kann

**Wirkstoffkurve.** Aus jeder eingetragenen Gabe berechnet die App, wie viel Hormon
aktuell im Blut zirkuliert, wie viel noch unfreigesetzt im Depot liegt und wie der
Verlauf weitergeht. Grundlage ist ein Ein-Kompartiment-Modell mit Resorption erster
Ordnung (Bateman-Funktion) – siehe [Modell](#das-pharmakokinetische-modell).

**Ester-Rechnung.** 100 mg Testosteron Enantat sind 72 mg Testosteron. Die App rechnet
jede Dosis über das Molmassenverhältnis auf das Basis-Hormon um, damit Präparate mit
verschiedenen Estern vergleichbar werden.

**Fließgleichgewicht.** Für jedes Protokoll: erwarteter Mittelwert, Spitze und Tal,
Schwankungsbreite und wie lange es dauert, bis sich nach einer Änderung ein neues
Niveau eingestellt hat.

**Labor.** 34 Marker mit Referenzbereichen, farbiger Bewertung, Verlaufsdiagrammen und
CSV-Export. Hämatokrit, HDL, Leber- und Nierenwerte, PSA und Hormone sind hinterlegt.

**Sicherheitshinweise.** Eine Regel-Engine wertet aus, was eingetragen wurde: überfällige
Blutkontrolle, kritische Laborwerte, steigender Hämatokrit, Blutdruck, Aromatasehemmer
ohne Estradiol-Messung, orale 17-α-alkylierte Substanzen, 19-Nor-Substanzen, Dosierungen
oberhalb des Substitutionsbereichs, fehlende Rotation der Injektionsstellen, fehlender
Arztkontakt. Dazu eine feste Liste von Warnzeichen, bei denen sofort Hilfe nötig ist.

**Training.** 77 Übungen mit Muskelgruppen, Gerät und Erfassungsart (Gewicht × Wdh.,
Körpergewicht, Zusatzgewicht, Dauer, Ausdauer) – dazu beliebig viele eigene. Laufende
Trainingseinheit mit Vorbelegung aus der letzten Einheit, Aufwärmsätzen, RPE,
Satzpausen-Timer, Scheibenrechner und automatischer Rekord-Erkennung. Trainingspläne
als Vorlage. Auswertung: Sätze je Muskelgruppe (sekundär beteiligte zählen zur Hälfte),
Trainingsfrequenz, Wochenvolumen, Kraftentwicklung je Übung und Bestleistungen.

**Körper.** Gewicht mit gleitendem Schnitt und Veränderungsrate pro Woche, Körperfett
(eingetragen, per Caliper nach Jackson-Pollock mit 3 oder 7 Messstellen, oder aus
Umfängen nach der US-Navy-Formel), 13 Umfänge inklusive Seitenvergleich, FFMI mit
Einordnung, Taille-zu-Größe-Verhältnis, Blutdruck, Ruhepuls, Schlaf, Schritte,
Kalorien, Eiweiß, Befinden und Nebenwirkungen. Fortschrittsfotos liegen verkleinert
in der lokalen Datenbank des Browsers.

**Erinnerungen.** Injektionen, Blutkontrolle, Arzttermine und Blutdruckmessung.
Benachrichtigungen erscheinen, solange die App offen ist, und werden beim nächsten
Öffnen nachgemeldet. Verlässlich erinnert der Kalender-Export (.ics mit Voralarm) –
der funktioniert unabhängig davon, ob die App läuft.

**Arztbericht.** Ein Klick erzeugt eine Textdatei mit Medikation, Gaben der letzten
90 Tage, Laborwerten, beobachteten Nebenwirkungen und offenen Hinweisen – zum Ausdrucken
und Mitnehmen.

## Starten

Die App braucht keinen Build-Schritt. Sie besteht aus statischen Dateien und ES-Modulen.

```bash
cd medtrack
python3 -m http.server 8080     # oder: npx http-server -p 8080
```

Dann `http://localhost:8080/` öffnen. Über `file://` funktioniert sie nicht, weil
Browser ES-Module von dort blockieren.

Auf dem Handy lässt sie sich über „Zum Startbildschirm hinzufügen" als PWA installieren
und funktioniert danach offline (Service Worker). Das Layout ist auf Handybedienung
ausgelegt: Navigation am unteren Rand in Daumenreichweite, Zahleneingaben mit Plus- und
Minus-Tasten, Eingabefelder mit 16 px (sonst zoomt iOS beim Antippen hinein), und
Tabellen werden auf schmalen Bildschirmen zu Karten.

```bash
npm test     # 59 Tests für PK-, Regel-, Trainings- und Körper-Logik
```

## Datenschutz

Alle Daten liegen ausschließlich im `localStorage` des Browsers. Es gibt keinen Server,
keine Konten, keine Übertragung nach außen. Das ist bei Gesundheitsdaten dieser Art eine
bewusste Entscheidung – und bedeutet: Browserdaten löschen oder Gerät wechseln heißt
Daten weg. Unter *Einstellungen → Daten* gibt es Export und Import als JSON.

## Das pharmakokinetische Modell

Für ein öliges Depot gilt näherungsweise:

```
A(t)     = D_base · ka/(ka − ke) · (e^(−ke·t) − e^(−ka·t))      zirkulierende Menge
Depot(t) = D_base · e^(−ka·t)                                    noch nicht freigesetzt
D_base   = Dosis · Esterfaktor · Bioverfügbarkeit
ka, ke   = ln2 / Halbwertszeit (Freisetzung bzw. Elimination)
```

Bei langen Estern ist die Freisetzung der langsamere Schritt („Flip-Flop-Kinetik"):
Testosteron selbst hat eine Halbwertszeit von etwa einer Stunde, unter Enantat fällt der
Spiegel trotzdem mit rund 4,5 Tagen. Das ergibt sich aus der Gleichung von selbst.

Mehrere Gaben werden per Superposition addiert. Der Serumspiegel folgt aus
`Konzentration = Menge / (Vd · Körpergewicht)`.

**Wie gut trifft das?** Für 100 mg Testosteron Enantat pro Woche bei 80 kg liefert das
Modell einen Mittelwert von rund 780 ng/dl – das entspricht dem, was in der Praxis
gemessen wird, und die daraus folgende Clearance von ca. 1330 l/Tag liegt im publizierten
Bereich (600–1400 l/Tag). Der Test dazu steht in `test/pk.test.mjs`.

**Wo es endet.** Ein Verteilungsvolumen ist nur dort hinterlegt, wo belastbare Humandaten
existieren. Für Trenbolon, Boldenon, Trestolon und andere nie am Menschen untersuchte
Substanzen zeigt die App bewusst **keinen** ng/dl-Wert, sondern eine auf 100 % normierte
Kurve in einem eigenen Diagramm – damit eine Schätzung nicht wie ein Messwert aussieht.
Jede Substanz trägt eine Kennzeichnung der Datenqualität (`high` / `medium` / `low`).

Individuell streuen die realen Werte erheblich (Clearance, Verteilungsvolumen, SHBG,
Injektionsort, Ölvolumen). Deshalb gibt es die Kalibrierung: Aus eingetragenen
Testosteron-Messwerten errechnet die App einen Faktor und passt die Kurve an.

## Aufbau

```
medtrack/
├── index.html              Grundgerüst
├── sw.js                   Service Worker (Offline-Betrieb)
├── css/styles.css          Styles inkl. Dark/Light nach Systemeinstellung
├── js/
│   ├── app.js              Router und App-Hülle
│   ├── store.js            localStorage-Persistenz, Export/Import, CSV
│   ├── model.js            Bindeglied zwischen Daten und PK-Engine
│   ├── pk/
│   │   ├── compounds.js    38 Substanzen mit Esterfaktoren und Halbwertszeiten
│   │   └── engine.js       Bateman-Modell, Superposition, Steady State
│   ├── safety/
│   │   ├── labs.js         34 Labormarker mit Referenzbereichen
│   │   └── advice.js       Regel-Engine für Hinweise und Warnzeichen
│   ├── data/exercises.js   77 Übungen mit Muskelgruppen und Gerät
│   ├── gym/stats.js        1RM, Rekorde, Sätze je Muskel, Scheibenrechner
│   ├── body/metrics.js     Körperfett-Formeln, FFMI, Umfänge, Trends
│   ├── reminders.js        Fälligkeiten, Benachrichtigungen, .ics-Export
│   ├── photos.js           Fortschrittsfotos in IndexedDB
│   ├── ui/                 DOM-Helfer und SVG-Diagramme (ohne Framework)
│   └── views/              9 Ansichten, Training und Körper mit Unterreitern
└── test/                   Tests für PK-, Regel-, Trainings- und Körper-Logik
```

Kein Framework, keine Abhängigkeiten, kein Bundler. Node wird nur für die Tests gebraucht.

## Grenzen

- Kein Medizinprodukt. Keine Diagnose, keine Therapieentscheidung, keine Dosierungsempfehlung.
- Berechnete Kurven sind Modellwerte aus Populationsmittelwerten, keine Messungen.
- Referenzbereiche unterscheiden sich je nach Labor und Messmethode. Maßgeblich ist der
  eigene Befund.
- Der Gebrauch anaboler Steroide außerhalb einer ärztlichen Behandlung ist mit erheblichen
  Risiken verbunden – Herz-Kreislauf-System, Leber, Psyche, Fruchtbarkeit. Ein Teil dieser
  Schäden bildet sich nach dem Absetzen nicht vollständig zurück. Regelmäßige Blutkontrollen
  und ein offenes Gespräch mit einem Arzt sind durch nichts zu ersetzen; die ärztliche
  Schweigepflicht gilt auch hier.

## Offen erweiterbar

Nichts an der App ist eine feste Liste:

- **Eigene Substanzen** mit Esterfaktor und Halbwertszeiten (Einstellungen)
- **Eigene Übungen** mit Muskelgruppen und Erfassungsart – sie zählen in Auswertung
  und Rekorden gleichwertig mit (Training → Übungen)
- **Eigene Trainingspläne** als Vorlage für die Einheit
- **Export und Import** als JSON und CSV, dazu der Kalender-Export

Die Datenbanken liegen als lesbare JavaScript-Dateien vor (`js/pk/compounds.js`,
`js/data/exercises.js`, `js/safety/labs.js`) und lassen sich direkt ergänzen.

## Datenmigration

Der Speicher trägt eine Schemaversion. Beim Start wird migriert und das Ergebnis sofort
zurückgeschrieben. Version 1 → 2 überführt die früher als Freitext gespeicherten Übungen
auf Übungs-IDs; Umlautvarianten werden zusammengeführt, unbekannte Namen bleiben als
eigene Übung erhalten statt stillschweigend einer ähnlichen zugeordnet zu werden.

## Mögliche nächste Schritte

- Verknüpfung von Nebenwirkungs-Einträgen mit dem berechneten Spiegel zum Zeitpunkt
- Import von Laborbefunden aus PDF
- Verschlüsselte Sicherung statt Klartext-JSON
- Vergleichsansicht für Fortschrittsfotos (nebeneinander, gleiche Pose)
- Weitere Basis-Hormone mit belastbarem Vd, sobald Daten vorliegen
