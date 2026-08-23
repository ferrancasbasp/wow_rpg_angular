import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ref, onChildAdded, onChildChanged, onChildRemoved, onValue, off, set, remove } from 'firebase/database';
import { FirebaseService } from '../../services/firebase.service';
import { TranslationService } from '../../services/translation.service';
import { NPC_REGISTRY } from '../../data/npc-registry';
import { Npc, NpcAttackEffect } from '../../models/game.models';
import { DEBUFF_TYPES } from '../../data/game-data';

interface MonsterAttack {
  name: string;
  min: number;
  max: number;
  inflictsEffects?: NpcAttackEffect[];
}

interface MonsterEffect {
  type: string;
  name: string;
  value?: number;
  stat?: string;
  duration: number;
  debuffType?: string;
}

interface Monster {
  id: number;
  name: string;
  maxHP: number;
  currentHP: number;
  level: number | null;
  armor: number | null;
  magicResist?: number | null;
  icon: string | null;
  imageUrl?: string | null;
  attacks?: MonsterAttack[];
  effects?: MonsterEffect[];
  lastAttackAt?: number;
  isElite?: boolean;
}

interface DamageEvent {
  id: string;
  player: string;
  ability: string;
  rank: number;
  turn: number;
  damageType: string;
  damage: number;
  aoe?: boolean;
  effects?: any[];
  assigned?: boolean;
  isHot?: boolean;
  hotTick?: number;
  hotDuration?: number;
  isShield?: boolean;
  buffStat?: string;
  buffValue?: number;
  buffDuration?: number;
  isPercent?: boolean;
  healbackPct?: number;
}

@Component({
  selector: 'app-master',
  standalone: true,
  templateUrl: "./master.component.html",
  styleUrls: ["./master.component.css"]
})
export class MasterComponent implements OnInit {
  private firebase = inject(FirebaseService);
  trSvc = inject(TranslationService);

  pendingEvents = signal<DamageEvent[]>([]);
  monsters = signal<Monster[]>([]);
  selectedEventId = signal<string | null>(null);
  newMonsterName = signal('');
  newMonsterHP = signal<number | null>(null);
  dmgInput = signal<Record<number, number | null>>({});
  toastMessage = signal('');
  attackingId = signal<number | null>(null);
  firebaseConnected = signal(false);
  monsterIdCounter = signal(1);
  selectedNpc = signal('');
  sendTargetName = signal('');
  sendAll = signal(false);
  sendAmount = signal<number | null>(null);
  sendLog = signal<string[]>([]);
  playerTargetName = signal('');
  knownPlayers = signal<string[]>([]);
  dotAmount = signal<number | null>(null);
  dotDuration = signal<number | null>(null);
  xpAmount = signal<number | null>(null);
  selectedDebuffType = signal<string>('none');
  DEBUFF_TYPES = DEBUFF_TYPES;
  pendingMonsterAttack = signal<{ roll: number; damageType: string; sourceName: string; inflictsEffects: NpcAttackEffect[] | null } | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  npcZones = computed(() => {
    const zones = new Set<string>();
    for (const key of Object.keys(NPC_REGISTRY)) {
      if (NPC_REGISTRY[key].zone) {
        zones.add(NPC_REGISTRY[key].zone);
      }
    }
    return Array.from(zones).sort();
  });

  npcByZone = computed(() => {
    const grouped: Record<string, { key: string; npc: Npc }[]> = {};
    for (const key of Object.keys(NPC_REGISTRY)) {
      const npc = NPC_REGISTRY[key];
      const zone = npc.zone || 'Otros';
      if (!grouped[zone]) {
        grouped[zone] = [];
      }
      grouped[zone].push({ key, npc });
    }
    return grouped;
  });

  isTargeting = computed(() => {
    const eventId = this.selectedEventId();
    if (eventId === null) {
      return false;
    }
    const event = this.getEvent(eventId);
    return !event?.assigned;
  });

  isPlayerTargeting = computed(() => {
    const eventId = this.selectedEventId();
    if (eventId !== null) {
      const event = this.getEvent(eventId);
      if (event && !event.assigned && (event.damageType === 'heal' || event.damageType === 'buff')) {
        return true;
      }
    }
    return this.pendingMonsterAttack() !== null;
  });

  targetingLabel = computed(() => {
    const event = this.selectedEvent();
    if (event) return event.ability;
    const atk = this.pendingMonsterAttack();
    if (atk) return `${atk.sourceName}: ${atk.roll} danno ${atk.damageType === 'physical' ? 'fisico' : 'magico'}`;
    return '';
  });

