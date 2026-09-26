# TASK_STATE.md — Cricket Scorer App

## 1. Current Objective
Phase 3 — bugs, redesigns, and architecture fixes complete. Build passes, 42 tests pass.

---

## 2. Status & Completed Work

### MVP Bug Fixes & Unit Testing (COMPLETED)
- [x] Initial 8 MVP bugs resolved and verified.
- [x] Vitest installed and 32 unit tests passing cleanly.
- [x] TypeScript build passes with zero errors.
- [x] GitHub Action for preview URLs successfully deployed.
- [x] App rebranded to "InsideOut".

### Phase 3 — All 17 bugs + 2 architecture fixes (COMPLETED)
- [x] Bug #9 — Bowler overs double-formatOvers bug fixed (rawBowlerBalls helper)
- [x] Bug #10 — Wicket on last ball of over (pendingNewBowler state, bowler modal follows batsman modal)
- [x] Bug #12 — Wicket dialog: "Who is out?" only for Run Out; fielder autocomplete added
- [x] Bug #13 — Run Out redesign: batting/bowling end toggle, "Who is out?" selector, runs completed
- [x] Bug #14 — Swap Batsmen button + swapBatsmen store action
- [x] Bug #8 — ScoringPage full Cricbuzz-style redesign (Live/Scorecard/Overs tabs, score hero, P'SHIP, tables)
- [x] Bug #7 — Sticky bottom action bar (Undo, Swap, Retire Hurt always visible)
- [x] Bug #11 — Keyboard cover fixed (scrollIntoView on focus, max-h on modal)
- [x] Bug #5/#6 — Opening players modal: onMouseDown autocomplete, scrollIntoView on focus
- [x] Bug #1 — Dynamic header (screen name per route, hidden on Home + ScoringPage)
- [x] Bug #2 — Home: removed "Your Active Match" card, Live Matches moved above Start button
- [x] Bug #15/#16 — Scorecard redesign + D1 fix: opening batsmen pre-populated in battingCard
- [x] Bug #17 — New OversList component (ball-by-ball, team selector tabs, ball bubbles)
- [x] Bug #3 — Input clamping fixed: raw string state, validate on submit only
- [x] Bug #4 — Toss section renamed; buttons: "Skip Toss" / "Enter Toss Result"
- [x] Architecture fix H1 — firestore.indexes.json composite index for onLiveMatchesSnapshot
- [x] Phase I — 10 new unit tests (42 total, all passing)

### Phase 4 — New Bugs Micro-Batches
- [x] **Batch 1 (Quick Wins)**:
  - [x] Bug #1: Renamed "Players" label to "Players Per Side" in `MatchSetupPage.tsx`
  - [x] Bug #3: Added "Cancel" button in `MatchSetupPage.tsx`
  - [x] Bug #8: Renamed "Swap" button to "Swap Strike" in `ScoringPage.tsx`
- [x] **Batch 2**: Bug #5 (Player suggestions dismiss on click)
- [x] **Batch 3**: Bug #9 (Dismissal text formatting)
- [x] **Batch 4**: Bugs #7 + #10 (Undo multi-step & scorecard math restoration)
- [x] **Batch 5**: Bug #4 (Route consolidation)
- [x] **Batch 6**: Bugs #6 + #13 (Sticky action bar & universal wicket modal viewport architecture)
- [ ] **Batch 7**: Bug #11 (Overs tab data refresh & dynamic team labels)
- [ ] **Batch 8**: Bug #12 (Retired hurt player score preservation)
- [ ] **Batch 9**: Bug #2 (Toss toggle switch)

---

## 3. Remaining Work
- [ ] Complete Phase 4 batches 2 through 9 in sequential micro-batches.
- [ ] **Deferred Lower-Priority Items** (To be tackled AFTER resolving Phase 4 bugs):
  - [ ] Phase D2–D4: Scorecard collapsible innings panels redesign (Cricbuzz-style), `matchStore` subscription to `innings2`, and passing both innings in `MatchViewPage`.
  - [ ] Phase H2–H3: Google Sign-In linking for anonymous users (`authStore.linkWithGoogle` and banner in `MatchSetupPage`).
  - [ ] Deploy Firestore composite index (`firebase deploy --only firestore:indexes`).

---

## 4. Exact Next Step
Await user verification and approval of Batch 1 before proceeding to Batch 2 (Bug #5).

---

## 5. Important Decisions & Constraints
- **State Management**: Zustand stores (`scoringStore.ts`, `matchStore.ts`, `authStore.ts`)
- **Scoring Requirement**: Match cannot record balls without `striker`, `nonStriker`, and `currentBowler`
- **Firebase Auth**: Anonymous auth for guests + Google sign-in. Match creator's `user.uid` is `scorerId`
- **Unit Testing Standard**: Run `npm test` before declaring any feature or bug fix complete
- **rawBowlerBalls(overs: number)**: Convert display format (e.g. 2.4) → raw ball count (e.g. 16). Internal to scoringStore.ts
- **ScoringPage has its own header** — AppShell header is hidden on `/match/:matchId/score` route
- **Scorecard.tsx still needs the collapsible panels redesign** — Phase D2 pending
