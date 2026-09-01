import { Injectable, signal } from '@angular/core';

export interface SimAttackDef {
  name: string;
  minDamage: number;
  maxDamage: number;
  damageType?: string;
  inflictsEffects?: any[];
}

export interface SimEffect {
  type: string;
  name: string;
  stat?: string;
  target?: string;
  value?: number;
  duration: number;
  debuffType?: string;
  stackable?: boolean;
  maxStacks?: number;
  sourcePlayer?: string;
  sourceAbility?: string;
}

export interface SimEnemy {
  id: string;
  name: string;
  level: number;
  maxHP: number;
  currentHP: number;
  armor: number;
  magicResist: number;
  imageUrl: string;
  description?: string;
  attacks: SimAttackDef[];
  effects: SimEffect[];
}

@Injectable({ providedIn: 'root' })
export class SimCombatService {
  readonly enemy = signal<SimEnemy | null>(null);
  readonly log = signal<string[]>([]);

  reset(def?: Partial<SimEnemy>) {
    this.enemy.set({
      id: def?.id || 'sim_dummy',
      name: def?.name || 'Test Dummy Élite Nv.25',
      level: def?.level ?? 25,
      maxHP: def?.maxHP ?? 4500,
      currentHP: def?.maxHP ?? 4500,
      armor: def?.armor ?? 75,
      magicResist: def?.magicResist ?? 40,
      imageUrl: def?.imageUrl || 'img/enemies/Elite-Iron-Golem-18.jpeg',
      description: def?.description,
      attacks: (def?.attacks && def.attacks.length)
        ? def.attacks.map((a: any) => ({ ...a }))
        : [{ name: 'Golpe Básico', minDamage: 90, maxDamage: 120 }],
      effects: [],
    });
    this.log.set([]);
    this.pushLog('🛡️ Simulación iniciada');
  }

  pushLog(text: string) {
    this.log.update((l) => [text, ...l].slice(0, 45));
  }

  getEffectiveArmor(enemy: SimEnemy): number {
    let armor = enemy.armor || 0;
    for (const eff of enemy.effects) {
      if (eff.type === 'debuff' && (eff.stat === 'armor' || eff.target === 'armor')) {
        armor -= eff.value || 0;
      }
    }
    return Math.max(0, armor);
  }

  getEffectiveMagicResist(enemy: SimEnemy): number {
    let resist = enemy.magicResist || 0;
    for (const eff of enemy.effects) {
      if (eff.type === 'debuff' && eff.stat === 'magicResist') {
        resist -= eff.value || 0;
      }
    }
    return Math.max(0, resist);
  }

  applyReduction(enemy: SimEnemy, damageType: string, damage: number): number {
    const dmgType = damageType || 'magical';
    const lvl = enemy.level || 1;
    if (dmgType === 'physical') {
      const armor = this.getEffectiveArmor(enemy);
      if (armor > 0) {
        const reduction = Math.round((armor / (armor + 50 + 5 * lvl)) * 100);
        return Math.round(damage * (1 - reduction / 100));
      }
    } else if (dmgType === 'magical') {
      const resist = this.getEffectiveMagicResist(enemy);
      if (resist > 0) {
        const reduction = Math.round((resist / (resist + 50 + 5 * lvl)) * 100);
        return Math.round(damage * (1 - reduction / 100));
      }
    }
    return damage;
  }

  private isDebuffGroup(key: string | undefined): boolean {
    return !!key && (key === 'attackPower' || key === 'armor');
  }

