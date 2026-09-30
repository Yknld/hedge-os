# Campaign Engine v1.1

## Buffered surplus extension

`PayoutRule.model` now accepts `PROFIT_CONVERSION` (the default for existing saves) or `BUFFERED_SURPLUS`. Configure `bufferedSurplus.bufferBalance` or `bufferAboveStartingBalance`, `bufferIsProtected`, and `payoutReducesBalance`. Split, minimum payout, caps and qualifying-day rules remain in the shared payout/funded structures so they have one source of truth.

For buffered payouts, surplus is equity above the protected buffer and trader cash is `min(surplus × profitShare, cap)`. Caps and minimums in this model are **net trader cash**. Gross equity debited is net cash divided by the split. The existing profit-conversion model retains its gross-cap semantics. A non-debit payout tracks consumed surplus to prevent paying out the same unchanged equity repeatedly. A payout never moves the MLL floor. If buffer protection is disabled, the configured starting balance becomes the withdrawal threshold; the MLL safety floor still applies.

Consistency can explicitly use total accumulated account trading PnL (before withdrawals), current cycle profit, profit since the last payout, or withdrawable surplus. `resetsAfterPayout` controls the largest-day window independently of the denominator. Omitted fields retain legacy consistency behavior. Profit-since-payout and consumed-surplus counters are additive optional state fields, so old saved snapshots still load.

Settings includes a **Buffered surplus — 50% consistency** example, buffer-building/locked/surplus/eligible state labels, the protected balance, available surplus, first payout balance and consistency denominator. These funded substates are derived from rules and current state, not persisted as an independently editable counter. The candidate generator compares the buffer boundary, a consistency-sized buffer split, direct minimum payout, and divided payout targets.

Regression results: $1,050 + $1,050 + $500 → $500 payout → $52,100 equity and unchanged $50,100 floor. A single $2,600 day requires $5,200 total consistency profit and cannot immediately pay out. For the synthetic sample, the bounded search selects $1,300 + $1,300; it is not a provider-specific roadmap. Net split/cap handling, non-debit entitlement, four consistency denominators and reset behavior are tested. The existing 40% evaluation and Daily/Flex examples remain covered.

Open **Settings → Campaign state machine → Open Campaign Engine**.

## Architecture and scope

The workspace runs `optimizeCampaign(state, rules, options)` independently of the TradingView execution bridge. It calculates trade geometry, simulates complete TP/SL days, activates the funded phase after an evaluation pass, and processes simulated payouts. It does not send orders. The existing trading-screen roadmap remains available while this engine is reviewed through Settings.

`types.ts` defines the normalized account rules, complete campaign state, action, recommendation and audit record. `rules.ts` implements account mechanics. `state.ts` implements pure transitions. `optimizer.ts` generates boundary candidates and searches their two outcomes. `adapter.ts` imports existing campaign summaries; `examples.ts` supplies synthetic regression accounts, not current provider claims.

## Rules schema

Account rules include starting balance, evaluation and activation fees, optional evaluation, and funded rules. Phase rules include drawdown, optional DLL, consistency and contract limits. Funded rules also support scaling tiers, qualifying-profit days, payout frequency, conversion, trader split, numbered/default caps and reset policies. Money is represented in dollars, ratios as fractions (0.40 means 40%). Exact targets are rounded upward to cents; intermediate accounting retains precision.

Static and EOD trailing floors are implemented. EOD locks and floor caps are explicit. An **unlocked intraday trail is rejected for recommendation and simulation**: a binary close result does not specify the earlier intraday peak, which can change whether a loss fails the account. This needs an additional intraday excursion model, not a guess.

## State schema

The state contains balance, starting balance, peak, floor and lock flag; phase/day/cycle profit; largest day and consistency window; trading/profitable/qualifying-day counters; payout count and net receipts; contract capacity; real basis, cash, hedge PnL, execution costs and peak capital. Dedicated payout-day and consistency reset counters prevent one reset policy from corrupting another.

States with equal balances and different largest winning days remain distinct. Memo keys contain the full serialized state plus remaining search depth and budget. No balance-only merging occurs.

Legacy campaign imports are per account. Historic MLL peaks, payout counts and day counters cannot be reconstructed from the old summary data. The UI asks the user to review the imported JSON snapshot. Existing campaign, ledger and trade data are preserved. Imported snapshots and simulations live in the engine workspace; they do not overwrite real campaign balances.

## Transition accounting

V1 treats each complete trade as the last trade of a session. TP/SL updates balance and daily totals, then closes the day, applies EOD trailing/locking and resets DLL for the next day. Existing `dailyPnL` reduces or increases remaining DLL room and contributes to the day result; cumulative PnL fields must already include that prior PnL.

The hedge is `(unrecovered basis + friction reserve + desired failure profit) / total remaining MLL downside`. The trade stop is independently limited by `min(MLL downside, DLL room)`. TP increases recovery basis by hedge loss plus configured execution cost; SL reduces it by hedge proceeds, with a zero lower bound. Real cash can become positive and is tracked independently of basis.

Evaluation pass creates `PASSED_EVAL`; explicit activation resets the funded account and adds the activation fee once. Payout eligibility enforces consistency, days, minimum payout and maximum payout count. A payout removes the gross amount from PA equity and adds the trader's net share to real cash. The MLL floor is preserved. Configured cycle and consistency resets are applied.