  selectedEvent = computed(() => {
    const id = this.selectedEventId();
    if (!id) return null;
    return this.getEvent(id) || null;
  });

  ngOnInit() {
    this.loadMonsters();
    try {
      this.initFirebaseListener();
    } catch {
      this.showToast(this.trSvc.t('firebase_not_configured'));
    }
  }

  initFirebaseListener() {
    const db = this.firebase.getDb();

    this.firebase.onValue('.info/connected', (val) => {
      this.firebaseConnected.set(val === true);
    });

    onChildAdded(ref(db, 'damageEvents'), (snapshot) => {
      const event = snapshot.val() as DamageEvent;
      event.id = snapshot.key as string;
      if (!event.assigned) {
        this.pendingEvents.update((events) => [...events, event]);
      }
    });

    onChildChanged(ref(db, 'damageEvents'), (snapshot) => {
      const event = snapshot.val() as DamageEvent;
      event.id = snapshot.key as string;
      if (event.assigned) {
        this.pendingEvents.update((events) =>
          events.filter((e) => e.id !== event.id),
        );
        if (this.selectedEventId() === event.id) {
          this.selectedEventId.set(null);
        }
      }
    });

    onChildAdded(ref(db, 'players'), (snapshot) => {
      const val = snapshot.val();
      if (val?.name) {
        this.knownPlayers.update(players => {
          if (players.includes(val.name)) return players;
          return [...players, val.name].sort();
        });
      }
    });

    onChildRemoved(ref(db, 'players'), (snapshot) => {
      const val = snapshot.val();
      if (val?.name) {
        this.knownPlayers.update(players => players.filter(p => p !== val.name));
      }
    });

    this.syncMonsters();
  }

  syncMonsters() {
    const db = this.firebase.getDb();
    const cleanMonsters = JSON.parse(JSON.stringify(this.monsters()));
    set(ref(db, 'monsters'), {
      list: cleanMonsters,
      counter: this.monsterIdCounter(),
      timestamp: Date.now(),
    });
  }

  selectEvent(id: string) {
    const event = this.getEvent(id);
    if (event && event.assigned) {
      return;
    }
    this.selectedEventId.update((current) => (current === id ? null : id));
  }

  getEvent(id: string): DamageEvent | undefined {
    return this.pendingEvents().find((e) => e.id === id);
  }

  assignDamageToMonster(monster: Monster) {
    const eventId = this.selectedEventId();
    if (eventId === null) {
      return;
    }
    const event = this.getEvent(eventId);
    if (!event || event.assigned) {
      return;
    }
    if (event.aoe) {
      this.applyAoeDamage(event);
      return;
    }
    this.applySingleDamage(monster, event);
  }

  applySingleDamage(monster: Monster, event: DamageEvent) {
    let damage = event.damage;
    const reductionText = this.getReductionText(monster, event);
    damage = this.applyReduction(monster, event, damage);
    monster.currentHP = Math.max(0, monster.currentHP - damage);
    if (event.effects) {
      this.applyEffectsToMonster(monster, event.effects);
    }
    this.markEventAssigned(event);
    this.selectedEventId.set(null);
    this.saveMonsters();
    if (monster.currentHP <= 0) {
      this.showToast(
        monster.name + ' derrotado (-' + damage + reductionText + ')',
      );
    } else {
      const effectText = event.effects
        ? ' +' + event.effects.length + ' efecto(s)'
        : '';
      this.showToast(
        damage + ' daño a ' + monster.name + reductionText + effectText,
      );
    }
  }

  applyAoeDamage(event: DamageEvent) {
    const alive = this.monsters().filter((m) => m.currentHP > 0);
    if (alive.length === 0) {
      this.showToast(this.trSvc.t('no_monsters_alive'));
      return;
    }
    const summary: string[] = [];
    for (const monster of alive) {
      const damage = this.applyReduction(monster, event, event.damage);
      monster.currentHP = Math.max(0, monster.currentHP - damage);
      if (event.effects) {
        this.applyEffectsToMonster(monster, event.effects);
      }
      summary.push(monster.name + ': -' + damage);
    }
    this.markEventAssigned(event);
    this.selectedEventId.set(null);
    this.saveMonsters();
    this.showToast('AOE: ' + summary.join(' · '));
  }

