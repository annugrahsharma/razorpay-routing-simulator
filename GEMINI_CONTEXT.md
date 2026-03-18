# Context for Building: NTF Check Filter Visualization

## What You're Building

A **Plinko/marble-run game** that visualizes whether payment routing rules will cause **NTF (No Terminal Found)** failures. This is a single-page React app (Vite + React 18, no UI library, vanilla CSS).

## Domain Context: Payment Routing at Razorpay

Razorpay processes payments for merchants. Each payment goes through a **routing pipeline** that decides which **bank terminal** processes it.

### Key Concepts

- **Terminal**: A bank endpoint that processes payments. Example: HDFC_T1, ICICI_T1, AXIS_T1. Each terminal has a success rate (SR%) and cost per transaction.
- **Gateway**: A bank that owns terminals. HDFC has HDFC_T1 and HDFC_T2. Each terminal supports specific payment methods (Cards, UPI, NB).
- **Routing Rule**: A filter rule that says "for this type of payment, only use these terminals." Rules have conditions (payment method, card network, amount) and target terminals.
  - **SELECT rule**: "Route Visa Cards to HDFC_T1" — only HDFC_T1 is eligible
  - **REJECT rule (implicit)**: By selecting specific terminals, all others are rejected
  - **Volume Split rule**: "70% to HDFC, 30% to ICICI" — for TSP deals
- **NTF (No Terminal Found)**: When ALL terminals are eliminated by rules for a given payment type, the payment fails. This is the #1 thing KAMs need to prevent.

### The Problem This Solves

A Key Account Manager (KAM) creates routing rules for a merchant. They might accidentally create rules that block ALL terminals for certain payment types (e.g., "UPI payments" have no eligible terminal after rules are applied). This causes NTF — payments fail silently.

**This visualization helps KAMs see, before they deploy rules, whether any payment type will result in NTF.**

