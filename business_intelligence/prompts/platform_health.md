# Platform Health Prompt — SaaS Adoption, Workspace Retention, Integration Health, and Churn Signals

> **When to use this file:** When analyzing platform-level health from the perspective of workspace adoption, feature engagement, churn risk, integration reliability, or tier upgrade behavior.

---

## 1. Platform Health BI Scope

Platform health analytics answers the question: "Is Effectime delivering sustained value to its workspace population, and is that population growing, stable, or at risk?"

This is distinct from workspace-internal analytics (attendance, compliance, wellbeing). Platform health looks across workspaces at the SaaS layer — adoption, retention, engagement depth, and commercial signals.

**Authorization note**: Cross-workspace platform analytics require superadmin scope. Workspace-level admins cannot access platform aggregates. Confirm scope before producing platform-level outputs.

---

## 2. Platform Health Metric Catalog

### 2.1 Workspace Adoption Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Active workspaces (WAU) | Workspaces with at least one admin or member session in the week | `workspace_sessions` | Higher = better |
| New workspace activation rate | New workspaces completing setup (first employee + first shift) ÷ new workspaces created | `workspace_activation_events` | Higher = better |
| Time to first value (TTFV) | Hours from workspace creation to first clock-in event | `workspace_activation_events` + `clock_events` | Lower = better |
| Workspace 30/60/90-day retention | Workspaces still active at 30, 60, 90 days post-creation | Cohort analysis | Higher = better |

### 2.2 Feature Engagement Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Feature adoption rate | Workspaces using feature ÷ workspaces with access to feature × 100% | `feature_usage_events` | Higher = better |
| Feature depth score | Average number of distinct features used per active workspace per week | `feature_usage_events` | Higher = better |
| Feature abandonment rate | Features activated then not used for 14+ days ÷ total activated features | `feature_usage_events` with gap detection | Lower = better |
| Integration connection rate | Workspaces with at least one integration connected ÷ total workspaces with integration access | `enterprise_workspace_integrations` | Higher = better |

### 2.3 Tier and Commercial Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Tier distribution | Count of workspaces per tier (starter / growth / enterprise) | `tenant_subscriptions` | Monitor — desired growth = movement to higher tiers |
| Tier upgrade rate | Workspaces that moved to a higher tier ÷ total workspaces × 100% per quarter | `platform_audit_events` where event = tier change | Higher = better |
| Tier downgrade rate | Workspaces that moved to a lower tier | `platform_audit_events` | Lower = better (revenue signal) |
| Reseller workspace share | Workspaces created via reseller channel ÷ total workspaces | `workspace_creation_events` by channel | Monitor for channel health |

### 2.4 Integration Health Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Integration sync success rate | Successful syncs ÷ total sync attempts × 100% | `integration_sync_logs` | Higher = better |
| Integration error rate | Failed syncs ÷ total sync attempts | `integration_sync_logs` where `status = 'error'` | Lower = better |
| Average sync latency | Mean time from sync trigger to sync completion | `integration_sync_logs` | Lower = better |
| Token expiry rate | Integrations with expired authentication tokens ÷ total integrations | `enterprise_workspace_integrations` | Lower = better |
| Integration abandonment | Integrations connected then disconnected within 30 days | `enterprise_workspace_integrations` | Lower = better |

### 2.5 Churn Risk Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Workspace inactivity rate | Workspaces with zero sessions in past 14 days ÷ total workspaces | `workspace_sessions` | Lower = better |
| Admin login frequency decline | Workspaces where admin session frequency dropped > 50% WoW | `workspace_sessions` by role | Lower = better |
| Support signal volume | Support-related events (if tracked) per workspace | Platform support events | Monitor |
| Feature usage decline | Workspaces where feature usage events dropped > 30% vs. prior 2 weeks | `feature_usage_events` | Lower = better |

---

## 3. Platform Health Assessment Protocol

### Step 1 — Segment workspaces correctly