  applyEffectsToMonster(monster: Monster, effects: any[]) {
    if (!monster.effects) {
      monster.effects = [];
    }
    for (const eff of effects) {
      monster.effects = monster.effects.filter((e) => e.name !== eff.name);
      monster.effects.push({ ...eff, duration: eff.duration });
    }
  }

  getEffectiveArmor(monster: Monster): number {
    let armor = monster.armor || 0;
    if (monster.effects) {
      for (const eff of monster.effects) {
        if (eff.type === 'debuff' && eff.stat === 'armor') {
          armor -= eff.value || 0;
        }
      }
    }
    return Math.max(0, armor);
  }

  getEffectiveMagicResist(monster: Monster): number {
    let resist = monster.magicResist || 0;
    if (monster.effects) {
      for (const eff of monster.effects) {
        if (eff.type === 'debuff' && eff.stat === 'magicResist') {
          resist -= eff.value || 0;
        }
      }
    }
    return Math.max(0, resist);
  }

  processMonsterEffects(monster: Monster): string {
    if (!monster.effects || monster.effects.length === 0) {
      return '';
    }
    let dotTotal = 0;
    const expired: string[] = [];
    for (const eff of monster.effects) {
      if (eff.type === 'dot') {
        dotTotal += eff.value || 0;
      }
      eff.duration--;
      if (eff.duration <= 0) {
        expired.push(eff.name);
      }
    }
    if (dotTotal > 0) {
      monster.currentHP = Math.max(0, monster.currentHP - dotTotal);
    }
    monster.effects = monster.effects.filter((e) => e.duration > 0);
    this.saveMonsters();
    if (dotTotal > 0 && expired.length > 0) {
      return (
        ' (-' + dotTotal + ' DoT, expiró: ' + expired.join(', ') + ')'
      );
    } else if (dotTotal > 0) {
      return ' (-' + dotTotal + ' DoT)';
    } else if (expired.length > 0) {
      return ' (expiró: ' + expired.join(', ') + ')';
    }
    return '';
  }

  applyReduction(
    monster: Monster,
    event: DamageEvent,
    damage: number,
  ): number {
    const dmgType = event.damageType || 'magical';
    const lvl = monster.level || 1;
    if (dmgType === 'physical') {
      const armor = this.getEffectiveArmor(monster);
      if (armor > 0) {
        const reduction = Math.round(
          (armor / (armor + 50 + 5 * lvl)) * 100,
        );
        return Math.round(damage * (1 - reduction / 100));
      }
    } else if (dmgType === 'magical') {
      const resist = this.getEffectiveMagicResist(monster);
      if (resist > 0) {
        const reduction = Math.round(
          (resist / (resist + 50 + 5 * lvl)) * 100,
        );
        return Math.round(damage * (1 - reduction / 100));
      }
    }
    return damage;
  }

  getReductionText(monster: Monster, event: DamageEvent): string {
    const dmgType = event.damageType || 'magical';
    const lvl = monster.level || 1;
    if (dmgType === 'physical') {
      const armor = this.getEffectiveArmor(monster);
      if (armor > 0) {
        return (
          ' (−' +
          Math.round((armor / (armor + 50 + 5 * lvl)) * 100) +
          '% armor)'
        );
      }
    } else if (dmgType === 'magical') {
      const resist = this.getEffectiveMagicResist(monster);
      if (resist > 0) {
        return (
          ' (−' +
          Math.round((resist / (resist + 50 + 5 * lvl)) * 100) +
          '% resist)'
        );
      }
    }
    return '';
  }

  markEventAssigned(event: DamageEvent) {
    event.assigned = true;
    this.firebase.setData('damageEvents/' + event.id, { assigned: true });
    this.pendingEvents.update((events) =>
      events.filter((e) => e.id !== event.id),
    );
  }

  rollMonsterAttack(monster: Monster, attack: MonsterAttack) {
    const roll =
      attack.min +
      Math.floor(Math.random() * (attack.max - attack.min + 1));
    const dotText = this.processMonsterEffects(monster);
    this.attackingId.set(monster.id);
    setTimeout(() => {
      this.attackingId.set(null);
    }, 400);
    monster.lastAttackAt = Date.now();
    this.saveMonsters();
    this.pendingMonsterAttack.set({
      roll,
      damageType: 'physical',
      sourceName: monster.name + ' - ' + attack.name,
      inflictsEffects: attack.inflictsEffects || null,
    });
    this.selectedEventId.set(null);
    this.showToast(
      monster.name + ' usa ' + attack.name + ': ' + roll + ' danno — clicka un jugador para asignar' + dotText,
    );
  }

