# Campaign planner UI

The planner lives at `/settings/campaign-engine`. Simple mode is the default. The optimizer, state transitions, payout rules and existing regression tests were not rewritten.

## Components

- `StateBuilderDrawer`: preset/catalog loading, phase-specific current-state fields, validation and Calculate Path. Cancel discards edits. Saving changes only the planning workspace.
- `CustomRuleBuilder`: account/evaluation/funded/payout rules, conditional DLL and consistency, trail lock, scaling tiers, payout caps and buffered-surplus settings.
- `CampaignSummaryCards`, `NextTradeRecommendation`, `EngineExplanation`, `OutcomeBranchCard`: contextual summaries and actual engine branches.
- `CampaignProjectionChart`: existing Lightweight Charts dependency, separate right-axis PA equity and left-axis real cash. Adds engine-calculated payout events and trail-lock markers. Optional dashed branches show immediate loss cash, not recursively enumerated outcomes.
- `PathExplorer` / `PathAlternativeCard`: up to five choices. Click previews; Use This Path persists a first-action override tied to the exact rules/state/options snapshot. Later targets are recalculated through the existing optimizer. State/rule changes invalidate the override.
- `ProjectedPathTimeline`: all-target trade days and payout/pass events.
- `AdvancedEnginePanel`: all original JSON editing, recommendation output, ranking, metrics, warnings and immutable transition history remain accessible.

## Handoff to terminal

Use In Trading Terminal works only when the planning state belongs to an existing campaign (import its snapshot first). Synthetic examples cannot target an unrelated campaign. It sets an in-memory campaign objective and opens the terminal, with no broker/extension call.

The terminal converts per-account dollar targets/stops to price exits using the existing instrument, direction, quantity and tick conversion. Configured hedge ratio is transferred as a percentage in Manual mode to avoid the legacy auto-ratio/roadmap overwriting it. Entry, direction and quantity are not changed; quantity/direction changes recalculate objective exits. Tick rounding can make the executable dollars differ slightly. Copy-account sizing remains the terminal's existing responsibility.

Working orders block loading a planner draft. The handoff does not confirm, arm, submit, cancel or simulate an order. Returning to roadmap defaults clears the objective. Planner overrides are saved in the planning session; terminal objectives are intentionally in-memory drafts.

## Limits and assumptions

- Existing engine assumptions remain: one completed trade per day, divisible linear hedge, bounded search, unsupported unlocked intraday trails. No invented probabilities or guarantees.
- Catalog presets reuse local configured rules; they are not newly verified provider offers. Example presets are synthetic. Custom state changes do not update campaign ledgers.
- Imported legacy summaries lack authoritative MLL peaks and day/payout counters. Review these before planning.
- Changing phase in the drawer creates a fresh phase state and preserves real cash/basis; the user must enter actual balances/counters. It is not an inferred transition or activation fee payment. Use simulation activation/payout controls for an actual modeled transition.
- Alternative continuation search is a fresh bounded calculation after the selected first trade, not a stored tree from the original ranking. Only factual labels (lower/higher first target, trail lock) are shown.
- The chart starts at current real cash (which includes prior purchase/hedge costs), not at a fabricated historical purchase event. Payout markers use `applyPayout`, never synthetic equity plus real cash.
- Native Rust/Tauri compilation requires a Rust toolchain. Browser persistence and engine SQLite serialization tests cover the session structure.

## Payout-cycle cash objective (engine v1.2)

Payout Cycle is distinct from evaluation and first-PA recovery. It does not divide a recovery basis by drawdown. The engine searches resolved payout/failure policies and chooses the policy with the highest lower terminal real-cash outcome. At each trade it balances branches with `h = max(0, (W - L) / (target + stop))`, where `W` and `L` are optimized future cash increments after a target or loss. This accounts for survivable DLL losses and later decisions rather than treating every loss as immediate account failure.

Payout-cycle trails are already locked by the completed first-payout phase. The saved-state migration marks legacy payout-cycle sessions locked while preserving their entered MLL floor, and the state builder no longer asks for a trail status in this phase. Future payouts also preserve locked status.

The result is deterministic model output, not a guaranteed trading return. Unresolved search leaves are excluded rather than assigned zero cash; if both branches cannot resolve within the configured horizon, no hedge is recommended. Existing real cash shifts both terminal values equally. Execution cost is modeled per trade, while recovery-reserve inputs do not control this phase.

## Checks

`pnpm test:engine` (25 original tests), `pnpm test:planner` (15 form/component/presentation tests), and `pnpm build`.
Browser QA: Simple mode, drawer layout, regression example, buffered cash projection and payout marker. No live order submitted.
