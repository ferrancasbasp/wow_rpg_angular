import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { FirebaseService } from '../../services/firebase.service';
import { TranslationService } from '../../services/translation.service';
import { SimCombatService } from '../../services/sim-combat.service';
import { onChildAdded, ref, off } from 'firebase/database';
import { ClassRegistryService } from '../../services/class-registry.service';
import {
  STAT_KEYS, STAT_ICONS, EFFECT_TYPES, BUFF_DEBUFF_STATS,
  DEBUFF_TYPES, debuffColor,
  NOTE_NAMES, NOTE_COLORS,
  STATUS_OPTIONS, HOT_DOT_TARGETS, EQUIPMENT_SLOTS, MAX_LEVEL,
  xpForLevel, createDefaultCharacter,
} from '../../data/game-data';
import { MOB_SYMBOLS } from '../../data/mob-symbols';
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
  private simCombat = inject(SimCombatService);

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

  raidSymbols = () => MOB_SYMBOLS;

  symIndex = (sym: { id: string; icon: string; img: string; label: string }) =>
    MOB_SYMBOLS.findIndex(s => s.id === sym.id);

  setRaidSymbol(index: number) {
    this.charSvc.character.update(c => ({
      ...c,
      raidSymbol: this.charSvc.character().raidSymbol === index ? null : index,
    }));
    this.charSvc.saveToLocalStorage();
  }

  showExportModal = signal(false);
  showTalentModal = signal(false);
  showStatsModal = signal(false);
  showEquipment = signal(false);
  showEffectsPanel = signal(true);
  hoveredTalent = signal<any>(null);
  hoveredAbility = signal<any>(null);
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
          const healMult = this.charSvc.healingReceivedMult();
          const applied = healMult < 1 ? Math.max(0, Math.round((event.amount || 0) * healMult)) : (event.amount || 0);
          this.charSvc.adjustHP(applied);
          const reducedNote = healMult < 1 ? ' (cura reducida −' + Math.round((1 - healMult) * 100) + '%)' : '';
          this.incomingMasterMsg.set('💚 ' + (event.abilityName || 'Master') + ': +' + applied + ' HP' + reducedNote);
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
              { id: Date.now() + Math.random(), type: 'buff' as const, name: event.abilityName || 'Shield', target: 'shield', value: event.amount, duration: 3 },
            ],
          }));
          this.incomingMasterMsg.set('🛡️ ' + (event.abilityName || 'Master') + ': ' + event.amount + ' absorcion');
        } else if (event.type === 'notice') {
          this.incomingMasterMsg.set('⚠️ ' + (event.message || 'Aviso del master'));
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

  sunShardPointArray(): number[] {
    return Array.from({ length: this.charSvc.sunShardsMax() }, (_, i) => i + 1);
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
    const dsRank = this.charSvc.talentRank('destruction_specialization');
    if (Math.random() * 100 < parseFloat(this.charSvc.spellCrit()) + dsRank * 5) {
      let critMult = 1.5;
      if (dsRank > 0) critMult = 1.5 + dsRank * 0.10;
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
    this.sendDamagePayload({
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
    const healMult = this.charSvc.healingReceivedMult();
    const appliedHeal = healMult < 1 ? Math.round(heal * healMult) : heal;
    this.charSvc.adjustHP(appliedHeal);
    const healReduced = healMult < 1 ? ' (cura reducida −' + Math.round((1 - healMult) * 100) + '%)' : '';
    this.charSvc.showToast(ability.name + ': ' + dmg + ' danyo de sombra a todos (AOE)' + (isCrit ? ' ¡CRITICO!' : '') + ' · te curas ' + appliedHeal + healReduced + (lowHp ? ' (x2 low HP)' : ''));
  }

  castFinale(ability: any) {
    const notes = this.charSvc.getNotes();
    const level = this.charSvc.character().level;
    const ranks = ability.damageRanges || [];
    const rnk = [...ranks].reverse().find((d: any) => d.level <= level) || ranks[0];
    const minD = rnk ? rnk.min : 18;
    const maxD = rnk ? rnk.max : 26;
    let roll = minD + Math.floor(Math.random() * (maxD - minD + 1));
    roll += Math.round(this.charSvc.spellPower() * (ability.spellPowerRatio || 0.8));
    const contribution = this.charSvc.noteContribution();
    roll = Math.round(roll * contribution);
    let isCrit = false;
    if (Math.random() * 100 < parseFloat(this.charSvc.spellCrit())) {
      isCrit = true;
      roll = Math.round(roll * 1.5);
    }
    this.charSvc.clearNotes();
    let noteText = ' · ' + notes.length + ' notas consumidas (×' + contribution.toFixed(1) + ')';
    const maestroRank = this.charSvc.talentRank('maestro');
    if (maestroRank > 0 && Math.random() * 100 < maestroRank * 15) {
      this.charSvc.actionsUsed.update(n => Math.max(0, n - 1));
      noteText += ' · ¡Maestro! +1 accion';
    }
    const improRank = this.charSvc.talentRank('impro');
    if (improRank > 0 && Math.random() * 100 < improRank * 20) {
      const maxNote = this.charSvc.classConfig().comboConfig?.max || 7;
      const newNote = 1 + Math.floor(Math.random() * maxNote);
      this.charSvc.addNote(newNote);
      noteText += ' · ¡Impro! Nueva nota: ' + NOTE_NAMES[newNote - 1];
    }
    this.charSvc.addTurnDamage(roll);
    this.sendDamagePayload({
      player: this.charSvc.character().name || 'Jugador',
      ability: ability.name,
      rank: rnk ? rnk.rank : 1,
      damage: roll,
      damageType: 'magical',
      aoe: false,
      effects: null,
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    this.charSvc.showToast(ability.name + ': ' + roll + ' danyo de magia' + (isCrit ? ' ¡CRITICO!' : '') + noteText + ' — ' + this.trSvc.t('sent_to_master'));
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
    this.sendDamagePayload({
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
    this.sendDamagePayload({
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

  castColossusSmash(ability: any) {
    const weaponDmg = this.charSvc.totalWeaponDamage();
    const apBonus = Math.round(this.charSvc.attackPower() / 7);
    const base = Math.round(weaponDmg * 2) + apBonus;
    const min = Math.max(1, Math.round(base * 0.5));
    const max = Math.max(min + 1, Math.round(base * 1.5));
    let roll = min + Math.floor(Math.random() * (max - min + 1));
    let isCrit = false;
    if (Math.random() * 100 < parseFloat(this.charSvc.meleeCrit())) {
      isCrit = true;
      let critMult = 1.5;
      if (this.charSvc.hasEffect('recklessness')) critMult = critMult * 1.20;
      roll = Math.round(roll * critMult);
    }
    if (this.charSvc.warriorStance() === 'battle') {
      roll = Math.round(roll * (1.10 + this.charSvc.talentRank('improved_stances') * 0.02));
    }
    this.charSvc.addTurnDamage(roll);
    this.sendDamagePayload({
      player: this.charSvc.character().name || 'Jugador',
      ability: ability.name,
      rank: 1,
      damage: roll,
      damageType: 'physical',
      effects: [{ type: 'debuff', name: 'Colossus Smash', target: 'armor', value: 30, duration: 2, debuffType: 'none', stackable: false }],
      turn: this.charSvc.turnNumber(),
      timestamp: Date.now(),
      assigned: false,
    });
    this.charSvc.showToast(ability.name + ': 💥 ' + roll + ' Fisico' + (isCrit ? ' · CRITICO' : '') + ' · armadura −30 (2 turnos) — enviado al Master');
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

  castTotem(ability: any) {
    const slot = ability.totem === 'fire' ? 'fire' : 'water';
    const prev = this.charSvc.totemInfo(slot);
    const itRank = this.charSvc.talentRank('improved_totems');
    const totemMult = 1 + itRank * 0.10;
    this.charSvc.summonTotem(slot, ability.totemType || 'searing', ability.totemTurns || 4, Math.round((ability.currentMin || 0) * totemMult), Math.round((ability.currentMax || 0) * totemMult), Math.round((ability.currentBuffValue || ability.currentMin || 0) * totemMult));
    const slotLabel = ability.totem === 'fire' ? 'Tótem de Fuego' : 'Tótem de Agua';
    const prevText = prev ? ' (sustituye al anterior)' : '';
    const detail = ability.totemType === 'fire_nova'
      ? 'explotará durante tu siguiente turno'
      : 'duración ' + (ability.totemTurns || 4) + ' turnos';
    const multText = itRank > 0 ? ' · efectividad +' + Math.round(itRank * 10) + '%' : '';
    this.charSvc.showToast('🪵 ' + ability.name + ' R' + ability.currentRank + ': ' + detail + ' · ' + slotLabel + prevText + multText);
  }

  castWeaponImbue(ability: any) {
    const imbValue = ability.currentBuffValue;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'weapon_imbue'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: ability.name, target: 'weapon_imbue', value: imbValue, duration: 999, isPercent: false },
      ],
    }));
    const detail = ability.id === 'flametongue_weapon'
      ? 'tus ataques basicos +' + imbValue + ' danyo de fuego'
      : 'tus ataques basicos: ' + imbValue + '% Windfury';
    this.charSvc.showToast('🗡️ ' + ability.name + ' R' + ability.currentRank + ': ' + detail + ' (solo un imbuíto de arma)');
  }

  castHolyNova(ability: any) {
    const sp = this.charSvc.spellPower();
    const dr = (ability.damageRanges || [])[0] || { min: 30, max: 45 };
    const dmg = Math.round(dr.min + Math.random() * (dr.max - dr.min) + sp * (ability.spellPowerRatio || 0.6));
    const heal = Math.round(45 + sp * 0.8);
    const myName = this.charSvc.character().name || 'Jugador';
    const turn = this.charSvc.turnNumber();
    const now = Date.now();
    this.sendDamagePayload({
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
    this.sendDamagePayload({
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
    this.sendDamagePayload({
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
    const hasWound = this.charSvc.hasEffect('woundPoison');
    const hasMortal = this.charSvc.hasEffect('poisonDamage');
    const hasVamp = this.charSvc.hasEffect('leechPoison');
    let effectText: string;
    if (hasWound) {
      effectText = 'Wound: tus ataques además reducen un 25% el daño del enemigo';
    } else if (hasMortal) {
      effectText = 'Veneno Mortal x2';
    } else if (hasVamp) {
      effectText = 'Veneno Vampírico x3';
    } else {
      effectText = 'envenena antes tus armas para potenciar el veneno';
    }
    this.charSvc.showToast('☠️ Poison Mastery activa · ' + effectText + ' (' + duration + ' turnos)');
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

  castAscendance(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'ascendance'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Ascendance', target: 'ascendance', value: 1, duration },
      ],
    }));
    this.charSvc.showToast('🔥 Ascendance activa · 3 turnos: +30% Spell Power, +5% crit y +25% danyo critico (Rayo, Cadena, Choque de Llamas y de Tierra)');
  }

  castBloodlust(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'bloodlust'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Bloodlust', target: 'bloodlust', value: 20, duration },
      ],
      comboPoints: Math.min(this.charSvc.getMaelstromMax(), (c.comboPoints || 0) + 2),
    }));
    this.charSvc.sendBuffEvent(ability);
    this.charSvc.showToast('🩸 Bloodlust · party +20% Attack Power y Spell Power (3 turnos) · +2 Cargas de Maelstorm — enviado al Master (AOE)');
  }

  castSpiritLink(ability: any) {
    const duration = 3;
    this.charSvc.character.update(c => ({
      ...c,
      activeEffects: [
        ...(c.activeEffects || []).filter(e => e.target !== 'spirit_link'),
        { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Spirit Link Totem', target: 'spirit_link', value: 1, duration },
      ],
    }));
    this.charSvc.showToast('🕸️ Totem de Vinculo Espiritual (3 turnos) · Ola de Sanacion replica 30% a la party · Cadena de Sanacion +20%');
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
    this.charSvc.upgradeStarterWeaponsToLevel25();
    this.charSvc.equipTestGear();
    this.charSvc.showToast('Test Gear equipado: +1 Fza · +1 Agi · +1 Int · +3 Aguante · +2 Espiritu · +3 armadura (pecho y manos)');
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
        this.sendDamagePayload({
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
        this.sendDamagePayload({
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
        const howlPct = buffRank ? buffRank.value : 10;
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Furious Howl'),
            { id: Date.now(), type: 'buff' as const, name: 'Furious Howl', target: 'attackPower', value: howlPct, duration: 3, isPercent: true },
          ],
        }));
        this.charSvc.showToast(ability.name + ': +' + howlPct + '% Attack Power al Hunter y al Wolf durante 3 turnos');
        const fiRank = this.charSvc.talentRank('ferocious_inspiration');
        if (fiRank > 0) {
          const effectiveness = fiRank >= 2 ? 1 : 0.5;
          const partyPct = Math.round(howlPct * effectiveness);
          this.charSvc.sendBuffEvent({ ...ability, name: 'Furious Howl', currentBuffStat: 'attackPower', currentBuffValue: partyPct, currentBuffDuration: 3, buff: { stat: 'attackPower', duration: 3, isPercent: true }, partyBuff: true } as any);
          this.charSvc.showToast(ability.name + ': 🎵 Ferocious Inspiration — party +' + partyPct + '% Attack Power (3 turnos) — enviado al Master');
        }
      } else if (ability.id === 'growl') {
        const myName = (this.charSvc.character().name || '').trim();
        const petPlayerName = myName ? myName + ' — Bear' : '';
        this.sendDamagePayload({
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
          const thickVal = [0, 8, 15][fiRank] || 0;
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
          this.sendDamagePayload({
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

  private sendDamagePayload(payload: any) {
    if (this.charSvc.simMode()) {
      if ((payload.damageType || '') === 'heal' && (payload.damage || 0) > 0) {
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + payload.damage),
        }));
        this.simCombat.pushLog(`+${payload.damage} ${payload.ability || 'Curación'}`);
        return;
      }
      if (this.simCombat.enemy() && !this.simCombat.enemy()!.currentHP) {
        this.simCombat.pushLog('El dummy ya está derrotado');
        return;
      }
      this.simCombat.applyPlayerHit(payload, this.simMeta());
      return;
    }
    const isHealOrBuff = (payload.damageType === 'heal' || payload.damageType === 'buff');
    this.firebase.pushData('damageEvents', {
      ...payload,
      symbol: isHealOrBuff ? null : (this.charSvc.character().raidSymbol ?? null),
    });
  }

  private capstoneName(): string {
    const id = this.charSvc.selectedCapstone();
    const cap = this.charSvc.capstones().find((c: any) => c.id === id);
    return cap ? cap.name : '';
  }

  private simMeta() {
    return {
      clase: this.charSvc.character().classKey || '',
      nivel: this.charSvc.character().level || 0,
      turnos: this.charSvc.turnNumber(),
      hpFinal: Math.max(0, this.charSvc.hpActual()),
      enemigo: this.simCombat.enemy()?.name || '',
      capstone: this.capstoneName(),
    };
  }

  private simDummyTurn() {
    const enemy = this.simCombat.enemy();
    if (!enemy) return;
    const tickText = this.simCombat.processEnemyTick(enemy);
    if (tickText) this.simCombat.pushLog(`⏳ ${tickText}`);
    this.simCombat.enemy.update((e) => ({ ...(e as any), currentHP: enemy.currentHP }));
    if (enemy.currentHP <= 0) return;
    const atk = this.simCombat.rollAttack(enemy, 0);
    this.simCombat.pushLog(`👹 ${enemy.name} usa ${atk.name}`);
    if (atk.inflictsEffects) {
      this.simCombat.applyEffectsToEnemy(enemy, atk.inflictsEffects, { player: enemy.name, ability: atk.name });
      this.simCombat.enemy.update((e) => ({ ...(e as any), effects: enemy.effects.map((x: any) => ({ ...x })) }));
    }
    this.hpAction(atk.roll, atk.damageType);
  }

  endTurn() {
    const oldTurn = this.charSvc.turnNumber();
    this.processEffects();

    if (this.charSvc.character().classKey === 'mage') {
      const snacks = this.charSvc.talentRank('combat_snacks');
      if (snacks > 0) {
        const hpSnack = Math.round(this.charSvc.maxHP() * 0.015 * snacks);
        const manaSnack = Math.round(this.charSvc.maxMana() * 0.015 * snacks);
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + hpSnack),
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaSnack),
        }));
        this.charSvc.showToast('🍖 Combat Snacks: +' + hpSnack + ' vida · +' + manaSnack + ' mana');
      }
    }

    if (this.charSvc.hasEffect('arcane_power')) {
      const restored = Math.round(this.charSvc.maxMana() * 0.20);
      this.charSvc.character.update(c => ({
        ...c,
        currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + restored),
      }));
      this.charSvc.showToast('⚡ Arcane Power: +' + restored + ' mana');
    }

    const petAttack = this.charSvc.petAttack();
    if (petAttack) {
      this.charSvc.addTurnDamage(petAttack.damage);
      const focusText = petAttack.focusGain > 0 ? ' · +' + petAttack.focusGain + ' Focus' : '';
      this.charSvc.showToast(`👹 ${petAttack.name}: ${petAttack.damage} danyo de ${petAttack.school}` + focusText);
      this.sendDamagePayload({
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
      this.sendDamagePayload({
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
      this.sendDamagePayload({
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

    this.processTotems(oldTurn);

    this.charSvc.nextTurn();
    const resType = this.charSvc.resourceConfig().type;
    if (resType === 'rage') {
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn);
    } else if (resType === 'energy') {
      const regen = Math.round((this.charSvc.resourceConfig().regen || 20) * (1 + this.charSvc.talentRank('vitality') * (0.5 / 3)));
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · +' + regen + ' ' + this.trSvc.t('energy_regen'));
    } else if (resType === 'focus') {
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · Focus: sin regen');
    } else {
      const regen = this.charSvc.manaRegen();
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn + ' · +' + regen + ' ' + this.trSvc.t('mana_regen_turn'));
    }
    if (this.charSvc.simMode()) {
      this.simDummyTurn();
      this.simCombat.setTurns(this.charSvc.turnNumber());
      this.simCombat.checkWin(this.simMeta());
      if (this.charSvc.hpActual() <= 0) {
        this.simCombat.recordRun('derrota', this.simMeta());
      }
    }
  }

  private processTotems(turn: number) {
    const me = this.charSvc.character().name || 'Jugador';
    const now = Date.now();

    const fire = this.charSvc.totemInfo('fire');
    if (fire && (fire.turns || 0) > 0) {
      const fired = Math.round((fire.min || 0) + Math.random() * ((fire.max || fire.min || 0) - (fire.min || 0)));
      if (fire.type === 'fire_nova') {
        const remaining = (fire.turns || 0) - 1;
        if (remaining <= 0) {
          this.charSvc.addTurnDamage(fired);
          this.sendDamagePayload({
            player: me,
            ability: 'Tótem Nova de Fuego (Explosión)',
            rank: 1,
            damage: fired,
            damageType: 'magical',
            aoe: true,
            chain: false,
            effects: null,
            turn,
            timestamp: now,
            assigned: false,
          });
          this.charSvc.showToast('💥 Tótem Nova de Fuego: ' + fired + ' danyo en area · se destruye');
          this.charSvc.updateTotem('fire', null);
        } else {
          this.charSvc.updateTotem('fire', remaining);
        }
      } else if (fire.type === 'searing') {
        const remaining = (fire.turns || 0) - 1;
        this.charSvc.addTurnDamage(fired);
        this.sendDamagePayload({
          player: me,
          ability: 'Tótem Abrasador (Ataque)',
          rank: 1,
          damage: fired,
          damageType: 'magical',
          aoe: false,
          chain: false,
          effects: null,
          turn,
          timestamp: now,
          assigned: false,
        });
        this.charSvc.updateTotem('fire', remaining > 0 ? remaining : null);
        this.charSvc.showToast('🔥 Tótem Abrasador: ' + fired + ' danyo de fuego' + (remaining > 0 ? ' · ' + remaining + ' turnos' : ' · se consume'));
      }
    }

    const water = this.charSvc.totemInfo('water');
    if (water && (water.turns || 0) > 0) {
      const remaining = (water.turns || 0) - 1;
      if (water.type === 'healing_stream') {
        const healAmt = water.value ?? water.min ?? 0;
        this.sendDamagePayload({
          player: me,
          ability: 'Tótem de Corriente Sanadora (Grupal)',
          rank: 1,
          damage: healAmt,
          damageType: 'heal',
          aoe: true,
          chain: false,
          effects: null,
          turn,
          timestamp: now,
          assigned: false,
        });
        this.charSvc.showToast('💧 Tótem de Corriente Sanadora: +' + healAmt + ' HP al grupo' + (remaining > 0 ? ' · ' + remaining + ' turnos' : ' · se consume'));
      } else if (water.type === 'mana_spring') {
        const manaAmt = water.value ?? water.min ?? 0;
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaAmt),
        }));
        this.charSvc.showToast('💠 Tótem Manantial de Maná: +' + manaAmt + ' maná' + (remaining > 0 ? ' · ' + remaining + ' turnos' : ' · se consume'));
      }
      this.charSvc.updateTotem('water', remaining > 0 ? remaining : null);
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
          const tickHeal = Math.round(eff.value * this.charSvc.healingReceivedMult());
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(maxHP, (c.currentHP ?? maxHP) + tickHeal),
          }));
          messages.push('+' + tickHeal + ' ' + eff.name);
        }
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

    const maelstormFree = this.charSvc.isMaelstormReady() && ability.castType === 'cast';
    if (maelstormFree) {
      cost = Math.round((cost || 0) * 0.5 * (1 - this.charSvc.talentRank('maelstrom_efficiency') * 0.15));
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
    const mindBlastInstant = ability.id === 'mind_blast' && this.charSvc.talentRank('improved_mind_blast') > 0;
    const lockAndLoadInstant = ability.id === 'aimed_shot' && this.charSvc.hasEffect('lock_and_load');
    const maelstormNoGcd = maelstormFree && this.charSvc.character().classKey === 'shaman' && this.charSvc.talentRank('maelstrom_mastery') > 0;
    const actionCost = ability.noGcd || maelstormNoGcd ? 0 : (maelstormFree ? 1 : ((ability.castType === 'instant' || icyVeinsInstant || backdraftInstant || mindBlastInstant || lockAndLoadInstant) ? 1 : 2));
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

    if (ability.spendsSunShards && (this.charSvc.getSunShards() || 0) === 0) {
      this.charSvc.showToast(this.trSvc.t('no_sun_shards'));
      return;
    }

    if (this.charSvc.isStealthed()) {
      this.charSvc.character.update(c => ({ ...c, activeEffects: (c.activeEffects || []).filter(e => e.target !== 'stealth') }));
      this.charSvc.showToast(this.trSvc.t('stealth_off'));
    }

    this.charSvc.useAction(actionCost);

    let maelstormText = '';
    if (maelstormFree) {
      this.charSvc.character.update(c => ({ ...c, comboPoints: 0 }));
      maelstormText = maelstormNoGcd
        ? ' · ¡Maelstorm! Lanzamiento sin GCD y (−50% maná)'
        : ' · ¡Maelstorm! Lanzamiento instantáneo (−50% maná)';
    }

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
    if (ability.castType === 'instant' && this.charSvc.character().classKey === 'mage') {
      critChance += this.charSvc.talentRank('magic_resistance') * 2;
    }
    if (ability.id === 'fire_blast' && this.charSvc.character().classKey === 'mage') {
      critChance += this.charSvc.talentRank('improved_fire_blast') * 10;
    }
    if (ability.school === 'Escarcha' && this.charSvc.character().classKey === 'mage') {
      critChance += this.charSvc.talentRank('frost_power') * 2;
    }
    if (ability.id === 'basic_attack' && this.charSvc.character().classKey === 'warrior') {
      critChance += this.charSvc.talentRank('unyielding_strikes') * 1;
    }
    if (ability.school === 'Fuego' && this.charSvc.hasEffect('combustion')) {
      critChance += 25;
    }
    if (this.charSvc.hasEffect('inner_focus')) {
      critChance += 25;
    }
    if (this.charSvc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
      const hawkActive = (this.charSvc.character().activeEffects || []).some(e => e.type === 'buff' && e.name === 'Aspect of the Hawk');
      if (hawkActive) critChance += this.charSvc.talentRank('improved_aspect_of_the_hawk') * 4;
    }
    if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') {
      critChance += this.charSvc.talentRank('destruction_specialization') * 5;
    }
    if (this.charSvc.character().classKey === 'shaman' && (ability.id === 'lightning_bolt' || ability.id === 'chain_lightning')) {
      critChance += this.charSvc.talentRank('thundering_strikes') * 5;
    }
    if (this.charSvc.character().classKey === 'shaman' && this.charSvc.hasEffect('ascendance') && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
      critChance += 5;
    }
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) {
      let critMult = 1.5;
      if (ability.id === 'chaos_bolt' || ability.id === 'rain_of_fire') {
        critMult = 1.5 + this.charSvc.talentRank('destruction_specialization') * 0.10;
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
    if (this.charSvc.character().classKey === 'druid') {
      const sorRank = this.charSvc.talentRank('stone_of_rhythms');
      if (sorRank > 0 && (this.charSvc.getSunShards() || 0) > 0 && Math.random() * 100 < sorRank * 15) {
        const manaGain = Math.round(this.charSvc.maxMana() * 0.05);
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaGain),
          sunShards: (c.sunShards || 0) - 1,
        }));
        this.charSvc.showToast('🎶 Stone of Rhythms: −1 Sun Shard · +' + manaGain + ' maná (5%)');
      }
    }

    if (this.charSvc.hasEffect('arcane_power')) {
        critMult = critMult * 1.25;
      }
      if (this.charSvc.character().classKey === 'hunter' && ['auto_shot', 'arcanic_shot', 'aimed_shot', 'multi_shot'].includes(ability.id)) {
        critMult = critMult * (1 + this.charSvc.talentRank('mortal_shots') * 0.05);
      }
      if (this.charSvc.character().classKey === 'shaman' && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
        critMult += this.charSvc.talentRank('elemental_fury') * 0.05;
      }
      if (ability.school === 'Escarcha' && this.charSvc.character().classKey === 'mage') {
        critMult += this.charSvc.talentRank('frost_power') * 0.10;
      }
      if (this.charSvc.character().classKey === 'shaman' && this.charSvc.hasEffect('ascendance') && ['lightning_bolt', 'chain_lightning', 'flame_shock', 'earth_shock'].includes(ability.id)) {
        critMult = critMult * 1.25;
      }
      if (this.charSvc.character().classKey === 'rogue') {
        critMult += this.charSvc.talentRank('lethality') * 0.03;
      }
      roll = Math.round(roll * critMult);
    }
    let efCritText = '';
    if (isCrit && this.charSvc.character().classKey === 'shaman' && (ability.id === 'lightning_bolt' || ability.id === 'chain_lightning') && this.charSvc.talentRank('elemental_focus') > 0) {
      const efMax = this.charSvc.getMaelstromMax();
      this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(efMax, (c.comboPoints || 0) + 1) }));
      efCritText = ' · +1 Maelstorm (crit)';
    }
    if ((isRage || isEnergy) && this.charSvc.warriorStance() === 'battle') {
      const battleMult = 1.10 + this.charSvc.talentRank('improved_stances') * 0.02;
      roll = Math.round(roll * battleMult);
    }
    if (ability.id === 'charge' && this.charSvc.character().classKey === 'warrior') {
      const icRank = this.charSvc.talentRank('improved_charge');
      if (icRank > 0) {
        const hs = this.charSvc.unlockedAbilities().find((a: any) => a.id === 'heroic_strike');
        const hsAvg = hs ? Math.round((((hs as any).currentMin || 0) + ((hs as any).currentMax || 0)) / 2) : 20;
        roll += Math.round(hsAvg * 0.15 * icRank);
      }
    }

    let comboSpent = 0;
    if (ability.spendsCombo) {
      comboSpent = this.charSvc.character().comboPoints || 0;
      const equinoxRank = this.charSvc.talentRank('equinox');
      const fragPower = 0.30 * (1 + equinoxRank * 0.10);
      const aoeMult = ability.aoe ? 0.5 : 1.0;
      roll = Math.round(roll * (1 + (comboSpent) * fragPower * aoeMult));
      this.charSvc.character.update(c => {
        const ftRank = this.charSvc.talentRank('finishing_touch');
        if (ftRank > 0) {
          const comboMax = this.charSvc.getMaelstromMax();
          return {
            ...c,
            comboPoints: Math.min(comboMax, 1),
            currentEnergy: Math.min(this.charSvc.resourceMax(), (c.currentEnergy || 0) + 15),
          };
        }
        return { ...c, comboPoints: 0 };
      });
    }

    let sunShardsSpent = 0;
    if (ability.spendsSunShards) {
      sunShardsSpent = this.charSvc.getSunShards() || 0;
      const equinoxRank = this.charSvc.talentRank('equinox');
      const fragPower = 0.30 * (1 + equinoxRank * 0.10);
      const aoeMult = ability.aoe ? 0.5 : 1.0;
      roll = Math.round(roll * (1 + (sunShardsSpent) * fragPower * aoeMult));
      this.charSvc.character.update(c => ({ ...c, sunShards: 0 }));
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
          currentMana: Math.min(resourceMax, (c.currentMana ?? resourceMax) + (ability.scaledCost || 0)),
        }));
        return;
      }
      const contribution = this.charSvc.noteContribution();
      const noteAoeMult = (ability.aoe && ability.type === 'damage') ? 0.5 : 1.0;
      roll = Math.round(roll * contribution * noteAoeMult);
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

    const inspiration = this.charSvc.character().activeEffects?.find(e => e.target === 'extra_damage');
    if (inspiration && ability.type === 'damage') {
      roll += inspiration.value;
      boostText += ' · +' + inspiration.value + ' daño (Da Capo)';
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

    let fotwText = '';
    let comboText = '';
    if (ability.generatesCombo) {
      const comboChance = this.charSvc.getEffectiveComboChance(ability);
      if (Math.random() * 100 < comboChance) {
        let comboGen = ability.generatesCombo;
        if (ability.id === 'sinister_strike') {
          const initChance = this.charSvc.talentRank('initiative') * 10;
          if (Math.random() * 100 < initChance) comboGen += 1;
        }
        const comboMax = this.charSvc.getMaelstromMax();
        const newCombo = Math.min(comboMax, (this.charSvc.character().comboPoints || 0) + comboGen);
        this.charSvc.character.update(c => ({ ...c, comboPoints: newCombo }));
        comboText = ' · ' + newCombo + ' ' + (this.charSvc.classConfig().comboConfig
          ? this.charSvc.classConfig().comboConfig!.label.toLowerCase().split(' ')[0]
          : 'combo');
      }
    }
    if (ability.spendsCombo) {
      comboText = ' · ' + comboSpent + ' combo gastados';
    }

    let sunShardText = '';
    if (ability.generatesSunShard) {
      this.charSvc.addSunShard(ability.generatesSunShard);
      const sunShardMax = this.charSvc.sunShardsMax();
      const sunShards = this.charSvc.getSunShards();
      sunShardText = ' · +' + ability.generatesSunShard + ' ☀️ (' + sunShards + '/' + sunShardMax + ')';
    }
    if (ability.spendsSunShards) {
      const sunShardMax = this.charSvc.sunShardsMax();
      sunShardText = ' · ' + sunShardsSpent + ' ☀️ consumidos';
    }
    if (ability.id === 'earth_shock' && this.charSvc.character().classKey === 'shaman') {
      const ssRank = this.charSvc.talentRank('static_shock');
      if (ssRank > 0 && Math.random() * 100 < ssRank * 25) {
        const ssMax = this.charSvc.getMaelstromMax();
        this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(ssMax, (c.comboPoints || 0) + 1) }));
        comboText += ' · +1 Maelstorm (Static Shock)';
      }
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
      const noteAoeMult = (ability.aoe && ability.type === 'damage') ? 0.5 : 1.0;
      noteContributionValue = this.charSvc.noteContribution() * noteAoeMult;
      const notes = this.charSvc.getNotes();
      this.charSvc.clearNotes();
      noteText = ' · ' + notes.length + ' notas consumidas (×' + noteContributionValue.toFixed(1) + ')';
      const maestroRank = this.charSvc.talentRank('maestro');
      if (maestroRank > 0 && Math.random() * 100 < maestroRank * 15) {
        this.charSvc.actionsUsed.update(n => Math.max(0, n - 1));
        noteText += ' · ¡Maestro! +1 accion';
      }
      const improRank = this.charSvc.talentRank('impro');
      if (improRank > 0 && Math.random() * 100 < improRank * 20) {
        const maxNote = this.charSvc.classConfig().comboConfig?.max || 7;
        const newNote = 1 + Math.floor(Math.random() * maxNote);
        this.charSvc.addNote(newNote);
        noteText += ' · ¡Impro! Nueva nota: ' + NOTE_NAMES[newNote - 1];
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
        lunarText = ' · +1 Moon Shard';
      }
      let hotTotal = ability.hotTotal;
      if (evText) {
        const boost = 1 + this.charSvc.talentRank('evangelism') * 0.03;
        hotTotal = Math.round(hotTotal * boost);
      }
      const hotTick = Math.round(hotTotal / ability.hotDuration);
      let germText = '';
      if (ability.id === 'rejuvenation' && this.charSvc.talentRank('germination') > 0) {
        const germTotal = Math.round(hotTotal * 0.5);
        const germTick = Math.max(1, Math.round(germTotal / ability.hotDuration));
        this.charSvc.sendHealEvent({ ...ability, id: 'germination', name: 'Germination', isHot: true, hotDuration: ability.hotDuration }, germTotal);
        germText = ' · 🌸 Germination ' + germTick + '/turno (' + germTotal + ' total, 50%)';
      }
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + hotTick + '/turno · ' +
        ability.hotDuration + 't (' + hotTotal + ' total)' + germText + lunarText + evText + noteText +
        ' — 🩹 HoT sobre ti'
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
      if (ability.id === 'immolate' || ability.id === 'flame_shock') {
        const min = ability.currentMin || 0;
        const max = ability.currentMax || 0;
        const directRoll = min + Math.floor(Math.random() * (max - min + 1));
        const direct = ability.id === 'immolate' ? Math.round(directRoll / 2) : directRoll;
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
          ability.dotDuration + 't (' + displayedTotal + ' total)' + directText + comboText + sunShardText + evText + ' — ' + this.trSvc.t('apply_to_enemy')
        );
        this.charSvc.sendDamageEvent({ ...ability, dotTotal, dotTick }, 0, 1, 1);
      }
    } else if (ability.type === 'heal' && !ability.isHot) {
      let healBonus = 1 + this.charSvc.talentRank('healing_focus') * 0.03;
      let tidalWaveText = '';
      let spiritLinkText = '';
      const spiritLinkActive = this.charSvc.character().classKey === 'shaman' && this.charSvc.hasEffect('spirit_link');
      if (this.charSvc.character().classKey === 'shaman') {
        const twRank = this.charSvc.talentRank('tidal_waves');
        if (twRank > 0 && ability.id === 'chain_heal') {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.target !== 'tidal_waves'),
              { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Tidal Waves', target: 'tidal_waves', value: 10 * twRank, duration: 3, isPercent: false },
            ],
          }));
          tidalWaveText = ' · Tidal Waves: siguiente Healing Wave +' + (10 * twRank) + '%';
        }
        if (ability.id === 'healing_wave' && this.charSvc.hasEffect('tidal_waves')) {
          const twBuff = (this.charSvc.character().activeEffects || []).find(e => e.target === 'tidal_waves');
          if (twBuff) {
            healBonus *= (1 + (twBuff.value || 0) / 100);
            tidalWaveText = ' · Tidal Waves +' + (twBuff.value || 0) + '%';
            this.charSvc.character.update(c => ({
              ...c,
              activeEffects: (c.activeEffects || []).filter(e => e.target !== 'tidal_waves'),
            }));
          }
        }
        if (spiritLinkActive && ability.id === 'chain_heal') {
          healBonus *= 1.20;
          spiritLinkText = ' · 🕸️ Vínculo: +20% curación';
        }
      }
      let healGraceText = '';
      if (this.charSvc.character().classKey === 'shaman' && (ability.id === 'healing_wave' || ability.id === 'chain_heal')) {
        const hgRank = this.charSvc.talentRank('healing_grace');
        if (hgRank > 0) {
          healBonus *= (1 + hgRank * 0.10);
          if (Math.random() * 100 < hgRank * 15) {
            const hgMax = this.charSvc.getMaelstromMax();
            this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(hgMax, (c.comboPoints || 0) + 1) }));
            healGraceText = ' · +1 Maelstorm';
          }
        }
      }
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
        lunarText = ' · +1 Moon Shard';
      }
      const outMult = this.charSvc.healingOutgoingMult();
      const outNote = outMult < 1 ? ' (curas −' + Math.round((1 - outMult) * 100) + '%)' : '';
      if (ability.id === 'power_word_shield') {
        healBonus *= (1 + this.charSvc.talentRank('improved_shield') * 0.10);
        roll = Math.round(roll * healBonus * outMult);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': 🛡️ ' + roll + ' absorcion' +
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + healGraceText + tidalWaveText + noteText + outNote + ' — ' + this.trSvc.t('sent_to_master')
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
        roll = Math.round(roll * healBonus * outMult);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        if (spiritLinkActive && ability.id === 'healing_wave') {
          const replicate = Math.round(roll * 0.30);
          if (replicate > 0) {
            this.charSvc.sendHealEvent({ ...ability, name: ability.name + ' (Spirit Link)' }, replicate);
            spiritLinkText = ' · 🕸️ +' + replicate + ' HP al resto de la party';
          }
        }
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + roll + ' curacion' +
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + healGraceText + tidalWaveText + spiritLinkText + noteText + darkMendingText + outNote + ' — ' + this.trSvc.t('sent_to_master')
        );
        this.charSvc.sendHealEvent(ability, roll);
        if (ability.chain) {
          const chBounces = ability.bounces || 1;
          const chDecay = ability.chainDecay || 0.6;
          for (let b = 1; b <= chBounces; b++) {
            const bHeal = Math.round(roll * Math.pow(chDecay, b));
            this.charSvc.sendHealEvent({ ...ability, name: ability.name + ' (Salto ' + b + ')' }, bHeal);
          }
        }
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
    } else {
      const poisonDmg = this.charSvc.getPoisonDamage();
      if (poisonDmg > 0 && ability.damageType === 'physical') {
        roll += poisonDmg;
      }
      let imbueText = '';
      let chainText = '';
      if (ability.chain) {
        chainText = ' · ⛓️ envía ' + (ability.bounces || 1) + ' impacto(s) extra (rebote)';
      }
      if (ability.id === 'basic_attack' && this.charSvc.character().classKey === 'shaman') {
        const shImbue = (this.charSvc.character().activeEffects || []).find(e => e.target === 'weapon_imbue');
        if (shImbue) {
          if (shImbue.name === 'Arma Lengua de Fuego') {
            const iwiRank = this.charSvc.talentRank('improved_weapon_imbues');
            const imbDmg = Math.round(shImbue.value * (1 + iwiRank * 0.10));
            roll += imbDmg;
            imbueText = ' · 🔥+' + imbDmg + ' fuego';
          } else {
            const wfDisplay = (shImbue.value || 20) + this.charSvc.talentRank('improved_weapon_imbues') * 5;
            imbueText = ' · 💨 Windfury (' + wfDisplay + '%)';
          }
        }
      }
      if (ability.id === 'basic_attack' && this.charSvc.classConfig().abilities) {
        const ebaRank = this.charSvc.talentRank('energetic_basic_attack');
        if (ebaRank > 0 && isEnergy) {
          const energyGen = isCrit ? ebaRank * 4 : ebaRank * 2;
          const resourceMax = this.charSvc.resourceMax();
          this.charSvc.character.update(c => ({
            ...c,
            currentEnergy: Math.min(resourceMax, (c.currentEnergy || 0) + energyGen),
          }));
          rageText = ' · +' + energyGen + ' energia';
        }
        const fotwRank = this.charSvc.talentRank('first_of_the_wild');
        if (fotwRank > 0 && this.charSvc.character().classKey === 'druid') {
          const hpGain = Math.round(this.charSvc.maxHP() * fotwRank * 0.02);
          const manaGain = Math.round(this.charSvc.maxMana() * fotwRank * 0.02);
          const resourceMax = this.charSvc.resourceMax();
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + hpGain),
            currentMana: Math.min(resourceMax, (c.currentMana ?? resourceMax) + manaGain),
          }));
          fotwText = ' · +' + hpGain + ' vida · +' + manaGain + ' maná (First of the Wild)';
        }
      }
      this.charSvc.turnDamage.update(d => d + roll);
      let lifestealText = '';
      if (ability.lifestealPct) {
        const idlRank = this.charSvc.talentRank('improved_drain_life');
        const heal = Math.round(roll * ability.lifestealPct * (1 + idlRank * 0.10));
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + heal),
        }));
        lifestealText = ' · +' + heal + ' vida';
      }
      if (ability.id === 'basic_attack' && this.charSvc.selectedCapstone() === 'hope_and_grace') {
        const graceHeal = Math.round(roll * 0.30);
        if (graceHeal > 0) {
          this.charSvc.sendHealEvent({ ...ability, id: 'hope_and_grace', name: 'Hope and Grace', description: '' }, graceHeal);
          lifestealText += ' · 🕊️ +' + graceHeal + ' vida (Hope and Grace) — ' + this.trSvc.t('sent_to_master');
        }
      }
      const leechPoisonPct = this.charSvc.getLeechPoisonPercent();
      if (leechPoisonPct > 0 && ability.damageType === 'physical') {
        const leechHeal = Math.round(roll * leechPoisonPct / 100);
        if (leechHeal > 0) {
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + leechHeal),
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
              { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Soul Leech', target: 'shield', value: shieldAmt, duration: 3 },
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
      let rendText = '';
      if (ability.id === 'rend') {
        const eff = sendAbility.inflictsEffects && sendAbility.inflictsEffects[0];
        if (eff) {
          const rendDot = (ability as any).currentDotValue || eff.value || 8;
          sendAbility = { ...sendAbility, inflictsEffects: [{ ...eff, value: rendDot }] };
          rendText = ' · 🩸 sangrado ' + rendDot + '/t (' + eff.duration + 't)';
        }
      }
      let sunderText = '';
      if (ability.id === 'sunder_armor') {
        const eff = sendAbility.inflictsEffects && sendAbility.inflictsEffects[0];
        if (eff) {
          const sunderRank = ability.currentRank || 1;
          const shred = (ability.armorShred && ability.armorShred[sunderRank - 1]) || 8;
          sendAbility = { ...sendAbility, inflictsEffects: [{ ...eff, value: shred }] };
          sunderText = ' · 🛡️ armadura −' + shred;
        }
      }
      let woundText = '';
      const woundPct = this.charSvc.getWoundPoisonPercent();
      if (woundPct > 0) {
        const effects = sendAbility.inflictsEffects ? [...sendAbility.inflictsEffects] : [];
        effects.push({ type: 'debuff' as const, name: 'Wound', target: 'healing_received', value: woundPct, duration: 3, debuffType: 'poison' as const, stackable: false });
        woundText = ' · 🩸 Wound −' + woundPct + '% cura (3t)';
        if (this.charSvc.hasEffect('poison_mastery')) {
          effects.push({ type: 'debuff' as const, name: 'Wound (Envenom)', target: 'attackPower', value: 25, duration: 3, debuffType: 'poison' as const, stackable: false });
          woundText += ' · 💀 Envenom: daño enemigo −25% (3t)';
        }
        sendAbility = { ...sendAbility, inflictsEffects: effects };
      }
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + dmgText + imbueText + chainText + igniteText + ccText + rageText + fotwText + comboText + sunShardText + shardText + focusText + conduitText + lifestealText + noteText + evText + boostText + unyieldingText + serpentText + woundText + rendText + sunderText + maelstormText + efCritText
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
      if (ability.id === 'basic_attack' && this.charSvc.character().classKey === 'shaman') {
        const wfImbue = (this.charSvc.character().activeEffects || []).find(e => e.target === 'weapon_imbue' && e.name === 'Arma Viento Furioso');
        const wfChance = wfImbue ? (wfImbue.value || 20) + this.charSvc.talentRank('improved_weapon_imbues') * 5 : 0;
        if (wfImbue && Math.random() * 100 < wfChance) {
          this.charSvc.turnDamage.update(d => d + roll);
          this.charSvc.sendDamageEvent({ ...ability, name: ability.name + ' (Windfury)' }, roll, 1, 1);
          let wfComboText = '';
          const wfComboMax = this.charSvc.getMaelstromMax();
          if (Math.random() * 100 < 20 && (this.charSvc.character().comboPoints || 0) < wfComboMax) {
            this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(wfComboMax, (c.comboPoints || 0) + 1) }));
            wfComboText = ' · +1 Maelstorm';
          }
          this.charSvc.showToast('💨 Windfury! Ataque adicional ' + roll + ' dano' + wfComboText + ' — ' + this.trSvc.t('sent_to_master'));
        }
      }
      if (ability.chain) {
        const chBounces = ability.bounces || 1;
        const chDecay = ability.chainDecay || 0.7;
        for (let b = 1; b <= chBounces; b++) {
          const bRoll = Math.round(roll * Math.pow(chDecay, b));
          this.charSvc.turnDamage.update(d => d + bRoll);
          this.charSvc.sendDamageEvent({ ...ability, name: ability.name + ' (Salto ' + b + ')' }, bRoll, 1, 1);
        }
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
    if (ability.passive) {
      this.charSvc.showToast('Pasiva: ' + ability.name + ' activa');
      return;
    }
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

    if (ability.manaGemRanks) {
      this.charSvc.useAction(actionCost);
      const rank = Math.max(1, this.charSvc.trainedRank(ability.id));
      const entry = ability.manaGemRanks.find((r: any) => r.rank === rank) || ability.manaGemRanks[ability.manaGemRanks.length - 1];
      const gained = Math.round((entry.value || 0) * (1 + this.charSvc.talentRank('improved_mana_gem') * 0.25));
      this.charSvc.character.update(c => ({
        ...c,
        currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + gained),
      }));
      const effCd = this.charSvc.getEffectiveCooldown(ability);
      if (effCd > 0) {
        this.charSvc.character.update(c => {
          if (!c.currentCooldowns) c.currentCooldowns = {};
          c.currentCooldowns[ability.id] = effCd;
          return { ...c };
        });
      }
      this.charSvc.showToast(ability.name + ' R' + rank + ': +' + gained + ' mana');
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

    if (ability.spendsCombo && (this.charSvc.character().comboPoints || 0) === 0) {
      this.charSvc.showToast(this.trSvc.t('no_combo_pts'));
      return;
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
        const rageGain = this.charSvc.getEffectiveRageGain(ability);
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, (c.currentRage || 0) + rageGain),
        }));
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida · +' + rageGain + ' ira');
      } else if (ability.restoresManaPct) {
        const manaGained = Math.round(this.charSvc.maxMana() * ability.restoresManaPct);
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaGained),
        }));
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida · +' + manaGained + ' mana');
      } else {
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida');
      }
      if (ability.buff && ability.buff.applySelf) {
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== ability.name),
            { id: Date.now() + Math.random(), type: 'buff' as const, name: ability.name, target: ability.currentBuffStat, value: ability.currentBuffValue, duration: ability.currentBuffDuration, isPercent: false },
          ],
        }));
        const tickRage = ability.id === 'bloodrage' ? this.charSvc.getBloodrageTickRage() : 0;
        if (tickRage > 0) this.charSvc.showToast('🩸 Blood Rage: +' + tickRage + ' ira/turno durante ' + ability.currentBuffDuration + ' turnos');
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
        const lnlChance = [0, 35, 70, 100][lnlRank] || 0;
        if (Math.random() * 100 < lnlChance) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [...(c.activeEffects || []).filter(e => e.name !== 'Lock and Load'), { id: Date.now(), type: 'buff', name: 'Lock and Load', target: 'lock_and_load', value: 1, duration: 3, isPercent: false }],
          }));
          lnlText = ' · 🧨 Lock and Load: tu siguiente Aimed Shot es Instant';
        }
      }
      this.charSvc.showToast(ability.name + ' R' + fRank + ': trampa AOE -' + slowVal + '% movimiento (3 turnos) — enviado al Master' + lnlText);
      return;
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
    } else if (ability.totem) {
      this.castTotem(ability);
    } else if (ability.weaponImbue) {
      this.castWeaponImbue(ability);
    } else if (ability.id === 'demonic_sacrifice') {
      this.castDemonicSacrifice(ability);
    } else if (ability.id === 'holy_nova') {
      this.castHolyNova(ability);
    } else if (ability.id === 'dark_star') {
      this.castDarkStar(ability);
    } else if (ability.id === 'finale') {
      this.castFinale(ability);
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
    } else if (ability.id === 'colossus_smash') {
      this.castColossusSmash(ability);
    } else if (ability.id === 'recklessness') {
      this.castRecklessness(ability);
    } else if (ability.id === 'combustion') {
      this.castCombustion(ability);
    } else if (ability.id === 'icy_veins') {
      this.castIcyVeins(ability);
    } else if (ability.id === 'arcane_power') {
      this.castArcanePower(ability);
    } else if (ability.id === 'ascendance') {
      this.castAscendance(ability);
    } else if (ability.id === 'bloodlust') {
      this.castBloodlust(ability);
    } else if (ability.id === 'spirit_link_totem') {
      this.castSpiritLink(ability);
    } else if (ability.id === 'nature_guardian') {
      const moonMax = this.charSvc.getMaelstromMax();
      const sunMax = this.charSvc.sunShardsMax();
      this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(moonMax, (c.comboPoints || 0) + 2), sunShards: Math.min(sunMax, (c.sunShards || 0) + 2) }));
      this.charSvc.showToast(this.trSvc.t('druid_nature_guardian_toast'));
    } else if (ability.id === 'unsummon_pet') {
      this.charSvc.dismissPet();
    } else if (ability.id === 'life_tap') {
      const manaGained = ability.currentBuffValue;
      const healthLost = manaGained;
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.max(1, hpActual - healthLost),
        currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaGained),
      }));
      this.charSvc.showToast(ability.name + ' R' + ability.currentRank + ': -' + healthLost + ' vida · +' + manaGained + ' mana');
    } else if (ability.buff && ability.buff.applySelf) {
      if (ability.id === 'inner_fire') {
        const iifRank = this.charSvc.talentRank('improved_inner_fire');
        const innerVal = Math.round((ability.currentBuffValue || 5) * (1 + iifRank * 0.20));
        const innerAp = Math.round(innerVal * 3);
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== 'Inner Fire' && e.name !== 'Inner Fire (AP)'),
            { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Inner Fire', target: 'armor', value: innerVal, duration: 15, isPercent: false },
            { id: Date.now() + Math.random() + 0.001, type: 'buff' as const, name: 'Inner Fire (AP)', target: 'attackPower', value: innerAp, duration: 15, isPercent: false },
          ],
        }));
        this.charSvc.showToast('🔥 Inner Fire: +' + innerVal + ' Armor · +' + innerAp + ' Attack Power (15 turnos)');
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
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_battle_shout') * 0.06));
      }
      if (ability.id === 'power_word_shield') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_shield') * 0.10));
      }
      if (ability.id === 'power_word_fortitude') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_fortitude') * 0.15));
      }
      if (ability.id === 'frost_armor') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('improved_frost_armor') * 0.15));
      }
      const effectType = ability.buff.isHot ? 'hot' : 'buff';
      let sndDuration = ability.currentBuffDuration;
      if (ability.id === 'slice_and_dice') {
        sndDuration = sndComboSpent + this.charSvc.talentRank('improved_slice_and_dice') * 1;
      }
      const poisonBuffTargets = ['poisonDamage', 'leechPoison', 'woundPoison'];
      const poisonClearTargets = poisonBuffTargets.includes(ability.currentBuffStat)
        ? poisonBuffTargets.filter(t => t !== ability.currentBuffStat)
        : [];
      this.charSvc.character.update(c => ({
        ...c,
        ...(ability.id === 'slice_and_dice' ? { comboPoints: 0 } : {}),
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== ability.name && (poisonClearTargets.length > 0 ? !poisonClearTargets.includes(e.target) : true)),
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
        this.charSvc.showToast('🎯 Inner Focus: durante 3 turnos tu próximo hechizo no cuesta maná y tiene +25% de crítico');
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
      if (this.charSvc.simMode()) {
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: [
            ...(c.activeEffects || []).filter(e => e.name !== ability.name),
            {
              id: Date.now() + Math.random(),
              type: 'buff' as const,
              name: ability.name,
              target: ability.currentBuffStat,
              value: buffValue,
              duration: ability.currentBuffDuration,
              isPercent: ability.buff.isPercent || false,
            },
          ],
        }));
        this.charSvc.showToast(ability.name + ' R' + ability.currentRank + ': ' + buffText + ' (self · SIM)');
      } else {
        this.charSvc.sendBuffEvent(ability, buffValue);
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + buffText + ' — ' + this.trSvc.t('sent_to_master')
        );
      }
      if (ability.id === 'da_capo' && this.charSvc.selectedCapstone() === 'improved_da_capo') {
        const spiritByRank = [0, 3, 6, 9];
        const spiritBase = spiritByRank[ability.currentRank] || spiritByRank[spiritByRank.length - 1];
        const spiritValue = Math.round(spiritBase * this.charSvc.noteContribution());
        const spiritDuration = ability.currentBuffDuration;
        if (this.charSvc.simMode()) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== 'Improved Da Capo'),
              {
                id: Date.now() + Math.random(),
                type: 'buff' as const,
                name: 'Improved Da Capo',
                target: 'espiritu',
                value: spiritValue,
                duration: spiritDuration,
                isPercent: false,
              },
            ],
          }));
        } else {
          this.charSvc.sendBuffEvent({
            name: 'Improved Da Capo',
            currentRank: ability.currentRank,
            currentBuffStat: 'espiritu',
            currentBuffValue: spiritValue,
            currentBuffDuration: spiritDuration,
            buff: { isPercent: false },
            aoe: true,
          });
        }
        this.charSvc.showToast('🎺 Improved Da Capo: +' + spiritValue + ' Espíritu a todo el grupo (' + spiritDuration + ' turnos)');
      }
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
        const improRank = this.charSvc.talentRank('impro');
        if (improRank > 0 && Math.random() * 100 < improRank * 20) {
          const maxNote = this.charSvc.classConfig().comboConfig?.max || 7;
          const newNote = 1 + Math.floor(Math.random() * maxNote);
          this.charSvc.addNote(newNote);
          this.charSvc.showToast('¡Impro! Nueva nota: ' + NOTE_NAMES[newNote - 1]);
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
      return { ...c, currentHP: maxHP, comboPoints: 0, musicalNotes: [], soulShards: pocket, currentCooldowns: {}, activeEffects: effects, infernalTurnsLeft: 0, fireTotem: null, waterTotem: null };
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
    if (type === 'focus') return 'linear-gradient(180deg, #ffa94d 0%, #cc7000 100%)';
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
    if (classKey === 'warrior' && this.charSvc.character().level >= 8) {
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
