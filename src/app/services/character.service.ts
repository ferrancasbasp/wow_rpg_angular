import { Injectable, signal, computed, inject } from '@angular/core';
import { Character, CharacterClass, Stats, StatKey, Ability, ActiveEffect } from '../models/game.models';
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

  maxActions = computed<number>(() => {
    const effects = this.character().activeEffects || [];
    const hasSnD = effects.some(e => e.name === 'Slice and Dice');
    return hasSnD ? 3 : 2;
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
    }
    return result;
  });

  readonly maxHP = computed<number>(() => {
    const cls = this.classConfig();
    let hp = Math.round(cls.formulas.hp(this.finalStats(), this.character().level));
    const effects = this.character().activeEffects;
    if (effects) {
      for (const eff of effects) {
        if (eff.type === 'buff' && eff.target === 'maxHP') {
          if (eff.isPercent) hp = Math.round(hp * (1 + eff.value / 100));
          else hp += eff.value;
        }
      }
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
    const virtuoso = this.talentRank('virtuoso');
    if (virtuoso > 0) sp = Math.round(sp * (1 + virtuoso * 0.05));
    sp += this.effectStatBonus('spellPower');
    return sp;
  });

  readonly spellCrit = computed<string>(() => {
    const fromInt = this.finalStats().intelecto / 60;
    const fromLevel = this.character().level * 0.02;
    const fromTalent = this.talentRank('call_of_thunder') + this.talentRank('spell_crit_talent') + this.talentRank('natural_perfection') * 2;
    const fromBuff = this.effectStatBonus('spellCrit');
    const fromMoonkin = this.hasEffect('moonkin') ? 5 : 0;
    return (5 + fromInt + fromLevel + fromTalent + fromBuff + fromMoonkin).toFixed(2);
  });

  readonly meleeCrit = computed<string>(() => {
    const fromAgi = this.finalStats().agilidad / 20;
    const fromLevel = this.character().level * 0.02;
    const impStances = this.talentRank('improved_stances');
    const stanceBonus = this.warriorStance() === 'fury' ? (5 + impStances * 2) : 0;
    const fromTalent = this.talentRank('cruelty') + this.talentRank('precision');
    const fromBuff = this.effectStatBonus('physCrit');
    return (5 + fromAgi + fromLevel + stanceBonus + fromTalent + fromBuff).toFixed(2);
  });

  readonly attackPower = computed<number>(() => {
    let total = this.classConfig().formulas.attackPower(this.finalStats());
    total += this.effectStatBonus('attackPower');
    return total;
  });

  readonly evasion = computed<number>(() => {
    let total = 5;
    total += this.effectStatBonus('evasion');
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
    total += this.talentRank('anticipation');
    if (this.warriorStance() === 'protection' && this.classConfig().stances) total += 5 + this.talentRank('improved_stances') * 2;
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
    total += this.talentRank('preservation') * 2;
    total += this.talentRank('anticipation');
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
    return this.maxMana();
  });

  readonly resourceActual = computed<number>(() => {
    const rc = this.resourceConfig();
    const char = this.character();
    if (rc.type === 'rage') return Math.max(0, Math.min(this.resourceMax(), char.currentRage || 0));
    if (rc.type === 'energy') return Math.max(0, Math.min(this.resourceMax(), char.currentEnergy ?? 100));
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
      if (ability.generatesNote && this.character().classKey === 'bard') {
        const qf = this.talentRank('quick_fingers');
        if (qf > 0) cost *= (1 - qf * 0.04);
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
    return this.computedAbilities().filter(a => a.type !== 'utility' && this.trainedRank(a.id) > 0).map(a => {
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
        minVal = dmgRange ? (dmgRange.min + dmgBonus + spBonus) : 0;
        maxVal = dmgRange ? (dmgRange.max + dmgBonus + spBonus) : 0;
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
      const dotRange = a.dotRanges?.find(dr => dr.rank === rank);
      let hotTick = 0, hotDuration = 0, hotTotal = 0;
      if (a.isHot) {
        const baseDuration = a.hotDuration || 1;
        hotDuration = baseDuration + this.talentRank('improved_renew');
        const healBonus = 1 + this.talentRank('healing_focus') * 0.02;
        hotTick = Math.round(minVal * healBonus / baseDuration);
        hotTotal = hotTick * hotDuration;
      }
      let dotTick = 0, dotDuration = 0, dotTotal = 0;
      if (a.isDot) {
        dotDuration = a.dotDuration || 1;
        dotTotal = minVal;
        if (a.id === 'shadow_word_pain') {
          dotTotal = Math.round(dotTotal * (1 + this.talentRank('improved_pain') * 0.10));
        }
        if (a.id === 'garrote') {
          dotTotal = Math.round(dotTotal * (1 + this.talentRank('improved_garrote') * 0.20));
        }
        dotTick = Math.round(dotTotal / dotDuration);
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
    return this.classConfig().abilities.filter(a => a.type === 'utility' && this.trainedRank(a.id) > 0).map(a => {
      const rank = this.trainedRank(a.id);
      const buffRank = a.buffRanks?.find(br => br.rank === rank);
      let cost: number;
      if (isRage) cost = buffRank ? (buffRank.costRage || 0) : (a.costRage || 0);
      else if (isEnergy) cost = buffRank ? (buffRank.costEnergy || 0) : (a.costEnergy || 0);
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
      };
    });
  });

  readonly trainableAbilities = computed<Ability[]>(() => {
    return this.classConfig().abilities.filter(a => {
      if (a.type === 'utility') {
        if (a.buffRanks) {
          const maxBR = a.buffRanks.filter(br => this.character().level >= br.level).length;
          return maxBR > this.trainedRank(a.id);
        }
        return this.character().level >= a.requiredLevel && this.trainedRank(a.id) === 0;
      }
      const maxRank = this.maxAvailableRank(a);
      return maxRank > 0 && this.trainedRank(a.id) < maxRank;
    });
  });

  readonly canTrain = computed<boolean>(() => this.trainableAbilities().length > 0);

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
    return Math.max(0, cd);
  }

  getEffectiveRageCost(ability: any): number {
    let cost = ability.costRage || 0;
    if (ability.id === 'heroic_strike') cost -= this.talentRank('improved_heroic_strike');
    if (ability.id === 'shout') cost -= this.talentRank('improved_battle_shout');
    return Math.max(0, cost);
  }

  getEffectiveEnergyCost(ability: any): number {
    let cost = ability.costEnergy || 0;
    if (ability.spendsCombo) cost -= this.talentRank('ruthlessness') * 2;
    if (ability.id === 'backstab') cost -= this.talentRank('improved_backstab') * 3;
    return Math.max(0, cost);
  }

  getEffectiveRageGen(ability: any): number {
    let gen = ability.generatesRage || 0;
    if (ability.id === 'charge') gen += this.talentRank('improved_charge') * 2;
    return gen;
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

  hasEffect(target: string): boolean {
    const effects = this.character().activeEffects;
    if (!effects) return false;
    return effects.some(eff => eff.target === target);
  }

  getPoisonDamage(): number {
    const effects = this.character().activeEffects;
    if (!effects) return 0;
    for (const eff of effects) {
      if (eff.type === 'buff' && eff.target === 'poisonDamage') return eff.value;
    }
    return 0;
  }

  hasPoison(): boolean {
    return this.getPoisonDamage() > 0;
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
      anticipation: `Armadura física: +${rank}, Armadura mágica: +${rank}`,
      improved_bloodrage: `Blood Rage: +${rank * 5} ira/turno`,
      improved_charge: `Charge: +${rank * 2} ira`,
      cruelty: `Crítico físico: +${rank}%`,
      improved_last_stand: `Last Stand cura: +${rank * 5}% vida`,
      improved_cleave: `Cleave: +${rank * 20}% daño`,
      improved_battle_shout: `Battle Shout: +${rank * 5}% AP, −${rank} ira`,
      improved_stances: `Stances: +${rank * 2}% daño Battle, +${rank * 2}% crit Fury, +${rank * 2} armor Protection`,
      unyielding_strikes: `Basic Attack: ${rank * 4}% prob. acción gratis`,
      vitality: `Regen energía: +${rank * 10}%`,
      energetic_basic_attack: `Basic Attack: +${rank * 2}% daño, +${rank} energía (+${rank * 2} si crit)`,
      ruthlessness: `Coste finishers: −${rank * 2} energía`,
      improved_backstab: `Coste Backstab: −${rank * 3} energía`,
      improved_slice_and_dice: `Slice and Dice: +${rank} turno${rank > 1 ? 's' : ''} duración`,
      opportunity: `Daño Backstab/Garrote/Ambush: +${rank * 4}%`,
      precision: `Crítico físico: +${rank}%`,
      endurance: `CD Evasión/Sprint: −${rank} turno${rank > 1 ? 's' : ''}`,
      initiative: `Combo extra: ${rank * 15}% prob`,
      energetic: `Energía máxima: +${rank * 4}`,
      improved_garrote: `Garrote: +${rank * 20}% daño bleed + silencio`,
      healing_focus: `Curación: +${rank * 2}%`,
      shadow_ally: `Daño sombra: +${rank * 3}%`,
      beligerance: `Basic Attack: +${rank * 7}% Smite como sagrado`,
      evangelism: `Swap holy/shadow: +${rank * 3}% siguiente spell`,
      improved_shield: `PW: Shield: +${rank * 10}% absorción`,
      improved_fortitude: `PW: Fortitude: +${rank * 15}% Aguante`,
      improved_pain: `SW: Pain: +${rank * 10}% daño`,
      holyness: `Regen maná: +${rank * 5}%`,
      preservation: `Armadura mágica: +${rank * 2}`,
      improved_mind_blast: `Mind Blast crit: +${rank * 10}%`,
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
      virtuoso: `Poder de hechizo: +${rank * 5}%`,
      quick_fingers: `Coste generadores: −${rank * 4}%`,
      resonance: `Curación: +${rank * 5}%`,
      harmonic_series: `Prob. nota +1 tono: ${rank * 5}%`,
      improved_vivace: `Vivace: +${rank * 10}% curación`,
      extended_fermata: `Fermata: +${rank * 5}% mana`,
      maestro: `Remates: +${rank * 10}% daño/cura`,
      perfect_pitch: `Prob. no gastar notas: ${rank * 10}%`,
      grandioso: `Da Capo: +${rank * 5}% poder`,
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
        effects = [{ type: 'dot', name: ability.name, value: ability.dotTick, duration: ability.dotDuration, debuffType: ability.debuffType || 'none' }];
      } else if (ability.inflictsEffects) {
        effects = ability.inflictsEffects.map((eff: any) => ({ ...eff }));
      }
      const abilityName = totalHits > 1 ? `${ability.name} (${hitNum}/${totalHits})` : ability.name;
      this.firebase.pushData('damageEvents', {
        player: this.character().name || 'Jugador',
        ability: abilityName,
        rank: ability.currentRank || 1,
        damage,
        damageType: this.hasPoison() && ability.damageType === 'physical' ? 'magical' : (ability.damageType || 'magical'),
        aoe: ability.aoe || false,
        effects,
        turn: this.turnNumber(),
        timestamp: Date.now(),
        assigned: false,
      });
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

  sendBuffEvent(ability: any) {
    this.registerPlayer();
    try {
      this.firebase.pushData('damageEvents', {
        player: this.character().name || 'Jugador',
        ability: `${ability.name} (Buff)`,
        rank: ability.currentRank || 1,
        damage: 0,
        damageType: 'buff',
        buffStat: ability.currentBuffStat,
        buffValue: ability.currentBuffValue,
        buffDuration: ability.currentBuffDuration,
        isPercent: ability.buff?.isPercent || false,
        aoe: !!ability.partyBuff,
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

  addEffect(effect: ActiveEffect) {
    this.character.update(c => {
      if (!c.activeEffects) c.activeEffects = [];
      const effectWithId = { ...effect, id: effect.id || (Date.now() + Math.random()) };
      c.activeEffects.push(effectWithId);
      return { ...c };
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
      const notes = (c.musicalNotes || []).map(n => Math.min(7, n + amount));
      return { ...c, musicalNotes: notes };
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
        c.currentRage = Math.max(0, (c.currentRage || 0) - 5);
        return { ...c };
      });
    } else {
      const regen = this.manaRegen();
      this.character.update(c => {
        if (c.currentMana === null || c.currentMana === undefined) c.currentMana = this.maxMana();
        c.currentMana = Math.min(this.maxMana(), c.currentMana + regen);
        return { ...c };
      });
    }
  }
}
