# Stair Dismount — Implementation Plan

Spec: `docs/superpowers/specs/2026-09-02-stair-dismount-design.md`. Same stack as the Wrecking Ball: Three.js 0.170.0 and `@dimforge/rapier3d-compat` 0.20.0 via importmap, vanilla JS, Node ≥ 18 for tests, headless Chrome for smoke tests and the screenshot.

Files: `3d-stair-dismount/index.html`, `3d-stair-dismount/test.mjs`, `3d-stair-dismount/screenshot1.jpg`, README entry, `gallery.yaml` override, gallery rebuild.

- [x] Task 1 — `test.mjs` runner and the `shared-code` block: `Dismount.stairs` (straight, dogleg, spiral, long), `Dismount.ragdoll` (build, place), `Dismount.score`, `DismountTests.run()`. Run `node 3d-stair-dismount/test.mjs` green. Commit.
- [x] Task 2 — Page: panel, Three.js scene, Rapier world from the staircase boxes, ragdoll bodies/joints from the rig, fixed-until-push, impulse, contact-force scoring, dismount-over detection, retry replay, camera orbit/follow, arrow gizmo, keys. Smoke test with the in-app Browser pane and headless Chrome (`__dismount.step`). Commit.
- [x] Task 3 — Screenshot mid-tumble via a temporary `_shot.html`, README entry, `gallery.yaml`, `python3 build_gallery.py`. Commit.
