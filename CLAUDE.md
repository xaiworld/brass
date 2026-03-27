# Brass: Lancashire — Project Context

## Overview
Web-based implementation of the board game "Brass: Lancashire" for multiplayer remote play. Built by user "xai" over 144+ versions.

## Tech Stack
- **Server**: Node.js/Express, EJS templates, session-file-store (1-year TTL)
- **Database**: JSON file-based (`data/db.json`) with atomic writes
- **Frontend**: SVG board rendering, vanilla JS, no frameworks
- **Deployment**: Render.com with persistent disk at `/data`
- **Repo**: https://github.com/xaiworld/brass

## Key Architecture
- `server.js` — Express entry point, binds 0.0.0.0
- `lib/game-engine.js` — Core game logic (~900 lines), all 6 action types + Wild Build
- `lib/board-data.js` — Board topology: 19 locations, 6 non-buildable, 35+ links
- `lib/industry-data.js` — Tile definitions matching physical game
- `lib/card-data.js` — 66-card deck, 2-player deck variant
- `lib/game-setup.js` — State initialization, era transitions, 2/3/4 player support
- `lib/scoring.js` — Canal and rail era scoring
- `lib/bot-engine.js` — Bot turn execution, strategy selection (NN > DRL > heuristic)
- `lib/bot-strategies.js` — DRL bots with 44 features, ValidActionGenerator
- `lib/nn-inference.js` — Pure JS neural network inference (loads nn-weights.json)
- `lib/nn-weights.json` — Trained BrassNetV2 weights (~30MB)
- `lib/notifications.js` — Web Push notifications (VAPID-based)
- `lib/db.js` — JSON database with users, games, states, history, push subscriptions
- `lib/version.js` — APP_VERSION and GAME_STATE_VERSION

### Client-side
- `public/js/board-renderer.js` — SVG rendering with draggable panels, industry icons
- `public/js/game-ui.js` — Game UI controller, floating hand, turn navigator, VP breakdown
- `public/js/board-data-client.js` — Client board data, player colors, industry images
- `public/css/style.css` — Full styling with mobile support (`.is-mobile` class)

### Routes
- `routes/lobby-routes.js` — Game creation, invites, bot tiers, quick games
- `routes/game-routes.js` — Game state API, action submission, history
- `routes/auth-routes.js` — Admin-only user creation, first-login password setup

## Game Features
- Full Brass: Lancashire rules (canal/rail eras, markets, scoring, income track)
- 2/3/4 player support (2P has reduced board, deck, markets)
- AI bots: Neural Network (BrassNetV2), DRL (parameterized), Heuristic fallback
- Bot tiers: Pro (temp=0.05), Average (temp=0.4), Noob (temp=1.0)
- SVG board with draggable/resizable panels, industry icon images
- Per-user node position persistence
- Server-side state history for full game replay
- Web Push Notifications (turn, start, finish, invite)
- Mobile-friendly: bottom tab bar, live DOM panels, touch-optimized
- In-game wiki with rules and strategy

## 2-Player Mode
Removed locations: Birkenhead, Ellesmere Port, Stockport, Macclesfield, Oldham, Rochdale. No Midlands external port. Yorkshire only from Colne. Lancaster-Scotland canal link added. Starting money £25, 6-slot markets (£2/2/3/3/4/4), 7 distant market tiles. Canal removes 2 cards, rail removes 0.

## Mobile UI
Detection: user-agent + touch + width <= 768px → `is-mobile` class on body. Early detection script runs before BoardRenderer.init(). Game page uses bottom tab bar (Info/Board/Hand/Actions/Log). Real DOM panels moved into overlay divs (not cloned). Floating hand always visible on Board tab with horizontal scroll. Turn nav fixed between hand and tabs. Market panels use MARKET_MOBILE positions on mobile.

## Neural Network Bot Training
Located in `training/` directory (Python + PyTorch):
- `game_engine.py` — Python port of game engine for fast self-play
- `neural_net_v2.py` — BrassNetV2: 2.4M params, 3 residual blocks, 512-dim hidden
  - State encoding: 1145 features (board, links, players, hand, strategy)
  - Action encoding: 35 features per action
  - Value head: predicts normalized VP
  - Action scorer: scores each valid action
  - MCTS implementation (broken — returns VP=3, needs fixing)
- `train_v3.py` — Current training: resume from v2 checkpoint, reward shaping, cyclic LR
- Best greedy eval: MaxVP=69.5, AvgVP=59.5 (v3 iter 225)
- Human-level target: 80-150+ VP

### Training Status
- v1: 100 iterations, MaxVP=60.6 (basic network, 463K params)
- v2: 500 iterations, MaxVP=67.8 (residual blocks, 2.4M params)
- v3: COMPLETE — 500 iters from v2, reward shaping, best MaxVP=73.3
- v4: IN PROGRESS — true self-play (all 3 players = same network), 500 iters from v3 checkpoint
  - Check: `tail -5 /private/tmp/claude-501/-Users-xai-brass/fb9c4340-1128-4023-b594-8211320236dc/tasks/b5wkgocpk.output`
  - NOTE: v4 was started BEFORE the market sell price fix — retrain after it finishes
- Deployed weights: v3 best (MaxVP=73.3) in `lib/nn-weights.json`
- Checkpoints saved in `training/checkpoint_v*.pt`

### Key Training Issues to Fix
1. Market sell price was FIXED in v0.0.146 — cubes now fill expensive slots first
   - Python engine also fixed in training/game_engine.py
   - Need to retrain with correct economics (after v4 finishes)
2. MCTS implementation broken (returns VP=3) — needs debugging
3. Too few sells in Python engine — connectivity mechanics may differ from Node.js
4. True self-play (v4) should help: good opponents build ports/links, enabling more sells
5. Consider comparing Python vs Node.js engine outputs for same seed to find rule diffs

## User Preferences
- User "xai" is the admin account
- Push changes frequently, iterate locally until satisfied
- Prefers terse responses, direct action
- Wants bots to reach human-level play (80-150+ VP)
- Mobile UX is important (friends play on phones)
- nodemon.json ignores data/ directory to prevent restart loops

## Session Memory
Persisted memory files are in `.claude-memory/` in the repo root. Read these at the start of a new session for user preferences, workflow style, and project status:
- `.claude-memory/MEMORY.md` — Index
- `.claude-memory/user_xai.md` — User profile and preferences
- `.claude-memory/feedback_workflow.md` — How to work with this user
- `.claude-memory/project_alphazero_bots.md` — Bot training status and next steps

## Recent Fixes (this session)
- **Market sell price** (v0.0.146): Was filling cheapest slots first, now fills expensive first
- **History navigation** (latest): Browsing multiple history states no longer loses live state
- **Admin fix mode** (v0.0.147): xai can edit game state in-game (Fix button in navbar)
- **Mobile panels**: Live DOM (not cloned), floating hand horizontal scroll, turn nav always visible
- **Web Push Notifications**: Turn, start, finish, invite notifications
- **2-player mode**: Full implementation with reduced board/deck/markets

## Development Notes
- `npm start` or `node server.js` to run locally on port 3000
- Current APP_VERSION: 0.0.147 (bump in lib/version.js before each push)
- Training v4 running: `python3 -u training/train_v4.py` (true self-play, ~5 hours)
- To deploy new weights: run training, then `python3 -c "..."` to compact best_v4.json → lib/nn-weights.json
- After v4 finishes, retrain v5 WITH the market sell fix for correct economics
