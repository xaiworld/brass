---
name: AlphaZero-style bot training
description: Neural network bot training status and next steps — Python training exports weights to Node.js inference
type: project
---

**Current state (2026-03-27):** v3 COMPLETE (MaxVP=73.3), deployed as v0.0.145. v4 training IN PROGRESS (true self-play, all 3 players = same network). v4 started BEFORE market sell price fix — need to retrain v5 after v4 finishes.

**Architecture:** BrassNetV2 — 2.4M params, 3 residual blocks of 512-dim, LayerNorm. Value head (predict VP) + Action scorer (rank valid actions). Pure JS inference in Node.js via lib/nn-inference.js.

**Training progression:**
- v1: 100 iters, MaxVP=60.6 (basic 463K network)
- v2: 500 iters, MaxVP=67.8 (residual 2.4M network)
- v3: 500 iters from v2, MaxVP=73.3 (reward shaping, cyclic LR)
- v4: 500 iters from v3, true self-play (RUNNING — check tasks/b5wkgocpk.output)
- v5: TODO — retrain with fixed market sell price (most expensive first)

**Key insight from user:** In Brass, good opponents CREATE opportunities (ports, links, shared resources). Self-play with copies of the best bot produces richer games and higher VP ceilings.

**Key bottlenecks to fix:**
1. Market sell price was WRONG (fixed in v0.0.146) — cubes were filling cheap slots, should fill expensive first. Python engine also fixed. Need to retrain.
2. MCTS broken (returns VP=3) — needs debugging
3. Python engine may have other subtle rule diffs vs Node.js
4. Compare Python vs Node.js engine for same game to find remaining diffs

**How to apply:** Check training/checkpoint_v4_*.pt for latest. Export best weights, compact to lib/nn-weights.json, push. After v4, start v5 with correct market economics.
