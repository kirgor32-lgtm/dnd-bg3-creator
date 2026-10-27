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
function rollAbilityScores(){
  const rollOne = () => {
    const d = [1,2,3,4].map(() => 1 + Math.floor(Math.random() * 6));
    d.sort((a,b) => a - b);
    return d[1] + d[2] + d[3];
  };
  return Array.from({ length: 6 }, rollOne).sort((a,b) => b - a);
}
