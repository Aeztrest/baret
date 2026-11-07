# @baret/ui

Design tokens and every component the surfaces share (`apps/web`, `apps/extension`). Consumed as TypeScript source, so a change here hot-reloads everywhere at once. Ported unchanged from Baret-Metropolis (2026-11-07), except: the network colour is the first chain's for now (per-chain colours: TASKS.md T2.12), and the Radix state test resolves Tailwind from this package.

## The inventory, and where it came from

The component list is not a guess. It is derived from `@baret/content`, which already holds every string the product says. Counting what the copy asks for gives the real surface area:

| The copy contains | Which means we need |
|---|---|
| 313 `label` keys | Label, and a field wrapper that pairs it with a hint and an error |
| 91 `action` entries | Button, in four variants and three sizes |
| 109 `hint` lines | The hint slot under every control |
| 25 policy fields | Switch, and a row that pairs it with a label and a hint |
| 21 `empty` blocks | EmptyState |
| 18 `rows` sets | A key-value row and a list |
| 16 `items` sets | Cards and ordered step lists |
| 9 `columns` sets | Table |
| 9 `steps` sequences | StepIndicator |
| 8 `confirm` blocks | Dialog, with a destructive confirmation shape |
| 5 `filters` sets | A filter chip group |
| 5 `errors` groups | ErrorState |
| 3 `tabs` sets | Tabs |
| 2 `search` fields | An input with a leading icon |
| 1 chart, 2 counters, 1 timer | Sparkline, Amount, Countdown |

That lands at roughly forty components, split two ways.

### From shadcn, then re-skinned

These are behaviour we should not write ourselves: focus management, keyboard handling, portals, accessible roles. We take the markup and replace the styling with our tokens.

Button, Input, Textarea, Label, Checkbox, Switch, Select, RadioGroup, Slider, Separator, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Tabs, Accordion, Table, Progress, Skeleton, ScrollArea, Collapsible, ToggleGroup, Sonner.

### Ours, because they carry the brand or the product

These have no shadcn equivalent, or the equivalent would fight the identity.

| Component | What it is |
|---|---|
| `Mark` | The hard hat. Dome, visor slit, chamfered brim. |
| `Tag` | The signature device. Eyelet, chamfer, coloured edge. |
| `Verdict` | The Safe, Caution, Blocked or Not-checked block on a sign request. |
| `Finding` | One risk finding: severity, title, plain sentence, expandable reason. |
| `Meter` | A cap bar that changes colour as it fills. |
| `ChangeRow` | A single line of "What changes", with a signed amount. |
| `Amount` | A number with a unit, tabular figures, never wrapping. |
| `AddressChip` | A truncated address with a copy affordance. |
| `OriginChip` | A site, with its favicon and its real origin. |
| `StatTile` | One stencil number and a label. |
| `Panel` | The square card. One rule, no radius, no shadow. |
| `Section` | The numbered page section with an eyebrow. |
| `EmptyState` | Reassuring and actionable, never apologetic. |
| `ErrorState` | Names the rule that fired and the option the reader has. |
| `StepIndicator` | Onboarding progress, eight steps or five. |
| `Countdown` | The auto-decline timer on a sign request. |
| `CodeBlock` | Mono, scrollable, with a copy control. |
| `Sparkline` | Seven days of spend, no axes. |
| `KeyValue` | A label and a value on one rule. |
| `HazardStripe` | The 135 degree orange and ink edge. |
| `FilterChips` | The single-select filter row. |
| `PolicyRow` | A switch, a label and a one-line explanation. |
| `FieldGroup` | Label, control, hint and error in the right order. |

## Restyling shadcn

Every generated component is edited before it ships. Three rules:

1. **No radius.** `--radius` is 0 and stays 0. The only softening in the system is the chamfer, and it belongs to tags and buttons only.
2. **No shadow.** Depth comes from the paper grain and the rule lines.
3. **shadcn's `--accent` is not our accent.** In shadcn's palette `--accent` is the subtle hover surface behind a menu item. Ours is International Orange. Mapping one to the other would paint every hover state orange and destroy the 90/8/2 ratio the brand depends on, so shadcn's `--accent` maps to `--ground-deep` and only `--primary` gets the orange.

## Layout

```
src/
├── tokens.css        the theme, the base layer and the utilities
├── cn.ts             class merge
├── brand/            Mark, HazardStripe
├── ui/               shadcn components, re-skinned
├── primitives/       ours
└── index.ts
```

## Checks

```bash
pnpm --filter @baret/ui typecheck
pnpm lint
```
