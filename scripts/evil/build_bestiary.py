"""Собирает js/evil-data.js из страниц бестиария dnd.su (официальный русский перевод D&D 5e).
Запуск: python scripts/evil/build_bestiary.py  (нужен curl в PATH)."""
import re, json, os, subprocess, html as H, concurrent.futures

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, "scripts", "evil", "cache")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
NAMES = ("vampire;vampire spawn;vampire spellcaster;vampire warrior;vampiric mist;vampirate;vampirate captain;vampirate mage;"
         "kobold vampire spawn;blood drinker vampire;mind drinker vampire;gnoll vampire;crawling claw;zombie;skeleton;shadow;"
         "warhorse skeleton;ghoul;specter;strahd zombie;ghast;poltergeist;will-o’-wisp;minotaur skeleton;ogre zombie;mummy;wight;"
         "sword wraith warrior;flameskull;banshee;ghost;deathlock;allip;wraith;beholder zombie;shadowghast;bodak;skeletal knight;"
         "barrowghast;sword wraith commander;necromancer wizard;cairnwight;dullahan;boneclaw;mummy lord;skull lord;death knight;"
         "demilich;nightwalker;lich;cultist;cult fanatic;goblin;orc;bugbear;werewolf;imp;quasit;hell hound;night hag;swarm of bats;"
         "swarm of rats;wolf;dire wolf;bandit captain").split(";")

def curl(url, fn):
    if not os.path.exists(fn) or os.path.getsize(fn) < 20000:
        subprocess.run(["curl", "-sL", "-m", "60", "-A", UA, url, "-o", fn])
    return open(fn, encoding="utf-8").read()

def index():
    t = curl("https://dnd.su/piece/bestiary/index-list/?content=multiverse", os.path.join(CACHE, "_index.html"))
    idx = {}
    for ru, en, i, href in re.findall(r"data-search='([^,]*),([^,]*),[^']*' data-id='(\d+)'.*?href='([^']+)'", t, re.S):
        idx.setdefault(en.strip().lower(), href)
    return idx

def card(t):
    a = t.find('<ul class="params card__article-body">'); b = t.find('<div class="card__footer">', a)
    return t[a:b] if a >= 0 else ""

def clean(h):
    h = re.sub(r"<sup>.*?</sup>", "", h, flags=re.S)
    h = re.sub(r"<a [^>]*>(.*?)</a>", lambda m: re.sub(r"\s*\[[^\]]*\]", "", m.group(1)), h, flags=re.S)
    h = re.sub(r"<span[^>]*>", "", h).replace("</span>", "")
    h = re.sub(r"<(\w+)\s[^>]*>", r"<\1>", h)
    h = re.sub(r"<(?!/?(p|ul|li|strong|em|br|ol|b|i)\b)[^>]+>", "", h)
    h = re.sub(r"\s+", " ", h).replace("<p> ", "<p>").replace(" </p>", "</p>").strip()
    return re.sub(r"<p></p>|<p><br></p>", "", h)

def txt(h): return H.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", clean(h)))).strip()
def num(s): return int(s.split("/")[0]) / int(s.split("/")[1]) if "/" in s else float(s)

def parse(t):
    c = card(t)
    if not c: return None
    title = re.search(r'data-copy="([^"]*)"', t).group(1)
    src = re.search(r"class='source-plaque' title=\"([^\"]*)\">([^<]*)", t)
    en = H.unescape(re.search(r"\[(.*)\]", title).group(1))
    m = {"id": re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-"), "name": H.unescape(re.sub(r"\s*\[.*", "", title).strip()),
         "en": en, "src": src.group(2) if src else "", "props": {}}
    pre = c.split('<li class="subsection')[0]
    for cls, body in re.findall(r"<li class='([^']*)'>(.*?)</li>", pre, re.S):
        if cls == "size-type-alignment": m["meta"] = txt(body); continue
        if cls == "abilities": m["abil"] = [int(x) for x in re.findall(r"<div>(\d+) \(", body)]; continue
        k = re.match(r"\s*<strong>([^<]*)</strong>", body)
        if not k: continue
        key, val = k.group(1).strip(), txt(body[k.end():])
        if key == "Хиты":
            m["hp"] = int(re.search(r"data-type='middle'>(\d+)", body).group(1))
            thr = re.search(r"data-type='throw'>(\d+)</span>к<span data-type='dice'>(\d+)", body)
            bon = re.search(r"data-type='action'>([+-])</span> <span data-type='bonus'>(\d+)", body)
            m["hd"] = [int(thr.group(1)), int(thr.group(2)), (int(bon.group(2)) * (1 if bon.group(1) == "+" else -1)) if bon else 0]
        elif key.startswith("Бонус мастерства"): m["pb"] = int(re.search(r"\d+", key).group())
        else: m["props"][key] = val
    mm = re.match(r"([\d/]+)\s*\(([\d\s ]+)", m["props"].pop("Опасность"))
    m["cr"], m["crText"], m["xp"] = num(mm.group(1)), mm.group(1), int(re.sub(r"\D", "", mm.group(2)))
    m["acText"] = m["props"].pop("Класс Доспеха"); m["ac"] = int(re.match(r"\d+", m["acText"]).group())
    m["sections"], m["lore"] = [], []
    for i, s in enumerate(re.split(r'<li class="subsection desc">', c)[1:]):
        h = re.search(r'<h3 class="subsection-title">([^<]*)</h3>', s)
        title = h.group(1).strip() if h else "Особенности"
        body = re.sub(r"</li>\s*$", "", (s[h.end():] if h else s).strip())
        if title == "Описание":
            m["lore"] = [p for p in (txt(p) for p in re.findall(r"<p>(.*?)</p>", clean(body), re.S)) if p][:2]
        elif title == "Особенности" and m["sections"]:
            continue                       # врезки-варианты после основного блока
        else:
            m["sections"].append([title, clean(body)])
    low = m["meta"].lower()
    m["group"] = ("vampire" if "вампир" in m["name"].lower() or "vampir" in m["id"] else "undead" if "нежить" in low
                  else "fiend" if "исчадие" in low else "beast" if "звер" in low else "humanoid")
    return m

def main():
    os.makedirs(CACHE, exist_ok=True)
    idx = index()
    def one(n):
        href = idx[n]
        return parse(curl("https://dnd.su" + href, os.path.join(CACHE, href.strip("/").split("/")[-1] + ".html")))
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        mons = [m for m in ex.map(one, NAMES) if m]
    out = os.path.join(ROOT, "js", "evil-data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Бестиарий «Кузни Зла». Статблоки — официальный русский перевод D&D 5e (dnd.su), собрано scripts/evil/build_bestiary.py. Не править руками. */\n")
        f.write("const EVIL_BESTIARY = " + json.dumps(mons, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(len(mons), "monsters ->", out)

if __name__ == "__main__":
    main()
