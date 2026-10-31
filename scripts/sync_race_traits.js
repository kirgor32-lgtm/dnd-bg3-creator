// Sync race UI traits/languages in js/data.js from js/race-sheet.js (source of truth) and add grung.
// Usage: node scripts/sync_race_traits.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const dataSrc = fs.readFileSync(path.join(root, "js/data.js"), "utf8");
const D = new Function(dataSrc + ";return DND_DATA;")();
const sheetSrc = fs.readFileSync(path.join(root, "js/race-sheet.js"), "utf8");
const { RACE_SHEET, RACE_SPELL_TEXT } = new Function(sheetSrc + ";return {RACE_SHEET, RACE_SPELL_TEXT};")();

const FLEX = "Гибкий бонус характеристик - распредели сам (+2/+1 или +1/+1/+1)";
const firstSentence = t => {
  const s = t.replace(/\{pb2\}/g, "2× бонус мастерства").replace(/\{pb\}/g, "бонус мастерства")
             .replace(/\{mod:(\w+)\}/g, "модификатор").replace(/\{dc:(\w+)\}/g, "8 + бонус мастерства + модификатор");
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  const r = (m ? m[1] : s).replace(/\.$/, "");
  return /^[А-ЯЁ][а-яё]/.test(r) && !/^(Общ|Сл |Интеллект|Мудрост|Харизм|Восприят)/.test(r) ? r[0].toLowerCase() + r.slice(1) : r;
};
const spellName = sp => sp.name || (RACE_SPELL_TEXT[sp.id] && RACE_SPELL_TEXT[sp.id].name) ||
  ((D.spells.find(x => x.id === sp.id) || {}).name) || sp.id;

function uiTraits(id, flexible){
  const e = RACE_SHEET[id];
  if (!e) return null;
  const out = [];
  if (flexible) out.push(FLEX);
  if (e.darkvision) out.push(`${e.darkvision === 120 ? "Превосходное тёмное зрение" : "Тёмное зрение"} - видит в темноте на ${e.darkvision} футов`);
  (e.traits || []).forEach(t => out.push(`${t.name} - ${firstSentence(t.text)}`));
  const now = (e.spells || []).filter(s => !s.minLevel || s.minLevel <= 1);
  const later = (e.spells || []).filter(s => s.minLevel > 1);
  if (now.length) out.push(`Врождённая магия - ${now.map(spellName).join(", ")}` + (later.length ? `; позже: ${later.map(s => `${spellName(s)} (${s.minLevel} ур.)`).join(", ")}` : ""));
  else if (later.length) out.push(`Врождённая магия - ${later.map(s => `${spellName(s)} (с ${s.minLevel} ур.)`).join(", ")}`);
  (e.later || []).forEach(t => out.push(`С ${t.minLevel} уровня: ${t.name} - ${firstSentence(t.text)}`));
  if (id === "dragonborn") out.push("Наследие драконов - выбери предка: вид урона дыхания и сопротивление", "Оружие дыхания - действием, 2к6 урона, спасбросок Сл 8 + ТЕЛ + мастерство");
  return out;
}

if (!D.races.find(r => r.id === "grung")){
  D.races.push({
    id:"grung", name:"Грунг", nameEn:"Grung",
    abilityBonuses:{ dex:2, con:1 }, speed:25, size:"Маленький",
    traits:[], languages:["Грунгов"], subraces:[]
  });
}

D.races.forEach(r => {
  const t = uiTraits(r.id, r.abilityBonuses && r.abilityBonuses.flexible);
  if (t) r.traits = t;
  const e = RACE_SHEET[r.id];
  if (e && e.languages) r.languages = e.languages.slice();
  (r.subraces || []).forEach(s => {
    const st = uiTraits(s.id, false);
    if (st) s.traits = st;
    const se = RACE_SHEET[s.id];
    if (se && se.speed) s.speed = se.speed;
  });
});

const out = "const DND_DATA = " + JSON.stringify(D, null, 1).replace(/\n/g, "\r\n") + ";\r\n";
fs.writeFileSync(path.join(root, "js/data.js"), out, "utf8");
console.log("races:", D.races.length, D.races.map(r => r.id).join(","));
