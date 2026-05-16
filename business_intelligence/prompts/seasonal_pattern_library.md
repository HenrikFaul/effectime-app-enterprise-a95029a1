# Seasonal Pattern Library — Documented Recurring Patterns for Effectime Metric Forecasting

> **When to use this file:** As a reference when applying seasonal adjustment to any metric forecast. Cite patterns from this library instead of inventing seasonal adjustments. Every pattern here is labeled with its evidence basis and jurisdiction applicability. Do not apply a pattern outside its stated applicability without noting the extrapolation.

---

## 1. How to Use This Library

When a forecasting prompt requires seasonal adjustment:

1. Look up the metric domain in the relevant section below.
2. Find the pattern that matches the metric's time window and scope.
3. Apply the seasonal index: multiply the naive projection by the seasonal factor for the target period.
4. Cite the pattern: "Seasonal adjustment applied: [pattern name] from seasonal_pattern_library.md — index [value] for [period]."
5. If no documented pattern exists for the metric, state: "No documented seasonal pattern available — seasonal adjustment not applied. Monitor for seasonal bias."

**Seasonal index interpretation:**
- Index = 1.00: No seasonal effect. Metric behaves at its average for this period.
- Index > 1.00: Metric typically runs above average in this period. (e.g., 1.15 = 15% above average.)
- Index < 1.00: Metric typically runs below average in this period. (e.g., 0.82 = 18% below average.)

**Jurisdiction note:** Patterns marked **(EU)** apply to Effectime's primary operating markets (HU, DE, AT, CZ, SK, PL, RO). Patterns marked **(UK)** apply to UK-market workspaces. Unlabeled patterns are cross-market.

---

## 2. Attendance and Time Patterns

### Pattern AT-01 — Absence rate: holiday season spike (EU)
| Period | Seasonal index | Basis |
|---|---|---|
| January (weeks 1–2) | 1.35 | Post-holiday illness and year-start absenteeism |
| March | 0.90 | Spring return to normal, low absence |
| July–August | 1.20 | Summer holiday utilization, school-linked absences |
| October (week 1) | 1.10 | Autumn illness onset |
| December (weeks 3–4) | 1.40 | Christmas holiday period, end-of-year burnout |

**Applicability:** EU market workspaces. Industry-agnostic.
**Minimum data:** At least 1 full annual cycle required to verify this pattern applies to a specific workspace.

### Pattern AT-02 — Overtime rate: period-end spike
| Period | Seasonal index | Basis |
|---|---|---|
| Last week of each calendar month | 1.25 | Month-end deadline pressure and schedule shortfalls |
| Last week of each quarter | 1.35 | Quarterly target deadlines |
| Week before public holidays | 1.20 | Advance workload completion before holiday shutdown |

**Applicability:** All markets. Strongest in retail, logistics, and manufacturing verticals.

### Pattern AT-03 — Clock-in rate: public holiday proximity effect (EU)
| Period | Seasonal index | Basis |
|---|---|---|
| Day before a national public holiday | 0.88 | Early departures and casual absenteeism |
| Day after a national public holiday | 0.85 | Extended holiday bridge behavior |
| Week of mid-week public holiday | 0.90 | Bridge days taken as leave |

**Applicability:** EU markets. Varies by country — Hungarian public holidays differ from Austrian.

### Pattern AT-04 — Shift marketplace acceptance: summer trough
| Period | Seasonal index | Basis |
|---|---|---|
| July | 0.78 | Workers on annual leave, reduced availability |
| August | 0.72 | Deepest trough — school holidays in EU countries |
| September | 0.92 | Recovery but not yet full |

**Applicability:** EU markets. Strongest for part-time worker populations.

---

## 3. Compliance Patterns

### Pattern CP-01 — Compliance score: new-year rule configuration lag
| Period | Seasonal index | Basis |
|---|---|---|
| January (weeks 1–2) | 0.93 | New regulatory year starts; rules not yet updated to reflect new requirements |
| January (weeks 3–4) | 0.97 | Recovery as configurations are updated |
| February onwards | 1.00 | Normal |

**Applicability:** EU markets where regulatory calendars reset January 1.

### Pattern CP-02 — WTD breach rate: holiday period spike (EU)
| Period | Seasonal index | Basis |
|---|---|---|
| December (weeks 3–4) | 1.45 | Skeleton staffing + end-of-year volume = WTD pressure |
| Easter week | 1.30 | Similar skeleton staffing dynamic |
| Summer peak (July–August, retail/hospitality) | 1.35 | Peak demand with constrained workforce |

**Applicability:** EU markets. Highest impact in hospitality, retail, healthcare.

### Pattern CP-03 — Audit trail completeness: system-change sensitivity
**Not a calendar pattern — a release pattern.**
Audit trail completeness typically dips by 5–12% in the 2 weeks following a major schema migration or edge function change, as audit event registration catches up. This is a version-induced pattern, not a seasonal one. Check CHANGELOG before interpreting a completeness dip as a business signal.

---

## 4. Engagement and Wellbeing Patterns

