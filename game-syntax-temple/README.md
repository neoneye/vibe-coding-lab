# Syntax Temple

A top-down puzzle game where the rules of each room are word tiles lying in the room. Push the words into new statements and the room's program changes while it runs.

Open `index.html` in a browser. Everything is in that one file.

## The language

Statements read left to right or top to bottom.

| Form | Example | Meaning |
|---|---|---|
| Declaration | `WALL IS STOP` | holds while the line stays intact |
| `AND` | `KEY IS PUSH AND OPEN` | several things or properties in one line |
| `NOT` | `NOT HERO IS STOP` | every kind of thing except the hero |
| Assignment | `SKULL = GEM` | every skull becomes a gem; several assignments run in listing order |
| Conditional | `IF HERO ON FIRE THEN GEM IS WIN` | the statement after `THEN` holds only while the test is true |

Things: `HERO` `WALL` `KEY` `DOOR` `SKULL` `FIRE` `GEM` `CRATE` `WATER`.
Properties: `YOU` `WIN` `STOP` `PUSH` `DEATH` `SINK` `OPEN` `SHUT`.
Tests: `A ON B`, `A NEAR B`, `NO A`.

A line that does not parse does nothing. Breaking an `IF` line can leave its tail running unconditionally.

## Controls

Arrows or WASD move, Z undoes, R restarts the room, Esc returns to the map, Enter goes into a temple. Progress is kept in the browser.

## Tests

```bash
node test.mjs
```

The suite takes about half a minute, because several tests search a room's whole state space. The engine lives in the `shared-code` script block of `index.html`. The tests cover the parser, every property, the turn order and the map's unlock graph, and replay a recorded solution for each of the twelve rooms.

Review hooks: `?room=N` opens room N, `?room=N&moves=RRUL` also plays moves, `?solved=0,1,2` previews a map state without touching saved progress.

## Credit

The idea of pushing rule words around a room comes from Arvi Teikari's Baba Is You. The rooms, language extensions and art are this game's own.
