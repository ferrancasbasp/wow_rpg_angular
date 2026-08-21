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
  template: `
    <div class="top-bar-row">
      <div class="resource-section">
        <div class="char-header-row">
          <div class="class-icon">
            @if (charSvc.classConfig().iconImg) {
              <img [src]="charSvc.classConfig().iconImg" class="class-icon-img" (error)="onImgError($event)">
              <span style="display:none">{{ charSvc.classConfig().icon }}</span>
            } @else {
              <span>{{ charSvc.classConfig().icon }}</span>
            }
          </div>
          <div class="header-info">
            <input [value]="charSvc.character().name" (input)="onNameInput($event)" class="char-name-input" [placeholder]="trSvc.t('nombre')">
            <div class="char-meta">
              <span class="level-display">Nv {{ charSvc.character().level }}</span>
              <button class="debug-lvl-btn" (click)="instantLevel25()" title="Debug: subir a nivel 25">⚡25</button>
              <select [value]="charSvc.character().classKey" (change)="onClassChange($event)" class="class-select">
                @for (entry of classEntries; track entry[0]) {
                  <option [value]="entry[0]" [selected]="entry[0] === charSvc.character().classKey">{{ entry[1].name }}</option>
                }
              </select>
            </div>
          </div>
          <div class="quick-icons">
            <button class="quick-icon-btn" (click)="showStatsModal.set(true)" title="Atributos">
              <span>📊</span>
            </button>
            <button class="quick-icon-btn" (click)="showEquipment.set(true)" title="Equipo">
              <span>🛡️</span>
            </button>
            <button class="quick-icon-btn talent-btn" [class.has-points]="charSvc.availableTalentPoints() > 0"
                    (click)="showTalentModal.set(true)" title="Talentos">
              <span>🌟</span>
              @if (charSvc.availableTalentPoints() > 0) {
                <span class="tp-badge-mini">{{ charSvc.availableTalentPoints() }}</span>
              }
            </button>
          </div>
        </div>

        <div class="compact-bars">
          <div class="resource-track compact-hp">
            <div class="resource-fill hp" [style.width]="charSvc.hpPercent() + '%'"></div>
            @if (shieldValue() > 0) {
              <div class="resource-fill shield" [style.width]="shieldPercent() + '%'"></div>
            }
            <div class="resource-text">{{ charSvc.hpActual() }} / {{ charSvc.maxHP() }}</div>
          </div>
          <div class="resource-track compact-resource">
            <div class="resource-fill"
                 [class.mana]="charSvc.resourceConfig().type === 'mana'"
                 [class.rage]="charSvc.resourceConfig().type === 'rage'"
                 [class.energy]="charSvc.resourceConfig().type === 'energy'"
                 [style.width]="charSvc.resourcePercent() + '%'"
                 [style.background]="resourceBarBackground()">
            </div>
            <div class="resource-text">{{ charSvc.resourceActual() }} / {{ charSvc.resourceMax() }}</div>
          </div>
        </div>

        <div class="xp-mini-bar">
          <div class="xp-mini-track">
            <div class="xp-mini-fill" [style.width]="charSvc.xpProgressPercent() + '%'" [class.xp-levelup-anim]="levelUpFlash()"></div>
            <div class="xp-mini-text">{{ charSvc.xpProgressPercent() }}%</div>
          </div>
        </div>

        @if (charSvc.character().classKey === 'warlock') {
          <div class="warlock-bottom-row">
            <div class="combo-inline combo-warlock">
              <span class="combo-label">🔮 Shards</span>
              <div class="shard-pips">
                @for (n of shardArray(); track n) {
                  <div class="shard-pip" [class.active]="n <= (charSvc.character().soulShards || 0)"></div>
                }
              </div>
            </div>
            @if (charSvc.activePetData()) {
              <div class="pet-inline">
                @if (charSvc.activePetData()!.iconImg) {
                  <img [src]="charSvc.activePetData()!.iconImg" class="pet-icon-img-sm" (error)="onImgError($event)">
                } @else {
                  <span class="pet-icon-sm">{{ charSvc.activePetData()!.icon }}</span>
                }
                <div class="pet-bars-inline">
                  <div class="resource-track pet-hp-track">
                    <div class="resource-fill hp" [style.width]="charSvc.petHPPercent() + '%'"></div>
                  </div>
                  <div class="resource-track pet-mana-track">
                    <div class="resource-fill mana" [style.width]="charSvc.petManaPercent() + '%'"></div>
                  </div>
                </div>
                @if (charSvc.unlockedPetAbilities().length > 0) {
                  <div class="pet-abilities-inline">
                    @for (ab of charSvc.unlockedPetAbilities(); track ab.id) {
                      <button class="pet-ability-icon-btn"
                              [disabled]="!charSvc.canAct(1) || charSvc.petMana() < ab.scaledCost!"
                              [title]="ab.name + ' — ' + ab.description + ' (' + ab.scaledCost + ' mana pet)'"
                              (click)="castPetAbility(ab)">
                        @if (ab.iconImg) {
                          <img [src]="ab.iconImg" class="pet-ability-icon-img" (error)="onImgError($event)">
                        } @else {
                          {{ ab.icon }}
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        } @else if (charSvc.character().classKey === 'bard') {
          <div class="combo-inline combo-bard">
            <span class="combo-label">🎶 Partitura</span>
            <div class="note-slots">
              @for (n of noteSlotArray(); track n) {
                @if (n - 1 < (charSvc.getNotes().length)) {
                  <div class="note-slot filled" [style.--note-color]="NOTE_COLORS[charSvc.getNotes()[n - 1] - 1]">
                    {{ NOTE_NAMES[charSvc.getNotes()[n - 1] - 1] }}
                  </div>
                } @else {
                  <div class="note-slot empty">·</div>
                }
              }
            </div>
            <span class="note-contribution">×{{ charSvc.noteContribution().toFixed(1) }}</span>
          </div>
        } @else if (charSvc.resourceConfig().type === 'energy' || charSvc.classConfig().comboConfig) {
          <div class="combo-inline" [class.combo-rogue]="charSvc.character().classKey === 'rogue'" [class.combo-druid]="charSvc.character().classKey === 'druid'">
            <span class="combo-label">{{
              charSvc.classConfig().comboConfig
                ? (charSvc.classConfig().comboConfig!.icon + ' ' + charSvc.classConfig().comboConfig!.label)
                : 'Combo Points'
            }}</span>
            <div class="combo-points">
              @for (n of comboPointArray(charSvc.classConfig().comboConfig?.max || 5); track n) {
                <div class="combo-point" [class.active]="n <= (charSvc.character().comboPoints || 0)"></div>
              }
            </div>
          </div>
        }
      </div>

      <div class="top-side-controls">
        <button class="lang-toggle-btn" (click)="trSvc.toggleLang()" [title]="trSvc.lang() === 'es' ? 'Switch to English' : 'Cambiar a Español'">
          {{ trSvc.lang() === 'es' ? '🇬🇧 EN' : '🇪🇸 ES' }}
        </button>
        @if (charSvc.character().classKey === 'warrior') {
          <div class="warrior-stance-row">
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'battle'" (click)="changeStance('battle')">
              <img src="img/talents/warrior/battle_stance.jpg" class="stance-icon" (error)="onImgErrorSimple($event)"> Battle
            </button>
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'fury'" (click)="changeStance('fury')">
              Fury
            </button>
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'protection'" (click)="changeStance('protection')">
              <img src="img/talents/warrior/protection_stance.jpg" class="stance-icon" (error)="onImgErrorSimple($event)"> Prot
            </button>
          </div>
        }
        @if (charSvc.character().classKey === 'warrior' && charSvc.talentRank('master_of_weapons') > 0) {
          <div class="warrior-weapon-row">
            <button class="weapon-mode-btn" [class.active]="charSvc.warriorWeaponMode() === 'dualwield'" (click)="changeWeaponMode('dualwield')">1H + Off</button>
            <button class="weapon-mode-btn" [class.active]="charSvc.warriorWeaponMode() === 'twohanded'" (click)="changeWeaponMode('twohanded')">2H</button>
          </div>
        }
        <div class="turn-damage-box">
          <span class="turn-damage-label">{{ trSvc.t('danyo') }} {{ trSvc.t('turno_actual') }}</span>
          <span class="turn-damage-value">{{ charSvc.turnDamage() }}</span>
        </div>
        <div class="turn-btn-row">
          <button class="action-btn end-turn-btn" (click)="endTurn()">{{ trSvc.t('finalizar_turno') }} ({{ charSvc.turnNumber() }})</button>
          <button class="action-btn full-rest-btn" (click)="fullRest()" title="Full Rest: vida/mana al maximo, buffs -2 turnos">🥐</button>
        </div>
        <div class="action-slots-row">
          <span class="action-slots-label">{{ trSvc.t('acciones') }}</span>
          <div class="action-slots">
            @for (n of actionSlotArray(); track n) {
              <div class="action-slot" [class.spent]="n <= charSvc.actionsUsed()" [class.snD]="n === 3 && charSvc.maxActions() === 3">
                @if (n <= charSvc.actionsUsed()) {
                  <span class="spent-icon">·</span>
                } @else {
                  <span>⚡</span>
                }
              </div>
            }
          </div>
          <button class="move-btn" (click)="moveAction()" [disabled]="!charSvc.canAct(1)"
                  title="Mover — gasta 1 accion instantanea">
            <span>🥾</span>
          </button>
        </div>
      </div>
    </div>

    <div class="effects-section">
      <div class="effects-header">
        <span class="effects-title">{{ trSvc.t('efectos') }}</span>
        @if (charSvc.character().activeEffects && charSvc.character().activeEffects.length > 0) {
          <span class="effects-count">{{ charSvc.character().activeEffects.length }}</span>
        }
      </div>
      <div class="effects-body">
        @if (charSvc.character().activeEffects && charSvc.character().activeEffects.length > 0) {
          <div class="effects-active-list">
            @for (eff of charSvc.character().activeEffects; track eff.id) {
              <div class="effect-chip" [style.--eff-color]="debuffColor(eff)">
                <span class="effect-icon">{{ EFFECT_TYPES[eff.type].icon }}</span>
                <span class="effect-name">{{ eff.name }}</span>
                @if (eff.debuffType && eff.debuffType !== 'none') {
                  <span class="effect-debuff-type" [style.color]="DEBUFF_TYPES[eff.debuffType].color">{{ DEBUFF_TYPES[eff.debuffType].label }}</span>
                }
                <span class="effect-value">{{ effectValueText(eff) }}</span>
                <span class="effect-duration">{{ eff.duration }}t</span>
                <button class="effect-remove" (click)="removeEffect(eff.id)">✕</button>
              </div>
            }
          </div>
        } @else {
          <div class="effects-empty">{{ trSvc.t('no_active_effects') }}</div>
        }
      </div>
    </div>

    <div class="main-grid">

      <div class="wow-panel">
        <div class="panel-title">Habilidades
          <button class="train-btn" (click)="trainAll()" [disabled]="!charSvc.canTrain()"
                  [class.train-available]="charSvc.canTrain()">
            Entrenar@if (charSvc.canTrain()) { ({{ charSvc.trainableAbilities().length }}) }
          </button>
        </div>
        <div class="panel-body">
          <div class="ability-grid">
          @for (ability of charSvc.unlockedAbilities(); track ability.id) {
            <div class="ability-card"
                 [class.ability-locked]="charSvc.resourceActual() < (ability.costRage || charSvc.getEffectiveEnergyCost(ability) || ability.scaledCost || 0)"
                 [class.ability-cd]="charSvc.getCooldown(ability.id) > 0">
              <div class="ability-icon castable"
                   [class.on-cooldown]="charSvc.getCooldown(ability.id) > 0"
                   [class.disabled]="charSvc.resourceActual() < (ability.costRage || charSvc.getEffectiveEnergyCost(ability) || ability.scaledCost || 0) || charSvc.getCooldown(ability.id) > 0"
                   [title]="ability.name + ' — ' + ability.description"
                   (click)="castSpell(ability)">
                 @if (ability.iconImg) {
                   <img [src]="ability.iconImg" class="ability-icon-img" (error)="onImgError($event)">
                   <span style="display:none">{{ ability.icon }}</span>
                 } @else {
                   <span>{{ ability.icon }}</span>
                 }
                 @if (ability.currentRank! > 1) {
                   <span class="ability-rank-badge">R{{ ability.currentRank }}</span>
                 }
                 @if (charSvc.getCooldown(ability.id) > 0) {
                   <span class="ability-cd-badge">{{ charSvc.getCooldown(ability.id) }}</span>
                 }
               </div>
               <div class="ability-info">
                 <div class="ability-name">{{ ability.name }}</div>
                 <div class="ability-school">
                   {{ ability.school }} · {{ ability.noGcd ? 'NoGCD' : (ability.castType === 'instant' ? 'Inst.' : 'Cast.') }}
                   @if (ability.requiresStealth) {<span class="ability-req-tag"> · Sigilo</span>}
                   @if (ability.requiresBehind) {<span class="ability-req-tag"> · Detras</span>}
                 </div>
                 <div class="ability-stats">
                   @if (ability.type === 'damage' && !ability.isDot) {
                     <span class="ability-stat dmg">{{ ability.currentMin }}-{{ ability.currentMax }}</span>
                   }
                   @if (ability.isDot) {
                     <span class="ability-stat dmg">{{ ability.dotTick }}/t · {{ ability.dotDuration }}t</span>
                   }
                   @if (ability.type === 'heal' && !ability.isHot) {
                     <span class="ability-stat heal">{{ ability.currentMin }}-{{ ability.currentMax }}</span>
                   }
                   @if (ability.isHot) {
                     <span class="ability-stat heal">{{ ability.hotTick }}/t · {{ ability.hotDuration }}t</span>
                   }
                    @if (charSvc.resourceConfig().type === 'rage') {
                      <span class="ability-stat cost">{{ ability.effectiveRageCost || 0 }} ira@if (ability.effectiveRageGen) { · +{{ ability.effectiveRageGen }} }</span>
                    } @else if (charSvc.resourceConfig().type === 'energy') {
                      <span class="ability-stat cost">{{ charSvc.getEffectiveEnergyCost(ability) }} en</span>
                    } @else {
                      <span class="ability-stat cost">{{ ability.scaledCost }} mp</span>
                    }
                    @if (ability.generatesShard) {
                      <span class="ability-stat shard-gen">+{{ ability.generatesShard }}<span class="shard-mini"></span></span>
                    }
                    @if (ability.spendsShards) {
                      <span class="ability-stat shard-cost">-{{ ability.shardCost || 3 }}<span class="shard-mini"></span></span>
                    }
                 </div>
               </div>
               <div class="ability-cast-col">
                 @if (abilityRolls()[ability.id]) {
                   <span class="ability-roll-text" [class.crit-roll]="abilityRolls()[ability.id].crit">
                     {{ ability.type === 'heal' ? '+' : '-' }}{{ abilityRolls()[ability.id].roll }}{{ abilityRolls()[ability.id].crit ? '!' : '' }}
                   </span>
                 }
              </div>
            </div>
          }
          </div>

          @if (charSvc.trainableAbilities().length > 0) {
            <div class="locked-abilities-section">
              <div class="locked-abilities-title">{{ trSvc.t('available_train') }}</div>
              @for (ability of charSvc.trainableAbilities(); track ability.id) {
                <div class="locked-ability trainable">
                  <span class="locked-ability-icon">{{ ability.icon }}</span>
                  <span class="locked-ability-name">{{ ability.name }}</span>
                  <span class="locked-ability-req">{{ trSvc.t('rank') }} {{ charSvc.trainedRank(ability.id) + 1 }} → {{ charSvc.maxAvailableRank(ability) }}</span>
                </div>
              }
            </div>
          }

          @if (lockedAbilities().length > 0) {
            <div class="locked-abilities-section">
              <div class="locked-abilities-title">{{ trSvc.t('locked_level') }}</div>
              @for (ability of lockedAbilities(); track ability.id) {
                <div class="locked-ability">
                  <span class="locked-ability-icon">{{ ability.icon }}</span>
                  <span class="locked-ability-name">{{ ability.name }}</span>
                  <span class="locked-ability-req">{{ trSvc.t('level') }} {{ ability.requiredLevel }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (charSvc.unlockedUtility().length > 0) {
        <div class="wow-panel">
          <div class="panel-title">{{ trSvc.t('utility') }}</div>
          <div class="panel-body">
            <div class="ability-grid">
            @for (ability of charSvc.unlockedUtility(); track ability.id) {
              <div class="ability-card"
                   [class.ability-locked]="charSvc.resourceActual() < (ability.scaledCost || 0)"
                   [class.ability-cd]="charSvc.getCooldown(ability.id) > 0">
                <div class="ability-icon castable"
                     [class.on-cooldown]="charSvc.getCooldown(ability.id) > 0"
                     [class.disabled]="charSvc.resourceActual() < (ability.scaledCost || 0) || charSvc.getCooldown(ability.id) > 0"
                     [title]="ability.name + ' — ' + ability.description"
                     (click)="castUtility(ability)">
                   @if (ability.iconImg) {
                     <img [src]="ability.iconImg" class="ability-icon-img" (error)="onImgError($event)">
                     <span style="display:none">{{ ability.icon }}</span>
                   } @else {
                     <span>{{ ability.icon }}</span>
                   }
                   @if (ability.currentRank > 1) {
                     <span class="ability-rank-badge">R{{ ability.currentRank }}</span>
                   }
                   @if (charSvc.getCooldown(ability.id) > 0) {
                     <span class="ability-cd-badge">{{ charSvc.getCooldown(ability.id) }}</span>
                   }
                 </div>
                 <div class="ability-info">
                   <div class="ability-name">{{ ability.name }}</div>
                   <div class="ability-school">
                     {{ ability.school }} · {{ ability.noGcd ? 'NoGCD' : (ability.castType === 'instant' ? 'Inst.' : 'Cast.') }}
                   </div>
                   <div class="ability-stats">
                     @if (ability.currentBuffValue) {
                       <span class="ability-stat bonus">+{{ ability.currentBuffValue }} {{ ability.currentBuffStat }} · {{ ability.currentBuffDuration }}t</span>
                     }
                     @if (charSvc.resourceConfig().type === 'rage') {
                       <span class="ability-stat cost">{{ ability.scaledCost }} ira</span>
                     } @else if (charSvc.resourceConfig().type === 'energy') {
                       <span class="ability-stat cost">{{ ability.scaledCost }} en</span>
                     } @else {
                       <span class="ability-stat cost">{{ ability.scaledCost }} mp</span>
                     }
                   </div>
                 </div>
                 <div class="ability-cast-col">
                </div>
              </div>
            }
            </div>
          </div>
        </div>
      }

    </div>

    <div class="action-bar">
      <button class="action-btn" (click)="saveChar()">{{ trSvc.t('save') }}</button>
      <button class="action-btn" (click)="loadChar()">{{ trSvc.t('load') }}</button>
      <button class="action-btn" (click)="openExport()">{{ trSvc.t('export_json') }}</button>
      <button class="action-btn danger" (click)="resetCharacter()">{{ trSvc.t('reset') }}</button>
    </div>

    @if (showStatsModal()) {
      <div class="modal-overlay" (click)="showStatsModal.set(false)">
        <div class="modal-content stats-modal" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ trSvc.t('attributes') }}</div>
          <div class="stats-modal-body">
            @for (entry of statEntries; track entry[1]) {
              <div class="stat-row">
                <div class="stat-label">
                  <span class="stat-icon">{{ STAT_ICONS[entry[1]] }}</span>
                  {{ entry[0] }}
                </div>
                <div class="stat-value-group">
                  <span class="stat-base-val">{{ charSvc.character().baseStats[entry[1]] }}</span>
                  @if (levelStatBonus(entry[1]) > 0) {
                    <span class="stat-level-bonus">+{{ levelStatBonus(entry[1]) }}</span>
                  }
                  <span class="stat-final">{{ charSvc.finalStats()[entry[1]] }}</span>
                  @if (statBonus(entry[1]) > 0) {
                    <span class="stat-bonus">+{{ statBonus(entry[1]) }}</span>
                  }
                </div>
              </div>
            }
            <div class="derived-stats">
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('spell_power_label') }}</span><span class="derived-value">{{ charSvc.spellPower() }}</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('spell_crit_label') }}</span><span class="derived-value">{{ charSvc.spellCrit() }}%</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('attack_power_label') }}</span><span class="derived-value">{{ charSvc.attackPower() }}</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('melee_crit_label') }}</span><span class="derived-value">{{ charSvc.meleeCrit() }}%</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('mana_regen_label') }}</span><span class="derived-value">{{ charSvc.manaRegen() }}/5s</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('armor_phys') }}</span><span class="derived-value">{{ charSvc.armorTotal() }} (-{{ charSvc.physReduction() }}%)</span></div>
              <div class="derived-row"><span class="derived-label">{{ trSvc.t('armor_magic') }}</span><span class="derived-value">{{ charSvc.magicResistTotal() }} (-{{ charSvc.magicReduction() }}%)</span></div>
              @if (charSvc.evasion() > 5) {
                <div class="derived-row"><span class="derived-label">{{ trSvc.t('evasion') }}</span><span class="derived-value">{{ charSvc.evasion() }}%</span></div>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn" (click)="showStatsModal.set(false)">{{ trSvc.t('cerrar') }}</button>
          </div>
        </div>
      </div>
    }

    @if (showEquipment()) {
      <div class="modal-overlay" (click)="showEquipment.set(false)">
        <div class="modal-content equip-modal" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ trSvc.t('equipment') }}</div>
          <div class="equip-modal-body">
            @for (slot of visibleEquipmentSlots(); track slot.key) {
              <div class="equip-slot">
                <div class="equip-slot-header">
                  <span class="equip-slot-icon">{{ slot.icon }}</span>
                  <span class="equip-slot-label">{{ slot.label }}</span>
                </div>
                <input type="text" [value]="getEquipItem(slot.key).name" (input)="onEquipNameInput($event, slot.key)"
                       class="equip-name-input" [placeholder]="trSvc.t('not_equipped')">
                <div class="equip-bonus-grid">
                  @for (entry of statEntries; track entry[1]) {
                    <div class="equip-bonus-cell">
                      <span class="equip-bonus-label">{{ STAT_ICONS[entry[1]] }}</span>
                      <input type="number" [value]="getEquipItem(slot.key).bonus[entry[1]] || 0"
                             (input)="onEquipBonusInput($event, slot.key, entry[1])"
                             class="equip-bonus-input" min="0" placeholder="0">
                    </div>
                  }
                </div>
                @if (slot.extraFields) {
                  <div class="equip-extra-fields">
                    @for (field of slot.extraFields; track field.key) {
                      <div class="equip-bonus-cell">
                        <span class="equip-bonus-label">{{ field.icon }}</span>
                        <span class="equip-extra-label">{{ field.label }}</span>
                        <input type="number" [value]="getEquipExtra(slot.key, field.key)"
                               (input)="onEquipExtraInput($event, slot.key, field.key)"
                               class="equip-bonus-input" min="0" placeholder="0">
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
          <div class="modal-actions">
            <button class="action-btn" (click)="showEquipment.set(false)">{{ trSvc.t('cerrar') }}</button>
          </div>
        </div>
      </div>
    }

    @if (showExportModal()) {
      <div class="modal-overlay" (click)="showExportModal.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ trSvc.t('export_sheet') }}</div>
          <textarea class="modal-textarea" readonly [value]="exportedJson()"></textarea>
          <div class="modal-actions">
            <button class="action-btn" (click)="copyJson()">{{ trSvc.t('copy') }}</button>
            <button class="action-btn" (click)="downloadJson()">{{ trSvc.t('download') }}</button>
            <button class="action-btn" (click)="showExportModal.set(false)">{{ trSvc.t('cerrar') }}</button>
          </div>
        </div>
      </div>
    }

    @if (showTalentModal()) {
      <div class="modal-overlay" (click)="showTalentModal.set(false)">
        <div class="modal-content talent-modal" (click)="$event.stopPropagation()">
          <div class="talent-modal-header">
            <div class="modal-title">{{ trSvc.t('talent_tree') }} — {{ charSvc.classConfig().name }}</div>
            <div class="tp-badge" [class.has-points]="charSvc.availableTalentPoints() > 0">
              <span>{{ trSvc.t('available_pts') }}</span>
              <span class="tp-value">{{ charSvc.availableTalentPoints() }}</span>
            </div>
          </div>
          <div class="talent-modal-layout">
            <div class="talent-modal-tree">
              <div class="wow-talent-list">
                @for (tier of charSvc.tiers(); track tier) {
                  <div class="wow-tier-row" [class.tier-locked]="!charSvc.tierUnlocked(tier)">
                    <div class="wow-tier-label">
                      {{ charSvc.tierLabel(tier) }}
                      @if (!charSvc.tierUnlocked(tier)) {
                        <span class="tier-lock-hint"> (requires 5 in tier {{ tier - 1 }})</span>
                      }
                    </div>
                    <div class="wow-tier-nodes">
                      @for (talent of charSvc.talentsByTier(tier); track talent.id) {
                        <div class="wow-node" [class]="charSvc.talentNodeClass(talent)"
                             (click)="charSvc.addTalentPoint(talent.id)"
                             (contextmenu)="onTalentRightClick($event, talent.id)"
                             (mouseenter)="hoveredTalent.set(talent)"
                             (mouseleave)="hoveredTalent.set(null)">
                          <div class="wow-node-icon">
                            @if (talent.iconImg) {
                              <img [src]="talent.iconImg" (error)="onTalentImgError($event)">
                              <span style="display:none; align-items:center; justify-content:center; width:100%; height:100%; font-size:28px;">{{ talent.icon }}</span>
                            } @else {
                              <span class="wow-node-emoji">{{ talent.icon }}</span>
                            }
                            <span class="wow-node-rank">{{ charSvc.talentRank(talent.id) }}/{{ talent.maxRank }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
            <div class="talent-info-panel">
              @if (hoveredTalent()) {
                <div class="talent-info-name">{{ hoveredTalent().name }}</div>
                <div class="talent-info-rank">{{ trSvc.t('rank') }} {{ charSvc.talentRank(hoveredTalent().id) }} {{ trSvc.t('of') }} {{ hoveredTalent().maxRank }}</div>
                <div class="talent-info-desc">{{ hoveredTalent().description }}</div>
                @if (charSvc.getTalentEffectText(hoveredTalent().id)) {
                  <div class="talent-info-effect">{{ charSvc.getTalentEffectText(hoveredTalent().id) }}</div>
                }
                @if (hoveredTalent().requires) {
                  <div class="talent-info-req">
                    Requiere: {{ getTalentName(hoveredTalent().requires.id) }} ({{ hoveredTalent().requires.points }} pts)
                    <span [style.color]="charSvc.prereqMet(hoveredTalent()) ? 'var(--success)' : 'var(--danger)'">
                      {{ charSvc.prereqMet(hoveredTalent()) ? '✓' : '✗' }}
                    </span>
                  </div>
                }
                <div class="talent-info-hint">{{ trSvc.t('click_add_right_remove') }}</div>
              } @else {
                <div class="talent-info-empty">{{ trSvc.t('hover_talent_info') }}</div>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn danger" (click)="resetTalents()">{{ trSvc.t('reset_talents') }}</button>
            <button class="action-btn" (click)="showTalentModal.set(false)">{{ trSvc.t('cerrar') }}</button>
          </div>
        </div>
      </div>
    }

    @if (charSvc.toastMessage()) {
      <div class="toast">{{ charSvc.toastMessage() }}</div>
    }
    @if (incomingMasterMsg()) {
      <div class="toast master-msg">{{ incomingMasterMsg() }}</div>
    }
    @if (charSvc.petSwapWarning()) {
      <div class="pet-swap-warning">
        <span>⚠️ Cambiar de pet? {{ charSvc.petSwapWarning() }}</span>
        <button class="pet-swap-confirm" (click)="charSvc.confirmPetSwap()">{{ trSvc.t('yes_btn') }}</button>
        <button class="pet-swap-cancel" (click)="charSvc.cancelPetSwap()">{{ trSvc.t('no_btn') }}</button>
      </div>
    }
  `,
  styles: [`
    :host {
      --bg-darkest: #07070a;
      --bg-dark: #111114;
      --bg-panel: #1a1a1f;
      --bg-panel-hover: #222229;
      --bg-input: #0d0d10;
      --gold: #c9b27e;
      --gold-dark: #8a7344;
      --gold-light: #e8d5a0;
      --gold-glow: rgba(201, 178, 126, 0.3);
      --text: #e8d5b0;
      --text-dim: #9a8a6a;
      --text-muted: #6a6048;
      --hp: #4ea83e;
      --hp-dark: #2d6b1f;
      --mana: #3b7fe0;
      --mana-dark: #1d4ba0;
      --danger: #c45151;
      --success: #5fa85f;
      --radius: 6px;
      --transition: 0.2s ease;
      display: block;
      max-width: 1200px;
      margin: 0 auto;
      font-family: 'EB Garamond', Georgia, serif;
      background: var(--bg-darkest);
      color: var(--text);
      min-height: 100vh;
      padding: 20px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    .app-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 24px; margin-bottom: 20px;
      background: linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,178,126,0.1);
      position: relative; overflow: hidden;
    }
    .app-header::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--class-color, #C79C6E), transparent);
      opacity: 0.6;
    }

    .char-header-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    }

    .class-icon {
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      font-size: 20px; background: radial-gradient(circle, var(--bg-input) 60%, var(--bg-dark));
      border: 2px solid var(--class-color, #C79C6E); border-radius: 50%;
      box-shadow: 0 0 10px var(--class-glow, rgba(199,156,110,0.3)); flex-shrink: 0; overflow: hidden;
    }
    .class-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .header-info { flex: 1; min-width: 0; }

    .char-name-input {
      font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700;
      color: var(--gold-light); background: transparent; border: none;
      border-bottom: 1px solid transparent; outline: none; padding: 1px 2px;
      width: 100%; transition: var(--transition);
    }
    .char-name-input:hover, .char-name-input:focus { border-bottom-color: var(--gold-dark); }

    .char-meta {
      display: flex; align-items: center; gap: 10px; margin-top: 2px;
      font-size: 13px; color: var(--text-dim);
    }
    .level-control { display: flex; align-items: center; gap: 4px; }
    .level-control input {
      width: 32px; text-align: center; background: var(--bg-input);
      border: 1px solid var(--gold-dark); border-radius: 3px; color: var(--text);
      padding: 1px; font-family: 'EB Garamond', serif; font-size: 13px; outline: none;
    }
    .level-display {
      font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600; color: var(--gold);
    }

    .debug-lvl-btn {
      padding: 1px 6px; font-size: 10px; font-weight: 700; cursor: pointer;
      background: rgba(255, 215, 0, 0.15); border: 1px solid rgba(255, 215, 0, 0.3);
      border-radius: 3px; color: #ffd700; transition: all 0.2s;
    }
    .debug-lvl-btn:hover { background: rgba(255, 215, 0, 0.3); border-color: #ffd700; }

    .class-select {
      background: var(--bg-input); border: 1px solid var(--gold-dark); border-radius: 3px;
      color: var(--class-color, #C79C6E); padding: 2px 6px; font-family: 'Cinzel', serif;
      font-size: 12px; outline: none; cursor: pointer;
    }

    .tp-badge {
      display: flex; align-items: center; gap: 6px; padding: 6px 14px;
      background: var(--bg-input); border: 1px solid var(--gold-dark); border-radius: var(--radius);
      font-family: 'Cinzel', serif; font-size: 14px; flex-shrink: 0;
    }
    .tp-badge .tp-value { font-size: 20px; font-weight: 700; color: var(--gold-light); }
    .tp-badge.has-points .tp-value { animation: pulse-gold 2s infinite; }
    @keyframes pulse-gold {
      0%, 100% { text-shadow: 0 0 4px var(--gold-glow); }
      50% { text-shadow: 0 0 14px var(--gold-glow); }
    }

    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }

    .wow-panel {
      background: linear-gradient(170deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,178,126,0.08);
      overflow: hidden;
    }
    .panel-title {
      padding: 8px 12px; font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600;
      color: var(--gold);
      background: linear-gradient(90deg, rgba(201,178,126,0.1) 0%, transparent 100%);
      border-bottom: 1px solid var(--gold-dark);
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .panel-body { padding: 8px; }

    .stat-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0; border-bottom: 1px solid rgba(138,115,68,0.15);
    }
    .stat-row:last-of-type { border-bottom: none; }
    .stat-label { display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--text-dim); }
    .stat-icon { font-size: 18px; }
    .stat-value-group { display: flex; align-items: center; gap: 10px; }
    .stat-btn {
      width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      background: var(--bg-input); border: 1px solid var(--gold-dark); border-radius: 3px;
      color: var(--gold); cursor: pointer; font-size: 14px; transition: var(--transition);
    }
    .stat-btn:hover { background: var(--bg-panel-hover); border-color: var(--gold); color: var(--gold-light); }
    .stat-btn:active { transform: scale(0.92); }
    .stat-base-val { width: 28px; text-align: center; font-size: 16px; color: var(--text); }
    .stat-final { font-size: 18px; font-weight: 600; color: var(--gold-light); }
    .stat-bonus { font-size: 12px; color: var(--success); }
    .stat-level-bonus { font-size: 13px; color: var(--text-dim); }

    .resource-bar { margin-top: 12px; }
    .compact-bars { display: flex; flex-direction: column; gap: 3px; }
    .compact-bars .resource-track { border-radius: var(--radius); }
    .resource-label {
      display: flex; justify-content: space-between; font-size: 13px;
      margin-bottom: 4px; color: var(--text-dim);
    }
    .resource-track {
      height: 24px; background: #0a0a0e; border: 1px solid rgba(0,0,0,0.6);
      border-radius: 6px; overflow: hidden; position: relative;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05);
    }
    .resource-fill {
      height: 100%; border-radius: 5px; transition: width 0.4s ease; position: relative;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
    }
    .resource-fill::after {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 45%;
      background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%);
      border-radius: 5px 5px 0 0;
    }
    .resource-fill.hp {
      background: linear-gradient(180deg, #5cc83e 0%, #3a8e22 40%, #2d6b1f 100%);
    }
    .resource-fill.shield {
      background: linear-gradient(180deg, #f0c040 0%, #b8902a 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
      opacity: 0.7;
      position: absolute; top: 0; left: 0;
      border-right: 2px solid #ffd700;
    }
    .shield-text { color: #f0c040; font-size: 12px; font-weight: 600; }
    .resource-fill.mana {
      background: linear-gradient(180deg, #4a9eff 0%, #2a6ad8 40%, #1d4ba0 100%);
    }
    .resource-fill.rage {
      background: linear-gradient(180deg, #e85a3a 0%, #c0392b 40%, #8e2010 100%);
    }
    .resource-fill.energy {
      background: linear-gradient(180deg, #f0c040 0%, #cca830 40%, #a08020 100%);
    }
    .resource-text {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 12px; font-weight: 700; color: #fff;
      text-shadow: 0 0 3px rgba(0,0,0,0.9), 1px 1px 1px rgba(0,0,0,0.8); white-space: nowrap;
      letter-spacing: 0.02em;
    }

    .derived-stats { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gold-dark); }
    .derived-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .derived-label { color: var(--text-dim); }
    .derived-value { color: var(--gold-light); font-weight: 600; }

    .wow-talent-list {
      display: flex; flex-direction: column; gap: 24px; padding: 16px 4px; align-items: center;
    }
    .wow-tier-row {
      display: flex; gap: 28px; justify-content: center; flex-wrap: wrap;
      align-items: flex-start; flex-direction: column;
    }
    .wow-tier-label {
      font-family: 'Cinzel', serif; font-size: 12px; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.08em; text-align: center; width: 100%;
      padding-bottom: 4px; border-bottom: 1px dashed rgba(138,115,68,0.15);
    }
    .tier-locked .wow-tier-nodes { opacity: 0.4; pointer-events: none; }
    .tier-lock-hint { font-size: 10px; color: var(--danger); text-transform: none; letter-spacing: 0; }
    .wow-tier-nodes {
      display: flex; gap: 28px; justify-content: center; flex-wrap: wrap;
    }
    .wow-node {
      position: relative; width: 64px; height: 64px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .wow-node-icon {
      width: 56px; height: 56px; border: 2px solid #555; border-radius: 6px;
      overflow: hidden; position: relative; transition: all 0.2s;
      background: var(--bg-dark);
    }
    .wow-node-icon img { width: 100%; height: 100%; object-fit: cover; }
    .wow-node-emoji {
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%; font-size: 32px;
    }
    .wow-node-rank {
      position: absolute; bottom: -2px; right: -2px;
      background: rgba(0,0,0,0.85); color: var(--gold-light);
      font-size: 10px; font-weight: 700; font-family: 'Cinzel', serif;
      padding: 1px 5px; border-radius: 3px; line-height: 1;
      border: 1px solid var(--gold-dark);
    }
    .wow-node-active .wow-node-icon {
      border-color: var(--gold); box-shadow: 0 0 8px var(--gold-glow);
    }
    .wow-node-active .wow-node-rank { color: var(--gold-light); border-color: var(--gold); }
    .wow-node-maxed .wow-node-icon {
      border-color: var(--gold-light); box-shadow: 0 0 12px var(--gold-glow);
    }
    .wow-node-maxed .wow-node-rank { background: var(--gold); color: var(--bg-dark); border-color: var(--gold-light); }
    .wow-node-available .wow-node-icon {
      border-color: #5a9e4a; box-shadow: 0 0 6px rgba(90,158,74,0.3);
    }
    .wow-node-available:hover .wow-node-icon {
      border-color: #7cc44a; box-shadow: 0 0 12px rgba(124,196,74,0.5);
      transform: scale(1.08);
    }
    .wow-node-locked .wow-node-icon {
      border-color: #444; filter: grayscale(0.8) brightness(0.4);
    }
    .wow-node-locked { cursor: not-allowed; }
    .wow-node-grey .wow-node-icon {
      border-color: #555; filter: grayscale(0.5) brightness(0.6);
    }
    .wow-node-grey:hover .wow-node-icon {
      border-color: #777; filter: grayscale(0.3) brightness(0.8);
    }

    .talent-modal-layout {
      display: flex; gap: 16px; flex: 1; min-height: 0;
    }
    .talent-modal-tree {
      flex: 0 0 auto; overflow-y: auto; padding: 16px 8px 16px 4px;
    }
    .talent-info-panel {
      flex: 1; min-width: 260px; padding: 16px;
      background: var(--bg-input); border: 1px solid rgba(138,115,68,0.2);
      border-radius: var(--radius);
    }
    .talent-info-name {
      font-family: 'Cinzel', serif; font-size: 18px; font-weight: 700; color: var(--gold-light);
      margin-bottom: 4px;
    }
    .talent-info-rank { font-size: 14px; color: var(--text-dim); margin-bottom: 12px; }
    .talent-info-desc { font-size: 15px; color: var(--text); line-height: 1.5; margin-bottom: 10px; }
    .talent-info-effect { font-size: 14px; color: var(--success); margin-bottom: 10px; font-weight: 600; }
    .talent-info-req { font-size: 13px; color: var(--text-dim); margin-bottom: 10px; }
    .talent-info-hint {
      font-size: 12px; color: var(--text-muted); font-style: italic;
      margin-top: 12px; padding-top: 8px; border-top: 1px dashed rgba(138,115,68,0.2);
    }
    .talent-info-empty {
      color: var(--text-muted); font-style: italic; font-size: 14px;
      display: flex; align-items: center; justify-content: center; height: 100%; text-align: center;
    }

    .combo-bar {
      display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 8px 16px;
      background: var(--bg-panel); border: 1px solid var(--gold-dark); border-radius: var(--radius);
    }
    .combo-inline {
      display: flex; align-items: center; gap: 8px; margin-top: 2px;
    }
    .combo-label {
      font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: var(--gold);
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .combo-points { display: flex; gap: 4px; }
    .combo-point {
      width: 16px; height: 16px; border-radius: 50%;
      background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.15);
      transition: all 0.3s; position: relative; overflow: hidden;
    }
    .combo-point.active {
      border-color: #6ab7ff;
      box-shadow: 0 0 10px rgba(106,183,255,0.5);
    }
    .combo-point.active::before {
      content: ''; position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #a8d8ff 0%, #4a9eff 60%, #1a6dd0 100%);
    }
    .combo-point.active:nth-child(1)::before { clip-path: inset(0 75% 0 0); }
    .combo-point.active:nth-child(2)::before { clip-path: inset(0 50% 0 0); }
    .combo-point.active:nth-child(3)::before { clip-path: inset(0 25% 0 0); }
    .combo-point.active:nth-child(4)::before { clip-path: inset(0 0 0 0); }
    .combo-point.active:nth-child(5)::before { clip-path: inset(0 0 0 0); }

    .combo-rogue .combo-point.active {
      border-color: #e74c3c;
      box-shadow: 0 0 10px rgba(231,76,60,0.5);
    }
    .combo-rogue .combo-point.active::before {
      background: radial-gradient(circle at 35% 35%, #ff6b6b 0%, #e74c3c 60%, #a02020 100%);
    }
    .combo-rogue .combo-point.active:nth-child(1)::before,
    .combo-rogue .combo-point.active:nth-child(2)::before,
    .combo-rogue .combo-point.active:nth-child(3)::before,
    .combo-rogue .combo-point.active:nth-child(4)::before,
    .combo-rogue .combo-point.active:nth-child(5)::before {
      clip-path: inset(0 0 0 0);
    }

    .combo-bard { gap: 6px; }
    .note-slots { display: flex; gap: 3px; }
    .note-slot {
      width: 28px; height: 22px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; font-family: 'Cinzel', serif;
      transition: all 0.3s;
    }
    .note-slot.empty {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      color: var(--text-muted); font-size: 14px;
    }
    .note-slot.filled {
      background: color-mix(in srgb, var(--note-color) 20%, var(--bg-dark));
      border: 1px solid var(--note-color);
      color: var(--note-color);
      box-shadow: 0 0 8px color-mix(in srgb, var(--note-color) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.1);
      text-shadow: 0 0 4px color-mix(in srgb, var(--note-color) 50%, transparent);
    }
    .note-contribution {
      font-size: 13px; font-weight: 700; color: #9b59b6;
      text-shadow: 0 0 4px rgba(155,89,182,0.3);
    }

    .effects-section {
      margin-bottom: 20px; background: var(--bg-panel); border: 1px solid var(--gold-dark);
      border-radius: var(--radius); overflow: hidden;
    }
    .effects-header {
      display: flex; align-items: center; gap: 8px; padding: 10px 16px;
      background: linear-gradient(180deg, rgba(138,115,68,0.08) 0%, transparent 100%);
      border-bottom: 1px solid rgba(138,115,68,0.15); transition: var(--transition);
    }
    .effects-header:hover { background: linear-gradient(180deg, rgba(138,115,68,0.12) 0%, transparent 100%); }
    .effects-title {
      font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700; color: var(--gold);
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .effects-count {
      background: var(--gold); color: var(--bg-dark); font-size: 11px; font-weight: 700;
      padding: 1px 7px; border-radius: 10px; font-family: 'Cinzel', serif;
    }
    .effects-toggle { margin-left: auto; color: var(--text-dim); font-size: 12px; }
    .effects-body { padding: 12px 16px; }
    .effects-active-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .effect-chip {
      display: flex; align-items: center; gap: 6px; padding: 6px 10px;
      background: var(--bg-input); border: 1px solid var(--eff-color, var(--gold-dark));
      border-radius: 20px; border-left: 3px solid var(--eff-color, var(--gold-dark));
      transition: var(--transition);
    }
    .effect-chip:hover { background: var(--bg-panel-hover); }
    .effect-icon { font-size: 14px; }
    .effect-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .effect-debuff-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; opacity: 0.85; }
    .effect-value { font-size: 12px; color: var(--eff-color, var(--gold)); font-weight: 600; }
    .effect-duration {
      font-size: 11px; color: var(--text-dim); background: var(--bg-dark);
      padding: 1px 6px; border-radius: 8px; font-family: 'Cinzel', serif;
    }
    .effect-remove {
      width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 12px; border-radius: 50%; transition: var(--transition);
    }
    .effect-remove:hover { color: var(--danger); background: rgba(196,81,81,0.15); }
    .effects-empty { color: var(--text-muted); font-style: italic; font-size: 13px; margin-bottom: 12px; }
    .effect-add-form {
      display: flex; gap: 6px; flex-wrap: wrap; padding-top: 10px;
      border-top: 1px dashed rgba(138,115,68,0.15);
    }
    .effect-input {
      padding: 6px 8px; background: var(--bg-dark); border: 1px solid var(--gold-dark);
      border-radius: 3px; color: var(--text); font-size: 13px; outline: none;
    }
    .effect-input:focus { border-color: var(--gold); }
    .effect-input option { background: var(--bg-dark); }
    .effect-name-field { flex: 1; min-width: 120px; }
    .effect-value-field { width: 70px; }
    .effect-dur-field { width: 70px; }
    .effect-add-btn {
      padding: 6px 16px; font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
      background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: 3px; color: var(--gold);
      cursor: pointer; transition: var(--transition); text-transform: uppercase;
    }
    .effect-add-btn:hover { border-color: var(--gold); color: var(--gold-light); box-shadow: 0 0 8px var(--gold-glow); }

    .equip-slot {
      margin-bottom: 10px; padding: 10px;
      background: var(--bg-input); border: 1px solid rgba(138,115,68,0.2);
      border-radius: var(--radius); transition: var(--transition);
    }
    .equip-slot:hover { border-color: var(--gold-dark); }
    .equip-slot-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .equip-slot-icon { font-size: 18px; }
    .equip-slot-label {
      font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600;
      color: var(--gold); letter-spacing: 0.03em;
    }
    .equip-name-input {
      width: 100%; padding: 6px 8px; margin-bottom: 8px;
      background: var(--bg-dark); border: 1px solid var(--gold-dark); border-radius: 3px;
      color: var(--text); font-size: 13px; outline: none; transition: var(--transition);
    }
    .equip-name-input:focus { border-color: var(--gold); }
    .equip-name-input::placeholder { color: var(--text-muted); font-style: italic; }
    .equip-bonus-grid { display: flex; gap: 6px; flex-wrap: wrap; }
    .equip-bonus-cell {
      display: flex; align-items: center; gap: 3px;
      background: var(--bg-dark); border: 1px solid rgba(138,115,68,0.15);
      border-radius: 3px; padding: 2px 6px;
    }
    .equip-bonus-label { font-size: 14px; }
    .equip-bonus-input {
      width: 32px; padding: 2px; text-align: center; font-size: 12px; font-weight: 600;
      background: transparent; border: none; border-bottom: 1px solid var(--gold-dark);
      color: var(--success); outline: none;
    }
    .equip-bonus-input:focus { border-bottom-color: var(--gold); }
    .equip-extra-fields .equip-bonus-input { width: 56px; }
    .equip-extra-fields {
      display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;
      padding-top: 6px; border-top: 1px dashed rgba(138,115,68,0.15);
    }
    .equip-extra-label { font-size: 11px; color: var(--text-dim); }

    .ability-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
    }
    .ability-card {
      display: flex; align-items: center; gap: 6px; padding: 5px 6px; margin-bottom: 0;
      background: var(--bg-input); border: 1px solid rgba(138,115,68,0.3);
      border-radius: 4px; transition: var(--transition);
    }
    .ability-card:hover { border-color: var(--gold-dark); background: var(--bg-panel-hover); }
    .ability-icon {
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      font-size: 18px; background: radial-gradient(circle, var(--bg-panel) 50%, var(--bg-dark));
      border: 1px solid var(--gold-dark); border-radius: 4px; flex-shrink: 0;
      position: relative; cursor: help;
    }
    .ability-icon.castable { cursor: pointer; transition: var(--transition); }
    .ability-icon.castable:hover:not(.disabled) {
      border-color: var(--gold);
      box-shadow: 0 0 10px var(--gold-glow);
      transform: scale(1.08);
    }
    .ability-icon.castable:active:not(.disabled) { transform: scale(0.95); }
    .ability-icon.castable.disabled { cursor: not-allowed; opacity: 0.5; }
    .ability-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; }
    .ability-info { flex: 1; min-width: 0; }
    .ability-name { font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ability-school {
      font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;
    }
    .ability-req-tag { color: #9b59b6; font-weight: 600; }
    .ability-stats { display: flex; gap: 6px; margin-top: 2px; font-size: 11px; flex-wrap: nowrap; overflow: hidden; }
    .ability-stat { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
    .ability-stat.dmg { color: var(--danger); }
    .ability-stat.heal { color: var(--success); }
    .ability-stat.cost { color: var(--mana); }
    .ability-stat.bonus { color: var(--gold); font-size: 10px; }
    .ability-stat.shard-gen { color: #b347ff; display: flex; align-items: center; gap: 3px; }
    .ability-stat.shard-cost { color: #ff6b6b; display: flex; align-items: center; gap: 3px; }
    .shard-mini {
      display: inline-block;
      width: 7px;
      height: 7px;
      transform: rotate(45deg);
      background: linear-gradient(135deg, #b347ff, #7a1cc7);
      border: 1px solid #d488ff;
      border-radius: 1px;
    }

    .ability-card.ability-locked { opacity: 0.5; }

    .ability-cast-col {
      display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0;
    }
    .ability-roll-text {
      font-family: 'Cinzel', serif; font-size: 12px; color: var(--gold-light);
      font-weight: 700; text-align: center; min-width: 30px;
    }
    .ability-roll-text.crit-roll {
      color: #ff9c00; text-shadow: 0 0 6px rgba(255,156,0,0.5); font-size: 14px;
    }
    .cast-btn {
      padding: 3px 10px; font-family: 'Cinzel', serif; font-size: 10px; font-weight: 600;
      background: linear-gradient(180deg, var(--mana) 0%, var(--mana-dark) 100%);
      border: 1px solid #5a9aff; border-radius: 4px; color: #fff; cursor: pointer;
      transition: var(--transition); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .cast-btn:hover:not(:disabled) {
      box-shadow: 0 0 10px rgba(59,127,224,0.5); filter: brightness(1.15);
    }
    .cast-btn:active:not(:disabled) { transform: scale(0.95); }
    .cast-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .locked-abilities-section {
      margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--gold-dark);
    }
    .locked-abilities-title {
      font-family: 'Cinzel', serif; font-size: 10px; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;
    }
    .locked-ability {
      display: flex; align-items: center; gap: 4px; padding: 3px 6px;
      margin-bottom: 2px; background: rgba(0,0,0,0.3); border: 1px solid rgba(138,115,68,0.2);
      border-radius: 4px; opacity: 0.6;
    }
    .locked-ability-icon { font-size: 14px; filter: grayscale(1); }
    .locked-ability-name { flex: 1; font-size: 11px; color: var(--text-dim); }
    .locked-ability-req { font-size: 10px; color: var(--danger); font-family: 'Cinzel', serif; }

    .train-btn {
      float: right; padding: 4px 14px; font-family: 'Cinzel', serif; font-size: 12px;
      font-weight: 600; background: linear-gradient(180deg, var(--bg-input) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: 4px; color: var(--text-dim);
      cursor: pointer; transition: var(--transition); text-transform: uppercase; letter-spacing: 0.05em;
    }
    .train-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold-light); }
    .train-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .train-btn.train-available {
      color: var(--success); border-color: rgba(95,168,95,0.5);
      animation: pulse-train 2s infinite;
    }
    @keyframes pulse-train {
      0%, 100% { box-shadow: 0 0 0 rgba(95,168,95,0); }
      50% { box-shadow: 0 0 8px rgba(95,168,95,0.4); }
    }

    .ability-rank-badge {
      position: absolute; bottom: -4px; right: -4px;
      background: var(--gold); color: var(--bg-dark);
      font-size: 10px; font-weight: 700; font-family: 'Cinzel', serif;
      padding: 1px 5px; border-radius: 8px; line-height: 1;
    }
    .ability-cd-badge {
      position: absolute; top: -4px; left: -4px;
      background: #c0392b; color: #fff;
      font-size: 11px; font-weight: 700;
      padding: 2px 6px; border-radius: 50%; line-height: 1;
    }
    .ability-icon.on-cooldown { filter: grayscale(0.7) brightness(0.5); }
    .ability-card.ability-cd { opacity: 0.6; }

    .locked-ability.trainable {
      opacity: 0.8; border-color: rgba(95,168,95,0.3);
    }
    .locked-ability.trainable .locked-ability-req { color: var(--success); }

    .action-bar {
      display: flex; gap: 12px; margin-top: 20px; justify-content: center; flex-wrap: wrap;
    }
    .action-btn {
      padding: 10px 24px; font-family: 'Cinzel', serif; font-size: 14px; font-weight: 600;
      letter-spacing: 0.05em; background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius); color: var(--gold);
      cursor: pointer; transition: var(--transition); text-transform: uppercase;
    }
    .action-btn:hover {
      background: linear-gradient(180deg, var(--bg-panel-hover) 0%, var(--bg-panel) 100%);
      border-color: var(--gold); color: var(--gold-light); box-shadow: 0 0 10px var(--gold-glow);
    }
    .action-btn:active { transform: scale(0.97); }
    .action-btn.danger { color: var(--danger); border-color: rgba(196,81,81,0.4); }
    .action-btn.danger:hover { border-color: var(--danger); box-shadow: 0 0 10px rgba(196,81,81,0.3); }
    .turn-btn-row {
      display: flex;
      flex-direction: row;
      gap: 6px;
      width: 100%;
      align-items: stretch;
    }
    .end-turn-btn {
      flex: 1 1 75%;
      background: linear-gradient(180deg, #2d4a1e 0%, #1a2d10 100%);
      border-color: #4a7c2e; color: #7cc44a;
    }
    .end-turn-btn:hover {
      background: linear-gradient(135deg, #a02828, #d04040);
    }
    .full-rest-btn {
      flex: 0 0 42px;
      background: linear-gradient(135deg, #1a4a7a, #2a6aaa);
      color: #fff;
      font-size: 18px;
      padding: 4px;
      border: 1px solid #3a8aba;
    }
    .full-rest-btn:hover {
      background: linear-gradient(135deg, #2a5a8a, #3a7aba);
    }

    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal-content {
      background: var(--bg-panel); border: 1px solid var(--gold); border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 20px var(--gold-glow);
      padding: 24px; max-width: 600px; width: 90%;
    }
    .modal-title { font-family: 'Cinzel', serif; font-size: 18px; color: var(--gold-light); margin-bottom: 16px; }
    .modal-textarea {
      width: 100%; height: 240px; background: var(--bg-input); border: 1px solid var(--gold-dark);
      border-radius: 4px; color: var(--text); padding: 12px; font-family: monospace;
      font-size: 12px; resize: vertical; outline: none;
    }
    .modal-actions { display: flex; gap: 12px; margin-top: 16px; justify-content: flex-end; }

    .talent-modal {
      max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;
    }
    .talent-modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }

    .toast {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; background: var(--bg-panel); border: 1px solid var(--gold);
      border-radius: var(--radius); color: var(--gold-light); font-family: 'Cinzel', serif;
      font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 12px var(--gold-glow);
      z-index: 200; animation: toast-in 0.3s ease;
    }
    @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
    .master-msg {
      background: linear-gradient(135deg, #1a1a2e, #2a1a3e);
      border-color: #b8860b;
      bottom: 70px;
    }
    .pet-swap-warning {
      position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%);
      padding: 14px 20px; background: linear-gradient(135deg, #2a0a0a, #3a1515);
      border: 2px solid #c0392b; border-radius: var(--radius);
      color: #ffcc66; font-family: 'Cinzel', serif; font-size: 13px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 12px rgba(192, 57, 43, 0.3);
      z-index: 210; animation: toast-in 0.3s ease;
    }
    .pet-swap-confirm, .pet-swap-cancel {
      padding: 4px 12px; border: 1px solid var(--gold-dark); border-radius: 4px;
      background: var(--bg-input); color: var(--gold-light); cursor: pointer;
      font-family: 'Cinzel', serif; font-size: 12px;
    }
    .pet-swap-confirm { border-color: #c0392b; color: #ff7070; }
    .pet-swap-confirm:hover { background: #c0392b; color: #fff; }
    .pet-swap-cancel:hover { background: var(--gold-dark); color: #fff; }

    .resource-section {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;
      padding: 10px 14px; background: linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,178,126,0.08);
      position: relative; overflow: hidden;
    }
    .resource-section::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--class-color, #C79C6E), transparent);
      opacity: 0.4;
    }
    .quick-icons {
      display: flex; gap: 6px; align-items: center; flex-shrink: 0;
    }
    .quick-icon-btn {
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      background: var(--bg-panel); border: 1px solid var(--gold-dark); border-radius: var(--radius);
      cursor: pointer; transition: var(--transition); font-size: 16px;
    }
    .quick-icon-btn:hover {
      border-color: var(--gold); box-shadow: 0 0 8px var(--gold-glow); transform: scale(1.05);
    }
    .quick-icon-btn.talent-btn { position: relative; }
    .quick-icon-btn.talent-btn.has-points {
      border-color: var(--gold); box-shadow: 0 0 8px var(--gold-glow);
      animation: pulse-gold 2s ease-in-out infinite;
    }
    .tp-badge-mini {
      position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; font-family: 'Cinzel', serif;
      background: var(--gold); color: var(--bg-dark); border-radius: 8px;
      padding: 0 4px; border: 1px solid var(--bg-dark);
    }
    @keyframes pulse-gold {
      0%, 100% { box-shadow: 0 0 4px var(--gold-glow); }
      50% { box-shadow: 0 0 12px var(--gold-glow); }
    }
    .xp-bottom-bar { margin-top: 20px; }
    .xp-mini-bar { margin-top: 6px; }

    .pet-inline {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pet-icon-sm { font-size: 16px; }
    .pet-icon-img-sm {
      width: 21px; height: 21px; border-radius: 3px;
      border: 1px solid rgba(139, 45, 240, 0.4);
    }
    .pet-bars-inline {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 70px;
    }
    .pet-bars-inline .pet-hp-track,
    .pet-bars-inline .pet-mana-track {
      height: 6px !important;
      border-radius: 3px;
    }
    .pet-abilities-inline {
      display: flex;
      gap: 3px;
    }
    .pet-ability-icon-btn {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(139, 45, 240, 0.15);
      border: 1px solid rgba(139, 45, 240, 0.35);
      border-radius: 4px;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
      overflow: hidden;
    }
    .pet-ability-icon-img {
      width: 24px; height: 24px; border-radius: 3px;
    }
    .pet-ability-icon-btn:hover:not(:disabled) {
      background: rgba(139, 45, 240, 0.35);
      border-color: #b347ff;
    }
    .pet-ability-icon-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .combo-warlock {
      gap: 6px;
    }
    .warlock-bottom-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: nowrap;
    }
    .shard-pips {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      max-width: 200px;
    }
    .shard-pip {
      width: 10px;
      height: 10px;
      transform: rotate(45deg);
      border: 1px solid rgba(139, 45, 240, 0.3);
      background: rgba(20, 10, 30, 0.5);
      border-radius: 1px;
      transition: all 0.2s ease;
    }
    .shard-pip.active {
      background: linear-gradient(135deg, #b347ff, #7a1cc7);
      border-color: #d488ff;
      box-shadow: 0 0 4px rgba(139, 45, 240, 0.6);
    }
    .xp-mini-track {
      height: 10px;
      background: var(--bg-input);
      border: 1px solid rgba(138, 115, 68, 0.3);
      border-radius: 5px;
      overflow: hidden;
      position: relative;
    }
    .xp-mini-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
      background: linear-gradient(180deg, #b06bd9, #7a3ba8);
      box-shadow: inset 0 1px rgba(255,255,255,0.2);
    }
    .xp-mini-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 9px;
      font-weight: 600;
      color: #fff;
      text-shadow: 1px 1px 1px rgba(0,0,0,0.8);
      white-space: nowrap;
    }
    .stats-modal { max-width: 500px; }
    .stats-modal-body { max-height: 60vh; overflow-y: auto; }
    .equip-modal { max-width: 600px; }
    .equip-modal-body { max-height: 60vh; overflow-y: auto; }

    .xp-section { margin-bottom: 0; flex: 1; min-width: 0; }

    .top-bar-row {
      display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; flex-wrap: wrap;
    }
    .top-side-controls {
      display: flex; flex-direction: column; gap: 10px; align-items: stretch; min-width: 220px;
    }

    .lang-toggle-btn {
      align-self: flex-end; padding: 4px 10px; font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600;
      background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: 4px; color: var(--gold-light);
      cursor: pointer; transition: var(--transition); letter-spacing: 0.03em; width: fit-content;
    }
    .lang-toggle-btn:hover { border-color: var(--gold); color: var(--gold); }

    .warrior-stance-row, .warrior-weapon-row { display: flex; gap: 4px; }
    .stance-btn, .weapon-mode-btn {
      flex: 1; padding: 6px 8px; font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600;
      background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: 4px; color: var(--text-dim);
      cursor: pointer; transition: var(--transition); text-transform: uppercase; letter-spacing: 0.03em;
      display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .stance-icon { width: 18px; height: 18px; border-radius: 3px; }
    .stance-btn:hover, .weapon-mode-btn:hover {
      border-color: var(--gold); color: var(--gold-light);
    }
    .stance-btn.active, .weapon-mode-btn.active {
      background: linear-gradient(180deg, #2d3a1e 0%, #1a2310 100%);
      border-color: #6ba83a; color: #a0e060; box-shadow: 0 0 8px rgba(108,168,58,0.3);
    }
    .action-slots-row {
      display: flex; flex-direction: row; align-items: center; gap: 8px;
      justify-content: center; width: 100%; margin-top: 4px;
    }
    .action-slots-label {
      font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.05em; color: var(--text-dim);
      text-transform: uppercase; white-space: nowrap;
    }
    .action-slots { display: flex; gap: 6px; }
    .action-slot {
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      font-size: 22px; background: rgba(0,0,0,0.4); border: 1px solid var(--gold-dark);
      border-radius: 6px; transition: all 0.2s;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .action-slot .spent-icon { color: var(--text-muted); opacity: 0.2; font-size: 20px; }
    .action-slot.spent {
      background: rgba(0,0,0,0.6); border-color: rgba(138,115,68,0.2);
      opacity: 0.3;
    }
    .action-slot:not(.spent) {
      background: linear-gradient(180deg, rgba(59,127,224,0.15) 0%, rgba(0,0,0,0.4) 100%);
      border-color: var(--mana); box-shadow: 0 0 8px rgba(59,127,224,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .action-slot.snD:not(.spent) {
      background: linear-gradient(180deg, rgba(231,76,60,0.15) 0%, rgba(0,0,0,0.4) 100%);
      border-color: #e74c3c; box-shadow: 0 0 8px rgba(231,76,60,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .move-btn {
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      font-size: 20px; background: rgba(0,0,0,0.3); border: 1px solid var(--gold-dark);
      border-radius: 6px; cursor: pointer; transition: var(--transition);
    }
    .move-btn:hover:not(:disabled) {
      border-color: var(--gold); box-shadow: 0 0 6px var(--gold-glow); transform: scale(1.05);
    }
    .move-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .turn-damage-box {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius); padding: 10px 16px;
    }
    .turn-damage-label {
      font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.05em; color: var(--text-dim);
      text-transform: uppercase;
    }
    .turn-damage-value {
      font-size: 32px; font-weight: 700; color: #c0392b; font-family: 'Cinzel', serif; line-height: 1;
    }
    .hp-action-row { display: flex; gap: 6px; align-items: stretch; }
    .hp-loss-input {
      width: 70px; padding: 8px; text-align: center; font-size: 16px; font-weight: 600;
      background: var(--bg-dark); border: 1px solid var(--gold-dark); border-radius: var(--radius);
      color: var(--text); outline: none;
    }
    .hp-loss-input:focus { border-color: var(--gold); }
    .hp-loss-type {
      padding: 8px 6px; background: var(--bg-dark); border: 1px solid var(--gold-dark);
      border-radius: var(--radius); color: var(--text); font-size: 13px; outline: none; cursor: pointer;
    }
    .hp-loss-type option { background: var(--bg-dark); }
    .hp-loss-btn {
      padding: 8px 12px; font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
      background: linear-gradient(180deg, #4a1a1a 0%, #2d0e0e 100%);
      border: 1px solid #8b2e2e; border-radius: var(--radius); color: #e07070;
      cursor: pointer; transition: var(--transition); text-transform: uppercase; white-space: nowrap;
    }
    .hp-loss-btn:hover {
      background: linear-gradient(180deg, #5e2222 0%, #3d1414 100%);
      border-color: #c0392b; color: #ff9090; box-shadow: 0 0 10px rgba(192,57,43,0.3);
    }
    .hp-loss-btn.heal-btn {
      background: linear-gradient(180deg, #1e4a2d 0%, #102d10 100%);
      border-color: #4a8e3a; color: #7cc44a;
    }
    .hp-loss-btn.heal-btn:hover {
      background: linear-gradient(180deg, #2a5e3a 0%, #1a3a1a 100%);
      border-color: #6ba83a; color: #a0e060; box-shadow: 0 0 10px rgba(108,168,58,0.3);
    }
    .hp-loss-btn:active { transform: scale(0.97); }
    .xp-bar-wrapper {
      background: linear-gradient(170deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: var(--radius);
      padding: 12px 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,178,126,0.08);
    }
    .xp-bar-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 6px; font-size: 13px;
    }
    .xp-bar-label { color: var(--text-dim); font-family: 'Cinzel', serif; letter-spacing: 0.05em; }
    .xp-bar-value { color: var(--gold-light); font-weight: 600; }
    .xp-bar-track {
      height: 18px; background: var(--bg-input); border: 1px solid var(--gold-dark);
      border-radius: 4px; overflow: hidden; position: relative;
    }
    .xp-bar-fill {
      height: 100%; border-radius: 3px; transition: width 0.5s ease;
      background: linear-gradient(180deg, #ff9c00 0%, #cc6b00 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
      position: relative;
    }
    .xp-bar-fill::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%;
      background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%);
      border-radius: 3px 3px 0 0;
    }
    .xp-bar-text {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 11px; font-weight: 600; color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap;
    }
    .xp-controls { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .xp-input {
      width: 90px; background: var(--bg-input); border: 1px solid var(--gold-dark);
      border-radius: 3px; color: var(--text); padding: 4px 8px;
      font-family: 'EB Garamond', serif; font-size: 14px; outline: none;
    }
    .xp-input:focus { border-color: var(--gold); }
    .xp-quick-btns { display: flex; gap: 6px; }
    .xp-quick-btn {
      padding: 4px 12px; background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark); border-radius: 3px; color: var(--gold);
      font-family: 'Cinzel', serif; font-size: 12px; cursor: pointer; transition: var(--transition);
    }
    .xp-quick-btn:hover {
      border-color: var(--gold); color: var(--gold-light);
      box-shadow: 0 0 8px var(--gold-glow);
    }
    .xp-quick-btn:active { transform: scale(0.95); }
    .xp-levelup-anim { animation: levelup-flash 0.8s ease; }
    @keyframes levelup-flash {
      0% { box-shadow: 0 0 0 rgba(255,156,0,0); }
      50% { box-shadow: 0 0 30px rgba(255,156,0,0.8); border-color: #ff9c00; }
      100% { box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    }

    .wow-panel { animation: fade-in 0.4s ease backwards; }
    .wow-panel:nth-child(1) { animation-delay: 0.05s; }
    .wow-panel:nth-child(2) { animation-delay: 0.1s; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `],
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
        } else if (event.type === 'monsterAttack') {
          this.hpAction(event.amount, event.damageType || 'physical');
          let effText = '';
          if (event.inflictsEffects && Array.isArray(event.inflictsEffects)) {
            for (const eff of event.inflictsEffects) {
              this.charSvc.addEffect({
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
            this.charSvc.addEffect(event.effect);
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
    return Array.from({ length: 10 }, (_, i) => i + 1);
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
      this.charSvc.showToast('Sin acciones disponibles para cambiar de estancia.');
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.warriorStance.set(stance);
  }

  changeWeaponMode(mode: string) {
    if (this.charSvc.warriorWeaponMode() === mode) return;
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast('Sin acciones disponibles para cambiar de arma.');
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
    this.charSvc.showToast('Clase cambiada a ' + this.charSvc.classConfig().name);
  }

  castPetAbility(ability: any) {
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast('Sin acciones disponibles');
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
      } else if (ability.currentBuffValue) {
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ' — ' + ability.currentBuffStat +
          ' +' + ability.currentBuffValue + ' (' + ability.currentBuffDuration + 't) — enviado al Master'
        );
      } else {
        this.charSvc.showToast(ability.name + ' — Lanzado');
      }
    }
  }

  addXP(amount: number) {
    if (amount <= 0) return;
    if (this.charSvc.character().level >= MAX_LEVEL) {
      this.charSvc.showToast('Nivel maximo alcanzado');
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
      this.charSvc.showToast('¡Nivel ' + level + '! +' + levelsGained + ' nivel' + (levelsGained > 1 ? 'es' : ''));
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
      this.charSvc.showToast('Nivel maximo alcanzado');
      return;
    }
    this.charSvc.character.update(c => ({ ...c, level: newLevel, currentXP: 0 }));
    this.levelUpFlash.set(true);
    setTimeout(() => this.levelUpFlash.set(false), 800);
    this.charSvc.showToast('¡Nivel ' + newLevel + '! +' + levels + ' nivel' + (levels > 1 ? 'es' : ''));
    this.charSvc.saveToLocalStorage();
  }

  moveAction() {
    if (!this.charSvc.canAct(1)) {
      this.charSvc.showToast('Sin acciones disponibles. Finaliza el turno.');
      return;
    }
    this.charSvc.useAction(1);
    this.charSvc.showToast('🥾 Movimiento — 1 accion gastada');
  }

  endTurn() {
    const oldTurn = this.charSvc.turnNumber();
    this.processEffects();

    const petAttack = this.charSvc.petAttack();
    if (petAttack) {
      this.charSvc.addTurnDamage(petAttack.damage);
      this.charSvc.showToast(`👹 ${petAttack.name}: ${petAttack.damage} danyo de ${petAttack.school}`);
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

    this.charSvc.nextTurn();
    const resType = this.charSvc.resourceConfig().type;
    if (resType === 'rage') {
      this.charSvc.showToast('Fin de turno ' + oldTurn);
    } else if (resType === 'energy') {
      const regen = Math.round((this.charSvc.resourceConfig().regen || 20) * (1 + this.charSvc.talentRank('vitality') * 0.10));
      this.charSvc.showToast('Fin de turno ' + oldTurn + ' · +' + regen + ' energia');
    } else {
      const regen = this.charSvc.manaRegen();
      this.charSvc.showToast('Fin de turno ' + oldTurn + ' · +' + regen + ' mana regenerado');
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

  hpAction(amount: number, actionType: string) {
    if (amount <= 0) return;
    this.hpLossAmount.set(0);

    if (actionType === 'heal') {
      const maxHP = this.charSvc.maxHP();
      this.charSvc.character.update(c => ({
        ...c,
        currentHP: Math.min(maxHP, this.charSvc.hpActual() + amount),
      }));
      this.charSvc.showToast('+' + amount + ' vida');
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
      this.charSvc.showToast('🛡️ Escudo: ' + amount + ' absorcion');
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
        this.charSvc.showToast('¡Esquivado!' + rageText);
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
            this.charSvc.showToast('🛡️ Escudo absorbido por completo');
          } else {
            this.charSvc.character.update(c => ({
              ...c,
              activeEffects: (c.activeEffects || []).map(e =>
                e.target === 'shield' ? { ...e, value: newShieldValue } : e
              ),
            }));
            this.charSvc.showToast('🛡️ Escudo absorbe ' + amount + ' (quedan ' + newShieldValue + ')');
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
        this.charSvc.showToast('-' + remaining + ' vida' + rageText);
      } else {
        this.charSvc.showToast('-' + amount + ' vida' + rageText);
      }
    }
  }

  castSpell(ability: any) {
    const resType = this.charSvc.resourceConfig().type;
    const isRage = resType === 'rage';
    const isEnergy = resType === 'energy';
    let cost: number;
    if (isRage) {
      cost = this.charSvc.getEffectiveRageCost(ability);
    } else if (isEnergy) {
      cost = this.charSvc.getEffectiveEnergyCost(ability);
    } else {
      cost = ability.scaledCost || ability.computedCost;
    }

    const resourceActual = this.charSvc.resourceActual();
    const resourceMax = this.charSvc.resourceMax();
    const manaActual = this.charSvc.manaActual();
    const cd = this.charSvc.getCooldown(ability.id);

    if (resourceActual < cost) {
      this.charSvc.showToast(this.resourceLabel() + ' insuficiente');
      return;
    }
    if (cd > 0) {
      this.charSvc.showToast(ability.name + ' esta en cooldown (' + cd + ' turno' + (cd > 1 ? 's' : '') + ')');
      return;
    }

    const actionCost = ability.noGcd ? 0 : (ability.castType === 'instant' ? 1 : 2);
    if (!this.charSvc.canAct(actionCost)) {
      this.charSvc.showToast('Sin acciones disponibles. Finaliza el turno.');
      return;
    }

    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      if (this.charSvc.getShards() < shardCost) {
        this.charSvc.showToast('Necesitas ' + shardCost + ' Soul Shard' + (shardCost > 1 ? 's' : ''));
        return;
      }
    }

    if (ability.spendsCombo && (this.charSvc.character().comboPoints || 0) === 0) {
      this.charSvc.showToast('Sin puntos de combo');
      return;
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

    const clearcast = (isRage || isEnergy) ? false : this.charSvc.checkClearcasting();

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
    } else if (!clearcast) {
      this.charSvc.character.update(c => ({
        ...c,
        currentMana: manaActual - cost,
      }));
    }

    const min = ability.currentMin || 0;
    const max = ability.currentMax || 0;
    let roll = min + Math.floor(Math.random() * (max - min + 1));
    let critChance = parseFloat((isRage || isEnergy) ? this.charSvc.meleeCrit() : this.charSvc.spellCrit());
    if (ability.id === 'mind_blast') {
      critChance += this.charSvc.talentRank('improved_mind_blast') * 10;
    }
    if (ability.castType === 'instant' && this.charSvc.character().classKey === 'mage') {
      critChance += this.charSvc.talentRank('magic_resistance') * 1;
    }
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) roll = Math.round(roll * 1.5);
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

    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      this.charSvc.spendShards(shardCost);
    }

    if (ability.spendsNotes) {
      const notes = this.charSvc.getNotes();
      if (notes.length === 0) {
        this.charSvc.showToast('Sin notas en la partitura');
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

    let shardText = '';
    if (ability.generatesShard) {
      this.charSvc.addShard(ability.generatesShard);
      shardText = ' · +' + ability.generatesShard + ' 🔮 (' + this.charSvc.getShards() + '/10)';
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
        ' — enviado al Master'
      );
      this.charSvc.sendHealEvent(ability, hotTotal);
    } else if (ability.isDot) {
      let dotTotal = ability.dotTotal;
      let dotTick = ability.dotTick;
      if (evText) {
        const boost = 1 + this.charSvc.talentRank('evangelism') * 0.03;
        dotTotal = Math.round(dotTotal * boost);
        dotTick = Math.round(dotTotal / ability.dotDuration);
      }
      const impGarrote = this.charSvc.talentRank('improved_garrote');
      if (ability.id === 'garrote' && impGarrote > 0) {
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + dotTick + '/turno · ' +
          ability.dotDuration + 't (' + dotTotal + ' total) + Silencio' + evText + ' — aplicalo al enemigo'
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
          ability.dotDuration + 't (' + dotTotal + ' total)' + evText + ' — aplicalo al enemigo'
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
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + noteText + ' — enviado al Master'
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
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + noteText + darkMendingText + ' — enviado al Master'
        );
        this.charSvc.sendHealEvent(ability, roll);
      }
    } else {
      const poisonDmg = this.charSvc.getPoisonDamage();
      if (poisonDmg > 0 && ability.damageType === 'physical') {
        roll += poisonDmg;
      }
      if (ability.id === 'basic_attack' && this.charSvc.classConfig().abilities) {
        const belRank = this.charSvc.talentRank('beligerance');
        if (belRank > 0) {
          const spirit = this.charSvc.character().espiritu || 0;
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
        const heal = Math.round(roll * ability.lifestealPct);
        this.charSvc.character.update(c => ({
          ...c,
          currentHP: Math.min(this.charSvc.maxHP(), (c.currentHP || 0) + heal),
        }));
        lifestealText = ' · +' + heal + ' vida';
      }
      const dmgText = isCrit ? '¡CRITICO!' : ability.inflictsEffects ? '¡Aturde al enemigo!' : 'Lanzado';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + dmgText + ccText + rageText + comboText + shardText + lifestealText + noteText + evText + boostText + unyieldingText
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
        this.charSvc.sendDamageEvent(ability, hitRoll, h + 1, hits);
      }
    }
  }

  castUtility(ability: any) {
    const resType = this.charSvc.resourceConfig().type;
    const isRage = resType === 'rage';
    const isEnergy = resType === 'energy';
    let cost: number;
    if (isRage) {
      cost = ability.costRage || 0;
    } else if (isEnergy) {
      cost = this.charSvc.getEffectiveEnergyCost(ability);
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
      this.charSvc.showToast(ability.name + ' esta en cooldown (' + cd + ' turno' + (cd > 1 ? 's' : '') + ')');
      return;
    }
    if (ability.blockedStance && this.charSvc.warriorStance() === ability.blockedStance) {
      this.charSvc.showToast(ability.name + ' no se puede usar en esta estancia');
      return;
    }

    const actionCost = ability.noGcd ? 0 : (ability.castType === 'instant' ? 1 : 2);
    if (!this.charSvc.canAct(actionCost)) {
      this.charSvc.showToast('Sin acciones disponibles. Finaliza el turno.');
      return;
    }

    if (ability.spendsShards) {
      const shardCost = ability.shardCost || 3;
      if (this.charSvc.getShards() < shardCost) {
        this.charSvc.showToast('Necesitas ' + shardCost + ' Soul Shard' + (shardCost > 1 ? 's' : ''));
        return;
      }
    }

    if (ability.spendsNotes) {
      const notes = this.charSvc.getNotes();
      if (notes.length === 0) {
        this.charSvc.showToast('Sin notas en la partitura');
        return;
      }
    }

    this.charSvc.useAction(actionCost);

    if (isRage) {
      if (resourceActual < cost) {
        this.charSvc.showToast('Ira insuficiente');
        return;
      }
      this.charSvc.character.update(c => ({
        ...c,
        currentRage: Math.min(resourceMax, resourceActual - cost),
      }));
    } else if (isEnergy) {
      if (resourceActual < cost) {
        this.charSvc.showToast('Energia insuficiente');
        return;
      }
      this.charSvc.character.update(c => ({
        ...c,
        currentEnergy: Math.max(0, resourceActual - cost),
      }));
    } else {
      if (manaActual < cost) {
        this.charSvc.showToast('Mana insuficiente');
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
      if (ability.spendsShards) {
        this.charSvc.spendShards(ability.shardCost || 1);
      }
      this.charSvc.summonPet(ability.isPetSummon);
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
      let sndComboSpent = 0;
      if (ability.id === 'slice_and_dice') {
        sndComboSpent = this.charSvc.character().comboPoints || 0;
        if (sndComboSpent === 0) {
          this.charSvc.showToast('Sin puntos de combo');
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
        sndDuration = sndComboSpent + this.charSvc.talentRank('improved_slice_and_dice');
      }
      this.charSvc.character.update(c => ({
        ...c,
        ...(ability.id === 'slice_and_dice' ? { comboPoints: 0 } : {}),
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== ability.name),
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
      const sndText = ability.id === 'slice_and_dice' ? ' · +1 accion/turno · ' + sndComboSpent + ' combo gastados' : '';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': +' + buffValue +
        (ability.buff.isPercent ? '%' : '') + ' ' + ability.currentBuffStat +
        sndText + ' — enviado al Master'
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
        ability.name + ' R' + ability.currentRank + ': ' + buffText + ' — enviado al Master'
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
      return { ...c, currentHP: maxHP, comboPoints: 0, musicalNotes: [], currentCooldowns: {}, activeEffects: effects };
    });
    if (this.charSvc.resourceConfig().type === 'rage') {
      this.charSvc.character.update(c => ({ ...c, currentRage: 0 }));
      this.charSvc.showToast('Full Rest: vida al maximo, ira reseteada, buffs -2 turnos');
    } else if (this.charSvc.resourceConfig().type === 'energy') {
      this.charSvc.character.update(c => ({ ...c, currentEnergy: resourceMax }));
      this.charSvc.showToast('Full Rest: vida y energia al maximo, buffs -2 turnos');
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
      this.charSvc.character.update(c => ({ ...c, talents: {} }));
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
    return 'Mana';
  }

  resourceBarBackground(): string {
    const type = this.charSvc.resourceConfig().type;
    if (type === 'rage') return 'linear-gradient(180deg, #c0392b 0%, #8b2e1e 100%)';
    if (type === 'energy') return 'linear-gradient(180deg, #f1c40f 0%, #b7950b 100%)';
    return 'linear-gradient(180deg, #3498db 0%, #2471a3 100%)';
  }

  lockedAbilities(): any[] {
    return this.charSvc.classConfig().abilities.filter(a => {
      if (a.type === 'utility') return false;
      return this.charSvc.maxAvailableRank(a) === 0 && this.charSvc.trainedRank(a.id) === 0;
    });
  }

  visibleEquipmentSlots(): any[] {
    const slots = [...EQUIPMENT_SLOTS];
    if (this.charSvc.character().classKey === 'warrior' && this.charSvc.talentRank('master_of_weapons') > 0) {
      slots.push({
        key: 'twoHand',
        label: 'Dos Manos',
        icon: '⚔️',
        extraFields: [{ key: 'weaponDamage', label: 'Dano', icon: '💥' }],
      });
    }
    return slots;
  }
}
