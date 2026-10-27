/* ===== Творец Героя — логика визарда создания персонажа ===== */

const STORAGE_KEY = "dnd-bg3-creator-state-v1";

const RACE_GLYPH = {
  human:"🙂", elf:"🧝", dwarf:"⛏", halfling:"🍀", dragonborn:"🐉",
  gnome:"🔧", "half-elf":"🌙", "half-orc":"🪓", tiefling:"🔥"
};
const CLASS_GLYPH = {
  barbarian:"🪓", bard:"🎵", cleric:"✝", druid:"🌿", fighter:"⚔",
  monk:"☯", paladin:"🛡", ranger:"🏹", rogue:"🗡", sorcerer:"✨",
  warlock:"👁", wizard:"📖"
};

let state = {
  step: "intro",
  name: "", alignment: "", background: "",
  raceId: null, subraceId: null, classId: null,
  abilityMode: null, diceRolls: null,
  abilities: {}, abilityAssign: {}, skillChoices: [],
  equipmentChoice: null,
  spells: [],
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  }catch(e){}
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}

function getRace(){ return DND_DATA.races.find(r => r.id === state.raceId) || null; }
function getSubrace(){
  const r = getRace();
  if (!r || !r.subraces) return null;
  return r.subraces.find(s => s.id === state.subraceId) || null;
}
function getClass(){ return DND_DATA.classes.find(c => c.id === state.classId) || null; }
function isCaster(){
  const c = getClass();
  return !!(c && c.spellcasting && CASTER_RULES[c.id]);
}

/* ---------------- Steps ---------------- */
const STEP_META = {
  intro:     { title: "Начало легенды", caption: "Шаг 1 — Имя героя" },
  race:      { title: "Выбор расы", caption: "Шаг 2 — Раса" },
  subrace:   { title: "Выбор подрасы", caption: "Шаг 3 — Подраса" },
  class:     { title: "Выбор класса", caption: "Шаг 4 — Класс" },
  abilities: { title: "Характеристики", caption: "Шаг 5 — Характеристики и навыки" },
  equipment: { title: "Снаряжение", caption: "Шаг 6 — Снаряжение" },
  magic:     { title: "Магия", caption: "Шаг 7 — Заклинания" },
  sheet:     { title: "Лист персонажа", caption: "Шаг 8 — Итог" }
};

function getActiveSteps(){
  const steps = ["intro","race"];
  const r = getRace();
  if (r && r.subraces && r.subraces.length) steps.push("subrace");
  steps.push("class");
  steps.push("abilities");
  steps.push("equipment");
  const c = getClass();
  if (c && c.spellcasting && CASTER_RULES[c.id]) steps.push("magic");
  steps.push("sheet");
  return steps;
}

function renderRail(){
  const steps = getActiveSteps();
  const rail = document.getElementById("stepRail");
  rail.innerHTML = "";
  steps.forEach((id, i) => {
    const pill = document.createElement("div");
    const isActive = id === state.step;
    const idxCurrent = steps.indexOf(state.step);
    const isDone = i < idxCurrent;
    pill.className = "step-pill" + (isActive ? " active" : "") + (isDone ? " done" : "");
    pill.innerHTML = `<span class="num">${i+1}</span><span>${STEP_META[id].title}</span>`;
    if (isDone) pill.onclick = () => { state.step = id; render(); };
    rail.appendChild(pill);
  });
}

