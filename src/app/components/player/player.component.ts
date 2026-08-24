import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { FirebaseService } from '../../services/firebase.service';
import { TranslationService } from '../../services/translation.service';
import { onChildAdded, ref, off } from 'firebase/database';
import { ClassRegistryService } from '../../services/class-registry.service';
import {
  STAT_KEYS, STAT_ICONS, EFFECT_TYPES, BUFF_DEBUFF_STATS,
  DEBUFF_TYPES, debuffColor,
  NOTE_NAMES, NOTE_COLORS,
  STATUS_OPTIONS, HOT_DOT_TARGETS, EQUIPMENT_SLOTS, MAX_LEVEL,
  xpForLevel, createDefaultCharacter,
} from '../../data/game-data';
import { StatKey, ActiveEffect, EquipmentItem, EffectType, CharacterClass } from '../../models/game.models';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [],
  host: {
    '[style.--class-color]': 'classColor()',
    '[style.--class-glow]': 'classGlow()',
  },
  templateUrl: "./player.component.html",
  styleUrls: ["./player.component.css"]
})
export class PlayerComponent implements OnInit, OnDestroy {
  charSvc = inject(CharacterService);
  trSvc = inject(TranslationService);
  private firebase = inject(FirebaseService);
  private classRegistry = inject(ClassRegistryService);

  MAX_LEVEL = MAX_LEVEL;
  STAT_ICONS = STAT_ICONS;
  EFFECT_TYPES = EFFECT_TYPES;
  DEBUFF_TYPES = DEBUFF_TYPES;
  debuffColor = debuffColor;
  NOTE_NAMES = NOTE_NAMES;
  NOTE_COLORS = NOTE_COLORS;
  STATUS_OPTIONS = STATUS_OPTIONS;
  BUFF_DEBUFF_STATS = BUFF_DEBUFF_STATS;
  HOT_DOT_TARGETS = HOT_DOT_TARGETS;

  showExportModal = signal(false);
  showTalentModal = signal(false);
  showStatsModal = signal(false);
  showEquipment = signal(false);
  showEffectsPanel = signal(true);
  hoveredTalent = signal<any>(null);
  xpInputAmount = signal(0);
  hpLossAmount = signal(0);
  hpActionType = signal('magical');
  levelUpFlash = signal(false);
  abilityRolls = signal<Record<string, { roll: number; crit: boolean }>>({});
  incomingMasterMsg = signal('');

  private playerEventUnsub: (() => void) | null = null;

  newEffect = signal<{
    type: ActiveEffect['type'];
    name: string;
    target: string;
    value: number;
    duration: number;
  }>({
    type: 'buff',
    name: '',
    target: 'aguante',
    value: 0,
    duration: 1,
  });

  classColor = computed(() => this.charSvc.classConfig().color || '#C79C6E');
  classGlow = computed(() => this.classColor() + '4D');

  get statEntries(): [string, StatKey][] {
    return Object.entries(STAT_KEYS);
  }

  get classEntries(): [string, CharacterClass][] {
    return Object.entries(this.classRegistry.getAll());
  }

  get effectTypeEntries(): [string, EffectType][] {
    return Object.entries(EFFECT_TYPES);
  }

  ngOnInit() {
    this.charSvc.loadFromLocalStorage();
    this.initPlayerEventListener();
  }

  ngOnDestroy() {
    this.playerEventUnsub?.();
  }

