import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { FirebaseService } from '../../services/firebase.service';
import { TranslationService } from '../../services/translation.service';
import { SimCombatService } from '../../services/sim-combat.service';
import { onChildAdded, ref, off } from 'firebase/database';
import { ClassRegistryService } from '../../services/class-registry.service';
import {
  STAT_KEYS, STAT_ICONS, STAT_ABBR, EFFECT_TYPES, BUFF_DEBUFF_STATS,
  DEBUFF_TYPES, debuffColor,
  NOTE_NAMES, NOTE_COLORS,
  STATUS_OPTIONS, HOT_DOT_TARGETS, EQUIPMENT_SLOTS, MAX_LEVEL,
  xpForLevel,
} from '../../data/game-data';
import { MOB_SYMBOLS } from '../../data/mob-symbols';
import { StatKey, ActiveEffect, EquipmentItem, EffectType, CharacterClass, ElementalOrb } from '../../models/game.models';
import { SKILLS, SKILL_CATEGORIES, computeSkills, skillCapFor, SkillDef } from '../../data/skills';
import { classAbilityHooks, classSpellHooks } from '../../classes/hooks/registry';
import type { ClassHooksContext, PlayerLink } from '../../classes/hooks/class-hooks';
import type { SpellCastContext, SpellHooks } from '../../classes/hooks/spell-hooks';

