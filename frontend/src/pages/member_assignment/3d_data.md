# 3D Floor — Coordinate Reference

Quick reference for the board-to-floor coordinate mapping.
See `3dBehaviorSpec.md` and `FINDINGS_AND_PLAN.md` for full details.

## Board orientation on the XZ plane

The 2D board is rotated via `rotateY(90deg) rotateX(90deg)` onto the XZ floor plane:

- **Board top edge** → world **-X** direction (negative X, away from viewer)
- **Board bottom edge** → world **+X** direction (positive X, toward viewer)
- **Board left edge** → world **+Z** direction
- **Board right edge** → world **-Z** direction

This means the board's vertical axis (team rows) aligns with the world X axis,
and the board's horizontal axis (days/time) aligns with the world Z axis (inverted).

## Formulas

```
worldX = (boardPixelY + boardDims.offsetY + SCROLL_Y_PAD) - boardDims.h / 2
worldZ = boardDims.w / 2 - (boardPixelX + boardDims.offsetX)
```
