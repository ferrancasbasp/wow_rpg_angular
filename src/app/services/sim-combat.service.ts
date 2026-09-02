import { Injectable, signal } from '@angular/core';
import { SIM_SHEET_URL } from '../data/sim-config';

const STORAGE_KEY = 'sim_runs_pending';

export interface SimRun {
  fecha: string;
  clase: string;
  nivel: number;
  resultado: string;
  turnos: number;
  danoTotal: number;
  danoPorTurno: number;
  curaTotal: number;
  hpFinal: number;
  topHabilidades: string;
  enemigo: string;
}

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
  readonly pendingCount = signal(0);
  readonly syncState = signal<'ok' | 'syncing' | 'off' | 'pending'>('off');
  readonly lastSyncError = signal('');

  private damageByAbility = new Map<string, number>();
  private healTotal = 0;
  private ended = false;
  private lastTurns = 0;

  private get damageTotal(): number {
    return [...this.damageByAbility.values()].reduce((a, b) => a + b, 0);
  }

  setTurns(turns: number) {
    this.lastTurns = turns;
  }

  isFightInProgress(): boolean {
    return !this.ended && this.damageTotal > 0;
  }

  constructor() {
    this.refreshPendingCount();
  }

  private refreshPendingCount() {
    const pending: SimRun[] = this.loadPending();
    this.pendingCount.set(pending.length);
  }

  private loadPending(): SimRun[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SimRun[]) : [];
    } catch {
      return [];
    }
  }

  private storePending(pending: SimRun[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending.slice(-200)));
    this.refreshPendingCount();
  }

  recordHeal(amount: number) {
    this.healTotal += amount;
  }

  recordRun(result: 'victoria' | 'derrota' | 'abandonado', meta?: { clase?: string; nivel?: number; turnos?: number; hpFinal?: number; enemigo?: string }) {
    if (this.ended) return;
    this.ended = true;
    const enemy = this.enemy();
    const top = [...this.damageByAbility.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
    const run: SimRun = {
      fecha: new Date().toISOString(),
      clase: meta?.clase || '',
      nivel: meta?.nivel ?? 0,
      resultado: result,
      turnos: meta?.turnos ?? this.lastTurns,
      danoTotal: this.damageTotal,
      danoPorTurno: this.lastTurns > 0 ? Math.round(this.damageTotal / this.lastTurns) : 0,
      curaTotal: Math.round(this.healTotal),
      hpFinal: meta?.hpFinal ?? 0,
      topHabilidades: top,
      enemigo: meta?.enemigo || enemy?.name || '',
    };
    const pending = this.loadPending();
    pending.push(run);
    this.storePending(pending);
    this.pushLog(`📝 Run registrado (${this.pendingCount()} pendiente${this.pendingCount() === 1 ? '' : 's'})`);
    this.syncPending();
  }

  private async postRun(run: SimRun): Promise<boolean> {
    const url = `${SIM_SHEET_URL}?run=${encodeURIComponent(JSON.stringify(run))}`;
    try {
      const res = await fetch(url, { method: 'GET' });
      const txt = await res.text();
      if (txt.startsWith('OK')) return true;
      this.lastSyncError.set(txt.slice(0, 300));
      return false;
    } catch {
      const img = new Image();
      img.src = url;
      return true;
    }
  }

  async syncPending() {
    if (!SIM_SHEET_URL) {
      this.syncState.set('off');
      return;
    }
    const pending = this.loadPending();
    if (pending.length === 0) {
      this.syncState.set('ok');
      return;
    }
    this.syncState.set('syncing');
    this.lastSyncError.set('');
    let sent = 0;
    const remaining: SimRun[] = [];
    for (const run of pending) {
      if (await this.postRun(run)) {
        sent++;
      } else {
        remaining.push(run);
      }
    }
    this.storePending(remaining);
    this.syncState.set(remaining.length > 0 ? 'pending' : 'ok');
    if (this.lastSyncError()) this.pushLog(`⚠ Hoja: ${this.lastSyncError()}`);
    if (sent > 0) this.pushLog(`⬆ ${sent} run(s) subidos a la hoja`);
  }

  reset(def?: Partial<SimEnemy>) {
    if (!this.ended && this.damageTotal > 0) {
      this.recordRun('abandonado');
    }
    this.ended = false;
    this.damageByAbility.clear();
    this.healTotal = 0;
    this.lastTurns = 0;
    this.enemy.set({
      id: def?.id || 'sim_dummy',
      name: def?.name || 'Test Dummy Élite Nv.25',
      level: def?.level ?? 25,
      maxHP: def?.maxHP ?? 3000,
      currentHP: def?.maxHP ?? 3000,
      armor: def?.armor ?? 75,
      magicResist: def?.magicResist ?? 40,
      imageUrl: def?.imageUrl || 'img/enemies/Elite-Iron-Golem-18.jpeg',
      description: def?.description,
      attacks: (def?.attacks && def.attacks.length)
        ? def.attacks.map((a: any) => ({ ...a }))
        : [{ name: 'Golpe Básico', minDamage: 81, maxDamage: 108 }],
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
    this.damageByAbility.set(payload.ability, (this.damageByAbility.get(payload.ability) || 0) + reduced);
    if (payload.effects && payload.effects.length) {
      this.applyEffectsToEnemy(enemy, payload.effects, { player: payload.player, ability: payload.ability });
    }
    this.enemy.update((e) => ({ ...(e as SimEnemy), currentHP: enemy.currentHP }));
    const effText = payload.effects && payload.effects.length ? ` +${payload.effects.length} efecto(s)` : '';
    this.pushLog(`${payload.ability}: -${reduced} (${enemy.name})${effText}`);
    if (enemy.currentHP <= 0 && !this.ended) {
      this.pushLog(`🏆 ${enemy.name} derrotado`);
      this.recordRun('victoria');
    }
  }

  checkWin() {
    const enemy = this.enemy();
    if (enemy && enemy.currentHP <= 0 && !this.ended) {
      this.pushLog(`🏆 ${enemy.name} derrotado`);
      this.recordRun('victoria');
    }
  }
}
