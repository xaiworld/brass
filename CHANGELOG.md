# Brass: Lancashire — Development Changelog

## 112 versions of iterative development

### Foundation (v0.0.1 - v0.0.7)
- **Initial commit**: Full Express.js app with session auth, game engine (all 6 actions), SVG board renderer, AI bots, in-game wiki, JSON file-based persistence, Render deployment config
- **Board corrections**: 19 buildable locations with dual-type slots (Cotton/Coal, Cotton/Port), 3 non-buildable waypoints (Northwich, Blackpool, Southport), 3 external ports (Scotland, Yorkshire, The Midlands)
- **Remember me**: Persistent login sessions with checkbox
- **Login fix**: Session save before redirect to prevent race condition
- **DB hardening**: Atomic writes (temp file + rename), backup recovery on corruption
- **Version tracking**: Games stamped with version, incompatible games show friendly message
- **UI overhaul**: Rectangular locations, side panels, collapsible log, map background image with opacity slider

### Data & Stats (v0.0.8 - v0.0.10)
- **User stats**: Games played, wins, VP tracking, per-opponent breakdown, game history page
- **Draggable nodes**: All board elements movable in edit mode, positions saved per user
- **Tile corrections**: Exact costs/VP/income from the physical game — Cotton Mill, Coal Mine, Iron Works, Port (4 levels), Shipyard
- **Card hover**: Location cards highlight the location, industry cards highlight valid build spots
- **Link fixes**: Lancaster-Scotland rail only, Preston-Fleetwood added, Wigan-Warrington canal+rail, Rochdale-Yorkshire, Ellesmere Port-Northwich

### Markets & Panels (v0.0.11 - v0.0.15)
- **Distant market tiles**: 11 shuffled tiles (0,0,-1,-2,-2,-2,-2,-3,-3,-3,-4) per era
- **Coal/Iron markets**: 8 slots each, prices £1,1,2,2,3,3,4,4
- **SVG panels**: Turn Order, Money Spent, VP, Income Track, Demand — all draggable
- **Money discs**: Silver £5 and bronze £1 discs in player bar
- **Player colors**: Red, Purple, Green, Yellow
- **Income/VP per row**: Industry mat shows income circle + VP hexagon once per level

### Interactive Cards (v0.0.16 - v0.0.22)
- **Actionable popups**: Hover card → clickable action buttons (Build, Link, Sell, Loan, Develop, Pass)
- **Floating hand**: Detachable card hand with drag, resize, golden ratio cards
- **Toggle links**: Show/hide link connections on the board
- **Collapsible panels**: Left panel, right panel, log — all collapsible
- **Minimal mode**: Transparent backgrounds on VP hexagons, income circles, money discs
- **Market panels vertical**: Coal/iron top-to-bottom £1→£4 with price inside squares

### Node Customization (v0.0.23 - v0.0.30)
- **Undo positions**: Reset undoes to previous state (50-step history)
- **"Like Xai" button**: Copy xai's saved layout
- **Resize mode**: Mouse wheel + corner handles + bottom bars to resize all SVG elements
- **Scale persistence**: Saved per user alongside positions
- **Golden ratio cards**: 1:1.618 ratio enforced, JS-driven sizing with ResizeObserver

### Visual Polish (v0.0.31 - v0.0.50)
- **Demand panel**: Income circles (+3,+2,+1,+0) per demand level, highlighted current row
- **Turn Order**: Ordinals (1st, 2nd, 3rd, 4th), spacing improvements
- **VP panel**: "VICTORY POINTS" label, hexagons with player colors, names centered
- **Income panel**: 100-square serpentine track (0-99), actual income values per square, curved U-turn arrows, player-colored markers
- **Slot colors**: Cotton=dim white, Coal=dark grey, Iron=orange, Port=blue, Shipyard=brown
- **Dual slots**: Diagonal split showing both industry type colors
- **Legend**: Left panel with color swatches and letter meanings
- **First round fix**: All players get 1 action in Canal era round 1

