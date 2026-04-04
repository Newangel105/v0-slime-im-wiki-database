import json, sys
sys.stdout.reconfigure(encoding='utf-8')
data = json.loads(open('pc_wiki.generated.json', encoding='utf-8').read())
chars = data['characters']

for c in chars:
    for s in c.get('skills', []) + c.get('traits', []):
        desc = s.get('description_max_level', '') or ''
        if 'Dread' in desc and len(desc) > 20:
            print(f"{c['name']} / {s.get('slot','')} / {s.get('name','')}")
            print(f"  {desc[:400]}")
            print()
        elif 'damage done to' in desc.lower() and 'attribute' in desc.lower():
            print(f"ELEM_DMG: {c['name']} / {s.get('slot','')} / {s.get('name','')}")
            print(f"  {desc[:300]}")
            print()

print("Done")
