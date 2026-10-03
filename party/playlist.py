#!/usr/bin/env python3
"""Housige 90er/2000er Pop-Party: Playlist nach Phasen + Beatport-Suchlinks.
Nutzung:  python3 party/playlist.py            -> Markdown auf stdout
          python3 party/playlist.py --open     -> oeffnet alle Suchen im Browser
BPM sind grobe Richtwerte; auf Beatport die Version (Extended/Club Mix) waehlen, die passt."""
import sys, urllib.parse, webbrowser

PHASES = [
 ("1. Warm-up (ca. 112-120 BPM, ~45 Min) - locker, Leute kommen an", [
  ("Moloko", "Sing It Back"), ("Sophie Ellis-Bextor", "Murder on the Dancefloor"),
  ("Cassius", "Feeling for You"), ("Roger Sanchez", "Another Chance"),
  ("Groove Armada", "I See You Baby"), ("Fatboy Slim", "Right Here, Right Now"),
  ("Armand Van Helden", "You Don't Know Me"), ("Whitney Houston", "It's Not Right But It's Okay"),
  ("Stardust", "Music Sounds Better With You"), ("Robin S", "Show Me Love"),
  ("Jamiroquai", "Canned Heat"),
 ]),
 ("2. Opening (ca. 120-124 BPM, ~50 Min) - die Tanzflaeche fuellt sich", [
  ("Daft Punk", "One More Time"), ("Modjo", "Lady (Hear Me Tonight)"),
  ("Spiller", "Groovejet"), ("Kylie Minogue", "Can't Get You Out of My Head"),
  ("Madison Avenue", "Don't Call Me Baby"), ("Basement Jaxx", "Where's Your Head At"),
  ("Faithless", "Insomnia"), ("Bob Sinclar", "Love Generation"),
  ("Bob Sinclar", "World, Hold On"), ("Junior Jack", "Stupidisco"),
  ("Eric Prydz", "Call on Me"), ("Mylo", "Drop the Pressure"),
  ("Fragma", "Toca's Miracle"), ("Room 5", "Make Luv"),
  ("The Shapeshifters", "Lola's Theme"), ("Benny Benassi", "Satisfaction"),
 ]),
 ("3. Main Time 1 (ca. 124-128 BPM, ~60 Min) - Hits zum Mitsingen", [
  ("Haddaway", "What Is Love"), ("Corona", "The Rhythm of the Night"),
  ("Real McCoy", "Another Night"), ("Culture Beat", "Mr. Vain"),
  ("La Bouche", "Be My Lover"), ("Livin' Joy", "Dreamer"),
  ("Lasgo", "Something"), ("DJ Sammy", "Heaven"),
  ("ATB", "9 PM (Till I Come)"), ("Ian Van Dahl", "Castles in the Sky"),
  ("Sylver", "Turn the Tide"), ("Rui da Silva", "Touch Me"),
  ("Milk Inc.", "Walk on Water"), ("Gigi D'Agostino", "L'amour toujours"),
  ("Whigfield", "Saturday Night"), ("Sash!", "Ecuador"),
  ("Groove Coverage", "God Is a Girl"), ("Safri Duo", "Played-A-Live"),
 ]),
 ("4. Peak 1 (ca. 128-135 BPM, ~50 Min) - Haende hoch", [
  ("Snap!", "Rhythm Is a Dancer"), ("2 Unlimited", "Get Ready for This"),
  ("Gala", "Freed from Desire"), ("Cher", "Believe"),
  ("Alice Deejay", "Better Off Alone"), ("Eiffel 65", "Blue (Da Ba Dee)"),
  ("Vengaboys", "We Like to Party"), ("Cascada", "Everytime We Touch"),
  ("Darude", "Sandstorm"), ("Mr. President", "Coco Jamboo"),
  ("Dr. Alban", "It's My Life"), ("Aqua", "Barbie Girl"),
  ("Scooter", "How Much Is the Fish?"), ("Alcazar", "Crying at the Discotheque"),
  ("Kernkraft 400", "Zombie Nation"),
 ]),
 ("5. Breather (ca. 110-122 BPM, ~25 Min) - kurz durchatmen", [
  ("Mousse T. vs. Hot 'n' Juicy", "Horny"), ("Fatboy Slim", "Praise You"),
  ("Daft Punk", "Digital Love"), ("Dario G", "Sunchyme"),
  ("Faithless", "God Is a DJ"), ("Underworld", "Born Slippy .NUXX"),
 ]),
 ("6. Main Time 2 / Peak 2 (ca. 126-134 BPM, ~60 Min) - Euphorie, Trance-Hymnen", [
  ("Robert Miles", "Children"), ("Rank 1", "Airwave"),
  ("Ferry Corsten", "Punk"), ("Delerium", "Silence (Tiesto Remix)"),
  ("Paul van Dyk", "For an Angel"), ("Binary Finary", "1998"),
  ("Fedde Le Grand", "Put Your Hands Up for Detroit"), ("David Guetta", "Love Don't Let Me Go (Walking Away)"),
  ("Alex Gaudino", "Destination Calabria"), ("Global Deejays", "The Sound of San Francisco"),
  ("Basshunter", "Now You're Gone"), ("Kate Ryan", "Desenchantee"),
  ("Inna", "Hot"), ("Groove Coverage", "Far Away from Home"),
  ("Scooter", "Maria (I Like It Loud)"), ("Tiesto", "Traffic"),
 ]),
 ("7. Closing (ca. 118-126 BPM, ~30 Min) - Feelgood-Klassiker zum Ausklang", [
  ("Black Box", "Ride on Time"), ("Crystal Waters", "Gypsy Woman (She's Homeless)"),
  ("CeCe Peniston", "Finally"), ("Ultra Nate", "Free"),
  ("C+C Music Factory", "Gonna Make You Sweat"), ("Technotronic", "Pump Up the Jam"),
  ("Inner City", "Good Life"), ("Jocelyn Brown", "Somebody Else's Guy"),
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