  applyManualDamage(monster: Monster) {
    const dmg = this.dmgInput()[monster.id];
    if (!dmg || dmg <= 0) {
      return;
    }
    monster.currentHP = Math.max(0, monster.currentHP - dmg);
    this.dmgInput.update((d) => ({ ...d, [monster.id]: null }));
    this.saveMonsters();
    if (monster.currentHP <= 0) {
      this.showToast(monster.name + ' ' + this.trSvc.t('defeated') + ' (-' + dmg + ')');
    } else {
      this.showToast('-' + dmg + ' a ' + monster.name);
    }
  }

  healMonster(monster: Monster) {
    monster.currentHP = monster.maxHP;
    this.saveMonsters();
    this.showToast(monster.name + ' ' + this.trSvc.t('healed_max'));
  }

  addMonster() {
    if (
      !this.newMonsterName().trim() ||
      !this.newMonsterHP() ||
      this.newMonsterHP()! <= 0
    ) {
      return;
    }
    const id = this.monsterIdCounter();
    this.monsterIdCounter.set(id + 1);
    const newMonster: Monster = {
      id,
      name: this.newMonsterName().trim(),
      maxHP: this.newMonsterHP()!,
      currentHP: this.newMonsterHP()!,
      level: null,
      armor: null,
      magicResist: null,
      icon: null,
    };
    this.monsters.update((monsters) => [...monsters, newMonster]);
    this.newMonsterName.set('');
    this.newMonsterHP.set(null);
    this.saveMonsters();
    this.showToast(this.trSvc.t('monster_added'));
  }

  addPresetNpc() {
    const key = this.selectedNpc();
    if (!key) {
      return;
    }
    const npc = NPC_REGISTRY[key];
    if (!npc) {
      return;
    }
    const id = this.monsterIdCounter();
    this.monsterIdCounter.set(id + 1);
    const newMonster: Monster = {
      id,
      name: npc.name,
      icon: null,
      imageUrl: npc.imageUrl || null,
      level: npc.level,
      maxHP: npc.hp,
      currentHP: npc.hp,
      armor: npc.armor,
      isElite: npc.isElite || false,
      attacks: npc.attacks.map((a) => ({
        name: a.name,
        min: a.minDamage,
        max: a.maxDamage,
        inflictsEffects: a.inflictsEffects || undefined,
      })),
    };
    this.monsters.update((monsters) => [...monsters, newMonster]);
    this.selectedNpc.set('');
    this.saveMonsters();
    this.showToast(npc.name + ' ' + this.trSvc.t('npc_added_msg'));
  }

  removeMonster(id: number) {
    this.monsters.update((monsters) =>
      monsters.filter((m) => m.id !== id),
    );
    this.saveMonsters();
  }

