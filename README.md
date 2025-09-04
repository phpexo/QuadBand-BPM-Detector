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
