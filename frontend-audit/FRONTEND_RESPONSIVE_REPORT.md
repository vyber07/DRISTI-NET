# Frontend responsive report

Viewports tested: **1440×900** (desktop), **900×1100** (tablet), **390×844** (phone), headless Chromium.
Screenshots: `screenshots/after/{desktop,tablet,phone}_*.png` and `x_*.png`; the old UI's are in `screenshots/before/`.

| Behaviour | Before | After |
|---|---|---|
| Case pages below 768 px | A "Best experienced on tablet or desktop" notice only; no case content | Every case tab renders in a single column; the tab row scrolls sideways; tables scroll inside their card |
| Sidebar below 1024 px | Always visible (240 px), squeezing the content | Hidden; opened as an overlay drawer from the top-bar menu button, closed on navigation, the backdrop, or ✕ (`x_phone_nav_open.png`) |
| Graph detail panel | `absolute` against the page; covered the top bar | In the layout at ≥1024 px (380 px wide); below that, an overlay inside the graph area with a Hide/Show control |
| Dialogs | Fixed `max-w-lg`; could exceed the viewport | `w-[calc(100vw-2rem)]`, `max-h-[calc(100vh-2rem)]`, scrollable |
| Horizontal page overflow | 0 of 56 captures | 0 of 61 captures (`scrollWidth > viewport` checked per capture) |

**Breakpoints in use:**
- `sm` (640): table columns become visible.
- `md` (768): table columns, the top-bar jurisdiction.
- `lg` (1024): fixed sidebar, inline graph panel.
- `xl` (1280): wider review layout and evidence action labels.

**Not covered:**
- landscape phones;
- 200–400% browser zoom;
- touch interaction with the graph canvas (pinch and drag work through Sigma, but weren't tested);
- printing.
