import json
import os
import re

BASE = os.path.dirname(os.path.dirname(__file__))
DATA_PATH = os.path.join(BASE, "pc_wiki.generated.json")

def parse_timing(desc):
    d = desc.lower()
    # from the start of battle to turn X
    m = re.search(r'from the start of battle to turn (\d+)', d)
    if m:
        return f"Up till turn {int(m.group(1))}"
    # from start of battle to Turn X (alternate phrasing)
    m = re.search(r'from start of battle to turn (\d+)', d)
    if m:
        return f"Up till turn {int(m.group(1))}"
    # start of battle
    if re.search(r'start of battle|at the start of battle|start of turn', d):
        return "Start of battle"
    # up till / until turn X
    m = re.search(r'up till turn (\d+)|until turn (\d+)|until turn (\d+)', d)
    if m:
        for g in m.groups():
            if g:
                return f"Up till turn {int(g)}"
    # every X turns
    m = re.search(r'every (\d+) turns?', d)
    if m:
        n = int(m.group(1))
        return f"Every {n} turns"
    # every turn
    if re.search(r'every turn', d):
        return "Every 1 turn"
    return "Unknown"


def extract():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    chars = data.get('characters') or []
    results = []

    for c in chars:
        name = c.get('name')
        affiliation = c.get('affiliation_name')
        traits = c.get('traits') or []

        # Choose the protection-gauge trait with the highest Awaken level (prefer 5/5 over 3/5)
        best_trait = None
        best_awaken = -1
        for t in traits:
            desc = t.get('description_max_level') or ""
            if 'protection gauge' not in desc.lower():
                continue
            unlock = t.get('unlock') or ""
            m_unlock = re.search(r'Awaken\s*(\d+)/5', unlock, re.I)
            if not m_unlock:
                continue
            awaken_num = int(m_unlock.group(1))
            if awaken_num > best_awaken:
                best_awaken = awaken_num
                best_trait = t

        if not best_trait:
            continue

        desc = best_trait.get('description_max_level') or ""
        m = re.search(r'protection gauge by (\d+)', desc.lower())
        if not m:
            continue
        amt = int(m.group(1))
        timing = parse_timing(desc)
        results.append({
            'name': name,
            'affiliation': affiliation,
            'amount': amt,
            'timing': timing,
            'description': desc.strip(),
        })

    # Print a summary and JSON
    print(f"Found {len(results)} protection-gauge traits (selected highest Awaken level per character).\n")

    # print CSV-like table for quick review
    print("name	affiliation	amount	timing")
    for r in results:
        print(f"{r['name']}\t{r['affiliation']}\t{r['amount']}\t{r['timing']}")

    # also dump to JSON file for inspection
    out_path = os.path.join(BASE, 'scripts', 'awaken3_protection_entries.json')
    with open(out_path, 'w', encoding='utf-8') as out:
        json.dump(results, out, ensure_ascii=False, indent=2)
    print(f"\nWrote details to {out_path}")

if __name__ == '__main__':
    extract()