## The Visualization: Plinko NTF Checker

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Left Panel (280px)  │  Right Panel (flex)                   │
│                      │                                        │
│  Payment Definition  │  ┌─ NTF Status Banner ──────────┐    │
│  • Method ▼ (Cards)  │  │  ✅ Safe — 2/4 doors open     │    │
│  • Amount: ₹5000     │  │  OR                           │    │
│  • Card Network ▼    │  │  ⚠️ NTF! All doors closed     │    │
│  • Card Type ▼       │  └──────────────────────────────┘    │
│  • International □   │                                        │
│                      │  ┌─ Plinko Board ──────────────┐     │
│  [Simulate ▶]        │  │                              │     │
│                      │  │     Funnel (payment entry)    │     │
│  ─────────────────   │  │         ╲      ╱              │     │
│  Pipeline Result:    │  │     ·  ·  ·  ·  ·  (pegs)    │     │
│  • Routed to HDFC_T1 │  │    ·  ·  ·  ·  ·  ·          │     │
│  • SR 73.5%          │  │     ·  ·  ·  ·  ·             │     │
│  • Cost ₹1.80        │  │                               │     │
│                      │  │  ┌OPEN┐ ┌SHUT┐ ┌OPEN┐ ┌SHUT┐ │     │
│                      │  │  │ ↓  │ │ ✕  │ │ ↓  │ │ ✕  │ │     │
│                      │  │  └────┘ └────┘ └────┘ └────┘ │     │
│                      │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ │     │
│                      │  │  │HDFC│ │HDFC│ │ICIC│ │YES │ │     │
│                      │  │  │ T1 │ │ T2 │ │ T1 │ │ T1 │ │     │
│                      │  │  └────┘ └────┘ └────┘ └────┘ │     │
│                      │  └──────────────────────────────┘     │
│                      │                                        │
│                      │  ┌─ Rule List ──────────────────┐    │
│                      │  │  🟢 UPI → RBL           [ON]  │    │
│                      │  │  🟢 Default Routing      [ON]  │    │
│                      │  └──────────────────────────────┘    │
└─────────────────────┴────────────────────────────────────────┘
```

### How It Works

1. **User defines a payment** in the left panel (method, amount, card network, etc.)
2. **Click "Simulate"** → runs the routing pipeline to determine which terminals are eligible
3. **Plinko board appears**:
   - **Funnel** at top: shows the payment type entering
   - **Peg grid**: decorative bouncing pegs (6 rows, staggered)
   - **Doors** (one per terminal):
     - **OPEN (green)**: terminal is eligible — ball can pass through
     - **CLOSED (red with X)**: rule blocks this terminal — ball bounces off
   - **Bins** below doors: terminal name, gateway, SR%
4. **25 balls rain down** through the peg grid:
   - Balls bounce off pegs (CSS keyframe animation with jitter)
   - Balls pass through OPEN doors into bins
   - Balls bounce off CLOSED doors and pile up (NTF)
5. **NTF Banner**:
   - If ANY door is open → green "Safe" banner
   - If ALL doors are closed → red "NTF Risk" banner with warning

### Interactivity

- **Click a door** to toggle it open/closed → this toggles the rule that controls it
- **Rule list** below the plinko board — click a rule to toggle ON/OFF
- When a rule is toggled, doors update immediately and balls re-drop automatically
- **Left panel** shows the pipeline result: which terminal was selected, SR, cost

## Data Model

### Merchant (example: BigBasket)
```javascript
{
  id: 'merch-005',
  name: 'BigBasket',
  gatewayMetrics: [
    { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-001', successRate: 73.5, costPerTxn: 1.80, txnShare: 35, supportedMethods: ['Cards'] },
    { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-002', successRate: 72.1, costPerTxn: 0, txnShare: 20, supportedMethods: ['UPI'] },
    { gatewayId: 'gw-icici', terminalId: 'term-icici-001', successRate: 72.8, costPerTxn: 1.70, txnShare: 30, supportedMethods: ['Cards', 'NB'] },
    { gatewayId: 'gw-yes', terminalId: 'term-yes-001', successRate: 69.1, costPerTxn: 0, txnShare: 15, supportedMethods: ['UPI'] },
  ],
  routingStrategy: 'success_rate',
  srThresholdLow: 87,
}
```

### Gateway
```javascript
{ id: 'gw-hdfc', name: 'HDFC Bank', shortName: 'HDFC', terminals: [
  { id: 'term-hdfc-001', terminalId: 'HDFC_T1', successRate: 73.5, costPerTxn: 1.80 },
  { id: 'term-hdfc-002', terminalId: 'HDFC_T2', successRate: 72.1, costPerTxn: 0 },
]}
```

### Routing Rule
```javascript
{
  id: 'rule-merch-005-001',
  name: 'UPI → RBL',
  type: 'conditional',
  enabled: true,
  priority: 1,
  conditions: [{ field: 'payment_method', operator: 'equals', value: 'UPI' }],
  conditionLogic: 'AND',
  action: { type: 'route', terminals: ['term-rbl-001'], splits: [] },
  isDefault: false,
}
```

### Transaction (payment to simulate)
```javascript
{
  payment_method: 'Cards',  // 'Cards' | 'UPI' | 'NB'
  amount: 5000,
  card_network: 'Visa',     // only for Cards
  card_type: 'credit',      // only for Cards
  international: false,
}
```

### How Filtering Works

For a given payment type:

1. **Pool Assembly**: Start with ALL merchant terminals. Filter out terminals that don't support the payment method (e.g., HDFC_T1 supports only 'Cards', so it's eliminated for UPI payments).

2. **Rule Evaluation**: Walk rules in priority order. For each matching rule:
   - The rule specifies target terminals (e.g., `['term-rbl-001']`)
   - All terminals NOT in the target list are eliminated
   - If this eliminates ALL remaining terminals → NTF

3. **Result**: List of eligible terminals, or NTF if none remain.

### Door State Logic

For each terminal, determine if its door is OPEN or CLOSED:

```
door_state(terminal) =
  IF terminal doesn't support payment_method → CLOSED (reason: "Not eligible for {method}")
  IF terminal is eliminated by a rule → CLOSED (reason: "Rule: {rule_name}")
  IF terminal is in disabled_terminals set → CLOSED (reason: "Terminal down")
  ELSE → OPEN
```

## Technical Requirements

### Stack
- React 18 + Vite (already set up)
- Vanilla CSS (no Tailwind, no UI library)
- SVG for the plinko board
- CSS @keyframes for ball animation

### Existing Code You Can Reuse

The routing engine is already built in `src/data.js`. Key function:

```javascript
import { simulateRoutingPipeline, gateways, merchants, generateSeedRules } from './data'

// Run simulation for a payment
const result = simulateRoutingPipeline(merchant, transaction, rules, overrides)
// Returns: { stages[], isNTF, selectedTerminal, warnings[] }

// Each stage has: { type, terminalsRemaining[], terminalsEliminated[], ... }
// Types: 'initial', 'rule_filter', 'rule_ntf', 'rule_skip', 'rule_pass', 'sorter', 'ntf'
```

### Ball Animation Approach

Each ball gets unique CSS @keyframes:
- Start at funnel center (top)
- Bounce through 6-8 peg positions (random jitter per peg)
- End at target bin (if door open) or bounce back (if door closed / NTF)
- Duration: ~1800ms per ball
- Stagger: 80ms between balls
- Use `requestAnimationFrame` or `setInterval` to add balls one at a time

```javascript
// Generate unique keyframe name per ball
const animName = `plinko-ball-${ballIndex}`

// Inject via <style> tag in component
<style>{`@keyframes ${animName} { 0% { ... } 50% { ... } 100% { ... } }`}</style>

// Apply to SVG circle
<circle r={6} style={{ animation: `${animName} 1800ms ease-in-out forwards`, animationDelay: `${delay}ms` }} />
```

### CSS Variables (design system)
```css
--rzp-blue: #528FF0;
--rzp-success: #1EA672;
--rzp-danger: #E74C3C;
--rzp-warning: #F5A623;
--rzp-bg: #F7F8FA;
--rzp-card-bg: #FFFFFF;
--rzp-border: #E2E8F0;
--rzp-text-primary: #1A202C;
--rzp-text-secondary: #718096;
--rzp-text-muted: #A0AEC0;
```

### Key Visual Elements

**Funnel** (SVG trapezoid):
- Shows payment type label ("Cards · ₹5000")
- Blue gradient

**Pegs** (SVG circles):
- 6 rows, staggered grid pattern
- Small gray dots (r=3-4px)
- Purely decorative — balls bounce off them visually

**Doors** (SVG rectangles):
- Width: ~60-80px per terminal
- Height: ~50px
- OPEN: Green border, green down-arrow inside, "OPEN" label
- CLOSED: Red fill, white X mark, reason text below ("Rule: UPI → RBL")
- Clickable — toggle the associated rule
- Hover: highlight ring + tooltip "Click to open/close"

**Bins** (SVG rectangles below doors):
- Terminal ID (monospace font)
- Gateway name
- SR percentage
- Green background if open, red/faded if closed

**Balls** (SVG circles):
- r=6px
- Color by payment method: Cards=#3b82f6, UPI=#16a34a, NB=#9333ea
- Glow filter for visibility
- NTF balls: red (#ef4444), bounce off closed doors

**NTF Banner** (HTML div above the SVG):
- Green: "✅ {N} of {total} doors open — payments will route successfully"
- Red: "⚠️ NTF Risk — All terminals blocked for {method} payments"

**Rule List** (HTML below the SVG):
- Each rule: dot (green=ON, red=OFF) + rule name + toggle label
- Clickable to toggle
- `rule.isDefault` rules shown but not toggleable

### NTF Scenarios to Test

1. **BigBasket + Cards**: 2 of 4 terminals support Cards (HDFC_T1, ICICI_T1). Rule "UPI → RBL" doesn't match Cards → skipped. Both doors open. **SAFE.**

2. **BigBasket + UPI**: 2 terminals support UPI (HDFC_T2, YES_T1). Rule "UPI → RBL" activates → routes to RBL_T1, but BigBasket doesn't HAVE an RBL terminal → both UPI terminals eliminated → **NTF!**

3. **Swiggy + Cards**: TSP volume split rule sends 70% to HDFC_T1. HDFC_T1 supports Cards. **SAFE.**

### File Structure

```
src/
  App.jsx          — Layout: left panel (payment form) + right panel (plinko)
  FilterDiagram.jsx — The plinko NTF checker (this is what you're building)
  PaymentForm.jsx  — Left panel form + result display
  data.js          — Routing engine + mock data (DON'T MODIFY)
  styles.css       — All styles
  main.jsx         — Entry point
```

### Existing `data.js` Exports You Need

```javascript
// Data
export const gateways        // Array of 5 banks, 2 terminals each
export const merchants        // Array of 3 demo merchants

// Functions
export function generateSeedRules(merchant)  // Returns rules array for a merchant
export function simulateRoutingPipeline(merchant, transaction, rules, overrides)
  // overrides: { disabledRules: Set, disabledTerminals: Set, srThreshold, routingStrategy }
  // Returns: { stages[], isNTF, selectedTerminal, warnings[], stageCount }
```

### Deployment

- GitHub Pages via GitHub Actions (already configured)
- `npm run build` then push to `main` branch
- Base path: `/razorpay-routing-simulator/`
- Repo: `annugrahsharma/razorpay-routing-simulator`
