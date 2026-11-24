# annablox

The ANNABLOX website: a small promo page for our three Roblox experiences, served by GitHub Pages at
https://jdonald.github.io/annablox

- **Annabelle's Obby** — https://www.roblox.com/games/120324667325732/Annabelles-Obby
- **City of Houses** — https://www.roblox.com/games/124603604178082/City-of-Houses
- **Grab 'n' Go Adventure** — https://www.roblox.com/games/107038112279116/Grab-n-Go-Adventure

## What's here

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `site.js` | The promo page: one tab per game with trailer, thumbnail, Play button and roblox.com link. `#obby`, `#city`, `#grab` in the URL open a tab directly. |
| `assets/logo.svg` | The ANNABLOX logo (hand-drawn block letters in the style of the 2015 Roblox logo). |
| `assets/video/` | Trailers re-encoded to 720p H.264 at about 1.8 Mbps so they stay small for GitHub Pages. |
| `assets/img/` | Thumbnails and icons (from the Roblox game pages and our store art). |
| `shared/` | The mini-game engine shared by all three minis: Roblox-style physics in studs (walk 16, jump 7.2, gravity 196.2), blocky avatars, third-person camera, touch joystick + Jump button, interaction prompts, sounds and saves. |
| `obby/` | Mini Annabelle's Obby. |
| `city/` | Mini City of Houses: collect rent, buy cottages, rebuild as a Two-Story, and fill it with a TV, kitchen, bedroom, arcade and more. |
| `grab/` | Mini Grab 'n' Go Adventure: the start of each storyline, with a link to Roblox where the mini stops. |

The Obby and City minis are for friends who don't have a 16+ Roblox account yet (Grab 'n' Go is open to all Roblox players, so its mini is just a quick taste). They work with keyboard/mouse and touch, and save progress in the browser.

No build step: everything is plain HTML/CSS/JS. three.js is loaded from jsDelivr.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 (the mini games need to be served over http, not opened as a file).

## The mini Obby

Five stages built with the real game's numbers (jump height 7.2, gravity 196.2, water double jump 60,
space super jump 120, Moon gravity 65.4):

1. Rainbow xylophone (each bar plays a note)
2. Forest climb over rocks
3. Ocean: fall in, hold jump to swim up and leap out
4. Space: super jumps between planets
5. The Moon: low gravity, glowing craters and aliens to dodge, then the portal

## The mini City of Houses

Collect rent from your mailbox, buy cottages on the four lots, and walk onto glowing pads to buy upgrades
(bathroom, TV, kitchen, washer, carport, car). Own two houses to unlock the Two-Story rebuild, which adds
an upstairs bedroom and an arcade. Duplexes, pools, the Villa and becoming Mayor are left for Roblox.

## The mini Grab 'n' Go Adventure

A small Maplebrook with the start of each story:

- **Morning Rush**: find coins, buy Dana a coffee, get an Arcade Token.
- **The Great Trading Trail**: claw machine → Hamato Doll → ribbon → dog food → bananas → Momo the monkey.
- **Cluck Cluck**: carry Farmer Hattie's chickens on your head and hold jump to glide over the Windy Cliffs gap.
- **Roadster Rescue**: find Mr. Goldbucks' gas-thruster Roadster (driving it is on Roblox).
- **Fraudanos**: pitch BoogerScan™, raise $9 billion, get caught (Striker Isle is on Roblox).
