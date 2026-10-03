#!/usr/bin/env python3
"""Housige 90er/2000er Pop-Party: Playlist nach Phasen + Beatport-Suchlinks.
Nutzung:  python3 party/playlist.py            -> Markdown auf stdout
          python3 party/playlist.py --open     -> oeffnet alle Suchen im Browser
BPM sind grobe Richtwerte; auf Beatport die Version (Extended/Club Mix) waehlen, die passt."""
import sys, urllib.parse, webbrowser

PHASES = [
 ("1. Opening (ca. 118-124 BPM) - warm, groovy, Mitsummen", [
  ("Robin S", "Show Me Love"),
  ("Sophie Ellis-Bextor", "Murder on the Dancefloor"),
  ("Daft Punk", "One More Time"),
  ("Stardust", "Music Sounds Better With You"),
  ("Modjo", "Lady (Hear Me Tonight)"),
  ("Spiller", "Groovejet"),
 ]),
 ("2. Build-up / Main Time (ca. 124-128 BPM) - Hits, die jeder kennt", [
  ("Kylie Minogue", "Can't Get You Out of My Head"),
  ("Madison Avenue", "Don't Call Me Baby"),
  ("Moloko", "Sing It Back"),
  ("Basement Jaxx", "Where's Your Head At"),
  ("Faithless", "Insomnia"),
  ("Haddaway", "What Is Love"),
  ("Corona", "The Rhythm of the Night"),
 ]),
 ("3. Peak (ca. 128-135 BPM) - Hände hoch", [
  ("Snap!", "Rhythm Is a Dancer"),
  ("2 Unlimited", "Get Ready for This"),
  ("Gala", "Freed from Desire"),
  ("Cher", "Believe"),
  ("Alice Deejay", "Better Off Alone"),
  ("Eiffel 65", "Blue (Da Ba Dee)"),
  ("Vengaboys", "We Like to Party"),
  ("Cascada", "Everytime We Touch"),
  ("Darude", "Sandstorm"),
 ]),
 ("4. Abriss / Breather (wieder ca. 120-126 BPM) - kurz runterkommen, dann nochmal hoch", [
  ("Lasgo", "Something"),
  ("Eric Prydz", "Call on Me"),
  ("Mylo", "Drop the Pressure"),
  ("Kernkraft 400", "Zombie Nation"),
 ]),
]

def url(a, t):
    return "https://www.beatport.com/search/tracks?q=" + urllib.parse.quote_plus(f"{a} {t}")

if __name__ == "__main__":
    for title, tracks in PHASES:
        print(f"\n## {title}")
        for a, t in tracks:
            print(f"- {a} - {t}: {url(a, t)}")
            if "--open" in sys.argv:
                webbrowser.open(url(a, t))
