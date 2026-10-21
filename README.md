# Envelope

Weight and balance for light training aircraft, built for a phone on the ramp.

Enter people, bags and fuel and see, live:

- **Within limits or not**, with the exact limit and by how much, for ramp, takeoff and landing.
- **The airplane itself**, loads drawn where they sit and the allowed CG range drawn to scale. The airplane tips nose-down or tail-down with the CG.
- **The CG envelope chart**, with the fuel burn line from takeoff to landing and to dry tanks.
- **How it will fly**: Va at your weight, stall speed change, utility category eligibility and what a forward or aft CG does to stability, stall and the flare.
- **Ways to fix it**: concrete, verified changes ("Move 23 lb from baggage area B to baggage area A") that apply in one tap.
- **A loadsheet** to print, and a share link that opens the same loading on another phone.

Aircraft profiles (tail number, empty weight and CG from the airplane's own W&B record) are saved on the device. The app works offline after the first visit and can be added to the home screen.

## Aircraft

| Model | Source |
|---|---|
| Cessna 172S | 172S Nav III POH |
| Cessna 172N (standard and long-range tanks) | 1980 172N POH |
| Cessna 152 (standard and long-range tanks) | 1980 152 POH |
| Piper PA-28-181 Archer II/III | Archer III POH VB-1563 |
| Piper PA-28-161 Warrior II/III, 2440 lb | VB-1180 / VB-1610 |
| Piper PA-28-161 Warrior II, 2325 lb | VB-880 |

All data lives in [`src/domain/aircraft.ts`](src/domain/aircraft.ts); tests check every envelope is convex, tops out at max takeoff weight and references real stations. Adding a type is a data change.

## Development

```sh
npm install
npm run dev      # local server
npm run check    # typecheck, tests, production build
```

Layout:

- `src/domain` is pure TypeScript with no UI: envelope geometry, the loading calculation, fixes and flight effects. Units are lb, in and US gal throughout.
- `src/state` holds the reducer and validated persistence and share links.
- `src/ui` holds Preact components. The charts are hand-drawn SVG, no chart library.

## Disclaimer

A planning aid, not a replacement for the POH or the airplane's weight and balance record. The pilot in command is responsible for weight and balance on every flight.
