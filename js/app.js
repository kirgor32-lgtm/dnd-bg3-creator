/* ===== Творец Героя — логика визарда создания персонажа ===== */

const STORAGE_KEY = "dnd-bg3-creator-state-v1";

const RACE_GLYPH = {
  human:"🙂", elf:"🧝", dwarf:"⛏", halfling:"🍀", dragonborn:"🐉",
  gnome:"🔧", "half-elf":"🌙", "half-orc":"🪓", tiefling:"🔥",
  genasi:"🌪", kenku:"🐦", shifter:"🐺", aasimar:"👼", tabaxi:"🐱",
  goliath:"⛰", triton:"🔱", goblin:"🗿", centaur:"🐎", changeling:"🎭"
};
const CLASS_GLYPH = {
  barbarian:"🪓", bard:"🎵", cleric:"✝", druid:"🌿", fighter:"⚔",
  monk:"☯", paladin:"🛡", ranger:"🏹", rogue:"🗡", sorcerer:"✨",
  warlock:"👁", wizard:"📖"
};

let state = {
  step: "intro",
  name: "", alignment: "", background: "", photoDataUrl: null,
  raceId: null, subraceId: null, classId: null,
  abilityMode: null, diceRolls: null,
  abilities: {}, abilityAssign: {}, skillChoices: [],
  physiqueMode: null, heightCm: null, weightKg: null, gender: "male", bodyType: "average",
  equipmentChoice: null,
  customEquip: { weapons: [], armorId: null, shield: false, shieldId: null, packId: null },
  spells: [], spellSlotsUsed: 0,
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
  flexbonus: { title: "Расовый бонус", caption: "Расовый бонус характеристик" },
  abilities: { title: "Характеристики", caption: "Распределение характеристик" },
  skills:    { title: "Навыки", caption: "Навыки класса" },
  physique:  { title: "Телосложение", caption: "Рост и вес" },
  equipment: { title: "Снаряжение", caption: "Снаряжение" },
  magic:     { title: "Магия", caption: "Заклинания" },
  sheet:     { title: "Лист персонажа", caption: "Итог" }
};

function getActiveSteps(){
  const steps = ["intro","race"];
  const r = getRace();
  if (r && r.subraces && r.subraces.length) steps.push("subrace");
  steps.push("class");
  if (r && r.abilityBonuses && r.abilityBonuses.flexible) steps.push("flexbonus");
  steps.push("abilities");
  steps.push("skills");
  steps.push("physique");
  steps.push("equipment");
  const c = getClass();
  if (c && c.spellcasting && CASTER_RULES[c.id]) steps.push("magic");
  steps.push("sheet");
  return steps;
}

