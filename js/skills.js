/* ============================================================
   «Библиотека навыков» — конструктор кастомных скиллов.
   Отдельный самостоятельный экран (как «Кузня Зла»): список своих
   придуманных способностей с описанием, уроном (выпадающий список
   костей) и требуемой проверкой характеристики. Хранится в
   localStorage — библиотека копится от сессии к сессии, отдельно
   от любого конкретного персонажа.
   ============================================================ */
(function(){
  const STORE_KEY = "customSkillsLibrary";
  const DICE_OPTIONS = ["", "1к4","1к6","1к8","1к10","1к12","2к4","2к6","2к8","2к10","2к12","3к6","3к8","4к6","4к8","6к6"];
  const esc = s => String(s||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const uid = () => "sk_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  let lib = [];
  try { lib = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch(e){ lib = []; }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(lib)); } catch(e){} };

  const st = { q:"", editingId:null, formOpen:false };

  const root = document.createElement("section");
  root.id = "skillsScreen"; root.className = "skills-screen"; root.hidden = true;
  root.setAttribute("aria-label", "Библиотека навыков — конструктор кастомных скиллов");
  root.innerHTML = `
    <div class="sk-inner">
      <header class="sk-top">
        <button type="button" class="btn btn-ghost sk-back" id="skillsBack">← К Кузне Героев</button>
        <div class="sk-brand"><span class="sk-icon" aria-hidden="true">📘</span><h1>Библиотека навыков</h1></div>
        <p class="sk-sub">Твои собственные способности: описание, урон и проверка характеристики. Копится здесь навсегда — используй в любом персонаже.</p>
      </header>
      <div class="sk-toolbar">
        <input type="search" id="skQ" class="sk-search" placeholder="Поиск по названию или описанию…">
        <button type="button" class="btn btn-gold" id="skNew">+ Новый навык</button>
      </div>
      <div class="sk-form-wrap" id="skFormWrap" hidden></div>
      <div class="sk-list" id="skList"></div>
    </div>`;
  document.body.appendChild(root);
  const listEl = root.querySelector("#skList");
  const formWrap = root.querySelector("#skFormWrap");
  const qInput = root.querySelector("#skQ");

  const ABILITY_SELECT_OPTIONS = [["none","Без проверки"]].concat(ABILITY_ORDER.map(ab => [ab, ABILITY_NAMES[ab]]));
  const CATEGORY_OPTIONS = [["cantrip","Фокус — без ограничений по применению"],["level1","1-й круг — тратит ячейку заклинания"]];
  const ACTION_OPTIONS = [["action","Действие"],["bonus","Бонусное действие"],["reaction","Реакция"],["free","Без действия (пассивный эффект)"]];
  const ACTION_LABEL = Object.fromEntries(ACTION_OPTIONS);
  window.CUSTOM_SKILL_ACTION_LABEL = ACTION_LABEL;
  window.CUSTOM_SKILL_CATEGORY_LABEL = { cantrip:"Фокус", level1:"1-й круг" };

  function diceOptionsHtml(sel){
    return DICE_OPTIONS.map(d => `<option value="${d}" ${sel === d ? "selected" : ""}>${d ? d : "Без урона"}</option>`).join("");
  }
  function abilityOptionsHtml(sel){
    return ABILITY_SELECT_OPTIONS.map(([v,label]) => `<option value="${v}" ${sel === v ? "selected" : ""}>${label}</option>`).join("");
  }
  function categoryOptionsHtml(sel){
    return CATEGORY_OPTIONS.map(([v,label]) => `<option value="${v}" ${sel === v ? "selected" : ""}>${label}</option>`).join("");
  }
  function actionOptionsHtml(sel){
    return ACTION_OPTIONS.map(([v,label]) => `<option value="${v}" ${sel === v ? "selected" : ""}>${label}</option>`).join("");
  }

  function emptySkill(){
    return { id: uid(), name:"", description:"", dice:"", checkAbility:"none", dc:"",
      category:"cantrip", slotCost:1, actionType:"action", range:"", duration:"", createdAt: Date.now() };
  }

  function renderForm(){
    if (!st.formOpen){ formWrap.hidden = true; formWrap.innerHTML = ""; return; }
    const sk = st.editingId ? lib.find(s => s.id === st.editingId) : emptySkill();
    if (!sk){ st.formOpen = false; st.editingId = null; formWrap.hidden = true; return; }
    // старые навыки, созданные до появления этих полей — подставляем разумные значения по умолчанию
    if (sk.category === undefined) sk.category = "cantrip";
    if (sk.slotCost === undefined) sk.slotCost = 1;
    if (sk.actionType === undefined) sk.actionType = "action";
    if (sk.range === undefined) sk.range = "";
    if (sk.duration === undefined) sk.duration = "";
    formWrap.hidden = false;
    formWrap.innerHTML = `
      <form class="sk-form" id="skForm">
        <h2>${st.editingId ? "Изменить навык" : "Новый навык"}</h2>
        <label class="sk-field"><span class="sk-label">Название</span>
          <input type="text" id="skfName" maxlength="60" required placeholder="Напр. «Удар молнии»" value="${esc(sk.name)}"></label>
        <label class="sk-field"><span class="sk-label">Описание</span>
          <textarea id="skfDesc" rows="3" maxlength="600" placeholder="Что делает навык, в каких условиях применяется…">${esc(sk.description)}</textarea></label>
        <div class="sk-row">
          <label class="sk-field"><span class="sk-label">Категория</span>
            <select id="skfCategory">${categoryOptionsHtml(sk.category)}</select></label>
          <label class="sk-field" id="skfSlotWrap"><span class="sk-label">Ячеек за применение</span>
            <input type="number" id="skfSlotCost" min="1" max="4" value="${esc(sk.slotCost)}"></label>
          <label class="sk-field"><span class="sk-label">Тип действия</span>
            <select id="skfAction">${actionOptionsHtml(sk.actionType)}</select></label>
        </div>
        <div class="sk-row">
          <label class="sk-field"><span class="sk-label">Урон</span>
            <select id="skfDice">${diceOptionsHtml(sk.dice)}</select></label>
          <label class="sk-field"><span class="sk-label">Проверка характеристики</span>
            <select id="skfAbility">${abilityOptionsHtml(sk.checkAbility)}</select></label>
          <label class="sk-field"><span class="sk-label">Сл проверки (необязательно)</span>
            <input type="number" id="skfDC" min="1" max="30" placeholder="напр. 13" value="${esc(sk.dc)}"></label>
        </div>
        <div class="sk-row">
          <label class="sk-field"><span class="sk-label">Дальность (необязательно)</span>
            <input type="text" id="skfRange" maxlength="40" placeholder="Касание / 9 м / Ближний бой" value="${esc(sk.range)}"></label>
          <label class="sk-field"><span class="sk-label">Длительность (необязательно)</span>
            <input type="text" id="skfDuration" maxlength="40" placeholder="Мгновенно / 1 минута (конц.)" value="${esc(sk.duration)}"></label>
        </div>
        <div class="sk-form-actions">
          <button type="button" class="btn btn-ghost" id="skfCancel">Отмена</button>
          <button type="submit" class="btn btn-gold">${st.editingId ? "Сохранить" : "Добавить в библиотеку"}</button>
        </div>
      </form>`;
    const catSel = formWrap.querySelector("#skfCategory");
    const slotWrap = formWrap.querySelector("#skfSlotWrap");
    const syncSlotVisibility = () => { slotWrap.style.display = catSel.value === "level1" ? "" : "none"; };
    catSel.onchange = syncSlotVisibility; syncSlotVisibility();
    formWrap.querySelector("#skfName").focus();
    formWrap.querySelector("#skForm").onsubmit = e => {
      e.preventDefault();
      const name = formWrap.querySelector("#skfName").value.trim();
      if (!name) return;
      sk.name = name;
      sk.description = formWrap.querySelector("#skfDesc").value.trim();
      sk.category = catSel.value;
      sk.slotCost = Math.max(1, parseInt(formWrap.querySelector("#skfSlotCost").value, 10) || 1);
      sk.actionType = formWrap.querySelector("#skfAction").value;
      sk.dice = formWrap.querySelector("#skfDice").value;
      sk.checkAbility = formWrap.querySelector("#skfAbility").value;
      sk.dc = formWrap.querySelector("#skfDC").value.trim();
      sk.range = formWrap.querySelector("#skfRange").value.trim();
      sk.duration = formWrap.querySelector("#skfDuration").value.trim();
      if (!st.editingId) lib.unshift(sk);
      save();
      st.formOpen = false; st.editingId = null;
      renderForm(); renderList();
    };
    formWrap.querySelector("#skfCancel").onclick = () => { st.formOpen = false; st.editingId = null; renderForm(); };
  }

  function skillCard(sk){
    const checkLine = sk.checkAbility !== "none"
      ? `Проверка: <b>${ABILITY_NAMES[sk.checkAbility]}</b>${sk.dc ? ` (Сл ${esc(sk.dc)})` : ""}`
      : "Без проверки характеристики";
    const diceLine = sk.dice ? `Урон: <b>${esc(sk.dice)}</b>` : "Без урона";
    const catLine = sk.category === "level1" ? `1-й круг · ${esc(sk.slotCost||1)} ячейка(и)` : "Фокус · без ограничений";
    const actionLine = ACTION_LABEL[sk.actionType] || "Действие";
    const extraTags = [];
    if (sk.range) extraTags.push(`Дальность: <b>${esc(sk.range)}</b>`);
    if (sk.duration) extraTags.push(`Длительность: <b>${esc(sk.duration)}</b>`);
    return `
      <article class="sk-card" data-id="${sk.id}">
        <div class="sk-card-head">
          <h3>${esc(sk.name)}</h3>
          <div class="sk-card-btns">
            <button type="button" class="sk-icon-btn" data-edit="${sk.id}" title="Изменить">✎</button>
            <button type="button" class="sk-icon-btn sk-danger" data-del="${sk.id}" title="Удалить">✕</button>
          </div>
        </div>
        <div class="sk-card-meta">
          <span class="sk-tag">${catLine}</span>
          <span class="sk-tag">${actionLine}</span>
          <span class="sk-tag">${diceLine}</span>
          <span class="sk-tag">${checkLine}</span>
          ${extraTags.map(t => `<span class="sk-tag">${t}</span>`).join("")}
        </div>
        ${sk.description ? `<p class="sk-card-desc">${esc(sk.description).replace(/\n/g,"<br>")}</p>` : ""}
      </article>`;
  }

  function renderList(){
    const q = st.q.trim().toLowerCase();
    const filtered = q ? lib.filter(sk => sk.name.toLowerCase().includes(q) || sk.description.toLowerCase().includes(q)) : lib;
    if (!lib.length){
      listEl.innerHTML = `<p class="sk-empty">Библиотека пока пуста. Нажми «+ Новый навык» и начни собирать свои способности — они останутся здесь навсегда.</p>`;
      return;
    }
    if (!filtered.length){
      listEl.innerHTML = `<p class="sk-empty">Ничего не найдено по запросу «${esc(st.q)}».</p>`;
      return;
    }
    listEl.innerHTML = filtered.map(skillCard).join("");
  }

  function openSkills(){
    root.hidden = false; document.body.classList.add("skills-open");
    renderForm(); renderList(); root.scrollTop = 0;
    requestAnimationFrame(() => root.classList.add("show"));
  }
  function closeSkills(){
    root.classList.remove("show"); document.body.classList.remove("skills-open");
    setTimeout(() => { root.hidden = true; }, 400);
  }

  root.querySelector("#skillsBack").onclick = closeSkills;
  root.querySelector("#skNew").onclick = () => { st.formOpen = true; st.editingId = null; renderForm(); formWrap.scrollIntoView({ behavior:"smooth", block:"start" }); };
  qInput.oninput = () => { st.q = qInput.value; renderList(); };
  listEl.addEventListener("click", e => {
    const editId = e.target.closest("[data-edit]");
    if (editId){ st.formOpen = true; st.editingId = editId.dataset.edit; renderForm(); formWrap.scrollIntoView({ behavior:"smooth", block:"start" }); return; }
    const delId = e.target.closest("[data-del]");
    if (delId){
      const sk = lib.find(s => s.id === delId.dataset.del);
      if (sk && confirm(`Удалить навык «${sk.name}» из библиотеки?`)){
        lib = lib.filter(s => s.id !== delId.dataset.del);
        save(); renderList();
      }
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden) closeSkills(); });
  ["btnSkills", "btnSkillsTop"].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener("click", openSkills); });
  window.SkillLibrary = { open: openSkills, close: closeSkills, get: () => lib.slice() };
})();
