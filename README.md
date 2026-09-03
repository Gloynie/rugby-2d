# 🏉 RUGBY 2D

A pixel-art rugby union game for your laptop: 53 real teams, 6 competitions (World Cup, Six Nations,
Rugby Championship, URC, Premiership, Super Rugby Pacific), 19 stadiums, full rugby laws, replays,
rebindable controls and (optionally) accounts with a saved career.

It is a **Next.js** web app (React front end + a small Node server + optional PostgreSQL database).

---

## Play it on your own computer (VS Code)

### What you need

| Tool | Why | Get it |
| --- | --- | --- |
| **Node.js 20.9 or newer** (22 LTS recommended) | runs the game server | <https://nodejs.org> (the LTS download) |
| **VS Code** | editor + terminal | <https://code.visualstudio.com> |
| PostgreSQL **(optional)** | only for accounts, saved results & competitions | Docker Desktop or <https://www.postgresql.org/download> |

Check Node is installed: open a terminal and run `node -v` → should print `v20.9.0` or higher.

### 1. Download and open the project

1. Download / export this project as a ZIP and unzip it (or `git clone` it if it lives in a repo).
2. In VS Code: **File → Open Folder…** and pick the unzipped folder (the one containing `package.json`).

### 2. Install and play (two commands)

Open the VS Code terminal (**Terminal → New Terminal**, or `` Ctrl+` ``) and run:

```bash
npm install
npm run dev
```

Then open **<http://localhost:3000>** in your browser (Chrome, Edge or Firefox). Click the page once so it
has keyboard focus, and play.

> **Shortcut:** press **F5** in VS Code (launch config included) – it starts the server and opens the
> browser for you. `Ctrl+Shift+B` also starts the dev server.

Everything you need to play works immediately – **quick matches, every team, every stadium, controls,
replays** – with no database. You'll see a small **GUEST MODE · NO DATABASE** chip in the footer; that only
means sign-in, saved results and competitions are switched off until you do step 3.

### "Can I use the Live Server extension?"

Not for this project. VS Code's *Live Server* extension only serves plain `.html` files. This game has its
own server (Next.js) – `npm run dev` **is** the live server: it reloads automatically when you change a
file, exactly like Live Server does. If you want the game *inside* VS Code, run `npm run dev` and then
`Ctrl+Shift+P` → **Simple Browser: Show** → `http://localhost:3000`.

---

## 3. Optional: accounts & competitions (PostgreSQL)

Accounts, your W/D/L record and tournaments are stored in PostgreSQL. Pick one option:

**Option A – Docker (easiest).** With Docker Desktop running, in the project folder:

```bash
docker compose up -d
```

This starts Postgres with user `postgres`, password `postgres`, database `app_db` on port `5432` – exactly
what the game expects by default.

**Option B – Install PostgreSQL yourself.** Install it, then create a database called `app_db` and make sure
the `postgres` user's password is `postgres` (or edit the URL below to match yours).

Then create the tables and restart:

```bash
npx drizzle-kit push      # creates the users / sessions / matches / tournaments tables
npm run dev               # restart the game server
```

If your database URL differs from the default, copy `.env.example` to `.env`, edit `DATABASE_URL`, and also
update `drizzle.config.json` (used by `drizzle-kit push`). The GUEST MODE chip disappears once the game can
reach the database, and **Sign in / Create account** works.

---

## Controls (defaults – change them in **Controls** on the main menu)

| Key | Action |
| --- | --- |
| Arrow keys | Move |
| Shift (hold) | Sprint – drains stamina, tired players slow down and fumble |
| W / S | Pass to a team-mate up / down the screen (always backwards) |
| A (hold & release) | Kick – hold to charge a punt, tap for a grubber |
| D | Drop goal |
| Space | Tackle · dive for the line · take the kick-off · goal-kick meter · skip replays |
| Q | Switch to the nearest defender |
| 1 / 2 / 3 | Penalty: kick at goal / kick to touch / tap and go |
| Esc | Pause · H toggles the on-screen help |

Menus: arrow keys + Enter, Esc to go back.

---

## Other commands

```bash
npm run build && npm start   # production build + server (faster than dev mode)
npm run typecheck            # TypeScript check
node scripts/run-sim.mjs     # headless AI-vs-AI engine simulation (dev tool)
node scripts/run-fuzz.mjs    # random-input stress test of the engine (dev tool)
```

## Project tour

```
src/game/engine.ts     rugby simulation: laws, AI, rucks, scrums, lineouts, kicking, scoring
src/game/sprites.ts    procedural pixel-art player sprites & animations
src/game/render.ts     pixel renderer (pitch, crowd, HUD, replays)
src/game/director.ts   cinematics: stadium fly-over, try celebrations, slow-mo replays
src/game/controls.ts   key bindings, presets, persistence
src/game/data/         teams, players, competitions, stadiums
src/components/game/   full-screen game shell & menus (React)
src/app/api/           accounts, results, tournaments (Next.js route handlers)
src/db/                Drizzle ORM schema & connection
```

## Troubleshooting

- **`npm` is not recognized** – install Node.js from nodejs.org, then close and reopen VS Code.
- **Windows PowerShell says "running scripts is disabled"** – run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use the *Command Prompt* terminal profile.
- **Port 3000 already in use** – run `npm run dev -- -p 3001` and open <http://localhost:3001>.
- **Keys don't do anything** – click on the game once so the browser tab has focus.
- **"No database connected" when signing in** – that's guest mode; follow step 3 above.
- **"Database tables are missing"** – run `npx drizzle-kit push`.
- **Slow / choppy** – close other tabs, or use `npm run build && npm start` instead of dev mode.

## 🎮 New Features (Latest Update)

### 🏈 Match Experience
- **Live Commentary**: Real-time play-by-play text commentary during matches (bottom-right corner)
- **Sound Effects**: Crowd ambience, referee whistle, tackle impacts, try celebrations, and goal kicks
- **Menu Music**: Ambient background music on the main menu (starts on first click)
- **Higher Scoring**: Engine tuned for more tries and competitive matches

### 👔 Manager Mode
- **Watch-Only Mode**: When watching career matches, you spectate both teams as AI (no player control)
- **Auto-Simulation**: Other teams in your competition play their fixtures each week
- **Training Center**: 
  - Earn coins from match results (Win: +150, Draw: +75, Loss: +40)
  - Individual training: Fitness (60 coins), Skills (100 coins), Strength (80 coins)
  - Team training: Bonding (120 coins), Tactics (150 coins), Intense (180 coins)
  - Training costs fatigue but improves ratings and form

### 👥 Expanded Rosters
- Major international teams now have 30-35 players with current 2025 squad members
- Includes: Ireland, France, England, New Zealand, South Africa, Australia, Argentina

### 🎯 Controls Reminder
- Press `H` during a match to show/hide controls overlay
- Press `P` or `ESC` to pause
- Arrow keys to move, Shift to sprint
- Space to pass, A to kick (hold to charge), S to switch player