Platform metrics aggregate across a heterogeneous population. Segment before comparing:
- By tier: starter workspaces have different expected feature usage than enterprise.
- By age: new workspaces (< 30 days) have different adoption curves than established workspaces.
- By size: small workspaces (< 10 employees) have structurally lower metric volumes.
- By channel: direct vs. reseller workspaces may show different behavioral patterns.

Never report a platform average without stating the population composition.

### Step 2 — Apply the health status framework

Assess platform health across three time horizons:

| Horizon | Metrics | Question |
|---|---|---|
| Current state (this week) | WAU, integration sync rate, error rate | Is anything broken right now? |
| Recent trend (past 4 weeks) | Adoption rate, feature depth, admin login frequency | Are workspaces engaging or withdrawing? |
| Forward signal (predictive) | Churn signals, TTFV trend, tier movement | What does the next quarter look like? |

### Step 3 — Identify at-risk workspaces

A workspace is at churn risk when 2 or more of the following are true:
- Admin login frequency has declined > 50% over 2 consecutive weeks.
- Feature usage has declined > 30% over 2 consecutive weeks.
- No clock events in past 14 days (workspace may not be actively running shifts).
- Integration sync failure rate > 25% in past week.
- Support signal volume is elevated (if tracked).

### Step 4 — Integration health deep dive

Integration failures have two categories with different implications:
- **Transient failures** (single sync, random API error): Monitor. Not a health signal unless recurring.
- **Persistent failures** (3+ consecutive failures, or failure rate > 25% over 7 days): Investigate. Token expiry, rate limiting, or breaking API changes are the most common causes. Check CHANGELOG for recent integration-related changes.

### Step 5 — Version-aware platform analysis

Platform behavior changes when new features are released. When a platform metric shifts:
- Check CHANGELOG for feature releases, tier changes, or integration updates in the analysis window.
- A spike in integration connection rate may follow a new integration launch, not represent organic growth.
- A drop in feature usage may follow a UI change that moved a feature, not represent abandonment.

---

## 4. Churn Signal Escalation Protocol

When churn signals are identified, escalate by tier priority:

| Tier | Churn signal threshold | Escalation |
|---|---|---|
| Enterprise | Any 1 of 5 churn signals | Immediate customer success contact |
| Growth | 2 of 5 churn signals | Customer success contact within 48 hours |
| Starter | 3 of 5 churn signals | Automated re-engagement sequence |

---

## 5. Output Format

```
Platform Health Report
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Analysis scope: [platform-wide / tier segment / channel]
- Period: [start → end]
- Authorization: [superadmin / restricted — state limitations]
- Data quality: [complete / partial / uncertain]

Workspace Population Snapshot
- Total active workspaces (WAU): [N]
- By tier: Starter=[N], Growth=[N], Enterprise=[N]
- By age: < 30 days=[N], 30–180 days=[N], > 180 days=[N]
- New activations this period: [N]
- Average TTFV: [hours]

Adoption Health
- 30-day retention: [%]
- 60-day retention: [%]
- 90-day retention: [%]
- Feature depth score: [average]
- Integration connection rate: [%]

Integration Health
- Overall sync success rate: [%]
- Error rate: [%]
- Persistent failure workspaces: [N]
- Token expiry issues: [N]
- Top error type: [description]

Tier Movement (period)
- Upgrades: [N] — From: [tier breakdown]
- Downgrades: [N] — From: [tier breakdown]
- Net tier movement: [positive / negative / neutral]

Churn Risk Signals
- At-risk workspaces identified: [N] — Tier breakdown: [Enterprise=N, Growth=N, Starter=N]
- Signal distribution: [list of which signals are most prevalent]
- Recommended escalation: [by tier as per protocol]

Platform Health Summary
- Current state: [healthy / at-risk / degraded]
- Recent trend: [improving / stable / declining]
- Forward signal: [positive / neutral / concerning]

Recommended Actions
- [Action 1 — tier]: [what + owner + timeline]
- [Action 2 — tier]: [what + owner + timeline]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Scope authorization: [confirmed / assumed]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
─────────────────────────────────────────────────────────
```