  monsterHPPercent(monster: Monster): number {
    if (monster.maxHP === 0) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor((monster.currentHP / monster.maxHP) * 100),
    );
  }

  saveMonsters() {
    this.monsters.set([...this.monsters()]);
    try {
      localStorage.setItem(
        'ttrpg_wow_monsters',
        JSON.stringify({
          monsters: this.monsters(),
          counter: this.monsterIdCounter(),
        }),
      );
    } catch {}
    this.syncMonsters();
  }

  loadMonsters() {
    try {
      const data = localStorage.getItem('ttrpg_wow_monsters');
      if (data) {
        const parsed = JSON.parse(data);
        const monsters: Monster[] = parsed.monsters || [];
        const counter = parsed.counter || monsters.length + 1;
        let enriched = 0;
        for (const m of monsters) {
          if (!m.imageUrl) {
            for (const key of Object.keys(NPC_REGISTRY)) {
              const npc = NPC_REGISTRY[key];
              if (npc.name === m.name && npc.imageUrl) {
                m.imageUrl = npc.imageUrl;
                enriched++;
                break;
              }
            }
          }
        }
        this.monsters.set(monsters);
        this.monsterIdCounter.set(counter);
        if (enriched > 0) {
          try {
            localStorage.setItem(
              'ttrpg_wow_monsters',
              JSON.stringify({
                monsters: this.monsters(),
                counter: this.monsterIdCounter(),
              }),
            );
          } catch {}
        }
      }
    } catch {}
  }

  clearAllEvents() {
    for (const event of this.pendingEvents()) {
      event.assigned = true;
      this.firebase.setData('damageEvents/' + event.id, {
        assigned: true,
      });
    }
    this.pendingEvents.set([]);
    this.selectedEventId.set(null);
    this.showToast(this.trSvc.t('events_cleared'));
  }

  clearPlayers() {
    const db = this.firebase.getDb();
    for (const name of this.knownPlayers()) {
      remove(ref(db, 'players/' + name));
    }
    this.knownPlayers.set([]);
    this.showToast(this.trSvc.t('players_cleared'));
  }

  selectPlayerTarget(name: string) {
    this.playerTargetName.set(name);
  }

  onPlayerChipClick(name: string) {
    if (this.isPlayerTargeting()) {
      const event = this.selectedEvent();
      if (event) {
        this.playerTargetName.set(name);
        this.assignToPlayer(event);
      } else {
        const atk = this.pendingMonsterAttack();
        if (atk) {
          this.firebase.pushData('playerEvents', {
            target: name,
            type: 'monsterAttack',
            amount: atk.roll,
            damageType: atk.damageType,
            sourceName: atk.sourceName,
            inflictsEffects: atk.inflictsEffects || null,
            timestamp: Date.now(),
          });
          const effText = atk.inflictsEffects && atk.inflictsEffects.length > 0
            ? ' + ' + atk.inflictsEffects.map(e => e.name).join(', ')
            : '';
          this.sendLog.update(log => [`${name}: -${atk.roll} (${atk.sourceName})${effText}`, ...log].slice(0, 8));
          this.showToast(`${atk.sourceName}: ${atk.roll} danno${effText} → ${name}`);
          this.pendingMonsterAttack.set(null);
        }
      }
    } else {
      this.sendTargetName.set(name);
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set('');
    }, 2500);
  }

  onNpcSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    select.value = "";
    this.selectedNpc.set(value);
    this.addPresetNpc();
  }

  onDebuffTypeChange(event: Event) {
    this.selectedDebuffType.set((event.target as HTMLSelectElement).value);
  }

  onDmgInput(monsterId: number, value: number | null) {
    this.dmgInput.update((d) => ({ ...d, [monsterId]: value }));
  }

  getSendTargets(): string[] {
    if (this.sendAll()) return [...this.knownPlayers()];
    const t = this.sendTargetName().trim();
    return t ? [t] : [];
  }

  quickSendDebuff(name: string, targetStat: string, value: number, duration: number) {
    const targets = this.getSendTargets();
    if (targets.length === 0) { this.showToast('Selecciona un jugador o All'); return; }
    for (const target of targets) {
      this.firebase.pushData('playerEvents', {
        target,
        type: 'buff',
        effect: { type: 'debuff', name, target: targetStat, value, duration, debuffType: this.selectedDebuffType() },
        timestamp: Date.now(),
      });
    }
    const label = targets.length > 1 ? `All (${targets.length})` : targets[0];
    this.sendLog.update(log => [`${label}: ${name} (${duration}t)`, ...log].slice(0, 8));
    this.showToast(`${name} → ${label}`);
  }

  quickSendDot() {
    const targets = this.getSendTargets();
    if (targets.length === 0) { this.showToast('Selecciona un jugador o All'); return; }
    const dmg = this.dotAmount();
    const dur = this.dotDuration() || 3;
    if (!dmg || dmg <= 0) { this.showToast('Introduce danno/turno'); return; }
    for (const target of targets) {
      this.firebase.pushData('playerEvents', {
        target,
        type: 'buff',
        effect: { type: 'dot', name: 'DoT del Master', target: 'hp', value: dmg, duration: dur, debuffType: this.selectedDebuffType() },
        timestamp: Date.now(),
      });
    }
    const label = targets.length > 1 ? `All (${targets.length})` : targets[0];
    this.sendLog.update(log => [`${label}: DoT ${dmg}/t · ${dur}t`, ...log].slice(0, 8));
    this.showToast(`DoT ${dmg}/t · ${dur}t → ${label}`);
    this.dotAmount.set(null);
    this.dotDuration.set(null);
  }

  quickSendDirect(type: 'heal' | 'damage') {
    const targets = this.getSendTargets();
    if (targets.length === 0) { this.showToast('Selecciona un jugador o All'); return; }
    const amount = this.sendAmount();
    if (!amount || amount <= 0) { this.showToast('Introduce una cantidad'); return; }
    for (const target of targets) {
      this.firebase.pushData('playerEvents', {
        target,
        type,
        amount,
        timestamp: Date.now(),
      });
    }
    const label = targets.length > 1 ? `All (${targets.length})` : targets[0];
    const hpLabel = type === 'heal' ? '+' + amount : '-' + amount;
    this.sendLog.update(log => [`${label}: ${hpLabel} HP`, ...log].slice(0, 8));
    this.showToast(`${hpLabel} HP → ${label}`);
    this.sendAmount.set(null);
  }

  sendXP() {
    const targets = this.getSendTargets();
    if (targets.length === 0) { this.showToast('Selecciona un jugador o All'); return; }
    const amount = this.xpAmount();
    if (!amount || amount <= 0) { this.showToast('Introduce XP'); return; }
    for (const target of targets) {
      this.firebase.pushData('playerEvents', {
        target,
        type: 'xp',
        amount,
        timestamp: Date.now(),
      });
    }
    const label = targets.length > 1 ? `All (${targets.length})` : targets[0];
    this.sendLog.update(log => [`${label}: +${amount} XP`, ...log].slice(0, 8));
    this.showToast(`+${amount} XP → ${label}`);
    this.xpAmount.set(null);
  }

  sendLevel(levels: number) {
    const targets = this.getSendTargets();
    if (targets.length === 0) { this.showToast('Selecciona un jugador o All'); return; }
    for (const target of targets) {
      this.firebase.pushData('playerEvents', {
        target,
        type: 'levelup',
        amount: levels,
        timestamp: Date.now(),
      });
    }
    const label = targets.length > 1 ? `All (${targets.length})` : targets[0];
    this.sendLog.update(log => [`${label}: +${levels} nivel(es)`, ...log].slice(0, 8));
    this.showToast(`+${levels} nivel(es) → ${label}`);
  }

  assignToPlayer(event: DamageEvent) {
    const target = this.playerTargetName().trim();
    if (!target) {
      this.showToast('Escribe el nombre del jugador');
      return;
    }

    if (event.damageType === 'buff') {
      this.firebase.pushData('playerEvents', {
        target,
        type: 'buff',
        abilityName: event.ability.replace(' (Buff)', ''),
        buffStat: event.buffStat,
        buffValue: event.buffValue,
        buffDuration: event.buffDuration,
        isPercent: event.isPercent,
        timestamp: Date.now(),
      });
      this.showToast(`${event.ability} → ${target}: +${event.buffValue} ${event.buffStat}`);
    } else if (event.damageType === 'heal') {
      if (event.isHot) {
        this.firebase.pushData('playerEvents', {
          target,
          type: 'hot',
          abilityName: event.ability.replace(' (Cura)', ''),
          hotTick: event.hotTick,
          hotDuration: event.hotDuration,
          hotTotal: event.damage,
          timestamp: Date.now(),
        });
        this.showToast(`${event.ability} → ${target}: ${event.hotTick}/t · ${event.hotDuration}t`);
      } else if (event.isShield) {
        this.firebase.pushData('playerEvents', {
          target,
          type: 'shield',
          abilityName: event.ability.replace(' (Cura)', ''),
          amount: event.damage,
          timestamp: Date.now(),
        });
        this.showToast(`${event.ability} → ${target}: 🛡️ ${event.damage} absorcion`);
      } else {
        this.firebase.pushData('playerEvents', {
          target,
          type: 'heal',
          abilityName: event.ability.replace(' (Cura)', ''),
          amount: event.damage,
          timestamp: Date.now(),
        });
        const healback = event.healbackPct || 0;
        const caster = (event.player || '').trim().toLowerCase();
        if (healback > 0 && caster && target.trim().toLowerCase() !== caster) {
          const healbackAmt = Math.round(event.damage * healback);
          if (healbackAmt > 0) {
            this.firebase.pushData('playerEvents', {
              target: event.player,
              type: 'heal',
              abilityName: 'Improved Healthstone',
              amount: healbackAmt,
              timestamp: Date.now(),
            });
            this.showToast(`Healthstone → ${event.player}: +${healbackAmt} HP (Improved Healthstone)`);
          }
        }
        this.showToast(`${event.ability} → ${target}: +${event.damage} HP`);
      }
    }

    this.markEventAssigned(event);
    this.playerTargetName.set('');
    this.selectedEventId.set(null);
  }
}