  initPlayerEventListener() {
    try {
      const db = this.firebase.getDb();
      const cb = onChildAdded(ref(db, 'playerEvents'), (snapshot) => {
        const event = snapshot.val();
        const myName = (this.charSvc.character().name || '').trim().toLowerCase();
        const targetName = (event?.target || '').trim().toLowerCase();
        if (!myName || !targetName) return;

        const activePet = this.charSvc.activePetData();
        const petName = activePet ? (myName + ' — ' + activePet.name.toLowerCase()) : '';
        const isPetTarget = petName && targetName === petName;

        if (!isPetTarget && myName !== targetName) return;

        if (isPetTarget) {
          if (event.type === 'heal') {
            this.charSvc.character.update(c => ({
              ...c,
              activePet: c.activePet ? { ...c.activePet, currentHP: Math.min(this.charSvc.petMaxHP(), c.activePet.currentHP + event.amount) } : null,
            }));
            this.incomingMasterMsg.set('💚 ' + (event.abilityName || 'Master') + ': +' + event.amount + ' HP (pet)');
          } else if (event.type === 'damage' || event.type === 'monsterAttack') {
            this.charSvc.petTakeDamage(event.amount);
            this.incomingMasterMsg.set('💢 ' + (event.abilityName || 'Master') + ': -' + event.amount + ' danyo (pet)');
          }
          this.firebase.removeData('playerEvents/' + snapshot.key);
          setTimeout(() => this.incomingMasterMsg.set(''), 4000);
          return;
        }

        if (event.type === 'heal') {
          this.charSvc.adjustHP(event.amount);
          this.incomingMasterMsg.set('💚 ' + (event.abilityName || 'Master') + ': +' + event.amount + ' HP');
        } else if (event.type === 'damage') {
          this.charSvc.adjustHP(-event.amount);
          this.incomingMasterMsg.set('💢 ' + (event.abilityName || 'Master') + ': -' + event.amount + ' daño');
          this.exitStealth();
        } else if (event.type === 'monsterAttack') {
          this.hpAction(event.amount, event.damageType || 'physical');
          this.exitStealth();
          let effText = '';
          if (event.inflictsEffects && Array.isArray(event.inflictsEffects)) {
            for (const eff of event.inflictsEffects) {
              this.addPlayerEffect({
                id: Date.now() + Math.random(),
                type: eff.type,
                name: eff.name,
                target: eff.target || 'hp',
                value: eff.value || 0,
                duration: eff.duration,
                debuffType: eff.debuffType || 'none',
              });
            }
            effText = ' + ' + event.inflictsEffects.map((e: any) => e.name).join(', ');
          }
          this.incomingMasterMsg.set('⚔️ ' + (event.sourceName || 'Enemigo') + ': ' + event.amount + ' danno ' + (event.damageType === 'physical' ? 'fisico' : 'magico') + effText);
        } else if (event.type === 'xp') {
          this.addXP(event.amount);
          this.incomingMasterMsg.set('✦ +' + event.amount + ' XP');
        } else if (event.type === 'levelup') {
          this.grantLevel(event.amount || 1);
          this.incomingMasterMsg.set('✦ +' + (event.amount || 1) + ' nivel');
        } else if (event.type === 'soul_shards') {
          this.charSvc.addShard(event.amount || 0);
          this.incomingMasterMsg.set('🌱 Seed of Corruption: +' + (event.amount || 0) + ' Soul Shards');
        } else if (event.type === 'shield') {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== (event.abilityName || 'Shield')),
              { id: Date.now() + Math.random(), type: 'buff' as const, name: event.abilityName || 'Shield', target: 'shield', value: event.amount, duration: 99 },
            ],
          }));
          this.incomingMasterMsg.set('🛡️ ' + (event.abilityName || 'Master') + ': ' + event.amount + ' absorcion');
        } else if (event.type === 'hot') {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== (event.abilityName || 'HoT')),
              { id: Date.now() + Math.random(), type: 'hot' as const, name: event.abilityName || 'HoT', target: 'hp', value: event.hotTick, duration: event.hotDuration },
            ],
          }));
          this.incomingMasterMsg.set('🩹 ' + (event.abilityName || 'Master') + ': ' + event.hotTick + '/t · ' + event.hotDuration + 't');
        } else if (event.type === 'buff') {
          if (event.effect) {
            this.addPlayerEffect(event.effect);
            const eff = event.effect;
            const icon = eff.type === 'dot' ? '🩸' : eff.type === 'debuff' ? '⛔' : '✨';
            const detail = eff.type === 'dot'
              ? `${eff.value}/t · ${eff.duration}t`
              : eff.type === 'debuff'
                ? `${eff.duration}t`
                : `+${eff.value} ${eff.target} · ${eff.duration}t`;
            this.incomingMasterMsg.set(`${icon} Master: ${eff.name} (${detail})`);
          } else {
            this.charSvc.character.update(c => ({
              ...c,
              activeEffects: [
                ...(c.activeEffects || []).filter(e => e.name !== (event.abilityName || 'Buff')),
                { id: Date.now() + Math.random(), type: 'buff' as const, name: event.abilityName || 'Buff', target: event.buffStat || 'all_stats', value: event.buffValue || 0, duration: event.buffDuration || 5, isPercent: event.isPercent || false },
              ],
            }));
            this.incomingMasterMsg.set('🌟 ' + (event.abilityName || 'Master') + ': +' + event.buffValue + ' ' + event.buffStat + ' (' + event.buffDuration + 't)');
          }
        }

        this.firebase.removeData('playerEvents/' + snapshot.key);
        setTimeout(() => this.incomingMasterMsg.set(''), 4000);
      });
      this.playerEventUnsub = () => off(ref(db, 'playerEvents'), 'child_added', cb);
    } catch (e) {
      console.error('Player event listener error:', e);
    }
  }

  comboPointArray(max: number): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  noteSlotArray(): number[] {
    return Array.from({ length: 7 }, (_, i) => i + 1);
  }

  shardArray(): number[] {
    return Array.from({ length: this.charSvc.soulShardMax() }, (_, i) => i + 1);
  }

  actionSlotArray(): number[] {
    return Array.from({ length: this.charSvc.maxActions() }, (_, i) => i + 1);
  }

  getEquipItem(slotKey: string): EquipmentItem {
    return (this.charSvc.character().equipment as any)[slotKey];
  }

  getEquipExtra(slotKey: string, fieldKey: string): number {
    return (this.charSvc.character().equipment as any)[slotKey]?.[fieldKey] || 0;
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const next = img.nextElementSibling as HTMLElement;
    if (next) next.style.display = 'inline';
  }

  onImgErrorSimple(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  onTalentImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const next = img.nextElementSibling as HTMLElement;
    if (next) next.style.display = 'flex';
  }

  onTalentRightClick(event: Event, talentId: string) {
    event.preventDefault();
    this.charSvc.removeTalentPoint(talentId);
  }

  onCapstoneEnter(capstone: any) {
    this.hoveredTalent.set({ ...capstone, maxRank: 1, tier: 99, requires: null, isCapstone: true });
  }

  onCapstoneRightClick(event: Event, capstone: any) {
    event.preventDefault();
    if (this.charSvc.selectedCapstone() === capstone.id) {
      this.charSvc.character.update(c => ({ ...c, capstone: undefined }));
      this.charSvc.showToast('Capstone deseleccionada');
    }
  }

  castSummonInfernal(ability: any) {
    const shardCost = ability.shardCost || 2;
    this.charSvc.spendShards(shardCost);

    const sp = this.charSvc.spellPower();
    const ratio = ability.spellPowerRatio || 0.8;
    const dr = ability.damageRanges?.[0] || { min: 70, max: 110 };
    const minD = Math.round(dr.min + sp * ratio);
    const maxD = Math.round(dr.max + sp * ratio);
    let dmg = minD + Math.floor(Math.random() * (maxD - minD + 1));
    if (Math.random() * 100 < parseFloat(this.charSvc.spellCrit())) {
      let critMult = 1.5;
      const dsRank = this.charSvc.talentRank('destruction_specialization');
      if (dsRank > 0) critMult = 1.5 + dsRank * 0.15;
      if (this.charSvc.hasEffect('demonic_form')) critMult = critMult * 1.25;
      dmg = Math.round(dmg * critMult);
    }

    const landingAbility = {
      ...ability,
      currentRank: 1,
      isDot: false,
      inflictsEffects: [{ type: 'debuff', name: this.trSvc.t('infernal_stun'), target: 'stunned', value: 0, duration: ability.stunDuration || 1 }],
    };
    this.charSvc.sendDamageEvent(landingAbility, dmg);

    const turns = ability.infernalTurns || 4;
    this.charSvc.summonInfernal(turns);
    this.charSvc.showToast('🔥 Infernal aterriza! ' + dmg + ' danyo de Fuego a todos · stun 1 turno · lucha ' + turns + ' turnos');
  }

  castDemonicSacrifice(ability: any) {
    const shardCost = ability.shardCost || 2;
    if (!this.charSvc.spendShards(shardCost)) {
      this.charSvc.showToast(this.trSvc.t('need_shards') + ' ' + shardCost + ' ' + this.trSvc.t('soul_shards_plural'));
      return;
    }
    const pet = this.charSvc.activePetData();
    if (!pet) {
      this.charSvc.addShard(shardCost);
      this.charSvc.showToast('No tienes un demonio invocado para sacrificar');
      return;
    }
    const now = Date.now() + Math.random();
    const maxHp = this.charSvc.maxHP();
    if (pet.id === 'imp') {
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== 'Burning Soul'),
          { id: now, type: 'buff' as const, name: 'Burning Soul', target: 'spellPower', value: 20, duration: 999, isPercent: true },
        ],
      }));
      this.charSvc.showToast('💀 Sacrificaste al Imp · Burning Soul: +20% Spell Power (toda la batalla)');
    } else if (pet.id === 'voidwalker') {
      const shieldAmt = Math.round(maxHp * 0.25);
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== 'Void Fortitude' && e.target !== 'shield'),
          { id: now, type: 'buff' as const, name: 'Void Fortitude', target: 'maxHP', value: 25, duration: 999, isPercent: true },
          { id: now + 1, type: 'buff' as const, name: 'Void Fortitude', target: 'shield', value: shieldAmt, duration: 999 },
        ],
      }));
      this.charSvc.showToast('💀 Sacrificaste al Voidwalker · Void Fortitude: +25% vida maxima y escudo de ' + shieldAmt + ' HP');
    } else {
      this.charSvc.addShard(shardCost);
      this.charSvc.showToast('Ese demonio no puede ser sacrificado (aun)');
      return;
    }
    this.charSvc.dismissPet();
  }

  castDarkStar(ability: any) {
    const mb = this.charSvc.computedAbilities().find(a => a.id === 'mind_blast');
    let dmg = 0;
    if (mb && ((mb as any).currentMin || (mb as any).currentMax)) {
      const minD = (mb as any).currentMin || 0;
      const maxD = (mb as any).currentMax || 0;
      dmg = Math.round(minD + Math.random() * (maxD - minD));
    } else {
      const sp = this.charSvc.spellPower();
      dmg = Math.round(40 + Math.random() * 15 + sp * 0.429);
    }
    const dm = this.charSvc.computedAbilities().find(a => a.id === 'dark_mending');
    let heal = 0;
    if (dm && ((dm as any).currentMin || (dm as any).currentMax)) {
      const minH = (dm as any).currentMin || 0;
      const maxH = (dm as any).currentMax || 0;
      heal = Math.round(minH + Math.random() * (maxH - minH));
    } else {
      const sp = this.charSvc.spellPower();
      heal = Math.round(135 + sp * 0.7);
    }
    const isCrit = Math.random() * 100 < parseFloat(this.charSvc.spellCrit());
    if (isCrit) {
      dmg = Math.round(dmg * 1.5);
      heal = Math.round(heal * 1.5);
    }
    const lowHp = (this.charSvc.character().currentHP ?? this.charSvc.maxHP()) / this.charSvc.maxHP() < 0.5;
    if (lowHp) heal = Math.round(heal * 2);
    const myName = this.charSvc.character().name || 'Jugador';
    this.firebase.pushData('damageEvents', {
      player: myName,
      ability: ability.name,
      rank: ability.currentRank || 1,
      damage: dmg,
      damageType: 'magical',
      aoe: true,
      effects: null,
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    this.charSvc.adjustHP(heal);
    this.charSvc.showToast(ability.name + ': ' + dmg + ' danyo de sombra a todos (AOE)' + (isCrit ? ' ¡CRITICO!' : '') + ' · te curas ' + heal + (lowHp ? ' (x2 low HP)' : ''));
  }

  castKillCommand(ability: any) {
    const pet = this.charSvc.activePetData();
    if (!pet) {
      this.charSvc.showToast('No tienes mascota activa');
      return;
    }
    const effects = this.charSvc.character().activeEffects || [];
    const hawkEff = effects.find(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
    const howlEff = effects.find(e => e.type === 'buff' && e.name === 'Furious Howl');
    let dmg = Math.round(pet.attackMin + Math.random() * (pet.attackMax - pet.attackMin));
    if (hawkEff) dmg = Math.round(dmg * (1 + (hawkEff.value || 0) / 100));
    if (howlEff) dmg = Math.round(dmg * (1 + (howlEff.value || 0) / 100));
    const playerName = (this.charSvc.character().name || '').trim();
    const petPlayerName = playerName ? playerName + ' — ' + pet.name : '';
    this.charSvc.addTurnDamage(dmg);
    this.firebase.pushData('damageEvents', {
      player: petPlayerName,
      ability: ability.name,
      rank: ability.currentRank || 1,
      damage: dmg,
      damageType: 'physical',
      aoe: false,
      effects: null,
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    const focusMax = this.charSvc.resourceMax();
    this.charSvc.character.update(c => ({
      ...c,
      currentFocus: Math.min(focusMax, (c.currentFocus ?? 0) + 10),
    }));
    this.charSvc.showToast(ability.name + ': ' + pet.name + ' hace un golpe extra: ' + dmg + ' danyo · +10 Focus · Focus ' + this.charSvc.resourceActual() + '/' + focusMax);
  }

  castExplosiveShot(ability: any) {
    const level = this.charSvc.character().level;
    const ranks = ability.damageRanges || [];
    const rnk = [...ranks].reverse().find((d: any) => d.level <= level) || ranks[0];
    const totalMin = rnk ? rnk.min : 54;
    const totalMax = rnk ? rnk.max : 84;
    const total = totalMin + Math.floor(Math.random() * (totalMax - totalMin + 1));
    const tick = Math.max(1, Math.round(total / 3));
    this.charSvc.addTurnDamage(total);
    this.firebase.pushData('damageEvents', {
      player: this.charSvc.character().name || 'Jugador',
      ability: ability.name,
      rank: rnk ? rnk.rank : 1,
      damage: total,
      damageType: 'magical',
      aoe: true,
      effects: [{ type: 'dot', name: 'Explosive Shot', value: tick, duration: 3, debuffType: 'fire', stackable: false }],
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    this.charSvc.showToast(ability.name + ' R' + (rnk ? rnk.rank : 1) + ': 🔥 ' + total + ' Fuego (' + tick + '/t · 3t) a todos los enemigos — enviado al Master');
  }

  castDisengage(ability: any) {
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [...(c.activeEffects || []), {
        id: Date.now() + Math.random(),
        type: 'buff' as const,
        name: 'Disengage',
        target: 'evasion',
        value: 20,
        duration: 1,
      }],
    }));
    this.charSvc.showToast(ability.name + ': +5 Focus · +20% esquivar 1 turno (no gasta accion)');
  }

  castAspect(ability: any) {
    const rank = ability.currentRank || 1;
    const buffRank = ability.buffRanks?.find((br: any) => br.rank === rank);
    const value = buffRank ? buffRank.value : 20;
    const stat = (ability.buff && ability.buff.stat) || 'attackPower';
    const duration = (ability.buff && ability.buff.duration) || 999;
    const otherName = stat === 'attackPower' ? 'Aspect of the Monkey' : 'Aspect of the Hawk';
    this.charSvc.character.update(c => {
      const filtered = (c.activeEffects || []).filter(e => e.name !== 'Aspect of the Hawk' && e.name !== 'Aspect of the Monkey');
      return {
        ...c,
        activeEffects: [...filtered, {
          id: Date.now() + Math.random(),
          type: 'buff' as const,
          name: ability.name,
          target: stat,
          value,
          duration,
          isPercent: false,
        }],
      };
    });
    const statLabel = stat === 'attackPower' ? 'Attack Power' : 'Dodge';
    this.charSvc.showToast(ability.name + ' R' + rank + ': +' + value + ' ' + statLabel + ' — Aspect activado (solo puedes tener uno) · Focus ' + this.charSvc.resourceActual() + '/' + this.charSvc.resourceMax());
  }

  castHolyNova(ability: any) {
    const sp = this.charSvc.spellPower();
    const dr = (ability.damageRanges || [])[0] || { min: 30, max: 45 };
    const dmg = Math.round(dr.min + Math.random() * (dr.max - dr.min) + sp * (ability.spellPowerRatio || 0.6));
    const heal = Math.round(45 + sp * 0.8);
    const myName = this.charSvc.character().name || 'Jugador';
    const turn = this.charSvc.turnNumber();
    const now = Date.now();
    this.firebase.pushData('damageEvents', {
      player: myName,
      ability: ability.name,
      rank: ability.currentRank || 1,
      damage: dmg,
      damageType: 'magical',
      aoe: true,
      effects: null,
      turn,
      timestamp: now,
      assigned: false,
    });
    this.firebase.pushData('damageEvents', {
      player: myName,
      ability: ability.name + ' (Cura)',
      rank: ability.currentRank || 1,
      damage: heal,
      damageType: 'heal',
      aoe: true,
      effects: null,
      isHot: false,
      hotTick: 0,
      hotDuration: 0,
      isShield: false,
      turn,
      timestamp: now,
      assigned: false,
    });
    this.charSvc.showToast(ability.name + ': ' + dmg + ' dano a todos los enemigos y ' + heal + ' cura a todos los aliados — 2 eventos AOE al Master');
  }

  castSeedOfCorruption(ability: any) {
    const shardCost = ability.shardCost || 1;
    if (!this.charSvc.spendShards(shardCost)) {
      this.charSvc.showToast(this.trSvc.t('need_shards') + ' 1 ' + this.trSvc.t('soul_shard'));
      return;
    }
    const corr = this.charSvc.computedAbilities().find(a => a.id === 'corruption');
    let dotTick = 10;
    if (corr && ((corr as any).dotTick || (corr as any).currentDotValue)) {
      dotTick = (corr as any).dotTick || (corr as any).currentDotValue || 10;
    } else {
      const rank = this.charSvc.maxAvailableRank(this.charSvc.classConfig().abilities.find(a => a.id === 'corruption')!);
      const dr = (this.charSvc.classConfig().abilities.find(a => a.id === 'corruption')?.dotRanges || []).find(d => d.rank === rank);
      if (dr) {
        dotTick = dr.value;
      }
    }
    const boosted = Math.round(dotTick * 1.10);
    this.firebase.pushData('damageEvents', {
      player: this.charSvc.character().name || 'Jugador',
      ability: ability.name,
      rank: ability.currentRank || 1,
      damage: 0,
      damageType: 'magical',
      aoe: true,
      effects: [{ type: 'dot', name: 'Seed of Corruption', value: boosted, duration: 5, debuffType: 'shadow' }],
      seedShards: true,
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    this.charSvc.showToast(ability.name + ': DoT potenciado (+10%) a todos los enemigos · -35% mana · el Master devuelve 1 Soul Shard por enemigo (max 5)');
  }

  castShadowDance(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'shadow_dance'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Shadow Dance', target: 'shadow_dance', value: 0, duration },
      ],
    }));
    this.charSvc.showToast('🩶 Shadow Dance activa · habilidades de sigilo sin Stealth (' + duration + ' turnos)');
  }

  castBladeFlurry(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'blade_flurry'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Blade Flurry', target: 'blade_flurry', value: 0, duration },
      ],
    }));
    this.charSvc.showToast('🌪️ Blade Flurry activa · tu daño directo impacta a otro enemigo (' + duration + ' turnos)');
  }

  castPoisonMastery(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'poison_mastery'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Poison Mastery', target: 'poison_mastery', value: 0, duration },
      ],
    }));
    this.charSvc.showToast('☠️ Poison Mastery activa · Veneno Mortal x2 y Veneno Vampírico x3 (' + duration + ' turnos)');
  }

  castShieldWall(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'shield_wall'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Shield Wall', target: 'shield_wall', value: 60, duration },
      ],
    }));
    this.charSvc.showToast('🛡️ Shield Wall activa · -60% daño recibido e inmune a control de masas (' + duration + ' turnos)');
  }

  castRecklessness(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'recklessness'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Recklessness', target: 'recklessness', value: 20, duration },
      ],
    }));
    this.charSvc.showToast('🔥 Recklessness activa · +20% critico y danyo critico · -30% resistencia (' + duration + ' turnos)');
  }

  castCombustion(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'combustion'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Combustion', target: 'combustion', value: 25, duration },
      ],
    }));
    this.charSvc.showToast('🔥 Combustion activa · +25% critico y danyo critico de Fuego (' + duration + ' turnos)');
  }

  castIcyVeins(ability: any) {
    const duration = 2;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'icy_veins'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Icy Veins', target: 'icy_veins', value: 1, duration },
      ],
    }));
    this.charSvc.showToast('🧊 Icy Veins activa · tus hechizos de Escarcha son instantaneos (' + duration + ' turno(s))');
  }

  castArcanePower(ability: any) {
    const duration = 2;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'arcane_power'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Arcane Power', target: 'arcane_power', value: 20, duration },
      ],
    }));
    this.charSvc.showToast('⚡ Arcane Power activa · 2 turnos sin coste de mana · +20% Spell Power · +25% danyo critico');
  }

  onNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.charSvc.character.update(c => ({ ...c, name: value }));
  }

  onLevelInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.charSvc.character.update(c => ({ ...c, level: value }));
  }

  onXpInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value || 0;
    this.xpInputAmount.set(value);
  }

  onHpActionTypeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.hpActionType.set(value);
  }

  onHpLossInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value || 0;
    this.hpLossAmount.set(value);
  }

  onNewEffectTypeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as ActiveEffect['type'];
    this.newEffect.update(ne => ({ ...ne, type: value }));
    this.onEffectTypeChange();
  }

  onNewEffectNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.newEffect.update(ne => ({ ...ne, name: value }));
  }

  onNewEffectTargetChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.newEffect.update(ne => ({ ...ne, target: value }));
  }

  onNewEffectValueInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value || 0;
    this.newEffect.update(ne => ({ ...ne, value }));
  }

  onNewEffectDurationInput(event: Event) {
    const value = +(event.target as HTMLInputElement).value || 1;
    this.newEffect.update(ne => ({ ...ne, duration: value }));
  }

  onNewEffectMiscTargetInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.newEffect.update(ne => ({ ...ne, target: value }));
  }

  onEquipNameInput(event: Event, slotKey: string) {
    const value = (event.target as HTMLInputElement).value;
    this.charSvc.character.update(c => ({
      ...c,
      equipment: {
        ...c.equipment,
        [slotKey]: { ...(c.equipment as any)[slotKey], name: value },
      },
    }));
  }

  onEquipBonusInput(event: Event, slotKey: string, statKey: string) {
    const value = +(event.target as HTMLInputElement).value || 0;
    this.charSvc.character.update(c => ({
      ...c,
      equipment: {
        ...c.equipment,
        [slotKey]: {
          ...(c.equipment as any)[slotKey],
          bonus: { ...(c.equipment as any)[slotKey].bonus, [statKey]: value },
        },
      },
    }));
  }

  onEquipExtraInput(event: Event, slotKey: string, fieldKey: string) {
    const value = +(event.target as HTMLInputElement).value || 0;
    this.charSvc.character.update(c => ({
      ...c,
      equipment: {
        ...c.equipment,
        [slotKey]: { ...(c.equipment as any)[slotKey], [fieldKey]: value },
      },
    }));
  }

  changeLevel(delta: number) {
    const n = this.charSvc.character().level + delta;
    if (n >= 1 && n <= MAX_LEVEL) {
      this.charSvc.character.update(c => ({ ...c, level: n, currentXP: 0 }));
    }
  }

  instantLevel25() {
    this.charSvc.character.update(c => ({ ...c, level: 25, currentXP: 0 }));
  }

  changeStance(stance: string) {
    if (this.charSvc.warriorStance() === stance) return;
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast(this.trSvc.t('no_actions_stance'));
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.warriorStance.set(stance);
  }

  changeWeaponMode(mode: string) {
    if (this.charSvc.warriorWeaponMode() === mode) return;
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast(this.trSvc.t('no_actions_weapon'));
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.warriorWeaponMode.set(mode);
  }

  clampLevel() {
    this.charSvc.character.update(c => {
      let level = c.level;
      if (!level || level < 1) level = 1;
      if (level > MAX_LEVEL) level = MAX_LEVEL;
      return { ...c, level, currentXP: 0 };
    });
  }

  onClassChange(event: Event) {
    const classKey = (event.target as HTMLSelectElement).value;
    this.charSvc.selectClass(classKey);
    this.charSvc.turnNumber.set(1);
    this.charSvc.showToast(this.trSvc.t('class_changed') + ' ' + this.charSvc.classConfig().name);
  }

  castPetAbility(ability: any) {
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast(this.trSvc.t('no_actions'));
      return;
    }
    const success = this.charSvc.castPetAbility(ability);
    if (success) {
      this.charSvc.useAction(1);
      const cd = this.charSvc.getEffectiveCooldown(ability);
      if (cd > 0) {
        this.charSvc.character.update(c => {
          if (!c.currentCooldowns) c.currentCooldowns = {};
          c.currentCooldowns[ability.id] = cd;
          return { ...c };
        });
      }
      if (ability.partyBuff) {
        this.charSvc.sendBuffEvent(ability);
      }
      if (ability.id === 'shadow_kiss') {
        const rank = ability.currentRank || 1;
        const dmg = ability.currentBuffValue || 40;
        this.charSvc.addTurnDamage(dmg);
        this.firebase.pushData('damageEvents', {
          player: this.charSvc.character().name || 'Jugador',
          ability: ability.name,
          rank: rank,
          damage: dmg,
          damageType: 'magical',
          aoe: false,
          effects: ability.inflictsEffects || null,
          turn: this.charSvc.turnNumber(),
          timestamp: Date.now(),
          assigned: false,
        });
        this.charSvc.showToast(
          ability.name + ' R' + rank + ': ' + dmg + ' danyo oscuro — enviado al Master'
        );
      } else if (ability.id === 'voidwalker_taunt') {
        const myName = (this.charSvc.character().name || '').trim();
        const petPlayerName = myName ? myName + ' — Voidwalker' : '';
        this.firebase.pushData('damageEvents', {
          player: this.charSvc.character().name || 'Jugador',
          ability: ability.name,
          rank: ability.currentRank || 1,
          damage: 0,
          damageType: 'physical',
          aoe: false,
          effects: [{ type: 'debuff', name: 'Suffering', target: 'taunt', value: petPlayerName, duration: 2, debuffType: 'none' }],
          turn: this.charSvc.turnNumber(),
          timestamp: Date.now(),
          assigned: false,
        });
        const grimoireRank = this.charSvc.talentRank('grimoire_of_command');
        const heal = Math.round(this.charSvc.petMaxHP() * grimoireRank * 0.10);
        if (heal > 0 && this.charSvc.character().activePet) {
          this.charSvc.character.update(c => ({
            ...c,
            activePet: c.activePet ? { ...c.activePet, currentHP: Math.min(this.charSvc.petMaxHP(), c.activePet.currentHP + heal) } : null,
          }));
          this.charSvc.showToast(ability.name + ': fuerza al enemigo a atacar al Voidwalker (2 turnos) · +' + heal + ' vida — enviado al Master');
        } else {
          this.charSvc.showToast(ability.name + ': fuerza al enemigo a atacar al Voidwalker (2 turnos) — enviado al Master');
        }
      } else if (ability.id === 'furious_howl') {
        const rank = ability.currentRank || 1;
        const buffRank = ability.buffRanks?.find((br: any) => br.rank === rank);
        const howlPct = buffRank ? buffRank.value : 15;
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Furious Howl'),
            { id: Date.now(), type: 'buff' as const, name: 'Furious Howl', target: 'furious_howl', value: howlPct, duration: 3, isPercent: true },
          ],
        }));
        this.charSvc.showToast(ability.name + ': +' + howlPct + '% dano al Hunter y al Wolf durante 3 turnos');
        const fiRank = this.charSvc.talentRank('ferocious_inspiration');
        if (fiRank > 0) {
          const partyVal = Math.round(howlPct * 0.5 * fiRank);
          this.charSvc.sendBuffEvent({ ...ability, name: 'Furious Howl', currentBuffStat: 'attackPower', currentBuffValue: partyVal, currentBuffDuration: 3, buff: { stat: 'attackPower', duration: 3, isPercent: false }, partyBuff: true } as any);
          this.charSvc.showToast(ability.name + ': 🎵 Ferocious Inspiration — party +' + partyVal + ' Attack Power (3 turnos) — enviado al Master');
        }
      } else if (ability.id === 'growl') {
        const myName = (this.charSvc.character().name || '').trim();
        const petPlayerName = myName ? myName + ' — Bear' : '';
        this.firebase.pushData('damageEvents', {
          player: this.charSvc.character().name || 'Jugador',
          ability: ability.name,
          rank: ability.currentRank || 1,
          damage: 0,
          damageType: 'physical',
          aoe: false,
          effects: [{ type: 'debuff', name: 'Growl', target: 'taunt', value: petPlayerName, duration: 3, debuffType: 'none' }],
          turn: this.charSvc.turnNumber(),
          timestamp: Date.now(),
          assigned: false,
        });
        this.charSvc.showToast(ability.name + ': el enemigo ataca al Bear durante 3 turnos — enviado al Master');
        const fiRank = this.charSvc.talentRank('ferocious_inspiration');
        if (fiRank > 0) {
          const thickVal = [0, 5, 10, 15][fiRank] || 0;
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== 'Thick Skin'),
              { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Thick Skin', target: 'pet_armor', value: thickVal, duration: 3, isPercent: false },
            ],
          }));
          this.charSvc.showToast(ability.name + ': 🐻 Thick Skin +' + thickVal + ' Armor al Bear (3 turnos)');
        }
      } else if (ability.id === 'imp_blood_bolt') {
        const grimoireRank = this.charSvc.talentRank('grimoire_of_command');
        if (grimoireRank === 0 && ability.currentBuffValue) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [...(c.activeEffects || []), {
              id: Date.now(),
              type: 'buff' as const,
              name: ability.name,
              target: 'aguante',
              value: ability.currentBuffValue,
              duration: ability.currentBuffDuration,
              isPercent: false,
            }],
          }));
          this.charSvc.sendBuffEvent(ability);
          this.charSvc.showToast(ability.name + ' R' + (ability.currentRank || 1) + ': +' + ability.currentBuffValue + ' Aguante al grupo — enviado al Master');
        } else {
          const sacrificePct = 15 * grimoireRank;
          const sacrifice = Math.round(this.charSvc.petMaxHP() * sacrificePct / 100);
          this.firebase.pushData('damageEvents', {
            player: this.charSvc.character().name || 'Jugador',
            ability: ability.name,
            rank: ability.currentRank || 1,
            damage: sacrifice,
            damageType: 'magical',
            aoe: true,
            effects: null,
            turn: this.charSvc.turnNumber(),
            timestamp: Date.now(),
            assigned: false,
          });
          this.charSvc.petTakeDamage(sacrifice);
          this.charSvc.showToast(ability.name + ': el Imp pierde ' + sacrifice + ' vida (' + sacrificePct + '%) — AOE enviado al Master');
        }
      } else if (ability.currentBuffValue) {
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ' — ' + ability.currentBuffStat +
          ' +' + ability.currentBuffValue + ' (' + ability.currentBuffDuration + 't) — enviado al Master'
        );
      } else {
        this.charSvc.showToast(ability.name + ' — ' + this.trSvc.t('cast_spell'));
      }
    }
  }

  addXP(amount: number) {
    if (amount <= 0) return;
    if (this.charSvc.character().level >= MAX_LEVEL) {
      this.charSvc.showToast(this.trSvc.t('max_level'));
      return;
    }
    const char = this.charSvc.character();
    let xp = (char.currentXP || 0) + amount;
    let levelsGained = 0;
    let level = char.level;
    while (level < MAX_LEVEL && xp >= xpForLevel(level) && xpForLevel(level) > 0) {
      xp -= xpForLevel(level);
      level++;
      levelsGained++;
    }
    if (level >= MAX_LEVEL) xp = 0;
    this.charSvc.character.update(c => ({ ...c, currentXP: xp, level }));
    if (levelsGained > 0) {
      this.levelUpFlash.set(true);
      setTimeout(() => this.levelUpFlash.set(false), 800);
      this.charSvc.showToast(this.trSvc.t('level_up') + ' ' + level + '! +' + levelsGained + ' ' + (levelsGained > 1 ? this.trSvc.t('niveles') : this.trSvc.t('nivel_singular')));
    } else {
      this.charSvc.showToast('+' + amount + ' XP');
    }
    this.charSvc.saveToLocalStorage();
  }

  grantLevel(levels: number = 1) {
    if (levels <= 0) return;
    const char = this.charSvc.character();
    const newLevel = Math.min(MAX_LEVEL, char.level + levels);
    if (newLevel === char.level) {
      this.charSvc.showToast(this.trSvc.t('max_level'));
      return;
    }
    this.charSvc.character.update(c => ({ ...c, level: newLevel, currentXP: 0 }));
    this.levelUpFlash.set(true);
    setTimeout(() => this.levelUpFlash.set(false), 800);
    this.charSvc.showToast(this.trSvc.t('level_up') + ' ' + newLevel + '! +' + levels + ' ' + (levels > 1 ? this.trSvc.t('niveles') : this.trSvc.t('nivel_singular')));
    this.charSvc.saveToLocalStorage();
  }

  moveAction() {
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast(this.trSvc.t('sin_acciones'));
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.showToast(this.trSvc.t('movement_used'));
  }

  endTurn() {
    const oldTurn = this.charSvc.turnNumber();
    this.processEffects();

    if (this.charSvc.hasEffect('arcane_power')) {
      const restored = Math.round(this.charSvc.maxMana() * 0.20);
      this.charSvc.character.update(c => ({
        ...c,
        currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana || 0) + restored),
      }));
      this.charSvc.showToast('⚡ Arcane Power: +' + restored + ' mana');
    }

    const petAttack = this.charSvc.petAttack();
    if (petAttack) {
      this.charSvc.addTurnDamage(petAttack.damage);
      const focusText = petAttack.focusGain > 0 ? ' · +' + petAttack.focusGain + ' Focus' : '';
      this.charSvc.showToast(`👹 ${petAttack.name}: ${petAttack.damage} danyo de ${petAttack.school}` + focusText);
      this.firebase.pushData('damageEvents', {
        player: this.charSvc.character().name || 'Jugador',
        ability: petAttack.name + ' (Pet)',
        rank: 1,
        damage: petAttack.damage,
        damageType: 'magical',
        aoe: false,
        effects: null,
        turn: oldTurn,
        timestamp: Date.now(),
        assigned: false,
      });
    }

    const companionAttack = this.charSvc.companionPetAttack();
    if (companionAttack) {
      this.charSvc.addTurnDamage(companionAttack.damage);
      const focusText = companionAttack.focusGain > 0 ? ' · +' + companionAttack.focusGain + ' Focus' : '';
      this.charSvc.showToast(`🐾 ${companionAttack.name}: ${companionAttack.damage} danyo de ${companionAttack.school}` + focusText);
      this.firebase.pushData('damageEvents', {
        player: this.charSvc.character().name || 'Jugador',
        ability: companionAttack.name + ' (Companion)',
        rank: 1,
        damage: companionAttack.damage,
        damageType: 'magical',
        aoe: false,
        effects: null,
        turn: oldTurn,
        timestamp: Date.now(),
        assigned: false,
      });
    }

    const infernalAttack = this.charSvc.infernalAttack();
    if (infernalAttack) {
      this.charSvc.addTurnDamage(infernalAttack.damage);
      this.charSvc.showToast(`🔥 ${infernalAttack.name}: ${infernalAttack.damage} danyo de ${infernalAttack.school}`);
      this.firebase.pushData('damageEvents', {
        player: this.charSvc.character().name || 'Jugador',
        ability: infernalAttack.name + ' (Infernal)',
        rank: 1,
        damage: infernalAttack.damage,
        damageType: 'magical',
        aoe: false,
        effects: null,
        turn: oldTurn,
        timestamp: Date.now(),
        assigned: false,
      });
      const remaining = this.charSvc.decrementInfernalTurn();
      if (remaining <= 0) {
        this.charSvc.showToast('El Infernal ha regresado al Twisting Nether');
      }
    }

    this.charSvc.nextTurn();
    const resType = this.charSvc.resourceConfig().type;
    if (resType === 'rage') {
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn);
    } else if (resType === 'energy') {
      const regen = Math.round((this.charSvc.resourceConfig().regen || 20) * (1 + this.charSvc.talentRank('vitality') * 0.10));
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · +' + regen + ' ' + this.trSvc.t('energy_regen'));
    } else if (resType === 'focus') {
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · Focus: sin regen');
    } else {
      const regen = this.charSvc.manaRegen();
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · +' + regen + ' ' + this.trSvc.t('mana_regen_turn'));
    }
  }

  private processEffects() {
    const effects = this.charSvc.character().activeEffects;
    if (!effects || effects.length === 0) return;
    const messages: string[] = [];
    const maxHP = this.charSvc.maxHP();
    const maxMana = this.charSvc.maxMana();
    for (const eff of effects) {
      if (eff.type === 'hot') {
        if (eff.target === 'mana') {
          this.charSvc.character.update(c => ({
            ...c,
            currentMana: Math.min(maxMana, (c.currentMana ?? maxMana) + eff.value),
          }));
        } else {
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(maxHP, (c.currentHP ?? maxHP) + eff.value),
          }));
        }
        messages.push('+' + eff.value + ' ' + eff.name);
      } else if (eff.type === 'dot') {
        if (eff.target === 'mana') {
          this.charSvc.character.update(c => ({
            ...c,
            currentMana: Math.max(0, (c.currentMana ?? maxMana) - eff.value),
          }));
        } else {
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.max(0, (c.currentHP ?? maxHP) - eff.value),
          }));
        }
        messages.push('-' + eff.value + ' ' + eff.name);
      }
    }
    if (messages.length > 0) {
      this.charSvc.showToast(messages.join(' · '));
    }
  }

  exitStealth() {
    if (!this.charSvc.isStealthed()) return;
    this.charSvc.character.update(c => ({ ...c, activeEffects: (c.activeEffects || []).filter(e => e.target !== 'stealth') }));
    this.charSvc.showToast(this.trSvc.t('stealth_off'));
  }

  isCrowdControl(eff: any): boolean {
    const cc = ['stunned', 'silenced', 'rooted', 'slowed', 'feared', 'charmed', 'sleep', 'incapacitated', 'polymorphed'];
    return !!eff && cc.includes(eff.target || eff.stat || '');
  }

  addPlayerEffect(eff: any): boolean {
    if (this.charSvc.hasEffect('shield_wall') && this.isCrowdControl(eff)) {
      this.charSvc.showToast('🛡️ Shield Wall: inmune a ' + (eff.name || 'control de masas'));
      return false;
    }
    this.charSvc.addEffect(eff);
    return true;
  }

  hpAction(amount: number, actionType: string) {
    if (amount <= 0) return;
    this.hpLossAmount.set(0);

    if (actionType === 'heal') {
      const maxHP = this.charSvc.maxHP();
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.min(maxHP, this.charSvc.hpActual() + amount),
      }));
      this.charSvc.showToast('+' + amount + ' ' + this.trSvc.t('health_restored'));
      return;
    }

    if (actionType === 'shield') {
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== 'Escudo'),
          {
            id: Date.now() + Math.random(),
            type: 'buff' as const,
            name: 'Escudo',
            target: 'shield',
            value: amount,
            duration: 999,
          },
        ],
      }));
      this.charSvc.showToast(this.trSvc.t('shield_absorb_msg') + ' ' + amount + ' ' + this.trSvc.t('absorbed_msg'));
      return;
    }

    if (actionType === 'physical') {
      const evadeChance = this.charSvc.evasion();
      if (Math.random() * 100 < evadeChance) {
        let rageText = '';
        if (this.charSvc.resourceConfig().type === 'rage') {
          const rageGain = 2 + Math.floor(Math.random() * 3);
          const resourceMax = this.charSvc.resourceMax();
          const resourceActual = this.charSvc.resourceActual();
          this.charSvc.character.update(c => ({
            ...c,
            currentRage: Math.min(resourceMax, resourceActual + rageGain),
          }));
          rageText = ' · +' + rageGain + ' ira';
        }
        this.charSvc.showToast(this.trSvc.t('evaded') + rageText);
        return;
      }
    }

    let remaining = amount;
    const effects = this.charSvc.character().activeEffects;
    if (effects) {
      const shield = effects.find(e => e.target === 'shield');
      if (shield) {
        if (shield.value >= remaining) {
          const newShieldValue = shield.value - remaining;
          remaining = 0;
          if (newShieldValue <= 0) {
            this.charSvc.character.update(c => ({
              ...c,
              activeEffects: (c.activeEffects || []).filter(e => e.target !== 'shield'),
            }));
            this.charSvc.showToast(this.trSvc.t('shield_fully_absorbed'));
          } else {
            this.charSvc.character.update(c => ({
              ...c,
              activeEffects: (c.activeEffects || []).map(e =>
                e.target === 'shield' ? { ...e, value: newShieldValue } : e
              ),
            }));
            this.charSvc.showToast(this.trSvc.t('shield_absorbs') + ' ' + amount + ' (' + this.trSvc.t('remaining') + ' ' + newShieldValue + ')');
          }
        } else {
          remaining -= shield.value;
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: (c.activeEffects || []).filter(e => e.target !== 'shield'),
          }));
        }
      }
    }

    if (remaining > 0) {
      if (actionType === 'physical') {
        const reduction = this.charSvc.physReduction();
        remaining = Math.round(remaining * (1 - reduction / 100));
      } else {
        const reduction = this.charSvc.magicReduction();
        remaining = Math.round(remaining * (1 - reduction / 100));
      }
      if (this.charSvc.hasEffect('demonic_form')) {
        remaining = Math.round(remaining * 1.15);
      }
      if (this.charSvc.hasEffect('recklessness')) {
        remaining = Math.round(remaining * 1.30);
      }
      if (this.charSvc.hasEffect('shield_wall')) {
        remaining = Math.round(remaining * 0.40);
      }
    }

    if (remaining > 0) {
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.max(0, this.charSvc.hpActual() - remaining),
      }));
      let rageText = '';
      if (this.charSvc.resourceConfig().type === 'rage') {
        const rageGain = 2 + Math.floor(Math.random() * 3);
        const resourceMax = this.charSvc.resourceMax();
        const resourceActual = this.charSvc.resourceActual();
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, resourceActual + rageGain),
        }));
        rageText = ' · +' + rageGain + ' ira';
      }
      if (remaining < amount) {
        this.charSvc.showToast('-' + remaining + ' ' + this.trSvc.t('life_lost') + rageText);
      } else {
        this.charSvc.showToast('-' + amount + ' ' + this.trSvc.t('life_lost') + rageText);
      }
    }
  }

  castSpell(ability: any) {
    const resType = this.charSvc.resourceConfig().type;
    const isRage = resType === 'rage';
    const isEnergy = resType === 'energy';
    const isFocus = resType === 'focus';
    let cost: number;
    if (isRage) {
      cost = this.charSvc.getEffectiveRageCost(ability);
    } else if (isEnergy) {
      cost = this.charSvc.getEffectiveEnergyCost(ability);
    } else if (isFocus) {
      cost = this.charSvc.getEffectiveFocusCost(ability);
    } else {
      cost = ability.scaledCost || ability.computedCost;
    }
    if (this.charSvc.hasEffect('arcane_power')) {
      cost = 0;
    }
    if (this.charSvc.hasEffect('inner_focus')) {
      cost = 0;
    }

    const resourceActual = this.charSvc.resourceActual();
    const resourceMax = this.charSvc.resourceMax();
    const manaActual = this.charSvc.manaActual();
    const cd = this.charSvc.getCooldown(ability.id);

    if (resourceActual < cost) {
      this.charSvc.showToast(this.resourceLabel() + ' ' + this.trSvc.t('insufficient_resource'));
      return;
    }
    if (cd > 0) {
      this.charSvc.showToast(ability.name + ' ' + this.trSvc.t('on_cd') + ' (' + cd + ' ' + (cd > 1 ? this.trSvc.t('turns') : this.trSvc.t('turn')) + ')');
      return;
    }

    const icyVeinsInstant = this.charSvc.hasEffect('icy_veins') && ability.school === 'Escarcha' && ability.castType === 'cast';
    const backdraftInstant = ability.id === 'immolate' && this.charSvc.talentRank('backdraft') > 0;
    const mindBlastInstant = ability.id === 'mind_blast' && this.charSvc.isMaxed('improved_mind_blast', 3);
    const actionCost = ability.noGcd ? 0 : ((ability.castType === 'instant' || icyVeinsInstant || backdraftInstant || mindBlastInstant) ? 1 : 2);
    if (!this.charSvc.canAct(actionCost)) {
      this.charSvc.showToast(this.trSvc.t('sin_acciones'));
      return;
    }

    if (ability.requiresStealth && !this.charSvc.isStealthed() && !this.charSvc.hasEffect('shadow_dance')) {
      this.charSvc.showToast(this.trSvc.t('need_stealth'));
      return;
    }

    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      if (this.charSvc.getShards() < shardCost) {
        this.charSvc.showToast(this.trSvc.t('need_shards') + ' ' + shardCost + ' ' + (shardCost > 1 ? this.trSvc.t('soul_shards_plural') : this.trSvc.t('soul_shard')));
        return;
      }
    }

    if (ability.spendsCombo && (this.charSvc.character().comboPoints || 0) === 0) {
      this.charSvc.showToast(this.trSvc.t('no_combo_pts'));
      return;
    }

    if (this.charSvc.isStealthed()) {
      this.charSvc.character.update(c => ({ ...c, activeEffects: (c.activeEffects || []).filter(e => e.target !== 'stealth') }));
      this.charSvc.showToast(this.trSvc.t('stealth_off'));
    }

    this.charSvc.useAction(actionCost);

    let unyieldingText = '';
    if (ability.id === 'basic_attack' && isRage) {
      const usRank = this.charSvc.talentRank('unyielding_strikes');
      if (usRank > 0 && Math.random() * 100 < usRank * 4) {
        this.charSvc.useAction(-1);
        unyieldingText = ' · ¡Acción gratis!';
      }
    }

    const clearcast = (isRage || isEnergy || isFocus) ? false : this.charSvc.checkClearcasting();

    if (isRage) {
      this.charSvc.character.update(c => ({
        ...c,
        currentRage: Math.min(resourceMax, resourceActual - cost),
      }));
    } else if (isEnergy) {
      this.charSvc.character.update(c => ({
        ...c,
        currentEnergy: Math.max(0, resourceActual - cost),
      }));
    } else if (isFocus) {
      this.charSvc.character.update(c => {
        const effects = ability.id === 'aimed_shot'
          ? (c.activeEffects || []).filter(e => e.name !== 'Lock and Load')
          : c.activeEffects;
        return {
          ...c,
          currentFocus: Math.max(0, resourceActual - cost),
          activeEffects: effects,
        };
      });
    } else if (!clearcast) {
      this.charSvc.character.update(c => ({
        ...c,
        currentMana: manaActual - cost,
      }));
    }
    if (this.charSvc.hasEffect('inner_focus')) {
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: (c.activeEffects || []).filter(e => e.target !== 'inner_focus'),
      }));
    }

    const min = ability.currentMin || 0;
    const max = ability.currentMax || 0;
    let roll = min + Math.floor(Math.random() * (max - min + 1));
    let critChance = parseFloat((isRage || isEnergy || isFocus) ? this.charSvc.meleeCrit() : this.charSvc.spellCrit());
    if (ability.id === 'mind_blast') {
      critChance += this.charSvc.talentRank('improved_mind_blast') * 10;
    }
    if (ability.castType === 'instant' && this.charSvc.character().classKey === 'mage') {
      critChance += this.charSvc.talentRank('magic_resistance') * 1;
    }
    if (ability.school === 'Fuego' && this.charSvc.hasEffect('combustion')) {
      critChance += 25;
    }
    if (this.charSvc.hasEffect('inner_focus')) {
      critChance += 25;
    }
    if (this.charSvc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
      const hawkActive = (this.charSvc.character().activeEffects || []).some(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
      if (hawkActive) critChance += this.charSvc.talentRank('improved_aspect_of_the_hawk') * 2;
    }
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) {
      let critMult = 1.5;
      if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') {
        critMult = 1.5 + this.charSvc.talentRank('destruction_specialization') * 0.15;
      }
      if (this.charSvc.hasEffect('demonic_form')) {
        critMult = critMult * 1.25;
      }
      if (this.charSvc.hasEffect('recklessness')) {
        critMult = critMult * 1.20;
      }
      if (ability.school === 'Fuego' && this.charSvc.hasEffect('combustion')) {
        critMult = critMult * 1.25;
      }
      if (this.charSvc.hasEffect('arcane_power')) {
        critMult = critMult * 1.25;
      }
      if (this.charSvc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
        critMult = critMult * (1 + this.charSvc.talentRank('mortal_shots') * 0.15);
      }
      roll = Math.round(roll * critMult);
    }
    if ((isRage || isEnergy) && this.charSvc.warriorStance() === 'battle') {
      const battleMult = 1.10 + this.charSvc.talentRank('improved_stances') * 0.02;
      roll = Math.round(roll * battleMult);
    }

    let comboSpent = 0;
    if (ability.spendsCombo) {
      comboSpent = this.charSvc.character().comboPoints || 0;
      const equinoxRank = this.charSvc.talentRank('equinox');
      const fragMult = 1 + equinoxRank * 0.15;
      const aoeMult = ability.aoe ? 0.5 : 1.0;
      roll = Math.round(roll * (1 + (comboSpent - 1) * fragMult * aoeMult));
      this.charSvc.character.update(c => ({ ...c, comboPoints: 0 }));
    }

    let conduitText = '';
    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      this.charSvc.spendShards(shardCost);
      const recovered = this.charSvc.soulConduitRecover(shardCost);
      if (recovered > 0) conduitText = ' · Soul Conduit: +' + recovered + ' 🔮';
    }

    if (ability.spendsNotes) {
      const notes = this.charSvc.getNotes();
      if (notes.length === 0) {
        this.charSvc.showToast(this.trSvc.t('no_notes_score'));
        const resourceMax = this.charSvc.resourceMax();
        const resourceActual = this.charSvc.resourceActual();
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(resourceMax, (c.currentMana || 0) + (ability.scaledCost || 0)),
        }));
        return;
      }
      const contribution = this.charSvc.noteContribution();
      roll = Math.round(roll * contribution);
    }

    const dmgBoost = this.charSvc.character().activeEffects?.find(e => e.target === 'damage_boost');
    let boostText = '';
    if (dmgBoost && ability.type === 'damage') {
      roll += dmgBoost.value;
      boostText = ' · +' + dmgBoost.value + ' daño';
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: (c.activeEffects || []).filter(e => e !== dmgBoost),
      }));
    }

    if (isRage && ability.generatesRage) {
      const baseGen = this.charSvc.getEffectiveRageGen(ability);
      const rageGen = isCrit ? baseGen * 2 : baseGen;
      this.charSvc.character.update(c => ({
        ...c,
        currentRage: Math.min(resourceMax, (c.currentRage || 0) + rageGen),
      }));
    }

    this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));

    if (ability.cooldown > 0) {
      const effCd = this.charSvc.getEffectiveCooldown(ability);
      this.charSvc.character.update(c => {
        if (!c.currentCooldowns) c.currentCooldowns = {};
        c.currentCooldowns[ability.id] = effCd;
        return { ...c };
      });
    }

    let ccText = clearcast ? ' · ¡CLARIDAD ARCANA! Mana devuelto' : '';
    let rageText = '';
    let evText = '';

    const evRank = this.charSvc.talentRank('evangelism');
    if (evRank > 0 && ability.category) {
      const isHoly = ability.category === 'holy';
      const isShadow = ability.category === 'shadow';
      if (isHoly || isShadow) {
        const effects = this.charSvc.character().activeEffects || [];
        const evBuff = effects.find(e => e.name === 'Evangelism');
        if (evBuff) {
          const buffMatches = (isShadow && evBuff.target === 'shadow_boost') || (isHoly && evBuff.target === 'holy_boost');
          if (buffMatches) {
            const boost = 1 + evRank * 0.03;
            roll = Math.round(roll * boost);
            evText = ' · Evangelism +' + Math.round(evRank * 3) + '%';
          }
        }
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Evangelism'),
            {
              id: Date.now() + Math.random(),
              type: 'buff' as const,
              name: 'Evangelism',
              target: isHoly ? 'shadow_boost' : 'holy_boost',
              value: evRank * 3,
              duration: 2,
            },
          ],
        }));
      }
    }

    if (isRage && ability.generatesRage) {
      const baseGen = this.charSvc.getEffectiveRageGen(ability);
      const rageGen = isCrit ? baseGen * 2 : baseGen;
      rageText = ' · +' + rageGen + ' ira';
    }

    let comboText = '';
    if (ability.generatesCombo) {
      let comboGen = ability.generatesCombo;
      if (ability.id === 'sinister_strike') {
        const initChance = this.charSvc.talentRank('initiative') * 15;
        if (Math.random() * 100 < initChance) comboGen += 1;
      }
      const comboMax = (this.charSvc.classConfig().comboConfig?.max) || 5;
      const newCombo = Math.min(comboMax, (this.charSvc.character().comboPoints || 0) + comboGen);
      this.charSvc.character.update(c => ({ ...c, comboPoints: newCombo }));
      comboText = ' · ' + newCombo + ' ' + (this.charSvc.classConfig().comboConfig
        ? this.charSvc.classConfig().comboConfig!.label.toLowerCase().split(' ')[0]
        : 'combo');
    }
    if (ability.spendsCombo) {
      comboText = ' · ' + comboSpent + ' combo gastados';
    }

    let focusText = '';
    if (ability.focusGain && isFocus) {
      const resourceMaxF = this.charSvc.resourceMax();
      const gained = ability.focusGain;
      this.charSvc.character.update(c => ({
        ...c,
        currentFocus: Math.min(resourceMaxF, (c.currentFocus ?? 0) + gained),
      }));
      focusText = ' · +' + gained + ' Focus (' + this.charSvc.resourceActual() + '/' + resourceMaxF + ')';
    }

    let shardText = '';
    if (ability.generatesShard) {
      this.charSvc.addShard(ability.generatesShard);
      shardText = ' · +' + ability.generatesShard + ' 🔮 (' + this.charSvc.getShards() + '/' + this.charSvc.soulShardMax() + ')';
    }
    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      shardText = ' · ' + shardCost + ' 🔮 consumidos';
    }

    let noteText = '';
    if (ability.generatesNote) {
      let noteVal = ability.generatesNote;
      noteText = ' · +' + NOTE_NAMES[noteVal - 1];
      this.charSvc.addNote(noteVal);
      const notes = this.charSvc.getNotes();
      noteText += ' (' + notes.length + '/7)';
    }
    if (ability.modulateNotes) {
      this.charSvc.modulateNotes(ability.modulateNotes);
      noteText = ' · Notas +1 tono';
    }
    let noteContributionValue = 0;
    if (ability.spendsNotes) {
      noteContributionValue = this.charSvc.noteContribution();
      const notes = this.charSvc.getNotes();
      this.charSvc.clearNotes();
      noteText = ' · ' + notes.length + ' notas consumidas (×' + noteContributionValue.toFixed(1) + ')';
      const maestroRank = this.charSvc.talentRank('maestro');
      if (maestroRank > 0 && Math.random() * 100 < maestroRank * 15) {
        this.charSvc.actionsUsed.update(n => Math.max(0, n - 1));
        noteText += ' · ¡Maestro! +1 accion';
      }
    }


    if (ability.isHot) {
      let lunarText = '';
      const lhRank = this.charSvc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 10) {
        const comboMax = (this.charSvc.classConfig().comboConfig?.max) || 5;
        this.charSvc.character.update(c => ({
          ...c,
          comboPoints: Math.min(comboMax, (c.comboPoints || 0) + 1),
        }));
        lunarText = ' · +1 Fase Lunar';
      }
      let hotTotal = ability.hotTotal;
      if (evText) {
        const boost = 1 + this.charSvc.talentRank('evangelism') * 0.03;
        hotTotal = Math.round(hotTotal * boost);
      }
      const hotTick = Math.round(hotTotal / ability.hotDuration);
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + hotTick + '/turno · ' +
        ability.hotDuration + 't (' + hotTotal + ' total)' + lunarText + evText + noteText +
        ' — ' + this.trSvc.t('sent_to_master')
      );
      this.charSvc.sendHealEvent(ability, hotTotal);
    } else if (ability.isDot) {
      let dotTotal = ability.dotTotal;
      let dotTick = ability.dotTick;
      const contagion = this.charSvc.talentRank('contagion');
      if (contagion > 0) {
        const boost = 1 + contagion * 0.02;
        dotTotal = Math.round(dotTotal * boost);
        dotTick = Math.round(dotTick * boost);
      }
      const dotMasterDur = (ability.id === 'corruption' || ability.id === 'curse_of_agony' || ability.id === 'immolate') ? this.charSvc.talentRank('dot_master') : 0;
      const baseDotDur = (ability.dotDuration || 1) - dotMasterDur;
      if (evText) {
        const boost = 1 + this.charSvc.talentRank('evangelism') * 0.03;
        dotTotal = Math.round(dotTotal * boost);
        dotTick = Math.round(dotTotal / baseDotDur);
      }
      const displayedTotal = dotTick * ability.dotDuration;
      let directText = '';
      if (ability.id === 'immolate') {
        const min = ability.currentMin || 0;
        const max = ability.currentMax || 0;
        const direct = Math.round((min + Math.floor(Math.random() * (max - min + 1))) / 2);
        directText = ' +' + direct + ' directo';
        this.charSvc.turnDamage.update(d => d + direct);
        this.charSvc.sendDamageEvent({ ...ability, isDot: false }, direct, 1, 1);
      }
      const impGarrote = this.charSvc.talentRank('improved_garrote');
      if (ability.id === 'garrote' && impGarrote > 0) {
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + dotTick + '/turno · ' +
          ability.dotDuration + 't (' + displayedTotal + ' total) + Silencio' + evText + ' — ' + this.trSvc.t('apply_to_enemy')
        );
        this.charSvc.sendDamageEvent(ability, 0, 1, 1);
        this.charSvc.sendDamageEvent({
          ...ability,
          id: ability.id + '_silence',
          name: ability.name + ' (Silencio)',
          isDot: false,
          inflictsEffects: [{ type: 'debuff', name: 'Silencio', target: 'silenced', value: 0, duration: 2, debuffType: 'magic' }],
        }, 0, 1, 1);
      } else {
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + dotTick + '/turno · ' +
          ability.dotDuration + 't (' + displayedTotal + ' total)' + directText + evText + ' — ' + this.trSvc.t('apply_to_enemy')
        );
        this.charSvc.sendDamageEvent({ ...ability, dotTotal, dotTick }, 0, 1, 1);
      }
    } else if (ability.type === 'heal' && !ability.isHot) {
      let healBonus = 1 + this.charSvc.talentRank('healing_focus') * 0.02;
      const resonanceRank = this.charSvc.talentRank('resonance');
      if (resonanceRank > 0) healBonus *= (1 + resonanceRank * 0.05);
      if (ability.id === 'vivace') {
        const ivRank = this.charSvc.talentRank('improved_vivace');
        if (ivRank > 0) healBonus *= (1 + ivRank * 0.10);
      }
      let lunarText = '';
      const lhRank = this.charSvc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 10) {
        const comboMax = (this.charSvc.classConfig().comboConfig?.max) || 5;
        this.charSvc.character.update(c => ({
          ...c,
          comboPoints: Math.min(comboMax, (c.comboPoints || 0) + 1),
        }));
        lunarText = ' · +1 Fase Lunar';
      }
      if (ability.id === 'power_word_shield') {
        healBonus *= (1 + this.charSvc.talentRank('improved_shield') * 0.10);
        roll = Math.round(roll * healBonus);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': 🛡️ ' + roll + ' absorcion' +
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + noteText + ' — ' + this.trSvc.t('sent_to_master')
        );
        this.charSvc.sendHealEvent(ability, roll);
      } else {
        let darkMendingText = '';
        if (ability.id === 'dark_mending') {
          const hpPct = (this.charSvc.character().currentHP ?? this.charSvc.maxHP()) / this.charSvc.maxHP();
          if (hpPct < 0.5) {
            roll = Math.round(roll * 2);
            darkMendingText = ' · x2 (low HP!)';
          }
        }
        roll = Math.round(roll * healBonus);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + roll + ' curacion' +
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + noteText + darkMendingText + ' — ' + this.trSvc.t('sent_to_master')
        );
        this.charSvc.sendHealEvent(ability, roll);
        if (ability.id === 'healthstone') {
          const ihRank = this.charSvc.talentRank('improved_healthstone');
          if (ihRank > 0) {
            const improved = Math.round(roll * ihRank * 0.25);
            if (improved > 0) {
              this.charSvc.sendHealEvent({ ...ability, name: 'Healthstone (Mejorada)' }, improved);
              this.charSvc.showToast(ability.name + ' (Mejorada): +' + improved + ' HP para el warlock si la usas en un aliado — enviado al Master');
            }
          }
        }
      }
    } else if (ability.id === 'hunters_mark') {
      const hRank = ability.currentRank || 1;
      const hBuff = ability.buffRanks?.find((br: any) => br.rank === hRank);
      let armorVal = hBuff ? hBuff.value : 20;
      const ihmRank = this.charSvc.talentRank('improved_hunters_mark');
      if (ihmRank > 0) armorVal = Math.round(armorVal * (1 + ihmRank * 0.10));
      this.charSvc.sendDamageEvent({ ...ability, inflictsEffects: [{ type: 'debuff', name: "Hunter's Mark", stat: 'armor', value: armorVal, duration: 5 }] }, 0, 1, 1);
      this.charSvc.showToast(ability.name + ' R' + hRank + ': Armor -' + armorVal + ' (5 turnos) — ' + this.trSvc.t('apply_to_enemy'));
      return;
    } else if (ability.id === 'frost_trap') {
      const fRank = ability.currentRank || 1;
      const fBuff = ability.buffRanks?.find((br: any) => br.rank === fRank);
      const slowVal = fBuff ? fBuff.value : 40;
      this.charSvc.sendDamageEvent({ ...ability, inflictsEffects: [{ type: 'debuff', name: 'Frost Trap', target: 'attackPower', value: slowVal, duration: 3 }] }, 0, 1, 1);
      const lnlRank = this.charSvc.talentRank('lock_and_load');
      let lnlText = '';
      if (lnlRank > 0) {
        const lnlVal = [0, 15, 30, 50][lnlRank] || 0;
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [...(c.activeEffects || []), { id: Date.now(), type: 'buff', name: 'Lock and Load', target: 'lock_and_load', value: lnlVal, duration: 999, isPercent: false }],
        }));
        lnlText = ' · Lock and Load: Aimed -' + lnlVal + ' Focus';
      }
      this.charSvc.showToast(ability.name + ' R' + fRank + ': trampa AOE -' + slowVal + '% movimiento (3 turnos) — enviado al Master' + lnlText);
      return;
    } else {
      const poisonDmg = this.charSvc.getPoisonDamage();
      if (poisonDmg > 0 && ability.damageType === 'physical') {
        roll += poisonDmg;
      }
      if (ability.id === 'basic_attack' && this.charSvc.classConfig().abilities) {
        const belRank = this.charSvc.talentRank('beligerance');
        if (belRank > 0) {
          const spirit = this.charSvc.finalStats().espiritu || 0;
          const spiritDmg = Math.round(spirit * belRank * 0.10);
          roll += spiritDmg;
        }
        const ebaRank = this.charSvc.talentRank('energetic_basic_attack');
        if (ebaRank > 0 && isEnergy) {
          const energyGen = isCrit ? ebaRank * 2 : ebaRank;
          const resourceMax = this.charSvc.resourceMax();
          this.charSvc.character.update(c => ({
            ...c,
            currentEnergy: Math.min(resourceMax, (c.currentEnergy || 0) + energyGen),
          }));
          rageText = ' · +' + energyGen + ' energia';
        }
      }
      this.charSvc.turnDamage.update(d => d + roll);
      let lifestealText = '';
      if (ability.lifestealPct) {
        const idlRank = this.charSvc.talentRank('improved_drain_life');
        const heal = Math.round(roll * ability.lifestealPct * (1 + idlRank * 0.10));
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP || 0) + heal),
        }));
        lifestealText = ' · +' + heal + ' vida';
      }
      const leechPoisonPct = this.charSvc.getLeechPoisonPercent();
      if (leechPoisonPct > 0 && ability.damageType === 'physical') {
        const leechHeal = Math.round(roll * leechPoisonPct / 100);
        if (leechHeal > 0) {
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP || 0) + leechHeal),
          }));
          lifestealText += ' · 🩸 Veneno Vampírico +' + leechHeal + ' vida';
        }
      }
      const slRank = this.charSvc.talentRank('soul_leech');
      if (slRank > 0 && (ability.id === 'shadow_bolt' || ability.id === 'chaos_bolt')) {
        const shieldAmt = Math.round(roll * slRank * 0.05);
        if (shieldAmt > 0) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.target !== 'shield'),
              { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Soul Leech', target: 'shield', value: shieldAmt, duration: 99 },
            ],
          }));
          lifestealText += ' · 🛡️ +' + shieldAmt + ' escudo';
        }
      }
      const igniteRank = this.charSvc.talentRank('ignite');
      let igniteText = '';
      if (isCrit && igniteRank > 0 && ability.school === 'Fuego') {
        const igniteTotal = Math.max(1, Math.round(roll * 0.08 * igniteRank));
        const igniteTick = Math.max(1, Math.round(igniteTotal / 3));
        this.charSvc.sendDamageEvent(
          { ...ability, id: 'ignite', name: 'Ignite', isDot: true, dotTick: igniteTick, dotDuration: 3, stackable: true, damageType: 'magical' },
          0, 1, 1
        );
        igniteText = ' · 🔥 Ignite ' + igniteTotal + ' (' + igniteTick + '/t · 3t)';
      }
      const dmgText = isCrit ? '¡CRITICO!' : ability.inflictsEffects ? '¡Aturde al enemigo!' : 'Lanzado';
      let serpentText = '';
      let sendAbility: any = ability;
      if (ability.id === 'multi_shot') {
        const ssRank = this.charSvc.talentRank('serpent_spread');
        if (ssRank > 0) {
          const serp = this.charSvc.computedAbilities().find((x: any) => x.id === 'serpent_sting');
          const serpTick = serp && serp.dotTick ? serp.dotTick : Math.max(1, roll);
          const serpentTick = Math.max(1, Math.round(serpTick * 0.15 * ssRank));
          sendAbility = { ...ability, inflictsEffects: [{ type: 'dot', name: 'Serpent Sting', value: serpentTick, duration: 4, debuffType: 'poison', stackable: false }] };
          serpentText = ' · 🐍 Serpent Sting ' + serpentTick + '/t (4t)';
        }
      }
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + dmgText + igniteText + ccText + rageText + comboText + shardText + focusText + conduitText + lifestealText + noteText + evText + boostText + unyieldingText + serpentText
      );
      const hits = ability.multiHit || 1;
      for (let h = 0; h < hits; h++) {
        let hitRoll = roll;
        if (hits > 1 && h > 0) {
          hitRoll = (ability.currentMin || 0) + Math.floor(Math.random() * ((ability.currentMax || 0) - (ability.currentMin || 0) + 1));
          if (isCrit) hitRoll = Math.round(hitRoll * 1.5);
          if (isRage && this.charSvc.warriorStance() === 'battle') {
            const battleMult = 1.10 + this.charSvc.talentRank('improved_stances') * 0.02;
            hitRoll = Math.round(hitRoll * battleMult);
          }
          if (poisonDmg > 0 && ability.damageType === 'physical') hitRoll += poisonDmg;
          this.charSvc.turnDamage.update(d => d + hitRoll);
        }
        this.charSvc.sendDamageEvent(sendAbility, hitRoll, h + 1, hits);
      }
      const dtRank = this.charSvc.talentRank('double_tap');
      if (ability.id === 'arcanic_shot' && dtRank > 0 && Math.random() * 100 < dtRank * 15) {
        this.charSvc.turnDamage.update(d => d + roll);
        this.charSvc.sendDamageEvent({ ...ability, name: ability.name + ' (Double Tap)' }, roll, 1, 1);
        this.charSvc.character.update(c => {
          const focusMax = this.charSvc.resourceMax();
          return {
            ...c,
            currentFocus: Math.min(focusMax, (c.currentFocus || 0) + 10),
          };
        });
        this.charSvc.showToast(ability.name + ' R' + ability.currentRank + ': ✨ ¡Double Tap! ' + roll + ' dano extra · +10 Focus');
      }
    }
  }

  castUtility(ability: any) {
    const resType = this.charSvc.resourceConfig().type;
    const isRage = resType === 'rage';
    const isEnergy = resType === 'energy';
    const isFocus = resType === 'focus';
    let cost: number;
    if (isRage) {
      cost = ability.costRage || 0;
    } else if (isEnergy) {
      cost = this.charSvc.getEffectiveEnergyCost(ability);
    } else if (isFocus) {
      cost = ability.costFocus || 0;
    } else {
      cost = ability.scaledCost || 0;
    }

    const cd = this.charSvc.getCooldown(ability.id);
    const resourceActual = this.charSvc.resourceActual();
    const resourceMax = this.charSvc.resourceMax();
    const manaActual = this.charSvc.manaActual();
    const maxHP = this.charSvc.maxHP();
    const hpActual = this.charSvc.hpActual();

    if (cd > 0) {
      this.charSvc.showToast(ability.name + ' ' + this.trSvc.t('on_cd') + ' (' + cd + ' ' + (cd > 1 ? this.trSvc.t('turns') : this.trSvc.t('turn')) + ')');
      return;
    }
    if (ability.blockedStance && this.charSvc.warriorStance() === ability.blockedStance) {
      this.charSvc.showToast(ability.name + ' no se puede usar en esta estancia');
      return;
    }

    const actionCost = ability.noGcd ? 0 : (ability.castType === 'instant' ? 1 : 2);
    if (!this.charSvc.canAct(actionCost)) {
      this.charSvc.showToast(this.trSvc.t('sin_acciones'));
      return;
    }

    if (ability.id === 'stealth') {
      if (this.charSvc.isStealthed()) {
        this.charSvc.character.update(c => ({ ...c, activeEffects: (c.activeEffects || []).filter(e => e.target !== 'stealth') }));
        this.charSvc.showToast(this.trSvc.t('stealth_off'));
        return;
      }
      if (!this.charSvc.canAct(1)) {
        this.charSvc.showToast(this.trSvc.t('sin_acciones'));
        return;
      }
      this.charSvc.useAction(1);
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.target !== 'stealth'),
          { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Stealth', target: 'stealth', value: 0, duration: 999 },
        ],
      }));
      this.charSvc.showToast(this.trSvc.t('stealth_on'));
      return;
    }

    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      if (this.charSvc.getShards() < shardCost) {
        this.charSvc.showToast(this.trSvc.t('need_shards') + ' ' + shardCost + ' ' + (shardCost > 1 ? this.trSvc.t('soul_shards_plural') : this.trSvc.t('soul_shard')));
        return;
      }
    }

    if (ability.spendsNotes) {
      const notes = this.charSvc.getNotes();
      if (notes.length === 0) {
        this.charSvc.showToast(this.trSvc.t('no_notes_score'));
        return;
      }
    }

    this.charSvc.useAction(actionCost);

    if (isRage) {
      if (resourceActual < cost) {
        this.charSvc.showToast(this.trSvc.t('ira') + ' ' + this.trSvc.t('insufficient_resource'));
        return;
      }
      this.charSvc.character.update(c => ({
        ...c,
        currentRage: Math.min(resourceMax, resourceActual - cost),
      }));
    } else if (isEnergy) {
      if (resourceActual < cost) {
        this.charSvc.showToast(this.trSvc.t('energia') + ' ' + this.trSvc.t('insufficient_resource'));
        return;
      }
      this.charSvc.character.update(c => ({
        ...c,
        currentEnergy: Math.max(0, resourceActual - cost),
      }));
    } else if (isFocus) {
      if (resourceActual < cost) {
        this.charSvc.showToast(this.resourceLabel() + ' ' + this.trSvc.t('insufficient_resource'));
        return;
      }
      this.charSvc.character.update(c => ({
        ...c,
        currentFocus: Math.max(0, resourceActual - cost),
      }));
    } else {
      if (manaActual < cost) {
        this.charSvc.showToast(this.trSvc.t('mana') + ' ' + this.trSvc.t('insufficient_resource'));
        return;
      }
      const clearcast = this.charSvc.checkClearcasting();
      if (!clearcast) {
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: manaActual - cost,
        }));
      }
    }

    if (ability.focusGain && isFocus) {
      const resourceMaxF = this.charSvc.resourceMax();
      const gained = ability.focusGain;
      this.charSvc.character.update(c => ({
        ...c,
        currentFocus: Math.min(resourceMaxF, (c.currentFocus ?? 0) + gained),
      }));
    }

    const effCd = this.charSvc.getEffectiveCooldown(ability);
    if (effCd > 0) {
      this.charSvc.character.update(c => {
        if (!c.currentCooldowns) c.currentCooldowns = {};
        c.currentCooldowns[ability.id] = effCd;
        return { ...c };
      });
    }

    if (ability.healthCostPct) {
      const healthLost = Math.round(maxHP * ability.healthCostPct);
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.max(1, hpActual - healthLost),
      }));
      if (ability.rageGain && isRage) {
        const rageGain = this.charSvc.getEffectiveRageGen(ability);
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, (c.currentRage || 0) + rageGain),
        }));
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida · +' + rageGain + ' ira');
      } else if (ability.restoresManaPct) {
        const manaGained = Math.round(this.charSvc.maxMana() * ability.restoresManaPct);
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana || 0) + manaGained),
        }));
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida · +' + manaGained + ' mana');
      } else {
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida');
      }
    } else if (ability.isPetSummon) {
      if (this.charSvc.selectedCapstone() === 'lone_wolf') {
        this.charSvc.showToast('🐺 Lone Wolf activo: no puedes invocar a tu mascota');
        return;
      }
      if (ability.spendsShards) {
        this.charSvc.spendShards(ability.shardCost || 1);
      }
      this.charSvc.summonPet(ability.isPetSummon);
    } else if (ability.id === 'explosive_shot') {
      this.castExplosiveShot(ability);
    } else if (ability.id === 'summon_infernal') {
      this.castSummonInfernal(ability);
    } else if (ability.id === 'seed_of_corruption') {
      this.castSeedOfCorruption(ability);
    } else if (ability.id === 'demonic_sacrifice') {
      this.castDemonicSacrifice(ability);
    } else if (ability.id === 'holy_nova') {
      this.castHolyNova(ability);
    } else if (ability.id === 'dark_star') {
      this.castDarkStar(ability);
    } else if (ability.id === 'kill_command') {
      this.castKillCommand(ability);
    } else if (ability.id === 'disengage') {
      this.castDisengage(ability);
    } else if (ability.id === 'aspect_of_the_hawk' || ability.id === 'aspect_of_the_monkey') {
      this.castAspect(ability);
    } else if (ability.id === 'shadow_dance') {
      this.castShadowDance(ability);
    } else if (ability.id === 'blade_flurry') {
      this.castBladeFlurry(ability);
    } else if (ability.id === 'poison_mastery') {
      this.castPoisonMastery(ability);
    } else if (ability.id === 'shield_wall') {
      this.castShieldWall(ability);
    } else if (ability.id === 'recklessness') {
      this.castRecklessness(ability);
    } else if (ability.id === 'combustion') {
      this.castCombustion(ability);
    } else if (ability.id === 'icy_veins') {
      this.castIcyVeins(ability);
    } else if (ability.id === 'arcane_power') {
      this.castArcanePower(ability);
    } else if (ability.id === 'nature_guardian') {
      const comboMax = this.charSvc.classConfig().comboConfig?.max || 4;
      const baseStars = this.charSvc.classConfig().abilities.find(a => a.id === 'starsurge');
      if (baseStars) {
        const sRank = this.charSvc.maxAvailableRank(baseStars);
        const sDr = (baseStars.damageRanges || []).filter(d => d.rank === sRank).pop() || (baseStars.damageRanges || [])[baseStars.damageRanges!.length - 1];
        const sp = Math.round(this.charSvc.spellPower() * (baseStars.spellPowerRatio || 1));
        const stars = {
          ...baseStars,
          currentRank: sRank,
          currentMin: (sDr?.min || 0) + sp,
          currentMax: (sDr?.max || 0) + sp,
          scaledCost: Math.round((baseStars.costPct || 0) * this.charSvc.maxMana()),
        };
        this.charSvc.character.update(c => ({ ...c, comboPoints: comboMax }));
        this.charSvc.showToast(ability.name + ': Fases Lunares al maximo · Starsurge potenciado');
        this.castSpell(stars);
      }
    } else if (ability.id === 'unsummon_pet') {
      this.charSvc.dismissPet();
    } else if (ability.id === 'life_tap') {
      const manaGained = ability.currentBuffValue;
      const healthLost = manaGained;
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.max(1, (c.currentHP || 0) - healthLost),
        currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana || 0) + manaGained),
      }));
      this.charSvc.showToast(ability.name + ' R' + ability.currentRank + ': -' + healthLost + ' vida · +' + manaGained + ' mana');
    } else if (ability.buff && ability.buff.applySelf) {
      if (ability.id === 'inner_fire') {
        const innerVal = ability.currentBuffValue || 5;
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Inner Fire'),
            { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Inner Fire', target: 'armor', value: innerVal, duration: 999, isPercent: false },
            { id: Date.now() + Math.random() + 0.001, type: 'buff' as const, name: 'Inner Fire (AP)', target: 'attackPower', value: innerVal * 4, duration: 999, isPercent: false },
          ],
        }));
        this.charSvc.showToast('🔥 Inner Fire: +' + innerVal + ' Armor · +' + (innerVal * 4) + ' Attack Power');
        return;
      }
      let sndComboSpent = 0;
      if (ability.id === 'slice_and_dice') {
        sndComboSpent = this.charSvc.character().comboPoints || 0;
        if (sndComboSpent === 0) {
          this.charSvc.showToast(this.trSvc.t('no_combo_pts'));
          this.charSvc.character.update(c => ({
            ...c,
            currentEnergy: Math.min(resourceMax, (c.currentEnergy || 0) + (ability.costEnergy || 0)),
          }));
          return;
        }
      }
      const hpPercentBefore = maxHP > 0 ? hpActual / maxHP : 1;
      let buffValue = ability.currentBuffValue;
      if (ability.id === 'shout') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_battle_shout') * 0.05));
      }
      if (ability.id === 'power_word_shield') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_shield') * 0.10));
      }
      if (ability.id === 'power_word_fortitude') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_fortitude') * 0.15));
      }
      const effectType = ability.buff.isHot ? 'hot' : 'buff';
      let sndDuration = ability.currentBuffDuration;
      if (ability.id === 'slice_and_dice') {
        sndDuration = sndComboSpent + this.charSvc.talentRank('improved_slice_and_dice') * 3;
      }
      const poisonSibling = ability.id === 'poison_weapon' ? 'leechPoison' : (ability.id === 'leeching_poison' ? 'poisonDamage' : null);
      this.charSvc.character.update(c => ({
        ...c,
        ...(ability.id === 'slice_and_dice' ? { comboPoints: 0 } : {}),
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== ability.name && (poisonSibling ? e.target !== poisonSibling : true)),
          {
            id: Date.now() + Math.random(),
            type: effectType as any,
            name: ability.name,
            target: ability.buff.isHot ? 'hp' : ability.currentBuffStat,
            value: buffValue,
            duration: sndDuration,
            isPercent: ability.buff.isPercent || false,
          },
        ],
      }));
      if (ability.buff.isPercent && ability.currentBuffStat === 'maxHP') {
        const newMaxHP = this.charSvc.maxHP();
        let newHP = Math.round(newMaxHP * hpPercentBefore);
        if (ability.id === 'last_stand') {
          const healPct = this.charSvc.talentRank('improved_last_stand') * 0.05;
          if (healPct > 0) {
            const heal = Math.round(newMaxHP * healPct);
            newHP = Math.min(newMaxHP, newHP + heal);
          }
        }
        this.charSvc.character.update(c => ({ ...c, currentHP: newHP }));
      }
      if (ability.id === 'inner_focus') {
        this.charSvc.showToast('🎯 Inner Focus: tu próximo hechizo no cuesta maná y tiene +25% de crítico');
        return;
      }
      const sndText = ability.id === 'slice_and_dice' ? ' · +1 accion/turno · ' + sndComboSpent + ' combo gastados' : '';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': +' + buffValue +
        (ability.buff.isPercent ? '%' : '') + ' ' + ability.currentBuffStat +
        sndText + ' — ' + this.trSvc.t('sent_to_master')
      );
    } else if (ability.buff) {
      let buffValue = ability.currentBuffValue;
      if (ability.id === 'da_capo') {
        const contribution = this.charSvc.noteContribution();
        buffValue = Math.round(buffValue * contribution);
      }
      const buffText = '+' + buffValue + ' ' + ability.currentBuffStat +
        ' (' + ability.currentBuffDuration + ' turnos)';
      this.charSvc.sendBuffEvent(ability, buffValue);
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + buffText + ' — ' + this.trSvc.t('sent_to_master')
      );
      if (ability.id === 'crescendo') {
        const icRank = this.charSvc.talentRank('improved_crescendo');
        if (icRank > 0) {
          const selfBuffValue = Math.round(buffValue * icRank * 0.10);
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== 'Crescendo (Self)'),
              {
                id: Date.now() + Math.random(),
                type: 'buff' as const,
                name: 'Crescendo (Self)',
                target: 'damage_boost',
                value: selfBuffValue,
                duration: ability.currentBuffDuration,
                isPercent: false,
              },
            ],
          }));
          this.charSvc.showToast('Improved Crescendo: +' + selfBuffValue + ' dano (self)');
        }
      }
    } else {
      this.charSvc.showToast(ability.name + ': Lanzado');
    }

    if (ability.restoresManaPct && !ability.healthCostPct) {
      this.charSvc.restoreManaPct(ability.restoresManaPct);
      this.charSvc.showToast(ability.name + ': +' + Math.round(ability.restoresManaPct * 100) + '% mana restaurado');
      if (ability.id === 'fermata') {
        const ifRank = this.charSvc.talentRank('improved_fermata');
        if (ifRank > 0) {
          const armorGain = ifRank * 14;
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== 'Improved Fermata'),
              {
                id: Date.now() + Math.random(),
                type: 'buff' as const,
                name: 'Improved Fermata',
                target: 'armor',
                value: armorGain,
                duration: 4,
                isPercent: false,
              },
            ],
          }));
          this.charSvc.showToast('Improved Fermata: +' + armorGain + ' armadura (4t)');
        }
      }
    }
    if (ability.generatesNote) {
      this.charSvc.addNote(ability.generatesNote);
    }
    if (ability.modulateNotes) {
      this.charSvc.modulateNotes(ability.modulateNotes);
    }
    if (ability.spendsNotes) {
      const notes = this.charSvc.getNotes();
      if (notes.length > 0) {
        this.charSvc.clearNotes();
        const maestroRank = this.charSvc.talentRank('maestro');
        if (maestroRank > 0 && Math.random() * 100 < maestroRank * 15) {
          this.charSvc.actionsUsed.update(n => Math.max(0, n - 1));
          this.charSvc.showToast('¡Maestro! +1 accion devuelta');
        }
      }
    }
    if (ability.inflictsEffects) {
      const idRank = this.charSvc.talentRank('improved_diminuendo');
      const scaledEffects = ability.inflictsEffects.map((eff: any) => ({
        ...eff,
        value: ability.id === 'diminuendo' && idRank > 0
          ? Math.round((ability.currentBuffValue || eff.value) * (1 + idRank * 0.10))
          : (ability.currentBuffValue || eff.value),
      }));
      this.charSvc.sendDamageEvent({
        ...ability,
        name: ability.name + ' (Debuff)',
        isDot: false,
        inflictsEffects: scaledEffects,
      }, 0, 1, 1);
    }
  }

  fullRest() {
    const maxHP = this.charSvc.maxHP();
    const maxMana = this.charSvc.maxMana();
    const resourceMax = this.charSvc.resourceMax();
    this.charSvc.character.update(c => {
      const effects = (c.activeEffects || []).map(e => ({ ...e, duration: e.duration - 2 })).filter(e => e.duration > 0);
      const pocket = this.charSvc.talentRank('pocket_shards');
      return { ...c, currentHP: maxHP, comboPoints: 0, musicalNotes: [], soulShards: Math.min(pocket, (c.soulShards || 0)), currentCooldowns: {}, activeEffects: effects, infernalTurnsLeft: 0 };
    });
    if (this.charSvc.resourceConfig().type === 'rage') {
      this.charSvc.character.update(c => ({ ...c, currentRage: 0 }));
      this.charSvc.showToast('Full Rest: vida al maximo, ira reseteada, buffs -2 turnos');
    } else if (this.charSvc.resourceConfig().type === 'energy') {
      this.charSvc.character.update(c => ({ ...c, currentEnergy: resourceMax }));
      this.charSvc.showToast('Full Rest: vida y energia al maximo, buffs -2 turnos');
    } else if (this.charSvc.resourceConfig().type === 'focus') {
      this.charSvc.character.update(c => ({ ...c, currentFocus: resourceMax }));
      this.charSvc.showToast('Full Rest: vida y focus al maximo, buffs -2 turnos');
    } else {
      this.charSvc.character.update(c => ({ ...c, currentMana: maxMana }));
      this.charSvc.showToast('Full Rest: vida y mana al maximo, buffs -2 turnos');
    }
    this.charSvc.turnNumber.set(1);
    this.charSvc.turnDamage.set(0);
    this.charSvc.actionsUsed.set(0);
    this.charSvc.petRest();
  }

  resetCharacter() {
    if (confirm('¿Reiniciar la ficha? Se perderan los cambios sin guardar.')) {
      this.charSvc.character.set(
        createDefaultCharacter(this.charSvc.character().classKey, this.classRegistry.getAll())
      );
      this.charSvc.turnNumber.set(1);
      this.charSvc.showToast('Ficha reiniciada');
    }
  }

  openExport() {
    this.showExportModal.set(true);
  }

  exportedJson(): string {
    return JSON.stringify(this.charSvc.character(), null, 2);
  }

  copyJson() {
    navigator.clipboard.writeText(this.exportedJson()).then(() => {
      this.charSvc.showToast('JSON copiado al portapapeles');
    }).catch(() => {
      this.charSvc.showToast('No se pudo copiar');
    });
  }

  downloadJson() {
    const blob = new Blob([this.exportedJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.charSvc.character().name || 'personaje').replace(/\s+/g, '_') + '_ficha.json';
    a.click();
    URL.revokeObjectURL(url);
    this.charSvc.showToast('Archivo descargado');
  }

  saveChar() {
    this.charSvc.saveToLocalStorage();
    this.charSvc.showToast('Ficha guardada');
  }

  loadChar() {
    this.charSvc.loadFromLocalStorage();
    this.charSvc.showToast('Ficha cargada');
  }

  addEffect() {
    const ne = this.newEffect();
    const t = ne.type;
    if (t === 'status') {
      const statusLabel = STATUS_OPTIONS.find(s => s.key === ne.target)?.label || ne.target;
      this.charSvc.addEffect({
        id: Date.now() + Math.random(),
        type: 'status',
        name: statusLabel,
        target: ne.target,
        value: 0,
        duration: 1,
      });
    } else if (t === 'buff' || t === 'debuff') {
      if (!ne.name.trim() || !ne.value) {
        this.charSvc.showToast('Faltan datos del efecto');
        return;
      }
      this.charSvc.addEffect({
        id: Date.now() + Math.random(),
        type: t,
        name: ne.name.trim(),
        target: ne.target,
        value: Math.abs(ne.value),
        duration: ne.duration || 1,
      });
    } else if (t === 'hot' || t === 'dot') {
      if (!ne.name.trim() || !ne.value) {
        this.charSvc.showToast('Faltan datos del efecto');
        return;
      }
      this.charSvc.addEffect({
        id: Date.now() + Math.random(),
        type: t,
        name: ne.name.trim(),
        target: ne.target,
        value: Math.abs(ne.value),
        duration: ne.duration || 1,
      });
    } else if (t === 'misc') {
      if (!ne.name.trim()) {
        this.charSvc.showToast('Faltan datos del efecto');
        return;
      }
      this.charSvc.addEffect({
        id: Date.now() + Math.random(),
        type: 'misc',
        name: ne.name.trim(),
        target: ne.target,
        value: Math.abs(ne.value),
        duration: ne.duration || 1,
      });
    }
    this.onEffectTypeChange();
    this.charSvc.showToast('Efecto anadido');
  }

  removeEffect(id: number) {
    this.charSvc.removeEffect(id);
  }

  onEffectTypeChange() {
    const t = this.newEffect().type;
    if (t === 'status') {
      this.newEffect.update(ne => ({ ...ne, target: 'stunned', value: 0, duration: 1, name: '' }));
    } else if (t === 'buff' || t === 'debuff') {
      this.newEffect.update(ne => ({ ...ne, target: 'aguante', value: 0, duration: 1, name: '' }));
    } else if (t === 'hot' || t === 'dot') {
      this.newEffect.update(ne => ({ ...ne, target: 'hp', value: 0, duration: 1, name: '' }));
    } else if (t === 'misc') {
      this.newEffect.update(ne => ({ ...ne, target: '', value: 0, duration: 1, name: '' }));
    }
  }

  resetTalents() {
    if (confirm('¿Resetear todos los talentos? Los puntos seran devueltos.')) {
      this.charSvc.character.update(c => ({ ...c, talents: {}, capstone: undefined }));
      this.charSvc.showToast('Talentos reseteados');
    }
  }

  trainAll() {
    this.charSvc.trainAll();
    if (this.charSvc.trainableAbilities().length > 0) {
      this.charSvc.showToast('Entrenamiento completado');
    } else {
      this.charSvc.showToast('Nada que entrenar');
    }
  }

  getTalentName(id: string): string {
    const t = this.charSvc.classConfig().talents.find(t => t.id === id);
    return t ? t.name : id;
  }

  effectValueText(eff: ActiveEffect): string {
    if (eff.type === 'buff') return '+' + eff.value + ' ' + eff.target;
    if (eff.type === 'debuff') return '-' + eff.value + ' ' + eff.target;
    if (eff.type === 'hot') return '+' + eff.value + ' ' + (eff.target === 'mana' ? 'mana' : 'vida') + '/turno';
    if (eff.type === 'dot') return '-' + eff.value + ' ' + (eff.target === 'mana' ? 'mana' : 'vida') + '/turno';
    if (eff.type === 'status') return eff.name;
    if (eff.type === 'misc') return (eff.value > 0 ? '+' : '') + eff.value + ' ' + eff.target;
    return '';
  }

  statBonus(key: StatKey): number {
    return this.charSvc.gearStatBonus(key) + this.charSvc.effectStatBonus(key);
  }

  levelStatBonus(key: StatKey): number {
    return this.charSvc.finalStats()[key] - this.charSvc.character().baseStats[key]
      - this.charSvc.gearStatBonus(key) - this.charSvc.effectStatBonus(key);
  }

  shieldValue(): number {
    const effects = this.charSvc.character().activeEffects;
    if (!effects) return 0;
    const shield = effects.find(e => e.target === 'shield');
    return shield ? shield.value : 0;
  }

  shieldPercent(): number {
    if (this.charSvc.maxHP() === 0) return 0;
    return Math.floor((this.shieldValue() / this.charSvc.maxHP()) * 100);
  }

  resourceLabel(): string {
    const rc = this.charSvc.resourceConfig();
    if (rc.type === 'rage') return 'Ira';
    if (rc.type === 'energy') return 'Energia';
    if (rc.type === 'focus') return 'Focus';
    return 'Mana';
  }

  resourceBarBackground(): string {
    const type = this.charSvc.resourceConfig().type;
    if (type === 'rage') return 'linear-gradient(180deg, #c0392b 0%, #8b2e1e 100%)';
    if (type === 'energy') return 'linear-gradient(180deg, #f1c40f 0%, #b7950b 100%)';
    if (type === 'focus') return 'linear-gradient(180deg, #aad372 0%, #79b54a 100%)';
    return 'linear-gradient(180deg, #3498db 0%, #2471a3 100%)';
  }

  lockedAbilities(): any[] {
    return this.charSvc.classConfig().abilities.filter(a => {
      if (a.type === 'utility') return false;
      return this.charSvc.maxAvailableRank(a) === 0 && this.charSvc.trainedRank(a.id) === 0;
    });
  }

  visibleEquipmentSlots(): any[] {
    const classKey = this.charSvc.character().classKey;
    const slots = [...EQUIPMENT_SLOTS];
    if (classKey === 'warrior' && this.charSvc.talentRank('master_of_weapons') > 0) {
      slots.push({
        key: 'twoHand',
        label: 'Dos Manos',
        icon: '⚔️',
        extraFields: [{ key: 'weaponDamage', label: 'Dano', icon: '💥' }],
      });
    }
    if (classKey === 'hunter') {
      slots.push({
        key: 'ranged',
        label: 'A Distancia',
        icon: '🏹',
        extraFields: [{ key: 'weaponDamage', label: 'Dano', icon: '💥' }],
      });
    }
    return slots;
  }
}
