# QuadBand BPM Detector

Ein Live-BPM-Analyzer in Python mit 4-Band Onset Detection, IBI- und ACF-Tempo-Fusion, stabiler BPM-Lock-Logik und MIDI-Clock-Ausgabe.

## ✨ Features
- **4 Frequenzbänder** (Bass, LowMid, HiMid, High) mit Onset Detection
- **Inter-Beat-Interval (IBI) Schätzung** aus Beat-Zeitpunkten
- **Autokorrelation (ACF) Schätzung** auf Novelty-Kurve
- **Fusion** von IBI + ACF basierend auf Confidence
- **BPM Lock/Hold** für stabile Werte auch bei leisen Stellen
- **Audio Input Auswahl** im UI
- **MIDI Output Auswahl** (Clock 24 PPQN + optional Beat-Note)
- **UI**:
  - Waveform + Beat-Marker
  - Envelopes je Band
  - LEDs für Onsets
  - Input-Level Meter
  - BPM-Anzeige mit Confidence/Lock-Status
  - Einstellbare Parameter (Min/Max BPM, Fusion Window, Min Beat Interval, Lock/Unlock Thresholds)

## ⚙️ Installation
Python >= 3.9 empfohlen.

# Abhängigkeiten installieren
pip install --upgrade pip
pip install numpy scipy sounddevice PyQt5 pyqtgraph mido python-rtmidi

Weil die Daslight 5 erkennung zu schlecht ist 

---

## Weiteres Projekt in diesem Repository

### [`medtrack/`](medtrack/) – Medikations-, Körper- und Trainingstracker

Lokale Web-App (PWA, ohne Build-Schritt, für Handy und Desktop) zur Dokumentation einer
Hormontherapie: berechnete Wirkstoff- und Halbwertszeitkurven auf Basis eines
Bateman-Modells, Laborwerte mit Referenzbereichen und Verlauf, ausgebautes Trainings-
und Körpertracking, Erinnerungen mit Kalender-Export sowie eine Regel-Engine für
Sicherheitshinweise. Alle Daten bleiben im Browser.
Details in [`medtrack/README.md`](medtrack/README.md).

```bash
cd medtrack && python3 -m http.server 8080   # dann http://localhost:8080/
cd medtrack && npm test                      # 59 Tests der Rechen- und Regel-Logik
```
