import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const url = "https://oezlzzmzzvbvinuysxaz.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemx6em16enZidmludXlzeGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Mzk3OTMsImV4cCI6MjA5MzQxNTc5M30.vww0zsBc659ojBEfRmSpI9iJpem1ebaBFjMeBWX19Nk";
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

// 1. features.csv
const { data: feats, error: e1 } = await sb.from("features")
  .select("feature_key,name,module,fiscal_weight,status,description,dependencies")
  .order("module").order("feature_key");
if (e1) throw e1;
fs.writeFileSync(`${out}/features.csv`,
  csv(feats, ["feature_key","name","module","fiscal_weight","status","description","dependencies"]));
console.log("features.csv:", feats.length);

// 2. dependency_matrix.csv
const dependents = new Map();
for (const f of feats) for (const d of (f.dependencies||[])) {
  if (!dependents.has(d)) dependents.set(d, []);
  dependents.get(d).push(f.feature_key);
}
const matrix = feats.map((f) => ({
  feature_key: f.feature_key,
  module: f.module,
  fiscal_weight: f.fiscal_weight,
  depends_on: (f.dependencies||[]).join("|"),
  dependents: (dependents.get(f.feature_key)||[]).join("|"),
}));
fs.writeFileSync(`${out}/dependency_matrix.csv`,
  csv(matrix, ["feature_key","module","fiscal_weight","depends_on","dependents"]));

// 3. tiers_matrix.csv
const { data: tiers } = await sb.from("tiers").select("id,tier_key,name,price_monthly_eur,seat_price_monthly_eur,description").order("sort_order");
const { data: tf } = await sb.from("tier_features").select("tier_id,feature_id");
const featById = new Map(feats.map(f => [f.feature_key, f]));
const { data: featIds } = await sb.from("features").select("id,feature_key");
const idToKey = new Map(featIds.map(f => [f.id, f.feature_key]));
const tierMap = new Map(); // feature_key -> Set(tier_key)
for (const f of feats) tierMap.set(f.feature_key, new Set());
for (const row of tf) {
  const tier = tiers.find(t => t.id === row.tier_id);
  const key = idToKey.get(row.feature_id);
  if (tier && key) tierMap.get(key)?.add(tier.tier_key);
}
const tierRows = feats.map(f => {
  const set = tierMap.get(f.feature_key) || new Set();
  return {
    feature_key: f.feature_key, module: f.module,
    freemium: set.has("freemium") ? "Y" : "",
    pro: set.has("pro") ? "Y" : "",
    enterprise: set.has("enterprise") ? "Y" : "",
  };
});
fs.writeFileSync(`${out}/tiers_matrix.csv`,
  csv(tierRows, ["feature_key","module","freemium","pro","enterprise"]));

// 4. addons.csv
const { data: addons } = await sb.from("addons").select("id,addon_key,name,price_monthly_eur,description").order("sort_order");
const { data: af } = await sb.from("addon_features").select("addon_id,feature_id");
const addonMap = new Map();
for (const a of addons) addonMap.set(a.addon_key, []);
for (const r of af) {
  const a = addons.find(x => x.id === r.addon_id);
  const k = idToKey.get(r.feature_id);
  if (a && k) addonMap.get(a.addon_key).push(k);
}
const addonRows = addons.map(a => ({
  addon_key: a.addon_key, name: a.name, price_monthly_eur: a.price_monthly_eur,
  description: a.description, features: addonMap.get(a.addon_key).join("|"),
}));
fs.writeFileSync(`${out}/addons.csv`,
  csv(addonRows, ["addon_key","name","price_monthly_eur","description","features"]));

// 5. tiers summary
fs.writeFileSync(`${out}/tiers.csv`,
  csv(tiers, ["tier_key","name","price_monthly_eur","seat_price_monthly_eur","description"]));

console.log("done. counts:", { features: feats.length, tiers: tiers.length, addons: addons.length, tier_links: tf.length, addon_links: af.length });
