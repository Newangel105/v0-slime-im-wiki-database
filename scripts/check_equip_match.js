const fs = require('fs');

const EQUIP_PATH = 'd:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database/public/equipment.json';
const PC_WIKI_PATH = 'd:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database/pc_wiki.generated.json';

function stripColorTags(text) {
  return (text || '').replace(/<color=[^>]+>/gi, '').replace(/<\/color>/gi, '');
}

function normalizeElement(el) {
  const CHAR_ELEMENT_NORM = {
    Holy: 'light', Air: 'space',
    EnhancedHoly: 'light', EnhancedAir: 'space', EnhancedWind: 'wind',
    EnhancedFire: 'fire', EnhancedWater: 'water', EnhancedEarth: 'earth', EnhancedDark: 'dark'
  };
  if (!el) return '';
  return (CHAR_ELEMENT_NORM[el] || el).toLowerCase();
}

function equipmentElementMatch(e, char) {
  const validEffects = [e.effect1 || '', e.effect2 || ''].filter(ef => ef && !ef.toLowerCase().includes('valor cup'));
  if (validEffects.length === 0) return false;
  const combined = validEffects.map(s => stripColorTags(s)).join(' ').toLowerCase();
  const nameText = (e.name || '').toLowerCase();
  const charEl = normalizeElement(char.element || '');
  if (!charEl) return false;
  const ELEMENT_SYNONYMS = {
    water: ['water', 'aqua', 'icy'],
    fire: ['fire', 'flame', 'flames', 'blaze', 'blazing'],
    earth: ['earth'],
    dark: ['dark', 'shadow'],
    light: ['light', 'holy'],
    wind: ['wind', 'air'],
    space: ['space']
  };
  const aliases = ELEMENT_SYNONYMS[charEl] || [charEl];
  for (const a of aliases) {
    const token = a.toLowerCase();
    if (combined.includes(`${token} character`) || combined.includes(`${token} characters`) || combined.includes(`${token} element`) || combined.includes(`${token} attribute`)) return true;
    if (nameText.includes(token)) return true;
  }
  return false;
}