  applyEffectsToEnemy(enemy: SimEnemy, effects: any[], source?: { player?: string; ability?: string }) {
    if (!enemy.effects) enemy.effects = [];
    for (const eff of effects) {
      if (eff.stackable && eff.type === 'debuff') {
        const stacks = enemy.effects.filter((e) => e.name === eff.name);
        if (stacks.length >= (eff.maxStacks || 5)) {
          const toRefresh = stacks.reduce((a: SimEffect, b: SimEffect) => (a.duration <= b.duration ? a : b));
          toRefresh.duration = eff.duration;
          toRefresh.sourcePlayer = source?.player;
          toRefresh.sourceAbility = source?.ability;
          continue;
        }
      }
      if (!eff.stackable) {
        enemy.effects = enemy.effects.filter((e) => e.name !== eff.name);
      }
      if (eff.type === 'debuff' && this.isDebuffGroup(eff.target || eff.stat)) {
        const key = eff.target || eff.stat;
        const stronger = enemy.effects.find(
          (e: SimEffect) => !e.stackable && e.type === 'debuff' && (e.target === key || e.stat === key) && (e.value || 0) > (eff.value || 0),
        );
        if (stronger) continue;
        enemy.effects = enemy.effects.filter(
          (e: SimEffect) => e.stackable || !(e.type === 'debuff' && (e.target === key || e.stat === key) && (e.value || 0) <= (eff.value || 0)),
        );
      }
      enemy.effects.push({
        ...eff,
        duration: eff.duration,
        sourcePlayer: source?.player,
        sourceAbility: source?.ability,
      });
    }
  }

  processEnemyTick(enemy: SimEnemy): string {
    if (!enemy.effects || enemy.effects.length === 0) return '';
    let dotTotal = 0;
    const expired: string[] = [];
    for (const eff of enemy.effects) {
      if (eff.type === 'dot') {
        dotTotal += eff.value || 0;
      }
      eff.duration--;
      if (eff.duration <= 0) {
        expired.push(eff.name);
      }
    }
    if (dotTotal > 0) {
      enemy.currentHP = Math.max(0, enemy.currentHP - dotTotal);
    }
    enemy.effects = enemy.effects.filter((e) => e.duration > 0);
    if (dotTotal > 0 && expired.length > 0) {
      return `(-${dotTotal} DoT, expiró: ${expired.join(', ')})`;
    }
    if (dotTotal > 0) return `(-${dotTotal} DoT)`;
    if (expired.length > 0) return `(expiró: ${expired.join(', ')})`;
    return '';
  }

  rollAttack(enemy: SimEnemy, attackIndex: number) {
    const at: SimAttackDef = enemy.attacks[attackIndex] || enemy.attacks[0];
    let roll = at.minDamage + Math.floor(Math.random() * (at.maxDamage - at.minDamage + 1));
    for (const eff of enemy.effects) {
      if (eff.type === 'debuff' && (eff.target === 'attackPower' || eff.stat === 'attackPower')) {
        roll = Math.max(0, Math.round(roll * (1 - (eff.value || 0) / 100)));
      }
    }
    return {
      name: at.name,
      roll,
      damageType: at.damageType || 'physical',
      inflictsEffects: at.inflictsEffects || null,
    };
  }

  applyPlayerHit(payload: { player?: string; ability: string; damage: number; damageType?: string; effects?: any[] | null }) {
    const enemy = this.enemy();
    if (!enemy) {
      this.pushLog('No hay enemigo en la simulación');
      return;
    }
    const dmgType = payload.damageType || 'magical';
    if (dmgType === 'heal' || dmgType === 'buff') {
      return;
    }
    const reduced = this.applyReduction(enemy, dmgType, Math.max(0, payload.damage || 0));
    enemy.currentHP = Math.max(0, enemy.currentHP - reduced);
    if (payload.effects && payload.effects.length) {
      this.applyEffectsToEnemy(enemy, payload.effects, { player: payload.player, ability: payload.ability });
    }
    this.enemy.update((e) => ({ ...(e as SimEnemy), currentHP: enemy.currentHP }));
    const effText = payload.effects && payload.effects.length ? ` +${payload.effects.length} efecto(s)` : '';
    this.pushLog(`${payload.ability}: -${reduced} (${enemy.name})${effText}`);
    if (enemy.currentHP <= 0) {
      this.pushLog(`🏆 ${enemy.name} derrotado`);
    }
  }
}
