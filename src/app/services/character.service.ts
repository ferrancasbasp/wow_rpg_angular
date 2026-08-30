import { Injectable, signal, computed, inject } from '@angular/core';
import { Character, CharacterClass, Stats, StatKey, Ability, ActiveEffect, Pet, ActivePet, Capstone } from '../models/game.models';
import { ClassRegistryService } from './class-registry.service';
import { FirebaseService } from './firebase.service';
import { STAT_KEYS, MAX_LEVEL, xpForLevel, createDefaultCharacter, STORAGE_KEY, EQUIPMENT_SLOTS } from '../data/game-data';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private classRegistry = inject(ClassRegistryService);
  private firebase = inject(FirebaseService);

  readonly character = signal<Character>(createDefaultCharacter('shaman', this.classRegistry.getAll()));
  readonly toastMessage = signal('');
  readonly turnNumber = signal(1);
  readonly turnDamage = signal(0);
  readonly actionsUsed = signal(0);

  addTurnDamage(amount: number) {
    this.turnDamage.update(n => n + amount);
  }

  maxActions = computed<number>(() => {
    const effects = this.character().activeEffects || [];
    const hasSnD = effects.some(e => e.name === 'Slice and Dice');
    const loneWolf = this.selectedCapstone() === 'lone_wolf' ? 1 : 0;
    return (hasSnD ? 3 : 2) + loneWolf;
  });

  canAct(cost: number): boolean {
    return this.actionsUsed() + cost <= this.maxActions();
  }

  useAction(cost: number) {
    this.actionsUsed.update(n => n + cost);
  }
  readonly warriorStance = signal<string>('battle');
  readonly warriorWeaponMode = signal<string>('twohanded');

  private toastTimeout: any;

  readonly classConfig = computed<CharacterClass>(() => {
    return this.classRegistry.get(this.character().classKey) || this.classRegistry.get('shaman')!;
  });

  readonly finalStats = computed<Stats>(() => {
    const cls = this.classConfig();
    const growth = cls.statGrowth || {};
    const level = this.character().level;
    const result = {} as Stats;
    for (const key of Object.values(STAT_KEYS)) {
      const perLevel = (growth as any)[key] || 0;
      result[key] = this.character().baseStats[key] + Math.floor((level - 1) * perLevel);
      result[key] += this.gearStatBonus(key);
      result[key] += this.effectStatBonus(key);
      if (key === 'agilidad' && this.character().classKey === 'bard') {
        const ballerino = this.talentRank('ballerino');
        if (ballerino > 0) result[key] = Math.round(result[key] * (1 + ballerino * 0.02));
      }
      if (this.selectedCapstone() === 'gift_of_the_wild') {
        result[key] += level;
      }
    }
    return result;
  });

  readonly maxHP = computed<number>(() => {
    const cls = this.classConfig();
    let hp = Math.round(cls.formulas.hp(this.finalStats(), this.character().level));
    if (this.character().classKey === 'hunter') {
      hp = Math.round(hp * (1 + this.talentRank('survivalist') * 0.03));
    }
    if (this.selectedCapstone() === 'hope_and_grace') {
      hp += 10 * this.character().level;
    }
    const effects = this.character().activeEffects;
    if (effects) {
      for (const eff of effects) {
        if (eff.type === 'buff' && eff.target === 'maxHP') {
          if (eff.isPercent) hp = Math.round(hp * (1 + eff.value / 100));
          else hp += eff.value;
        }
      }
    }
    const demonicEmbrace = this.talentRank('demonic_embrace');
    if (demonicEmbrace > 0 && (effects || []).some(e => e.type === 'buff' && e.name === 'Fel Armor')) {
      hp = Math.round(hp * (1 + demonicEmbrace * 0.10));
    }
    return hp;
  });

  readonly maxMana = computed<number>(() => {
    return Math.round(this.classConfig().formulas.mana(this.finalStats(), this.character().level));
  });

  readonly baseMana = computed<number>(() => {
    const cls = this.classConfig();
    const lvl = this.character().level;
    const growth = cls.statGrowth || {};
    const baseInt = (cls.baseStats.intelecto || 0) + Math.floor((lvl - 1) * (growth.intelecto || 0));
    const baseStatsForMana = { ...cls.baseStats, intelecto: baseInt } as Stats;
    return Math.round(cls.formulas.mana(baseStatsForMana, lvl));
  });

  readonly baseSpellPower = computed<number>(() => {
    return this.classConfig().formulas.spellPower(this.finalStats());
  });

  readonly spellPower = computed<number>(() => {
    let sp = this.baseSpellPower();
    const stormPower = this.talentRank('storm_power');
    sp = Math.round(sp * (1 + stormPower * 0.10));
    const balanceOfNature = this.talentRank('balance_of_nature');
    if (balanceOfNature > 0) {
      sp += Math.round(this.finalStats().espiritu * 0.10 * balanceOfNature);
    }
    if (this.selectedCapstone() === 'hope_and_grace') {
      sp += Math.round(this.finalStats().espiritu * 0.20);
    }
    sp += this.effectStatBonus('spellPower');
    const effects = this.character().activeEffects;
    if (effects) {
      for (const eff of effects) {
        if (eff.type === 'buff' && eff.target === 'spellPower' && eff.isPercent) {
          sp = Math.round(sp * (1 + eff.value / 100));
        }
      }
    }
    if (this.hasEffect('demonic_form')) {
      sp = Math.round(sp * 1.25);
    }
    if (this.hasEffect('arcane_power')) {
      sp = Math.round(sp * 1.20);
    }
    return sp;
  });

  readonly spellCrit = computed<string>(() => {
    const fromInt = this.finalStats().intelecto / 60;
    const fromLevel = this.character().level * 0.02;
    const fromTalent = this.talentRank('call_of_thunder') + this.talentRank('spell_crit_talent') + this.talentRank('natural_perfection') * 2 + this.talentRank('preservation');
    const fromBuff = this.effectStatBonus('spellCrit');
    const fromMoonkin = this.hasEffect('moonkin') ? 5 : 0;
    const fromDemonic = this.hasEffect('demonic_form') ? 25 : 0;
    return (5 + fromInt + fromLevel + fromTalent + fromBuff + fromMoonkin + fromDemonic).toFixed(2);
  });

  readonly meleeCrit = computed<string>(() => {
    const fromAgi = this.finalStats().agilidad / 20;
    const fromLevel = this.character().level * 0.02;
    const impStances = this.talentRank('improved_stances');
    const stanceBonus = this.warriorStance() === 'fury' ? (5 + impStances * 2) : 0;
    const fromTalent = this.talentRank('cruelty') + this.talentRank('precision');
    const fromBuff = this.effectStatBonus('physCrit');
    const fromReckless = this.hasEffect('recklessness') ? 20 : 0;
    return (5 + fromAgi + fromLevel + stanceBonus + fromTalent + fromBuff + fromReckless).toFixed(2);
  });

  readonly attackPower = computed<number>(() => {
    let total = this.classConfig().formulas.attackPower(this.finalStats());
    total += this.effectStatBonus('attackPower');
    return total;
  });

  readonly evasion = computed<number>(() => {
    let total = 5;
    total += this.effectStatBonus('evasion');
    total += this.talentRank('quick_fingers') * 2;
    return Math.min(95, total);
  });

  readonly manaRegen = computed<number>(() => {
    const cls = this.classConfig();
    if (!cls.formulas.manaRegen) return 0;
    let regen = cls.formulas.manaRegen(this.finalStats(), this.character().level);
    regen = Math.round(regen * (1 + this.talentRank('holyness') * 0.05));
    return regen;
  });

  readonly armorTotal = computed<number>(() => {
    let total = this.classConfig().armor || 0;
    total += this.talentRank('anticipation') * 2;
    if (this.warriorStance() === 'protection' && this.classConfig().stances) total += 5 + this.talentRank('improved_stances') * 4;
    const effects = this.character().activeEffects;
    if (effects) {
      for (const eff of effects) {
        if (eff.type === 'buff' && eff.target === 'armor') total += eff.value;
        if (eff.type === 'buff' && eff.target === 'moonkin') total += 10;
      }
    }
    return total;
  });

  readonly magicResistTotal = computed<number>(() => {
    let total = this.classConfig().magicResist || 0;
    total += this.talentRank('magic_resistance');
    total += this.talentRank('preservation') * 5;
    total += this.talentRank('anticipation') * 2;
    const effects = this.character().activeEffects;
    if (effects) {
      for (const eff of effects) {
        if (eff.type === 'buff' && eff.target === 'magicResist') total += eff.value;
      }
    }
    return total;
  });

  readonly physReduction = computed<number>(() => {
    const armor = this.armorTotal();
    const lvl = this.character().level;
    return Math.round((armor / (armor + 50 + 5 * lvl)) * 100);
  });

  readonly magicReduction = computed<number>(() => {
    const resist = this.magicResistTotal();
    const lvl = this.character().level;
    return Math.round((resist / (resist + 50 + 5 * lvl)) * 100);
  });

  readonly spentTalentPoints = computed<number>(() => {
    if (!this.character().talents) return 0;
    return Object.values(this.character().talents).reduce((s, v) => s + v, 0);
  });

  readonly totalTalentPoints = computed<number>(() => {
    return Math.max(0, this.character().level - 9);
  });

  readonly availableTalentPoints = computed<number>(() => {
    return this.totalTalentPoints() - this.spentTalentPoints();
  });

  readonly tiers = computed<number[]>(() => {
    return [...new Set(this.classConfig().talents.map(t => t.tier))].sort();
  });

  readonly xpForNextLevel = computed<number>(() => {
    if (this.character().level >= MAX_LEVEL) return 0;
    return xpForLevel(this.character().level);
  });

  readonly xpProgressPercent = computed<number>(() => {
    if (this.xpForNextLevel() === 0) return 100;
    const current = this.character().currentXP || 0;
    return Math.min(100, Math.floor((current / this.xpForNextLevel()) * 100));
  });

  readonly hpActual = computed<number>(() => {
    const char = this.character();
    if (char.currentHP === null || char.currentHP === undefined) return this.maxHP();
    return Math.max(0, Math.min(this.maxHP(), char.currentHP));
  });

  readonly manaActual = computed<number>(() => {
    const char = this.character();
    if (char.currentMana === null || char.currentMana === undefined) return this.maxMana();
    return Math.max(0, Math.min(this.maxMana(), char.currentMana));
  });

  readonly hpPercent = computed<number>(() => {
    return Math.floor((this.hpActual() / this.maxHP()) * 100);
  });

  readonly manaPercent = computed<number>(() => {
    if (this.maxMana() === 0) return 0;
    return Math.floor((this.manaActual() / this.maxMana()) * 100);
  });

  readonly resourceConfig = computed(() => {
    return this.classConfig().resource;
  });

  readonly resourceMax = computed<number>(() => {
    const rc = this.resourceConfig();
    if (rc.type === 'rage') return rc.max || 100;
    if (rc.type === 'energy') return (rc.max || 100) + this.talentRank('energetic') * 4;
    if (rc.type === 'focus') return rc.max || 100;
    return this.maxMana();
  });

  readonly resourceActual = computed<number>(() => {
    const rc = this.resourceConfig();
    const char = this.character();
    if (rc.type === 'rage') return Math.max(0, Math.min(this.resourceMax(), char.currentRage || 0));
    if (rc.type === 'energy') return Math.max(0, Math.min(this.resourceMax(), char.currentEnergy ?? 100));
    if (rc.type === 'focus') return Math.max(0, Math.min(this.resourceMax(), char.currentFocus ?? 100));
    return this.manaActual();
  });

  readonly resourcePercent = computed<number>(() => {
    if (this.resourceMax() === 0) return 0;
    return Math.floor((this.resourceActual() / this.resourceMax()) * 100);
  });

  readonly totalWeaponDamage = computed<number>(() => {
    const char = this.character();
    if (!char.equipment) return 0;
    if (char.classKey === 'warrior' && this.talentRank('master_of_weapons') > 0 && this.warriorWeaponMode() === 'twohanded') {
      return char.equipment.twoHand?.weaponDamage || 0;
    }
    if (char.classKey === 'hunter') {
      return char.equipment.ranged?.weaponDamage || 0;
    }
    const main = char.equipment.mainHand?.weaponDamage || 0;
    const off = char.equipment.offHand?.weaponDamage || 0;
    return main + off;
  });

  readonly computedAbilities = computed<Ability[]>(() => {
    const cls = this.classConfig();
    return cls.abilities.filter(a => a.type !== 'utility').map(ability => {
      let value = (ability.baseDamage || 0) + this.spellPower() * (ability.spellPowerRatio || 0);
      const talentNotes: string[] = [];

      const convection = this.talentRank('convection');
      if (convection > 0) { value *= (1 + convection * 0.03); talentNotes.push(`+${convection * 3}% Conv.`); }

      if (ability.school === 'Naturaleza') {
        const lm = this.talentRank('lightning_mastery');
        if (lm > 0) { value *= (1 + lm * 0.05); talentNotes.push(`+${lm * 5}% Maestría`); }
      }

      if (ability.id === 'lightning_bolt') {
        const ilb = this.talentRank('improved_lightning_bolt');
        if (ilb > 0) { value *= (1 + ilb * 0.05); talentNotes.push(`+${ilb * 5}% Descarga`); }
      }

      const elemMastery = this.talentRank('elemental_mastery');
      if (elemMastery > 0) { value *= (1 + elemMastery * 0.02); talentNotes.push(`+${elemMastery * 2}% Maestría`); }

      if (ability.school === 'Escarcha') {
        const fp = this.talentRank('frost_power');
        if (fp > 0) { value *= (1 + fp * 0.02); talentNotes.push(`+${fp * 2}% Escarcha`); }
        const ifb = this.talentRank('improved_frostbolt');
        if (ifb > 0 && ability.id === 'frostbolt') { value *= (1 + ifb * 0.10); talentNotes.push(`+${ifb * 10}% Imp Frostbolt`); }
      }

      if (ability.castType === 'cast') {
        const cm = this.talentRank('casting_master');
        if (cm > 0) { value *= (1 + cm * 0.05); talentNotes.push(`+${cm * 5}% Casting Master`); }
      }

      let cost = (ability.costPct || 0) * this.baseMana();
      const ef = this.talentRank('elemental_focus');
      if (ef > 0) cost *= (1 - ef * 0.02);
      const me = this.talentRank('mana_efficiency');
      if (me > 0) cost *= (1 - me * 0.03);
      if (ability.type === 'heal' && this.character().classKey === 'bard') {
        const harmonioso = this.talentRank('harmonioso');
        if (harmonioso > 0) cost *= (1 - harmonioso * 0.05);
      }
      if (ability.id === 'staccato') {
        const isRank = this.talentRank('improved_staccato');
        if (isRank > 0) {
          value *= (1 + isRank * 0.05);
          cost *= (1 - isRank * 0.10);
          talentNotes.push(`+${isRank * 5}% Imp Staccato`);
        }
      }
      if (ability.id === 'wrath') {
        const iw = this.talentRank('improved_wrath');
        if (iw > 0) { value *= (1 + iw * 0.03); talentNotes.push(`+${iw * 3}% Imp Wrath`); }
      }
      if (ability.id === 'moonfire') {
        const im = this.talentRank('improved_moonfire');
        if (im > 0) { value *= (1 + im * 0.10); talentNotes.push(`+${im * 10}% Moonfire`); }
      }
      if (ability.id === 'rejuvenation') {
        const ir = this.talentRank('improved_rejuvenation');
        if (ir > 0) { value *= (1 + ir * 0.07); talentNotes.push(`+${ir * 7}% Rejuv`); }
      }
      if (['wrath', 'moonfire'].includes(ability.id)) {
        const nr = this.talentRank('natures_remains');
        if (nr > 0) cost *= (1 - nr * 0.05);
      }

      return {
        ...ability,
        computedDamage: Math.round(value),
        computedCost: Math.round(cost),
        talentNote: talentNotes.join(' · ') || null,
      } as Ability;
    });
  });

  readonly unlockedAbilities = computed<Ability[]>(() => {
    const weaponDmg = this.totalWeaponDamage();
    const apBonus = Math.round(this.attackPower() / 7);
    return this.computedAbilities().filter(a => a.type !== 'utility' && !a.isPetSummon && !a.petAbility && this.trainedRank(a.id) > 0).map(a => {
      const rank = this.trainedRank(a.id);
      const dmgRange = a.damageRanges?.find(dr => dr.rank === rank);
      const isPhysical = a.damageType === 'physical';
      const noWeaponScaling = a.dotScales || a.baseDamage === 0 || a.noWeaponScaling;
      const dmgBonus = (isPhysical && !noWeaponScaling) ? (weaponDmg + apBonus) : 0;
      const spBonus = ((!isPhysical || a.spellPowerRatio) && !a.usesWeaponDamage) ? Math.round(this.spellPower() * (a.spellPowerRatio || 0) * (a.type === 'heal' ? 1.5 : 1)) : 0;
      let minVal: number, maxVal: number;
      if (a.usesWeaponDamage) {
        const base = weaponDmg + apBonus;
        minVal = Math.round(base * 0.50);
        maxVal = Math.round(base * 1.50);
      } else if (a.bonusPerRank) {
        const mult = a.weaponMultiplier || 1.0;
        const bonus = a.bonusPerRank[rank - 1] || 0;
        const base = Math.round(weaponDmg * mult) + apBonus + bonus;
        minVal = Math.round(base * 0.50);
        maxVal = Math.round(base * 1.50);
      } else {
        let spellMult = 1;
        const comp = this.computedAbilities().find(c => c.id === a.id);
        const compDamage = comp ? (comp as any).computedDamage : undefined;
        if (typeof compDamage === 'number') {
          const base = (a.baseDamage || 0) + this.spellPower() * (a.spellPowerRatio || 0);
          if (base > 0) spellMult = compDamage / base;
        }
        minVal = dmgRange ? Math.round((dmgRange.min + dmgBonus + spBonus) * spellMult) : 0;
        maxVal = dmgRange ? Math.round((dmgRange.max + dmgBonus + spBonus) * spellMult) : 0;
      }
      if (a.id === 'cleave') {
        const cleaveBonus = 1 + this.talentRank('improved_cleave') * 0.20;
        minVal = Math.round(minVal * cleaveBonus);
        maxVal = Math.round(maxVal * cleaveBonus);
      }
      if (['backstab', 'garrote', 'ambush'].includes(a.id)) {
        const oppBonus = 1 + this.talentRank('opportunity') * 0.04;
        minVal = Math.round(minVal * oppBonus);
        maxVal = Math.round(maxVal * oppBonus);
      }
      if (a.id === 'basic_attack' && this.character().classKey === 'rogue') {
        const ebaBonus = 1 + this.talentRank('energetic_basic_attack') * 0.02;
        minVal = Math.round(minVal * ebaBonus);
        maxVal = Math.round(maxVal * ebaBonus);
      }
      if (a.category === 'shadow') {
        const shadowBonus = 1 + this.talentRank('shadow_ally') * 0.03;
        minVal = Math.round(minVal * shadowBonus);
        maxVal = Math.round(maxVal * shadowBonus);
      }
      if (this.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(a.id)) {
        let hunterMult = 1 + this.talentRank('ranged_weapon_spec') * 0.05;
        if (this.selectedCapstone() === 'lone_wolf') hunterMult *= 1.20;
        minVal = Math.round(minVal * hunterMult);
        maxVal = Math.round(maxVal * hunterMult);
      }
      if (['shadow_bolt', 'drain_life'].includes(a.id)) {
        const shadowMasteryBonus = 1 + this.talentRank('shadow_mastery') * 0.05;
        minVal = Math.round(minVal * shadowMasteryBonus);
        maxVal = Math.round(maxVal * shadowMasteryBonus);
      }
      const dotRange = a.dotRanges?.find(dr => dr.rank === rank);
      let hotTick = 0, hotDuration = 0, hotTotal = 0;
      if (a.isHot) {
        const baseDuration = a.hotDuration || 1;
        hotDuration = baseDuration + this.talentRank('improved_renew');
        const healBonus = 1 + this.talentRank('healing_focus') * 0.02;
        let rejuvBonus = 1;
        if (a.id === 'rejuvenation') {
          rejuvBonus = 1 + this.talentRank('improved_rejuvenation') * 0.07;
        }
        hotTick = Math.round(minVal * healBonus * rejuvBonus / baseDuration);
        hotTotal = hotTick * hotDuration;
      }
      let dotTick = 0, dotDuration = 0, dotTotal = 0;
      if (a.isDot) {
        const baseDotDuration = a.dotDuration || 1;
        dotDuration = baseDotDuration;
        if (a.id === 'corruption' || a.id === 'curse_of_agony' || a.id === 'immolate') {
          dotDuration += this.talentRank('dot_master');
        }
        dotTotal = minVal;
        if (a.id === 'shadow_word_pain') {
          dotTotal = Math.round(dotTotal * (1 + this.talentRank('improved_pain') * 0.10));
        }
        if (a.id === 'garrote') {
          dotTotal = Math.round(dotTotal * (1 + this.talentRank('improved_garrote') * 0.20));
        }
        dotTick = Math.round(dotTotal / baseDotDuration);
      }
      return {
        ...a,
        currentRank: rank,
        currentMin: minVal,
        currentMax: maxVal,
        currentDotValue: dotRange ? dotRange.value : (a.inflictsEffects ? a.inflictsEffects[0].value : 0),
        currentDotDuration: dotRange ? dotRange.duration : (a.inflictsEffects ? a.inflictsEffects[0].duration : 0),
        hotTick, hotDuration, hotTotal, dotTick, dotDuration, dotTotal,
        scaledCost: Math.round((a as any).computedCost * (1 + (rank - 1) * 0.15)),
        effectiveRageCost: this.getEffectiveRageCost(a),
        effectiveRageGen: this.getEffectiveRageGen(a),
      } as any;
    });
  });

  readonly unlockedUtility = computed<any[]>(() => {
    const resType = this.resourceConfig().type;
    const isRage = resType === 'rage';
    const isEnergy = resType === 'energy';
    const isFocus = resType === 'focus';
    return this.classConfig().abilities.filter(a => a.type === 'utility' && !a.petAbility && (a.capstoneGate ? this.selectedCapstone() === a.capstoneGate : this.trainedRank(a.id) > 0)).map(a => {
      const rank = this.trainedRank(a.id);
      const buffRank = a.buffRanks?.find(br => br.rank === rank);
      let cost: number;
      if (isRage) cost = buffRank ? (buffRank.costRage ?? a.costRage ?? 0) : (a.costRage || 0);
      else if (isEnergy) {
        cost = buffRank ? (buffRank.costEnergy ?? a.costEnergy ?? 0) : (a.costEnergy || 0);
        if (a.spendsCombo) cost = Math.max(0, cost - this.talentRank('ruthlessness') * 2);
      }
      else if (isFocus) cost = buffRank ? (buffRank.costFocus ?? a.costFocus ?? 0) : (a.costFocus || 0);
      else cost = Math.round(((buffRank ? buffRank.costPct : a.costPct) || 0) * this.baseMana());

      let buffValue = buffRank ? buffRank.value : (a.buff ? (a.buff as any).value : 0);
      if (a.id === 'power_word_fortitude') buffValue = Math.round(buffValue * (1 + this.talentRank('improved_fortitude') * 0.15));
      if (a.id === 'power_word_shield') buffValue = Math.round(buffValue * (1 + this.talentRank('improved_shield') * 0.10));
      if (a.id === 'mark_of_the_wild') buffValue = Math.round(buffValue * (1 + this.talentRank('improved_mark_of_the_wild') * 0.15));

      return {
        ...a,
        currentRank: rank,
        scaledCost: cost,
        currentBuffValue: buffValue,
        currentBuffDuration: a.buff ? a.buff.duration : 1,
        currentBuffStat: a.buff ? a.buff.stat : '',
        currentMin: Math.round((a.damageRanges?.find(dr => dr.rank === rank)?.min || 0) + (a.spellPowerRatio ? this.spellPower() * a.spellPowerRatio : 0)),
        currentMax: Math.round((a.damageRanges?.find(dr => dr.rank === rank)?.max || 0) + (a.spellPowerRatio ? this.spellPower() * a.spellPowerRatio : 0)),
      };
    });
  });

  readonly trainableAbilities = computed<Ability[]>(() => {
    return this.classConfig().abilities.filter(a => {
      if (a.capstoneGate) return false;
      if (a.type === 'utility') {
        if (a.buffRanks) {
          const maxBR = a.buffRanks.filter(br => this.character().level >= br.level).length;
          return maxBR > this.trainedRank(a.id);
        }
        if (a.damageRanges) {
          const maxRank = this.maxAvailableRank(a);
          return maxRank > 0 && this.trainedRank(a.id) < maxRank;
        }
        return this.character().level >= a.requiredLevel && this.trainedRank(a.id) === 0;
      }
      const maxRank = this.maxAvailableRank(a);
      return maxRank > 0 && this.trainedRank(a.id) < maxRank;
    });
  });

  readonly canTrain = computed<boolean>(() => this.trainableAbilities().length > 0);

  readonly unlockedPetAbilities = computed<Ability[]>(() => {
    const c = this.character();
    if (!c.activePet && !c.companionPet) return [];
    const cls = this.classConfig();
    const petIds = [c.activePet?.petId, c.companionPet?.petId].filter(Boolean);
    return cls.abilities.filter(a => a.petAbility && petIds.includes(a.petAbility) && this.trainedRank(a.id) > 0).map(a => {
      const rank = this.trainedRank(a.id);
      const buffRank = a.buffRanks?.find(br => br.rank === rank);
      const buffValue = buffRank ? buffRank.value : 0;
      const petManaCost = Math.round(this.petMaxMana() * 0.15);
      return {
        ...a,
        currentRank: rank,
        scaledCost: petManaCost,
        currentBuffValue: buffValue,
        currentBuffDuration: a.buff ? a.buff.duration : 1,
        currentBuffStat: a.buff ? a.buff.stat : '',
      };
    });
  });

  // ==================== HELPER METHODS ====================

  talentRank(id: string): number {
    return this.character().talents?.[id] || 0;
  }

  trainedRank(abilityId: string): number {
    return this.character().trainedRanks?.[abilityId] || 0;
  }

  isMaxed(talentId: string, maxRank: number): boolean {
    return this.talentRank(talentId) >= maxRank;
  }

  tierPointsSpent(tier: number): number {
    return this.classConfig().talents.filter(t => t.tier === tier).reduce((sum, t) => sum + this.talentRank(t.id), 0);
  }

  tierUnlocked(tier: number): boolean {
    if (tier <= 1) return true;
    let total = 0;
    for (let t = 1; t < tier; t++) total += this.tierPointsSpent(t);
    return total >= (tier - 1) * 5;
  }

  prereqMet(talent: any): boolean {
    if (!this.tierUnlocked(talent.tier)) return false;
    if (!talent.requires) return true;
    return this.talentRank(talent.requires.id) >= talent.requires.points;
  }

  canAddTalent(talent: any): boolean {
    if (talent.passive) return false;
    return this.availableTalentPoints() > 0 && !this.isMaxed(talent.id, talent.maxRank) && this.prereqMet(talent);
  }

  maxAvailableRank(ability: Ability): number {
    if (ability.damageRanges) {
      let rank = 0;
      for (const dr of ability.damageRanges) if (this.character().level >= dr.level) rank = dr.rank;
      return rank;
    }
    const rankLevels = [ability.requiredLevel, ability.requiredLevel + 8, ability.requiredLevel + 16, ability.requiredLevel + 24];
    let rank = 0;
    for (let i = 0; i < rankLevels.length; i++) if (this.character().level >= rankLevels[i]) rank = i + 1;
    return rank;
  }

  getCooldown(abilityId: string): number {
    return this.character().currentCooldowns?.[abilityId] || 0;
  }

  getEffectiveCooldown(ability: Ability): number {
    let cd = ability.cooldown;
    if (ability.id === 'fire_blast') cd -= this.talentRank('improved_fire_blast');
    if (ability.id === 'blink') cd -= this.talentRank('improved_blink');
    if (['evasion', 'sprint'].includes(ability.id)) cd -= this.talentRank('endurance');
    if (ability.id === 'kill_command') cd -= this.talentRank('improved_kill_command');
    if (ability.id === 'mind_blast' && this.talentRank('improved_mind_blast') > 0) cd -= 1;
    return Math.max(0, cd);
  }

  getEffectiveRageCost(ability: any): number {
    let cost = ability.costRage || 0;
    if (ability.id === 'heroic_strike') cost -= this.talentRank('improved_heroic_strike');
    if (ability.id === 'shout') cost -= this.talentRank('improved_battle_shout') * 2;
    return Math.max(0, cost);
  }

  getEffectiveEnergyCost(ability: any): number {
    let cost = ability.costEnergy || 0;
    if (ability.spendsCombo) cost -= this.talentRank('ruthlessness') * 2;
    if (ability.id === 'backstab') cost -= this.talentRank('improved_backstab') * 3;
    return Math.max(0, cost);
  }

  getEffectiveFocusCost(ability: any): number {
    let cost = ability.costFocus || 0;
    if (ability.id === 'aimed_shot') cost -= this.talentRank('improved_aimed_shot') * 5;
    if (ability.id === 'aimed_shot') {
      const lnl = (this.character().activeEffects || []).find(e => e.type === 'buff' && e.name === 'Lock and Load');
      if (lnl && lnl.value) cost -= lnl.value;
    }
    return Math.max(0, cost);
  }

  getEffectiveRageGen(ability: any): number {
    let gen = ability.generatesRage || 0;
    if (ability.id === 'charge') gen += this.talentRank('improved_charge') * 2;
    return gen;
  }

  getEffectiveComboChance(ability: any): number {
    return ability.generatesComboChance ?? 100;
  }

  getEffectiveRageGain(ability: any): number {
    let gain = (ability as any).rageGain || 0;
    return gain;
  }

  getBloodrageTickRage(): number {
    return 3 + this.talentRank('improved_bloodrage') * 5;
  }

  gearStatBonus(key: string): number {
    const eq = this.character().equipment;
    if (!eq) return 0;
    let total = 0;
    for (const slot of Object.values(eq)) {
      total += (slot.bonus as any)?.[key] || 0;
    }
    return total;
  }

  effectStatBonus(key: string): number {
    const effects = this.character().activeEffects;
    if (!effects) return 0;
    let total = 0;
    for (const eff of effects) {
      if (eff.type === 'buff' && (eff.target === key || eff.target === 'all_stats')) total += eff.value;
      if (eff.type === 'debuff' && (eff.target === key || eff.target === 'all_stats')) total -= eff.value;
    }
    return total;
  }

  healingReceivedMult(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 1;
    let mult = 1;
    for (const eff of effects) {
      if (eff.type === 'debuff' && eff.target === 'healing_received') {
        mult *= Math.max(0, 1 - (eff.value || 0) / 100);
      }
    }
    return mult;
  }

  healingOutgoingMult(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 1;
    let mult = 1;
    for (const eff of effects) {
      if (eff.type === 'debuff' && eff.target === 'healing_outgoing') {
        mult *= Math.max(0, 1 - (eff.value || 0) / 100);
      }
    }
    return mult;
  }

  hasEffect(target: string): boolean {
    const effects = this.character().activeEffects;
    if (!effects) return false;
    return effects.some(eff => eff.target === target);
  }

  getPoisonDamage(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 0;
    for (const eff of effects) {
      if (eff.type === 'buff' && eff.target === 'poisonDamage') {
        return eff.value * (this.hasEffect('poison_mastery') ? 2 : 1);
      }
    }
    return 0;
  }

  getLeechPoisonPercent(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 0;
    for (const eff of effects) {
      if (eff.type === 'buff' && eff.target === 'leechPoison') {
        return eff.value * (this.hasEffect('poison_mastery') ? 3 : 1);
      }
    }
    return 0;
  }

  getWoundPoisonPercent(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 0;
    for (const eff of effects) {
      if (eff.type === 'buff' && eff.target === 'woundPoison') {
        return eff.value || 0;
      }
    }
    return 0;
  }

  hasPoison(): boolean {
    return this.getPoisonDamage() > 0 || this.getLeechPoisonPercent() > 0;
  }

  checkClearcasting(): boolean {
    const cc = this.talentRank('clearcasting');
    if (cc <= 0) return false;
    return Math.random() * 100 < cc * 2;
  }

  // ==================== TALENT METHODS ====================

  addTalentPoint(id: string) {
    const talent = this.classConfig().talents.find(t => t.id === id);
    if (!talent || !this.canAddTalent(talent)) return;
    this.character.update(c => {
      c.talents[id] = (c.talents[id] || 0) + 1;
      return { ...c };
    });
  }

  removeTalentPoint(id: string) {
    if (this.talentRank(id) === 0) return;
    const talent = this.classConfig().talents.find(t => t.id === id);
    if (talent) {
      const higherTiers = this.classConfig().talents.filter(t => t.tier > talent.tier);
      const hasPointsAbove = higherTiers.some(t => this.talentRank(t.id) > 0);
      if (hasPointsAbove) {
        let totalBelow = 0;
        for (let t = 1; t <= talent.tier; t++) totalBelow += this.tierPointsSpent(t);
        const required = talent.tier * 5;
        if (totalBelow <= required) {
          this.showToast('No puedes quitar puntos: hay talentos en tiers superiores que dependen de los puntos acumulados.');
          return;
        }
      }
    }
    const dependents = this.classConfig().talents.filter(t => t.requires && t.requires.id === id && this.talentRank(t.id) > 0);
    if (dependents.length > 0) {
      this.showToast('Hay talentos que dependen de este. Quítalos primero.');
      return;
    }
    this.character.update(c => {
      c.talents[id]--;
      if (c.talents[id] === 0) delete c.talents[id];
      return { ...c };
    });
  }

  talentsByTier(tier: number) {
    return this.classConfig().talents.filter(t => t.tier === tier);
  }

  talentById(id: string) {
    return this.classConfig().talents.find(t => t.id === id);
  }

  tierLabel(tier: number): string {
    const labels: Record<number, string> = { 1: 'Nv. 10', 2: 'Nv. 15', 3: 'Nv. 20', 4: 'Nv. 25', 5: 'Nv. 30', 6: 'Nv. 35' };
    return labels[tier] || ('Tier ' + tier);
  }

  talentNodeClass(talent: any): string {
    const rank = this.talentRank(talent.id);
    if (rank === 0 && !this.prereqMet(talent)) return 'wow-node-locked';
    if (this.isMaxed(talent.id, talent.maxRank)) return 'wow-node-maxed';
    if (rank > 0) return 'wow-node-active';
    if (this.canAddTalent(talent)) return 'wow-node-available';
    return 'wow-node-grey';
  }

  capstones(): Capstone[] {
    return this.classConfig().capstones || [];
  }

  capstoneUnlocked(): boolean {
    return this.spentTalentPoints() >= 15;
  }

  selectedCapstone(): string | null {
    return this.character().capstone || null;
  }

  capstoneNodeClass(capstone: any): string {
    if (!this.capstoneUnlocked()) return 'wow-node-locked';
    if (this.selectedCapstone() === capstone.id) return 'wow-node-maxed';
    if (this.selectedCapstone()) return 'wow-node-grey';
    return 'wow-node-available';
  }

  selectCapstone(id: string) {
    if (this.selectedCapstone()) return;
    const capstone = this.classConfig().capstones?.find(c => c.id === id);
    if (!capstone) return;
    if (!this.capstoneUnlocked()) {
      this.showToast('Necesitas 15 puntos de talento para elegir una capstone.');
      return;
    }
    this.character.update(c => {
      if (id === 'lone_wolf') {
        return { ...c, capstone: id, activePet: null, companionPet: null };
      }
      return { ...c, capstone: id };
    });
    if (id === 'lone_wolf') this.dismissPetsFirebase();
    this.showToast(capstone.name + ' seleccionada.');
  }

  private dismissPetsFirebase() {
    const playerName = (this.character().name || '').trim();
    if (!playerName) return;
    const cls = this.classConfig();
    if (!cls.pets) return;
    for (const p of cls.pets) {
      try {
        this.firebase.removeData('players/' + playerName + ' — ' + p.name);
      } catch (e) {
        console.error('Firebase remove pet error:', e);
      }
    }
  }

  getTalentEffectText(talentId: string): string {
    const rank = this.talentRank(talentId);
    if (rank === 0) return '';
    const texts: Record<string, string> = {
      elemental_focus: `Coste de maná: −${rank * 2}%`,
      convection: `Daño de hechizos: +${rank * 3}%`,
      improved_lightning_bolt: `Daño Descarga de Rayo: +${rank * 5}%`,
      call_of_thunder: `Crítico de hechizos: +${rank}%`,
      lightning_mastery: `Daño Naturaleza: +${rank * 5}%`,
      storm_power: `Poder de Hechizo: +${rank * 10}%`,
      elemental_mastery: `Daño todos los hechizos: +${rank * 2}%`,
      mana_efficiency: `Coste de maná: −${rank * 3}%`,
      improved_arcane_intellect: `Arcane Intellect: +${rank * 15}%`,
      improved_frost_armor: `Frost Armor: +${rank * 10}%`,
      improved_frostbolt: `Daño Frostbolt: +${rank * 10}%`,
      casting_master: `Daño casteos: +${rank * 5}%`,
      magic_resistance: `Armadura mágica: +${rank}, Crítico instant: +${rank}%`,
      improved_fire_blast: `CD Fire Blast: −${rank} turno${rank > 1 ? 's' : ''}`,
      frost_power: `Daño Escarcha: +${rank * 2}%`,
      spell_crit_talent: `Crítico hechizos: +${rank}%`,
      clearcasting: `Prob. hechizo gratuito: ${rank * 2}%`,
      master_of_weapons: `Pasiva: armas 1H + off o 2H equipables`,
      improved_heroic_strike: `Coste Heroic Strike: −${rank} ira`,
      anticipation: `Armadura física: +${rank * 2}, Armadura mágica: +${rank * 2}`,
      improved_bloodrage: `Blood Rage: +${rank * 5} ira/turno`,
      improved_charge: `Charge: +${rank * 2} ira`,
      cruelty: `Crítico físico: +${rank}%`,
      improved_last_stand: `Last Stand cura: +${rank * 5}% vida`,
      improved_cleave: `Cleave: +${rank * 20}% daño`,
      improved_battle_shout: `Battle Shout: +${rank * 6}% AP, −${rank * 2} ira`,
      improved_stances: `Stances: +${rank * 2}% daño Battle, +${rank * 2}% crit Fury, +${rank * 4} armor Protection`,
      unyielding_strikes: `Basic Attack: ${rank * 4}% prob. acción gratis`,
      vitality: `Regen energía: +${rank * 10}%`,
      energetic_basic_attack: `Basic Attack: +${rank * 2}% daño, +${rank} energía (+${rank * 2} si crit)`,
      ruthlessness: `Coste finishers: −${rank * 2} energía`,
      improved_backstab: `Coste Backstab: −${rank * 3} energía`,
      improved_slice_and_dice: `Slice and Dice: +${rank * 3} turnos duración`,
      opportunity: `Daño Backstab/Garrote/Ambush: +${rank * 4}%`,
      precision: `Crítico físico: +${rank}%`,
      endurance: `CD Evasión/Sprint: −${rank} turno${rank > 1 ? 's' : ''}`,
      initiative: `Combo extra: ${rank * 15}% prob`,
      energetic: `Energía máxima: +${rank * 4}`,
      improved_garrote: `Garrote: +${rank * 20}% daño bleed + silencio`,
      healing_focus: `Curación: +${rank * 2}%`,
      shadow_ally: `Daño sombra: +${rank * 3}%`,
      beligerance: `Basic Attack: +${rank * 10}% Espiritu como danyo`,
      evangelism: `Swap holy/shadow: +${rank * 3}% siguiente spell`,
      improved_shield: `PW: Shield: +${rank * 10}% absorción`,
      improved_fortitude: `PW: Fortitude: +${rank * 15}% Aguante`,
      improved_pain: `SW: Pain: +${rank * 10}% daño`,
      holyness: `Regen maná: +${rank * 5}%`,
      preservation: `Armadura mágica: +${rank * 5} · Spell crit: +${rank}%`,
      improved_mind_blast: `Mind Blast: CD -1 y cast instantaneo${rank > 0 ? ' (activo)' : ''}`,
      improved_inner_fire: `Inner Fire eficacia: +${rank * 20}%`,
      improved_renew: `Renew: +${rank} turno${rank > 1 ? 's' : ''}`,
      improved_mark_of_the_wild: `Mark of the Wild: +${rank * 15}% efecto`,
      improved_wrath: `Daño Wrath: +${rank * 3}%`,
      lunar_healing: `Curación: ${rank * 6}% prob. Fase Lunar`,
      improved_moonfire: `Moonfire: +${rank * 10}% daño`,
      improved_rejuvenation: `Rejuvenation: +${rank * 7}% curación`,
      natures_remains: `Coste Wrath/Moonfire: −${rank * 5}%`,
      balance_of_nature: `Poder de hechizo: +${rank * 10}% Espíritu`,
      equinox: `Fases Lunares: +${rank * 15}% daño bonus`,
      natural_perfection: `Crítico hechizos: +${rank * 2}%`,
      improved_staccato: `Staccato: +${rank * 5}% danyo, −${rank * 10}% mana`,
      quick_fingers: `Esquiva: +${rank * 2}%`,
      resonance: `Curación: +${rank * 5}%`,
      improved_crescendo: `Crescendo self-buff: ${rank * 10}% del valor enviado`,
      improved_vivace: `Vivace: +${rank * 10}% curación`,
      improved_fermata: `Fermata: +${rank * 14} armadura tras lanzar`,
      maestro: `Remates: ${rank * 15}% prob. devolver 1 accion`,
      improved_diminuendo: `Diminuendo: +${rank * 10}% efectividad`,
      ballerino: `Agilidad: +${rank * 2}%`,
      harmonioso: `Curas: −${rank * 5}% mana`,
    };
    return texts[talentId] || '';
  }

  // ==================== COMBAT METHODS ====================

  showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastMessage.set(''), 4000);
  }

  trainAbility(abilityId: string) {
    this.character.update(c => {
      const maxRank = this.maxAvailableRank(this.classConfig().abilities.find(a => a.id === abilityId)!);
      if (maxRank > (c.trainedRanks[abilityId] || 0)) {
        c.trainedRanks[abilityId] = (c.trainedRanks[abilityId] || 0) + 1;
      }
      return { ...c };
    });
  }

  trainAll() {
    this.character.update(c => {
      for (const ab of this.trainableAbilities()) {
        if (ab.type === 'utility') {
          if (ab.buffRanks) {
            const maxBR = ab.buffRanks.filter(br => c.level >= br.level).length;
            if (maxBR > (c.trainedRanks[ab.id] || 0)) c.trainedRanks[ab.id] = maxBR > (c.trainedRanks[ab.id] || 0) ? (c.trainedRanks[ab.id] || 0) + 1 : (c.trainedRanks[ab.id] || 0);
          } else if (c.level >= ab.requiredLevel && (c.trainedRanks[ab.id] || 0) === 0) {
            c.trainedRanks[ab.id] = 1;
          }
        } else {
          const maxRank = this.maxAvailableRank(ab);
          if (maxRank > (c.trainedRanks[ab.id] || 0)) c.trainedRanks[ab.id] = (c.trainedRanks[ab.id] || 0) + 1;
        }
      }
      return { ...c };
    });
  }

  // ==================== LOCALSTORAGE ====================

  saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.character()));
    } catch (e) {
      console.error('Save error:', e);
    }
  }

  loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const cls = this.classRegistry.get(parsed.classKey);
        if (cls) {
          parsed.baseStats = { ...cls.baseStats };
          if (parsed.comboPoints === undefined) parsed.comboPoints = 0;
          if (parsed.soulShards === undefined) parsed.soulShards = 0;
          if (!parsed.musicalNotes) parsed.musicalNotes = [];
          this.character.set(parsed);
        }
      }
    } catch (e) {
      console.error('Load error:', e);
    }
  }

  selectClass(classKey: string) {
    const currentName = this.character().name || '';
    const newChar = createDefaultCharacter(classKey, this.classRegistry.getAll());
    newChar.name = currentName;
    this.character.set(newChar);
    this.saveToLocalStorage();
  }

  // ==================== FIREBASE ====================

  registerPlayer() {
    const name = (this.character().name || '').trim();
    if (!name) return;
    try {
      this.firebase.setData('players/' + name, { name, timestamp: Date.now() });
    } catch (e) {
      console.error('Firebase register player error:', e);
    }
  }

  sendDamageEvent(ability: any, damage: number, hitNum: number = 1, totalHits: number = 1) {
    this.registerPlayer();
    try {
      let effects: any = null;
      if (ability.isDot) {
        effects = [{ type: 'dot', name: ability.name, value: ability.dotTick, duration: ability.dotDuration, debuffType: ability.debuffType || 'none', stackable: ability.stackable ?? false }];
      } else if (ability.inflictsEffects) {
        effects = ability.inflictsEffects.map((eff: any) => ({ ...eff }));
      }
      const abilityName = totalHits > 1 ? `${ability.name} (${hitNum}/${totalHits})` : ability.name;
      const payload = {
        player: this.character().name || 'Jugador',
        ability: abilityName,
        rank: ability.currentRank || 1,
        damage,
        damageType: this.hasPoison() && ability.damageType === 'physical' ? 'magical' : (ability.damageType || 'magical'),
        aoe: ability.aoe || false,
        chain: ability.chain || false,
        bounces: ability.bounces || 1,
        chainDecay: ability.chainDecay || 0.7,
        effects,
        turn: this.turnNumber(),
        timestamp: Date.now(),
        assigned: false,
      };
      this.firebase.pushData('damageEvents', payload);
      if (!ability.isDot && !ability.aoe && ability.damageType !== 'heal' && this.hasEffect('blade_flurry')) {
        this.firebase.pushData('damageEvents', { ...payload, ability: abilityName + ' (Blade Flurry)' });
      }
    } catch (e) {
      console.error('Firebase send damage error:', e);
    }
  }

   sendHealEvent(ability: any, healAmount: number) {
    this.registerPlayer();
    try {
      this.firebase.pushData('damageEvents', {
        player: this.character().name || 'Jugador',
        ability: `${ability.name} (Cura)`,
        rank: ability.currentRank || 1,
        damage: healAmount,
        damageType: 'heal',
        aoe: false,
        chain: ability.chain || false,
        bounces: ability.bounces || 1,
        chainDecay: ability.chainDecay || 0.6,
        effects: null,
        isHot: ability.isHot || false,
        hotTick: ability.hotTick || 0,
        hotDuration: ability.hotDuration || 0,
        isShield: ability.id === 'power_word_shield',
        turn: this.turnNumber(),
        timestamp: Date.now(),
        assigned: false,
      });
    } catch (e) {
      console.error('Firebase send heal error:', e);
    }
  }

  sendBuffEvent(ability: any, buffValueOverride?: number) {
    this.registerPlayer();
    try {
      this.firebase.pushData('damageEvents', {
        player: this.character().name || 'Jugador',
        ability: `${ability.name} (Buff)`,
        rank: ability.currentRank || 1,
        damage: 0,
        damageType: 'buff',
        buffStat: ability.currentBuffStat,
        buffValue: buffValueOverride ?? ability.currentBuffValue,
        buffDuration: ability.currentBuffDuration,
        isPercent: ability.buff?.isPercent || false,
        aoe: !!ability.partyBuff || !!ability.aoe,
        effects: null,
        turn: this.turnNumber(),
        timestamp: Date.now(),
        assigned: false,
      });
    } catch (e) {
      console.error('Firebase send buff error:', e);
    }
  }

  // ==================== EFFECTS ====================

  isDebuffGroup(key: string | undefined): boolean {
    return !!key && (key === 'attackPower' || key === 'armor');
  }

  addEffect(effect: ActiveEffect) {
    const isGrouped = effect.type === 'debuff' && this.isDebuffGroup(effect.target || '');
    this.character.update(c => {
      if (!c.activeEffects) c.activeEffects = [];
      let next = [...c.activeEffects];
      if (isGrouped) {
        const key = effect.target || '';
        const stronger = next.find(
          (e) => e.type === 'debuff' && (e.target === key || (e as any).stat === key) && (e.value || 0) > (effect.value || 0),
        );
        if (stronger) {
          return { ...c };
        }
        next = next.filter(
          (e) => !(e.type === 'debuff' && (e.target === key || (e as any).stat === key) && (e.value || 0) <= (effect.value || 0)),
        );
      }
      const effectWithId = { ...effect, id: effect.id || (Date.now() + Math.random()) };
      next.push(effectWithId);
      return { ...c, activeEffects: next };
    });
  }

  removeEffect(effectId: number) {
    this.character.update(c => {
      c.activeEffects = c.activeEffects.filter(e => e.id !== effectId);
      return { ...c };
    });
  }

  // ==================== MUSICAL NOTES ====================

  addNote(noteValue: number) {
    const max = this.classConfig()?.comboConfig?.max || 7;
    this.character.update(c => {
      const notes = [...(c.musicalNotes || [])];
      if (notes.length < max && !notes.includes(noteValue)) {
        notes.push(noteValue);
        notes.sort((a, b) => a - b);
      }
      return { ...c, musicalNotes: notes };
    });
  }

  modulateNotes(amount: number) {
    this.character.update(c => {
      const orig = [...(c.musicalNotes || [])];
      if (orig.length === 0 || amount === 0) return { ...c };
      const steps = Math.abs(amount);
      const dir = amount > 0 ? 1 : -1;
      const occupied = new Set<number>(orig);
      const order = [...orig].sort((a, b) => (dir > 0 ? b - a : a - b));
      for (const n of order) {
        let cur = n;
        for (let s = 0; s < steps; s++) {
          const nxt = cur + dir;
          if (nxt < 1 || nxt > 7) break;
          if (occupied.has(nxt)) break;
          cur = nxt;
        }
        occupied.delete(n);
        occupied.add(cur);
      }
      return { ...c, musicalNotes: [...occupied].sort((a, b) => a - b) };
    });
  }

  clearNotes() {
    this.character.update(c => ({ ...c, musicalNotes: [] }));
  }

  getNotes(): number[] {
    return this.character().musicalNotes || [];
  }

  noteContribution(): number {
    const notes = this.getNotes();
    return notes.reduce((sum, n) => sum + Math.pow(1.25, n - 1), 0);
  }

  restoreManaPct(pct: number) {
    this.character.update(c => {
      const maxMana = this.resourceMax();
      const restore = Math.round(maxMana * pct);
      return { ...c, currentMana: Math.min(maxMana, (c.currentMana || 0) + restore) };
    });
  }

  // ==================== HP/XP ====================

  addXP(amount: number) {
    this.character.update(c => {
      c.currentXP = (c.currentXP || 0) + amount;
      while (c.currentXP >= xpForLevel(c.level) && c.level < MAX_LEVEL) {
        c.currentXP -= xpForLevel(c.level);
        c.level++;
      }
      return { ...c };
    });
  }

  adjustHP(delta: number) {
    this.character.update(c => {
      const maxHP = Math.round(this.classConfig().formulas.hp(this.finalStats(), c.level));
      if (c.currentHP === null || c.currentHP === undefined) c.currentHP = maxHP;
      c.currentHP = Math.max(0, Math.min(maxHP, c.currentHP + delta));
      return { ...c };
    });
  }

  nextTurn() {
    this.character.update(c => {
      if (c.currentCooldowns) {
        for (const key of Object.keys(c.currentCooldowns)) {
          if (c.currentCooldowns[key] > 0) c.currentCooldowns[key]--;
          if (c.currentCooldowns[key] <= 0) delete c.currentCooldowns[key];
        }
      }
      if (c.activeEffects) {
        const bloodrageBuff = c.activeEffects.find(e => e.target === 'bloodrage');
        if (bloodrageBuff && c.currentRage !== undefined) {
          c.currentRage = Math.min(this.resourceMax(), c.currentRage + this.getBloodrageTickRage());
        }
        c.activeEffects = c.activeEffects.map(e => ({ ...e, duration: e.duration - 1 })).filter(e => e.duration > 0);
      }
      return { ...c };
    });
    this.turnNumber.update(n => n + 1);
    this.turnDamage.set(0);
    this.actionsUsed.set(0);
    if (this.resourceConfig().type === 'energy') {
      const regen = Math.round((this.resourceConfig().regen || 20) * (1 + this.talentRank('vitality') * 0.10));
      this.character.update(c => {
        c.currentEnergy = Math.min(this.resourceMax(), (c.currentEnergy || 0) + regen);
        return { ...c };
      });
    } else if (this.resourceConfig().type === 'rage') {
      this.character.update(c => {
        const rageDecay = Math.max(0, 3 - this.talentRank('endless_rage'));
        c.currentRage = Math.max(0, (c.currentRage || 0) - rageDecay);
        return { ...c };
      });
    } else if (this.resourceConfig().type === 'focus') {
      // el focus del Hunter no regenera al final del turno
    } else {
      const regen = this.manaRegen();
      this.character.update(c => {
        if (c.currentMana === null || c.currentMana === undefined) c.currentMana = this.maxMana();
        c.currentMana = Math.min(this.maxMana(), c.currentMana + regen);
        return { ...c };
      });
    }
  }

  availablePets = computed<Pet[]>(() => {
    const cls = this.classConfig();
    if (!cls.pets) return [];
    return cls.pets.filter(p => {
      const summonAbility = cls.abilities.find(a => a.isPetSummon === p.id);
      return summonAbility && this.trainedRank(summonAbility.id) > 0;
    });
  });

  activePetData = computed<Pet | null>(() => {
    return this.petDefFor(this.character().activePet);
  });

  companionPetData = computed<Pet | null>(() => {
    return this.petDefFor(this.character().companionPet);
  });

  private petDefFor(slot: ActivePet | null | undefined): Pet | null {
    if (!slot) return null;
    const cls = this.classConfig();
    if (!cls.pets) return null;
    return cls.pets.find(p => p.id === slot!.petId) || null;
  }

  petTalentBoost(): number {
    return 1 + this.talentRank('grimoire_of_command') * 0.25;
  }

  petMaxHP = computed<number>(() => {
    const pet = this.activePetData();
    if (!pet) return 0;
    let hp = Math.round(this.maxHP() * pet.hpPct);
    if (pet.id === 'voidwalker') hp = Math.round(hp * this.petTalentBoost());
    return hp;
  });

  petMaxMana = computed<number>(() => {
    const pet = this.activePetData();
    if (!pet) return 0;
    return Math.round(this.maxMana() * pet.manaPct);
  });

  petHP = computed<number>(() => {
    const c = this.character();
    if (!c.activePet) return 0;
    return c.activePet.currentHP;
  });

  petMana = computed<number>(() => {
    const c = this.character();
    if (!c.activePet) return 0;
    return c.activePet.currentMana;
  });

  petHPPercent = computed<number>(() => {
    const max = this.petMaxHP();
    if (max === 0) return 0;
    return Math.round((this.petHP() / max) * 100);
  });

  petManaPercent = computed<number>(() => {
    const max = this.petMaxMana();
    if (max === 0) return 0;
    return Math.round((this.petMana() / max) * 100);
  });

  companionPetMaxHP = computed<number>(() => {
    const pet = this.companionPetData();
    if (!pet) return 0;
    return Math.round(this.maxHP() * pet.hpPct);
  });

  companionPetHP = computed<number>(() => {
    const c = this.character();
    if (!c.companionPet) return 0;
    return c.companionPet.currentHP;
  });

  companionPetHPPercent = computed<number>(() => {
    const max = this.companionPetMaxHP();
    if (max === 0) return 0;
    return Math.round((this.companionPetHP() / max) * 100);
  });

  readonly petSwapWarning = signal<string | null>(null);

  summonPet(petId: string) {
    const cls = this.classConfig();
    if (!cls.pets) return;
    const pet = cls.pets.find(p => p.id === petId);
    if (!pet) return;
    const currentPet = this.character().activePet;
    if (this.selectedCapstone() === 'animal_companion') {
      this.doSummonPet(petId);
      return;
    }
    if (currentPet && currentPet.petId !== petId) {
      const currentPetData = cls.pets.find(p => p.id === currentPet.petId);
      this.petSwapWarning.set((currentPetData?.name || 'Pet') + ' → ' + pet.name);
      this.pendingPetSwap.set(petId);
      return;
    }
    this.doSummonPet(petId);
  }

  pendingPetSwap = signal<string | null>(null);

  confirmPetSwap() {
    const pending = this.pendingPetSwap();
    if (pending) {
      this.petSwapWarning.set(null);
      this.pendingPetSwap.set(null);
      this.dismissPet();
      this.doSummonPet(pending);
    }
  }

  cancelPetSwap() {
    this.petSwapWarning.set(null);
    this.pendingPetSwap.set(null);
  }

  private doSummonPet(petId: string) {
    const cls = this.classConfig();
    if (!cls.pets) return;
    const pet = cls.pets.find(p => p.id === petId);
    if (!pet) return;
    let petHP = Math.round(this.maxHP() * pet.hpPct);
    if (pet.id === 'voidwalker') petHP = Math.round(petHP * this.petTalentBoost());
    const manaPct = pet.manaPct || 0;
    this.character.update(c => {
      let activePet = c.activePet;
      let companion: ActivePet | null | undefined = c.companionPet;
      const canDual = this.selectedCapstone() === 'animal_companion';
      const isCompanion = canDual && activePet && activePet.petId !== petId && !companion;
      if (canDual && activePet && activePet.petId !== petId) {
        companion = {
          petId,
          currentHP: petHP,
          currentMana: Math.round(this.maxMana() * manaPct),
        };
      } else {
        activePet = {
          petId,
          currentHP: petHP,
          currentMana: Math.round(this.maxMana() * manaPct),
        };
        if (!canDual) companion = undefined;
      }
      return {
        ...c,
        activePet,
        companionPet: companion ?? null,
        activeEffects: (c.activeEffects || []).filter(e => e.name !== 'Burning Soul' && e.name !== 'Void Fortitude'),
      };
    });
    const playerName = (this.character().name || '').trim();
    if (playerName) {
      const petName = playerName + ' — ' + pet.name;
      try {
        this.firebase.setData('players/' + petName, { name: petName, timestamp: Date.now(), isPet: true });
      } catch (e) {
        console.error('Firebase register pet error:', e);
      }
    }
    this.showToast(`${pet.icon} ${pet.name} invocado!`);
  }

  dismissPet() {
    const playerName = (this.character().name || '').trim();
    const pet = this.activePetData();
    const companion = this.companionPetData();
    if (playerName && pet) {
      const petName = playerName + ' — ' + pet.name;
      try {
        this.firebase.removeData('players/' + petName);
      } catch (e) {
        console.error('Firebase remove pet error:', e);
      }
    }
    if (playerName && companion) {
      const petName = playerName + ' — ' + companion.name;
      try {
        this.firebase.removeData('players/' + petName);
      } catch (e) {
        console.error('Firebase remove companion error:', e);
      }
    }
    this.character.update(c => ({ ...c, activePet: null, companionPet: null }));
    this.showToast('Pets desinvocadas');
  }

  petAttack(): { damage: number; name: string; school: string; manaCost: number; focusGain: number } | null {
    return this.petAttackFor(this.character().activePet);
  }

  companionPetAttack(): { damage: number; name: string; school: string; manaCost: number; focusGain: number } | null {
    return this.petAttackFor(this.character().companionPet);
  }

  petAttackFor(slot: ActivePet | null | undefined): { damage: number; name: string; school: string; manaCost: number; focusGain: number } | null {
    const c = this.character();
    if (!slot) return null;
    const pet = this.petDefFor(slot);
    if (!pet) return null;
    if (slot.currentMana < Math.round(this.petMaxMana() * pet.manaCostPct)) return null;

    let damage = Math.round(pet.attackMin + Math.random() * (pet.attackMax - pet.attackMin));
    if (pet.id === 'imp') damage = Math.round(damage * this.petTalentBoost());
    const bd = this.talentRank('bestial_discipline');
    if (bd > 0) damage = Math.round(damage * (1 + bd * 0.10));

    let focusGain = 0;
    if (this.resourceConfig().type === 'focus') {
      const howl = (c.activeEffects || []).find(e => e.type === 'buff' && e.name === 'Furious Howl');
      if (howl) damage = Math.round(damage * (1 + (howl.value || 0) / 100));
      const focusBonus = bd > 0 ? [0, 2, 4, 5][bd] || 0 : 0;
      focusGain = (pet.focusGain || 0) + focusBonus;
    }

    const manaCost = Math.round(this.petMaxMana() * pet.manaCostPct);

    this.character.update(ch => {
      const isMain = slot === ch.activePet;
      let out = { ...ch };
      if (isMain) {
        out.activePet = ch.activePet ? { ...ch.activePet, currentMana: Math.max(0, ch.activePet.currentMana - manaCost) } : null;
      } else {
        out.companionPet = ch.companionPet ? { ...ch.companionPet, currentMana: Math.max(0, ch.companionPet.currentMana - manaCost) } : null;
      }
      if (focusGain > 0) {
        const focusMax = this.resourceMax();
        out.currentFocus = Math.min(focusMax, (out.currentFocus || 0) + focusGain);
      }
      return out;
    });

    return { damage, name: pet.attackName, school: pet.attackSchool, manaCost, focusGain };
  }

  petTakeDamage(amount: number) {
    const thickSkin = (this.character().activeEffects || []).find(e => e.type === 'buff' && e.name === 'Thick Skin');
    if (thickSkin && thickSkin.value) amount = Math.max(0, amount - thickSkin.value);
    this.character.update(c => {
      if (!c.activePet) {
        if (!c.companionPet) return c;
        const newHP = Math.max(0, c.companionPet.currentHP - amount);
        if (newHP <= 0) {
          const playerName = (c.name || '').trim();
          const pet = this.classConfig().pets?.find(p => p.id === c.companionPet!.petId);
          if (playerName && pet) {
            const petName = playerName + ' — ' + pet.name;
            try {
              this.firebase.removeData('players/' + petName);
            } catch (e) {
              console.error('Firebase remove dead pet error:', e);
            }
          }
          this.showToast('Tu pet ha muerto!');
          return { ...c, companionPet: null };
        }
        return { ...c, companionPet: { ...c.companionPet, currentHP: newHP } };
      }
      const newHP = Math.max(0, c.activePet.currentHP - amount);
      if (newHP <= 0) {
        const playerName = (c.name || '').trim();
        const pet = this.classConfig().pets?.find(p => p.id === c.activePet!.petId);
        if (playerName && pet) {
          const petName = playerName + ' — ' + pet.name;
          try {
            this.firebase.removeData('players/' + petName);
          } catch (e) {
            console.error('Firebase remove dead pet error:', e);
          }
        }
        this.showToast('Tu pet ha muerto!');
        return { ...c, activePet: null };
      }
      return {
        ...c,
        activePet: { ...c.activePet, currentHP: newHP },
      };
    });
  }

  petRest() {
    const pet = this.activePetData();
    const companion = this.companionPetData();
    if (!pet && !companion) return;
    this.character.update(c => ({
      ...c,
      activePet: c.activePet ? {
        ...c.activePet,
        currentHP: this.petMaxHP(),
        currentMana: this.petMaxMana(),
      } : null,
      companionPet: c.companionPet ? {
        ...c.companionPet,
        currentHP: this.companionPetMaxHP(),
        currentMana: 0,
      } : null,
    }));
  }

  isStealthed(): boolean {
    return !!(this.character().activeEffects || []).some(e => e.target === 'stealth');
  }

  infernalTurns(): number {
    return this.character().infernalTurnsLeft || 0;
  }

  infernalActive(): boolean {
    return this.infernalTurns() > 0;
  }

  infernalConfig(): any {
    return this.classConfig().abilities.find(a => a.id === 'summon_infernal') || null;
  }

  summonInfernal(turns: number) {
    this.character.update(c => ({ ...c, infernalTurnsLeft: turns }));
  }

  infernalAttack(): { damage: number; name: string; school: string } | null {
    const cfg = this.infernalConfig();
    if (!cfg || !this.infernalActive()) return null;
    const min = cfg.infernalMin || 30;
    const max = cfg.infernalMax || 50;
    const damage = Math.round(min + Math.random() * (max - min));
    return { damage, name: 'Infernal Firebolt', school: 'Fuego' };
  }

  decrementInfernalTurn(): number {
    const remaining = this.infernalTurns() - 1;
    this.character.update(c => ({ ...c, infernalTurnsLeft: Math.max(0, remaining) }));
    return remaining;
  }

  getShards(): number {
    return this.character().soulShards || 0;
  }

  isMaelstormReady(): boolean {
    if (this.character().classKey !== 'shaman') return false;
    const max = this.classConfig().comboConfig?.max || 4;
    return (this.character().comboPoints || 0) >= max;
  }

  totemInfo(slot: 'fire' | 'water') {
    return slot === 'fire' ? this.character().fireTotem : this.character().waterTotem;
  }

  totemActive(slot: 'fire' | 'water'): boolean {
    const totem = this.totemInfo(slot);
    return !!totem && (totem.turns || 0) > 0;
  }

  summonTotem(slot: 'fire' | 'water', type: string, turns: number, min: number, max: number, value?: number) {
    const field = slot === 'fire' ? 'fireTotem' : 'waterTotem';
    this.character.update(c => ({ ...c, [field]: { type, turns, min, max, value } }));
  }

  updateTotem(slot: 'fire' | 'water', turns: number | null) {
    const field = slot === 'fire' ? 'fireTotem' : 'waterTotem';
    const current = this.totemInfo(slot);
    if (!current) return;
    if (turns === null || turns <= 0) {
      this.character.update(c => ({ ...c, [field]: null }));
    } else {
      this.character.update(c => ({ ...c, [field]: { ...current, turns } }));
    }
  }

  soulShardMax(): number {
    return 5 + this.talentRank('pocket_shards');
  }

  addShard(amount: number) {
    this.character.update(c => ({
      ...c,
      soulShards: Math.min(this.soulShardMax(), (c.soulShards || 0) + amount),
    }));
  }

  spendShards(amount: number): boolean {
    const current = this.character().soulShards || 0;
    if (current < amount) return false;
    this.character.update(c => ({
      ...c,
      soulShards: current - amount,
    }));
    return true;
  }

  soulConduitRecover(shardCount: number): number {
    if (this.character().classKey !== 'warlock') return 0;
    const sc = this.talentRank('soul_conduit');
    if (sc <= 0) return 0;
    const chance = sc * 0.20;
    let recovered = 0;
    for (let i = 0; i < shardCount; i++) {
      if (Math.random() * 100 < chance) {
        this.character.update(c => ({
          ...c,
          soulShards: Math.min(this.soulShardMax(), (c.soulShards || 0) + 1),
        }));
        recovered++;
      }
    }
    return recovered;
  }

  castPetAbility(ability: any): boolean {
    const c = this.character();
    if (!c.activePet) return false;
    const petMaxMana = this.petMaxMana();
    const manaCost = Math.round(petMaxMana * 0.15);
    if (c.activePet.currentMana < manaCost) {
      this.showToast('La pet no tiene mana suficiente');
      return false;
    }
    this.character.update(ch => ({
      ...ch,
      activePet: ch.activePet ? {
        ...ch.activePet,
        currentMana: Math.max(0, ch.activePet.currentMana - manaCost),
      } : null,
    }));
    if (ability.buff && ability.currentBuffValue && ability.id !== 'imp_blood_bolt' && ability.id !== 'furious_howl' && ability.id !== 'growl') {
      if (ability.currentBuffStat === 'shield') {
        this.character.update(c => ({
          ...c,
          activeEffects: [...(c.activeEffects || []), {
            id: Date.now(),
            type: 'buff',
            name: ability.name,
            target: 'shield',
            value: ability.currentBuffValue,
            duration: ability.currentBuffDuration,
            isPercent: false,
          }],
        }));
      } else {
        this.character.update(c => ({
          ...c,
          activeEffects: [...(c.activeEffects || []), {
            id: Date.now(),
            type: 'buff',
            name: ability.name,
            target: ability.currentBuffStat,
            value: ability.currentBuffValue,
            duration: ability.currentBuffDuration,
            isPercent: false,
          }],
        }));
      }
    }
    if (ability.destroysPet) {
      this.dismissPet();
    }
    return true;
  }
}
