---
name: Workflow preferences
description: User prefers frequent pushes, local iteration, always push when asked, bump version
type: feedback
---

Always bump APP_VERSION in lib/version.js before pushing.
Push immediately when user says "push it" — don't ask for confirmation.
Run training in background and notify when done.
Test locally before pushing. User will test on mobile and give feedback.

**Why:** User iterates fast with friends testing on mobile. Every push triggers a Render deploy.

**How to apply:** After any code change, restart local server for testing. When user approves, bump version + commit + push in one step.