## Search and ranking

Candidates come from remaining evaluation target, consistency, trail lock, qualifying-day minimum, scaling boundaries, payout minimum/cap, remaining profit divided across remaining days, and round-dollar targets. Each action includes the current recovery hedge and full legal day loss boundary. Contract quantity is constrained by the current tier; the engine does not select trade direction or price entry.

The root evaluates generated candidates. Continuations use a three-candidate beam, memoization, full-state cycle detection, a depth/day bound and a state budget. Both TP and SL are recursively simulated. Search ends at evaluation pass, failure, completion or the requested payout event. It does not automatically roll an evaluation pass into funded activation.

Ranking first favors resolved legal continuations, then failure solvency, peak real capital, remaining real basis, days, payout and transaction count. No statistical weights are applied. FASTEST_PAYOUT and HIGHEST_PAYOUT change lexicographic priority; LOWEST_CAPITAL uses the capital ranking. BALANCED currently aliases the capital ranking and reports that explicitly.

This is a **bounded candidate optimizer**, not a proof of a globally optimal continuous-dollar strategy. `searchTruncated` reports beam/budget/depth pruning. Terminal cash ranges describe reached leaves of the selected policy only. Projected continuation means the all-TP path. `daysToNextPayoutMin` is null because this bounded search cannot establish the global minimum. No probabilities or expected returns are used by the ranking. A separate driftless first-passage interface returns `L/(W+L)` if explicitly requested by future consumers.

## Verified examples

Settings defaults: FULL_PAYOUT objective, depth 6, 12,000-state budget, six root candidates plus mandatory boundaries.

| Current state | Next target | Stop | Equilibrium hedge | Projected TP continuation |
| --- | ---: | ---: | ---: | --- |
| Fresh 40% evaluation, $83 basis | $1,200 | $2,000 | 4.15% | $1,200 → $1,200 → $600 |
| Evaluation after first $1,200 win | $1,200 | $2,000 | 6.64% | $1,200 → $600 |
| Daily funded fresh, $216 basis | $2,500 | $1,000 DLL | 10.8% | Full gross $1,250 payout eligibility |
| Daily funded after $1,000 DLL loss | $3,500 | $1,000 | 10.8% | Same full-payout equity of $52,500 |
| Flex funded fresh, $216 basis | $5,000 | $2,000 | 10.8% | $5,000 → $100 → $100 → $100 → $100 |

The Flex path is generated by the bounded search; it is not encoded as an account roadmap. Other rule sets and search limits can select different paths. The qualifying minimum in this synthetic example is $100.

After evaluation wins of $1,200 and $1,200, basis is $212.48, the trail is locked at $50,100, remaining cushion is $2,300 and the next hedge is 9.23826%. After the Daily DLL loss, balance is $49,000, basis $108 and remaining downside $1,000. Both critical regression calculations pass.

## Settings UI

The access panel opens `/settings/campaign-engine`. Users can load five examples or import an existing campaign snapshot, inspect the next objective, compare TP/SL states and cash effects, simulate outcomes, activate a passed evaluation, and process a payout. Rules/state/options JSON is editable with validation. Full recommendation JSON exposes candidates and rank vectors. Saved transitions expose before/after snapshots, action, outcome, version, rules and cost options.

The Campaign Plan display consumes the service's `nextAction`, branches, `projectedPath`, `metrics`, warnings and explanation. This service is available for later replacement of the trading-screen roadmap after migration of historic state. It currently uses a divisible linear hedge; integer contract execution is outside this simulation.

## Persistence

Browser development uses one localStorage envelope containing the current workspace and append-only simulation history; reload restoration was verified through the UI. Tauri uses an additive `campaign_engine_sessions` table and `campaign_state_transitions` table in the existing SQLite database. Both the session snapshot and transition inserts are written in one transaction. Unique transition IDs make repeated saves idempotent. Existing financial tables are unchanged. The workspace may be replaced by loading examples, but saved history is retained.

The SQLite schema and JSON restoration are tested using sqlite3. A Rust unit test for the transaction writer is included, but **the Tauri Rust build/test could not run on this machine because Cargo/Rust are not installed**. Desktop integration must be compiled and tested when that toolchain is available.

## Verification and changed files

`pnpm test:engine`: 19 passing tests, including static/EOD floors, lock monotonicity sweep, DLL split losses, 40%/50% consistency, payout conversion/caps/resets/count, minimum-profit days, scaling limits, activation, basis accounting, exact $3,500 regression, SQLite restoration and validation. `pnpm build`: passes. Browser flow Settings → Engine → Daily example → simulated DLL loss → reload restores $49,000 balance, $108 basis, $3,500 next target and transition history.

Created `src/lib/campaignEngine/{types,rules,state,optimizer,examples,adapter,persistence}.ts`, `src/pages/CampaignEnginePage.tsx`, `tests/campaignEngine.test.ts`, and this document. Updated `src/App.tsx`, `src/pages/SettingsPage.tsx`, `src-tauri/src/lib.rs`, `package.json`, and `pnpm-lock.yaml`.
