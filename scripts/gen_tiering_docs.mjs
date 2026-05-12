#!/usr/bin/env node
/**
 * Friss CSV pillanatfelvételek a feature/tier rendszerből.
 * Kötelező env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (RLS bypass kell).
 *
 * Használat:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/gen_tiering_docs.mjs
 *
 * Output: docs/tiering/{features,dependency_matrix,tiers,tiers_matrix,addons}.csv
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);
const out = "docs/tiering";
fs.mkdirSync(out, { recursive: true });

const csv = (rows, cols) => {
  const esc = (v) => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("|") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

const must = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });

const feats = await must(sb.from("features")
  .select("id,feature_key,name,module,fiscal_weight,status,description,dependencies")
  .order("module").order("feature_key"));
fs.writeFileSync(`${out}/features.csv`,
  csv(feats, ["feature_key","name","module","fiscal_weight","status","description","dependencies"]));

// dependency matrix with reverse links
const dependents = new Map();
for (const f of feats) for (const d of (f.dependencies||[])) {
  if (!dependents.has(d)) dependents.set(d, []);
  dependents.get(d).push(f.feature_key);
}
fs.writeFileSync(`${out}/dependency_matrix.csv`,
  csv(feats.map(f => ({
    feature_key: f.feature_key, module: f.module, fiscal_weight: f.fiscal_weight,
    depends_on: (f.dependencies||[]).join("|"),
    dependents: (dependents.get(f.feature_key)||[]).join("|"),
  })), ["feature_key","module","fiscal_weight","depends_on","dependents"]));

const tiers = await must(sb.from("tiers")
  .select("id,tier_key,name,price_monthly_eur,seat_price_monthly_eur,description")
  .order("sort_order"));
fs.writeFileSync(`${out}/tiers.csv`,
  csv(tiers, ["tier_key","name","price_monthly_eur","seat_price_monthly_eur","description"]));

const tf = await must(sb.from("tier_features").select("tier_id,feature_id"));
const idToKey = new Map(feats.map(f => [f.id, f.feature_key]));
const tierKeyById = new Map(tiers.map(t => [t.id, t.tier_key]));
const tierMap = new Map(feats.map(f => [f.feature_key, new Set()]));
for (const r of tf) {
  const tk = tierKeyById.get(r.tier_id);
  const fk = idToKey.get(r.feature_id);
  if (tk && fk) tierMap.get(fk)?.add(tk);
}
fs.writeFileSync(`${out}/tiers_matrix.csv`,
  csv(feats.map(f => {
    const s = tierMap.get(f.feature_key) || new Set();
    return {
      feature_key: f.feature_key, module: f.module,
      freemium: s.has("freemium") ? "Y" : "",
      pro: s.has("pro") ? "Y" : "",
      enterprise: s.has("enterprise") ? "Y" : "",
    };
  }), ["feature_key","module","freemium","pro","enterprise"]));

const addons = await must(sb.from("addons")
  .select("id,addon_key,name,price_monthly_eur,description").order("sort_order"));
const af = await must(sb.from("addon_features").select("addon_id,feature_id"));
const addonMap = new Map(addons.map(a => [a.addon_key, []]));
const addonKeyById = new Map(addons.map(a => [a.id, a.addon_key]));
for (const r of af) {
  const ak = addonKeyById.get(r.addon_id);
  const fk = idToKey.get(r.feature_id);
  if (ak && fk) addonMap.get(ak).push(fk);
}
fs.writeFileSync(`${out}/addons.csv`,
  csv(addons.map(a => ({
    addon_key: a.addon_key, name: a.name, price_monthly_eur: a.price_monthly_eur,
    description: a.description, features: addonMap.get(a.addon_key).join("|"),
  })), ["addon_key","name","price_monthly_eur","description","features"]));

console.log("Generated:", { features: feats.length, tiers: tiers.length,
  addons: addons.length, tier_links: tf.length, addon_links: af.length });
