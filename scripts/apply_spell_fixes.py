import json, re

with open('scripts/spell_fixes.json', encoding='utf-8') as f:
    fixes = json.load(f)

with open('js/data.js', encoding='utf-8') as f:
    src = f.read()

applied = 0
missing = []
for sp in fixes['spells']:
    old_name = sp['old_name']
    new_name = sp['new_name']
    new_desc = sp['new_description']
    pat = re.compile(r'("name":\s*"' + re.escape(old_name) + r'"[\s\S]{0,500}?"description":\s*)"((?:[^"\\]|\\.)*)"')
    m = pat.search(src)
    if not m:
        missing.append(old_name)
        continue
    new_desc_escaped = new_desc.replace('\\', '\\\\').replace('"', '\\"')
    src = src[:m.start()] + m.group(1) + '"' + new_desc_escaped + '"' + src[m.end():]
    if new_name != old_name:
        src = src.replace('"name": "' + old_name + '"', '"name": "' + new_name + '"', 1)
    applied += 1

print("applied:", applied, "missing:", missing)

with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(src)
