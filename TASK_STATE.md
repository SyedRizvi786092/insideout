# TASK_STATE.md — Cricket Scorer App

## 1. Current Objective
Rebrand the app to "InsideOut", initialize Git, and connect to GitHub for preview URL automation.

---

## 2. Status & Completed Work
### MVP Bug Fixes & Unit Testing (COMPLETED)
- [x] All 8 MVP bugs resolved and verified.
- [x] Vitest installed and 32 unit tests passing cleanly.
- [x] TypeScript build passes with zero errors.

### GitHub Action Preview Channel Setup (COMPLETED)
- [x] Created PR preview workflow (`.github/workflows/firebase-hosting-pull-request.yml`).
- [x] Created production auto-deploy workflow on merge (`.github/workflows/firebase-hosting-merge.yml`).
- [x] Documented required GitHub repository secrets.

### App Rebranding: InsideOut (COMPLETED)
- [x] Updated `package.json` name to `insideout`.
- [x] Updated HTML title (`index.html`) to `InsideOut — Cricket Scorer`.
- [x] Updated top `Header.tsx` to `InsideOut`.
- [x] Updated `HomePage.tsx` title to `InsideOut`.
- [x] Verified tests (32 passed) and production build (0 errors).

---

## 3. Remaining Work
- [ ] Initialize local Git repo, commit code, and push to GitHub repository `insideout`.
- [ ] Add GitHub repository secrets for Firebase Hosting Preview channel.
- [ ] Create test branch and verify preview channel deployment.

---

## 4. Exact Next Step
Notify user that all 8 MVP bugs are resolved, 32 automated unit tests are in place, build passes cleanly, and the app is ready to deploy with `npm run deploy`.

---

## 5. Important Decisions & Constraints
- **State Management**: Zustand stores (`scoringStore.ts`, `matchStore.ts`, `authStore.ts`).
- **Scoring Requirement**: Match cannot record balls without `striker`, `nonStriker`, and `currentBowler`.
- **Firebase Auth**: Supports anonymous auth for guests and Google sign-in. Match creator's `user.uid` is `scorerId`.
- **Unit Testing Standard**: Run `npm test` before declaring any feature or bug fix complete.
