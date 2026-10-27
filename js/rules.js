/* ===== Фиксированные правила D&D 5e (SRD), не зависят от данных классов/рас ===== */

const SKILL_ABILITY = {
  "Акробатика": "dex",
  "Анализ": "int",
  "Атлетика": "str",
  "Выживание": "wis",
  "Запугивание": "cha",
  "История": "int",
  "Ловкость рук": "dex",
  "Магия": "int",
  "Медицина": "wis",
  "Обман": "cha",
  "Природа": "int",
  "Проницательность": "wis",
  "Религия": "int",
  "Скрытность": "dex",
  "Убеждение": "cha",
  "Уход за животными": "wis",
  "Восприятие": "wis",
  "Выступление": "cha"
};

const ABILITY_NAMES = {
  str: "Сила", dex: "Ловкость", con: "Телосложение",
  int: "Интеллект", wis: "Мудрость", cha: "Харизма"
};
const ABILITY_ORDER = ["str","dex","con","int","wis","cha"];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function abilityMod(score){
  return Math.floor((score - 10) / 2);
}
function fmtMod(m){
  return (m >= 0 ? "+" : "") + m;
}
const PROFICIENCY_BONUS_LVL1 = 2;

/* Параметры заклинателей 1-го уровня, SRD 2014 (подтверждено поиском по кантрипам).
   type: "known" — игрок выбирает фиксированное число заклинаний в "известные";
         "prepared" — число = мод.характеристики + уровень(1), минимум 1, выбор каждый день (здесь просто выбор фиксированного числа при создании). */
const CASTER_RULES = {
  bard:     { ability: "cha", cantrips: 2, type: "known",    known: 4 },
  cleric:   { ability: "wis", cantrips: 3, type: "prepared" },
  druid:    { ability: "wis", cantrips: 2, type: "prepared" },
  sorcerer: { ability: "cha", cantrips: 4, type: "known",    known: 2 },
  warlock:  { ability: "cha", cantrips: 2, type: "known",    known: 2 },
  wizard:   { ability: "int", cantrips: 3, type: "known",    known: 6 } // упрощённо: заклинания в книге заклинаний
};

function casterKnownCount(classId, abilityScoreMod){
  const r = CASTER_RULES[classId];
  if (!r) return 0;
  if (r.type === "known") return r.known;
  // prepared: mod + 1 (уровень персонажа = 1), минимум 1
  return Math.max(1, abilityScoreMod + 1);
}

/* Рекомендованный приоритет характеристик по классу (от важнейшей к наименее важной).
   Используется для авто-билда: стандартный набор 15/14/13/12/10/8 раздаётся по этому порядку. */
const CLASS_ABILITY_PRIORITY = {
  barbarian: ["str","con","dex","wis","cha","int"],
  bard:      ["cha","dex","con","int","wis","str"],
  cleric:    ["wis","con","str","cha","dex","int"],
  druid:     ["wis","con","dex","int","cha","str"],
  fighter:   ["str","con","dex","wis","cha","int"],
  monk:      ["dex","wis","con","str","cha","int"],
  paladin:   ["str","cha","con","wis","dex","int"],
  ranger:    ["dex","wis","con","str","cha","int"],
  rogue:     ["dex","int","con","wis","cha","str"],
  sorcerer:  ["cha","con","dex","wis","int","str"],
  warlock:   ["cha","con","dex","wis","int","str"],
  wizard:    ["int","con","dex","wis","cha","str"]
};

/* Доспехи, встречающиеся в комплектах снаряжения: базовый КД и правило модификатора Ловкости. */
const ARMOR_AC = {
  "Кожаный доспех":    { base: 11, dexCap: null },
  "Чешуйчатый доспех": { base: 14, dexCap: 2 },
  "Кольчуга":           { base: 16, dexCap: 0 }
};
const SHIELD_NAMES = ["Щит", "Деревянный щит"];

/* ===== Свободная сборка снаряжения (вариант D) ===== */

