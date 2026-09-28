# The Danish optical telegraph

A standalone page about Denmark's optical telegraph, 1801–1862. It shows a 3D
map of the stations, and you can send a message along the line and watch it
relay from mast to mast.

## Using the page

1. **Pick a year.** The network on the map changes to match: the lines of
   1801, the war line from Helsingør to Kiel, the northern line of 1810, the
   Great Belt link kept in peacetime, and the line to Als in 1848.
   Fisker's 18-flap mast gives way to Schumacher's five-board frame in 1811.
2. **Pick the route.** Choose a start and a destination, then the date, the
   start time and the weather.
3. **Write the message.** Pick phrases from the codebook, or spell a name
   letter by letter.
4. **Press Send.** A sign passes from one station to the next like this:
   - one crew sets it on their mast;
   - the next station reads it through a telescope, logs the number and sets
     it on its own mast;
   - the first station waits until it sees that repeat before it shows the
     next sign.

   Fog stops the hops that are too long to see across. The night stops the
   whole line: there were no lamps, and a mast can only be read against the
   daylight sky.
5. **Click any station to go inside.** The walls cut away to show the crew:
   - a watcher at the telescope;
   - a clerk with the codebook and the log;
   - rope-men hauling the flaps.

   "Look at the mast" shows the sign as the neighbouring stations saw it.

Below the map, the page explains:

- the data on the line: numbers from a codebook, and their bits per sign;
- why there was no light;
- how often the telegraph was used, and by whom;
- the Norwegian sister line.

A final panel lists what is documented and what the page reconstructs.

Open `index.html` in a browser. Three.js loads from jsDelivr, and the rest of
the page is self-contained, including the Natural Earth coastline.

## Sources

- G. J. Holzmann, *The Use of Optical Telegraphs in England and Elsewhere*:
  - Fisker's 18 flaps, 2 × 0.75 m each;
  - at least 22 s per sign;
  - the lines of 1801 and 1808;
  - Schumacher's five-digit frame;
  - Norway's system.
- S. C. Pedersen, *Ord i sigte. Optisk telegrafi i Danmark 1794–1862* (Post &
  Tele Museum 2000), through S. E. Jørgensen's review in *Historie* 2000:
  - the routes of 1801, 1810 and 1848;
  - the 1797 book of 1,299 signals;
  - what the telegraph was used for.
- Skalk, *Mastetelegrafen*:
  - five yards and 18 flaps, with the sign as the sum of the flaps' values;
  - about 10 km between stations;
  - codes 4509, 4513 and 4514.
- Enigma (the Post & Tele Museum):
  - 23 stations;
  - speeds in clear weather and in fog;
  - the Great Belt line, 1801–1862;
  - "Der kommer rejsende".
- Store norske leksikon: the Norwegian working hours.
- Trap Danmark: the station at Juelsberg.

## What the page reconstructs

- **Fisker's flap values.** Only "each flap had its own value" is documented.
- **The intermediate stations.** The sources give how many stations each line
  had, not where they stood, so the page spaces them along the line.
- **The link from Kalundborg to Korsør.** The sources don't say how the 1810
  line joined the rest of the network.
- **Most of the codebook.**
- **The timings and the acknowledgement rule.**
- **The weather visibilities.**
- **The watch-house and its crew.**

## Tests

```
node test.mjs
```

The tests check:

- both encodings round-trip for every number;
- the station count of each line matches the sources;
- every station stands on land, and every hop is within sight;
- a route exists between every pair of stations;
- the relay's timing matches the closed-form formula;
- fog stalls the relay, and the night makes it wait until morning;
- the sunrise and sunset times at Copenhagen on the solstices are right.