function renderRail(){
  const steps = getActiveSteps();
  const rail = document.getElementById("stepRail");
  const idxCurrent = steps.indexOf(state.step);
  const pct = steps.length > 1 ? Math.round((idxCurrent / (steps.length - 1)) * 100) : 0;
  rail.innerHTML = `
    <div class="step-badge">
      <span class="step-badge-num">Шаг ${idxCurrent+1} <span class="step-badge-of">из ${steps.length}</span></span>
      <span class="step-badge-title">${STEP_META[state.step].title}</span>
    </div>
    <div class="step-progress"><div class="step-progress-fill" style="width:${pct}%"></div></div>
    <div class="step-dots">${steps.map((id,i) => `<span class="step-dot${i===idxCurrent?' active':''}${i<idxCurrent?' done':''}"></span>`).join("")}</div>
  `;
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
    flexbonus: renderFlexBonusStep, abilities: renderAbilities, skills: renderSkillsStep,
    physique: renderPhysique, equipment: renderEquipment, magic: renderMagic, sheet: renderSheet
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
    <div class="intro-layout">
      <div class="intro-photo-col">
        <div class="photo-drop" id="photoDrop">
          ${state.photoDataUrl ? `<img id="photoPreview" src="${state.photoDataUrl}">` : `<div class="photo-placeholder"><span>🖼</span><span>Загрузить портрет</span></div>`}
          <input type="file" id="inPhoto" accept="image/*" hidden>
        </div>
        ${state.photoDataUrl ? `<button class="btn btn-ghost" id="btnPhotoClear" style="margin-top:8px;">✕ Убрать фото</button>` : ""}
        <p class="pool-note" style="margin-top:8px;">Любое фото или арт — подгонится под рамку автоматически. Появится в левом верхнем углу итогового листа.</p>
      </div>
      <div class="intro-form-col">
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
          <textarea id="inBg" rows="4" placeholder="Пара строк о прошлом героя...">${escapeHtml(state.background)}</textarea>
        </div>
      </div>
    </div>
  `;
  view.querySelector("#inName").oninput = e => { state.name = e.target.value; updateNextEnabled(); };
  view.querySelector("#inAlign").onchange = e => state.alignment = e.target.value;
  view.querySelector("#inBg").oninput = e => state.background = e.target.value;
  const drop = view.querySelector("#photoDrop");
  const fileInput = view.querySelector("#inPhoto");
  drop.onclick = () => fileInput.click();
  fileInput.onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    cropImageToSquare(file, 640).then(dataUrl => {
      state.photoDataUrl = dataUrl;
      saveState();
      renderIntro(view);
    });
  };
  const clearBtn = view.querySelector("#btnPhotoClear");
  if (clearBtn) clearBtn.onclick = (e) => { e.stopPropagation(); state.photoDataUrl = null; saveState(); renderIntro(view); };
}
/* Авто-кадрирование: любое фото любого формата приводится к квадрату (cover-кроп по центру),
   чтобы хорошо смотреться и в рамке загрузки, и на итоговом листе персонажа. */
function cropImageToSquare(file, size){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------- Step: Race ---------------- */
function renderRace(view){
  view.innerHTML = `
    <div class="view-header"><h1>Выбери расу</h1><p>Раса определяет врождённые способности, бонусы характеристик и часть истории твоего героя.</p></div>
    <div class="split-pane">
      <div class="split-list" id="raceGrid"></div>
      <div class="split-detail" id="raceDetail"></div>
    </div>
  `;
  const grid = view.querySelector("#raceGrid");
  DND_DATA.races.forEach(r => {
    const row = document.createElement("div");
    row.className = "pick-row" + (state.raceId === r.id ? " selected" : "");
    row.innerHTML = `
      <span class="glyph">${RACE_GLYPH[r.id] || "❖"}</span>
      <div class="pr-text">
        <div class="pr-name">${r.name}</div>
        <div class="pr-sub">${r.nameEn || ""} · ${r.size}, ${r.speed} фт</div>
      </div>
    `;
    row.onclick = () => {
      if (state.raceId === r.id) return;
      state.raceId = r.id;
      if (!r.subraces || !r.subraces.some(s => s.id === state.subraceId)) state.subraceId = null;
      state.physiqueMode = null; state.heightCm = null; state.weightKg = null;
      state.flexBonus = null;
      grid.querySelectorAll(".pick-row.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderRaceDetail(view.querySelector("#raceDetail"));
      saveState();
      updateNextEnabled();
    };
    grid.appendChild(row);
  });
  renderRaceDetail(view.querySelector("#raceDetail"));
}
function renderRaceDetail(el){
  const r = getRace();
  if (!r){ el.innerHTML = `<p class="pool-note">Выбери расу в списке слева, чтобы увидеть её черты.</p>`; return; }
  el.innerHTML = `
    <div class="detail-panel">
      <img class="entity-portrait" src="assets/img/races/${r.id}.jpg" alt="${r.name}" loading="lazy" onerror="this.remove()">
      <h3>${r.name}</h3>
      <div class="stat-row">${abilityBonusChips(r.abilityBonuses)}</div>
      <ul>${(r.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
      ${r.languages ? `<p style="color:var(--text-dim);margin-top:10px;">Языки: ${r.languages.join(", ")}</p>` : ""}
    </div>
  `;
}
function abilityBonusChips(bonuses){
  if (!bonuses) return "";
  if (bonuses.flexible) return `<span class="stat-chip"><b>Гибкий бонус</b> игрок распределяет сам</span>`;
  if (bonuses.all) return `<span class="stat-chip"><b>+${bonuses.all}</b> ко всем характеристикам</span>`;
  return Object.entries(bonuses).map(([k,v]) => `<span class="stat-chip"><b>${ABILITY_NAMES[k]||k.toUpperCase()}</b> +${v}</span>`).join("");
}

/* ---------------- Step: Subrace ---------------- */
function renderSubrace(view){
  const r = getRace();
  view.innerHTML = `
    <div class="view-header"><h1>Выбери подрасу ${r.name.toLowerCase()}а</h1><p>Подраса добавляет особые черты и усиливает твои характеристики.</p></div>
    <div class="split-pane">
      <div class="split-list" id="subGrid"></div>
      <div class="split-detail" id="subDetail"></div>
    </div>
  `;
  const grid = view.querySelector("#subGrid");
  r.subraces.forEach(s => {
    const row = document.createElement("div");
    row.className = "pick-row" + (state.subraceId === s.id ? " selected" : "");
    row.innerHTML = `
      <span class="glyph">◈</span>
      <div class="pr-text">
        <div class="pr-name">${s.name}</div>
        <div class="pr-sub">${abilityBonusChips(s.abilityBonuses).replace(/<[^>]+>/g,"").trim()}</div>
      </div>
    `;
    row.onclick = () => {
      if (state.subraceId === s.id) return;
      state.subraceId = s.id;
      state.physiqueMode = null; state.heightCm = null; state.weightKg = null;
      grid.querySelectorAll(".pick-row.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderSubraceDetail(view.querySelector("#subDetail"));
      saveState();
      updateNextEnabled();
    };
    grid.appendChild(row);
  });
  renderSubraceDetail(view.querySelector("#subDetail"));
}
function renderSubraceDetail(el){
  const s = getSubrace();
  const r = getRace();
  if (!s){ el.innerHTML = `<p class="pool-note">Выбери подрасу слева.</p>`; return; }
  el.innerHTML = `
    <div class="detail-panel">
      <img class="entity-portrait" src="assets/img/races/${s.id}.jpg" alt="${s.name}" loading="lazy" onerror="this.onerror=function(){this.remove()};this.src='assets/img/races/${r.id}.jpg'">
      <h3>${s.name}</h3>
      <div class="stat-row">${abilityBonusChips(s.abilityBonuses)}</div>
      <ul>${(s.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
    </div>
  `;
}

/* ---------------- Step: Class ---------------- */
function renderClassStep(view){
  view.innerHTML = `
    <div class="view-header"><h1>Выбери класс</h1><p>Класс — твой путь к силе: воин меча, хранитель тайных знаний или клинок в тенях.</p></div>
    <div class="class-icon-grid" id="classGrid"></div>
    <div class="split-detail" id="classDetail"></div>
  `;
  const grid = view.querySelector("#classGrid");
  DND_DATA.classes.forEach(c => {
    const row = document.createElement("div");
    row.className = "class-icon-item" + (state.classId === c.id ? " selected" : "");
    row.innerHTML = `
      <div class="class-icon-square"><img src="assets/img/classes/${c.id}.png" alt="${c.name}" loading="lazy" onerror="this.outerHTML='${CLASS_GLYPH[c.id] || "❖"}'"></div>
      <div class="class-icon-label">${c.name}</div>
    `;
    row.onclick = () => {
      if (state.classId === c.id) return;
      state.classId = c.id;
      state.skillChoices = [];
      state.equipmentChoice = null;
      state.customEquip = { weapons: [], armorId: null, shield: false, shieldId: null, packId: null };
      state.spells = [];
      state.abilityMode = null;
      state.abilityAssign = {};
      state.diceRolls = null;
      grid.querySelectorAll(".class-icon-item.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderClassDetail(view.querySelector("#classDetail"));
      saveState();
      updateNextEnabled();
    };
    grid.appendChild(row);
  });
  renderClassDetail(view.querySelector("#classDetail"));
}
function renderClassDetail(el){
  const c = getClass();
  if (!c){ el.innerHTML = `<p class="pool-note">Выбери класс слева.</p>`; return; }
  const featuresHtml = (c.features||[]).map(f =>
    `<li><b style="color:var(--gold-bright)">${f.name}</b> — ${f.info}</li>`
  ).join("");
  const skillOpts = (c.skillChoices && c.skillChoices.options) || [];
  const equipRoles = (c.startingEquipment||[]).map(e => `${e.choice}: ${e.role}`).join(" · ");
  el.innerHTML = `
    <div class="detail-panel">
      <div class="class-icon-badge"><img src="assets/img/classes/${c.id}.png" alt="${c.name}" loading="lazy" onerror="this.outerHTML='${CLASS_GLYPH[c.id] || "❖"}'"></div>
      <h3>${c.name}</h3>
      ${c.description ? `<p class="class-flavor">${c.description}</p>` : ""}
      <div class="stat-row">
        <span class="stat-chip"><b>Кость хитов</b> к${c.hitDie}</span>
        <span class="stat-chip"><b>Спасброски</b> ${(c.savingThrows||[]).map(s => ABILITY_NAMES[s.toLowerCase()] || s).join(", ")}</span>
      </div>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Доспехи:</b> ${(c.armorProficiency||[]).join(", ") || "—"}</p>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Оружие:</b> ${(c.weaponProficiency||[]).join(", ") || "—"}</p>
      ${featuresHtml ? `<p style="margin:10px 0 4px;color:var(--parchment)"><b>Умения 1 уровня:</b></p><ul class="feature-list">${featuresHtml}</ul>` : ""}
      ${skillOpts.length ? `<p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Навыки на выбор (${c.skillChoices.count}):</b> ${skillOpts.join(", ")}</p>` : ""}
      ${equipRoles ? `<p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--parchment)">Снаряжение:</b> ${equipRoles}</p>` : ""}
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
    if (r.abilityBonuses.flexible) bonus += flexBonusFor(ability);
    else if (r.abilityBonuses.all) bonus += r.abilityBonuses.all;
    else if (r.abilityBonuses[ability]) bonus += r.abilityBonuses[ability];
  }
  if (s && s.abilityBonuses){
    if (s.abilityBonuses.all) bonus += s.abilityBonuses.all;
    else if (s.abilityBonuses[ability]) bonus += s.abilityBonuses[ability];
  }
  return bonus;
}
/* Гибкий расовый бонус (MPMM/Monsters of the Multiverse): игрок сам распределяет
   +2/+1 на две характеристики или +1/+1/+1 на три. */
function flexBonusFor(ability){
  const f = state.flexBonus;
  if (!f || !f.picks) return 0;
  return f.picks[ability] || 0;
}
function flexBonusRemainingText(){
  const r = getRace();
  if (!r || !r.abilityBonuses || !r.abilityBonuses.flexible) return null;
  const f = state.flexBonus || { split: "21", picks: {} };
  const need = f.split === "111" ? [1,1,1] : [2,1];
  const used = Object.values(f.picks || {});
  return { need, used, done: used.sort().join(",") === need.slice().sort().join(",") };
}

const ABILITY_MODES = [
  { id: "recommended",  label: "⭐ Рекомендованный билд" },
  { id: "dice",        label: "🎲 Бросок кубиков" },
  { id: "free",         label: "✍ Свободное распределение" }
];

function applyRecommendedBuild(){
  autoAssignPool(STANDARD_ARRAY);
}

function renderAbilities(view){
  ensureAbilityAssignInit();
  if (!state.abilityMode){ state.abilityMode = "recommended"; applyRecommendedBuild(); }
  view.innerHTML = `
    <div class="view-header"><h1>Распредели характеристики</h1><p>Выбери способ распределения характеристик. Расовые бонусы прибавятся автоматически сверху.</p></div>
    <div class="mode-tabs" id="modeTabs"></div>
    <div id="modeBody"></div>
  `;
  renderModeTabs(view);
  renderModeBody(view);
}

/* ---------------- Step: Flex racial bonus (MPMM) ---------------- */
const FLEX_SPLITS = [
  { id: "21",  label: "+2 / +1" },
  { id: "111", label: "+1 / +1 / +1" }
];
const FLEX_MODES = [
  { id: "recommended", label: "⭐ Рекомендация" },
  { id: "dice",        label: "🎲 Бросок кубика" },
  { id: "free",        label: "✍ Свой выбор" }
];
function ensureFlexBonusInit(){
  if (!state.flexBonus) state.flexBonus = { split: "21", mode: null, picks: {} };
}
function flexAutoAssign(split, abilities){
  const need = (split === "111" ? [1,1,1] : [2,1]).slice();
  const picks = {};
  abilities.forEach((ab, i) => { if (need[i] != null) picks[ab] = need[i]; });
  return picks;
}
function renderFlexBonusStep(view){
  ensureFlexBonusInit();
  const r = getRace();
  const f = state.flexBonus;
  if (!f.mode){ f.mode = "recommended"; flexApplyRecommended(view); }
  view.innerHTML = `
    <div class="view-header"><h1>Гибкий расовый бонус — ${r.name}</h1><p>Эта раса не даёт фиксированные бонусы характеристик: распредели их сама/сам.</p></div>
    <div class="mode-tabs" id="splitTabs" style="margin-bottom:10px;"></div>
    <div class="mode-tabs" id="flexModeTabs"></div>
    <div id="flexModeBody"></div>
  `;
  const splitTabs = view.querySelector("#splitTabs");
  splitTabs.innerHTML = FLEX_SPLITS.map(s => `<button class="mode-tab${f.split===s.id?" active":""}" data-split="${s.id}">${s.label}</button>`).join("");
  splitTabs.querySelectorAll(".mode-tab").forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.split === f.split) return;
      state.flexBonus.split = btn.dataset.split;
      state.flexBonus.picks = {};
      if (f.mode === "dice") flexRollDice(view);
      else if (f.mode === "recommended") flexApplyRecommended(view);
      renderFlexModeBody(view);
      updateNextEnabled();
    };
  });
  const modeTabs = view.querySelector("#flexModeTabs");
  modeTabs.innerHTML = FLEX_MODES.map(m => `<button class="mode-tab${f.mode===m.id?" active":""}" data-mode="${m.id}">${m.label}</button>`).join("");
  modeTabs.querySelectorAll(".mode-tab").forEach(btn => {
    btn.onclick = () => {
      const newMode = btn.dataset.mode;
      if (newMode === f.mode) return;
      state.flexBonus.mode = newMode;
      state.flexBonus.picks = {};
      if (newMode === "dice") flexRollDice(view);
      else if (newMode === "recommended") flexApplyRecommended(view);
      renderFlexBonusStep(view);
      updateNextEnabled();
    };
  });
  renderFlexModeBody(view);
}
function flexRollDice(view){
  const abilities = ABILITY_ORDER.slice();
  for (let i = abilities.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [abilities[i], abilities[j]] = [abilities[j], abilities[i]];
  }
  state.flexBonus.picks = flexAutoAssign(state.flexBonus.split, abilities);
}
function flexApplyRecommended(view){
  const c = getClass();
  const order = (c && CLASS_ABILITY_PRIORITY[c.id]) || ABILITY_ORDER.slice();
  state.flexBonus.picks = flexAutoAssign(state.flexBonus.split, order);
}
function flexBonusGridHTML(picksEditable){
  const f = state.flexBonus;
  const need = f.split === "111" ? [1,1,1] : [2,1];
  const availableVals = need.includes(2) ? [2,1] : [1];
  return `
    <div class="ability-grid" id="flexGrid">
      ${ABILITY_ORDER.map(ab => `
        <div class="ability-card">
          <div class="ab-name">${ABILITY_NAMES[ab]}</div>
          ${picksEditable ? `
            <div class="chip-row" data-ab="${ab}">
              <button type="button" class="chip-btn${!f.picks[ab]?" active":""}" data-val="">—</button>
              ${availableVals.map(v => `<button type="button" class="chip-btn${f.picks[ab]===v?" active":""}" data-val="${v}">+${v}</button>`).join("")}
            </div>
          ` : `<div class="ab-bonus">${f.picks[ab] ? "+"+f.picks[ab] : "—"}</div>`}
        </div>
      `).join("")}
    </div>
  `;
}
function renderFlexModeBody(view){
  const body = view.querySelector("#flexModeBody");
  const f = state.flexBonus;
  const need = f.split === "111" ? [1,1,1] : [2,1];
  if (!f.mode){
    body.innerHTML = `<p class="pool-note">Выбери способ распределения бонуса выше.</p>`;
    return;
  }
  if (f.mode === "dice"){
    body.innerHTML = `
      <p class="pool-note">Бонус случайно разнесён по характеристикам.</p>
      <button class="btn btn-gold" id="btnFlexReroll" style="margin-bottom:14px;">🎲 Перебросить</button>
      ${flexBonusGridHTML(false)}
    `;
    body.querySelector("#btnFlexReroll").onclick = () => { flexRollDice(view); renderFlexModeBody(view); updateNextEnabled(); };
  } else if (f.mode === "recommended"){
    const c = getClass();
    body.innerHTML = `
      <p class="pool-note">Бонус направлен на характеристики, важные для класса «${c?c.name:""}».</p>
      ${flexBonusGridHTML(false)}
    `;
  } else {
    body.innerHTML = `
      ${flexBonusGridHTML(true)}
      <p class="pool-note" id="flexHint" style="margin-top:8px;"></p>
    `;
    const hint = body.querySelector("#flexHint");
    const updateHint = () => {
      const used = Object.values(state.flexBonus.picks);
      const ok = used.sort().join(",") === need.slice().sort().join(",");
      hint.innerHTML = ok ? `<span style="color:var(--gold-bright);">Бонус распределён ✓</span>` : `Нужно распределить: ${need.map(n=>"+"+n).join(", ")}`;
      updateNextEnabled();
    };
    body.querySelectorAll(".chip-row").forEach(row => {
      row.querySelectorAll(".chip-btn").forEach(btn => {
        btn.onclick = () => {
          const ab = row.dataset.ab;
          const val = Number(btn.dataset.val) || null;
          const picks = { ...state.flexBonus.picks };
          if (val == null) delete picks[ab]; else picks[ab] = val;
          const counts = {};
          Object.values(picks).forEach(v => counts[v] = (counts[v]||0)+1);
          const needCounts = {};
          need.forEach(v => needCounts[v] = (needCounts[v]||0)+1);
          const overflow = Object.keys(counts).some(v => counts[v] > (needCounts[v]||0));
          if (overflow) return;
          state.flexBonus.picks = picks;
          renderFlexModeBody(view);
          updateHint();
        };
      });
    });
    updateHint();
  }
}

