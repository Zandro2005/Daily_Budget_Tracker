# Testing & Verification Rules

The user handles visual/UI testing manually. Keep verification fast.

## Do NOT
- Do NOT take screenshots (Playwright `browser_take_screenshot`, browser subagent screenshots, etc.).
- Do NOT use Playwright `browser_snapshot`, `browser_navigate`, `browser_click`, or any other browser automation for testing.
- Do NOT launch the `browser_subagent` or record browser sessions for verification.
- Do NOT run long end-to-end or visual test flows.

## Do
- Verify changes with fast checks only, e.g. `npm run build` (compile check) or a quick lint/unit test if one exists.
- After making changes, briefly tell the user what changed and what they should check manually in the app.
- Only use browser tools if the user explicitly asks for it in that request.
