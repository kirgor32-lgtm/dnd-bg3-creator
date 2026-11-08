/* ============================================================
   «Кузня Зла» — генератор противников D&D 5e.
   • Официальные статблоки (EVIL_BESTIARY, js/evil-data.js — перевод dnd.su).
   • Подгонка под нужную Опасность по таблице DMG
     «Характеристики монстра по показателю опасности» (гл. 9).
   • Сборка засады под отряд по бюджету опыта DMG (гл. 3):
     пороги сложности на персонажа + множитель за число монстров.
   ============================================================ */
(function(){
  if (typeof EVIL_BESTIARY === "undefined") return;
  const B = EVIL_BESTIARY;
  const byId = Object.fromEntries(B.map(m => [m.id, m]));

  /* ---------- таблицы DMG ---------- */
  // cr, бонус мастерства, КД, хиты [от,до], бонус атаки, урон за раунд [от,до], Сл спасброска, опыт
  const T = [
    [0,2,13,[1,6],3,[0,1],13,10],[1/8,2,13,[7,35],3,[2,3],13,25],[1/4,2,13,[36,49],3,[4,5],13,50],
    [1/2,2,13,[50,70],3,[6,8],13,100],[1,2,13,[71,85],3,[9,14],13,200],[2,2,13,[86,100],3,[15,20],13,450],
    [3,2,13,[101,115],4,[21,26],13,700],[4,2,14,[116,130],5,[27,32],14,1100],[5,3,15,[131,145],6,[33,38],15,1800],
    [6,3,15,[146,160],6,[39,44],15,2300],[7,3,15,[161,175],6,[45,50],15,2900],[8,3,16,[176,190],7,[51,56],16,3900],
    [9,4,16,[191,205],7,[57,62],16,5000],[10,4,17,[206,220],7,[63,68],16,5900],[11,4,17,[221,235],8,[69,74],17,7200],
    [12,4,17,[236,250],8,[75,80],17,8400],[13,5,18,[251,265],8,[81,86],18,10000],[14,5,18,[266,280],8,[87,92],18,11500],
    [15,5,18,[281,295],8,[93,98],18,13000],[16,5,18,[296,310],9,[99,104],18,15000],[17,6,19,[311,325],10,[105,110],19,18000],
    [18,6,19,[326,340],10,[111,116],19,20000],[19,6,19,[341,355],10,[117,122],19,22000],[20,6,19,[356,400],10,[123,140],19,25000],
    [21,7,19,[401,445],11,[141,158],20,33000],[22,7,19,[446,490],11,[159,176],20,41000],[23,7,19,[491,535],11,[177,194],20,50000],
    [24,7,19,[536,580],12,[195,212],21,62000]
  ].map(r => ({ cr:r[0], pb:r[1], ac:r[2], hp:r[3], atk:r[4], dmg:r[5], dc:r[6], xp:r[7] }));
  const rowIdx = cr => T.findIndex(r => Math.abs(r.cr - cr) < 1e-6);
  const row = cr => T[rowIdx(cr)];
  // пороги опыта на одного персонажа: лёгкая, средняя, сложная, смертельная
  const THR = [null,[25,50,75,100],[50,100,150,200],[75,150,225,400],[125,250,375,500],[250,500,750,1100],
    [300,600,900,1400],[350,750,1100,1700],[450,900,1400,2100],[550,1100,1600,2400],[600,1200,1900,2800],
    [800,1600,2400,3600],[1000,2000,3000,4500],[1100,2200,3400,5100],[1250,2500,3800,5700],[1400,2800,4300,6400],
    [1600,3200,4800,7200],[2000,3900,5900,8800],[2100,4200,6300,9500],[2400,4900,7300,10900],[2800,5700,8500,12700]];
  const DIFF = ["Лёгкая","Средняя","Сложная","Смертельная"];
  const MULT_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  function multiplier(count, party){
    let s = count <= 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
    if (party < 3) s += 1; else if (party >= 6) s -= 1;
    return MULT_STEPS[Math.max(0, Math.min(MULT_STEPS.length - 1, s))];
  }

  /* ---------- утилиты ---------- */
  const crLabel = cr => cr === 1/8 ? "1/8" : cr === 1/4 ? "1/4" : cr === 1/2 ? "1/2" : String(cr);
  const mod = s => Math.floor((s - 10) / 2);
  const sg = n => (n >= 0 ? "+" : "−") + Math.abs(n);
  const fmtNum = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const roll = (n, d) => { let t = 0; for (let i = 0; i < n; i++) t += 1 + rnd(d); return t; };
  const ABBR = ["Сил","Лов","Тел","Инт","Мдр","Хар"];
  const ABIL_FULL = ["Сила","Ловкость","Телосложение","Интеллект","Мудрость","Харизма"];
  const SKILL_AB = { "Акробатика":1,"Анализ":3,"Атлетика":0,"Восприятие":4,"Выживание":4,"Выступление":5,"Запугивание":5,
    "История":3,"Ловкость рук":1,"Магия":3,"Медицина":4,"Обман":5,"Природа":3,"Проницательность":4,"Религия":3,
    "Скрытность":1,"Убеждение":5,"Уход за животными":4 };
  const GROUPS = [
    { id:"vampire",  name:"Вампиры",          icon:"🦇" },
    { id:"undead",   name:"Нежить",           icon:"💀" },
    { id:"fiend",    name:"Исчадия",          icon:"😈" },
    { id:"humanoid", name:"Злодеи-гуманоиды", icon:"🗡️" },
    { id:"beast",    name:"Твари ночи",       icon:"🐺" },
  ];
  const THEMES = [
    { id:"vampire", name:"Логово вампира", icon:"🦇", lead:"vampire",
      ids:[...B.filter(m => m.group === "vampire").map(m => m.id), "swarm-of-bats","swarm-of-rats","wolf","dire-wolf","strahd-zombie","crawling-claw"] },
    { id:"crypt", name:"Склеп и кладбище", icon:"⚰️",
      ids:["zombie","skeleton","ghoul","ghast","crawling-claw","wight","mummy","mummy-lord","warhorse-skeleton","minotaur-skeleton","ogre-zombie","skeletal-knight","barrowghast","cairnwight","swarm-of-rats","shadow","specter","ghost","strahd-zombie"] },
    { id:"cult", name:"Культ некроманта", icon:"🕯️",
      ids:["cultist","cult-fanatic","necromancer-wizard","deathlock","skeleton","zombie","ogre-zombie","flameskull","skull-lord","lich","demilich","beholder-zombie","crawling-claw","ghoul"] },
    { id:"haunt", name:"Проклятые руины", icon:"👻",
      ids:["ghost","poltergeist","banshee","specter","will-o-wisp","allip","shadow","shadowghast","wraith","dullahan","boneclaw","bodak","nightwalker"] },
    { id:"war", name:"Павшая армия", icon:"⚔️",
      ids:["sword-wraith-warrior","sword-wraith-commander","death-knight","skeletal-knight","warhorse-skeleton","skeleton","wight","minotaur-skeleton","zombie"] },
    { id:"hell", name:"Адская свита", icon:"🔥",
      ids:["imp","quasit","hell-hound","night-hag","cultist","cult-fanatic","bodak"] },
    { id:"hunt", name:"Ночная охота", icon:"🌕",
      ids:["werewolf","wolf","dire-wolf","gnoll-vampire","swarm-of-bats","goblin","bugbear","orc","bandit-captain"] },
    { id:"all", name:"Любое зло", icon:"☠", ids:B.map(m => m.id) },
  ];

  /* ---------- имена и колорит (вымышленные таблицы для мастера) ---------- */
  const FLAVOR = {
    vampire:{
      titles:["Граф","Графиня","Барон","Баронесса","Лорд","Леди","Князь","Маркиза","Мастер","Сестра"],
      names:["Валериан","Изольда","Касимир","Морвен","Серафина","Драгомир","Лукреция","Октавиан","Ровена","Себастьян","Мирослава","Эзриэль","Вальпурга","Теодор"],
      tails:["фон Мортенхальт","из Чёрного Шпиля","Бледная Роза","Полуночный","Алая Вдова","Тот-Кто-Не-Отражается","де Гравель","Пьющий Рассвет","Шёпот Колокольни"],
      marks:["в зеркалах не отражается даже его тень","пахнет ладаном и старой медью","на пальцах кольца с гербами угасших домов","говорит тихо и никогда не моргает","носит траур по самому себе","глаза вспыхивают красным, когда он голоден"],
      wants:["вернуть утраченную любовь — любой ценой","сделать город своим охотничьим угодьем","найти того, кто обратил его, и отомстить","получить приглашение в дом героев","выведать, кто украл его гроб с родной землёй","обратить достойного наследника"],
      secrets:["его гроб спрятан под алтарём заброшенной часовни","боится мелодии, под которую когда-то умер","служит ещё более древнему вампиру","в полнолуние теряет власть над очарованными"] },
    undead:{
      names:["Эдгар","Мора","Улрик","Агата","Сайлас","Гизела","Корвин","Хельга","Бертран","Ильва","Освальд","Ноэми"],
      tails:["Безглазый","Вечно Голодный","из Склепа Семи Свечей","Костяной Страж","Шепчущая","Плакальщица","Последний из Гарнизона","Стылая Рука","Без Имени","Сторож Тихого Кургана"],
      places:["Северного склепа","старого погоста","затопленной крипты","чумного рва","курганов Ольхового Дола","разорённой часовни","мёртвой деревни Ветрянка"],
      marks:["за ним тянется запах сырой земли","кости скрипят в такт шагам","свечи гаснут, когда он рядом","на шее обрывок висельной верёвки","бормочет имена давно умерших","от него веет могильным холодом"],
      wants:["стеречь то, что ему приказали стеречь при жизни","утащить живых в свою могилу","закончить незавершённое дело","найти тело, которое у него украли","служить хозяину-некроманту","мстить потомкам обидчика"],
      secrets:["его можно упокоить, вернув украденный перстень","подчиняется тому, кто держит его череп","боится звона храмового колокола","не может пересечь соляную черту"] },
    fiend:{
      names:["Азраэль","Мальфас","Ксериз","Вельмора","Скрибз","Нахаш","Таммуз","Лилит-Сажа"],
      tails:["Сделочник","Пепельный Язык","из Девятого Круга","Улыбка-Без-Губ","Хранитель Контракта","Шептун Ям"],
      marks:["пахнет серой и жжёным сахаром","тень у него рогатая","следы прожигают доски пола","смеётся чужими голосами"],
      wants:["заключить сделку на чью-то душу","открыть врата для хозяина","посеять раздор в отряде","вернуть сбежавшего должника"],
      secrets:["связан истинным именем, записанным в старом гримуаре","не может нарушить букву договора","боится освящённого серебра"] },
    humanoid:{
      names:["Мартин","Вера","Гаррет","Ольга","Лукас","Ядвига","Бран","Сабина","Грох","Шнырь","Кривозуб"],
      tails:["Чёрная Свеча","Резник","Пепельный Пророк","Крысолов","Сломанный Нос","Голос Мёртвых","Длинный Нож"],
      marks:["на ладони выжжен знак культа","носит ожерелье из фаланг пальцев","прячет лицо под капюшоном","говорит цитатами из запретной книги"],
      wants:["пробудить своего тёмного владыку","собрать дань с деревни","добыть череп святого для ритуала","выслужиться перед некромантом"],
      secrets:["сам боится своего хозяина и готов предать","знает тайный ход в склеп","должен кому-то огромную сумму"] },
    beast:{
      names:["Серый","Клык","Тень","Вой","Седой","Рваное Ухо"],
      tails:["Вожак стаи","Гончая графа","Из Чёрной Чащи","Ночной Загонщик"],
      marks:["глаза светятся красным","шерсть свалялась от засохшей крови","молчит, пока не прыгнет"],
      wants:["загнать добычу к хозяину","защитить логово","утолить неестественный голод"],
      secrets:["служит вампиру, который слышит его глазами","боится огня больше обычного зверя"] },
  };
  function flavorFor(m){
    const F = FLAVOR[m.group] || FLAVOR.undead;
    const unique = m.cr >= 2 || m.group === "vampire" || m.group === "fiend";
    let title;
    if (m.group === "vampire" && m.cr >= 5) title = `${pick(F.titles)} ${pick(F.names)} ${pick(F.tails)}`;
    else if (unique) title = `${pick(F.names)} ${pick(F.tails)}`;
    else if (m.group === "undead") title = `${m.name} ${pick(F.places)}`;
    else title = `${pick(F.names)} ${pick(F.tails)}`;
    return { title, mark:pick(F.marks), want:pick(F.wants), secret:pick(F.secrets) };
  }

  /* ---------- подгонка под Опасность (DMG) ---------- */
  const mid = a => Math.max(1, (a[0] + a[1]) / 2);
  const hpFromDice = (n, d, con) => Math.max(1, Math.floor(n * (d + 1) / 2) + n * con);
  const diceStr = (n, d, b) => `${n}к${d}` + (b ? ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}` : "");
  const mk = (txt, changed) => changed ? `<mark class="ev-chg">${txt}</mark>` : txt;

  function build(base, targetCR){
    const m = JSON.parse(JSON.stringify(base));
    m.baseId = base.id; m.baseName = base.name; m.baseCR = base.cr;
    const same = targetCR == null || Math.abs(targetCR - base.cr) < 1e-6;
    m.official = same;
    m.mods = [];
    if (same){ m.hpText = `${m.hp} (${diceStr(m.hd[0], m.hd[1], m.hd[2])})`; return m; }
    const a = row(base.cr), b = row(targetCR), dIdx = rowIdx(targetCR) - rowIdx(base.cr);
    // характеристики: заметные (12+) растут/падают на ⅓ шага таблицы
    const shift = clamp(Math.round(dIdx / 3), -4, 6);
    const oldMods = base.abil.map(mod);
    m.abil = base.abil.map(s => s >= 12 ? clamp(s + shift, 1, 30) : s);
    const dMod = m.abil.map((s, i) => mod(s) - oldMods[i]);
    const dPB = b.pb - base.pb;
    m.cr = b.cr; m.crText = crLabel(b.cr); m.xp = b.xp; m.pb = b.pb;
    // КД
    const dAC = b.ac - a.ac;
    m.ac = clamp(base.ac + dAC, 5, 25);
    m.acText = m.acText.replace(/^\d+/, mk(m.ac, dAC !== 0));
    // хиты: та же «живучесть» относительно таблицы, пересчёт костей хитов
    const [n0, die] = base.hd, con = mod(m.abil[2]);
    const want = base.hp * mid(b.hp) / mid(a.hp);
    const per = (die + 1) / 2 + con;
    const n = Math.max(1, Math.round(want / (per > 0.5 ? per : (die + 1) / 2)));
    m.hd = [n, die, n * con];
    m.hp = hpFromDice(n, die, con);
    m.hpText = `${mk(m.hp, true)} (${mk(diceStr(n, die, n * con), true)})`;
    // спасброски и навыки
    const P = m.props;
    if (P["Спасброски"]) P["Спасброски"] = P["Спасброски"].replace(/(Сил|Лов|Тел|Инт|Мдр|Хар) \+?(−?-?\d+)/g, (s, ab, v) => {
      const i = ABBR.indexOf(ab); const nv = parseInt(v.replace("−","-")) + dPB + dMod[i];
      return `${ab} ${mk(sg(nv), true)}`;
    });
    let percep = null;
    if (P["Навыки"]) P["Навыки"] = P["Навыки"].replace(/([А-ЯЁа-яё ]+?) \+?(−?-?\d+)/g, (s, sk, v) => {
      const name = sk.trim(), i = SKILL_AB[name]; if (i == null) return s;
      const nv = parseInt(v.replace("−","-")) + dPB + dMod[i];
      if (name === "Восприятие") percep = nv;
      return `${s.match(/^\s*/)[0]}${name} ${mk(sg(nv), true)}`;
    });
    if (P["Чувства"]) P["Чувства"] = P["Чувства"].replace(/пассивное Восприятие (\d+)/, (s, v) => {
      const nv = percep != null ? 10 + percep : parseInt(v) + dMod[4];
      return `пассивное Восприятие ${mk(nv, nv !== parseInt(v))}`;
    });
    // текст действий: бонус атаки, Сл, урон
    const dAtk = b.atk - a.atk, dDC = b.dc - a.dc, f = mid(b.dmg) / mid(a.dmg);
    m.sections = m.sections.map(([title, html]) => [title, html
      .replace(/\+(\d+) к попаданию/g, (s, v) => `${mk("+" + Math.max(0, +v + dAtk), dAtk !== 0)} к попаданию`)
      .replace(/Сл((?:\s[а-яё]+){0,4})\s(\d+)(?!\s*[+−])/g, (s, w, v) => `Сл${w} ${mk(clamp(+v + dDC, 8, 30), dDC !== 0)}`)
      .replace(/(\d+) \((\d+)к(\d+)(?:\s*([+−-])\s*(\d+))?\)/g, (s, avg, nd, d, op, bon) => {
        d = +d; let bonus = bon ? (op === "+" ? +bon : -bon) : 0;
        // бонус к урону = модификатор характеристики → следуем за её изменением
        if (bonus){ const i = [0, 1, 2, 3, 4, 5].find(k => oldMods[k] === bonus); if (i != null) bonus = mod(m.abil[i]); }
        const dieAvg = (d + 1) / 2;
        const nn = Math.max(1, Math.round((+avg * f - bonus) / dieAvg));
        const na = Math.max(1, Math.floor(nn * dieAvg) + bonus);
        return mk(`${na} (${diceStr(nn, d, bonus)})`, na !== +avg);
      })]);
    m.mods.push(`КД ${sg(dAC)}`, `атака ${sg(dAtk)}`, `Сл ${sg(dDC)}`, `урон ×${f.toFixed(2)}`, `хиты ×${(mid(b.hp)/mid(a.hp)).toFixed(2)}`);
    if (shift) m.mods.push(`заметные характеристики ${sg(shift)}`);
    return m;
  }

  function rollHP(m){ return Math.max(1, roll(m.hd[0], m.hd[1]) + m.hd[2]); }

  /* ---------- статблок ---------- */
  const PROP_ORDER = ["Спасброски","Навыки","Уязвимость к урону","Сопротивление урону","Иммунитет к урону","Иммунитет к состоянию","Чувства","Языки"];
  function statBlock(m, opt = {}){
    const fl = opt.flavor;
    const abil = m.abil.map((s, i) => `<div class="ev-ab" title="${ABIL_FULL[i]}"><b>${ABBR[i]}</b><span>${s} (${sg(mod(s))})</span></div>`).join("");
    const props = PROP_ORDER.filter(k => m.props[k]).map(k => `<p><b>${k}</b> ${m.props[k]}</p>`).join("");
    const secs = m.sections.map(([t, h], i) => (i === 0 && t === "Особенности") ? `<div class="ev-sec">${h}</div>` : `<h4 class="ev-sec-t">${esc(t)}</h4><div class="ev-sec">${h}</div>`).join("");
    const badge = m.official
      ? `<span class="ev-badge ev-off" title="Статблок без изменений">Официальный статблок · ${esc(m.src)}</span>`
      : `<span class="ev-badge ev-adapt" title="${esc(m.mods.join(", "))}">Подогнан под Опасность ${m.crText} по DMG · основа: ${esc(m.baseName)} (${crLabel(m.baseCR)})</span>`;
    const hpBoxes = opt.count ? `<div class="ev-hpbox"><b>Трекер хитов:</b> ${opt.hps.map((h, i) => `<label>#${i+1}<input type="number" value="${h}" min="0" inputmode="numeric"></label>`).join("")}</div>` : "";
    return `<article class="ev-block" data-id="${m.baseId || m.id}">
      <header class="ev-head">
        ${fl && !(opt.count > 1) ? `<div class="ev-epithet" title="Случайное имя для вашей игры">«${esc(fl.title)}»</div>` : ""}
        <h3>${esc(m.name)}${opt.count > 1 ? ` <span class="ev-count">×${opt.count}</span>` : ""}</h3>
        <div class="ev-meta">${esc(m.meta)}</div>
        ${badge}
      </header>
      <div class="ev-rule"></div>
      <p><b>Класс Доспеха</b> ${m.acText}</p>
      <p><b>Хиты</b> <span class="ev-hp">${m.hpText}</span> <button type="button" data-html2canvas-ignore="true" class="ev-roll" data-n="${m.hd[0]}" data-d="${m.hd[1]}" data-b="${m.hd[2]}" title="Бросить кости хитов">🎲</button> <span class="ev-rolled"></span></p>
      <p><b>Скорость</b> ${esc(m.props["Скорость"] || "")}</p>
      <div class="ev-rule"></div>
      <div class="ev-abils">${abil}</div>
      <div class="ev-rule"></div>
      ${props}
      <p><b>Опасность</b> ${m.crText} (${fmtNum(m.xp)} опыта) &nbsp; <b>Бонус мастерства</b> ${sg(m.pb)}</p>
      <div class="ev-rule"></div>
      ${secs}
      ${hpBoxes}
      ${fl ? `<div class="ev-flavor"><p><b>Примета:</b> ${esc(fl.mark)}.</p><p><b>Чего хочет:</b> ${esc(fl.want)}.</p><p><b>Тайна для мастера:</b> ${esc(fl.secret)}.</p></div>` : ""}
      ${m.lore && m.lore.length ? `<details class="ev-lore"><summary>Описание из бестиария</summary>${m.lore.map(p => `<p>${esc(p)}</p>`).join("")}</details>` : ""}
      <div class="ev-src">Источник статблока: ${esc(m.en)} · ${esc(m.src)} · перевод dnd.su</div>
    </article>`;
  }

  /* ---------- состояние и разметка экрана ---------- */
  const st = { tab:"forge", group:"vampire", base:"random", cr:"orig", hpMode:"avg",
               level:3, party:4, diff:2, theme:"vampire", q:"", bgroup:"all" };
  try { Object.assign(st, JSON.parse(localStorage.getItem("evilForge") || "{}")); } catch(e){}
  const save = () => { try { localStorage.setItem("evilForge", JSON.stringify(st)); } catch(e){} };

  const root = document.createElement("section");
  root.id = "evilScreen"; root.className = "evil-screen"; root.hidden = true;
  root.setAttribute("aria-label", "Кузня Зла — генератор противников");
  root.innerHTML = `
    <div class="evil-inner">
      <header class="evil-top">
        <button type="button" class="btn btn-ghost evil-back" id="evilBack">← К Кузне Героев</button>
        <div class="evil-brand"><span class="evil-skull" aria-hidden="true">☠</span><h1>Кузня Зла</h1></div>
        <p class="evil-sub">Противники D&amp;D 5e по правилам: официальные статблоки и подгонка под любую Опасность по таблицам «Руководства мастера».</p>
        <nav class="evil-tabs" role="tablist">
          <button type="button" role="tab" data-tab="forge">⚒ Выковать врага</button>
          <button type="button" role="tab" data-tab="party">⚔ Засада на отряд</button>
          <button type="button" role="tab" data-tab="book">📖 Бестиарий</button>
        </nav>
      </header>
      <div class="evil-panel" id="evilPanel"></div>
      <div class="evil-out" id="evilOut"></div>
    </div>`;
  document.body.appendChild(root);
  const panel = root.querySelector("#evilPanel"), outEl = root.querySelector("#evilOut");

  const crOptions = (sel) => T.map(r => `<option value="${r.cr}" ${String(sel) === String(r.cr) ? "selected" : ""}>${crLabel(r.cr)}</option>`).join("");
  const groupChips = (key, withAll) => (withAll ? [{ id:"all", name:"Все", icon:"☠" }] : []).concat(GROUPS)
    .map(g => `<button type="button" class="ev-chip ${st[key] === g.id ? "on" : ""}" data-set="${key}" data-val="${g.id}">${g.icon} ${g.name}</button>`).join("");
  const sortedPool = g => B.filter(m => g === "all" || m.group === g).slice().sort((x, y) => x.cr - y.cr || x.name.localeCompare(y.name, "ru"));

  function renderPanel(){
    root.querySelectorAll(".evil-tabs [data-tab]").forEach(b => { const on = b.dataset.tab === st.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    if (st.tab === "forge"){
      const pool = sortedPool(st.group);
      if (st.base !== "random" && !pool.some(m => m.id === st.base)) st.base = "random";
      panel.innerHTML = `
        <div class="ev-field"><span class="ev-label">Род зла</span><div class="ev-chips">${groupChips("group")}</div></div>
        <div class="ev-row">
          <label class="ev-field"><span class="ev-label">Образец</span>
            <select id="evBase"><option value="random">🎲 Случайный (${pool.length})</option>${pool.map(m => `<option value="${m.id}" ${st.base === m.id ? "selected" : ""}>${esc(m.name)} — ПО ${m.crText}</option>`).join("")}</select></label>
          <label class="ev-field"><span class="ev-label">Опасность (ПО)</span>
            <select id="evCR"><option value="orig" ${st.cr === "orig" ? "selected" : ""}>Как в книге</option>${crOptions(st.cr)}</select></label>
          <label class="ev-field"><span class="ev-label">Хиты</span>
            <select id="evHP"><option value="avg" ${st.hpMode === "avg" ? "selected" : ""}>Средние</option><option value="roll" ${st.hpMode === "roll" ? "selected" : ""}>Бросить кости</option></select></label>
        </div>
        <p class="ev-note">«Как в книге» — точный официальный статблок. Другая Опасность — пересчёт КД, хитов, бонуса атаки, урона, Сл и бонуса мастерства по таблице DMG; изменённые числа подсвечены.</p>
        <div class="ev-actions"><button type="button" class="btn btn-gold ev-go" id="evGo">☠ Выковать зло</button></div>`;
    } else if (st.tab === "party"){
      panel.innerHTML = `
        <div class="ev-field"><span class="ev-label">Место встречи</span><div class="ev-chips">${THEMES.map(t => `<button type="button" class="ev-chip ${st.theme === t.id ? "on" : ""}" data-set="theme" data-val="${t.id}">${t.icon} ${t.name}</button>`).join("")}</div></div>
        <div class="ev-row">
          <label class="ev-field"><span class="ev-label">Уровень героев</span><select id="evLvl">${Array.from({ length:20 }, (_, i) => `<option ${st.level == i+1 ? "selected" : ""}>${i+1}</option>`).join("")}</select></label>
          <label class="ev-field"><span class="ev-label">Героев в отряде</span><select id="evParty">${[1,2,3,4,5,6,7,8].map(n => `<option ${st.party == n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="ev-field"><span class="ev-label">Сложность</span><select id="evDiff">${DIFF.map((d, i) => `<option value="${i}" ${st.diff == i ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        </div>
        <p class="ev-note" id="evBudget"></p>
        <div class="ev-actions"><button type="button" class="btn btn-gold ev-go" id="evGo">☠ Выковать засаду</button></div>`;
      updateBudget();
    } else {
      panel.innerHTML = `
        <div class="ev-field"><span class="ev-label">Род зла</span><div class="ev-chips">${groupChips("bgroup", true)}</div></div>
        <label class="ev-field"><span class="ev-label">Поиск</span><input type="search" id="evQ" placeholder="вампир, лич, упырь…" value="${esc(st.q)}"></label>`;
      renderBook();
    }
  }

  function budget(){
    const t = THR[st.level].map(v => v * st.party);
    return { t, lo:t[st.diff], hi:st.diff < 3 ? t[st.diff + 1] - 1 : Math.round(t[3] * 1.5) };
  }
  function updateBudget(){
    const el = root.querySelector("#evBudget"); if (!el) return;
    const { t } = budget();
    el.innerHTML = `Пороги опыта для отряда: ${DIFF.map((d, i) => `<span class="${i == st.diff ? "ev-hl" : ""}">${d.toLowerCase()} ${fmtNum(t[i])}</span>`).join(" · ")}. Опыт монстров умножается на множитель за их количество (DMG, гл. 3).`;
  }

  /* --- вкладка «Выковать врага» --- */
  function forgeOne(){
    const pool = sortedPool(st.group);
    const base = st.base === "random" ? pick(pool) : byId[st.base];
    const cr = st.cr === "orig" ? null : parseFloat(st.cr);
    const m = build(base, cr);
    const fl = flavorFor(m);
    let html = statBlock(m, { flavor:fl });
    outEl.innerHTML = `<div class="ev-result-bar"><button type="button" class="btn ev-again" id="evAgain">🎲 Ещё вариант</button><button type="button" class="btn btn-gold ev-pdf" id="evPdf">📄 Скачать PDF</button><button type="button" class="btn ev-print" id="evPrint">🖨 Печать</button></div>` + html;
    if (st.hpMode === "roll") outEl.querySelectorAll(".ev-roll").forEach(b => b.click());
    revealOut();
  }

  /* --- вкладка «Засада» --- */
  function forgeEncounter(){
    const theme = THEMES.find(t => t.id === st.theme);
    const { lo, hi } = budget();
    const maxXP = hi;    // одиночный монстр не дороже верхней границы
    const pool = theme.ids.map(id => byId[id]).filter(m => m && m.xp <= maxXP);
    if (!pool.length){ outEl.innerHTML = `<p class="ev-empty">Для такого бюджета в этой теме нет подходящих существ — попробуй другую тему или сложность.</p>`; revealOut(); return; }
    const leaders = theme.lead ? pool.filter(m => m.group === theme.lead) : pool;
    let best = null;
    for (let tries = 0; tries < 4000; tries++){
      const kinds = 1 + rnd(3);
      const chosen = [];
      const lead = pick(leaders.length ? leaders : pool);
      chosen.push(lead);
      while (chosen.length < kinds){ const c = pick(pool); if (!chosen.includes(c)) chosen.push(c); if (pool.length <= chosen.length) break; }
      const cnt = new Map(chosen.map(c => [c, 1]));
      const adj = () => { let n = 0, xp = 0; cnt.forEach((k, c) => { n += k; xp += k * c.xp; }); return { n, raw:xp, adj:Math.round(xp * multiplier(n, st.party)) }; };
      let cur = adj();
      let guard = 0;
      while (cur.adj < lo && guard++ < 30){
        const c = pick(chosen.filter(x => x !== lead || chosen.length === 1)) || lead;
        cnt.set(c, cnt.get(c) + 1);
        const nx = adj();
        if (nx.adj > hi || nx.n > 12){ cnt.set(c, cnt.get(c) - 1); break; }
        cur = nx;
      }
      if (cur.adj >= lo && cur.adj <= hi){
        const score = Math.abs(cur.n - 4) + (theme.lead && !chosen.some(c => c.group === theme.lead) ? 10 : 0) + Math.random() * 3;
        if (!best || score < best.score) best = { cnt, cur, score };
        if (tries > 300 && best) break;
      }
    }
    let list = best ? [...best.cnt.entries()].filter(([, k]) => k > 0).sort((a, b) => b[0].cr - a[0].cr).map(([c, k]) => [c, k, null]) : null;
    if (!best){
      // книжных существ темы не хватает — подгоняем одно-два существа под нужную Опасность по DMG
      const all = theme.ids.map(id => byId[id]).filter(Boolean);
      const cands = [];
      for (const base of (theme.lead ? all.filter(m => m.group === theme.lead) : all))
        for (const k of [1, 2, 3, 4, 5, 6]) for (const r of T){
          const dist = Math.abs(rowIdx(r.cr) - rowIdx(base.cr));
          if (dist > 4) continue;      // дальше ±4 ступеней существо теряет свой характер
          const adjXP = Math.round(r.xp * k * multiplier(k, st.party));
          if (adjXP >= lo && adjXP <= hi) cands.push({ base, k, cr:r.cr, adjXP, score:dist * 2 + Math.abs(k - 2) });
        }
      if (!cands.length){ outEl.innerHTML = `<p class="ev-empty">Существ из темы «${esc(theme.name)}» не хватает на такую сложность даже с подгонкой (не больше ±4 ступеней Опасности). Выбери другую тему — например «Любое зло» — или измени уровень/сложность.</p>`; revealOut(); return; }
      const minS = Math.min(...cands.map(x => x.score));
      const c = pick(cands.filter(x => x.score === minS));
      list = [[c.base, c.k, c.cr]];
      best = { cur:{ n:c.k, raw:row(c.cr).xp * c.k, adj:c.adjXP } };
    }
    const realDiff = (() => { const { t } = budget(); let d = -1; t.forEach((v, i) => { if (best.cur.adj >= v) d = i; }); return d < 0 ? "Ниже лёгкой" : DIFF[d]; })();
    const mult = multiplier(best.cur.n, st.party);
    let html = `<div class="ev-result-bar"><button type="button" class="btn ev-again" id="evAgain">🎲 Другая засада</button><button type="button" class="btn btn-gold ev-pdf" id="evPdf">📄 Скачать PDF</button><button type="button" class="btn ev-print" id="evPrint">🖨 Печать</button></div>
      <div class="ev-summary">
        <h3>${theme.icon} ${esc(theme.name)} — ${st.party} геро${st.party === 1 ? "й" : st.party < 5 ? "я" : "ев"} ${st.level}-го уровня</h3>
        <ul>${list.map(([m, k, cr]) => `<li><b>${k} × ${esc(m.name)}</b> <span>ПО ${cr == null ? m.crText : crLabel(cr) + " (подогнан по DMG, в книге " + m.crText + ")"}, ${fmtNum(cr == null ? m.xp : row(cr).xp)} опыта каждый</span></li>`).join("")}</ul>
        <p>Опыт за монстров: <b>${fmtNum(best.cur.raw)}</b> · множитель за ${best.cur.n} сущ.: <b>×${mult}</b> · скорректированный опыт: <b>${fmtNum(best.cur.adj)}</b> → сложность <b>${realDiff}</b>.</p>
        <p class="ev-note">Героям за победу достаётся ${fmtNum(best.cur.raw)} опыта (без множителя) — по ${fmtNum(Math.floor(best.cur.raw / st.party))} на каждого.</p>
      </div>`;
    list.forEach(([base, k, cr]) => {
      const m = build(base, cr);
      const hps = Array.from({ length:k }, () => st.hpMode === "roll" ? rollHP(m) : m.hp);
      html += statBlock(m, { count:k, hps, flavor: (base.cr >= 2 || base.group === "vampire") ? flavorFor(m) : null });
    });
    outEl.innerHTML = html;
    revealOut();
  }

  /* --- вкладка «Бестиарий» --- */
  function renderBook(){
    const q = st.q.trim().toLowerCase();
    const list = sortedPool(st.bgroup).filter(m => !q || m.name.toLowerCase().includes(q) || m.en.toLowerCase().includes(q));
    outEl.innerHTML = `<div class="ev-result-bar"><button type="button" class="btn btn-gold ev-pdf" id="evPdf">📄 PDF открытых статблоков</button></div><p class="ev-note">${list.length} существ. Нажми на строку, чтобы открыть статблок; открытые попадут в PDF.</p>` + list.map(m => `
      <details class="ev-entry" data-id="${m.id}"><summary><span class="ev-cr">${m.crText}</span><span class="ev-en-name">${esc(m.name)}</span><span class="ev-en-meta">${esc(m.meta)}</span></summary></details>`).join("");
  }

  function revealOut(){
    if (innerWidth < 900){ const r = outEl.getBoundingClientRect(); if (r.top > innerHeight * 0.6) outEl.scrollIntoView({ behavior:"smooth", block:"start" }); }
  }

  /* ---------- экспорт в PDF (html2canvas + jsPDF, A4) ---------- */
  let pdfBusy = false;
  async function exportPDF(btn){
    if (pdfBusy) return;
    const nodes = [...outEl.querySelectorAll(".ev-summary, .ev-block")].filter(n => n.offsetParent !== null);
    if (!nodes.length){ btn.textContent = "Сначала открой хотя бы один статблок"; setTimeout(() => { btn.textContent = "📄 PDF открытых статблоков"; }, 2500); return; }
    if (!window.html2canvas || !window.jspdf){ btn.textContent = "PDF-библиотеки не загрузились — обнови страницу"; return; }
    pdfBusy = true;
    const label = btn.textContent; btn.textContent = "⏳ Готовим PDF…"; btn.disabled = true;
    const sheet = document.createElement("div");
    sheet.className = "ev-pdf-sheet";
    try{
      // Всё на ОДИН лист A4. CSS-колонки html2canvas рисует с дырами, поэтому
      // раскладываем сами: режем статблоки на абзацы, меряем их высоту и
      // жадно набиваем N колонок. Перебираем N и ориентацию листа, берём вариант
      // с самым крупным текстом.
      const COL = 330, GAPPX = 14, PAD = 12, FRAG = 30;   // FRAG — поля/рамки куска статблока
      const meas = document.createElement("div");
      meas.className = "ev-pdf-sheet"; meas.style.cssText = `width:${COL}px; display:block; padding:0;`;
      document.body.appendChild(meas);
      const atoms = [];                        // { el, wrap:"sec"|null, h, keep, block, type }
      nodes.forEach((n, bi) => {
        const c = n.cloneNode(true);
        c.querySelectorAll(".ev-lore, .ev-roll, .ev-rolled, [data-html2canvas-ignore]").forEach(x => x.remove());
        const src = n.querySelectorAll("input");
        c.querySelectorAll("input").forEach((inp, i) => { const sp = document.createElement("span"); sp.className = "ev-hpval"; sp.textContent = src[i] ? src[i].value : inp.value; inp.replaceWith(sp); });
        meas.appendChild(c);
        if (c.classList.contains("ev-summary")){ atoms.push({ el:c, wrap:null, h:c.offsetHeight + 10, keep:false, block:bi, type:"summary" }); return; }
        const parts = [];
        [...c.children].forEach(ch => {
          if (ch.classList.contains("ev-sec")) [...ch.children].forEach(x => parts.push({ el:x, wrap:"sec" }));
          else parts.push({ el:ch, wrap:null });
        });
        const tops = parts.map(pp => pp.el.getBoundingClientRect().top);
        const bottom = c.getBoundingClientRect().bottom - 8;
        parts.forEach((pp, i) => {
          const h = Math.max(1, (i + 1 < parts.length ? tops[i + 1] : bottom) - tops[i]);
          const keep = pp.el.classList.contains("ev-head") || pp.el.classList.contains("ev-rule") || pp.el.tagName === "H4";
          atoms.push({ ...pp, h, keep, block:bi, type:"block" });
        });
      });
      // раскладка при пределе высоты колонки L
      const pack = L => {
        const cols = [[]]; let colH = 0, lastBlock = -1;
        for (let i = 0; i < atoms.length; i++){
          const at = atoms[i];
          let need = at.h, j = i;
          while (atoms[j].keep && j + 1 < atoms.length && atoms[j + 1].block === at.block){ j++; need += atoms[j].h; }
          const over = (at.type === "block" && at.block !== lastBlock) || colH === 0 ? FRAG : 0;
          if (colH > 0 && colH + need + over > L){ cols.push([]); colH = 0; lastBlock = -1; }
          colH += at.h + ((at.type === "block" && (at.block !== lastBlock)) ? FRAG : 0);
          cols[cols.length - 1].push(at); lastBlock = at.block;
        }
        return { cols, H:Math.max(...cols.map(c => c.reduce((s, a) => s + a.h, 0))) };
      };
      const total = atoms.reduce((s, a) => s + a.h + 2, 0) + FRAG * nodes.length;
      const A4 = [595.28, 841.89], M = 18;
      let best = null;
      for (let n = 1; n <= 6; n++){
        let lo = Math.max(...atoms.map(a => a.h)) + FRAG, hi = total + FRAG;
        for (let it = 0; it < 30; it++){ const mid = (lo + hi) / 2; pack(mid).cols.length <= n ? hi = mid : lo = mid; }
        const L = hi, used = pack(L).cols.length;
        const w = used * COL + (used - 1) * GAPPX + PAD * 2, h = L + PAD * 2;
        for (const orient of ["portrait", "landscape"]){
          const [PW, PH] = orient === "portrait" ? A4 : [A4[1], A4[0]];
          const k = Math.min((PW - M * 2) / w, (PH - M * 2) / h);
          if (!best || k > best.k + 1e-6) best = { n:used, L, orient, k };
        }
      }
      // собираем лист
      const { cols } = pack(best.L);
      sheet.style.width = (cols.length * COL + (cols.length - 1) * GAPPX + PAD * 2) + "px";
      sheet.style.setProperty("--gap", GAPPX + "px");
      cols.forEach(col => {
        const cd = document.createElement("div"); cd.className = "ev-pdf-col"; cd.style.width = COL + "px";
        let frag = null, fragBlock = -1, sec = null;
        col.forEach(at => {
          if (at.type === "summary"){ cd.appendChild(at.el); frag = null; fragBlock = -1; return; }
          if (!frag || fragBlock !== at.block){
            frag = document.createElement("article"); frag.className = "ev-block";
            if (!at.el.classList.contains("ev-head")) frag.classList.add("ev-cont");
            cd.appendChild(frag); fragBlock = at.block; sec = null;
          }
          if (at.wrap === "sec"){ if (!sec){ sec = document.createElement("div"); sec.className = "ev-sec"; frag.appendChild(sec); } sec.appendChild(at.el); }
          else { sec = null; frag.appendChild(at.el); }
        });
        sheet.appendChild(cd);
      });
      meas.remove();
      document.body.appendChild(sheet);
      await new Promise(r => setTimeout(r, 30));
      const { jsPDF } = window.jspdf;
      // ~250 dpi на листе A4 — чётко и без многосекундной отрисовки
      const scale = clamp(3000 / Math.max(sheet.offsetWidth, sheet.scrollHeight * 1.414), 1, 2.5);
      const canvas = await html2canvas(sheet, { scale, backgroundColor:"#f6e8cc", logging:false, windowWidth:sheet.offsetWidth + 40,
        // не копировать всё приложение и бестиарий — только наш лист (иначе 15–20 с)
        ignoreElements: el => el.parentElement === document.body && el !== sheet && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName) });
      const pdf = new jsPDF({ orientation:best.orient, unit:"pt", format:"a4" });
      const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = PW - M * 2, h = w / ratio;
      if (h > PH - M * 2){ h = PH - M * 2; w = h * ratio; }
      pdf.setFillColor(246, 232, 204); pdf.rect(0, 0, PW, PH, "F");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (PW - w) / 2, (PH - h) / 2, w, h);
      const base = st.tab === "party" ? "zasada" : st.tab === "book" ? "bestiary" : (outEl.querySelector(".ev-block h3")?.childNodes[0]?.textContent || "zlo");
      const fname = String(base).trim().replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g, "_").slice(0, 40) + "_dnd5e.pdf";
      const blob = pdf.output("blob");
      const file = new File([blob], fname, { type:"application/pdf" });
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || innerWidth < 760;
      let shared = false;
      if (isMobile && navigator.canShare && navigator.canShare({ files:[file] })){
        try { await navigator.share({ files:[file], title:fname }); shared = true; }
        catch(err){ if (err && err.name === "AbortError") shared = true; }
      }
      if (!shared){
        const url = URL.createObjectURL(blob);
        if (isMobile){ window.open(url, "_blank"); }
        else { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      btn.textContent = "✅ PDF готов";
    } catch(err){
      console.error(err); btn.textContent = "⚠ Не получилось — попробуй ещё раз";
    } finally {
      sheet.remove();
      btn.disabled = false; pdfBusy = false;
      setTimeout(() => { btn.textContent = label; }, 2500);
    }
  }

  /* ---------- события ---------- */
  root.addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (tab){ st.tab = tab.dataset.tab; save(); outEl.innerHTML = ""; renderPanel(); return; }
    const chip = e.target.closest(".ev-chip");
    if (chip){
      st[chip.dataset.set] = chip.dataset.val; save();
      if (chip.dataset.set === "bgroup"){ chip.parentNode.querySelectorAll(".ev-chip").forEach(c => c.classList.toggle("on", c === chip)); renderBook(); }
      else if (chip.dataset.set === "theme"){ chip.parentNode.querySelectorAll(".ev-chip").forEach(c => c.classList.toggle("on", c === chip)); }
      else renderPanel();
      return;
    }
    if (e.target.closest("#evGo") || e.target.closest("#evAgain")){ st.tab === "party" ? forgeEncounter() : forgeOne(); return; }
    if (e.target.closest("#evPrint")){ window.print(); return; }
    if (e.target.closest("#evPdf")){ exportPDF(e.target.closest("#evPdf")); return; }
    if (e.target.closest("#evilBack")){ closeEvil(); return; }
    const r = e.target.closest(".ev-roll");
    if (r){
      const n = +r.dataset.n, d = +r.dataset.d, b = +r.dataset.b, v = Math.max(1, roll(n, d) + b);
      r.parentNode.querySelector(".ev-rolled").textContent = `→ выпало ${v}`;
    }
  });
  root.addEventListener("toggle", e => {
    const d = e.target;
    if (d.classList && d.classList.contains("ev-entry") && d.open && !d.dataset.filled){
      d.dataset.filled = "1"; d.insertAdjacentHTML("beforeend", statBlock(build(byId[d.dataset.id], null)));
    }
  }, true);
  root.addEventListener("change", e => {
    const id = e.target.id;
    if (id === "evBase") st.base = e.target.value;
    else if (id === "evCR") st.cr = e.target.value;
    else if (id === "evHP") st.hpMode = e.target.value;
    else if (id === "evLvl") { st.level = +e.target.value; updateBudget(); }
    else if (id === "evParty") { st.party = +e.target.value; updateBudget(); }
    else if (id === "evDiff") { st.diff = +e.target.value; updateBudget(); }
    else return;
    save();
  });
  root.addEventListener("input", e => { if (e.target.id === "evQ"){ st.q = e.target.value; save(); renderBook(); } });

  function openEvil(){
    root.hidden = false; document.body.classList.add("evil-open");
    renderPanel(); root.scrollTop = 0;
    requestAnimationFrame(() => root.classList.add("show"));
  }
  function closeEvil(){
    root.classList.remove("show"); document.body.classList.remove("evil-open");
    setTimeout(() => { root.hidden = true; }, 400);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden) closeEvil(); });
  ["btnEvil", "btnEvilTop"].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener("click", openEvil); });
  window.EvilForge = { open:openEvil, close:closeEvil, build, multiplier, THR, T, statBlock };
})();