const ORB_SYMBOLS: Record<ElementalOrb, string> = {
  fire: '🔥',
  frost: '❄️',
  arcane: '✨',
};

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
  STAT_ABBR = STAT_ABBR;
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

  showTalentModal = signal(false);
  showStatsModal = signal(false);
  showEquipment = signal(false);
  showLoadModal = signal(false);
  showSaveConfirm = signal(false);
  pendingEndTurn = signal(false);
  savedCharacters = signal<{ key: string; name: string; classKey: string; level: number; savedAt: number }[]>([]);
  showEffectsPanel = signal(true);
  hoveredTalent = signal<any>(null);
  hoveredAbility = signal<any>(null);
  xpInputAmount = signal(0);
  hpLossAmount = signal(0);
  hpActionType = signal('magical');
  levelUpFlash = signal(false);
  abilityRolls = signal<Record<string, { roll: number; crit: boolean }>>({});
  incomingMasterMsg = signal('');
  partyFrames = signal<{ name: string; initials: string }[]>([]);
  selectedHealTarget = signal<string | null>(null);
  valkFallen = signal(false);

  private playerEventUnsub: (() => void) | null = null;
  private partyListUnsub: (() => void) | null = null;

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
  portraitUrl = computed(() => this.charSvc.characterAvatarPaths().vertical);
  heroSkills = computed(() => computeSkills(this.charSvc.character().level, this.charSvc.character().classKey, this.charSvc.character().name || ''));
  heroSkillCap = computed(() => skillCapFor(this.charSvc.character().level));
  skillCategories = SKILL_CATEGORIES;

  skillsOfCategory(category: string): SkillDef[] {
    return SKILLS.filter((s) => s.category === category);
  }

  skillPct(skillId: string): number {
    const cap = this.heroSkillCap();
    return cap > 0 ? Math.round(((this.heroSkills()[skillId] || 0) / cap) * 100) : 0;
  }

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
    this.charSvc.registerPlayer();
    this.initPlayerEventListener();
    this.initPartyFrames();
  }

  ngOnDestroy() {
    this.playerEventUnsub?.();
    this.partyListUnsub?.();
  }

  initPartyFrames() {
    try {
      this.partyListUnsub = this.firebase.onValue('players', (data) => {
        const myName = (this.charSvc.character().name || '').trim().toLowerCase();
        const list: { name: string; initials: string }[] = [];
        if (data && typeof data === 'object') {
          for (const val of Object.values(data) as any[]) {
            const n = String(val?.name || '').trim();
            if (!n || val?.isPet) continue;
            if (myName && n.toLowerCase() === myName) continue;
            list.push({ name: n, initials: this.partyInitials(n) });
          }
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.partyFrames.set(list);
        const sel = this.selectedHealTarget();
        if (sel && !list.some(m => m.name === sel)) {
          this.selectedHealTarget.set(null);
        }
      });
    } catch {
      this.partyFrames.set([]);
    }
  }

  partyInitials(name: string): string {
    const letters = name.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    return (letters || name).toUpperCase().slice(0, 3);
  }

  toggleHealTarget(name: string) {
    this.selectedHealTarget.update(t => t === name ? null : name);
  }

  initPlayerEventListener() {
    try {
      const db = this.firebase.getDb();
      const cb = onChildAdded(ref(db, 'playerEvents'), (snapshot) => {
        const event = snapshot.val();
        const myName = (this.charSvc.character().name || '').trim().toLowerCase();
        const targetName = (event?.target || '').trim().toLowerCase();
        if (!myName || !targetName) return;

        const petNames: string[] = [];
        const activePet = this.charSvc.activePetData();
        const companionPet = this.charSvc.companionPetData();
        if (activePet) petNames.push(myName + ' — ' + activePet.name.toLowerCase());
        if (companionPet) petNames.push(myName + ' — ' + companionPet.name.toLowerCase());
        const isPetTarget = petNames.includes(targetName);

        if (!isPetTarget && myName !== targetName) return;

        if (isPetTarget) {
          if (event.type === 'heal') {
            if (companionPet && targetName === myName + ' — ' + companionPet.name.toLowerCase()) {
              this.charSvc.character.update(c => ({
                ...c,
                companionPet: c.companionPet ? { ...c.companionPet, currentHP: Math.min(this.charSvc.companionPetMaxHP(), c.companionPet.currentHP + event.amount) } : null,
              }));
            } else if (activePet) {
              this.charSvc.character.update(c => ({
                ...c,
                activePet: c.activePet ? { ...c.activePet, currentHP: Math.min(this.charSvc.petMaxHP(), c.activePet.currentHP + event.amount) } : null,
              }));
            }
            this.charSvc.syncPetStatus();
            this.incomingMasterMsg.set('💚 ' + (event.abilityName || 'Master') + ': +' + event.amount + ' HP (pet)');
          } else if (event.type === 'damage' || event.type === 'monsterAttack') {
            this.charSvc.petTakeDamage(event.amount, targetName);
            this.incomingMasterMsg.set('💢 ' + (event.abilityName || 'Master') + ': -' + event.amount + ' danyo (pet)');
          }
          this.firebase.removeData('playerEvents/' + snapshot.key);
          setTimeout(() => this.incomingMasterMsg.set(''), 4000);
          return;
        }

        if (event.type === 'heal') {
          if (this.charSvc.isDead() && event.ignoreDeath) {
            const reviveHP = Math.max(1, event.amount || 200);
            this.charSvc.character.update(c => ({ ...c, currentHP: reviveHP }));
            let buffText = '';
            if (event.buffAp || event.buffSp) {
              const dur = event.buffDuration || 2;
              const nameBase = event.abilityName || 'Revive';
              const buffs = (this.charSvc.character().activeEffects || [])
                .filter((e: any) => e.name === nameBase + ' (AP)' || e.name === nameBase + ' (SP)');
              this.charSvc.character.update(c => ({
                ...c,
                activeEffects: [
                  ...(c.activeEffects || []).filter((e: any) => !buffs.includes(e)),
                  ...(event.buffAp ? [{ id: Date.now() + Math.random(), type: 'buff' as const, name: nameBase + ' (AP)', target: 'attackPower', value: event.buffAp, duration: dur, isPercent: false }] : []),
                  ...(event.buffSp ? [{ id: Date.now() + Math.random() + 0.001, type: 'buff' as const, name: nameBase + ' (SP)', target: 'spellPower', value: event.buffSp, duration: dur, isPercent: false }] : []),
                ],
              }));
              buffText = ' y +' + event.buffAp + ' AP / +' + event.buffSp + ' SP (' + dur + ' turnos)';
            }
            if (this.charSvc.character().classKey === 'valkyrie') this.valkFallen.set(false);
            this.charSvc.syncPlayerStatus();
            this.incomingMasterMsg.set('🌿 ' + (event.abilityName || 'Master') + ': revives con ' + reviveHP + ' HP' + buffText);
          } else if (this.charSvc.isDead()) {
            this.charSvc.showToast('☠️ Estas muerto: la curacion no tiene efecto. Usa Full Rest para revivir.');
            this.incomingMasterMsg.set('☠️ ' + (event.abilityName || 'Master') + ': curacion ignorada, estas muerto');
          } else {
            const healMult = this.charSvc.healingReceivedMult();
            const applied = healMult < 1 ? Math.max(0, Math.round((event.amount || 0) * healMult)) : (event.amount || 0);
            this.charSvc.adjustHP(applied);
            const reducedNote = healMult < 1 ? ' (cura reducida −' + Math.round((1 - healMult) * 100) + '%)' : '';
            this.incomingMasterMsg.set('💚 ' + (event.abilityName || 'Master') + ': +' + applied + ' HP' + reducedNote);
          }
        } else if (event.type === 'mana') {
          if (this.charSvc.resourceConfig().type === 'mana') {
            const maxMana = this.charSvc.maxMana();
            this.charSvc.character.update(c => ({
              ...c,
              currentMana: Math.min(maxMana, (c.currentMana ?? maxMana) + (event.amount || 0)),
            }));
            this.incomingMasterMsg.set('💠 ' + (event.abilityName || 'Master') + ': +' + (event.amount || 0) + ' maná');
          }
        } else if (event.type === 'damage') {
          this.charSvc.adjustHP(-event.amount);
          if (this.charSvc.character().classKey === 'valkyrie') {
            const rageMax = this.charSvc.resourceMax();
            const rageNow = this.charSvc.resourceActual();
            this.charSvc.character.update(c => ({
              ...c,
              currentRage: Math.min(rageMax, rageNow + this.valkyrieHitRage()),
            }));
            this.valkyrieDeathCheck();
          }
          this.incomingMasterMsg.set('💢 ' + (event.abilityName || 'Master') + ': -' + event.amount + ' daño');
          this.exitStealth();
        } else if (event.type === 'monsterAttack') {
          this.hpAction(event.amount, event.damageType || 'physical');
          this.exitStealth();
          let effText = '';
          if (this.charSvc.character().classKey === 'valkyrie') {
            const shieldGain = this.valkyrieAbsorbAmount(event.amount, event.damageType);
            if (shieldGain > 0) effText += ' · 🛡️ Carga de escudo +' + shieldGain;
          }
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
        } else if (event.type === 'instant25') {
          this.instantLevel25();
          this.incomingMasterMsg.set('⚡ Master: subido a nivel 25');
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

  mageOrbSlot(index: number): string {
    const orb = this.charSvc.mageOrbAt(index);
    return orb ? ORB_SYMBOLS[orb] : '';
  }

  mageOrbClass(index: number): string {
    return this.charSvc.mageOrbAt(index) || 'empty';
  }

  elementalOrbsTitle(): string {
    const passive = this.charSvc.classConfig().abilities.find((a: any) => a.id === 'elemental_orbs');
    return passive?.description || 'Orbes Elementales';
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

  onNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.charSvc.character.update(c => ({ ...c, name: value }));
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

  instantLevel25() {
    this.charSvc.character.update(c => ({ ...c, level: 25, currentXP: 0 }));
    this.charSvc.upgradeStarterWeaponsToLevel25();
    this.charSvc.equipTestGear();
    this.charSvc.syncPlayerStatus();
    this.charSvc.showToast('Test Gear equipado: +1 Fza · +1 Agi · +1 Int · +3 Aguante · +2 Espiritu · +3 armadura (pecho y manos)');
  }

  changeStance(stance: string) {
    const previous = this.charSvc.warriorStance();
    if (previous === stance) return;
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast(this.trSvc.t('no_actions_stance'));
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.warriorStance.set(stance);
    const bfRank = this.charSvc.talentRank('battle_flow');
    if (bfRank > 0) {
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => !(e.target === 'stance_flow' && e.stanceId === stance)),
          {
            id: Date.now() + Math.random(),
            type: 'buff' as const,
            name: 'Battle Flow',
            target: 'stance_flow',
            value: 0,
            duration: bfRank,
            stanceId: previous,
          },
        ],
      }));
      const stanceLabel = this.charSvc.classConfig().stances?.find((s: any) => s.id === previous)?.name || previous;
      this.charSvc.showToast('Battle Flow: conservas el beneficio de ' + stanceLabel + ' (' + bfRank + (bfRank > 1 ? ' turnos)' : ' turno)'));
    }
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
        const sacrificePct = 10 * grimoireRank;
        const sacrifice = Math.round(this.charSvc.petMaxHP() * sacrificePct / 100);
        // Si el sacrificio mata al Imp, no llega a dar el buff
        const impDies = sacrifice > 0 && sacrifice >= this.charSvc.petHP();
        const toastParts: string[] = [];
        if (!impDies && ability.currentBuffValue) {
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
          toastParts.push('+' + ability.currentBuffValue + ' Aguante al grupo');
        }
        if (sacrifice > 0) {
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
          toastParts.push('el Imp pierde ' + sacrifice + ' vida (' + sacrificePct + '%)' + (impDies ? ' y desaparece' : '') + ' · AOE');
        }
        this.charSvc.showToast(ability.name + ' R' + (ability.currentRank || 1) + ': ' + toastParts.join(' · ') + ' — enviado al Master');
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
      if ((payload.damageType || '') === 'mana' && this.charSvc.resourceConfig().type === 'mana' && (payload.damage || 0) > 0) {
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + payload.damage),
        }));
        this.simCombat.pushLog(`+${payload.damage} maná ${payload.ability || 'Maná'}`);
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
    const misfireEff = (enemy.effects || []).find((e: any) => e.type === 'debuff' && (e.target === 'misfire_chance' || e.stat === 'misfire_chance'));
    if (misfireEff && (misfireEff.value || 0) > 0 && Math.random() * 100 < (misfireEff.value || 0)) {
      this.simCombat.pushLog(`✨ ${enemy.name}: ${atk.name} falla (${misfireEff.name} — ${misfireEff.value}%)`);
      return;
    }
    if (atk.inflictsEffects) {
      this.simCombat.applyEffectsToEnemy(enemy, atk.inflictsEffects, { player: enemy.name, ability: atk.name });
      this.simCombat.enemy.update((e) => ({ ...(e as any), effects: enemy.effects.map((x: any) => ({ ...x })) }));
    }
    this.hpAction(atk.roll, atk.damageType);
  }

  onEndTurnClick() {
    const remaining = this.charSvc.maxActions() - this.charSvc.actionsUsed();
    if (remaining > 0) {
      this.pendingEndTurn.set(true);
      return;
    }
    this.endTurn();
  }

  confirmEndTurn() {
    this.pendingEndTurn.set(false);
    this.endTurn();
  }

  endTurn() {
    const oldTurn = this.charSvc.turnNumber();
    this.processEffects();

    if (this.charSvc.character().classKey === 'mage') {
      const snacks = this.charSvc.talentRank('combat_snacks');
      if (snacks > 0) {
        const hpSnack = Math.round(this.charSvc.maxHP() * 0.005 * snacks);
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

    if (this.charSvc.character().classKey === 'druid') {
      const sorRank = this.charSvc.talentRank('stone_of_rhythms');
      if (sorRank > 0 && (this.charSvc.getSunShards() || 0) > 0 && Math.random() * 100 < sorRank * 15) {
        const manaGain = Math.round(this.charSvc.maxMana() * 0.10);
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: Math.min(this.charSvc.maxMana(), (c.currentMana ?? this.charSvc.maxMana()) + manaGain),
          sunShards: (c.sunShards || 0) - 1,
        }));
        this.charSvc.showToast('🎶 Stone of Rhythms: −1 Sun Shard · +' + manaGain + ' maná (10%)');
      }
    }

    this.charSvc.nextTurn();
    this.charSvc.syncPlayerStatus();
    const resType = this.charSvc.resourceConfig().type;
    if (resType === 'rage') {
      this.charSvc.showToast(this.trSvc.t('end_turn') + ' ' + oldTurn);
    } else if (resType === 'energy') {
      const regen = Math.round((this.charSvc.resourceConfig().regen || 20) * (1 + this.charSvc.talentRank('vitality') * 0.1)) + (this.charSvc.hasEffect('blade_flurry') ? 10 : 0);
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
        this.sendDamagePayload({
          player: me,
          ability: 'Tótem Manantial de Maná (Grupal)',
          rank: 1,
          damage: manaAmt,
          damageType: 'mana',
          aoe: true,
          chain: false,
          effects: null,
          turn,
          timestamp: now,
          assigned: false,
        });
        this.charSvc.showToast('💠 Tótem Manantial de Maná: envía +' + manaAmt + ' maná al grupo' + (remaining > 0 ? ' · ' + remaining + ' turnos' : ' · se consume'));
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
          if (this.charSvc.isDead()) continue;
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
    this.charSvc.applyDeathIfDead();
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
    if (this.charSvc.isDead()) return false;
    if (this.charSvc.hasEffect('shield_wall') && this.isCrowdControl(eff)) {
      this.charSvc.showToast('🛡️ Shield Wall: inmune a ' + (eff.name || 'control de masas'));
      return false;
    }
    this.charSvc.addEffect(eff);
    return true;
  }

  valkyrieHitRage(): number {
    return 3 + this.charSvc.talentRank('hate') * 2;
  }

  hitRageGain(): number {
    let gain = this.charSvc.character().classKey === 'valkyrie' ? this.valkyrieHitRage() : 2 + Math.floor(Math.random() * 3);
    if (this.charSvc.inProtectionStance()) gain *= 2;
    return gain;
  }

  valkyrieAbsorbAmount(amount: number, damageType?: string): number {
    if (damageType !== 'magical' || this.charSvc.character().classKey !== 'valkyrie' || !this.charSvc.hasPassive('valk_recover_magic')) return 0;
    const improved = 1 + this.charSvc.talentRank('improved_abs_magic') * 0.05;
    return Math.max(1, Math.round(amount * 0.30 * this.charSvc.valkyrieChargeGainMult() * improved));
  }

  valkyrieAbsorbMagic(amount: number, damageType?: string): number {
    const gain = this.valkyrieAbsorbAmount(amount, damageType);
    if (gain > 0) this.charSvc.addShieldCharge(gain);
    return gain;
  }

  visibleEffects() {
    return (this.charSvc.character().activeEffects || []).filter((e: any) => e.target !== 'flying');
  }

  valkyrieDeathCheck() {
    if (this.charSvc.character().classKey !== 'valkyrie') return;
    if (this.charSvc.hpActual() > 0) return;
    this.valkFallen.set(true);
    this.charSvc.showToast('💀 Has caído en combate');
  }

  hpAction(amount: number, actionType: string) {
    if (amount <= 0) return;
    this.hpLossAmount.set(0);

    if (actionType === 'heal') {
      if (this.charSvc.isDead()) {
        this.charSvc.showToast('☠️ Estas muerto: no puedes recibir curacion. Usa Full Rest para revivir.');
        return;
      }
      const maxHP = this.charSvc.maxHP();
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.min(maxHP, this.charSvc.hpActual() + amount),
      }));
      this.charSvc.showToast('+' + amount + ' ' + this.trSvc.t('health_restored'));
      this.charSvc.syncPlayerStatus();
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
        let energyText = '';
        if (this.charSvc.resourceConfig().type === 'energy') {
          const energyGain = this.charSvc.evasionEnergyGain(this.charSvc.talentRank('endurance'));
          if (energyGain > 0) {
            const resourceMax = this.charSvc.resourceMax();
            this.charSvc.character.update(c => ({
              ...c,
              currentEnergy: Math.min(resourceMax, (c.currentEnergy || 0) + energyGain),
            }));
            energyText = ' · +' + energyGain + ' energía';
          }
        }
        this.charSvc.showToast(this.trSvc.t('evaded') + energyText);
        return;
      }
    }

    this.valkyrieAbsorbMagic(amount, actionType);

    let remaining = amount;
    let absorbedTotal = 0;
    let brokenPieces = 0;
    while (remaining > 0) {
      const effects = this.charSvc.character().activeEffects || [];
      const shield = effects.find(e => e.target === 'shield');
      if (!shield) break;
      if (shield.value >= remaining) {
        const newShieldValue = shield.value - remaining;
        absorbedTotal += remaining;
        remaining = 0;
        if (newShieldValue <= 0) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: (c.activeEffects || []).filter(e => e.id !== shield.id),
          }));
          brokenPieces++;
        } else {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: (c.activeEffects || []).map(e =>
              e.id === shield.id ? { ...e, value: newShieldValue } : e
            ),
          }));
        }
      } else {
        remaining -= shield.value;
        absorbedTotal += shield.value;
        brokenPieces++;
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: (c.activeEffects || []).filter(e => e.id !== shield.id),
        }));
      }
    }
    if (absorbedTotal > 0) {
      if (remaining === 0 && absorbedTotal === amount) {
        this.charSvc.showToast(this.trSvc.t('shield_fully_absorbed'));
      } else {
        this.charSvc.showToast(this.trSvc.t('shield_absorbs') + ' ' + absorbedTotal + (brokenPieces > 1 ? ' · ' + brokenPieces + ' escudos rotos' : (brokenPieces === 1 ? ' · 1 escudo roto' : '')));
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
        const rageGain = this.hitRageGain();
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
      this.charSvc.applyDeathIfDead();
      this.valkyrieDeathCheck();
    }
    this.charSvc.syncPlayerStatus();
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
      cost = Math.round((cost || 0) * 0.5);
    }

    // S0/S1 — contexto del pipeline + coste con descuentos por clase (S1 modifyCost)
    const ctx: SpellCastContext = {
      svc: this.charSvc,
      player: this.buildPlayerLink(),
      t: (key) => this.trSvc.t(key),
      ability,
      resType,
      isRage,
      isEnergy,
      isFocus,
      cost,
      resourceActual: this.charSvc.resourceActual(),
      resourceMax: this.charSvc.resourceMax(),
      manaActual: this.charSvc.manaActual(),
      maelstormFree: this.charSvc.isMaelstormReady() && ability.castType === 'cast',
      lastWillRage: isRage && this.charSvc.isLastWillActive(),
      actionCost: 1,
      clearcast: false,
      roll: 0,
      critChance: 0,
      critMult: 1.5,
      isCrit: false,
      comboSpent: 0,
      sunShardsSpent: 0,
      hotTotal: 0,
      dotTotal: 0,
      dotTick: 0,
      dotDuration: 0,
      healBonus: 0,
      sendAbility: null,
      extraHitCritMult: 1.5,
      texts: {},
    };
    this.runSpellHooks('modifyCost', ability, ctx);
    cost = ctx.cost;
    if (this.charSvc.hasEffect('inner_focus')) {
      cost = 0;
    }

    const maelstormFree = ctx.maelstormFree;
    const resourceActual = this.charSvc.resourceActual();
    const resourceMax = this.charSvc.resourceMax();
    const manaActual = this.charSvc.manaActual();
    const cd = this.charSvc.getCooldown(ability.id);
    const lastWillRage = isRage && this.charSvc.isLastWillActive();

    if (!lastWillRage && resourceActual < cost) {
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
    ctx.actionCost = actionCost;

    // S2 — gates (CDs, acciones, instantes, stealth, shards, combo) + S3 valkyrie (pool + overrides)
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

    // S3 — valkyrie pool + flujos completos (valk_mending, valk_lightning_bolt, gates odins/vuelo)
    if (this.runSpellHooksCast('castSpell', ability, ctx)) {
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

    // S4 — gasto de recurso real (acción, maná, rage/Pool/combo/shards) + refunds/tipos (onSpend)
    this.charSvc.useAction(actionCost);
    this.runSpellHooks('onSpend', ability, ctx);

    const clearcast = (isRage || isEnergy || isFocus) ? false : this.charSvc.checkClearcasting();
    ctx.clearcast = clearcast;

    if (isRage) {
      if (lastWillRage) {
        const hpCost = Math.max(1, Math.round(this.charSvc.maxHP() * cost / 200));
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.max(1, this.charSvc.hpActual() - hpCost),
        }));
        this.charSvc.syncPlayerStatus();
      } else {
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, resourceActual - cost),
        }));
      }
    } else if (isEnergy) {
      this.charSvc.character.update(c => ({
        ...c,
        currentEnergy: Math.max(0, resourceActual - cost),
      }));
      let deathlinessText = '';
      if ((ability.id === 'garrote' || ability.id === 'ambush') && this.charSvc.talentRank('deathliness') > 0) {
        const refund = this.charSvc.deathlinessRefund(cost);
        if (refund > 0) {
          this.charSvc.character.update(c => ({
            ...c,
            currentEnergy: Math.min(resourceMax, (c.currentEnergy || 0) + refund),
          }));
          deathlinessText = ' · 💀 +' + refund + ' energía (Deathliness)';
        }
      }
      if (deathlinessText) this.charSvc.showToast(ability.name + deathlinessText);
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

    // S5 — tirada base + mods planos por clase (modifyRoll)
    const min = ability.currentMin || 0;
    const max = ability.currentMax || 0;
    let roll = min + Math.floor(Math.random() * (max - min + 1));
    ctx.roll = roll;
    this.runSpellHooks('modifyRoll', ability, ctx);
    roll = ctx.roll;
    let critChance = parseFloat((isRage || isEnergy || isFocus) ? this.charSvc.meleeCrit() : this.charSvc.spellCrit());
    ctx.critChance = critChance;
    this.runSpellHooks('modifyCritChance', ability, ctx);
    critChance = ctx.critChance;
    if (ability.school === 'Fuego' && this.charSvc.hasEffect('combustion')) {
      critChance += 50;
    }
    if (this.charSvc.hasEffect('inner_focus')) {
      critChance += 25;
    }
    const isCrit = Math.random() * 100 < critChance;
    ctx.isCrit = isCrit;
    if (isCrit) {
      let critMult = 1.5;
      ctx.critMult = critMult;
      this.runSpellHooks('critMultEarly', ability, ctx);
      if (this.charSvc.hasEffect('demonic_form')) {
        ctx.critMult = ctx.critMult * 1.25;
      }
      if (this.charSvc.hasEffect('recklessness')) {
        ctx.critMult = ctx.critMult * 1.20;
      }
      if (this.charSvc.hasEffect('arcane_power')) {
        ctx.critMult = ctx.critMult * 1.25;
      }
      this.runSpellHooks('critMultLate', ability, ctx);
      critMult = ctx.critMult;
      roll = Math.round(roll * critMult);
    }
    // S7 — extras justo tras el crítico (onCrit) + postura genérica + extras post-postura (onRollReady)
    ctx.roll = roll;
    this.runSpellHooks('onCrit', ability, ctx);
    roll = ctx.roll;
    if ((isRage || isEnergy) && this.charSvc.inBattleStance()) {
      const battleMult = 1.10 + this.charSvc.talentRank('improved_stances') * 0.02;
      roll = Math.round(roll * battleMult);
    }
    ctx.roll = roll;
    this.runSpellHooks('onRollReady', ability, ctx);
    roll = ctx.roll;

    let comboSpent = 0;
    if (ability.spendsCombo) {
      comboSpent = this.charSvc.character().comboPoints || 0;
      ctx.comboSpent = comboSpent;
      ctx.roll = roll;
      this.runSpellHooks('modifyComboSpend', ability, ctx);
      roll = ctx.roll;
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
      const fragPower = 0.30 * (1 + equinoxRank * 0.15);
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

    const inspiration = this.charSvc.character().activeEffects?.find(e => e.target === 'extra_damage');
    if (inspiration && ability.type === 'damage') {
      roll += inspiration.value;
      boostText += ' · +' + inspiration.value + ' daño (Da Capo)';
    }

    const natureBoost = this.charSvc.character().activeEffects?.find(e => e.target === 'nature_boost');
    let natureBoostText = '';
    if (natureBoost && ability.type === 'damage' && ability.school === 'Naturaleza') {
      roll = Math.round(roll * (1 + natureBoost.value / 100));
      natureBoostText = ' · ⛈️ +' + natureBoost.value + '% Naturaleza';
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: (c.activeEffects || []).filter(e => e !== natureBoost),
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

    let fotwText = '';
    let comboText = '';
    if (ability.generatesCombo) {
      const comboChance = this.charSvc.getEffectiveComboChance(ability);
      if (Math.random() * 100 < comboChance) {
        let comboGen = ability.generatesCombo;
        if (ability.id === 'sinister_strike') {
          const initChance = this.charSvc.talentRank('initiative') * 12;
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
    if (ability.modulateNotes || (ability.id === 'arpeggio' && this.charSvc.talentRank('agudo') > 0)) {
      this.charSvc.modulateNotes(ability.modulateNotes || 1);
      noteText = ' · Notas +1 tono';
    }
    let noteContributionValue = 0;
    if (ability.spendsNotes) {
      noteContributionValue = this.charSvc.noteContribution();
      const notes = this.charSvc.getNotes();
      this.charSvc.clearNotes();
      noteText = ' · ' + notes.length + ' notas consumidas (×' + noteContributionValue.toFixed(1) + ')';
      const maestroRank = this.charSvc.talentRank('maestro');
      if (maestroRank > 0 && Math.random() * 100 < maestroRank * 35) {
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
      let hotTotal = ability.hotTotal;
      if (evText) {
        const boost = 1 + this.charSvc.talentRank('evangelism') * 0.03;
        hotTotal = Math.round(hotTotal * boost);
      }
      const hotTick = Math.round(hotTotal / ability.hotDuration);
      // S9 — HoT (onHot): lunar_healing, germination (druid)
      ctx.hotTotal = hotTotal;
      this.runSpellHooks('onHot', ability, ctx);
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + hotTick + '/turno · ' +
        ability.hotDuration + 't (' + hotTotal + ' total)' + (ctx.texts['germ'] || '') + (ctx.texts['lunar'] || '') + evText + noteText +
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
      // S9 — DoT (onDot): immolate/flame_shock base directo
      this.runSpellHooks('onDot', ability, ctx);
      const directText = ctx.texts['direct'] || '';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + dotTick + '/turno · ' +
        ability.dotDuration + 't (' + displayedTotal + ' total)' + directText + comboText + sunShardText + evText + ' — ' + this.trSvc.t('apply_to_enemy')
      );
      this.charSvc.sendDamageEvent({ ...ability, dotTotal, dotTick }, 0, 1, 1);
    } else if (ability.type === 'heal' && !ability.isHot) {
      // S9 — heal (onHeal): healBonus por clase (priest/shaman/bard/druid) y textos
      ctx.healBonus = 1 + this.charSvc.talentRank('healing_focus') * 0.05;
      this.runSpellHooks('onHeal', ability, ctx);
      const healBonus = ctx.healBonus;
      let tidalWaveText = ctx.texts['tidal'] || '';
      let spiritLinkText = ctx.texts['spirit'] || '';
      let healGraceText = ctx.texts['healGrace'] || '';
      let lunarText = ctx.texts['lunar'] || '';
      const spiritLinkActive = this.charSvc.character().classKey === 'shaman' && this.charSvc.hasEffect('spirit_link');
      const outMult = this.charSvc.healingOutgoingMult();
      const outNote = outMult < 1 ? ' (curas −' + Math.round((1 - outMult) * 100) + '%)' : '';
      const selHealTarget = this.selectedHealTarget();
      const mySelfName = (this.charSvc.character().name || '').trim().toLowerCase();
      const healTarget = selHealTarget && !ability.aoe && selHealTarget.toLowerCase() !== mySelfName ? selHealTarget : null;
      const healTargetNote = healTarget ? ' → ' + healTarget : '';
      if (ability.id === 'power_word_shield') {
        roll = Math.round(roll * healBonus * outMult);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': 🛡️ ' + roll + ' absorcion' +
          (isCrit ? ' ¡CRITICO!' : '') + healTargetNote + ccText + evText + lunarText + healGraceText + tidalWaveText + noteText + outNote + ' — ' + this.trSvc.t('sent_to_master')
        );
        this.charSvc.sendHealEvent(ability, roll, healTarget || undefined);
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
          (isCrit ? ' ¡CRITICO!' : '') + healTargetNote + ccText + evText + lunarText + healGraceText + tidalWaveText + spiritLinkText + noteText + darkMendingText + outNote + ' — ' + this.trSvc.t('sent_to_master')
        );
        this.charSvc.sendHealEvent(ability, roll, healTarget || undefined);
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
        roll += Math.round(poisonDmg);
      }
      // S9 — damage (onDamage): mods por clase pre-toast (imbue, generacion de
      // energia/ira, hope_and_grace, soul_leech, ignite, deep_wounds, serpent/rend/
      // sunder, valk charge/taunt, orbes elementales, storm_strike, static_shock)
      ctx.roll = roll;
      ctx.sendAbility = ability;
      this.runSpellHooks('onDamage', ability, ctx);
      roll = ctx.roll;
      let sendAbility = ctx.sendAbility;
      comboText += (ctx.texts['staticShock'] || '');
      if (!ability.spendsNotes) noteText += (ctx.texts['sforzando'] || '');
      let chainText = '';
      if (ability.chain) {
        chainText = ' · ⛓️ envía ' + (ability.bounces || 1) + ' impacto(s) extra (rebote)';
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
        this.charSvc.syncPlayerStatus();
        lifestealText = ' · +' + heal + ' vida';
      }
      lifestealText += (ctx.texts['hope'] || '');
      const leechPoisonPct = this.charSvc.getLeechPoisonPercent();
      if (leechPoisonPct > 0 && ability.damageType === 'physical') {
        const leechHeal = Math.round(roll * leechPoisonPct / 100);
        if (leechHeal > 0) {
          this.charSvc.character.update(c => ({
            ...c,
            currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP ?? this.charSvc.maxHP()) + leechHeal),
          }));
          this.charSvc.syncPlayerStatus();
          lifestealText += ' · 🩸 Veneno Vampírico +' + leechHeal + ' vida';
        }
      }
      lifestealText += (ctx.texts['soulLeech'] || '');
      const dmgText = isCrit ? '¡CRITICO!' : ability.inflictsEffects ? '¡Aturde al enemigo!' : 'Lanzado';
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

      const abilityLabel = ability.id === 'basic_attack' ? ability.name : (ability.name + ' R' + ability.currentRank);
      this.charSvc.showToast(
        abilityLabel + ': ' + dmgText + (ctx.texts['imbue'] || '') + chainText + (ctx.texts['ignite'] || '') + (ctx.texts['deep'] || '') + ccText + (ctx.texts['rageE'] || rageText) + (ctx.texts['fotw'] || fotwText) + comboText + sunShardText + shardText + focusText + conduitText + lifestealText + noteText + evText + boostText + (ctx.texts['storm'] || '') + (ctx.texts['unyielding'] || '') + (ctx.texts['serpent'] || '') + woundText + (ctx.texts['rend'] || '') + (ctx.texts['sunder'] || '') + (ctx.texts['maelstorm'] || '') + (ctx.texts['valkSpend'] || '') + (ctx.texts['valkCharge'] || '') + (ctx.texts['valkTaunt'] || '') + (ctx.texts['efCrit'] || '') + (ctx.texts['arcaneOrb'] || '') + (ctx.texts['orb'] || '') + natureBoostText
      );
      const hits = ability.multiHit || 1;
      for (let h = 0; h < hits; h++) {
        let hitRoll = roll;
        if (hits > 1 && h > 0) {
          hitRoll = (ability.currentMin || 0) + Math.floor(Math.random() * ((ability.currentMax || 0) - (ability.currentMin || 0) + 1));
          if (isCrit) hitRoll = Math.round(hitRoll * ctx.extraHitCritMult);
          if (isRage && this.charSvc.inBattleStance()) {
            const battleMult = 1.10 + this.charSvc.talentRank('improved_stances') * 0.02;
            hitRoll = Math.round(hitRoll * battleMult);
          }
          if (poisonDmg > 0 && ability.damageType === 'physical') hitRoll += poisonDmg;
          this.charSvc.turnDamage.update(d => d + hitRoll);
        }
        this.charSvc.sendDamageEvent(sendAbility, hitRoll, h + 1, hits);
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
      // S9 — damage post-payload (onHit): shaman windfury, hunter double_tap
      ctx.roll = roll;
      this.runSpellHooks('onHit', ability, ctx);
    }
  }

  private dispatchClassAbility(ability: any, ctx: ClassHooksContext): boolean {
    for (const hooks of classAbilityHooks) {
      if (hooks.castUtility?.(ability, ctx)) return true;
    }
    return false;
  }

  private buildPlayerLink(): PlayerLink {
    return {
      sendDamagePayload: (payload) => this.sendDamagePayload(payload),
      setValkFallen: (active) => this.valkFallen.set(active),
      updateAbilityRoll: (id, roll, crit) => this.abilityRolls.update(r => ({ ...r, [id]: { roll, crit } })),
    };
  }

  private runSpellHooks<M extends keyof SpellHooks>(method: M, ability: any, ctx: SpellCastContext): void {
    for (const hooks of classSpellHooks) {
      const fn = hooks[method];
      if (fn) (fn as any)(ability, ctx);
    }
  }

  private runSpellHooksCast(method: 'castSpell', ability: any, ctx: SpellCastContext): boolean {
    for (const hooks of classSpellHooks) {
      if (hooks[method]?.(ability, ctx)) return true;
    }
    return false;
  }

  castUtility(ability: any) {
    if (ability.passive) {
      this.charSvc.showToast('Pasiva: ' + ability.name + ' activa');
      return;
    }
    const hookCtx: ClassHooksContext = {
      svc: this.charSvc,
      player: this.buildPlayerLink(),
      t: (key) => this.trSvc.t(key),
    };
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
      cost = this.charSvc.getEffectiveManaCost(ability);
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
    if (ability.id === 'valk_angel_jump') {
      const effCdA = this.charSvc.getEffectiveCooldown(ability);
      if (effCdA > 0) {
        this.charSvc.character.update(c => {
          if (!c.currentCooldowns) c.currentCooldowns = {};
          c.currentCooldowns[ability.id] = effCdA;
          return { ...c };
        });
      }
      this.charSvc.showToast(ability.name + ': te desplazas sin gastar acción · CD ' + effCdA);
      return;
    }
    if (ability.blockedStance && this.charSvc.warriorStance() === ability.blockedStance) {
      this.charSvc.showToast(ability.name + ' no se puede usar en esta estancia');
      return;
    }

    const poisonMasteryInstant = ['poison_weapon', 'leeching_poison', 'wound_poison'].includes(ability.id) && this.charSvc.selectedCapstone() === 'poison_mastery';
    const actionCost = ability.noGcd ? 0 : (ability.castType === 'instant' || poisonMasteryInstant ? 1 : 2);
    if (!this.charSvc.canAct(actionCost)) {
      this.charSvc.showToast(this.trSvc.t('sin_acciones'));
      return;
    }

    if (ability.id === 'valk_divine_protection' && this.charSvc.character().classKey === 'valkyrie') {
      const poolActual = this.charSvc.valkyriePoolValue();
      if (poolActual <= 0) {
        const poolName = this.charSvc.selectedValkyriePool() === 'shield' ? 'escuido' : 'lanza';
        this.charSvc.showToast('No tienes carga de ' + poolName);
        return;
      }
      const spent = this.charSvc.spendValkyriePool(poolActual);
      const armValue = ability.currentBuffValue || 10;
      const baseDur = ((ability.buff && ability.buff.duration) || 2) + this.charSvc.talentRank('perseverance');
      const duration = baseDur + Math.floor(spent / 100);
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== ability.name),
          { id: Date.now() + Math.random(), type: 'buff' as const, name: ability.name, target: 'armor', value: armValue, duration },
        ],
      }));
      this.charSvc.useAction(actionCost);
      const effCdD = this.charSvc.getEffectiveCooldown(ability);
      if (effCdD > 0) {
        this.charSvc.character.update(c => {
          if (!c.currentCooldowns) c.currentCooldowns = {};
          c.currentCooldowns[ability.id] = effCdD;
          return { ...c };
        });
      }
      this.charSvc.showToast(ability.name + ' R' + ability.currentRank + ': +' + armValue + ' armadura · ' + duration + ' turnos (gastados ' + spent + ' de carga de ' + this.charSvc.selectedValkyriePool() + ')');
      return;
    }
    if (ability.id === 'valk_take_flight' && this.charSvc.character().classKey === 'valkyrie') {
      if (!this.charSvc.odinsWillActive()) {
        this.charSvc.showToast('Necesitas el buffo de Odins Will para usar ' + ability.name);
        return;
      }
      if (this.charSvc.valkyrieFlying()) {
        this.charSvc.showToast('Ya estás volando');
        return;
      }
      const flyEnergyText = this.charSvc.valkyrieApplyFlight(2);
      this.charSvc.useAction(actionCost);
      this.charSvc.showToast(ability.name + ': asciendes al cielo' + flyEnergyText);
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
      if (this.charSvc.isLastWillActive()) {
        const hpCost = Math.max(1, Math.round(this.charSvc.maxHP() * cost / 200));
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.max(1, this.charSvc.hpActual() - hpCost),
        }));
        this.charSvc.syncPlayerStatus();
      } else {
        if (resourceActual < cost) {
          this.charSvc.showToast(this.trSvc.t('ira') + ' ' + this.trSvc.t('insufficient_resource'));
          return;
        }
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, resourceActual - cost),
        }));
      }
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
      const innerFocusFree = this.charSvc.hasEffect('inner_focus');
      const effectiveCost = innerFocusFree ? 0 : cost;
      if (manaActual < effectiveCost) {
        this.charSvc.showToast(this.trSvc.t('mana') + ' ' + this.trSvc.t('insufficient_resource'));
        return;
      }
      const clearcast = this.charSvc.checkClearcasting();
      if (!clearcast && effectiveCost > 0) {
        this.charSvc.character.update(c => ({
          ...c,
          currentMana: manaActual - effectiveCost,
        }));
      }
      if (innerFocusFree) {
        this.charSvc.character.update(c => ({
          ...c,
          activeEffects: (c.activeEffects || []).filter(e => e.target !== 'inner_focus'),
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
      this.charSvc.syncPlayerStatus();
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
    } else if (ability.id === 'valk_luminous_cone') {
      const coRank = ability.currentRank || 1;
      const coBuff = ability.buffRanks?.find((br: any) => br.rank === coRank);
      const misfireVal = coBuff ? coBuff.value : 20;
      this.charSvc.sendDamageEvent({ ...ability, inflictsEffects: [{ type: 'debuff', name: 'Cone of Light', target: 'misfire_chance', value: misfireVal, duration: 2, debuffType: 'magic', stackable: false }] }, 0, 1, 1);
      this.charSvc.showToast(ability.name + ' R' + coRank + ': ✨ el enemigo falla sus ataques (' + misfireVal + '%, 2 turnos) — enviado al Master');
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
    } else if (this.dispatchClassAbility(ability, hookCtx)) {
      return;
    } else if (ability.id === 'valk_last_will') {
      const odinsAbility = this.charSvc.classConfig().abilities.find(a => a.id === 'valk_odins_will');
      const odinsRank = odinsAbility ? (this.charSvc.maxAvailableRank(odinsAbility) || 1) : 1;
      const odinsBuff = odinsAbility?.buffRanks?.find((br: any) => br.rank === odinsRank);
      const odinsValue = odinsBuff?.value || 50;
      this.charSvc.character.update(c => {
        const hasOdins = (c.activeEffects || []).some(e => e.target === 'valkyrie_charge_gain');
        const effects = [
          ...(c.activeEffects || []).filter(e => e.target !== 'valk_last_will' && e.name !== 'Last Will (Crit)'),
          { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Last Will', target: 'valk_last_will', value: 1, duration: 3, isPercent: false },
          { id: Date.now() + Math.random() + 0.001, type: 'buff' as const, name: 'Last Will (Crit)', target: 'physCrit', value: 60, duration: 3, isPercent: false },
        ];
        if (!hasOdins) {
          effects.push({ id: Date.now() + Math.random() + 0.002, type: 'buff' as const, name: "Odin's Will", target: 'valkyrie_charge_gain', value: odinsValue, duration: 3, isPercent: false });
        }
        const rageMax = this.charSvc.resourceMax();
        const rageNow = this.charSvc.resourceActual();
        const newRage = Math.min(rageMax, rageNow + 20);
        return { ...c, activeEffects: effects, currentRage: newRage };
      });
      this.charSvc.syncPlayerStatus();
      this.charSvc.showToast('📯 Last Will: 3 turnos gastando vida en vez de ira (10 de ira → 5% de vida), +60% probabilidad de critico, +20 ira y Odin\'s Will activo (R' + odinsRank + ')');
    } else if (ability.id === 'nature_guardian') {
      const moonMax = this.charSvc.getMaelstromMax();
      const sunMax = this.charSvc.sunShardsMax();
      this.charSvc.character.update(c => ({ ...c, comboPoints: Math.min(moonMax, (c.comboPoints || 0) + 2), sunShards: Math.min(sunMax, (c.sunShards || 0) + 2) }));
      this.charSvc.showToast(this.trSvc.t('druid_nature_guardian_toast'));
    } else if (ability.id === 'unsummon_pet') {
      this.charSvc.dismissPet();
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
      if (ability.id === 'vibrato') {
        buffValue = Math.round(buffValue * (1 + this.charSvc.talentRank('directore') * 0.20));
      }
      const effectType = ability.buff.isHot ? 'hot' : 'buff';
      let sndDuration = ability.currentBuffDuration;
      if (ability.id === 'slice_and_dice') {
        sndDuration = sndComboSpent + this.charSvc.talentRank('improved_slice_and_dice') * 1;
      }
      if (ability.id === 'valk_speed_of_light') {
        sndDuration += this.charSvc.talentRank('perseverance');
      }
      const misoRank = this.charSvc.talentRank('misologist');
      if (misoRank > 0 && ['poisonDamage', 'leechPoison', 'woundPoison'].includes(ability.currentBuffStat)) {
        sndDuration += misoRank;
        if (ability.currentBuffStat !== 'woundPoison') {
          buffValue = Math.round(buffValue * (1 + misoRank * 0.01));
        }
      }
      if (ability.id === 'valk_odins_will') {
        sndDuration = this.charSvc.odinsDuration();
      }
      const odinsFlyGrant = ability.id === 'valk_odins_will' && this.charSvc.valkyrieOdinsFlyPending();
      const poisonBuffTargets = ['poisonDamage', 'leechPoison', 'woundPoison'];
      const poisonClearTargets = poisonBuffTargets.includes(ability.currentBuffStat)
        ? poisonBuffTargets.filter(t => t !== ability.currentBuffStat)
        : [];
      this.charSvc.character.update(c => ({
        ...c,
        // getMaelstromMax() pese al nombre es generico: para el rogue devuelve el tope de
        // Combo Points (comboConfig.max), no algo especifico del shaman. Mismo patron que
        // usa el bonus de Finishing Touch en castSpell() para Eviscerate.
        ...(ability.id === 'slice_and_dice' ? (
          this.charSvc.talentRank('finishing_touch') > 0
            ? { comboPoints: Math.min(this.charSvc.getMaelstromMax(), 1), currentEnergy: Math.min(this.charSvc.resourceMax(), (c.currentEnergy || 0) + 15) }
            : { comboPoints: 0 }
        ) : {}),
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
        this.charSvc.syncPlayerStatus();
      }
      if (ability.id === 'inner_focus') {
        this.charSvc.showToast('🎯 Inner Focus: durante 3 turnos tu próximo hechizo no cuesta maná y tiene +25% de crítico');
        return;
      }
      if (ability.partyBuff) {
        this.charSvc.sendBuffEvent(ability, buffValue);
      }
      const sndText = ability.id === 'slice_and_dice' ? ' · +1 accion/turno · ' + sndComboSpent + ' combo gastados' : '';
      const odinsFlyText = odinsFlyGrant
        ? ' · 🕊️ Fly the Nest gratuito' + this.charSvc.valkyrieApplyFlight(sndDuration)
        : '';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': +' + buffValue +
        (ability.buff.isPercent ? '%' : '') + ' ' + ability.currentBuffStat +
        sndText + odinsFlyText + ' — ' + this.trSvc.t('sent_to_master')
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
      if (ability.id === 'crescendo') {
        const icRank = this.charSvc.talentRank('improved_crescendo');
        if (icRank > 0) {
          const selfBuffValue = Math.round(buffValue * icRank * 0.20);
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
      const restoredMana = this.charSvc.restoreManaPct(ability.restoresManaPct);
      this.charSvc.showToast(ability.name + ': +' + restoredMana + ' mana restaurado');
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
          const manaHeal = Math.round(restoredMana * 0.10 * ifRank);
          if (manaHeal > 0) this.charSvc.adjustHP(manaHeal);
          this.charSvc.showToast('Improved Fermata: +' + armorGain + ' armadura (4t)' + (manaHeal > 0 ? ' · +' + manaHeal + ' vida (10%/punto del mana restaurado)' : ''));
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
        if (maestroRank > 0 && Math.random() * 100 < maestroRank * 35) {
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
        if (ability.id === 'da_capo' && this.charSvc.selectedCapstone() === 'improved_da_capo') {
          const maxNote = this.charSvc.classConfig().comboConfig?.max || 7;
          const newNote = 1 + Math.floor(Math.random() * maxNote);
          this.charSvc.addNote(newNote);
          this.charSvc.showToast('🎺 Improved Da Capo: Nueva nota: ' + NOTE_NAMES[newNote - 1]);
        }
      }
    }
    if (ability.inflictsEffects) {
      const idRank = this.charSvc.talentRank('directore');
      const scaledEffects = ability.inflictsEffects.map((eff: any) => ({
        ...eff,
        value: ability.id === 'diminuendo' && idRank > 0
          ? Math.round((ability.currentBuffValue || eff.value) * (1 + idRank * 0.20))
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
    if (!this.charSvc.simMode()) {
      this.charSvc.registerPlayer();
    }
    const maxHP = this.charSvc.maxHP();
    const maxMana = this.charSvc.maxMana();
    const resourceMax = this.charSvc.resourceMax();
    const wasDead = this.charSvc.isDead();
    this.charSvc.character.update(c => {
      const effects = (c.activeEffects || []).map(e => ({ ...e, duration: e.duration - 2 })).filter(e => e.duration > 0);
      const pocket = this.charSvc.talentRank('pocket_shards');
      return { ...c, currentHP: maxHP, comboPoints: 0, musicalNotes: [], soulShards: pocket, currentCooldowns: {}, activeEffects: effects, infernalTurnsLeft: 0, fireTotem: null, waterTotem: null };
    });
    const revivePrefix = wasDead ? 'Full Rest: revives! ' : 'Full Rest: ';
    if (this.charSvc.resourceConfig().type === 'rage') {
      this.charSvc.character.update(c => ({ ...c, currentRage: 0 }));
      this.charSvc.showToast(revivePrefix + 'vida al maximo, ira reseteada, buffs -2 turnos');
    } else if (this.charSvc.resourceConfig().type === 'energy') {
      this.charSvc.character.update(c => ({ ...c, currentEnergy: resourceMax }));
      this.charSvc.showToast(revivePrefix + 'vida y energia al maximo, buffs -2 turnos');
    } else if (this.charSvc.resourceConfig().type === 'focus') {
      this.charSvc.character.update(c => ({ ...c, currentFocus: resourceMax }));
      this.charSvc.showToast(revivePrefix + 'vida y focus al maximo, buffs -2 turnos');
    } else {
      this.charSvc.character.update(c => ({ ...c, currentMana: maxMana }));
      this.charSvc.showToast(revivePrefix + 'vida y mana al maximo, buffs -2 turnos');
    }
    this.charSvc.turnNumber.set(1);
    this.charSvc.turnDamage.set(0);
    this.charSvc.actionsUsed.set(0);
    this.charSvc.persistTurnState();
    this.charSvc.petRest();
    this.charSvc.syncPlayerStatus();
    if (this.charSvc.character().classKey === 'bard') {
      const ability = this.charSvc.classConfig().abilities.find(a => a.id === 'rested_inspiration');
      const level = this.charSvc.character().level;
      if (ability && ability.buffRanks && level >= ability.requiredLevel) {
        const rank = [...ability.buffRanks].reverse().find(br => br.level <= level) || ability.buffRanks[0];
        if (this.charSvc.simMode()) {
          this.charSvc.character.update(c => ({
            ...c,
            activeEffects: [
              ...(c.activeEffects || []).filter(e => e.name !== 'Rested Inspiration'),
              {
                id: Date.now() + Math.random(),
                type: 'buff' as const,
                name: 'Rested Inspiration',
                target: 'espiritu',
                value: rank.value,
                duration: 5,
                isPercent: false,
              },
            ],
          }));
        } else {
          this.charSvc.sendBuffEvent({
            name: 'Rested Inspiration',
            currentRank: rank.rank,
            currentBuffStat: 'espiritu',
            currentBuffValue: rank.value,
            currentBuffDuration: 5,
            buff: { isPercent: false },
            aoe: true,
          });
        }
        this.charSvc.showToast('🥐 Rested Inspiration: +' + rank.value + ' Espiritu a todo el grupo (5 turnos)');
      }
    }
  }

  saveChar() {
    this.showSaveConfirm.set(true);
  }

  confirmSaveToFirebase() {
    const name = (this.charSvc.character().name || '').trim();
    if (!name) {
      this.showSaveConfirm.set(false);
      this.charSvc.showToast(this.trSvc.t('name_required_save'));
      return;
    }
    this.showSaveConfirm.set(false);
    this.charSvc.saveToLocalStorage();
    this.charSvc.saveToFirebase().then((ok) => {
      this.charSvc.showToast(ok ? 'Ficha guardada en la nube' : 'No se pudo guardar');
    });
  }

  saveConfirmText(): string {
    const name = (this.charSvc.character().name || '').trim() || '?';
    return this.trSvc.t('confirm_save_body') + ' "' + name + '". ' + this.trSvc.t('confirm_save_overwrite');
  }

  async openLoadModal() {
    const chars = await this.charSvc.listSavedCharacters();
    this.savedCharacters.set(chars);
    this.showLoadModal.set(true);
  }

  async loadFromFirebase(name: string) {
    const ok = await this.charSvc.loadFromFirebase(name);
    if (ok) {
      this.charSvc.showToast('Ficha cargada: ' + name);
      this.showLoadModal.set(false);
    } else {
      this.charSvc.showToast('No se encontró el personaje en la nube');
    }
  }

  formatSavedDate(ts: number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  }

  savedClassLabel(key: string): string {
    if (!key) return '';
    return this.classRegistry.get(key)?.name || key;
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
    return effects
      .filter(e => e.target === 'shield')
      .reduce((sum, e) => sum + (e.value || 0), 0);
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

  armorSlots(): any[] {
    return EQUIPMENT_SLOTS.filter(s => ['head', 'chest', 'legs', 'feet', 'hands'].includes(s.key));
  }

  weaponSlots(): any[] {
    const classKey = this.charSvc.character().classKey;
    const slots = EQUIPMENT_SLOTS.filter(s => s.key === 'mainHand' || s.key === 'offHand');
    if (classKey === 'warrior' && this.charSvc.character().level >= 8) {
      slots.push({
        key: 'twoHand',
        label: 'Dos Manos',
        icon: '',
        extraFields: [{ key: 'weaponDamage', label: 'Daño', icon: '' }],
      });
    }
    if (classKey === 'hunter') {
      slots.push({
        key: 'ranged',
        label: 'A Distancia',
        icon: '',
        extraFields: [{ key: 'weaponDamage', label: 'Daño', icon: '' }],
      });
    }
    return slots;
  }
}