function render(){
  saveState();
  renderRail();
  const stage = document.getElementById("stage");
  let view = stage.querySelector(".step-view");
  if (!view || view.dataset.step !== state.step){
    stage.innerHTML = "";
    view = document.createElement("div");
    view.className = "step-view";
    view.dataset.step = state.step;
    stage.appendChild(view);
  }

  document.getElementById("headerCharName").textContent = state.name ? `${state.name}` : "";
  document.getElementById("stepCaption").textContent = STEP_META[state.step].caption;

  const renderers = {
    intro: renderIntro, race: renderRace, subrace: renderSubrace, class: renderClassStep,
    abilities: renderAbilities, equipment: renderEquipment, magic: renderMagic, sheet: renderSheet
  };
  renderers[state.step](view);

  const steps = getActiveSteps();
  const idx = steps.indexOf(state.step);
  document.getElementById("btnBack").style.visibility = idx === 0 ? "hidden" : "visible";
  const nextBtn = document.getElementById("btnNext");
  nextBtn.style.display = state.step === "sheet" ? "none" : "inline-block";
  nextBtn.textContent = (idx === steps.length - 2) ? "К итоговому листу →" : "Далее →";
  updateNextEnabled();
}

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- Step: Intro ---------------- */
function renderIntro(view){
  view.innerHTML = `
    <div class="view-header">
      <h1>Кто ты, герой?</h1>
      <p>Прежде чем ступить на путь приключений, дай себе имя. Остальное — раса, класс и судьба — определится дальше.</p>
    </div>
    <div style="max-width:520px;margin:0 auto;">
      <div class="form-row">
        <label>Имя персонажа</label>
        <input type="text" id="inName" placeholder="Например, Астарион" value="${escapeHtml(state.name)}">
      </div>
      <div class="form-row">
        <label>Мировоззрение (необязательно)</label>
        <select id="inAlign">
          <option value="">— не выбрано —</option>
          ${["Законно-добрый","Нейтрально-добрый","Хаотично-добрый","Законно-нейтральный","Истинно нейтральный","Хаотично-нейтральный","Законно-злой","Нейтрально-злой","Хаотично-злой"].map(a => `<option ${state.alignment===a?"selected":""}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="form-row">
        <label>Предыстория / происхождение (необязательно)</label>
        <textarea id="inBg" rows="3" placeholder="Пара строк о прошлом героя...">${escapeHtml(state.background)}</textarea>
      </div>
    </div>
  `;
  view.querySelector("#inName").oninput = e => { state.name = e.target.value; updateNextEnabled(); };
  view.querySelector("#inAlign").onchange = e => state.alignment = e.target.value;
  view.querySelector("#inBg").oninput = e => state.background = e.target.value;
}

/* ---------------- Step: Race ---------------- */
function renderRace(view){
  view.innerHTML = `
    <div class="view-header"><h1>Выбери расу</h1><p>Раса определяет врождённые способности, бонусы характеристик и часть истории твоего героя.</p></div>
    <div class="choice-grid" id="raceGrid"></div>
    <div id="raceDetail"></div>
  `;
  const grid = view.querySelector("#raceGrid");
  DND_DATA.races.forEach(r => {
    const card = document.createElement("div");
    card.className = "choice-card" + (state.raceId === r.id ? " selected" : "");
    card.innerHTML = `
      <span class="check">✓</span>
      <span class="glyph">${RACE_GLYPH[r.id] || "❖"}</span>
      <div class="pick-name">${r.name}</div>
      <div class="pick-sub">${r.nameEn || ""}</div>
      <div class="pick-meta">
        <span class="tag">Скорость ${r.speed} фт</span>
        <span class="tag">${r.size}</span>
      </div>
    `;
    card.onclick = () => {
      state.raceId = r.id;
      if (!r.subraces || !r.subraces.some(s => s.id === state.subraceId)) state.subraceId = null;
      render();
    };
    grid.appendChild(card);
  });
  renderRaceDetail(view.querySelector("#raceDetail"));
}
function renderRaceDetail(el){
  const r = getRace();
  if (!r){ el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="detail-panel">
      <h3>${r.name}</h3>
      <div class="stat-row">${abilityBonusChips(r.abilityBonuses)}</div>
      <ul>${(r.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
      ${r.languages ? `<p style="color:var(--text-dim);margin-top:10px;">Языки: ${r.languages.join(", ")}</p>` : ""}
    </div>
  `;
}
function abilityBonusChips(bonuses){
  if (!bonuses) return "";
  if (bonuses.all) return `<span class="stat-chip"><b>+${bonuses.all}</b> ко всем характеристикам</span>`;
  return Object.entries(bonuses).map(([k,v]) => `<span class="stat-chip"><b>${ABILITY_NAMES[k]||k.toUpperCase()}</b> +${v}</span>`).join("");
}