### Pattern EW-01 — Wellbeing score: seasonal low cycles (EU)
| Period | Seasonal index | Basis |
|---|---|---|
| January | 0.91 | Post-holiday deflation, dark months, return-to-work stress |
| February | 0.93 | Seasonal affective period continues |
| May | 1.06 | Spring uplift, longest daylight hours in Northern Europe |
| June | 1.05 | Pre-summer energy |
| November | 0.94 | Autumn low, short days, year-end pressure building |
| December | 0.90 | Deepest seasonal low for wellbeing scores |

**Applicability:** Northern and Central Europe (HU, CZ, SK, PL, AT, DE). Less pronounced in Southern Europe.

### Pattern EW-02 — Survey response rate: holiday depression
| Period | Seasonal index | Basis |
|---|---|---|
| December (week 3–4) | 0.65 | Staff on holiday, low engagement with digital tools |
| August | 0.70 | Summer holiday period |
| Immediately after a long weekend | 0.80 | Staff catching up on backlog, surveys deferred |

**Applicability:** All markets. **Critical implication:** Never treat a December or August wellbeing score as representative without noting the response rate depression.

### Pattern EW-03 — Voluntary overtime acceptance: engagement proxy cycle
| Period | Seasonal index | Basis |
|---|---|---|
| Q1 (January–March) | 0.88 | Post-holiday fatigue, lower discretionary effort |
| Q2 (April–June) | 1.05 | Spring energy, higher discretionary effort |
| September | 1.08 | Back-to-work momentum |
| Q4 (October–December) | 0.92 | Building fatigue, holiday anticipation |

**Applicability:** All markets. Varies by industry — healthcare and retail show different patterns.

---

## 5. Financial and Labor Cost Patterns

### Pattern FC-01 — Labor cost: month-end overtime spike
| Period | Seasonal index | Basis |
|---|---|---|
| Last 3 days of each month | 1.22 | Month-end overtime accumulation |
| First 3 days of each month | 0.95 | Low activity, post-overtime recovery |

**Applicability:** All markets. Strongest in payroll-cycle-aligned industries.

### Pattern FC-02 — Payroll correction rate: post-holiday spike
| Period | Seasonal index | Basis |
|---|---|---|
| First 2 weeks of January | 1.30 | Holiday period corrections processed in bulk |
| Week after Easter | 1.15 | Easter holiday period corrections |
| Week after August (return from summer leave) | 1.20 | Summer absence corrections |

**Applicability:** All markets.

### Pattern FC-03 — Shift marketplace costs: summer premium
| Period | Seasonal index | Basis |
|---|---|---|
| July–August | 1.25 | Higher incentive premiums needed to fill shifts during low-availability period |
| December | 1.20 | Holiday premium requirements for coverage |

**Applicability:** All markets. Strongest in hospitality, retail.

---

## 6. Platform and Adoption Patterns

### Pattern PA-01 — Feature adoption: post-release spike and normalization
| Phase | Index | Basis |
|---|---|---|
| Week 1–2 post-release | 1.40–1.80 | Launch curiosity spike |
| Week 3–6 post-release | 1.10–1.20 | Normalization |
| Week 7+ post-release | 1.00 | Steady-state adoption |

**Applicability:** All features. Index magnitude depends on feature type — core workflow features normalize faster; optional analytical features have slower adoption curves.

**Version-induced note:** Always check CHANGELOG before interpreting feature adoption metrics. A spike is often a release artifact, not organic growth.

### Pattern PA-02 — Admin login frequency: Q1 and Q3 dips
| Period | Seasonal index | Basis |
|---|---|---|
| January (weeks 1–2) | 0.82 | Post-holiday return lag |
| July–August | 0.85 | Admin staff on holiday, reduced platform activity |

**Applicability:** SMB-tier workspaces. Enterprise workspaces show less seasonality due to larger admin populations.

---

## 7. Seasonal Adjustment Application Protocol

When applying a seasonal index from this library to a forecast:

1. Compute the naive (unadjusted) projection using the forecasting method.
2. Look up the seasonal index for the target period from the relevant pattern.
3. Apply: Seasonally adjusted projection = Naive projection × Seasonal index.
4. State the adjustment explicitly in the forecast output block.
5. If the pattern has a "minimum data" requirement, confirm the workspace has sufficient history to validate the pattern applies before applying it.
6. If applying to a workspace for which no annual cycle of data exists, reduce the uncertainty band by an additional 10–15% to account for unverified seasonality.

### When NOT to apply seasonal adjustment

- When the metric has fewer than 12 months of data (seasonality cannot be validated).
- When the workspace changed tier, size, or industry mid-year (pattern may not apply).
- When a version-induced shift occurred in the comparison period from the prior year.
- When the pattern is marked **(EU)** and the workspace is in a non-EU jurisdiction.

---

## 8. Adding New Patterns

When a new seasonal pattern is observed in workspace data that is not documented here:

1. Require at least 2 full annual cycles of data to confirm recurrence.
2. Document: pattern name, periods affected, seasonal index, evidence basis, applicability conditions.
3. Add to the relevant section of this file with a versioning note: "Added vX.Y.Z — YYYY-MM-DD."
4. Do not apply an unverified pattern as if it were documented here.