try {
  const equipment = JSON.parse(fs.readFileSync(EQUIP_PATH, 'utf8'));
  const pcRaw = JSON.parse(fs.readFileSync(PC_WIKI_PATH, 'utf8'));

  // pc_wiki.generated.json may be an array or an object wrapper — find the array of characters.
  let pcArray = [];
  if (Array.isArray(pcRaw)) pcArray = pcRaw;
  else {
    const queue = [pcRaw];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) {
        if (node.length > 0 && node[0] && typeof node[0] === 'object' && 'master_pc_id' in node[0]) { pcArray = node; break; }
      } else if (node && typeof node === 'object') {
        for (const v of Object.values(node)) queue.push(v);
      }
    }
  }

  const argId = parseInt(process.argv[2], 10);
  const charId = Number.isFinite(argId) ? argId : 150570; // default: Violet (150570)
  const char = pcArray.find(c => c.master_pc_id === charId);
  if (!char) {
    console.error('Character not found in parsed data:', charId);
    process.exit(2);
  }

  const mantleById = equipment.find(e => e.id === 1121310003);
  const mantleByName = equipment.find(e => (e.name || '').includes('Blazing Flames'));

  console.log('Character:', char.name, '| affiliation:', char.affiliation_name, '| element:', char.element, '-> normalized:', normalizeElement(char.element));
  if (mantleById) {
    console.log('\nMantle by id (1121310003) found:');
    console.log('  name:', mantleById.name);
    console.log('  effect1:', mantleById.effect1);
    console.log('  effect2:', mantleById.effect2);
    console.log('  elementMatch (isElementMatch):', equipmentElementMatch(mantleById, char));
  } else {
    console.log('Mantle by id not found');
  }

  if (mantleByName && mantleByName !== mantleById) {
    console.log('\nMantle by name:', mantleByName.name);
    console.log('  effect1:', mantleByName.effect1);
    console.log('  elementMatch:', equipmentElementMatch(mantleByName, char));
  }

  // Find all armor candidates that match element
  const armorCandidates = equipment.filter(e => e.type === 'armor');
  const elementMatches = armorCandidates.filter(a => equipmentElementMatch(a, char)).map(a => ({ id: a.id, name: a.name, effect1: a.effect1 }));
  console.log('\nArmor candidates matching element for this character (count:', elementMatches.length + ')');
  console.log(JSON.stringify(elementMatches.slice(0, 40), null, 2));

  // Simulate the selection logic from team-builder-client for a single character + slot
  function normalizeIdentityText(value) {
    return stripColorTags(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function getEquipmentTargetPhrases(effects) {
    const targets = new Set();
    for (const effect of effects) {
      const normalizedEffect = normalizeIdentityText(effect);
      const matches = normalizedEffect.matchAll(/when equipped by (.+?) increases/g);
      for (const match of matches) {
        const target = (match[1] || '').trim().replace(/\s+,/g, '').trim();
        if (target) targets.add(target);
      }
    }
    return [...targets];
  }

  function isExclusiveForChar(e) {
    const descEffects = [e.effect1 || '', e.effect2 || ''].filter(s => s && s.trim().length > 0);
    const equipmentTargets = getEquipmentTargetPhrases(descEffects);
    if (equipmentTargets.length === 0) return false;
    const hasGenericTarget = equipmentTargets.some(t => t.includes('character') || t.includes('characters') || t.includes('force') || t.includes('ally') || t.includes('allies') || t.includes('team'));
    if (hasGenericTarget) return false;
    const charName = normalizeIdentityText(char.name);
    const charAffil = normalizeIdentityText(char.affiliation_name);
    const nameAffilA = `${charName} ${charAffil}`.trim();
    const nameAffilB = `${charAffil} ${charName}`.trim();
    const identityPhrases = [nameAffilA, nameAffilB, charName];
    const descCombined = descEffects.join(' ').toLowerCase();
    return identityPhrases.some(p => equipmentTargets.includes(p)) || (charAffil.length > 2 && descCombined.includes(charAffil));
  }

  function scoreEquipment(eq, char) {
    const validEffects = [eq.effect1 || '', eq.effect2 || ''].filter(e => !e.toLowerCase().includes('valor cup'));
    const combined = validEffects.join(' ').toLowerCase();
    const charEl = normalizeElement(char.element || '');
    const charWt = (char.weapon_type || '').toLowerCase();
    const eqWt = (eq.weapon_type || '').toLowerCase();
    const weaponMatch = eq.type === 'weapon' && charWt && eqWt && eqWt === charWt;
    const elementMatch = charEl && combined.includes(charEl + ' character');
    let effectiveStat = 0;
    if (eq.type === 'weapon') {
      const atk = eq.max_atk || 0;
      effectiveStat = atk * (1 + (weaponMatch ? 0.2 : 0) + (elementMatch ? 0.1 : 0));
    } else if (eq.type === 'armor') {
      effectiveStat = (eq.max_def || 0) * (1 + (elementMatch ? 0.1 : 0));
    } else {
      effectiveStat = (eq.max_hp || 0) * (1 + (elementMatch ? 0.1 : 0));
    }
    let score = effectiveStat + (eq.rarity || 0) * 0.5 + (eq.base_rarity || 0) * 0.1;
    if (isExclusiveForChar(eq)) score += 100000;
    return score;
  }

  function pickForChar(char, eqType, externalUsedIds) {
    const usedIds = externalUsedIds ?? new Set();
    const candidates = equipment.filter(e => {
      if (e.type !== eqType) return false;
      if (usedIds.has(e.id)) return false;
      const descEffects = [e.effect1 || '', e.effect2 || ''].filter(s => s && s.trim().length > 0);
      if (descEffects.length > 0 && descEffects.every(ef => ef.toLowerCase().includes('valor cup'))) return false;
      const equipmentTargets = getEquipmentTargetPhrases(descEffects);
      if (equipmentTargets.length > 0) {
        const hasGenericTarget = equipmentTargets.some(t => t.includes('character') || t.includes('characters') || t.includes('force') || t.includes('ally') || t.includes('allies') || t.includes('team'));
        if (!hasGenericTarget) {
          const charName = normalizeIdentityText(char.name);
          const charAffil = normalizeIdentityText(char.affiliation_name);
          const nameAffilA = `${charName} ${charAffil}`.trim();
          const nameAffilB = `${charAffil} ${charName}`.trim();
          const identityPhrases = [nameAffilA, nameAffilB, charName];
          const descCombined = descEffects.join(' ').toLowerCase();
          const matchesTarget = equipmentTargets.includes(charName) || equipmentTargets.includes(nameAffilA) || equipmentTargets.includes(nameAffilB) || identityPhrases.some(p => equipmentTargets.includes(p)) || (charAffil.length > 2 && descCombined.includes(charAffil));
          if (!matchesTarget) return false;
        }
      }
      return true;
    });

    // exclusives
    const exclusiveCandidates = candidates.filter(isExclusiveForChar);
    if (exclusiveCandidates.length > 0) {
      exclusiveCandidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char));
      return { chosen: exclusiveCandidates[0], reason: 'exclusive' };
    }

    if (eqType === 'weapon') {
      const charWt = (char.weapon_type || '').toLowerCase();
      let wtCandidates = charWt ? candidates.filter(e => (e.weapon_type || '').toLowerCase() === charWt) : [];
      if (wtCandidates.length > 0) {
        const wtElCandidates = wtCandidates.filter(e => equipmentElementMatch(e, char));
        const pool = wtElCandidates.length > 0 ? wtElCandidates : wtCandidates;
        pool.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char));
        return { chosen: pool[0], reason: 'weapon+element/weapon' };
      }
    } else {
      const elCandidates = candidates.filter(e => equipmentElementMatch(e, char));
      if (elCandidates.length > 0) {
        elCandidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char));
        return { chosen: elCandidates[0], reason: 'element' };
      }
    }

    // fallback
    if (eqType === 'weapon') {
      candidates.sort((a, b) => scoreEquipment(b, char) - scoreEquipment(a, char));
      return { chosen: candidates[0] || null, reason: 'fallback-weapon' };
    } else {
      return { chosen: null, reason: 'no-element-match' };
    }
  }

  // If multiple IDs were provided, simulate a team auto-equip run using shared usedIds
  const argIds = process.argv.slice(2).map(a => parseInt(a, 10)).filter(Number.isFinite)
  if (argIds.length > 1) {
    const usedByType = { weapon: new Set(), armor: new Set(), accessory: new Set() }
    const assignments = []
    for (const id of argIds) {
      const c = pcArray.find(x => x.master_pc_id === id)
      if (!c) { assignments.push({ id, name: null, picks: null }); continue }
      const picks = {}
      for (const eqType of ['weapon', 'armor', 'accessory']) {
        const pick = pickForChar(c, eqType, usedByType[eqType])
        if (pick.chosen) usedByType[eqType].add(pick.chosen.id)
        picks[eqType] = pick
      }
      assignments.push({ id: c.master_pc_id, name: c.name, picks })
    }

    console.log('\nSimulated team auto-equip results:')
    for (const a of assignments) {
      console.log('\nChar:', a.id, a.name)
      if (!a.picks) { console.log('  not found') ; continue }
      for (const t of ['weapon', 'armor', 'accessory']) {
        const p = a.picks[t]
        console.log(`  ${t}: ${p.reason}${p.chosen ? ` -> ${p.chosen.id} ${p.chosen.name}` : ''}`)
      }
    }
  } else {
    const pickArmor = pickForChar(char, 'armor', new Set())
    console.log('\nSelection result for armor:', pickArmor.reason)
    if (pickArmor.chosen) console.log('  chosen:', pickArmor.chosen.id, pickArmor.chosen.name, '| effect1:', pickArmor.chosen.effect1)
    else console.log('  chosen: none (no element-matching armor found)')

    // accessory
    const pickAccessory = pickForChar(char, 'accessory', new Set())
    console.log('\nSelection result for accessory:', pickAccessory.reason)
    if (pickAccessory.chosen) console.log('  chosen:', pickAccessory.chosen.id, pickAccessory.chosen.name, '| effect1:', pickAccessory.chosen.effect1)
    else console.log('  chosen: none (no element-matching accessory found)')
  }

} catch (err) {
  console.error('Error:', err);
  process.exit(2);
}
