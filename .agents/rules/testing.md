---
trigger: always_on
---

# Testing Rules

When testing or verifying changes, follow these strict rules to ensure efficiency and speed:

1. **NO SNAPSHOTS OR SCREENSHOTS**: Do not use browser snapshots, screenshot tools, or browser subagents to visually verify UI changes. These methods are too time-consuming.
2. **USE FAST TESTS ONLY**: Rely exclusively on fast testing methods. This includes:
   - Verifying terminal output (e.g., build logs, error messages).
   - Inspecting code logic directly.
   - Using fast unit or integration testing if available.
3. **TRUST THE CODE**: If visual confirmation is needed, rely on verifying the DOM structure, CSS classes, or internal component logic rather than rendering and capturing an image.