/* ---------------- Step: Subrace ---------------- */
function renderSubrace(view){
  const r = getRace();
  view.innerHTML = `
    <div class="view-header"><h1>Выбери подрасу ${r.name.toLowerCase()}а</h1><p>Подраса добавляет особые черты и усиливает твои характеристики.</p></div>
    <div class="choice-grid" id="subGrid"></div>
    <div id="subDetail"></div>
  `;
  const grid = view.querySelector("#subGrid");
  r.subraces.forEach(s => {
    const card = document.createElement("div");
    card.className = "choice-card" + (state.subraceId === s.id ? " selected" : "");
    card.innerHTML = `
      <span class="check">✓</span>
      <span class="glyph">◈</span>
      <div class="pick-name">${s.name}</div>
      <div class="pick-meta">${abilityBonusChips(s.abilityBonuses)}</div>
    `;
    card.onclick = () => { state.subraceId = s.id; render(); };
    grid.appendChild(card);
  });
  renderSubraceDetail(view.querySelector("#subDetail"));
}
function renderSubraceDetail(el){
  const s = getSubrace();
  if (!s){ el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="detail-panel">
      <h3>${s.name}</h3>
      <ul>${(s.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
    </div>
  `;
}

/* ---------------- Step: Class ---------------- */
function renderClassStep(view){
  view.innerHTML = `
    <div class="view-header"><h1>Выбери класс</h1><p>Класс — твой путь к силе: воин меча, хранитель тайных знаний или клинок в тенях.</p></div>
    <div class="choice-grid" id="classGrid"></div>
    <div id="classDetail"></div>
  `;
  const grid = view.querySelector("#classGrid");
  DND_DATA.classes.forEach(c => {
    const card = document.createElement("div");
    card.className = "choice-card" + (state.classId === c.id ? " selected" : "");
    card.innerHTML = `
      <span class="check">✓</span>
      <span class="glyph">${CLASS_GLYPH[c.id] || "❖"}</span>
      <div class="pick-name">${c.name}</div>
      <div class="pick-sub">${c.nameEn || ""}</div>
      <div class="pick-meta">
        <span class="tag">Кость хитов k${c.hitDie}</span>
        ${c.spellcasting ? `<span class="tag">Заклинатель</span>` : ""}
      </div>
    `;
    card.onclick = () => {
      if (state.classId === c.id) return;
      state.classId = c.id;
      state.skillChoices = [];
      state.equipmentChoice = null;
      state.spells = [];
      state.abilityMode = null;
      state.abilityAssign = {};
      state.diceRolls = null;
      render();
    };
    grid.appendChild(card);
  });
  renderClassDetail(view.querySelector("#classDetail"));
}
function renderClassDetail(el){
  const c = getClass();
  if (!c){ el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="detail-panel">
      <h3>${c.name}</h3>
      <div class="stat-row">
        <span class="stat-chip"><b>Кость хитов</b> k${c.hitDie}</span>
        <span class="stat-chip"><b>Спасброски</b> ${(c.savingThrows||[]).join(", ")}</span>
      </div>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Доспехи:</b> ${(c.armorProficiency||[]).join(", ") || "—"}</p>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Оружие:</b> ${(c.weaponProficiency||[]).join(", ") || "—"}</p>
    </div>
  `;
}

/* ---------------- Step: Abilities ---------------- */
function ensureAbilityAssignInit(){
  if (!state.abilityAssign) state.abilityAssign = {};
}
function usedArrayValues(){
  return Object.values(state.abilityAssign).filter(v => v != null);
}
function racialBonusFor(ability){
  const r = getRace(); const s = getSubrace();
  let bonus = 0;
  if (r && r.abilityBonuses){
    if (r.abilityBonuses.all) bonus += r.abilityBonuses.all;
    else if (r.abilityBonuses[ability]) bonus += r.abilityBonuses[ability];
  }
  if (s && s.abilityBonuses){
    if (s.abilityBonuses.all) bonus += s.abilityBonuses.all;
    else if (s.abilityBonuses[ability]) bonus += s.abilityBonuses[ability];
  }
  return bonus;
}

const ABILITY_MODES = [
  { id: "dice",        label: "🎲 Бросок кубиков" },
  { id: "recommended",  label: "⭐ Рекомендованный билд" },
  { id: "free",         label: "✍ Свободное распределение" }
];

function applyRecommendedBuild(){
  autoAssignPool(STANDARD_ARRAY);
}

function renderAbilities(view){
  ensureAbilityAssignInit();
  view.innerHTML = `
    <div class="view-header"><h1>Распредели характеристики</h1><p>Выбери способ распределения характеристик. Расовые бонусы прибавятся автоматически сверху.</p></div>
    <div class="mode-tabs" id="modeTabs"></div>
    <div id="modeBody"></div>
    <div class="detail-panel">
      <h3>Навыки класса</h3>
      <p style="color:var(--text-dim);margin-top:0;" id="skillHint"></p>
      <div class="skill-grid" id="skillGrid"></div>
    </div>
  `;
  renderModeTabs(view);
  renderModeBody(view);
  renderSkillGrid(view);
}

function renderModeTabs(view){
  const el = view.querySelector("#modeTabs");
  el.innerHTML = ABILITY_MODES.map(m =>
    `<button class="mode-tab${state.abilityMode===m.id?" active":""}" data-mode="${m.id}">${m.label}</button>`
  ).join("");
  el.querySelectorAll(".mode-tab").forEach(btn => {
    btn.onclick = () => {
      const newMode = btn.dataset.mode;
      if (newMode === state.abilityMode) return;
      state.abilityMode = newMode;
      state.abilityAssign = {};
      state.diceRolls = null;
      if (newMode === "recommended") applyRecommendedBuild();
      renderModeTabs(view);
      renderModeBody(view);
      updateNextEnabled();
    };
  });
}

function renderModeBody(view){
  const body = view.querySelector("#modeBody");
  if (!state.abilityMode){
    body.innerHTML = `<p class="pool-note">Выбери способ распределения характеристик выше, чтобы продолжить.</p>`;
    return;
  }
  if (state.abilityMode === "dice") renderDiceMode(view, body);
  else if (state.abilityMode === "recommended") renderRecommendedMode(view, body);
  else renderFreeMode(view, body);
}

function autoAssignPool(pool){
  const c = getClass();
  const order = (c && CLASS_ABILITY_PRIORITY[c.id]) || ["str","dex","con","int","wis","cha"];
  const sorted = pool.slice().sort((a,b) => b - a);
  state.abilityAssign = {};
  order.forEach((ab, i) => { state.abilityAssign[ab] = sorted[i]; });
}

function renderDiceMode(view, body){
  if (!state.diceRolls){
    state.diceRolls = rollAbilityScores();
    autoAssignPool(state.diceRolls);
  }
  body.innerHTML = `
    <p class="pool-note">Для каждой характеристики брошено 4к6, худший кубик отброшен. Лучшие значения автоматически уходят в характеристики, важные для класса.</p>
    <button class="btn btn-gold" id="btnReroll" style="margin-bottom:14px;">🎲 Перебросить кубики</button>
    <div class="ability-grid" id="abGrid"></div>
  `;
  body.querySelector("#btnReroll").onclick = () => {
    state.diceRolls = rollAbilityScores();
    autoAssignPool(state.diceRolls);
    renderDiceMode(view, body);
    updateNextEnabled();
  };
  renderReadonlyGrid(body);
}

function renderReadonlyGrid(body){
  const grid = body.querySelector("#abGrid");
  grid.innerHTML = "";
  ABILITY_ORDER.forEach(ab => {
    const base = state.abilityAssign[ab];
    const bonus = racialBonusFor(ab);
    const total = base == null ? null : base + bonus;
    const card = document.createElement("div");
    card.className = "ability-card";
    card.innerHTML = `
      <div class="ab-name">${ABILITY_NAMES[ab]}</div>
      <div class="ab-roll">${base ?? "—"}</div>
      <div class="ab-total">${total ?? "—"}</div>
      <div class="ab-mod">модификатор ${total!=null?fmtMod(abilityMod(total)):"—"}</div>
      ${bonus ? `<div class="ab-bonus">расовый бонус +${bonus}</div>` : ""}
    `;
    grid.appendChild(card);
  });
}

function renderRecommendedMode(view, body){
  if (Object.keys(state.abilityAssign).length === 0) applyRecommendedBuild();
  const c = getClass();
  body.innerHTML = `
    <p class="pool-note">Стандартный набор 15/14/13/12/10/8 автоматически расставлен по характеристикам, важным для класса «${c?c.name:""}». Можешь поправить вручную — расовые бонусы прибавятся сверху.</p>
    <button class="btn btn-ghost" id="btnReapply" style="margin-bottom:14px;">↻ Применить рекомендацию заново</button>
    <div class="ability-grid" id="abGrid"></div>
    <p class="pool-note" id="poolNote"></p>
  `;
  body.querySelector("#btnReapply").onclick = () => {
    applyRecommendedBuild();
    renderRecommendedMode(view, body);
    updateNextEnabled();
  };
  renderAssignGrid(view, body, STANDARD_ARRAY);
}

function renderAssignGrid(view, body, pool){
  const grid = body.querySelector("#abGrid");
  grid.innerHTML = "";
  const used = usedArrayValues();
  ABILITY_ORDER.forEach(ab => {
    const current = state.abilityAssign[ab] ?? "";
    const options = pool.map(v => {
      const usedCount = used.filter(u => u === v).length;
      const poolCount = pool.filter(p => p === v).length;
      const disabled = usedCount >= poolCount && current !== v;
      return `<option value="${v}" ${v===current?"selected":""} ${disabled?"disabled":""}>${v}</option>`;
    }).join("");
    const bonus = racialBonusFor(ab);
    const total = current === "" ? null : Number(current) + bonus;
    const card = document.createElement("div");
    card.className = "ability-card";
    card.innerHTML = `
      <div class="ab-name">${ABILITY_NAMES[ab]}</div>
      <select data-ab="${ab}"><option value="">—</option>${options}</select>
      <div class="ab-total">${total ?? "—"}</div>
      <div class="ab-mod">модификатор ${total!=null?fmtMod(abilityMod(total)):"—"}</div>
      ${bonus ? `<div class="ab-bonus">расовый бонус +${bonus}</div>` : ""}
    `;
    card.querySelector("select").onchange = e => {
      const v = e.target.value === "" ? null : Number(e.target.value);
      state.abilityAssign[ab] = v;
      renderAssignGrid(view, body, pool);
      updateNextEnabled();
    };
    grid.appendChild(card);
  });
  const leftover = pool.slice();
  usedArrayValues().forEach(v => { const i = leftover.indexOf(v); if (i>-1) leftover.splice(i,1); });
  const note = body.querySelector("#poolNote");
  if (note) note.textContent = leftover.length
    ? `Осталось распределить: ${leftover.slice().sort((a,b)=>b-a).join(", ")}`
    : "Все значения распределены ✓";
}

function renderFreeMode(view, body){
  body.innerHTML = `
    <p class="pool-note">Впиши любое значение от 3 до 18 для каждой характеристики — без ограничения стандартным набором.</p>
    <div class="ability-grid" id="abGrid"></div>
  `;
  renderFreeGrid(view, body);
}

function renderFreeGrid(view, body){
  const grid = body.querySelector("#abGrid");
  grid.innerHTML = "";
  ABILITY_ORDER.forEach(ab => {
    const current = state.abilityAssign[ab] ?? "";
    const bonus = racialBonusFor(ab);
    const total = current === "" ? null : Number(current) + bonus;
    const card = document.createElement("div");
    card.className = "ability-card";
    card.innerHTML = `
      <div class="ab-name">${ABILITY_NAMES[ab]}</div>
      <input type="number" min="3" max="18" data-ab="${ab}" value="${current}">
      <div class="ab-total">${total ?? "—"}</div>
      <div class="ab-mod">модификатор ${total!=null?fmtMod(abilityMod(total)):"—"}</div>
      ${bonus ? `<div class="ab-bonus">расовый бонус +${bonus}</div>` : ""}
    `;
    card.querySelector("input").oninput = e => {
      let v = e.target.value === "" ? null : Number(e.target.value);
      if (v != null){ v = Math.max(3, Math.min(18, Math.round(v))); }
      state.abilityAssign[ab] = v;
      renderFreeGrid(view, body);
      updateNextEnabled();
    };
    grid.appendChild(card);
  });
}

function renderSkillGrid(view){
  const c = getClass();
  const grid = view.querySelector("#skillGrid");
  const hint = view.querySelector("#skillHint");
  if (!c || !c.skillChoices){ grid.innerHTML=""; hint.textContent=""; return; }
  hint.textContent = `Выбери ${c.skillChoices.count} навыков из списка класса.`;
  grid.innerHTML = "";
  (c.skillChoices.options||[]).forEach(skill => {
    const checked = state.skillChoices.includes(skill);
    const atLimit = state.skillChoices.length >= c.skillChoices.count && !checked;
    const opt = document.createElement("label");
    opt.className = "skill-opt" + (checked?" checked":"") + (atLimit?" disabled":"");
    opt.innerHTML = `<input type="checkbox" ${checked?"checked":""} ${atLimit?"disabled":""}> ${skill} <span style="color:var(--text-dim);font-size:.75rem;margin-left:auto;">${SKILL_ABILITY[skill]?SKILL_ABILITY[skill].toUpperCase():""}</span>`;
    opt.querySelector("input").onchange = e => {
      if (e.target.checked) state.skillChoices.push(skill);
      else state.skillChoices = state.skillChoices.filter(s => s !== skill);
      renderSkillGrid(view);
      updateNextEnabled();
    };
    grid.appendChild(opt);
  });
}

/* ---------------- Step: Equipment ---------------- */
function renderEquipment(view){
  const c = getClass();
  view.innerHTML = `
    <div class="view-header"><h1>Выбери снаряжение</h1><p>Готовые, реалистично собранные комплекты для класса — продуманы так, чтобы герой мог унести и использовать всё сразу.</p></div>
    <div id="eqList"></div>
  `;
  renderEquipList(view);
}
function renderEquipList(view){
  const c = getClass();
  const list = view.querySelector("#eqList");
  list.innerHTML = "";
  (c.startingEquipment||[]).forEach(opt => {
    const div = document.createElement("div");
    div.className = "equip-choice" + (state.equipmentChoice === opt.choice ? " selected" : "");
    div.innerHTML = `
      <span class="eq-label">Вариант ${opt.choice}${opt.role ? " — " + opt.role : ""}</span>
      <ul>${opt.items.map(i => `<li><b>${i.name||i}</b>${i.info ? `<span class="eq-info">${i.info}</span>` : ""}</li>`).join("")}</ul>
    `;
    div.onclick = () => {
      state.equipmentChoice = opt.choice;
      renderEquipList(view);
      updateNextEnabled();
    };
    list.appendChild(div);
  });
}

/* ---------------- Step: Magic ---------------- */
function renderMagic(view){
  const c = getClass();
  const r = CASTER_RULES[c.id];
  const abMod = abilityMod(getTotalAbility(r.ability));
  const cantripLimit = r.cantrips;
  const spellLimit = casterKnownCount(c.id, abMod);
  const cantrips = DND_DATA.spells.filter(s => s.level === 0 && s.classes.includes(c.id));
  const lvl1 = DND_DATA.spells.filter(s => s.level === 1 && s.classes.includes(c.id));

  view.innerHTML = `
    <div class="view-header"><h1>Выбери заклинания</h1><p>${c.name} черпает силу из ${ABILITY_NAMES[r.ability]}. Выбери кантрипы и заклинания 1-го уровня.</p></div>
    <div class="spell-counter" id="spCounter"></div>
    <h3 class="spell-group-title">Кантрипы (нужно выбрать: ${cantripLimit})</h3>
    <div class="spell-list" id="cantripList"></div>
    <h3 class="spell-group-title">Заклинания 1-го уровня (нужно выбрать: ${spellLimit})</h3>
    <div class="spell-list" id="lvl1List"></div>
  `;
  const renderList = (container, spells, limit, levelTag) => {
    container.innerHTML = "";
    spells.forEach(sp => {
      const selected = state.spells.includes(sp.id);
      const countSelectedInGroup = state.spells.filter(id => spells.some(s=>s.id===id)).length;
      const atLimit = countSelectedInGroup >= limit && !selected;
      const card = document.createElement("div");
      card.className = "spell-card" + (selected?" selected":"") + (atLimit?" disabled":"");
      card.style.opacity = atLimit ? .45 : 1;
      card.innerHTML = `
        <div class="sp-top"><span class="sp-name">${sp.name}</span><span class="sp-lvl">${sp.school||""}</span></div>
        <div class="sp-desc">${sp.description||""}</div>
      `;
      if (!atLimit || selected) card.onclick = () => {
        if (selected) state.spells = state.spells.filter(id => id !== sp.id);
        else state.spells.push(sp.id);
        renderMagic(view);
        updateNextEnabled();
      };
      container.appendChild(card);
    });
  };
  renderList(view.querySelector("#cantripList"), cantrips, cantripLimit);
  renderList(view.querySelector("#lvl1List"), lvl1, spellLimit);
  const chosenCantrips = state.spells.filter(id => cantrips.some(s=>s.id===id)).length;
  const chosenLvl1 = state.spells.filter(id => lvl1.some(s=>s.id===id)).length;
  view.querySelector("#spCounter").textContent = `Выбрано кантрипов: ${chosenCantrips}/${cantripLimit} · заклинаний 1-го уровня: ${chosenLvl1}/${spellLimit}`;
  updateNextEnabled();
}
function getTotalAbility(ab){
  const base = state.abilityAssign[ab];
  if (base == null) return 10;
  return base + racialBonusFor(ab);
}

/* ---------------- Step: Sheet ---------------- */
function computeAC(dexMod, equip){
  if (!equip) return 10 + dexMod;
  const names = equip.items.map(i => i.name || i);
  let armorAC = 10 + dexMod; // без доспеха
  for (const n of names){
    const a = ARMOR_AC[n];
    if (a){
      const dexBonus = a.dexCap === 0 ? 0 : (a.dexCap != null ? Math.min(dexMod, a.dexCap) : dexMod);
      armorAC = a.base + dexBonus;
      break;
    }
  }
  const hasShield = names.some(n => SHIELD_NAMES.includes(n));
  return armorAC + (hasShield ? 2 : 0);
}
function computeFinal(){
  const r = getRace(), s = getSubrace(), c = getClass();
  const totals = {};
  ABILITY_ORDER.forEach(ab => totals[ab] = getTotalAbility(ab));
  const mods = {};
  ABILITY_ORDER.forEach(ab => mods[ab] = abilityMod(totals[ab]));
  const pb = PROFICIENCY_BONUS_LVL1;
  const saves = ABILITY_ORDER.map(ab => {
    const prof = c && c.savingThrows && c.savingThrows.map(x=>x.toLowerCase()).includes(ab);
    return { ab, prof, value: mods[ab] + (prof ? pb : 0) };
  });
  const skills = Object.entries(SKILL_ABILITY).map(([name, ab]) => {
    const prof = state.skillChoices.includes(name);
    return { name, ab, prof, value: mods[ab] + (prof ? pb : 0) };
  });
  const hp = (c ? c.hitDie : 8) + mods.con;
  const equip = c ? (c.startingEquipment||[]).find(e => e.choice === state.equipmentChoice) : null;
  const ac = computeAC(mods.dex, equip);
  const initiative = mods.dex;
  const spellNames = state.spells.map(id => (DND_DATA.spells.find(sp=>sp.id===id)||{}).name).filter(Boolean);
  return { r, s, c, totals, mods, pb, saves, skills, hp, ac, initiative, equip, spellNames };
}

function renderSheet(view){
  const d = computeFinal();
  view.innerHTML = `
    <div class="view-header"><h1>Твой герой готов</h1><p>Проверь лист персонажа и экспортируй его в PDF — или вернись назад, чтобы что-то изменить.</p></div>
    <div class="sheet-actions">
      <button class="btn btn-gold" id="btnPdf">⇩ Скачать PDF</button>
      <button class="btn btn-ghost" id="btnPrint">🖨 Печать</button>
      <button class="btn btn-ghost" id="btnRestart">↻ Начать заново</button>
    </div>
    <div class="sheet-wrap"><div id="charSheet">${sheetHTML(d)}</div></div>
  `;
  view.querySelector("#btnPdf").onclick = () => exportPDF();
  view.querySelector("#btnPrint").onclick = () => window.print();
  view.querySelector("#btnRestart").onclick = () => {
    if (confirm("Начать создание персонажа заново? Все данные будут сброшены.")){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };
}

function sheetHTML(d){
  const { r, s, c, totals, mods, pb, saves, skills, hp, ac, initiative, equip, spellNames } = d;
  const abBox = ab => `
    <div class="ab-box">
      <div class="n">${ABILITY_NAMES[ab]}</div>
      <div class="m">${totals[ab]}</div>
      <div class="s">${fmtMod(mods[ab])}</div>
    </div>`;
  const saveRow = row => `<div class="save-row ${row.prof?'prof':''}"><span>${row.prof?'●':'○'} ${ABILITY_NAMES[row.ab]}</span><b>${fmtMod(row.value)}</b></div>`;
  const skillRow = row => `<div class="skill-row ${row.prof?'prof':''}"><span>${row.prof?'●':'○'} ${row.name}</span><b>${fmtMod(row.value)}</b></div>`;
  const traits = [
    ...(r ? (r.traits||[]) : []),
    ...(s ? (s.traits||[]) : [])
  ];
  return `
    <div class="sheet-head">
      <div>
        <h2>${escapeHtml(state.name) || "Безымянный герой"}</h2>
        <div class="sub">${r?r.name:""}${s?(" ("+s.name+")"):""} · ${c?c.name:""}${state.alignment?(" · "+state.alignment):""}</div>
      </div>
      <div class="lvlbox">Уровень 1<br>Бонус мастерства ${fmtMod(pb)}</div>
    </div>
    <div class="sheet-grid">
      <div class="abilities-col">
        ${ABILITY_ORDER.map(abBox).join("")}
      </div>
      <div class="mid-col">
        <div class="saves-box"><h4>Спасброски</h4>${saves.map(saveRow).join("")}</div>
        <div class="skills-box"><h4>Навыки</h4>${skills.map(skillRow).join("")}</div>
      </div>
      <div class="right-col">
        <div class="combat-stats">
          <div class="cbox"><div class="n">Класс доспеха</div><div class="m">${ac}</div></div>
          <div class="cbox"><div class="n">Хиты</div><div class="m">${hp}</div></div>
          <div class="cbox"><div class="n">Инициатива</div><div class="m">${fmtMod(initiative)}</div></div>
          <div class="cbox"><div class="n">Скорость</div><div class="m">${r?r.speed:30}</div></div>
        </div>
        <div class="equip-box">
          <h4>Снаряжение</h4>
          <ul>${equip ? equip.items.map(i=>`<li><b>${i.name||i}</b>${i.info?` <span style="color:var(--text-dim);font-size:.78rem;">(${i.info})</span>`:""}</li>`).join("") : "<li>—</li>"}</ul>
        </div>
        ${spellNames.length ? `<div class="spells-box"><h4>Заклинания</h4><ul>${spellNames.map(n=>`<li>${n}</li>`).join("")}</ul></div>` : ""}
      </div>
    </div>
    <div class="traits-box" style="margin-top:14px;">
      <h4>Расовые и классовые черты</h4>
      <div>${traits.join(" · ")}</div>
    </div>
    ${state.background ? `<div class="notes-box" style="margin-top:12px;"><h4>Предыстория</h4><div>${escapeHtml(state.background)}</div></div>` : ""}
    <div class="sheet-footer"><span>Творец Героя — редактор персонажей D&amp;D 5e</span><span>SRD (Open Game License)</span></div>
  `;
}

async function exportPDF(){
  const node = document.getElementById("charSheet");
  toast("Готовим PDF…");
  try{
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ead9b3" });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pageW - 40, h = w / ratio;
    if (h > pageH - 40){ h = pageH - 40; w = h * ratio; }
    pdf.addImage(img, "JPEG", (pageW-w)/2, 20, w, h);
    const fname = (state.name || "personazh").replace(/[^a-zA-Zа-яА-Я0-9_-]+/g,"_") + "_dnd5e.pdf";
    pdf.save(fname);
    toast("PDF сохранён ✓");
  }catch(e){
    console.error(e);
    toast("Не удалось создать PDF, попробуй кнопку «Печать»");
  }
}

/* ---------------- Validation / Navigation ---------------- */
function validateStep(stepId){
  switch(stepId){
    case "intro": return state.name.trim().length > 0 || "Введи имя персонажа";
    case "race": return !!state.raceId || "Выбери расу";
    case "subrace": return !!state.subraceId || "Выбери подрасу";
    case "class": return !!state.classId || "Выбери класс";
    case "abilities": {
      const allAssigned = ABILITY_ORDER.every(ab => state.abilityAssign[ab] != null);
      if (!allAssigned) return "Распредели все шесть значений характеристик";
      const c = getClass();
      if (c && c.skillChoices && state.skillChoices.length < c.skillChoices.count) return `Выбери ${c.skillChoices.count} навыка(ов)`;
      return true;
    }
    case "equipment": return !!state.equipmentChoice || "Выбери комплект снаряжения";
    case "magic": {
      const c = getClass(); const r = CASTER_RULES[c.id];
      const abMod = abilityMod(getTotalAbility(r.ability));
      const need = r.cantrips + casterKnownCount(c.id, abMod);
      return state.spells.length >= need || "Выбери все доступные заклинания и кантрипы";
    }
    default: return true;
  }
}
function updateNextEnabled(){
  const btn = document.getElementById("btnNext");
  if (!btn) return;
  btn.disabled = validateStep(state.step) !== true;
}

function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function next(){
  const v = validateStep(state.step);
  if (v !== true){ toast(v); return; }
  const steps = getActiveSteps();
  const idx = steps.indexOf(state.step);
  if (idx < steps.length - 1){ state.step = steps[idx+1]; render(); window.scrollTo(0,0); }
}
function back(){
  const steps = getActiveSteps();
  const idx = steps.indexOf(state.step);
  if (idx > 0){ state.step = steps[idx-1]; render(); window.scrollTo(0,0); }
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  document.getElementById("btnNext").onclick = next;
  document.getElementById("btnBack").onclick = back;
  render();
});
