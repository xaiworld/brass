---
name: AlphaZero-style bot training
description: Neural network bot training status and next steps — Python training exports weights to Node.js inference
type: project
---

**Current state (2026-03-27):** v3 training running (500 iters from v2 checkpoint). Best eval: MaxVP=69.5. Target: 80-150+ VP (human level).

**Architecture:** BrassNetV2 — 2.4M params, 3 residual blocks of 512-dim, LayerNorm. Value head (predict VP) + Action scorer (rank valid actions). Pure JS inference in Node.js via lib/nn-inference.js.

**Training pipeline:** Python + PyTorch in training/ directory. Self-play generates (state, action, reward) tuples. Reward shaping: 40% normalized VP + 20% win + 20% absolute VP + 10% flips + 5% links + 5% income.

**Key bottlenecks to fix:**
1. Python game engine has subtle bugs vs Node.js engine — sells are too rare, only ~2 per game
2. MCTS implementation broken (returns VP=3) — needs debugging
3. generate_validated_actions uses expensive copy-test for each action
4. Need to compare Python vs Node.js engine outputs for same game to find rule differences

**How to apply:** When resuming bot work, check training/checkpoint_v3_*.pt for latest checkpoint. Export best weights via train script, copy to lib/nn-weights.json, push to remote.
