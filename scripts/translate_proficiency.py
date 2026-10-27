import re, json

path = 'js/data.js'
text = open(path, encoding='utf-8').read()
m = re.search(r'const DND_DATA\s*=\s*(\{.*\})\s*;?\s*$', text, re.DOTALL)
data = json.loads(m.group(1))

TRANSLATE = {
    "Light armor": "Лёгкие доспехи",
    "Medium armor": "Средние доспехи",
    "Heavy armor": "Тяжёлые доспехи",
    "All armor": "Любые доспехи",
    "Shields": "Щиты",
    "Simple weapons": "Простое оружие",
    "Martial weapons": "Воинское оружие",
    "Hand crossbows": "Ручные арбалеты",
    "Light crossbows": "Лёгкие арбалеты",
    "Heavy crossbows": "Тяжёлые арбалеты",
    "Longswords": "Длинные мечи",
    "Rapiers": "Рапиры",
    "Shortswords": "Короткие мечи",
    "Clubs": "Дубинки",
    "Daggers": "Кинжалы",
    "Darts": "Дарты",
    "Javelins": "Дротики",
    "Maces": "Булавы",
    "Quarterstaffs": "Посохи",
    "Scimitars": "Скимитары",
    "Sickles": "Серпы",
    "Slings": "Пращи",
    "Spears": "Копья"
}

unknown = set()
for c in data["classes"]:
    for field in ("armorProficiency", "weaponProficiency"):
        c[field] = [TRANSLATE.get(v, v) for v in c.get(field, [])]
        for v in c.get(field, []):
            if v not in TRANSLATE.values():
                unknown.add(v)

print("untranslated leftovers:", unknown)

out = json.dumps(data, ensure_ascii=False, indent=1)
open(path, 'w', encoding='utf-8').write(f"const DND_DATA = {out};\n")
print("done")