/* Полный каталог оружия для чекбоксов. hands:2 = двуручное/тяжёлое (занимает 2 ячейки переноски). */
const WEAPON_CATALOG = [
  { id:"dagger",         name:"Кинжал",          category:"simple",  ranged:false, hands:1, info:"1d4 колющий · лёгкое, фехтовальное, бросковое 20/60" },
  { id:"mace",           name:"Булава",          category:"simple",  ranged:false, hands:1, info:"1d6 дробящий" },
  { id:"quarterstaff",   name:"Посох",           category:"simple",  ranged:false, hands:1, info:"1d6 дробящий · универсальное (1d8 двумя руками)" },
  { id:"spear",          name:"Копьё",           category:"simple",  ranged:false, hands:1, info:"1d6 колющий · бросковое 20/60, универсальное (1d8)" },
  { id:"sickle",         name:"Серп",            category:"simple",  ranged:false, hands:1, info:"1d4 рубящий · лёгкое" },
  { id:"handaxe",        name:"Ручной топор",    category:"simple",  ranged:false, hands:1, info:"1d6 рубящий · лёгкое, бросковое 20/60" },
  { id:"javelins",       name:"Дротики (неск. шт.)", category:"simple", ranged:true, hands:1, info:"1d6 колющий · бросковое 30/120" },
  { id:"sling",          name:"Праща",           category:"simple",  ranged:true,  hands:1, info:"1d4 дробящий · бросковое 30/120" },
  { id:"light-crossbow", name:"Лёгкий арбалет",  category:"simple",  ranged:true,  hands:2, info:"1d8 колющий · боеприпасы, перезарядка, двуручное" },
  { id:"shortbow",       name:"Короткий лук",    category:"simple",  ranged:true,  hands:2, info:"1d6 колющий · боеприпасы, двуручное" },
  { id:"longsword",      name:"Длинный меч",     category:"martial", ranged:false, hands:1, info:"1d8 рубящий · универсальное (1d10 двумя руками)" },
  { id:"rapier",         name:"Рапира",          category:"martial", ranged:false, hands:1, info:"1d8 колющий · фехтовальное" },
  { id:"shortsword",     name:"Короткий меч",    category:"martial", ranged:false, hands:1, info:"1d6 колющий · лёгкое, фехтовальное" },
  { id:"scimitar",       name:"Скимитар",        category:"martial", ranged:false, hands:1, info:"1d6 рубящий · лёгкое, фехтовальное" },
  { id:"warhammer",      name:"Боевой молот",    category:"martial", ranged:false, hands:1, info:"1d8 дробящий · универсальное (1d10 двумя руками)" },
  { id:"battleaxe",      name:"Боевой топор",    category:"martial", ranged:false, hands:1, info:"1d8 рубящий · универсальное (1d10 двумя руками)" },
  { id:"handcrossbow",   name:"Ручной арбалет",  category:"martial", ranged:true,  hands:1, info:"1d6 колющий · боеприпасы, лёгкое, перезарядка" },
  { id:"greataxe",       name:"Секира",          category:"martial", ranged:false, hands:2, info:"1d12 рубящий · тяжёлое, двуручное" },
  { id:"greatsword",     name:"Двуручный меч",   category:"martial", ranged:false, hands:2, info:"2d6 рубящий · тяжёлое, двуручное" },
  { id:"glaive",         name:"Глефа",           category:"martial", ranged:false, hands:2, info:"1d10 рубящий · тяжёлое, досягаемость, двуручное" },
  { id:"longbow",        name:"Длинный лук",     category:"martial", ranged:true,  hands:2, info:"1d8 колющий · боеприпасы, тяжёлое, двуручное" },
  { id:"heavy-crossbow", name:"Тяжёлый арбалет", category:"martial", ranged:true,  hands:2, info:"1d10 колющий · боеприпасы, тяжёлое, перезарядка, двуручное" }
];

/* Полный каталог доспехов. stealthDisadvantage — помеха к проверкам Скрытности (важно показать игроку).
   metal — доспех металлический (друиды носят только немагические нематаллические доспехи). */