### Bot System (v0.0.51 - v0.0.56)
- **Bot announcements**: 🤖 prefixed log entries, overlay notifications
- **Configurable delay**: 1-5 second slider for bot action timing
- **Bot reliability**: Duplicate scheduling prevention, polling triggers
- **Quick game buttons**: "Quick Game (2 bots)" and "Quick Game (3 bots)" in lobby
- **VP hexagons**: Player-colored with pink outline, VP names properly spaced

### Account & Auth (v0.0.57 - v0.0.60)
- **User account page**: Change password, game history, member since, login tracking
- **Consistent navbars**: Lobby, Wiki, Stats, username (→account), Logout on all pages
- **Admin-only user creation**: No self-registration, xai creates users, first-login password setup
- **Card sorting**: Default, by type, alphabetical, type+alpha in floating hand

### Income Track & Logs (v0.0.61 - v0.0.72)
- **Proper 100-square income track**: -10 to +30 income per turn mapped correctly
- **Serpentine arrows**: Curved U-turn chevrons showing track flow direction
- **Detailed game logs**: Money before/after, income changes with squares moved, per-turn amounts
- **Round phase logging**: Phase 1 (income), Phase 3 (reorder), Phase 4 (draw cards)
- **Log timestamps**: Toggle to show "20 Mar 2026 14:30:05"
- **Log filters**: Per-player filter buttons, newest-first order
- **Colored log entries**: Each player's actions in their color

### Slot Visuals (v0.0.73 - v0.0.79)
- **Cotton Mill**: Dim whitish slot color (#f5f0ea55)
- **Coal icons**: Lighter on dark backgrounds, individually colored in dual slots
- **Preston fix**: Port, Cotton/Port, Iron Works (corrected from game board)
- **Industry stripe**: Thin color bar on top of built tiles showing industry type
- **Flipped hexagon**: Pink outline circumscribing flipped tiles (VP scored indicator)
- **Dimmed flipped tiles**: Lower opacity to show "already used"

### Lobby & Multiplayer (v0.0.80 - v0.0.89)
- **Bot fix**: nodemon.json ignores data/ to prevent restart loops
- **Lobby**: Only shows your games, system stats sidebar, game invites
- **Delete games**: Trash bin with confirmation (creator only)
- **Add bot button**: Fill player slots one at a time
- **Player count enforcement**: 3 players for 3p, 4 for 4p before start
- **Card deck**: 66 cards exactly matching the physical game
- **White headings**: Neutral blue-grey buttons instead of scarlet

### Bot Training (v0.0.90 - v0.0.91)
- **6 bot personalities**: Cautious Carl, Aggressive Ada, Builder Bob, Wildcard Wil, Balanced Bea, Devver Dan
- **Parameterized strategies**: Exploration rate + priority weights for each action type
- **Training runner**: Complete games in ~30ms, tournaments with rankings
- **Tier system**: Pro/Average/Noob assigned from tournament results
- **Background training**: Admin toggle, batches of 3 games every 10 seconds
- **Session TTL**: Fixed to 1 year, suppressed cleanup logs

### Game Flow (v0.0.92 - v0.0.99)
- **Build Industry filters**: Industry cards show only that type, location cards show allowed types
- **Wild Build**: Use 2 cards + 2 actions to build anywhere on the board
- **Develop step-by-step**: Pick 1st tile, optionally add 2nd, can pick same type twice
- **Turn order fix**: Spending zeroed AFTER reorder, ties keep previous position
- **Overbuilding**: Own tiles with higher level, opponent coal/iron if market empty

### Live VP & History (v0.0.100 - v0.0.112)
- **Live VP**: Real-time calculation from flipped tiles + links + money/10
- **VP hover breakdown**: Popup showing scored, tiles VP, links VP, money VP with item list
- **Server-side state history**: Every action stores a snapshot for full game replay
- **Turn navigator**: ⏮◀▶⏭ buttons to browse entire game history action by action
- **External ports**: Scotland, Yorkshire, The Midlands as clickable "P" icons for selling
- **Colored cubes**: Iron orange, coal grey in mat brackets and log messages
- **Income in mat**: Numbers without + sign, cubes cost shown per level
- **Reset training**: Admin button to clear all training data

---

*Built iteratively through 112 versions of user-driven development, from a blank repository to a full multiplayer board game with AI opponents, training framework, and comprehensive game state management.*
