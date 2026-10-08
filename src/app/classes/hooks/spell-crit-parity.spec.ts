import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CharacterService } from '../../services/character.service';
import { ClassRegistryService } from '../../services/class-registry.service';
import { createDefaultCharacter } from '../../data/game-data';
import { classSpellHooks } from './registry';
import type { SpellCastContext } from './spell-hooks';

const SHAMAN_IDS = ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'];
const HUNTER_IDS = ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'];

describe('castSpell skeleton — parity crit/roll vs original', () => {
  let svc: CharacterService;
  let registry: ClassRegistryService;

  function makeScalar(ability: any) {
    const resType = svc.resourceConfig().type;
    const baseChance = parseFloat((resType === 'rage' || resType === 'energy' || resType === 'focus') ? svc.meleeCrit() : svc.spellCrit());
    const ctx: SpellCastContext = {
      svc,
      player: { sendDamagePayload: () => {} },
      t: (k) => k,
      ability,
      resType,
      isRage: resType === 'rage',
      isEnergy: resType === 'energy',
      isFocus: resType === 'focus',
      cost: 0,
      resourceActual: 0,
      resourceMax: 0,
      manaActual: 0,
      maelstormFree: false,
      lastWillRage: false,
      actionCost: 1,
      clearcast: false,
      roll: 100,
      critChance: baseChance,
      critMult: 1.5,
      isCrit: true,
      texts: {},
    };
    return { ctx, baseChance };
  }

  function setTalents(ranks: Record<string, number>) {
    svc.character.update(c => ({ ...c, talents: { ...(c.talents as any), ...ranks } }));
  }

  function setEffects(targets: string[]) {
    svc.character.update(c => ({
      ...c,
      activeEffects: [...(c.activeEffects || []).filter(e => !targets.includes(e.target)), ...targets.map((target, i) => ({
        id: i + 1,
        type: 'buff' as const,
        name: target,
        target,
        value: 0,
        duration: 3,
      }))],
    }));
  }

  function setFireOrbs(count: number) {
    for (let i = 0; i < count; i++) svc.addElementalOrb('fire');
  }

  function newClass(classKey: string) {
    svc.character.set(createDefaultCharacter(classKey, registry.getAll()));
  }

  function runHookedChance(ctx: SpellCastContext) {
    for (const h of classSpellHooks) h.modifyCritChance?.(ctx.ability, ctx);
    ctx.critChance += (ctx.ability.school === 'Fuego' && svc.hasEffect('combustion')) ? 50 : 0;
    ctx.critChance += svc.hasEffect('inner_focus') ? 25 : 0;
    return ctx.critChance;
  }

  function runHookedMult(ctx: SpellCastContext) {
    ctx.critMult = 1.5;
    for (const h of classSpellHooks) h.critMultEarly?.(ctx.ability, ctx);
    if (svc.hasEffect('demonic_form')) ctx.critMult = ctx.critMult * 1.25;
    if (svc.hasEffect('recklessness')) ctx.critMult = ctx.critMult * 1.20;
    if (svc.hasEffect('arcane_power')) ctx.critMult = ctx.critMult * 1.25;
    for (const h of classSpellHooks) h.critMultLate?.(ctx.ability, ctx);
    return ctx.critMult;
  }

  function runHookedRoll(ctx: SpellCastContext) {
    for (const h of classSpellHooks) h.modifyRoll?.(ctx.ability, ctx);
    return ctx.roll;
  }

  function refChance(ability: any, baseChance: number) {
    let critChance = baseChance;
    if (ability.castType === 'instant' && svc.character().classKey === 'mage') critChance += svc.talentRank('magic_resistance') * 2;
    if (ability.id === 'backstab' && svc.character().classKey === 'rogue') critChance += svc.talentRank('improved_backstab') * 10;
    if (ability.id === 'fire_blast' && svc.character().classKey === 'mage') critChance += svc.talentRank('improved_fire_blast') * 10;
    if (ability.school === 'Escarcha' && svc.character().classKey === 'mage') critChance += svc.talentRank('frost_power') * 2;
    if (ability.id === 'basic_attack' && svc.character().classKey === 'warrior') critChance += svc.talentRank('unyielding_strikes') * 1;
    if (ability.id === 'basic_attack' && svc.character().classKey === 'rogue') critChance += svc.talentRank('improved_energetic_attacks') * 1;
    if (svc.character().classKey === 'valkyrie') critChance += svc.talentRank('endurance') * 2;
    if (svc.character().classKey === 'bard' && ['scherzo', 'sforzando'].includes(ability.id)) critChance += svc.talentRank('rinforzando') * 4;
    if (svc.character().classKey === 'valkyrie') critChance += svc.talentRank('hurtfull_lightning') * 2;
    if (ability.type === 'heal' && !ability.isHot && !ability.isDot && svc.character().classKey === 'priest') critChance += svc.talentRank('illumination') * 2;
    if (ability.school === 'Fuego' && svc.hasEffect('combustion')) critChance += 50;
    if (svc.hasEffect('inner_focus')) critChance += 25;
    if (svc.character().classKey === 'hunter' && HUNTER_IDS.includes(ability.id)) {
      const hawkActive = (svc.character().activeEffects || []).some(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
      if (hawkActive) critChance += svc.talentRank('improved_aspect_of_the_hawk') * 4;
    }
    if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') critChance += svc.talentRank('destruction_specialization') * 5;
    if (svc.character().classKey === 'shaman' && (ability.id === 'lightning_bolt' || ability.id === 'chain_lightning')) critChance += svc.talentRank('thundering_strikes') * 5;
    if (svc.character().classKey === 'shaman' && svc.hasEffect('ascendance') && SHAMAN_IDS.includes(ability.id)) critChance += 5;
    return critChance;
  }

  function refMult(ability: any) {
    let critMult = 1.5;
    if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') critMult = 1.5 + svc.talentRank('destruction_specialization') * 0.10;
    if (svc.character().classKey === 'valkyrie' && ability.type === 'damage') critMult = critMult + svc.talentRank('hurtfull_lightning') * 0.05;
    if (svc.hasEffect('demonic_form')) critMult = critMult * 1.25;
    if (svc.hasEffect('recklessness')) critMult = critMult * 1.20;
    if (svc.hasEffect('arcane_power')) critMult = critMult * 1.25;
    if (svc.character().classKey === 'hunter' && HUNTER_IDS.includes(ability.id)) critMult = critMult * (1 + svc.talentRank('mortal_shots') * 0.05);
    if (svc.character().classKey === 'shaman' && SHAMAN_IDS.includes(ability.id)) critMult += svc.talentRank('elemental_fury') * 0.05;
    if (ability.school === 'Escarcha' && svc.character().classKey === 'mage') critMult += svc.talentRank('frost_power') * 0.10;
    if (svc.character().classKey === 'mage') critMult += svc.countElementalOrbs('fire') * (svc.hasEffect('combustion') ? 0.10 : 0.05);
    if (svc.character().classKey === 'shaman' && svc.hasEffect('ascendance') && SHAMAN_IDS.includes(ability.id)) critMult = critMult * 1.25;
    if (svc.character().classKey === 'rogue') critMult += svc.talentRank('lethality') * 0.05;
    return critMult;
  }

  function runHookedCost(ctx: SpellCastContext, baseCost: number) {
    ctx.cost = baseCost;
    ctx.maelstormFree = svc.isMaelstormReady() && ctx.ability.castType === 'cast';
    for (const h of classSpellHooks) h.modifyCost?.(ctx.ability, ctx);
    return ctx.cost;
  }

  function refCost(ability: any, baseCost: number) {
    let cost = baseCost;
    if (ability.id === 'vivace') cost = Math.round((cost || 0) * (1 - svc.talentRank('improved_vivace') * 0.10));
    if (svc.character().classKey === 'druid' && svc.selectedCapstone() === 'nature_guardian' && (ability.id === 'sunfall' || ability.id === 'starsurge')) cost = 0;
    const mFree = svc.isMaelstormReady() && ability.castType === 'cast';
    if (mFree) cost = Math.round((cost || 0) * 0.5 * (1 - svc.talentRank('maelstrom_efficiency') * 0.15));
    return cost;
  }

  function refRoll(ability: any) {
    let roll = 100;
    if (ability.id === 'shield_bash' && svc.character().classKey === 'valkyrie') {
      const wardedRank = svc.talentRank('warded');
      if (wardedRank > 0) roll = Math.round(roll * (1 + wardedRank * 0.10));
    }
    if (ability.id === 'cone_of_cold' && svc.character().classKey === 'mage') {
      const iccRank = svc.talentRank('improved_cone_of_cold');
      if (iccRank > 0) roll = Math.round(roll * (1 + iccRank * 0.15));
    }
    return roll;
  }

  interface Scenario {
    name: string;
    classKey: string;
    ability: any;
    talents?: Record<string, number>;
    effects?: string[];
    fireOrbs?: number;
    capstone?: string;
    maelstromReady?: boolean;
  }

  const scenarios: Scenario[] = [
    { name: 'mage fire_blast instant + combustion + orbes', classKey: 'mage', ability: { id: 'fire_blast', castType: 'instant', school: 'Fuego', type: 'damage' }, talents: { magic_resistance: 2, improved_fire_blast: 3, frost_power: 2 }, effects: ['combustion'], fireOrbs: 2 },
    { name: 'mage cone_of_cold frost + arcane_power (orden mult-then-add)', classKey: 'mage', ability: { id: 'cone_of_cold', castType: 'cast', school: 'Escarcha', type: 'damage' }, talents: { frost_power: 3, improved_cone_of_cold: 2 }, effects: ['arcane_power'] },
    { name: 'mage basic sin mods', classKey: 'mage', ability: { id: 'basic_attack', type: 'damage', damageType: 'physical' } },
    { name: 'rogue backstab', classKey: 'rogue', ability: { id: 'backstab', castType: 'instant', type: 'damage' }, talents: { improved_backstab: 4, lethality: 2 } },
    { name: 'rogue basic_attack energetico', classKey: 'rogue', ability: { id: 'basic_attack', type: 'damage', damageType: 'physical' }, talents: { improved_energetic_attacks: 3 } },
    { name: 'warrior basic + recklessness', classKey: 'warrior', ability: { id: 'basic_attack', type: 'damage', damageType: 'physical' }, talents: { unyielding_strikes: 3 }, effects: ['recklessness'] },
    { name: 'valkyrie empalar (early add + chance)', classKey: 'valkyrie', ability: { id: 'empalar', type: 'damage' }, talents: { endurance: 2, hurtfull_lightning: 3 } },
    { name: 'valkyrie shield_bash (roll + chance)', classKey: 'valkyrie', ability: { id: 'shield_bash', type: 'damage' }, talents: { endurance: 2, hurtfull_lightning: 2, warded: 4 } },
    { name: 'bard scherzo', classKey: 'bard', ability: { id: 'scherzo', type: 'damage' }, talents: { rinforzando: 3 } },
    { name: 'priest heal illumination', classKey: 'priest', ability: { id: 'heal', type: 'heal', isHot: false, isDot: false }, talents: { illumination: 2 } },
    { name: 'hunter aimed_shot hawk + mortal_shots', classKey: 'hunter', ability: { id: 'aimed_shot', castType: 'cast', type: 'damage' }, talents: { improved_aspect_of_the_hawk: 2, mortal_shots: 4 } },
    { name: 'warlock chaos_bolt + demonic_form (assign-then-mult)', classKey: 'warlock', ability: { id: 'chaos_bolt', castType: 'cast', type: 'damage' }, talents: { destruction_specialization: 4 }, effects: ['demonic_form'] },
    { name: 'shaman lightning_bolt + ascendance (add-then-mult)', classKey: 'shaman', ability: { id: 'lightning_bolt', castType: 'cast', type: 'damage' }, talents: { thundering_strikes: 3, elemental_fury: 2 }, effects: ['ascendance'] },
    { name: 'shaman flame_shock sin ascendance', classKey: 'shaman', ability: { id: 'flame_shock', castType: 'instant', type: 'damage', school: 'Fuego' }, talents: { elemental_fury: 5 } },
    { name: 'druid sunfall sin mods crit', classKey: 'druid', ability: { id: 'sunfall', castType: 'cast', type: 'damage', school: 'Arcano' } },
    { name: 'bard vivace coste reducido', classKey: 'bard', ability: { id: 'vivace', castType: 'cast', type: 'heal', isHot: false, isDot: false }, talents: { improved_vivace: 3 } },
    { name: 'druid nature_guardian sunfall coste 0', classKey: 'druid', ability: { id: 'sunfall', castType: 'cast', type: 'damage', school: 'Arcano' }, capstone: 'nature_guardian' },
    { name: 'shaman maelstorm coste reducido', classKey: 'shaman', ability: { id: 'lightning_bolt', castType: 'cast', type: 'damage' }, talents: { maelstrom_efficiency: 2 }, effects: ['ascendance'], maelstromReady: true },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CharacterService);
    registry = TestBed.inject(ClassRegistryService);
  });

  for (const s of scenarios) {
    it(`paridad ${s.name}`, () => {
      newClass(s.classKey);
      if (s.talents) setTalents(s.talents);
      if (s.effects) setEffects(s.effects);
      if (s.fireOrbs) setFireOrbs(s.fireOrbs);
      if (s.capstone) svc.character.update(c => ({ ...c, capstone: s.capstone as any }));
      if (s.maelstromReady) svc.character.update(c => ({ ...c, comboPoints: svc.getMaelstromMax() }));

      const { ctx, baseChance } = makeScalar(s.ability);

      expect(runHookedCost(ctx, 40)).toBe(refCost(s.ability, 40));
      expect(runHookedChance(ctx)).toBe(refChance(s.ability, baseChance));
      expect(runHookedMult(ctx)).toBe(refMult(s.ability));
      expect(runHookedRoll(ctx)).toBe(refRoll(s.ability));
    });
  }
});