const ARMOR_CATALOG = [
  { id:"padded",         name:"Стёганый доспех",     type:"light",  base:11, dexCap:null, strReq:0,  stealthDisadvantage:true,  metal:false, info:"КД 11 + мод. ЛОВ · лёгкий · помеха к Скрытности" },
  { id:"leather",        name:"Кожаный доспех",      type:"light",  base:11, dexCap:null, strReq:0,  stealthDisadvantage:false, metal:false, info:"КД 11 + мод. ЛОВ · лёгкий" },
  { id:"studded",        name:"Клёпаная кожа",       type:"light",  base:12, dexCap:null, strReq:0,  stealthDisadvantage:false, metal:false, info:"КД 12 + мод. ЛОВ · лёгкий" },
  { id:"hide",           name:"Шкурный доспех",      type:"medium", base:12, dexCap:2,    strReq:0,  stealthDisadvantage:false, metal:false, info:"КД 12 + мод. ЛОВ (макс 2) · средний" },
  { id:"chain-shirt",    name:"Кольчужная рубаха",   type:"medium", base:13, dexCap:2,    strReq:0,  stealthDisadvantage:false, metal:true,  info:"КД 13 + мод. ЛОВ (макс 2) · средний" },
  { id:"scale-mail",     name:"Чешуйчатый доспех",   type:"medium", base:14, dexCap:2,    strReq:0,  stealthDisadvantage:true,  metal:true,  info:"КД 14 + мод. ЛОВ (макс 2) · средний · помеха к Скрытности" },
  { id:"breastplate",    name:"Панцирь",             type:"medium", base:14, dexCap:2,    strReq:0,  stealthDisadvantage:false, metal:true,  info:"КД 14 + мод. ЛОВ (макс 2) · средний" },
  { id:"half-plate",     name:"Полулаты",            type:"medium", base:15, dexCap:2,    strReq:0,  stealthDisadvantage:true,  metal:true,  info:"КД 15 + мод. ЛОВ (макс 2) · средний · помеха к Скрытности" },
  { id:"ring-mail",      name:"Кольчужные кольца",   type:"heavy",  base:14, dexCap:0,    strReq:0,  stealthDisadvantage:true,  metal:true,  info:"КД 14 · тяжёлый · помеха к Скрытности" },
  { id:"chain-mail",     name:"Кольчуга",            type:"heavy",  base:16, dexCap:0,    strReq:13, stealthDisadvantage:true,  metal:true,  info:"КД 16 · тяжёлый · треб. Силу 13 · помеха к Скрытности" },
  { id:"splint",         name:"Наборный доспех",     type:"heavy",  base:17, dexCap:0,    strReq:15, stealthDisadvantage:true,  metal:true,  info:"КД 17 · тяжёлый · треб. Силу 15 · помеха к Скрытности" },
  { id:"plate",          name:"Латы",                type:"heavy",  base:18, dexCap:0,    strReq:15, stealthDisadvantage:true,  metal:true,  info:"КД 18 · тяжёлый · треб. Силу 15 · помеха к Скрытности" },
  { id:"shield",         name:"Щит",                 type:"shield", base:2,  dexCap:null, strReq:0,  stealthDisadvantage:false, metal:true,  info:"+2 к КД" },
  { id:"wooden-shield",  name:"Деревянный щит",      type:"shield", base:2,  dexCap:null, strReq:0,  stealthDisadvantage:false, metal:false, info:"+2 к КД · немагический, подходит друиду" }
];

const PACK_CATALOG = [
  { id:"explorer",   name:"Набор путника",                 info:"спальный мешок, котелок, факелы, паёк на 10 дней, бурдюк, верёвка" },
  { id:"priest",     name:"Набор священника",               info:"рюкзак, одеяло, 10 свечей, трутница, кадильница, 2 куска благовоний, церковное облачение, паёк на 2 дня, бурдюк" },
  { id:"entertainer",name:"Набор артиста",                  info:"костюмы, грим, 5 жонглёрских мячей, музыкальный инструмент, мешочек" },
  { id:"burglar",    name:"Набор взломщика",                info:"мешок, 1000 шариков-подшипников, 10 футов бечёвки, колокольчик, 5 свечей, крюк-кошка, молоток, 10 шипов, зеркальце, 10 футов воска, мыло" },
  { id:"dungeoneer", name:"Набор исследователя подземелий", info:"лом, молоток, 10 факелов, трутница, паёк на 10 дней, 50 футов верёвки" },
  { id:"diplomat",   name:"Набор дипломата",                info:"чехол для карт, чернильница, перо, лампа, 10 листов бумаги, духи, сургуч" },
  { id:"scholar",    name:"Набор учёного",                  info:"рюкзак, книга по знаниям, чернильница, перо, 10 листов бумаги, мешочек песка, малый нож" }
];