/* ---------------- Step: Skills ---------------- */
function renderSkillsStep(view){
  const c = getClass();
  view.innerHTML = `
    <div class="view-header"><h1>Навыки класса</h1><p id="skillHint"></p></div>
    <div class="skill-grid" id="skillGrid"></div>
  `;
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
    <p class="pool-note">Стандартный набор 15/14/13/12/10/8 автоматически расставлен по характеристикам, важным для класса «${c?c.name:""}». Нужно что-то другое — выбери «Свободное распределение» выше.</p>
    <button class="btn btn-ghost" id="btnReapply" style="margin-bottom:14px;">↻ Применить рекомендацию заново</button>
    <div class="ability-grid" id="abGrid"></div>
  `;
  body.querySelector("#btnReapply").onclick = () => {
    applyRecommendedBuild();
    renderRecommendedMode(view, body);
    updateNextEnabled();
  };
  renderReadonlyGrid(body);
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
      <div class="num-stepper">
        <button type="button" class="step-btn" data-dir="-1">−</button>
        <input type="number" min="3" max="18" data-ab="${ab}" value="${current}">
        <button type="button" class="step-btn" data-dir="1">+</button>
      </div>
      <div class="ab-total">${total ?? "—"}</div>
      <div class="ab-mod">модификатор ${total!=null?fmtMod(abilityMod(total)):"—"}</div>
      ${bonus ? `<div class="ab-bonus">расовый бонус +${bonus}</div>` : ""}
    `;
    const input = card.querySelector("input");
    input.oninput = e => {
      let v = e.target.value === "" ? null : Number(e.target.value);
      if (v != null){ v = Math.max(3, Math.min(18, Math.round(v))); }
      state.abilityAssign[ab] = v;
      renderFreeGrid(view, body);
      updateNextEnabled();
    };
    card.querySelectorAll(".step-btn").forEach(btn => {
      btn.onclick = () => {
        const dir = Number(btn.dataset.dir);
        let v = state.abilityAssign[ab];
        v = v == null ? 10 : v + dir;
        v = Math.max(3, Math.min(18, v));
        state.abilityAssign[ab] = v;
        renderFreeGrid(view, body);
        updateNextEnabled();
      };
    });
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

/* ---------------- Step: Physique (рост/вес/телосложение, интерактивная миниатюра) ---------------- */
function ensurePhysiqueDefaults(){
  const avg = avgHeightWeight(state.raceId, state.subraceId);
  if (!state.heightCm) state.heightCm = avg.heightCm;
  if (!state.bodyType) state.bodyType = "average";
  const wr = weightRangeForHeight(state.heightCm, state.bodyType);
  if (!state.weightKg || state.weightKg < wr.min || state.weightKg > wr.max) state.weightKg = wr.center;
  if (!state.gender) state.gender = "male";
}
function renderPhysique(view){
  ensurePhysiqueDefaults();
  const avg = avgHeightWeight(state.raceId, state.subraceId);
  const bounds = heightWeightBounds(state.raceId, state.subraceId);
  view.innerHTML = `
    <div class="view-header"><h1>Телосложение героя</h1><p>Средние значения для расы «${getRace()?getRace().name:""}»: рост ~${fmtFeetInches(avg.heightCm)} (${avg.heightCm} см), вес ~${avg.weightKg} кг. Двигай ползунки — миниатюра и вес обновятся сразу, нелепых сочетаний вроде «2 метра и 30 кг» выставить не получится.</p></div>
    <div class="physique-wrap">
      <div class="physique-figure-col">
        <div class="gender-toggle" id="genderToggle">
          <button type="button" class="gender-btn${state.gender==='male'?' active':''}" data-g="male">♂ Муж.</button>
          <button type="button" class="gender-btn${state.gender==='female'?' active':''}" data-g="female">♀ Жен.</button>
        </div>
        <div class="figure-stage">
          <div class="figure-ruler-v" id="rulerV"></div>
          <div class="figure-ruler-h"></div>
          <div class="figure-silhouette" id="silhouetteBox"></div>
        </div>
        <button class="btn btn-gold" id="btnPhysRandom" style="margin-top:10px;">🎲 Случайно в допустимых пределах</button>
      </div>
      <div class="physique-controls-col">
        <div class="form-row">
          <label>Рост: <b id="heightVal"></b></label>
          <input type="range" id="sliderHeight" min="${bounds.heightCm.min}" max="${bounds.heightCm.max}" value="${state.heightCm}">
        </div>
        <div class="form-row">
          <label>Телосложение</label>
          <div class="chip-row" id="bodyTypeRow">
            ${BODY_TYPES.map(b => `<button type="button" class="chip-btn${state.bodyType===b.id?' active':''}" data-bt="${b.id}">${b.label}</button>`).join("")}
          </div>
        </div>
        <div class="form-row">
          <label>Вес: <b id="weightVal"></b> <span class="pool-note" id="weightRangeNote" style="display:inline;"></span></label>
          <input type="range" id="sliderWeight" min="0" max="100" value="50">
        </div>
      </div>
    </div>
  `;
  wirePhysiqueControls(view, bounds);
  renderSilhouette(view);
}
function wirePhysiqueControls(view, bounds){
  const heightSlider = view.querySelector("#sliderHeight");
  const weightSlider = view.querySelector("#sliderWeight");
  const update = (resetWeightToCenter) => {
    const wr = weightRangeForHeight(state.heightCm, state.bodyType);
    if (resetWeightToCenter) state.weightKg = wr.center;
    else state.weightKg = Math.max(wr.min, Math.min(wr.max, state.weightKg));
    const pct = wr.max > wr.min ? Math.round(((state.weightKg - wr.min) / (wr.max - wr.min)) * 100) : 50;
    weightSlider.value = pct;
    view.querySelector("#heightVal").textContent = `${fmtFeetInches(state.heightCm)} (${state.heightCm} см)`;
    view.querySelector("#weightVal").textContent = `${state.weightKg} кг`;
    view.querySelector("#weightRangeNote").textContent = `(допустимо ${wr.min}–${wr.max} кг при этом росте и телосложении)`;
    renderSilhouette(view);
    saveState();
    updateNextEnabled();
  };
  heightSlider.oninput = e => { state.heightCm = Number(e.target.value); update(false); };
  weightSlider.oninput = e => {
    const wr = weightRangeForHeight(state.heightCm, state.bodyType);
    const pct = Number(e.target.value) / 100;
    state.weightKg = Math.round(wr.min + pct * (wr.max - wr.min));
    update(false);
  };
  view.querySelectorAll("#bodyTypeRow .chip-btn").forEach(btn => {
    btn.onclick = () => {
      state.bodyType = btn.dataset.bt;
      view.querySelectorAll("#bodyTypeRow .chip-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      update(true);
    };
  });
  view.querySelectorAll("#genderToggle .gender-btn").forEach(btn => {
    btn.onclick = () => {
      state.gender = btn.dataset.g;
      view.querySelectorAll("#genderToggle .gender-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSilhouette(view);
      saveState();
    };
  });
  view.querySelector("#btnPhysRandom").onclick = () => {
    state.heightCm = Math.round(bounds.heightCm.min + Math.random() * (bounds.heightCm.max - bounds.heightCm.min));
    state.bodyType = BODY_TYPES[Math.floor(Math.random()*BODY_TYPES.length)].id;
    heightSlider.value = state.heightCm;
    view.querySelectorAll("#bodyTypeRow .chip-btn").forEach(b => b.classList.toggle("active", b.dataset.bt === state.bodyType));
    update(true);
  };
  update(false);
}
function renderSilhouette(view){
  const box = view.querySelector("#silhouetteBox");
  const bounds = heightWeightBounds(state.raceId, state.subraceId);
  const hRange = bounds.heightCm.max - bounds.heightCm.min || 1;
  const hPct = (state.heightCm - bounds.heightCm.min) / hRange;
  const scaleY = 0.78 + hPct * 0.34;
  const bt = bodyTypeById(state.bodyType);
  const wr = weightRangeForHeight(state.heightCm, state.bodyType);
  const weightPct = wr.max > wr.min ? (state.weightKg - wr.min) / (wr.max - wr.min) : 0.5;
  const scaleX = (bt.widthScale * 0.88) + weightPct * 0.24;
  const isFemale = state.gender === "female";
  const shoulderW = isFemale ? 34 : 42, hipW = isFemale ? 38 : 32, waistW = isFemale ? 24 : 30;
  box.innerHTML = `
    <svg viewBox="0 0 160 320" style="width:100%;height:100%;overflow:visible;">
      <g transform="translate(80,250) scale(${scaleX.toFixed(2)},${scaleY.toFixed(2)}) translate(-80,-250)">
        <ellipse cx="80" cy="150" rx="${shoulderW}" ry="55" fill="var(--gold-dim,#7a5c2e)" opacity="0.9"/>
        <path d="M ${80-shoulderW} 120 Q 80 95 ${80+shoulderW} 120 L ${80+waistW} 210 Q 80 225 ${80-waistW} 210 Z" fill="var(--parchment,#ead9b3)" opacity="0.85"/>
        <path d="M ${80-waistW} 205 Q 80 240 ${80+waistW} 205 L ${80+hipW} 250 Q 80 268 ${80-hipW} 250 Z" fill="var(--parchment,#ead9b3)" opacity="0.8"/>
        <rect x="${80-hipW+6}" y="248" width="${(hipW-10)}" height="95" rx="10" fill="var(--parchment,#ead9b3)" opacity="0.75"/>
        <rect x="${80+10}" y="248" width="${(hipW-10)}" height="95" rx="10" fill="var(--parchment,#ead9b3)" opacity="0.75"/>
      </g>
      <circle cx="80" cy="${72 - (scaleY-1)*90}" r="26" fill="var(--parchment,#ead9b3)" opacity="0.9"/>
    </svg>
  `;
  const rulerV = view.querySelector("#rulerV");
  if (rulerV){
    const marks = [4,5,6,7,8];
    rulerV.innerHTML = marks.map(ft => `<span class="ruler-tick">${ft}′</span>`).join("");
  }
}

/* ---------------- Step: Equipment ---------------- */
function getCarryBudget(){
  const avg = avgHeightWeight(state.raceId, state.subraceId);
  return carrySlotBudget(getTotalAbility("str"), state.weightKg, avg.weightKg);
}
function customEquipCost(){
  const cw = state.customEquip || { weapons: [], shield: false };
  let cost = 0;
  (cw.weapons||[]).forEach(wid => cost += weaponSlotCost(wid));
  if (cw.shield) cost += 1;
  return cost;
}
function hasTwoHandedSelected(){
  return (state.customEquip.weapons||[]).some(wid => weaponSlotCost(wid) === 2);
}
function renderEquipment(view){
  const c = getClass();
  if (!state.equipmentChoice && c.startingEquipment && c.startingEquipment.length) state.equipmentChoice = c.startingEquipment[0].choice;
  view.innerHTML = `
    <div class="view-header"><h1>Выбери снаряжение</h1><p>Готовые, реалистично собранные комплекты для класса — или собери своё снаряжение вручную.</p></div>
    <div class="split-pane">
      <div class="split-list" id="eqGrid"></div>
      <div class="split-detail" id="eqDetail"></div>
    </div>
  `;
  renderEquipList(view);
}
function renderEquipList(view){
  const c = getClass();
  const grid = view.querySelector("#eqGrid");
  grid.innerHTML = "";
  const selectRow = (row, choice) => {
    grid.querySelectorAll(".pick-row.selected").forEach(n => n.classList.remove("selected"));
    row.classList.add("selected");
    state.equipmentChoice = choice;
    renderEquipDetail(view);
    saveState();
    updateNextEnabled();
  };
  (c.startingEquipment||[]).forEach(opt => {
    const row = document.createElement("div");
    row.className = "pick-row" + (state.equipmentChoice === opt.choice ? " selected" : "");
    row.innerHTML = `
      <span class="glyph">${opt.choice}</span>
      <div class="pr-text"><div class="pr-name">Вариант ${opt.choice}</div><div class="pr-sub">${opt.role || ""}</div></div>
    `;
    row.onclick = () => selectRow(row, opt.choice);
    grid.appendChild(row);
  });
  const rowD = document.createElement("div");
  rowD.className = "pick-row" + (state.equipmentChoice === "D" ? " selected" : "");
  rowD.innerHTML = `<span class="glyph">D</span><div class="pr-text"><div class="pr-name">Своя сборка</div><div class="pr-sub">оружие, доспех, набор</div></div>`;
  rowD.onclick = () => selectRow(rowD, "D");
  grid.appendChild(rowD);
  renderEquipDetail(view);
}
function renderEquipDetail(view){
  const c = getClass();
  const detail = view.querySelector("#eqDetail");
  if (!state.equipmentChoice){
    detail.innerHTML = `<p class="pool-note">Выбери вариант снаряжения слева.</p>`;
    return;
  }
  if (state.equipmentChoice === "D"){
    detail.innerHTML = `<div id="customBox"></div>`;
    renderCustomEquip(view, detail.querySelector("#customBox"));
    return;
  }
  const opt = (c.startingEquipment||[]).find(e => e.choice === state.equipmentChoice);
    detail.innerHTML = `
      <div class="detail-panel">
        <h3>Вариант ${opt.choice}${opt.role ? " — " + opt.role : ""}</h3>
        <ul>${opt.items.map(i => `<li>${itemIconHTML(i.name||i)}<b>${i.name||i}</b>${i.info ? `<span class="eq-info">— ${i.info}</span>` : ""}</li>`).join("")}</ul>
      </div>
    `;
  }
  function itemIconHTML(name){
    const w = WEAPON_CATALOG.find(x => x.name === name);
    if (w) return `<img class="item-icon" src="assets/img/items/weapons/${w.id}.png" loading="lazy" onerror="this.remove()">`;
    const a = ARMOR_CATALOG.find(x => x.name === name);
    if (a) return `<img class="item-icon" src="assets/img/items/armor/${a.id}.png" loading="lazy" onerror="this.remove()">`;
    const p = PACK_CATALOG.find(x => x.name === name);
    if (p) return `<img class="item-icon" src="assets/img/items/packs/${p.id}.png" loading="lazy" onerror="this.remove()">`;
    return "";
  }
function renderCustomEquip(view, box){
  const c = getClass();
  const cw = state.customEquip;
  const budget = getCarryBudget();
  const cost = customEquipCost();
  const twoHanded = hasTwoHandedSelected();
  const weapons = WEAPON_CATALOG.filter(w => weaponAllowedForClass(c.id, w.id));
  const armors = ARMOR_CATALOG.filter(a => a.type !== "shield" && armorAllowedForClass(c.id, a.id));
  const shields = ARMOR_CATALOG.filter(a => a.type === "shield" && armorAllowedForClass(c.id, a.id));

  box.innerHTML = `
    <div class="detail-panel" style="margin-top:14px;">
      <h3>Оружие (доступно классу «${c.name}»)</h3>
      <div class="skill-grid" id="custWeapons"></div>
      <h3 style="margin-top:16px;">Доспех</h3>
      <div class="skill-grid" id="custArmor"></div>
      ${shields.length ? `<h3 style="margin-top:16px;">Щит</h3><div class="skill-grid" id="custShield"></div>` : ""}
      <h3 style="margin-top:16px;">Набор снаряжения</h3>
      <select id="custPack"><option value="">— выбери набор —</option>${PACK_CATALOG.map(p => `<option value="${p.id}" ${cw.packId===p.id?"selected":""}>${p.name}</option>`).join("")}</select>
      <p class="pool-note" id="custPackInfo" style="margin-top:6px;"></p>
      <p class="pool-note" id="custBudgetNote" style="margin-top:14px;"></p>
    </div>
  `;
  const wGrid = box.querySelector("#custWeapons");
  weapons.forEach(w => {
    const checked = cw.weapons.includes(w.id);
    const wouldCost = weaponSlotCost(w.id);
    const blockedByHands = !checked && twoHanded && w.hands === 2 && getTotalAbility("str") < 18; // искл.: очень сильные (СИЛ 18+) могут таскать второе двуручное
    const overBudget = !checked && (cost + wouldCost > budget);
    const disabled = blockedByHands || overBudget;
    const opt = document.createElement("label");
    opt.className = "skill-opt" + (checked?" checked":"") + (disabled?" disabled":"");
    opt.innerHTML = `<input type="checkbox" ${checked?"checked":""} ${disabled?"disabled":""}> <img class="item-icon" src="assets/img/items/weapons/${w.id}.png" loading="lazy" onerror="this.remove()"> ${w.name} <span style="color:var(--text-dim);font-size:.72rem;margin-left:auto;">${w.info}</span>`;
    opt.querySelector("input").onchange = e => {
      if (e.target.checked) cw.weapons.push(w.id);
      else cw.weapons = cw.weapons.filter(x => x !== w.id);
      if (hasTwoHandedSelected()) { cw.shield = false; }
      renderCustomEquip(view, box);
      updateNextEnabled();
    };
    wGrid.appendChild(opt);
  });

  const aGrid = box.querySelector("#custArmor");
  armors.forEach(a => {
    const checked = cw.armorId === a.id;
    const str = getTotalAbility("str");
    const opt = document.createElement("label");
    opt.className = "skill-opt" + (checked?" checked":"");
    const warn = a.strReq && str < a.strReq ? ` ⚠ нужна Сила ${a.strReq}, у тебя ${str} — скорость будет снижена` : "";
    opt.innerHTML = `<input type="radio" name="custArmorRadio" ${checked?"checked":""}> <img class="item-icon" src="assets/img/items/armor/${a.id}.png" loading="lazy" onerror="this.remove()"> ${a.name} <span style="color:var(--text-dim);font-size:.72rem;margin-left:auto;">${a.info}${warn}</span>`;
    opt.querySelector("input").onchange = () => {
      cw.armorId = a.id;
      renderCustomEquip(view, box);
      updateNextEnabled();
    };
    aGrid.appendChild(opt);
  });
  if (armors.length){
    const noneOpt = document.createElement("label");
    noneOpt.className = "skill-opt" + (!cw.armorId ? " checked" : "");
    noneOpt.innerHTML = `<input type="radio" name="custArmorRadio" ${!cw.armorId?"checked":""}> Без доспеха`;
    noneOpt.querySelector("input").onchange = () => { cw.armorId = null; renderCustomEquip(view, box); updateNextEnabled(); };
    aGrid.insertBefore(noneOpt, aGrid.firstChild);
  }

  if (shields.length){
    const sGrid = box.querySelector("#custShield");
    shields.forEach(sh => {
      const checked = cw.shield && cw.shieldId === sh.id;
      const disabled = !checked && (twoHanded || (cost + 1 > budget));
      const opt = document.createElement("label");
      opt.className = "skill-opt" + (checked?" checked":"") + (disabled?" disabled":"");
      const note = twoHanded ? " (нельзя — обе руки заняты двуручным оружием)" : "";
      opt.innerHTML = `<input type="checkbox" ${checked?"checked":""} ${disabled?"disabled":""}> <img class="item-icon" src="assets/img/items/armor/${sh.id}.png" loading="lazy" onerror="this.remove()"> ${sh.name} <span style="color:var(--text-dim);font-size:.72rem;margin-left:auto;">${sh.info}${note}</span>`;
      opt.querySelector("input").onchange = e => {
        cw.shield = e.target.checked; cw.shieldId = e.target.checked ? sh.id : null;
        renderCustomEquip(view, box);
        updateNextEnabled();
      };
      sGrid.appendChild(opt);
    });
  }

  box.querySelector("#custPack").onchange = e => { cw.packId = e.target.value || null; renderCustomEquip(view, box); updateNextEnabled(); };
  const pack = PACK_CATALOG.find(p => p.id === cw.packId);
  box.querySelector("#custPackInfo").innerHTML = pack ? `<img class="item-icon" src="assets/img/items/packs/${pack.id}.png" loading="lazy" onerror="this.remove()" style="vertical-align:middle;margin-right:6px;"><b>${pack.name}:</b> ${pack.info}` : "";

  const note = box.querySelector("#custBudgetNote");
  const strNote = getTotalAbility("str") >= 16 ? " Твой герой силён — может нести больше." : "";
  const sizeNote = (state.weightKg && avgHeightWeight(state.raceId, state.subraceId).weightKg && state.weightKg >= avgHeightWeight(state.raceId, state.subraceId).weightKg * 1.25) ? " Крупная фигура добавляет ещё одну ячейку." : "";
  note.innerHTML = `Занято ячеек переноски оружия/щита: <b style="color:${cost>budget?'var(--blood-bright)':'var(--gold-bright)'}">${cost} / ${budget}</b>.${strNote}${sizeNote}
    ${cost>budget ? `<br><span style="color:var(--blood-bright);">Слишком много снаряжения — его просто не унести и не удержать в бою одновременно. Сними что-нибудь или повысь Силу / телосложение.</span>` : ""}`;
}

/* ---------------- Step: Magic ---------------- */
const SCHOOL_GLYPH = {
  "Преобразование":"✦", "Трансмутация":"✦", "Воплощение":"🔥", "Вызов":"🌀",
  "Некромантия":"💀", "Ограждение":"🛡", "Прорицание":"👁", "Очарование":"💫",
  "Иллюзия":"🌫"
};
function renderMagic(view){
  const c = getClass();
  const r = CASTER_RULES[c.id];
  const abMod = abilityMod(getTotalAbility(r.ability));
  const cantripLimit = r.cantrips;
  const spellLimit = casterKnownCount(c.id, abMod);
  const slots = LEVEL1_SPELL_SLOTS[c.id] || 2;
  const cantrips = DND_DATA.spells.filter(s => s.level === 0 && s.classes.includes(c.id));
  const lvl1 = DND_DATA.spells.filter(s => s.level === 1 && s.classes.includes(c.id));

  view.innerHTML = `
    <div class="view-header"><h1>Выбери заклинания</h1><p>${c.name} черпает силу из ${ABILITY_NAMES[r.ability]}. Выбери фокусы и заклинания 1-го уровня — они появятся в листе персонажа со слотами применения.</p></div>
    <div class="spell-counter" id="spCounter"></div>
    <h3 class="spell-group-title">Фокусы (нужно выбрать: ${cantripLimit})</h3>
    <div class="spell-list" id="cantripList"></div>
    <h3 class="spell-group-title">Заклинания 1-го уровня (нужно выбрать: ${spellLimit}, ячеек применения в день: ${slots})</h3>
    <div class="spell-list" id="lvl1List"></div>
  `;
  const renderList = (container, spells, limit, isCantrip) => {
    container.innerHTML = "";
    spells.forEach(sp => {
      const selected = state.spells.includes(sp.id);
      const countSelectedInGroup = state.spells.filter(id => spells.some(s=>s.id===id)).length;
      const atLimit = countSelectedInGroup >= limit && !selected;
      const card = document.createElement("div");
      card.className = "spell-card" + (selected?" selected":"") + (atLimit?" disabled":"");
      card.style.opacity = atLimit ? .45 : 1;
      card.innerHTML = `
        <div class="sp-top"><span class="sp-name">${SCHOOL_GLYPH[sp.school]||"✨"} ${sp.name}</span><span class="sp-lvl">${sp.school||""}</span></div>
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
  renderList(view.querySelector("#cantripList"), cantrips, cantripLimit, true);
  renderList(view.querySelector("#lvl1List"), lvl1, spellLimit, false);
  const chosenCantrips = state.spells.filter(id => cantrips.some(s=>s.id===id)).length;
  const chosenLvl1Ids = state.spells.filter(id => lvl1.some(s=>s.id===id));
  view.querySelector("#spCounter").textContent = `Выбрано фокусов: ${chosenCantrips}/${cantripLimit} · заклинаний 1-го уровня: ${chosenLvl1Ids.length}/${spellLimit}`;
  updateNextEnabled();
}
function getTotalAbility(ab){
  const base = state.abilityAssign[ab];
  if (base == null) return 10;
  return base + racialBonusFor(ab);
}

/* ---------------- Step: Sheet ---------------- */
function getEquip(c){
  if (state.equipmentChoice === "D"){
    const cw = state.customEquip || { weapons: [], armorId: null, shield: false, packId: null };
    const items = [];
    let armorMeta = null;
    (cw.weapons||[]).forEach(wid => { const w = WEAPON_CATALOG.find(x=>x.id===wid); if (w) items.push({ name: w.name, info: w.info }); });
    if (cw.armorId){
      const a = ARMOR_CATALOG.find(x=>x.id===cw.armorId);
      if (a){ armorMeta = { base: a.base, dexCap: a.dexCap }; items.push({ name: a.name, info: a.info }); }
    }
    if (cw.shield){
      const sh = ARMOR_CATALOG.find(x=>x.id===cw.shieldId) || ARMOR_CATALOG.find(x=>x.type==="shield");
      if (sh) items.push({ name: sh.name, info: sh.info });
    }
    if (cw.packId){
      const p = PACK_CATALOG.find(x=>x.id===cw.packId);
      if (p) items.push({ name: p.name, info: p.info });
    }
    return { choice: "D", role: "Своя сборка", items, armorMeta, hasShield: !!cw.shield };
  }
  const opt = c ? (c.startingEquipment||[]).find(e => e.choice === state.equipmentChoice) : null;
  if (!opt) return null;
  let armorMeta = null;
  opt.items.forEach(i => { const n = i.name || i; if (ARMOR_AC[n]) armorMeta = ARMOR_AC[n]; });
  const hasShield = opt.items.some(i => SHIELD_NAMES.includes(i.name || i));
  return { choice: opt.choice, role: opt.role, items: opt.items, armorMeta, hasShield };
}
function computeAC(dexMod, equip){
  const hasShield = equip && equip.hasShield;
  if (!equip || !equip.armorMeta) return 10 + dexMod + (hasShield ? 2 : 0);
  const a = equip.armorMeta;
  const dexBonus = a.dexCap === 0 ? 0 : (a.dexCap != null ? Math.min(dexMod, a.dexCap) : dexMod);
  return a.base + dexBonus + (hasShield ? 2 : 0);
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
  const equip = getEquip(c);
  const ac = computeAC(mods.dex, equip);
  const initiative = mods.dex;
  const spellsDetailed = state.spells.map(id => DND_DATA.spells.find(sp=>sp.id===id)).filter(Boolean);
  const spellNames = spellsDetailed.map(sp => sp.name);
  const slots = c ? (LEVEL1_SPELL_SLOTS[c.id] || 0) : 0;
  const avg = avgHeightWeight(state.raceId, state.subraceId);
  const roleplayLines = [
    ...abilityFlavorLines(totals),
    ...physiqueFlavorLines(state.heightCm, state.weightKg, avg.weightKg)
  ];
  return { r, s, c, totals, mods, pb, saves, skills, hp, ac, initiative, equip, spellNames, spellsDetailed, slots, roleplayLines };
}

function renderSheet(view){
  const d = computeFinal();
  view.innerHTML = `
    <div class="view-header"><h1>Твой герой готов</h1><p>Проверь лист персонажа и экспортируй его в PDF — или вернись назад, чтобы что-то изменить.</p></div>
    <div class="sheet-actions">
      <button class="btn btn-gold" id="btnPdf">⇩ Скачать PDF</button>
      <button class="btn btn-ghost" id="btnRestart">↻ Начать заново</button>
    </div>
    <div class="sheet-wrap"><div id="charSheet">${sheetHTML(d)}</div></div>
  `;
  view.querySelector("#btnPdf").onclick = () => exportPDF();
  view.querySelector("#btnRestart").onclick = () => {
    if (confirm("Начать создание персонажа заново? Все данные будут сброшены.")){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };
}

function sheetHTML(d){
  const { r, s, c, totals, mods, pb, saves, skills, hp, ac, initiative, equip, spellsDetailed, slots, roleplayLines } = d;
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
  const spellRow = sp => {
    const isCantrip = sp.level === 0;
    const brief = (sp.description || "").split(". ").slice(0,1).join(". ").replace(/\.*$/, ".");
    return `
    <div class="sheet-spell-row" data-spell-id="${sp.id}">
      <div class="sheet-spell-top">
        <span class="sheet-spell-name">${SCHOOL_GLYPH[sp.school]||"✨"} ${sp.name}${isCantrip?" <i>(фокус)</i>":""}</span>
        <span class="sheet-spell-charges">${isCantrip ? `<span class="sheet-spell-charge infinite">∞</span>` : Array.from({length:slots}).map((_,i)=>`<span class="sheet-spell-charge" data-idx="${i}"></span>`).join("")}</span>
      </div>
      <div class="sheet-spell-brief">${brief}</div>
    </div>`;
  };
  return `
    <div class="sheet-head">
      ${state.photoDataUrl ? `<img class="sheet-photo" src="${state.photoDataUrl}" alt="Портрет">` : ""}
      <div class="sheet-head-text">
        <h2>${escapeHtml(state.name) || "Безымянный герой"}</h2>
        <div class="sub">${r?r.name:""}${s?(" ("+s.name+")"):""} · ${c?c.name:""}${state.alignment?(" · "+state.alignment):""}${(state.heightCm&&state.weightKg)?(" · "+fmtFeetInches(state.heightCm)+", "+state.weightKg+" кг"):""}</div>
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
        ${spellsDetailed.length ? `<div class="spells-box"><h4>Заклинания <span class="pool-note" style="display:inline;">(отмечай использованные ячейки карандашом ✎)</span></h4>${spellsDetailed.map(spellRow).join("")}</div>` : ""}
      </div>
    </div>
    <div class="traits-box" style="margin-top:14px;">
      <h4>Расовые и классовые черты</h4>
      <div>${traits.join(" · ")}</div>
    </div>
    ${roleplayLines && roleplayLines.length ? `<div class="notes-box" style="margin-top:12px;"><h4>Отыгрыш</h4><ul>${roleplayLines.map(l=>`<li>${l}</li>`).join("")}</ul></div>` : ""}
    ${state.background ? `<div class="notes-box" style="margin-top:12px;"><h4>Предыстория</h4><div>${escapeHtml(state.background)}</div></div>` : ""}
    <div class="sheet-footer"><span>Кузня Героев — редактор персонажей D&amp;D 5e</span><span>SRD (Open Game License)</span></div>
  `;
}

async function exportPDF(){
  const node = document.getElementById("charSheet");
  toast("Готовим PDF…");
  try{
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ead9b3" });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "b4" });
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
      return allAssigned || "Распредели все шесть значений характеристик";
    }
    case "flexbonus": {
      const flex = flexBonusRemainingText();
      if (!flex) return true;
      return flex.done || "Распредели гибкий расовый бонус между характеристиками";
    }
    case "skills": {
      const c = getClass();
      if (c && c.skillChoices && state.skillChoices.length < c.skillChoices.count) return `Выбери ${c.skillChoices.count} навыка(ов)`;
      return true;
    }
    case "physique": {
      return (!!state.heightCm && !!state.weightKg) || "Укажи рост и вес героя";
    }
    case "equipment": {
      if (state.equipmentChoice === "D"){
        const cw = state.customEquip;
        if (!cw || (!cw.weapons.length && !cw.armorId) || !cw.packId) return "Выбери хотя бы оружие или доспех, и набор снаряжения";
        if (customEquipCost() > getCarryBudget()) return "Слишком много снаряжения — его не унести. Сними что-нибудь";
        return true;
      }
      return !!state.equipmentChoice || "Выбери комплект снаряжения";
    }
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
  const landing = document.getElementById("landingScreen");
  const forgeBtn = document.getElementById("btnForge");
  if (forgeBtn) forgeBtn.onclick = () => {
    landing.classList.add("hide");
    setTimeout(() => landing.remove(), 500);
  };
  render();
});
