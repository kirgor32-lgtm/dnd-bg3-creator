/* ===== Творец Героя — логика визарда создания персонажа ===== */

const STORAGE_KEY = "dnd-bg3-creator-state-v1";

const RACE_GLYPH = {
  human:"🙂", elf:"🧝", dwarf:"⛏", halfling:"🍀", dragonborn:"🐉",
  gnome:"🔧", "half-elf":"🌙", "half-orc":"🪓", tiefling:"🔥",
  genasi:"🌪", kenku:"🐦", shifter:"🐺", aasimar:"👼", tabaxi:"🐱",
  goliath:"⛰", triton:"🔱", goblin:"🗿", centaur:"🐎", changeling:"🎭", grung:"🐸"
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
  spells: [], spellSlotsUsed: 0, customSkills: [],
  raceChoices: {}, classChoices: {},
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
  subclass:  { title: "Путь класса", caption: "Путь класса" },
  racechoice:{ title: "Особенности расы", caption: "Выбор расовых особенностей" },
  flexbonus: { title: "Расовый бонус", caption: "Расовый бонус характеристик" },
  abilities: { title: "Характеристики", caption: "Распределение характеристик" },
  skills:    { title: "Навыки", caption: "Навыки класса" },
  classchoice:{ title: "Умения класса", caption: "Выбор умений класса" },
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
  const cls = getClass();
  if (cls && subclassNeeds(cls.id).length) steps.push("subclass");
  if (raceChoiceNeeds().length) steps.push("racechoice");
  if (r && r.abilityBonuses && r.abilityBonuses.flexible) steps.push("flexbonus");
  steps.push("abilities");
  steps.push("skills");
  const cl = getClass();
  if (cl && laterClassNeeds(cl.id).length) steps.push("classchoice");
  steps.push("physique");
  steps.push("equipment");
  const c = getClass();
  if (c) steps.push("magic"); // всегда: заклинателям — выбор заклинаний, остальным — кастомные навыки
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
    intro: renderIntro, race: renderRace, subrace: renderSubrace, class: renderClassStep, subclass: renderSubclassStep,
    flexbonus: renderFlexBonusStep, abilities: renderAbilities, skills: renderSkillsStep,
    racechoice: renderRaceChoiceStep, classchoice: renderClassChoiceStep,
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

/* На телефоне описание стоит под списком: после выбора мягко докручиваем к нему,
   но только если оно целиком ниже экрана (чтобы не дёргать страницу зря). */
function revealOnMobile(el){
  if (!el || window.innerWidth >= 900) return;
  const top = el.getBoundingClientRect().top;
  if (top > window.innerHeight - 120) el.scrollIntoView({ behavior:"smooth", block:"start" });
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
}
/* Авто-кадрирование: любое фото любого формата приводится к квадрату (cover-кроп по центру),
   чтобы хорошо смотреться и в рамке загрузки, и на итоговом листе персонажа. */
function cropImageToSquare(file, size, ratio = 1){
  // ratio = высота/ширина; для листа персонажа — 4:3 (вертикальный прямоугольник)
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = Math.round(size * ratio);
      const ctx = canvas.getContext("2d");
      let sw = img.width, sh = sw * ratio;
      if (sh > img.height){ sh = img.height; sw = sh / ratio; }
      const sx = (img.width - sw) / 2, sy = Math.max(0, (img.height - sh) * 0.3);   // чуть выше центра — чтобы не срезать голову
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
      <div class="split-list split-list--tiles" id="raceGrid"></div>
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
        <div class="pr-sub"><span class="pr-en">${r.nameEn || ""} · </span>${r.size}, ${r.speed} фт</div>
      </div>
    `;
    row.onclick = () => {
      if (state.raceId === r.id) return;
      state.raceId = r.id;
      if (!r.subraces || !r.subraces.some(s => s.id === state.subraceId)) state.subraceId = null;
      state.physiqueMode = null; state.heightCm = null; state.weightKg = null;
      state.flexBonus = null;
      state.raceChoices = {};
      grid.querySelectorAll(".pick-row.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderRaceDetail(view.querySelector("#raceDetail"));
      revealOnMobile(view.querySelector("#raceDetail"));
      saveState();
      updateNextEnabled();
    };
    grid.appendChild(row);
  });
  renderRaceDetail(view.querySelector("#raceDetail"));
}
function renderRaceDetail(el){
  const r = getRace();
  if (!r){ el.innerHTML = `<p class="pool-note">Выбери расу, чтобы увидеть её черты.</p>`; return; }
  el.innerHTML = flipCard(`
    <div class="detail-panel race-detail">
      <div class="race-portrait-frame">
        <img class="${WHITE_BG_PORTRAITS.includes(r.id) ? "on-parchment" : ""}" src="assets/img/races/${r.id}.jpg?v=30" alt="${r.name}" loading="lazy" onerror="this.parentNode.classList.add('empty');this.remove()">
        <div class="portrait-empty"><span>${RACE_GLYPH[r.id] || "❖"}</span><small>Портрет появится позже</small></div>
      </div>
      <div class="race-info">
        <h3>${r.name}</h3>
        <p class="detail-sub">${r.nameEn || ""}${r.nameEn ? " · " : ""}${r.size}, скорость ${r.speed} фт</p>
        <div class="stat-row">${abilityBonusChips(r.abilityBonuses)}</div>
        <div class="bg3-divider"><span></span></div>
        <ul>${(r.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
        ${r.languages ? `<p class="detail-note"><b>Языки:</b> ${r.languages.join(", ")}</p>` : ""}
        ${loreButton(r.id)}
      </div>
    </div>
  `, raceLoreHTML(r), r.id);
  bindFlip(el);
}
/* ---- Оборот карточки: «История» ---- */
function esc(t){ return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function loreButton(key){
  return `<button type="button" class="lore-btn" data-flip="1"><span>📜</span> История</button>`;
}
/* Портреты на белом фоне — на сайте фон «впитывается» в пергамент. */
const WHITE_BG_PORTRAITS = ["halfling","half-elf","goblin","gnome","tiefling","genasi","elf","human","shifter","grung","dragonborn","tabaxi","goliath","half-orc","kenku","aasimar","triton","changeling","dwarf","centaur"];
function flipCard(front, back, key, backLabel){
  if (!back) return front;
  return `<div class="flip-card" data-key="${key}">
    <div class="flip-inner">
      <div class="flip-face flip-front">${front}</div>
      <div class="flip-face flip-back detail-panel" aria-hidden="true">
        <div class="lore-head"><button type="button" class="lore-btn lore-btn--back" data-flip="1">← ${backLabel || "К чертам"}</button></div>
        <div class="lore-body">${back}</div>
      </div>
    </div>
  </div>`;
}
function bindFlip(el){
  const card = el.querySelector(".flip-card"); if (!card) return;
  const front = card.querySelector(".flip-front"), back = card.querySelector(".flip-back");
  const fit = () => {
    const h = front.offsetHeight;
    if (!card.classList.contains("flipped")) { card.style.height = h + "px"; return; }
    const full = window.innerWidth < 760 || h > window.innerHeight * 0.8;
    card.classList.toggle("lore-full", full);   // текст раскрывается целиком — внутренняя прокрутка не нужна (и не мигает во время анимации высоты)
    if (full) {
      // на телефоне и при высокой лицевой стороне оборот раскрывается на всю длину текста — без прокрутки внутри прокрутки
      const body = back.querySelector(".lore-body");
      card.style.height = (back.offsetHeight - body.clientHeight + body.scrollHeight + 4) + "px";
    } else card.style.height = Math.max(h, 520) + "px";
  };
  fit();
  card._fit = fit;   // можно вызвать вручную после дорисовки содержимого
  if (window.ResizeObserver) new ResizeObserver(fit).observe(front);
  card.querySelectorAll("img").forEach(i => i.addEventListener("load", fit));
  card.querySelectorAll("[data-flip]").forEach(b => b.addEventListener("click", () => {
    const on = !card.classList.contains("flipped");
    card.classList.toggle("flipped", on);
    card.classList.remove("flipping"); void card.offsetWidth; card.classList.add("flipping");   // «поднять» карточку на время переворота
    clearTimeout(card._ft); card._ft = setTimeout(() => card.classList.remove("flipping"), 1300);
    back.setAttribute("aria-hidden", String(!on)); front.setAttribute("aria-hidden", String(on));
    fit();
    if (on) back.querySelector(".lore-body").scrollTop = 0;
    if (window.innerWidth < 760 || card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior:"smooth", block:"start" });
  }));
}
function loreParas(arr){
  return (arr || []).map(p => typeof p === "string" ? `<p>${esc(p)}</p>`
    : `<ul class="lore-list">${p.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`).join("");
}
/* Оборот карточки класса: история класса из dnd.su + обзор подклассов */
function classLoreHTML(c){
  const L = (typeof CLASS_LORE !== "undefined") && CLASS_LORE[c.id];
  if (!L) return "";
  const lvl = L.subLevel || 1;
  return `<h3>${c.name}: история класса</h3>
    ${loreParas(L.intro)}
    ${L.sections.map(s => `<h4>${esc(s.title)}</h4>${loreParas(s.paras)}`).join("")}
    ${L.subs.length ? `<h4>${esc(L.subTitle)} — ${lvl === 1 ? "выбор на 1-м уровне" : `выбор на ${lvl}-м уровне`}</h4>
      ${lvl > 1 ? `<p class="lore-note">Персонаж создаётся 1-го уровня, поэтому этот выбор пока не делается — он откроется, когда герой дорастёт до ${lvl}-го уровня. Вот из чего можно будет выбирать:</p>` : ""}
      ${lvl === 1 && SUBCLASSES[c.id] ? `<p class="lore-note">В генераторе можно выбрать: ${SUBCLASSES[c.id].map(x => x.name).join(", ")}. Остальные — из дополнений, они здесь для знакомства.</p>` : ""}
      ${L.subs.map(x => `<p><b>${esc(x.name)}.</b>${lvl === 1 && SUBCLASSES[c.id] && !SUBCLASSES[c.id].some(y => y.name === x.name) ? ` <span class="lore-tag">дополнение</span>` : ""} ${esc(x.text)}</p>`).join("")}` : ""}
    <p class="lore-src">Источник: dnd.su</p>`;
}
/* Подробности выбранного подкласса: кто это, что даёт сейчас и потом */
function subclassInfoHTML(c, sub, cc){
  const SL = (typeof SUBCLASS_LORE !== "undefined") && SUBCLASS_LORE[c.id] && SUBCLASS_LORE[c.id][cc.subclass];
  const always = [...(sub.cantrips||[]), ...(sub.spells||[])].map(id => (DND_DATA.spells.find(x => x.id === id) || {name:id}).name);
  if (!SL) return `<div class="subclass-info"><b>${sub.name}.</b> ${sub.text}</div>`;
  const now = SL.features.filter(f => f.level === 1);
  const later = SL.features.filter(f => f.level && f.level > 1);
  const parasNoBigTables = ps => loreParas(ps.map(p => (typeof p !== "string" && p.list.length > 12) ? `(таблица из ${p.list.length} строк — в «Книге игрока»; Мастер подскажет результат броска)` : p));
  let html = `<div class="subclass-info">
    <h4 class="si-title">${sub.name}: кто это</h4>
    ${loreParas(SL.intro)}
    <h4 class="si-title">Что даёт на 1-м уровне</h4>
    ${now.map(f => `<div class="si-feat"><b>${esc(f.name)}.</b> ${parasNoBigTables(f.paras)}</div>`).join("")}
    ${always.length ? `<p class="pool-note">Всегда подготовлены (не тратят выбор): ${always.join(", ")}</p>` : ""}
    ${later.length ? `<h4 class="si-title">Что откроется дальше</h4><p class="si-later">${later.map(f => `<span>${f.level} ур. — ${esc(f.name)}</span>`).join("")}</p>` : ""}`;
  return html + `<p class="lore-src">Источник: dnd.su</p></div>`;
}
function raceLoreHTML(r){
  const L = (typeof RACE_LORE !== "undefined") && RACE_LORE[r.id];
  if (!L) return "";
  const subs = (r.subraces || []).filter(s => L.subs && L.subs[s.id] && L.subs[s.id].length);
  return `<h3>${r.name}: история народа</h3>
    ${L.quote ? `<blockquote class="lore-quote">${esc(L.quote)}</blockquote>` : ""}
    ${loreParas(L.intro)}
    ${L.sections.map(s => `<h4>${esc(s.title)}</h4>${loreParas(s.paras)}`).join("")}
    ${subs.length ? `<h4>Подрасы</h4>${subs.map(s => `<p><b>${s.name}.</b> ${esc(L.subs[s.id][0])}</p>`).join("")}` : ""}
    <p class="lore-src">Источник: dnd.su</p>`;
}
function subraceLoreHTML(r, s){
  const L = (typeof RACE_LORE !== "undefined") && RACE_LORE[r.id];
  if (!L || !L.subs || !L.subs[s.id] || !L.subs[s.id].length) return "";
  return `<h3>${s.name}</h3>${loreParas(L.subs[s.id])}<p class="lore-src">Источник: dnd.su</p>`;
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
      <span class="glyph">${RACE_GLYPH[r.id] || "◈"}</span>
      <div class="pr-text">
        <div class="pr-name">${s.name}</div>
        <div class="pr-sub">${abilityBonusChips(s.abilityBonuses).replace(/<[^>]+>/g,"").trim()}</div>
      </div>
    `;
    row.onclick = () => {
      if (state.subraceId === s.id) return;
      state.subraceId = s.id;
      state.raceChoices = {};
      state.physiqueMode = null; state.heightCm = null; state.weightKg = null;
      grid.querySelectorAll(".pick-row.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderSubraceDetail(view.querySelector("#subDetail"));
      revealOnMobile(view.querySelector("#subDetail"));
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
  if (!s){ el.innerHTML = `<p class="pool-note">Выбери подрасу, чтобы увидеть её черты.</p>`; return; }
  const back = subraceLoreHTML(r, s);
  el.innerHTML = flipCard(`
    <div class="detail-panel">
      <h3>${s.name}</h3>
      <p class="detail-sub">Подраса: ${r.name.toLowerCase()}</p>
      <div class="stat-row">${abilityBonusChips(s.abilityBonuses)}</div>
      <ul>${(s.traits||[]).map(t => `<li>${t}</li>`).join("")}</ul>
      ${back ? loreButton(s.id) : ""}
    </div>
  `, back, s.id);
  bindFlip(el);
}

/* ---------------- Step: Class ---------------- */
function renderClassStep(view){
  view.innerHTML = `
    <div class="view-header"><h1>Выбери класс</h1><p>Класс — твой путь к силе: воин меча, хранитель тайных знаний или клинок в тенях.</p></div>
    <div class="class-step">
      <div class="class-icon-grid" id="classGrid"></div>
      <div class="split-detail" id="classDetail"></div>
    </div>
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
      state.customSkills = [];
      state.classChoices = {};
      state.abilityMode = null;
      state.abilityAssign = {};
      state.diceRolls = null;
      grid.querySelectorAll(".class-icon-item.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      renderClassDetail(view.querySelector("#classDetail"));
      revealOnMobile(view.querySelector("#classDetail"));
      saveState();
      updateNextEnabled();
      renderRail();
    };
    grid.appendChild(row);
  });
  renderClassDetail(view.querySelector("#classDetail"));
}
function renderClassDetail(el){
  const c = getClass();
  if (!c){ el.innerHTML = `<p class="pool-note">Выбери класс, чтобы увидеть его умения.</p>`; return; }
  const featuresHtml = (c.features||[]).map(f =>
    `<li><b style="color:var(--gold-bright)">${f.name}</b> — ${f.info}</li>`
  ).join("");
  const skillOpts = (c.skillChoices && c.skillChoices.options) || [];
  const equipRoles = (c.startingEquipment||[]).map(e => `${e.choice}: ${e.role}`).join(" · ");
  el.innerHTML = flipCard(`
    <div class="detail-panel">
      <div class="class-icon-badge"><img src="assets/img/classes/${c.id}.png" alt="${c.name}" loading="lazy" onerror="this.outerHTML='${CLASS_GLYPH[c.id] || "❖"}'"></div>
      <h3>${c.name}</h3>
      ${c.description ? `<p class="class-flavor">${c.description}</p>` : ""}
      ${classLoreHTML(c) ? loreButton(c.id) : ""}
      <div class="stat-row">
        <span class="stat-chip"><b>Кость хитов</b> к${c.hitDie}</span>
        <span class="stat-chip"><b>Спасброски</b> ${(c.savingThrows||[]).map(s => ABILITY_NAMES[s.toLowerCase()] || s).join(", ")}</span>
      </div>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--text-strong, #ead9b3)">Доспехи:</b> ${(c.armorProficiency||[]).join(", ") || "—"}</p>
      <p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--text-strong, #ead9b3)">Оружие:</b> ${(c.weaponProficiency||[]).join(", ") || "—"}</p>
      ${featuresHtml ? `<p style="margin:10px 0 4px;color:var(--text-strong, #ead9b3)"><b>Умения 1 уровня:</b></p><ul class="feature-list">${featuresHtml}</ul>` : ""}
      ${skillOpts.length ? `<p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--text-strong, #ead9b3)">Навыки на выбор (${c.skillChoices.count}):</b> ${skillOpts.join(", ")}</p>` : ""}
      ${equipRoles ? `<p style="color:var(--text-dim);margin:8px 0;"><b style="color:var(--text-strong, #ead9b3)">Снаряжение:</b> ${equipRoles}</p>` : ""}
      ${subclassNeeds(c.id).length ? `<p class="next-hint">➜ На следующей странице: ${SUBCLASS_STEP_TITLE[c.id] ? SUBCLASS_STEP_TITLE[c.id].toLowerCase() : "путь класса"}.</p>` : ""}
    </div>
  `, classLoreHTML(c), c.id, "К умениям");
  bindFlip(el);
}

/* ---------------- Step: Путь класса (домен, происхождение, покровитель + договор) ---------------- */
const SUBCLASS_STEP_TITLE = { paladin:"Божество-покровитель", cleric:"Божественный домен", sorcerer:"Происхождение чародея", warlock:"Покровитель и договор" };
const SUBCLASS_STEP_TEXT = {
  paladin:"Паладин черпает силу из клятвы, но многие служат и конкретному богу. Выбор не обязателен и нужен только для отыгрыша — он попадёт в лист персонажа.",
  cleric:"Жрец служит конкретному божеству: домен определяет, какие дары оно даёт уже на 1-м уровне — доспехи, заклинания, особые умения.",
  sorcerer:"Магия чародея — врождённая. Происхождение объясняет, откуда она взялась, и даёт особые умения уже на 1-м уровне.",
  warlock:"Колдун заключил сделку с могущественным существом. Выбери покровителя, а затем — предмет договора, который он тебе вручит."
};
function renderSubclassStep(view){
  const c = getClass();
  view.innerHTML = `
    <div class="view-header"><h1>${SUBCLASS_STEP_TITLE[c.id] || "Путь класса"}</h1><p>${SUBCLASS_STEP_TEXT[c.id] || ""}</p></div>
    <div class="detail-panel subclass-step" id="subclassPick"></div>`;
  const box = view.querySelector("#subclassPick");
  const draw = () => {
    box.innerHTML = classChoicesHTML(c, subclassNeeds(c.id));
    bindChoiceTiles(box, draw);
    updateNextEnabled();
  };
  draw();
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
  const rc = state.raceChoices || {};
  if (raceChoiceNeeds().some(n => n.type === "abilityPlus") && (rc.abilityPlus || []).includes(ability)) bonus += 1;
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
      <div class="ab-total">${total ?? "—"}</div>
      <div class="ab-mod">модификатор ${total!=null?fmtMod(abilityMod(total)):"—"}</div>
      <div class="ab-roll">база ${base ?? "—"}${bonus ? ` + ${bonus} от расы` : ""}</div>
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
  const raceSk = racialSkills();
  state.skillChoices = state.skillChoices.filter(sk => !raceSk.includes(sk));
  hint.textContent = `Выбери ${c.skillChoices.count} навыков из списка класса.` + (raceSk.length ? ` От расы уже есть: ${raceSk.join(", ")}.` : "");
  grid.innerHTML = "";
  (c.skillChoices.options||[]).forEach(skill => {
    const fromRace = raceSk.includes(skill);
    const checked = fromRace || state.skillChoices.includes(skill);
    const atLimit = !fromRace && state.skillChoices.length >= c.skillChoices.count && !checked;
    const opt = document.createElement("label");
    opt.className = "skill-opt" + (checked?" checked":"") + ((atLimit||fromRace)?" disabled":"");
    opt.innerHTML = `<input type="checkbox" ${checked?"checked":""} ${(atLimit||fromRace)?"disabled":""}> ${skill} <span style="color:var(--text-dim);font-size:.75rem;margin-left:auto;">${fromRace?"от расы":(SKILL_ABILITY[skill]?SKILL_ABILITY[skill].toUpperCase():"")}</span>`;
    if (!fromRace) opt.querySelector("input").onchange = e => {
      if (e.target.checked) state.skillChoices.push(skill);
      else state.skillChoices = state.skillChoices.filter(s => s !== skill);
      if (state.classChoices && state.classChoices.expertise) state.classChoices.expertise = state.classChoices.expertise.filter(x => x === "Воровские инструменты" || state.skillChoices.includes(x) || raceSk.includes(x));
      renderSkillGrid(view);
      updateNextEnabled();
    };
    grid.appendChild(opt);
  });
}

/* ---------------- Расовые данные для листа (js/race-sheet.js) ---------------- */
function raceSheetEntries(){
  const r = getRace(), s = getSubrace();
  const map = (typeof RACE_SHEET !== "undefined") ? RACE_SHEET : {};
  return [r && map[r.id], s && map[s.id]].filter(Boolean);
}
function raceChoiceNeeds(){
  const needs = [];
  raceSheetEntries().forEach(e => {
    (e.choices || []).forEach(ch => needs.push(ch));
    if (e.skillChoice && e.skillChoice.count) needs.push({ type:"skills", count:e.skillChoice.count, options:e.skillChoice.options });
  });
  return needs;
}
function racialFixedSkills(){
  const out = [];
  raceSheetEntries().forEach(e => (e.skills || []).forEach(sk => { if (!out.includes(sk)) out.push(sk); }));
  return out;
}
function racialSkills(){
  const out = racialFixedSkills();
  ((state.raceChoices || {}).skills || []).forEach(sk => { if (!out.includes(sk)) out.push(sk); });
  return out;
}
function allSkillNames(){ return Object.keys(SKILL_ABILITY); }

/* ---------------- Step: Race choices (дракон-предок, кантрип, навыки, +1/+1) ---------------- */
function renderRaceChoiceStep(view){
  if (!state.raceChoices) state.raceChoices = {};
  const rc = state.raceChoices;
  const r = getRace(), s = getSubrace();
  const needs = raceChoiceNeeds();
  const blocks = needs.map((n, i) => {
    if (n.type === "ancestry"){
      return `<h3 class="spell-group-title">Драконий предок</h3>
        <p class="pool-note">Определяет вид урона оружия дыхания и сопротивление.</p>
        <div class="choice-grid">${n.options.map(o => `
          <button type="button" class="choice-tile${rc.ancestry===o.id?" selected":""}" data-k="ancestry" data-v="${o.id}">
            <b>${o.name}</b><span>${o.damage} · ${o.shape} · спасбросок ${ABILITY_NAMES[o.save]||o.save}</span>
          </button>`).join("")}</div>`;
    }
    if (n.type === "cantrip"){
      const list = DND_DATA.spells.filter(sp => sp.level === 0 && sp.classes.includes(n.from || "wizard"));
      return `<h3 class="spell-group-title">Заговор волшебника</h3>
        <p class="pool-note">Один заговор из списка волшебника; базовая характеристика — Интеллект.</p>
        <div class="choice-grid">${list.map(sp => `
          <button type="button" class="choice-tile${rc.cantrip===sp.id?" selected":""}" data-k="cantrip" data-v="${sp.id}">
            <b>${sp.name}</b><span>${escapeHtml((sp.description||"").split(". ")[0])}.</span>
          </button>`).join("")}</div>`;
    }
    if (n.type === "abilityPlus"){
      const picks = rc.abilityPlus || [];
      return `<h3 class="spell-group-title">+${n.value||1} к ${n.count} характеристикам</h3>
        <p class="pool-note">Выбери ${n.count} разные характеристики${(n.exclude||[]).length?` (кроме: ${(n.exclude||[]).map(a=>ABILITY_NAMES[a]).join(", ")})`:""}.</p>
        <div class="choice-grid choice-grid--abil">${ABILITY_ORDER.filter(a => !(n.exclude||[]).includes(a)).map(a => `
          <button type="button" class="choice-tile${picks.includes(a)?" selected":""}" data-k="abilityPlus" data-v="${a}" data-max="${n.count}">
            <b>${ABILITY_NAMES[a]}</b><span>${picks.includes(a)?"+1":"—"}</span>
          </button>`).join("")}</div>`;
    }
    if (n.type === "skills"){
      const opts = (n.options === "any" || !n.options) ? allSkillNames() : n.options;
      const fixed = racialFixedSkills();
      const picks = rc.skills || [];
      return `<h3 class="spell-group-title">Навыки расы: выбери ${n.count}</h3>
        <div class="choice-grid choice-grid--abil">${opts.filter(o => !fixed.includes(o)).map(o => `
          <button type="button" class="choice-tile${picks.includes(o)?" selected":""}" data-k="skills" data-v="${o}" data-max="${n.count}">
            <b>${o}</b><span>${ABILITY_NAMES[SKILL_ABILITY[o]]||""}</span>
          </button>`).join("")}</div>`;
    }
    return "";
  }).join("");
  view.innerHTML = `
    <div class="view-header"><h1>Особенности: ${s ? s.name : r.name}</h1><p>Раса даёт выбор — он попадёт в лист персонажа.</p></div>
    ${blocks}
  `;
  view.querySelectorAll(".choice-tile").forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.k, v = btn.dataset.v, max = Number(btn.dataset.max || 1);
      if (k === "ancestry" || k === "cantrip"){
        rc[k] = v;
        btn.parentNode.querySelectorAll(".choice-tile.selected").forEach(n => n.classList.remove("selected"));
        btn.classList.add("selected");
      } else {
        const arr = (rc[k] || []).slice();
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1);
        else { if (arr.length >= max) arr.shift(); arr.push(v); }
        rc[k] = arr;
        btn.parentNode.querySelectorAll(".choice-tile").forEach(n => {
          const on = arr.includes(n.dataset.v);
          n.classList.toggle("selected", on);
          if (k === "abilityPlus") n.querySelector("span").textContent = on ? "+1" : "—";
        });
      }
      saveState();
      updateNextEnabled();
    };
  });
}
function raceChoicesDone(){
  const rc = state.raceChoices || {};
  for (const n of raceChoiceNeeds()){
    if (n.type === "ancestry" && !rc.ancestry) return "Выбери драконьего предка";
    if (n.type === "cantrip" && !rc.cantrip) return "Выбери заговор";
    if (n.type === "abilityPlus" && (rc.abilityPlus||[]).length < n.count) return `Выбери ${n.count} характеристики для +1`;
    if (n.type === "skills" && (rc.skills||[]).length < n.count) return `Выбери ${n.count} навык(а) расы`;
  }
  return true;
}

/* Выборы подкласса (домен / происхождение / покровитель и их под-выборы) делаются прямо на шаге класса,
   остальные (боевой стиль, избранный враг, компетентность) — на отдельном шаге после навыков. */
const SUB_NEEDS = ["subclass","dragonAncestor","natureSkill","natureCantrip","deathCantrip","knowledgeSkills","deity","pactBoon","pactTome","pactBlade","pactChain"];
function subclassNeeds(classId){ return classChoiceNeeds(classId).filter(n => SUB_NEEDS.includes(n)); }
function laterClassNeeds(classId){ return classChoiceNeeds(classId).filter(n => !SUB_NEEDS.includes(n)); }

/* ---------------- Step: Class choices (боевой стиль, избранный враг, компетентность) ---------------- */
function renderClassChoiceStep(view){
  const c = getClass();
  view.innerHTML = `
    <div class="view-header"><h1>Умения класса: ${c.name}</h1><p>На 1-м уровне ${c.name.toLowerCase()} делает выбор, который сразу работает в бою и попадёт в лист.</p></div>
    <div id="ccBody"></div>`;
  const body = view.querySelector("#ccBody");
  const draw = () => { body.innerHTML = classChoicesHTML(c, laterClassNeeds(c.id)); bindChoiceTiles(body, draw); };
  draw();
}
function classChoicesHTML(c, needs){
  if (!state.classChoices) state.classChoices = {};
  const cc = state.classChoices;
  const tiles = (key, items) => `<div class="choice-grid">${items.map(it => `
    <button type="button" class="choice-tile${cc[key]===it.id?" selected":""}" data-k="${key}" data-v="${escapeHtml(it.id)}">
      <b>${it.name}</b>${it.text?`<span>${it.text}</span>`:""}
    </button>`).join("")}</div>`;
  let html = "";
  if (needs.includes("subclass")){
    const sub = getSubclass(c.id, cc);
    html += `<h3 class="spell-group-title">${SUBCLASS_TITLE[c.id]}</h3>
      <p class="pool-note">В D&amp;D ${c.name.toLowerCase()} выбирает это уже на 1-м уровне — выбор сразу даёт умения${c.id === "cleric" ? " и заклинания домена" : ""}.</p>
      ${tiles("subclass", SUBCLASSES[c.id].map(x => ({ id:x.id, name:x.name, text:x.short })))}
      ${sub ? subclassInfoHTML(c, sub, cc) : ""}`;
  }
  if (needs.includes("dragonAncestor")) html += `<h3 class="spell-group-title">Драконий предок</h3>${tiles("dragonAncestor", DRAGON_ANCESTORS.map(x => ({ id:x.id, name:x.name, text:x.damage })))}`;
  if (needs.includes("natureSkill")) html += `<h3 class="spell-group-title">Навык послушника природы</h3>${tiles("natureSkill", ["Выживание","Природа","Уход за животными"].map(x => ({ id:x, name:x })))}`;
  if (needs.includes("natureCantrip")) html += `<h3 class="spell-group-title">Заговор друида</h3>${tiles("natureCantrip", DND_DATA.spells.filter(x => x.level === 0 && x.classes.includes("druid")).map(x => ({ id:x.id, name:x.name, text:x.description })))}`;
  if (needs.includes("deathCantrip")) html += `<h3 class="spell-group-title">Жнец: заговор школы Некромантии</h3>
      <p class="pool-note">Любого класса. Если заговор бьёт одну цель, ты сможешь бить им двоих, стоящих рядом (в пределах 5 футов друг от друга).</p>
      ${tiles("deathCantrip", DND_DATA.spells.filter(x => x.level === 0 && x.school === "Некромантия").map(x => ({ id:x.id, name:x.name, text:x.description })))}`;
  if (needs.includes("knowledgeSkills")){
    const picks = cc.knowledgeSkills || [];
    html += `<h3 class="spell-group-title">Благословение знаний: выбери 2 навыка</h3>
      <p class="pool-note">Ты владеешь ими с удвоенным бонусом мастерства.</p>
      <div class="choice-grid choice-grid--abil">${["История","Магия","Природа","Религия"].map(o => `
        <button type="button" class="choice-tile${picks.includes(o)?" selected":""}" data-k="knowledgeSkills" data-v="${o}" data-multi="2"><b>${o}</b><span>Интеллект</span></button>`).join("")}</div>`;
  }
  if (needs.includes("deity")){
    const opts = deityOptions(c.id, cc);
    const isW = c.id === "warlock";
    html += `<h3 class="spell-group-title">${isW ? "Кто именно твой покровитель" : "Божество, которому ты служишь"} <span class="opt-tag">для отыгрыша</span></h3>
      <p class="pool-note">${isW ? "Примеры могущественных существ этого типа из «Книги игрока»." : c.id === "cleric" ? "Боги Забытых Королевств, которым подходит выбранный домен («Книга игрока», приложение Б)." : "Боги Забытых Королевств («Книга игрока», приложение Б)."} На правила не влияет — имя попадёт в лист. Можно вписать своего.</p>
      <div class="choice-grid choice-grid--deity">${opts.map(g => `
        <button type="button" class="choice-tile${!cc.deityCustom && cc.deity===g.id?" selected":""}" data-k="deity" data-v="${escapeHtml(g.id)}">
          <b>${g.name}</b><span>${g.title}${g.al ? " · " + g.al : ""}</span>${g.lore ? `<em class="tile-flavor">${esc(g.lore)}</em>` : g.symbol ? `<em class="tile-flavor">Символ: ${esc(g.symbol.charAt(0).toLowerCase() + g.symbol.slice(1))}</em>` : ""}</button>`).join("")}</div>
      <label class="deity-custom">Свой вариант: <input type="text" id="deityCustom" maxlength="60" placeholder="${isW ? "имя покровителя" : "имя божества"}" value="${escapeHtml(cc.deityCustom || "")}"></label>`;
  }
  if (needs.includes("pactBoon") && typeof PACT_BOONS !== "undefined"){
    const patron = getSubclass(c.id, cc);
    const pname = patron ? ({ archfey:"Архифеи", fiend:"Исчадия", greatold:"Великого Древнего" }[patron.id] || patron.name) : "";
    html += `<h3 class="spell-group-title">Предмет договора — дар покровителя</h3>
      <p class="pool-note">По «Книге игрока» покровитель вручает дар на 3-м уровне. Выбери его сейчас — он попадёт в лист персонажа с пометкой «с 3-го уровня»${pname ? `, а описание подстроится под ${pname}` : ""}.</p>
      <div class="choice-grid choice-grid--pact">${PACT_BOONS.map(pb => {
        const fl = pb.flavor && (pb.flavor[cc.subclass] || pb.flavor._);
        return `<button type="button" class="choice-tile${cc.pactBoon===pb.id?" selected":""}" data-k="pactBoon" data-v="${pb.id}">
          <b>${pb.name}</b><span>${pb.sub}</span>${fl ? `<em class="tile-flavor">${esc(fl)}</em>` : ""}</button>`;
      }).join("")}</div>`;
    const boon = PACT_BOONS.find(x => x.id === cc.pactBoon);
    if (boon) html += `<div class="subclass-info"><h4 class="si-title">${boon.name}: что даёт</h4>${loreParas(boon.paras)}</div>`;
  }
  if (needs.includes("pactTome")){
    const picks = cc.pactTome || [];
    html += `<h3 class="spell-group-title">Книга теней: выбери 3 заговора любых классов <span class="pick-count">${picks.length}/3</span></h3>
      <div class="choice-grid">${DND_DATA.spells.filter(x => x.level === 0).map(sp => `
        <button type="button" class="choice-tile${picks.includes(sp.id)?" selected":""}" data-k="pactTome" data-v="${sp.id}" data-multi="3">
          <b>${sp.name}</b><span>${esc((sp.description||"").length > 110 ? sp.description.slice(0,107).replace(/\s+\S*$/,"") + "…" : (sp.description||""))}</span></button>`).join("")}</div>`;
  }
  if (needs.includes("pactBlade") && typeof WEAPON_CATALOG !== "undefined"){
    html += `<h3 class="spell-group-title">Оружие договора: обычный облик</h3>
      <p class="pool-note">Призвать можно любое рукопашное оружие — здесь выбери облик, в котором оно будет записано в листе.</p>
      ${tiles("pactBlade", WEAPON_CATALOG.filter(w => !w.ranged).map(w => ({ id:w.id, name:w.name, text:w.info.replace(/(\d+)d(\d+)/g,"$1к$2") })))}`;
  }
  if (needs.includes("pactChain") && typeof PACT_FAMILIARS !== "undefined"){
    html += `<h3 class="spell-group-title">Особый фамильяр</h3>
      <div class="choice-grid choice-grid--pact">${PACT_FAMILIARS.map(f => `
        <button type="button" class="choice-tile${cc.pactChain===f.id?" selected":""}" data-k="pactChain" data-v="${f.id}">
          <b>${f.name}${f.patron === cc.subclass || cc.subclass === "greatold" ? ` <i class="tile-star" title="подходит вашему покровителю">★</i>` : ""}</b><span>${f.type}</span><em class="tile-flavor">${f.stats}</em></button>`).join("")}</div>
      <p class="pool-note">★ — облик, который отражает сущность покровителя (Великому Древнему подходит любой).</p>`;
  }
  const ruleNote = k => (typeof CLASS_RULE_TEXT !== "undefined" && CLASS_RULE_TEXT[k]) ? `<div class="rule-note">${loreParas(CLASS_RULE_TEXT[k])}</div>` : "";
  if (needs.includes("fightingStyle")) html += `<h3 class="spell-group-title">Боевой стиль</h3>${ruleNote("fightingStyle")}${tiles("fightingStyle", FIGHTING_STYLES)}`;
  if (needs.includes("favoredEnemy")) html += `<h3 class="spell-group-title">Избранный враг</h3>${ruleNote("favoredEnemy")}${tiles("favoredEnemy", FAVORED_ENEMIES.map(x => ({id:x, name:x, text:FAVORED_ENEMY_HINT[x] || ""})))}`;
  if (needs.includes("favoredTerrain")) html += `<h3 class="spell-group-title">Излюбленная местность (умение «Исследователь природы»)</h3>${ruleNote("favoredTerrain")}${tiles("favoredTerrain", FAVORED_TERRAINS.map(x => ({id:x, name:x})))}`;
  if (needs.includes("expertise")){
    const prof = [...new Set([...state.skillChoices, ...racialSkills()])];
    const opts = [...prof, "Воровские инструменты"];
    const picks = cc.expertise || [];
    html += `<h3 class="spell-group-title">Компетентность: выбери 2</h3>
      <p class="pool-note">Так по «Книге игрока»: плут с 1 уровня владеет воровскими инструментами, и «Компетентность» позволяет удвоить бонус мастерства либо для двух навыков, либо для одного навыка и воровских инструментов (взлом замков, обезвреживание ловушек).</p>
      <div class="choice-grid choice-grid--abil">${opts.map(o => `
        <button type="button" class="choice-tile${picks.includes(o)?" selected":""}" data-k="expertise" data-v="${escapeHtml(o)}" data-multi="2">
          <b>${o}</b><span>${SKILL_ABILITY[o] ? ABILITY_NAMES[SKILL_ABILITY[o]] : "инструменты"}</span>
        </button>`).join("")}</div>`;
  }
  return html;
}
function bindChoiceTiles(view, redraw){
  const cc = state.classChoices;
  view.querySelectorAll(".choice-tile").forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.k, v = btn.dataset.v;
      if (btn.dataset.multi){
        const max = Number(btn.dataset.multi);
        const arr = (cc[k] || []).slice();
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else { if (arr.length >= max) arr.shift(); arr.push(v); }
        cc[k] = arr;
        btn.parentNode.querySelectorAll(".choice-tile").forEach(n => n.classList.toggle("selected", arr.includes(n.dataset.v)));
        const cnt = btn.parentNode.previousElementSibling && btn.parentNode.previousElementSibling.querySelector(".pick-count");
        if (cnt) cnt.textContent = `${arr.length}/${max}`;
      } else {
        cc[k] = v;
        btn.parentNode.querySelectorAll(".choice-tile.selected").forEach(n => n.classList.remove("selected"));
        btn.classList.add("selected");
      }
      if (k === "deity"){ delete cc.deityCustom; const inp = view.querySelector("#deityCustom"); if (inp) inp.value = ""; }
      saveState();
      if (k === "pactBoon"){
        ["pactTome","pactBlade","pactChain"].forEach(x => delete cc[x]);
        saveState();
        const y = window.scrollY; redraw(); window.scrollTo(0, y);
      }
      if (k === "subclass"){
        // смена подкласса сбрасывает его под-выборы
        ["dragonAncestor","natureSkill","natureCantrip","deathCantrip","knowledgeSkills","deity"].forEach(x => delete cc[x]);
        state.spells = [];
        saveState();
        const y = window.scrollY; redraw(); window.scrollTo(0, y);
      }
      updateNextEnabled();
    };
  });
  const dc = view.querySelector("#deityCustom");
  if (dc) dc.oninput = () => {
    const v = dc.value.trim();
    if (v){ cc.deityCustom = v; view.querySelectorAll('.choice-tile[data-k="deity"]').forEach(n => n.classList.remove("selected")); }
    else delete cc.deityCustom;
    saveState();
  };
}
function subclassChoicesDone(){
  const c = getClass(); if (!c) return true;
  const cc = state.classChoices || {};
  const needs = subclassNeeds(c.id);
  if (needs.includes("subclass") && !cc.subclass) return "Выбери: " + SUBCLASS_TITLE[c.id].toLowerCase();
  if (needs.includes("dragonAncestor") && !cc.dragonAncestor) return "Выбери драконьего предка";
  if (needs.includes("natureSkill") && !cc.natureSkill) return "Выбери навык послушника природы";
  if (needs.includes("natureCantrip") && !cc.natureCantrip) return "Выбери заговор друида";
  if (needs.includes("deathCantrip") && !cc.deathCantrip) return "Выбери заговор некромантии для «Жнеца»";
  if (needs.includes("knowledgeSkills") && (cc.knowledgeSkills || []).length < 2) return "Выбери 2 навыка благословения знаний";
  if (needs.includes("pactBoon") && !cc.pactBoon) return "Выбери предмет договора";
  if (needs.includes("pactTome") && (cc.pactTome || []).length < 3) return "Выбери 3 заговора для Книги теней";
  if (needs.includes("pactBlade") && !cc.pactBlade) return "Выбери облик оружия договора";
  if (needs.includes("pactChain") && !cc.pactChain) return "Выбери облик фамильяра";
  return true;
}
function classChoicesDone(){
  const c = getClass(); if (!c) return true;
  const cc = state.classChoices || {};
  const needs = classChoiceNeeds(c.id);
  if (needs.includes("subclass") && !cc.subclass) return "Выбери: " + SUBCLASS_TITLE[c.id].toLowerCase();
  if (needs.includes("dragonAncestor") && !cc.dragonAncestor) return "Выбери драконьего предка";
  if (needs.includes("natureSkill") && !cc.natureSkill) return "Выбери навык послушника природы";
  if (needs.includes("natureCantrip") && !cc.natureCantrip) return "Выбери заговор друида";
  if (needs.includes("deathCantrip") && !cc.deathCantrip) return "Выбери заговор некромантии для «Жнеца»";
  if (needs.includes("knowledgeSkills") && (cc.knowledgeSkills || []).length < 2) return "Выбери 2 навыка благословения знаний";
  if (needs.includes("fightingStyle") && !cc.fightingStyle) return "Выбери боевой стиль";
  if (needs.includes("favoredEnemy") && !cc.favoredEnemy) return "Выбери избранного врага";
  if (needs.includes("favoredTerrain") && !cc.favoredTerrain) return "Выбери излюбленную местность";
  if (needs.includes("expertise")){
    const prof = new Set([...state.skillChoices, ...racialSkills(), "Воровские инструменты"]);
    const ex = (cc.expertise || []).filter(x => prof.has(x));
    if (ex.length < 2) return "Выбери 2 навыка для компетентности";
  }
  return true;
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
    <div class="view-header"><h1>Телосложение героя</h1><p>Средние значения для расы «${getRace()?getRace().name:""}»: рост ~${avg.heightCm} см, вес ~${avg.weightKg} кг. Двигай ползунки — миниатюра и вес обновятся сразу, нелепых сочетаний вроде «2 метра и 30 кг» выставить не получится.</p></div>
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
    view.querySelector("#heightVal").textContent = `${state.heightCm} см`;
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
    revealOnMobile(view.querySelector("#eqDetail"));
    saveState();
    updateNextEnabled();
  };
  (c.startingEquipment||[]).forEach(opt => {
    const row = document.createElement("div");
    row.className = "pick-row" + (state.equipmentChoice === opt.choice ? " selected" : "");
    row.innerHTML = `
      <span class="glyph glyph--letter">${CYR_LETTER[opt.choice] || opt.choice}</span>
      <div class="pr-text"><div class="pr-name">Вариант ${CYR_LETTER[opt.choice] || opt.choice}</div><div class="pr-sub">${opt.role || ""}</div></div>
    `;
    row.onclick = () => selectRow(row, opt.choice);
    grid.appendChild(row);
  });
  const rowD = document.createElement("div");
  rowD.className = "pick-row" + (state.equipmentChoice === "D" ? " selected" : "");
  rowD.innerHTML = `<span class="glyph glyph--letter">✎</span><div class="pr-text"><div class="pr-name">Своя сборка</div><div class="pr-sub">оружие, доспех, набор</div></div>`;
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
  let opt = (c.startingEquipment||[]).find(e => e.choice === state.equipmentChoice);
  if (!opt){ opt = (c.startingEquipment||[])[0]; if (!opt) return; state.equipmentChoice = opt.choice; }
    detail.innerHTML = `
      <div class="detail-panel">
        <h3>Вариант ${CYR_LETTER[opt.choice] || opt.choice}${opt.role ? " — " + opt.role : ""}</h3>
        <ul>${opt.items.map(i => `<li>${itemIconHTML(i.name||i)}<b>${i.name||i}</b>${i.info ? `<span class="eq-info">— ${i.info}</span>` : ""}</li>`).join("")}</ul>
      </div>
    `;
  }
  function itemIconHTML(name){
    const ICON_ALIAS = { "Два коротких меча":"shortsword", "Два кинжала":"dagger", "Два ручных топора":"handaxe", "Праща":"sling", "Лёгкий арбалет":"light-crossbow",
      "Длинный лук":"longbow", "Короткий лук":"shortbow", "Ручной арбалет":"handcrossbow", "метательн":"javelins", "дротиков":"darts" };
    const alias = Object.keys(ICON_ALIAS).find(k => name.includes(k));
    const w = WEAPON_CATALOG.find(x => x.name === name) || (alias && WEAPON_CATALOG.find(x => x.id === ICON_ALIAS[alias]));
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
/* Цвета школ для фона иконки заклинания (в стиле Dota 2 — цветная рамка способности) */
const SCHOOL_COLOR = {
  "Трансмутация": ["#2d6b4a","#173a28"], "Воплощение": ["#c0432a","#5c1a0e"],
  "Вызов": ["#3a5fae","#15284f"], "Некромантия": ["#3f7a3a","#12260f"],
  "Ограждение": ["#b8964a","#4a3a18"], "Прорицание": ["#3f9cae","#113840"],
  "Очарование": ["#a33a7a","#451030"], "Иллюзия": ["#7a4fae","#2a1848"]
};
/* Уникальный символ-эффект на каждое заклинание (стиль иконок способностей Dota 2) */
const SPELL_ICON = {
  "acid-splash":"🧪","chill-touch":"❄️","dancing-lights":"🕯️","fire-bolt":"🔥","light":"💡",
  "mage-hand":"🤚","mending":"🧵","message":"✉️","minor-illusion":"🎭","poison-spray":"☣️",
  "prestidigitation":"🪄","ray-of-frost":"🥶","sacred-flame":"☀️","shocking-grasp":"⚡",
  "spare-the-dying":"💚","true-strike":"🎯","vicious-mockery":"🗯️","druidcraft":"🌱",
  "guidance":"🧭","resistance":"🔰","thaumaturgy":"📯","eldritch-blast":"🌑","produce-flame":"🔆",
  "shillelagh":"🌳","bane":"💀","charm-person":"💘","comprehend-languages":"📜","cure-wounds":"❤️",
  "detect-magic":"🔮","disguise-self":"🪞","expeditious-retreat":"💨","faerie-fire":"🧚",
  "feather-fall":"🪶","guiding-bolt":"⭐","healing-word":"💗","heroism":"🦁","hideous-laughter":"😂",
  "identify":"🔍","illusory-script":"📝","inflict-wounds":"🩸","longstrider":"👢",
  "protection-from-evil-and-good":"🕊️","purify-food-and-drink":"🍞","sanctuary":"⛪",
  "shield-of-faith":"🛡️","silent-image":"🖼️","sleep":"💤","speak-with-animals":"🐾",
  "tasha-hideous-laughter":"🤪","thunderwave":"🌩️","unseen-servant":"👻",
  "bless":"🙏","command":"🗣️","burning-hands":"🔥","divine-favor":"⚔️","animal-friendship":"🦌",
  "dissonant-whispers":"👂","fog-cloud":"🌫️"
};
let magicTab = "cantrips";
function renderMagic(view){
  const c = getClass();
  const isCaster = !!(c && c.spellcasting && CASTER_RULES[c.id]);
  const r = isCaster ? CASTER_RULES[c.id] : null;
  const abMod = isCaster ? abilityMod(getTotalAbility(r.ability)) : 0;
  const cantripLimit = isCaster ? r.cantrips : 0;
  const spellLimit = isCaster ? casterKnownCount(c.id, abMod) : 0;
  const slots = isCaster ? (LEVEL1_SPELL_SLOTS[c.id] || 2) : 0;
  let cantrips = [], lvl1 = [];
  if (isCaster){
    const granted = [state.classChoices && state.classChoices.natureCantrip, state.classChoices && state.classChoices.deathCantrip].filter(Boolean);
    cantrips = DND_DATA.spells.filter(s => s.level === 0 && s.classes.includes(c.id) && !granted.includes(s.id));
    state.spells = state.spells.filter(id => !granted.includes(id));
    const sub = getSubclass(c.id, state.classChoices);
    const extra = (sub && sub.extraList) || [];
    const fixed = (sub && sub.spells) || []; // заклинания домена всегда подготовлены — их не выбирают
    lvl1 = DND_DATA.spells.filter(s => s.level === 1 && (s.classes.includes(c.id) || extra.includes(s.id)) && !fixed.includes(s.id));
    state.spells = state.spells.filter(id => !fixed.includes(id));
  }

  const tabs = [];
  if (isCaster) tabs.push(["cantrips","Фокусы"], ["lvl1","1-й круг"]);
  tabs.push(["custom","Кастомные"]);
  if (!tabs.some(t => t[0] === magicTab)) magicTab = tabs[0][0];

  const customLib = window.SkillLibrary ? window.SkillLibrary.get() : [];
  const chosenCustom = state.customSkills || [];

  view.innerHTML = `
    <div class="view-header">
      <h1>${isCaster ? "Выбери заклинания" : "Навыки и способности"}</h1>
      <p>${isCaster
        ? `${c.name} черпает силу из ${ABILITY_NAMES[r.ability]}. Выбери фокусы и заклинания 1-го уровня — они появятся в листе персонажа со слотами применения.`
        : `${c ? c.name : "Этот класс"} не колдует по правилам D&amp;D, но ты можешь выдать ему свои кастомные навыки из библиотеки.`}</p>
    </div>
    <div class="mode-tabs magic-mode-tabs" id="magicTabs">
      ${tabs.map(([id,label]) => `<button type="button" class="mode-tab${magicTab===id?" active":""}" data-tab="${id}">${label}</button>`).join("")}
    </div>
    <div class="spell-counter" id="spCounter"></div>
    <div id="magicTabPanel"></div>
  `;
  view.querySelectorAll(".magic-mode-tabs .mode-tab").forEach(btn => btn.onclick = () => { magicTab = btn.dataset.tab; renderMagic(view); });
  const panel = view.querySelector("#magicTabPanel");
  const counterEl = view.querySelector("#spCounter");

  if (magicTab === "custom"){
    if (!customLib.length){
      panel.innerHTML = `<p class="magic-empty">Библиотека навыков пуста. Открой «📘 Библиотека навыков» в верхней панели и добавь хотя бы один, чтобы использовать его тут.</p>`;
    } else {
      panel.innerHTML = `<div class="spell-list" id="customSkillList"></div>`;
      const list = panel.querySelector("#customSkillList");
      customLib.forEach(sk => {
        const selected = chosenCustom.includes(sk.id);
        const card = document.createElement("div");
        card.className = "spell-card" + (selected ? " selected" : "");
        const catLabel = sk.category === "level1" ? `1-й круг · ${sk.slotCost||1} ячейка(и)` : "Фокус · без ограничений";
        const actionLabel = (window.CUSTOM_SKILL_ACTION_LABEL && window.CUSTOM_SKILL_ACTION_LABEL[sk.actionType]) || "Действие";
        const metaBits = [];
        if (sk.dice) metaBits.push(`Урон ${sk.dice}`);
        if (sk.checkAbility && sk.checkAbility !== "none") metaBits.push(`Проверка ${ABILITY_NAMES[sk.checkAbility]}${sk.dc?` (Сл ${sk.dc})`:""}`);
        if (sk.range) metaBits.push(sk.range);
        card.innerHTML = `
          <div class="sp-top"><span class="sp-name">🔖 ${escapeHtml(sk.name)}</span><span class="sp-lvl">${catLabel}</span></div>
          <div class="sp-desc">${escapeHtml(sk.description||"")}</div>
          <div class="sp-desc" style="margin-top:4px;opacity:.8;">${actionLabel}${metaBits.length?" · "+metaBits.map(escapeHtml).join(" · "):""}</div>
        `;
        card.onclick = () => {
          if (selected) state.customSkills = chosenCustom.filter(id => id !== sk.id);
          else state.customSkills = chosenCustom.concat(sk.id);
          saveState();
          renderMagic(view);
        };
        list.appendChild(card);
      });
    }
    counterEl.textContent = `Кастомных навыков в арсенале: ${chosenCustom.length}${chosenCustom.length ? " — этого достаточно, чтобы продолжить дальше" : ""}`;
    updateNextEnabled();
    return;
  }

  panel.innerHTML = `<div class="spell-list" id="tabSpellList"></div>`;
  const spells = magicTab === "cantrips" ? cantrips : lvl1;
  const limit = magicTab === "cantrips" ? cantripLimit : spellLimit;
  const listEl = panel.querySelector("#tabSpellList");
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
    listEl.appendChild(card);
  });
  const chosenCantrips = state.spells.filter(id => cantrips.some(s=>s.id===id)).length;
  const chosenLvl1 = state.spells.filter(id => lvl1.some(s=>s.id===id)).length;
  counterEl.textContent = `Выбрано фокусов: ${chosenCantrips}/${cantripLimit} · заклинаний 1-го уровня: ${chosenLvl1}/${spellLimit} (ячеек в день: ${slots})${chosenCustom.length ? ` · кастомных навыков: ${chosenCustom.length}` : ""}`;
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
function computeAC(dexMod, equip, mods, classId){
  const hasShield = equip && equip.hasShield;
  if (!equip || !equip.armorMeta){
    // Защита без доспехов: варвар (щит можно), монах (без щита).
    if (classId === "barbarian") return 10 + dexMod + mods.con + (hasShield ? 2 : 0);
    if (classId === "monk" && !hasShield) return 10 + dexMod + mods.wis;
    return 10 + dexMod + (hasShield ? 2 : 0);
  }
  const a = equip.armorMeta;
  const dexBonus = a.dexCap === 0 ? 0 : (a.dexCap != null ? Math.min(dexMod, a.dexCap) : dexMod);
  return a.base + dexBonus + (hasShield ? 2 : 0);
}

/* Подстановка чисел персонажа в тексты особенностей. */
function fillRuleText(t, mods, pb){
  return String(t || "")
    .replace(/\{pb2\}/g, String(pb * 2))
    .replace(/\{pb\}/g, String(pb))
    .replace(/\{mod:(\w+)\}/g, (_, ab) => fmtMod(mods[ab]))
    .replace(/\{dc:(\w+)\}/g, (_, ab) => String(8 + pb + mods[ab]));
}
/* Классовые владения инструментами (PHB), которых нет в DND_DATA. */
const CLASS_TOOLS = {
  bard:  ["Три музыкальных инструмента на выбор"],
  druid: ["Набор травника"],
  monk:  ["Один вид ремесленных инструментов или музыкальный инструмент"],
  rogue: ["Воровские инструменты"]
};
const CLASS_LANGS = { druid:["Друидический"], rogue:["Воровской жаргон"] };

function computeFinal(){
  const r = getRace(), s = getSubrace(), c = getClass();
  const totals = {};
  ABILITY_ORDER.forEach(ab => totals[ab] = getTotalAbility(ab));
  const mods = {};
  ABILITY_ORDER.forEach(ab => mods[ab] = abilityMod(totals[ab]));
  const pb = PROFICIENCY_BONUS_LVL1;
  const rs = raceSheetEntries();
  const rc = state.raceChoices || {};
  const cc = state.classChoices || {};
  const ancestry = (() => {
    const need = raceChoiceNeeds().find(n => n.type === "ancestry");
    return need ? need.options.find(o => o.id === rc.ancestry) || null : null;
  })();

  const saves = ABILITY_ORDER.map(ab => {
    const prof = c && c.savingThrows && c.savingThrows.map(x=>x.toLowerCase()).includes(ab);
    return { ab, prof, value: mods[ab] + (prof ? pb : 0) };
  });
  const sub = c ? getSubclass(c.id, cc) : null;
  const subSkills = sub ? [...(sub.id === "knowledge" ? cc.knowledgeSkills || [] : []), ...(sub.id === "nature" && cc.natureSkill ? [cc.natureSkill] : [])] : [];
  const raceSk = [...racialSkills(), ...subSkills];
  const expertise = [...(cc.expertise || []), ...(sub && sub.id === "knowledge" ? cc.knowledgeSkills || [] : [])];
  const skills = Object.entries(SKILL_ABILITY).map(([name, ab]) => {
    const prof = state.skillChoices.includes(name) || raceSk.includes(name);
    const exp = prof && expertise.includes(name);
    return { name, ab, prof, exp, value: mods[ab] + (prof ? pb : 0) + (exp ? pb : 0) };
  });
  const perception = skills.find(x => x.name === "Восприятие");
  const passivePerception = 10 + (perception ? perception.value : mods.wis);

  const hpBonus = rs.reduce((acc, e) => acc + (e.hpPerLevel || 0), 0) + ((sub && sub.hpPerLevel) || 0);
  const hp = (c ? c.hitDie : 8) + mods.con + hpBonus;
  const equip = getEquip(c);
  let ac = computeAC(mods.dex, equip, mods, c && c.id);
  if (sub && sub.unarmoredAC && !(equip && equip.armorMeta)) ac = Math.max(ac, sub.unarmoredAC + mods.dex + (equip && equip.hasShield ? 2 : 0));
  const initiative = mods.dex;

  // Скорости
  const pick = k => rs.reduce((v, e) => e[k] != null ? e[k] : v, null);
  const walk = (s && s.speed) || pick("speed") || (r ? r.speed : 30);
  const speeds = { walk, climb: pick("climb"), swim: pick("swim"), fly: pick("fly") };
  const darkvision = pick("darkvision");

  // Сопротивления / иммунитеты
  const resist = [], immune = [];
  rs.forEach(e => { (e.resistances||[]).forEach(x => resist.includes(x) || resist.push(x)); (e.immunities||[]).forEach(x => immune.includes(x) || immune.push(x)); });
  if (ancestry && !resist.includes(ancestry.damage)) resist.push(ancestry.damage);

  // Владения
  const uniq = arr => arr.filter((x, i) => x && arr.indexOf(x) === i);
  const armorProf = uniq([...(c ? c.armorProficiency || [] : []), ...rs.flatMap(e => e.armor || []), ...((sub && sub.armor) || [])]);
  const weaponProf = uniq([...(c ? c.weaponProficiency || [] : []), ...rs.flatMap(e => e.weapons || []), ...((sub && sub.weapons) || [])]);
  const toolProf = uniq([...(c ? CLASS_TOOLS[c.id] || [] : []), ...rs.flatMap(e => e.tools || []), rc.dwarfTool]);
  const languages = uniq([...rs.flatMap(e => e.languages || []), ...(r && !rs.some(e => e.languages) ? r.languages || [] : []), ...(c ? CLASS_LANGS[c.id] || [] : []), ...((sub && sub.languages) || [])]);

  // Классовые умения
  const classFeatures = c ? classSheetFeatures(c.id, { mods, pb, classChoices: cc }) : [];

  // Расовые черты (без «гибкого бонуса» и т.п. — это не игровое умение)
  const raceTraits = [];
  if (darkvision) raceTraits.push({ name: darkvision >= 120 ? "Превосходное тёмное зрение" : "Тёмное зрение", text: DARKVISION_TEXT(darkvision), kind:"passive" });
  rs.forEach(e => (e.traits || []).forEach(t => raceTraits.push(Object.assign({ kind:"passive" }, t, { text: fillRuleText(t.text, mods, pb) }))));
  if (ancestry){
    raceTraits.unshift(
      { name:`Наследие драконов: ${ancestry.name}`, text:`Сопротивление урону: ${ancestry.damage}.`, kind:"passive" },
      { name:"Оружие дыхания", text:`Действием: ${ancestry.shape}, урон ${ancestry.damage} 2к6; спасбросок ${ABILITY_NAMES[ancestry.save]} Сл ${8 + pb + mods.con}, при успехе половина урона.`, kind:"action", uses:1, rest:"короткий или продолжительный отдых" }
    );
  }
  const laterFeatures = [];
  rs.forEach(e => (e.later || []).forEach(t => laterFeatures.push(t)));

  // Расовые заклинания
  const bestMental = ["int","wis","cha"].reduce((b, ab) => mods[ab] > mods[b] ? ab : b, "int");
  const raceSpells = [];
  rs.forEach(e => (e.spells || []).forEach(sp => {
    const ab = sp.ability === "best" ? bestMental : sp.ability;
    const lvl = sp.minLevel || 1;
    if (lvl > 1){ laterFeatures.push({ minLevel: lvl, name: sp.name || sp.id, text: `${sp.note}: ${sp.uses}. Базовая характеристика — ${ABILITY_NAMES[ab]}.` }); return; }
    const base = DND_DATA.spells.find(x => x.id === sp.id);
    const extra = RACE_SPELL_TEXT[sp.id] || {};
    raceSpells.push({
      id: sp.id, name: extra.name || (base && base.name) || sp.name, level: base ? base.level : (extra.level || 0),
      school: base ? base.school : null,
      description: extra.text || (base && base.description) || "",
      ability: ab, uses: fillRuleText(sp.uses, mods, pb), note: sp.note,
      circles: sp.circles === "pb" ? pb : (sp.circles || 0),
      dc: 8 + pb + mods[ab], atk: pb + mods[ab]
    });
  }));
  if (rc.cantrip){
    const base = DND_DATA.spells.find(x => x.id === rc.cantrip);
    if (base) raceSpells.push({ id: base.id, name: base.name, level: 0, school: base.school, description: base.description, ability:"int", uses:"неограниченно", note:"Заговор высшего эльфа", circles:0, dc: 8 + pb + mods.int, atk: pb + mods.int });
  }

  // Атаки
  const raceAttacks = [];
  rs.forEach(e => (e.attacks || []).forEach(a => raceAttacks.push({ name: a.name, hit: fmtMod(mods[a.ability] + pb), dmg: `${a.dice}${fmtMod(mods[a.ability])} ${a.type}`, notes: a.notes || "" })));
  const attacks = buildAttacks({ mods, pb, c, equip, classChoices: cc, raceAttacks });
  if (r && r.id === "grung") attacks.forEach(a => { if (/колющ/.test(a.dmg)) a.notes = (a.notes ? a.notes + ", " : "") + "яд кожи: +2к4 ядом (спас ТЕЛ Сл 12)"; });

  // Классовые заклинания
  const subSpellIds = sub ? [...(sub.cantrips || []), ...(sub.id === "nature" && cc.natureCantrip ? [cc.natureCantrip] : []), ...(sub.id === "death" && cc.deathCantrip ? [cc.deathCantrip] : []), ...(sub.spells || [])] : [];
  const spellsDetailed = [
    ...state.spells.filter(id => !subSpellIds.includes(id)).map(id => DND_DATA.spells.find(sp=>sp.id===id)),
    ...subSpellIds.map(id => { const b = DND_DATA.spells.find(sp=>sp.id===id); return b ? Object.assign({}, b, { fromSub: sub.name }) : null; })
  ].filter(Boolean).sort((a, b) => a.level - b.level);
  const spellNames = spellsDetailed.map(sp => sp.name);
  const slots = c ? (LEVEL1_SPELL_SLOTS[c.id] || 0) : 0;
  const casting = (c && CASTER_RULES[c.id]) ? (() => {
    const ab = CASTER_RULES[c.id].ability;
    return { ab, dc: 8 + pb + mods[ab], atk: pb + mods[ab], text: CASTING_TEXT[c.id] || "" };
  })() : null;

  const avg = avgHeightWeight(state.raceId, state.subraceId);
  const roleplayLines = [
    ...abilityFlavorLines(totals),
    ...physiqueFlavorLines(state.heightCm, state.weightKg, avg.weightKg)
  ];
  const customLib = window.SkillLibrary ? window.SkillLibrary.get() : [];
  const customSkillsDetailed = (state.customSkills || []).map(id => customLib.find(sk => sk.id === id)).filter(Boolean);
  return { r, s, c, totals, mods, pb, saves, skills, passivePerception, hp, ac, initiative, equip, speeds, darkvision,
    resist, immune, armorProf, weaponProf, toolProf, languages, classFeatures, raceTraits, laterFeatures,
    raceSpells, attacks, spellNames, spellsDetailed, slots, casting, roleplayLines, customSkillsDetailed };
}

function renderSheet(view){
  const d = computeFinal();
  view.innerHTML = `
    <div class="view-header"><h1>Твой герой готов</h1><p>Нажми на рамку слева вверху, чтобы добавить портрет героя. Потом скачай лист в PDF или сразу отправь на печать.</p></div>
    <div class="sheet-actions">
      <button class="btn btn-gold" id="btnPdfA4">⇩ Скачать PDF (A4)</button>
      <button class="btn btn-ghost" id="btnPrint">🖶 Печать</button>
      <button class="btn btn-ghost" id="btnRestart">↻ Начать заново</button>
    </div>
    <div class="sheet-wrap"><div id="charSheet">${sheetHTML(d)}</div></div>
  `;
  view.querySelector("#btnPdfA4").onclick = () => exportPDFA4();
  view.querySelector("#btnPrint").onclick = () => window.print();
  bindSheetPhoto(view);
  view.querySelector("#btnRestart").onclick = () => {
    if (confirm("Начать создание персонажа заново? Все данные будут сброшены.")){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };
}

/* Портрет на листе: клик по рамке — загрузка, ✕ — убрать. Картинка кадрируется в вертикальный прямоугольник 3:4. */
function bindSheetPhoto(view){
  const box = view.querySelector("#sheetPhoto"); if (!box) return;
  const input = box.querySelector("#sheetPhotoInput");
  box.onclick = e => { if (e.target.closest("#sheetPhotoClear")) return; input.click(); };
  input.onclick = e => e.stopPropagation();
  input.onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    cropImageToSquare(file, 600, 4/3).then(url => { state.photoDataUrl = url; saveState(); renderSheet(view); })
      .catch(() => toast("Не удалось прочитать картинку"));
  };
  const clr = box.querySelector("#sheetPhotoClear");
  if (clr) clr.onclick = e => { e.stopPropagation(); state.photoDataUrl = null; saveState(); renderSheet(view); };
}

const KIND_LABEL = { action:"действие", bonus:"бонусное действие", reaction:"реакция" };
function sheetCircles(n){ return n > 0 ? `<span class="sf-circles">${"☐".repeat(n)}</span>` : ""; }

function sheetHTML(d){
  const { r, s, c, totals, mods, pb, saves, skills, passivePerception, hp, ac, initiative, equip, speeds,
    resist, immune, armorProf, weaponProf, toolProf, languages, classFeatures, raceTraits, laterFeatures,
    raceSpells, attacks, spellsDetailed, slots, casting, roleplayLines, customSkillsDetailed } = d;
  const abBox = ab => `
    <div class="ab-box">
      <div class="n">${ABILITY_NAMES[ab]}</div>
      <div class="m">${totals[ab]}</div>
      <div class="s">${fmtMod(mods[ab])}</div>
    </div>`;
  const saveRow = row => `<div class="save-row ${row.prof?'prof':''}"><span>${row.prof?'●':'○'} ${ABILITY_NAMES[row.ab]}</span><b>${fmtMod(row.value)}</b></div>`;
  const skillRow = row => `<div class="skill-row ${row.prof?'prof':''}"><span>${row.exp?'◆':(row.prof?'●':'○')} ${row.name}</span><b>${fmtMod(row.value)}</b></div>`;
  const featRow = f => {
    const uses = f.uses === "pb" ? pb : (f.uses || 0);
    const tags = [KIND_LABEL[f.kind], uses ? `${uses} раз(а)${f.rest ? ", восстанавл.: " + f.rest : ""}` : (f.rest ? "восстанавл.: " + f.rest : "")].filter(Boolean).join(" · ");
    return `<div class="sf-row"><div class="sf-head"><b>${f.name}</b>${tags ? `<span class="sf-tag">${tags}</span>` : ""}${sheetCircles(uses)}</div><div class="sf-text">${f.text}</div></div>`;
  };
  const spellCard = (sp, opts) => {
    const isCantrip = sp.level === 0;
    const col = SCHOOL_COLOR[sp.school] || ["#7a6230","#2a2010"];
    const icon = SPELL_ICON[sp.id] || SCHOOL_GLYPH[sp.school] || "✨";
    const circles = opts.circles != null ? opts.circles : (isCantrip ? 0 : slots);
    const meta = opts.meta || ((isCantrip ? "заговор · неограниченно" : `${sp.level}-й круг · тратит ячейку`) + (sp.fromSub ? ` · ${sp.fromSub}: всегда подготовлено` : ""));
    return `
    <div class="sheet-spell-card" data-spell-id="${sp.id || ""}">
      <div class="sheet-spell-icon" style="background:linear-gradient(160deg,${col[0]},${col[1]});">${icon}</div>
      <div class="sheet-spell-info">
        <div class="sheet-spell-top"><span class="sheet-spell-name">${sp.name}</span>${circles ? sheetCircles(circles) : (isCantrip ? `<span class="sheet-spell-charge infinite">∞</span>` : "")}</div>
        <span class="sheet-spell-meta">${meta}</span>
        <span class="sheet-spell-desc">${escapeHtml(sp.description || "")}</span>
      </div>
    </div>`;
  };
  const speedTxt = [`${speeds.walk} фт`, speeds.climb ? `лазание ${speeds.climb}` : "", speeds.swim ? `плавание ${speeds.swim}` : "", speeds.fly ? `полёт ${speeds.fly}` : ""].filter(Boolean).join(", ");
  const list = arr => arr.length ? arr.join(", ") : "—";
  const customSkillCard = sk => {
    const isCantrip = sk.category !== "level1";
    const circles = isCantrip ? 0 : (sk.slotCost || 1);
    const actionLabel = (window.CUSTOM_SKILL_ACTION_LABEL && window.CUSTOM_SKILL_ACTION_LABEL[sk.actionType]) || "Действие";
    const metaBits = [isCantrip ? "кастомный · фокус · неограниченно" : `кастомный · 1-й круг · тратит ${sk.slotCost||1} ячейку(и)`, actionLabel];
    if (sk.dice) metaBits.push(`урон ${sk.dice}`);
    if (sk.checkAbility && sk.checkAbility !== "none") metaBits.push(`проверка ${ABILITY_NAMES[sk.checkAbility]}${sk.dc?` Сл ${sk.dc}`:""}`);
    if (sk.range) metaBits.push(sk.range);
    if (sk.duration) metaBits.push(sk.duration);
    return `
    <div class="sheet-spell-card" data-spell-id="${sk.id}">
      <div class="sheet-spell-icon" style="background:linear-gradient(160deg,#2b8f7e,#123a3c);">🔖</div>
      <div class="sheet-spell-info">
        <div class="sheet-spell-top"><span class="sheet-spell-name">${escapeHtml(sk.name)}</span>${circles ? sheetCircles(circles) : `<span class="sheet-spell-charge infinite">∞</span>`}</div>
        <span class="sheet-spell-meta">${metaBits.join(" · ")}</span>
        <span class="sheet-spell-desc">${escapeHtml(sk.description || "")}</span>
      </div>
    </div>`;
  };
  const hasSpells = spellsDetailed.length || raceSpells.length || (customSkillsDetailed && customSkillsDetailed.length);
  return `
    <div class="sheet-head">
      <div class="sheet-photo-box${state.photoDataUrl ? " has-photo" : ""}" id="sheetPhoto" title="Нажми, чтобы ${state.photoDataUrl ? "заменить" : "добавить"} портрет">
        ${state.photoDataUrl ? `<img src="${state.photoDataUrl}" alt="Портрет">` : `<span class="sheet-photo-hint" data-html2canvas-ignore="true">🖼<br>Нажми, чтобы добавить портрет</span>`}
        ${state.photoDataUrl ? `<button type="button" class="sheet-photo-clear" id="sheetPhotoClear" title="Убрать портрет" data-html2canvas-ignore="true">✕</button>` : ""}
        <input type="file" id="sheetPhotoInput" accept="image/*" hidden>
      </div>
      <div class="sheet-head-text">
        <h2>${escapeHtml(state.name) || "Безымянный герой"}</h2>
        <div class="sub">${r?r.name:""}${s?(" ("+s.name+")"):""} · ${c?c.name:""}${state.alignment?(" · "+state.alignment):""}${(state.heightCm&&state.weightKg)?(" · "+state.heightCm+" см, "+state.weightKg+" кг"):""}</div>
      </div>
      <div class="lvlbox">Уровень 1<br>Бонус мастерства ${fmtMod(pb)}</div>
    </div>
    <div class="sheet-grid">
      <div class="abilities-col">
        ${ABILITY_ORDER.map(abBox).join("")}
        <div class="ab-box"><div class="n">Пассивная внимательность</div><div class="m">${passivePerception}</div></div>
      </div>
      <div class="mid-col">
        <div class="saves-box"><h4>Спасброски</h4>${saves.map(saveRow).join("")}</div>
        <div class="skills-box"><h4>Навыки</h4>${skills.map(skillRow).join("")}<div class="sheet-legend">● владение · ◆ компетентность (×2)</div></div>
      </div>
      <div class="right-col">
        <div class="combat-stats">
          <div class="cbox"><div class="n">Класс доспеха</div><div class="m">${ac}</div></div>
          <div class="cbox"><div class="n">Хиты</div><div class="m">${hp}</div></div>
          <div class="cbox"><div class="n">Инициатива</div><div class="m">${fmtMod(initiative)}</div></div>
          <div class="cbox"><div class="n">Скорость</div><div class="m">${speeds.walk}</div></div>
          <div class="cbox"><div class="n">Кость хитов</div><div class="m">1к${c ? c.hitDie : 8}</div></div>
          <div class="cbox"><div class="n">Спасброски от смерти</div><div class="m sf-death">✓☐☐☐<br>✗☐☐☐</div></div>
        </div>
        <div class="equip-box">
          <h4>Снаряжение</h4>
          <ul>${equip ? equip.items.map(i=>`<li><b>${i.name||i}</b>${i.info?` <span class="eq-info">(${i.info})</span>`:""}</li>`).join("") : "<li>—</li>"}</ul>
        </div>
        <div class="equip-box">
          <h4>Владения и языки</h4>
          <div class="prof-line"><b>Доспехи:</b> ${list(armorProf)}</div>
          <div class="prof-line"><b>Оружие:</b> ${list(weaponProf)}</div>
          <div class="prof-line"><b>Инструменты:</b> ${list(toolProf)}</div>
          <div class="prof-line"><b>Языки:</b> ${list(languages)}</div>
          <div class="prof-line"><b>Скорость:</b> ${speedTxt}</div>
          ${resist.length ? `<div class="prof-line"><b>Сопротивление:</b> ${resist.join(", ")}</div>` : ""}
          ${immune.length ? `<div class="prof-line"><b>Иммунитет:</b> ${immune.join(", ")}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="traits-box sheet-attacks" style="margin-top:14px;">
      <h4>Атаки</h4>
      <table class="atk-table"><thead><tr><th>Оружие</th><th>Попадание</th><th>Урон</th><th>Примечания</th></tr></thead>
      <tbody>${attacks.map(a => `<tr><td>${a.name}</td><td>${a.hit}</td><td>${a.dmg}</td><td>${a.notes || ""}</td></tr>`).join("")}</tbody></table>
    </div>
    ${hasSpells ? `<div class="spells-box spells-box-bottom" style="margin-top:14px;">
      <h4>${(spellsDetailed.length || raceSpells.length) ? "Заклинания" : "Навыки"}</h4>
      ${casting ? `<div class="spell-casting-line">${casting.text} <b>Сл спасброска ${casting.dc}</b> · <b>атака заклинанием ${fmtMod(casting.atk)}</b>${slots ? ` · ячейки 1-го круга: ${sheetCircles(slots)}` : ""}</div>` : ""}
      <div class="spells-row">${spellsDetailed.map(sp => spellCard(sp, {})).join("")}</div>
      ${raceSpells.length ? `<div class="spell-casting-line">Врождённая магия расы — без ячеек:</div>
        <div class="spells-row">${raceSpells.map(sp => spellCard(sp, { circles: sp.circles, meta: `${sp.note} · ${sp.uses} · ${ABILITY_NAMES[sp.ability]}: Сл ${sp.dc}, атака ${fmtMod(sp.atk)}` })).join("")}</div>` : ""}
      ${(customSkillsDetailed && customSkillsDetailed.length) ? `<div class="spell-casting-line">Кастомные навыки из твоей библиотеки:</div>
        <div class="spells-row">${customSkillsDetailed.map(customSkillCard).join("")}</div>` : ""}
    </div>` : ""}
    <div class="sheet-features">
      <div class="traits-box"><h4>Умения класса${c ? ": " + c.name : ""}</h4>${classFeatures.map(featRow).join("") || "—"}</div>
      <div class="traits-box"><h4>Особенности расы${r ? ": " + (s ? s.name : r.name) : ""}</h4>${raceTraits.map(featRow).join("") || "—"}</div>
    </div>
    ${laterFeatures.length ? `<div class="notes-box" style="margin-top:12px;"><h4>Откроется на следующих уровнях</h4><ul>${laterFeatures.sort((a,b)=>a.minLevel-b.minLevel).map(t=>`<li><b>${t.minLevel}-й уровень — ${t.name}.</b> ${t.text}</li>`).join("")}</ul></div>` : ""}
    ${roleplayLines && roleplayLines.length ? `<div class="notes-box" style="margin-top:12px;"><h4>Отыгрыш</h4><ul>${roleplayLines.map(l=>`<li>${l}</li>`).join("")}</ul></div>` : ""}
    ${state.background ? `<div class="notes-box" style="margin-top:12px;"><h4>Предыстория</h4><div>${escapeHtml(state.background)}</div></div>` : ""}
    <div class="sheet-footer"><span>Кузня Героев — редактор персонажей D&amp;D 5e</span><span>SRD (Open Game License)</span></div>
  `;
}

/* ===== Экспорт в PDF формата A4 альбомная (лицо + оборот) =====
   Лицо: имя, портрет, предыстория. Оборот: спасброски/навыки сверху,
   шесть характеристик горизонтально посередине, заклинания (с ячейками
   и правилом их восстановления) и снаряжение снизу. */
const ABILITY_ABBR = { str:"Сила", dex:"Ловкость", con:"Телосложение", int:"Интеллект", wis:"Мудрость", cha:"Харизма" };

function a4FrontHTML(d){
  const { r, s, c } = d;
  const sub = c ? getSubclass(c.id, state.classChoices || {}) : null;
  const name = escapeHtml(state.name) || "Безымянный герой";
  const subtitleParts = [r ? (s ? s.name : r.name) : "", c ? c.name + (sub ? ` (${sub.name})` : "") : ""].filter(Boolean);
  // Фото персонажа почти всегда приходит со светлым/белым фоном (обычное
  // селфи или студийное фото) — mix-blend-mode:multiply растворяет его в
  // цвете пергамента вместо режущего белого прямоугольника. Если фото не
  // приложено на первой странице редактора, НЕ подставляем картинку расы
  // (это другой персонаж/другое фото) — пишем честно текстом "Нет фото".
  let portraitHTML = `<span class="a4-ph-glyph a4-no-photo">Нет фото</span>`;
  if (state.photoDataUrl){
    portraitHTML = `<img class="a4-on-parchment" src="${state.photoDataUrl}" alt="Портрет">`;
  }
  const bg = state.background ? escapeHtml(state.background).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,"<br>")}</p>`).join("") : "<p><i>Предыстория не заполнена.</i></p>";
  const tags = [
    r ? `Раса: ${s ? s.name : r.name}` : null,
    c ? `Класс: ${c.name}` : null,
    sub ? `Путь: ${sub.name}` : null,
    state.alignment ? `Мировоззрение: ${state.alignment}` : null
  ].filter(Boolean);
  return `
    <div class="a4-card">
      <div class="a4-name-bar">
        <span class="a4-crest">⚒</span>
        <h1>${name}</h1>
        <div class="a4-subtitle">${subtitleParts.join(" · ") || "Герой без пути"}</div>
        <span class="a4-crest a4-right">⚒</span>
      </div>
      <div class="a4-body-row">
        <div class="a4-portrait-box">${portraitHTML}</div>
        <div class="a4-lore-box">
          <h2>Предыстория</h2>
          ${bg}
          <div class="a4-tags">${tags.map(t => `<span class="a4-tag">${escapeHtml(t)}</span>`).join("")}</div>
        </div>
      </div>
    </div>`;
}

function a4BackHTML(d){
  const { c, totals, mods, saves, skills, spellsDetailed, slots, equip, attacks, casting, customSkillsDetailed } = d;
  const saveRow = row => `<tr class="${row.prof ? "a4-prof" : ""}"><td class="a4-mod">${fmtMod(row.value)}</td><td class="a4-name">${row.prof ? '<span class="a4-prof-dot"></span>' : ""}${ABILITY_ABBR[row.ab]}</td></tr>`;
  const skillRow = row => `<tr class="${row.prof ? "a4-prof" : ""}"><td class="a4-mod">${fmtMod(row.value)}</td><td class="a4-name">${row.prof ? '<span class="a4-prof-dot"></span>' : ""}${row.name} (${ABILITY_ABBR[row.ab].slice(0,3)})</td></tr>`;
  const half = Math.ceil(skills.length / 2);
  const skillsCol1 = skills.slice(0, half), skillsCol2 = skills.slice(half);
  const statBox = ab => `<div class="a4-stat-box"><div class="a4-label">${ABILITY_ABBR[ab]}</div><div class="a4-score">${totals[ab]}</div><div class="a4-mod">${fmtMod(mods[ab])}</div></div>`;

  const cantrips = spellsDetailed.filter(sp => sp.level === 0);
  const leveled = spellsDetailed.filter(sp => sp.level > 0);
  const spellLine = (sp, circ) => `<li><span>${sp.name}</span>${circ ? `<span class="a4-circ">${"☐".repeat(circ)}</span>` : `<span class="a4-circ">∞</span>`}</li>`;
  const isWarlock = c && c.id === "warlock";
  const slotsRule = slots
    ? (isWarlock
        ? `Ячейки (${slots} шт., 1-й круг): отмечай ☐, когда тратишь заклинание. Все ячейки чернокнижника восстанавливаются после КОРОТКОГО отдыха (1 час) — не нужно ждать ночи.`
        : `Ячейки (${slots} шт., 1-й круг): отмечай ☐, когда тратишь заклинание. Восстанавливаются после ДЛИТЕЛЬНОГО отдыха (8 часов).`)
    : "";

  // Пояснение игровых механик простым языком с конкретными числами
  // ЭТОГО персонажа — чтобы за столом не лезть за калькулятором.
  const atkLines = (attacks || []).map(a =>
    `<li><span><b>${escapeHtml(a.name)}</b> — бросок к20${a.hit}</span><span class="a4-circ">урон ${escapeHtml(a.dmg)}</span></li>`
  ).join("");
  const castLine = casting
    ? `<li><span>Атака заклинанием — бросок к20${fmtMod(casting.atk)}</span><span class="a4-circ">спасбросок цели: Сл ${casting.dc}</span></li>`
    : "";
  const mechanicsBox = (atkLines || castLine) ? `
    <div class="a4-box a4-mechanics">
      <h2>Как бросать кости</h2>
      <p class="a4-mech-rule">Атака = бросок к20 + бонус из строки ниже. Результат ≥ КД цели — попадание, тогда бросаешь указанный урон. Если враг спасается от заклинания — его бросок к20 должен быть ≥ «Сл», иначе эффект сработал.</p>
      <ul class="a4-spell-list">${atkLines}${castLine}</ul>
    </div>` : "";

  return `
    <div class="a4-card">
      <div class="a4-name-bar">
        <h1>${escapeHtml(state.name) || "Безымянный герой"}</h1>
        <div class="a4-subtitle">Оборотная сторона · характеристики, заклинания и снаряжение</div>
      </div>
      <div class="a4-row-top">
        <div class="a4-box">
          <h2>Спасброски</h2>
          <table class="a4-rows">${saves.map(saveRow).join("")}</table>
        </div>
        <div class="a4-box">
          <h2>Навыки</h2>
          <div class="a4-skills-cols">
            <table class="a4-rows">${skillsCol1.map(skillRow).join("")}</table>
            <table class="a4-rows">${skillsCol2.map(skillRow).join("")}</table>
          </div>
        </div>
      </div>
      <div class="a4-row-mid">${ABILITY_ORDER.map(statBox).join("")}</div>
      ${mechanicsBox}
      <div class="a4-row-bottom">
        <div class="a4-box">
          <h2>${(cantrips.length || leveled.length) ? "Заклинания" : "Навыки"}</h2>
          ${cantrips.length ? `<div class="a4-spell-level"><div class="a4-lvl-title">Заговоры</div><ul class="a4-spell-list">${cantrips.map(sp => spellLine(sp, 0)).join("")}</ul></div>` : ""}
          ${leveled.length ? `<div class="a4-spell-level"><div class="a4-lvl-title">1 круг</div><ul class="a4-spell-list">${leveled.map(sp => spellLine(sp, slots)).join("")}</ul></div>` : ""}
          ${(customSkillsDetailed && customSkillsDetailed.length) ? `<div class="a4-spell-level"><div class="a4-lvl-title">Кастомные</div><ul class="a4-spell-list">${customSkillsDetailed.map(sk => `<li><span>${escapeHtml(sk.name)}${sk.dice ? ` (${escapeHtml(sk.dice)})` : ""}</span>${sk.category === "level1" ? `<span class="a4-circ">${"☐".repeat(sk.slotCost||1)}</span>` : `<span class="a4-circ">∞</span>`}</li>`).join("")}</ul></div>` : ""}
          ${!cantrips.length && !leveled.length && !(customSkillsDetailed && customSkillsDetailed.length) ? `<p style="font-size:12px;color:#6a5436;"><i>Эта классовая комбинация не использует заклинания.</i></p>` : ""}
          ${slotsRule ? `<div class="a4-slots-rule">${slotsRule}</div>` : ""}
        </div>
        <div class="a4-box">
          <h2>Снаряжение</h2>
          <ul class="a4-equip-list">${equip ? equip.items.map(i => `<li><b>${i.name || i}</b>${i.info ? ` <span style="color:#6a5436;">(${i.info})</span>` : ""}</li>`).join("") : "<li>—</li>"}</ul>
        </div>
      </div>
    </div>`;
}

async function exportPDFA4(){
  toast("Готовим PDF A4 (лицо + оборот)…");
  const d = computeFinal();
  let root = document.getElementById("a4ExportRoot");
  if (!root){ root = document.createElement("div"); root.id = "a4ExportRoot"; document.body.appendChild(root); }
  root.innerHTML = `
    <div class="a4-page" id="a4PageFront">${a4FrontHTML(d)}</div>
    <div class="a4-page" id="a4PageBack">${a4BackHTML(d)}</div>
  `;
  try{
    // ждём загрузки портретной картинки (если есть), иначе html2canvas может её не захватить
    const img = root.querySelector("#a4PageFront img");
    if (img && !img.complete){
      await new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 1500); });
    }
    await new Promise(r => setTimeout(r, 60));

    const frontCanvas = await html2canvas(root.querySelector("#a4PageFront"), { scale: 2, backgroundColor: "#ecdcbf" });
    const backCanvas = await html2canvas(root.querySelector("#a4PageBack"), { scale: 2, backgroundColor: "#ecdcbf" });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(frontCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
    pdf.addPage("a4", "landscape");
    pdf.addImage(backCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);

    const fname = (state.name || "personazh").replace(/[^a-zA-Zа-яА-Я0-9_-]+/g,"_") + "_dnd5e_A4.pdf";
    const blob = pdf.output("blob");
    const file = new File([blob], fname, { type: "application/pdf" });
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 760;
    let shared = false;
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })){
      try{ await navigator.share({ files: [file], title: fname }); shared = true; }
      catch(shareErr){ if (shareErr && shareErr.name === "AbortError") shared = true; }
    }
    if (!shared){
      const url = URL.createObjectURL(blob);
      if (isMobile){
        window.open(url, "_blank");
        toast("PDF открыт — сохрани или поделись через меню просмотрщика");
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
        toast("PDF (A4, лицо + оборот) сохранён");
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch(err){
    console.error(err);
    toast("Не удалось собрать PDF A4 — попробуй ещё раз");
  } finally {
    root.innerHTML = "";
  }
}

async function exportPDF(){
  // Старая кнопка PDF удалена из интерфейса (оставлена только A4-версия
  // exportPDFA4) — функция не вызывается, код сохранён на случай, если
  // понадобится откатить решение.
}

/* ---------------- Validation / Navigation ---------------- */
function validateStep(stepId){
  switch(stepId){
    case "intro": return state.name.trim().length > 0 || "Введи имя персонажа";
    case "race": return !!state.raceId || "Выбери расу";
    case "subrace": return !!state.subraceId || "Выбери подрасу";
    case "class": return !!state.classId || "Выбери класс";
    case "subclass": return subclassChoicesDone();
    case "abilities": {
      const allAssigned = ABILITY_ORDER.every(ab => state.abilityAssign[ab] != null);
      return allAssigned || "Распредели все шесть значений характеристик";
    }
    case "flexbonus": {
      const flex = flexBonusRemainingText();
      if (!flex) return true;
      return flex.done || "Распредели гибкий расовый бонус между характеристиками";
    }
    case "racechoice": return raceChoicesDone();
    case "classchoice": return classChoicesDone();
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
      const c = getClass();
      if ((state.customSkills||[]).length > 0) return true; // есть кастомный навык — пропускаем проверку количества
      if (!c || !c.spellcasting || !CASTER_RULES[c.id]) return true; // не заклинатель — шаг необязателен, если не взял кастомный
      const r = CASTER_RULES[c.id];
      const abMod = abilityMod(getTotalAbility(r.ability));
      const need = r.cantrips + casterKnownCount(c.id, abMod);
      return state.spells.length >= need || "Выбери все доступные заклинания и кантрипы, или добавь хотя бы один кастомный навык";
    }
    default: return true;
  }
}
const CYR_LETTER = { A:"А", B:"Б", C:"В", D:"Г" };
function updateNextEnabled(){
  const btn = document.getElementById("btnNext");
  if (!btn) return;
  const v = validateStep(state.step);
  const locked = v !== true;
  // кнопка не «мёртвая»: при нажатии покажет, чего не хватает, а подсказка видна сразу
  btn.disabled = false;
  btn.classList.toggle("is-locked", locked);
  btn.setAttribute("aria-disabled", locked ? "true" : "false");
  const cap = document.getElementById("stepCaption");
  if (cap && STEP_META[state.step]){
    cap.textContent = locked && typeof v === "string" ? "⚠ " + v : STEP_META[state.step].caption;
    cap.classList.toggle("warn", locked && typeof v === "string");
  }
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