/* Владение оружием по классам: что доступно в чекбоксах свободной сборки. */
const CLASS_WEAPON_PROF = {
  barbarian: { simple:true, martial:true },
  bard:      { simple:true, martial:false, extra:["handcrossbow","longsword","rapier","shortsword"] },
  cleric:    { simple:true, martial:false },
  druid:     { simple:true, martial:false, extra:["scimitar"] },
  fighter:   { simple:true, martial:true },
  monk:      { simple:true, martial:false, extra:["shortsword"] },
  paladin:   { simple:true, martial:true },
  ranger:    { simple:true, martial:true },
  rogue:     { simple:true, martial:false, extra:["handcrossbow","longsword","rapier","shortsword"] },
  sorcerer:  { simple:true, martial:false },
  warlock:   { simple:true, martial:false },
  wizard:    { simple:true, martial:false, extra:["dagger","sling","quarterstaff","light-crossbow"] }
};
/* Владение доспехами/щитами по классам. monk/sorcerer/wizard — без доспехов и щита (как в SRD). */
const CLASS_ARMOR_PROF = {
  barbarian: { light:true,  medium:true,  heavy:false, shield:true  },
  bard:      { light:true,  medium:false, heavy:false, shield:false },
  cleric:    { light:true,  medium:true,  heavy:false, shield:true  },
  druid:     { light:true,  medium:true,  heavy:false, shield:true,  nonmetalOnly:true },
  fighter:   { light:true,  medium:true,  heavy:true,  shield:true  },
  monk:      { light:false, medium:false, heavy:false, shield:false },
  paladin:   { light:true,  medium:true,  heavy:true,  shield:true  },
  ranger:    { light:true,  medium:true,  heavy:false, shield:true  },
  rogue:     { light:true,  medium:false, heavy:false, shield:false },
  sorcerer:  { light:false, medium:false, heavy:false, shield:false },
  warlock:   { light:true,  medium:false, heavy:false, shield:false },
  wizard:    { light:false, medium:false, heavy:false, shield:false }
};

function weaponAllowedForClass(classId, weaponId){
  const prof = CLASS_WEAPON_PROF[classId]; if (!prof) return false;
  const w = WEAPON_CATALOG.find(x => x.id === weaponId); if (!w) return false;
  if (prof.extra && prof.extra.includes(weaponId)) return true;
  if (w.category === "simple") return !!prof.simple;
  if (w.category === "martial") return !!prof.martial;
  return false;
}
function armorAllowedForClass(classId, armorId){
  const prof = CLASS_ARMOR_PROF[classId]; if (!prof) return false;
  const a = ARMOR_CATALOG.find(x => x.id === armorId); if (!a) return false;
  if (a.type === "shield") return !!prof.shield && (!prof.nonmetalOnly || !a.metal);
  if (prof.nonmetalOnly && a.metal) return false;
  return !!prof[a.type];
}

/* Переноска: сколько "ячеек" оружия+щита персонаж реально может держать при себе и использовать.
   Обычный персонаж — 3. Сильные (СИЛ 16+/18+) и крупнее среднего для расы — могут нести больше. */
function weaponSlotCost(weaponId){
  const w = WEAPON_CATALOG.find(x => x.id === weaponId);
  return w ? (w.hands === 2 ? 2 : 1) : 0;
}
function carrySlotBudget(strScore, weightKg, avgWeightKg){
  let budget = 3;
  if (strScore >= 16) budget += 1;
  if (strScore >= 18) budget += 1;
  if (weightKg && avgWeightKg && weightKg >= avgWeightKg * 1.25) budget += 1;
  return Math.min(budget, 6);
}

