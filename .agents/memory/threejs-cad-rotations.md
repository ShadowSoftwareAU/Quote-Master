---
name: Three.js CAD rotations
description: How to keep compliance geometry aligned with the 3D renderer when CAD components use combined-axis rotations.
---

Compliance bounds must use the same XYZ Euler transform as the installed Three.js version. Validate combined-axis results numerically against `Matrix4.makeRotationFromEuler` rather than relying on generic matrix-composition labels.

**Why:** Different descriptions of Euler order can imply different multiplication order conventions. A review incorrectly rejected a formula that matched Three.js, then the proposed replacement failed a direct numerical comparison.

**How to apply:** Whenever CAD rotation handling or Three.js versions change, retain a combined-axis regression case and compare its world-space bounds with Three.js before accepting the change.