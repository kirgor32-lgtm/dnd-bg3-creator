import re

text = open('js/data.js', encoding='utf-8').read()
strs = re.findall(r'"((?:[^"\\]|\\.)*)"', text)
cyr = [s for s in strs if re.search(r'[а-яёА-ЯЁ]', s)]
print("total cyrillic strings:", len(cyr))

issues = []
for s in cyr:
    if '  ' in s:
        issues.append(('double_space', s))
    if re.search(r'[а-яёА-ЯЁ]\.[а-яёА-ЯЁ]', s):
        issues.append(('no_space_after_dot', s))
    if re.search(r'\s[,.;:!?]', s):
        issues.append(('space_before_punct', s))
    m = re.search(r'\b(\w+)\s+\1\b', s, re.IGNORECASE)
    if m:
        issues.append(('repeated_word', s))
    if re.search(r'[а-яёА-ЯЁ],[а-яёА-ЯЁ]', s):
        issues.append(('no_space_after_comma', s))

print("potential issues:", len(issues))
for t, s in issues:
    print(t, '|', s)