/* ===== Рост и вес (случайная таблица SRD, PHB «Random Height and Weight») ===== */
const HEIGHT_WEIGHT_TABLE = {
  human:          { baseHeightIn:56, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  "hill-dwarf":   { baseHeightIn:44, heightDice:[2,4],  baseWeightLb:115, weightMult:[2,6] },
  "mountain-dwarf":{ baseHeightIn:48, heightDice:[2,4],  baseWeightLb:130, weightMult:[2,6] },
  dwarf:          { baseHeightIn:46, heightDice:[2,4],  baseWeightLb:122, weightMult:[2,6] },
  "high-elf":     { baseHeightIn:54, heightDice:[2,10], baseWeightLb:90,  weightMult:[1,4] },
  "wood-elf":     { baseHeightIn:54, heightDice:[2,10], baseWeightLb:100, weightMult:[1,4] },
  elf:            { baseHeightIn:54, heightDice:[2,10], baseWeightLb:95,  weightMult:[1,4] },
  halfling:       { baseHeightIn:31, heightDice:[2,4],  baseWeightLb:35,  weightMult:[1,1] },
  gnome:          { baseHeightIn:35, heightDice:[2,4],  baseWeightLb:35,  weightMult:[1,1] },
  dragonborn:     { baseHeightIn:66, heightDice:[2,8],  baseWeightLb:175, weightMult:[2,6] },
  "half-elf":     { baseHeightIn:57, heightDice:[2,8],  baseWeightLb:110, weightMult:[2,4] },
  "half-orc":     { baseHeightIn:58, heightDice:[2,10], baseWeightLb:140, weightMult:[2,6] },
  tiefling:       { baseHeightIn:57, heightDice:[2,8],  baseWeightLb:110, weightMult:[2,4] },
  /* Ниже — расы из Mordenkainen Presents: Monsters of the Multiverse.
     Точных официальных таблиц рост/вес для них в базовых правилах нет (кроме табакси/голиафа/тритона
     из Volo's Guide) — используются полуофициальные значения по описанию рас и Volo's Guide, не выдуманные с нуля. */
  genasi:         { baseHeightIn:56, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  "air-genasi":   { baseHeightIn:56, heightDice:[2,10], baseWeightLb:100, weightMult:[1,4] },
  "earth-genasi": { baseHeightIn:56, heightDice:[2,10], baseWeightLb:120, weightMult:[2,6] },
  "fire-genasi":  { baseHeightIn:56, heightDice:[2,10], baseWeightLb:105, weightMult:[2,4] },
  "water-genasi": { baseHeightIn:56, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  kenku:          { baseHeightIn:54, heightDice:[2,8],  baseWeightLb:80,  weightMult:[1,4] },
  shifter:        { baseHeightIn:56, heightDice:[2,10], baseWeightLb:125, weightMult:[2,6] },
  "beasthide-shifter":   { baseHeightIn:58, heightDice:[2,10], baseWeightLb:135, weightMult:[2,6] },
  "longtooth-shifter":   { baseHeightIn:57, heightDice:[2,10], baseWeightLb:130, weightMult:[2,6] },
  "swiftstride-shifter": { baseHeightIn:56, heightDice:[2,10], baseWeightLb:115, weightMult:[2,4] },
  "wildhunt-shifter":    { baseHeightIn:56, heightDice:[2,10], baseWeightLb:120, weightMult:[2,4] },
  aasimar:        { baseHeightIn:57, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  "protector-aasimar": { baseHeightIn:58, heightDice:[2,10], baseWeightLb:115, weightMult:[2,4] },
  "scourge-aasimar":   { baseHeightIn:57, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  "fallen-aasimar":    { baseHeightIn:57, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] },
  tabaxi:         { baseHeightIn:58, heightDice:[2,10], baseWeightLb:90,  weightMult:[2,4] },
  goliath:        { baseHeightIn:84, heightDice:[2,10], baseWeightLb:280, weightMult:[2,6] },
  triton:         { baseHeightIn:63, heightDice:[2,8],  baseWeightLb:130, weightMult:[2,6] },
  goblin:         { baseHeightIn:35, heightDice:[2,4],  baseWeightLb:30,  weightMult:[1,1] },
  centaur:        { baseHeightIn:70, heightDice:[2,10], baseWeightLb:400, weightMult:[2,10] },
  changeling:     { baseHeightIn:56, heightDice:[2,10], baseWeightLb:110, weightMult:[2,4] }
};
function diceSum(n, sides){
  let t = 0; for (let i=0;i<n;i++) t += 1 + Math.floor(Math.random()*sides); return t;
}
function hwTable(raceId, subraceId){
  return HEIGHT_WEIGHT_TABLE[subraceId] || HEIGHT_WEIGHT_TABLE[raceId] || HEIGHT_WEIGHT_TABLE.human;
}
function rollHeightWeight(raceId, subraceId){
  const t = hwTable(raceId, subraceId);
  const extraIn = diceSum(t.heightDice[0], t.heightDice[1]);
  const multRoll = diceSum(t.weightMult[0], t.weightMult[1]);
  const heightIn = t.baseHeightIn + extraIn;
  const weightLb = t.baseWeightLb + extraIn * multRoll;
  return { heightCm: Math.round(heightIn * 2.54), weightKg: Math.round(weightLb * 0.4536) };
}
function avgHeightWeight(raceId, subraceId){
  const t = hwTable(raceId, subraceId);
  const avgExtraIn = t.heightDice[0] * (t.heightDice[1]+1) / 2;
  const avgMultRoll = t.weightMult[0] * (t.weightMult[1]+1) / 2;
  const heightIn = t.baseHeightIn + avgExtraIn;
  const weightLb = t.baseWeightLb + avgExtraIn * avgMultRoll;
  return { heightCm: Math.round(heightIn * 2.54), weightKg: Math.round(weightLb * 0.4536) };
}
/* Границы роста/веса по таблице SRD (минимум/максимум возможных бросков) + допуск ±17%
   на случай если игрок хочет выделяющегося персонажа (очень высокий/низкий, лёгкий/тяжёлый). */
const SIZE_TOLERANCE = 0.17;
function heightWeightBounds(raceId, subraceId){
  const t = hwTable(raceId, subraceId);
  const minExtraIn = t.heightDice[0] * 1;
  const maxExtraIn = t.heightDice[0] * t.heightDice[1];
  const minMult = t.weightMult[0] * 1;
  const maxMult = t.weightMult[0] * t.weightMult[1];
  const heightMinIn = t.baseHeightIn + minExtraIn;
  const heightMaxIn = t.baseHeightIn + maxExtraIn;
  const weightMinLb = t.baseWeightLb + minExtraIn * minMult;
  const weightMaxLb = t.baseWeightLb + maxExtraIn * maxMult;
  return {
    heightCm: { min: Math.round(heightMinIn * 2.54 * (1 - SIZE_TOLERANCE)), max: Math.round(heightMaxIn * 2.54 * (1 + SIZE_TOLERANCE)) },
    weightKg: { min: Math.round(weightMinLb * 0.4536 * (1 - SIZE_TOLERANCE)), max: Math.round(weightMaxLb * 0.4536 * (1 + SIZE_TOLERANCE)) }
  };
}

/* ===== Текст для отыгрыша: что высокие/низкие характеристики и телосложение значат "в жизни". ===== */
const ABILITY_FLAVOR = {
  str: { high: "Твой герой сильнее многих — легко поднимает тяжёлые грузы, выламывает двери, тащит раненых союзников на себе.",
         low:  "Телосложение не из крепких — тяжести, доспехи и долгие переходы быстро утомляют." },
  dex: { high: "Твой герой ловкий — увереннее держит равновесие на скользких камнях и в болотах, бесшумнее подкрадывается.",
         low:  "Герою не хватает проворства — легко оступается на неровной земле и шумит, пытаясь подкрасться." },
  con: { high: "Крепкое здоровье — герой может сутками идти без сна и отдыха, устойчив к ядам и болезням.",
         low:  "Слабое здоровье — герой быстро устаёт и тяжело переносит голод, холод и недуги." },
  int: { high: "Острый ум — герой быстро разбирается в чужих записях, механизмах и малоизвестных фактах.",
         low:  "Сложные объяснения и книги даются герою с трудом." },
  wis: { high: "Внимателен к деталям — герой замечает опасность и ложь раньше других, хорошо чувствует природу и людей.",
         low:  "Герой легко отвлекается и упускает очевидные подсказки." },
  cha: { high: "Запоминающаяся харизма — герой легко располагает к себе незнакомцев, торгуется и уговаривает.",
         low:  "Герою трудно подбирать слова — он часто производит неловкое впечатление." }
};
function abilityFlavorLines(totals){
  const lines = [];
  ABILITY_ORDER.forEach(ab => {
    const v = totals[ab];
    if (v >= 16) lines.push(ABILITY_FLAVOR[ab].high);
    else if (v <= 8) lines.push(ABILITY_FLAVOR[ab].low);
  });
  return lines;
}
function physiqueFlavorLines(heightCm, weightKg, avgWeightKg){
  if (!heightCm || !weightKg || !avgWeightKg) return [];
  const lines = [];
  if (weightKg >= avgWeightKg * 1.25) lines.push("Крупное телосложение — герой выше и тяжелее многих сородичей; может нести больше снаряжения и производит внушительное впечатление.");
  else if (weightKg <= avgWeightKg * 0.8) lines.push("Хрупкое телосложение — герой легче многих сородичей, ему проще пролезть в узкий проход и остаться незамеченным.");
  else lines.push("Телосложение обычное для своего народа.");
  return lines;
}

/* ===== Интерактивная миниатюра телосложения (пол/рост/вес/тип фигуры) =====
   Вес больше не независимый произвольный ползунок: его допустимый диапазон
   пересчитывается от текущего роста и типа фигуры (упрощённый ИМТ), поэтому
   нельзя выставить, например, рост 200 см и вес 30 кг одновременно. */
const BODY_TYPES = [
  { id: "thin",     label: "Худой",       bmi: 16, widthScale: 0.82 },
  { id: "average",  label: "Средний",     bmi: 21, widthScale: 1.0  },
  { id: "athletic", label: "Атлетичный",  bmi: 23, widthScale: 1.08 },
  { id: "heavy",    label: "Полный",      bmi: 30, widthScale: 1.3  }
];
function bodyTypeById(id){ return BODY_TYPES.find(b => b.id === id) || BODY_TYPES[1]; }
function centerWeightForHeight(heightCm, bodyTypeId){
  const bt = bodyTypeById(bodyTypeId);
  const m = heightCm / 100;
  return Math.round(bt.bmi * m * m);
}
function weightRangeForHeight(heightCm, bodyTypeId){
  const center = centerWeightForHeight(heightCm, bodyTypeId);
  return { min: Math.max(15, Math.round(center * 0.85)), max: Math.round(center * 1.15), center };
}
function cmToFeetInches(cm){
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? { ft: ft + 1, inch: 0 } : { ft, inch };
}
function fmtFeetInches(cm){
  const { ft, inch } = cmToFeetInches(cm);
  return `${ft}′${inch}″`;
}

/* ===== Ячейки применения заклинаний 1-го уровня (упрощённо, SRD уровень 1) ===== */
const LEVEL1_SPELL_SLOTS = {
  bard: 2, cleric: 2, druid: 2, sorcerer: 2, wizard: 2, warlock: 1
};

function rollAbilityScores(){
  const rollOne = () => {
    const d = [1,2,3,4].map(() => 1 + Math.floor(Math.random() * 6));
    d.sort((a,b) => a - b);
    return d[1] + d[2] + d[3];
  };
  return Array.from({ length: 6 }, rollOne).sort((a,b) => b - a);
}
