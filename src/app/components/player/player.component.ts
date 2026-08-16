import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { ClassRegistryService } from '../../services/class-registry.service';
import {
  STAT_KEYS, STAT_ICONS, EFFECT_TYPES, BUFF_DEBUFF_STATS,
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
    <div class="app-header">
      <div class="class-icon">
        @if (charSvc.classConfig().iconImg) {
          <img [src]="charSvc.classConfig().iconImg" class="class-icon-img" (error)="onImgError($event)">
          <span style="display:none">{{ charSvc.classConfig().icon }}</span>
        } @else {
          <span>{{ charSvc.classConfig().icon }}</span>
        }
      </div>
      <div class="header-info">
        <input [value]="charSvc.character().name" (input)="onNameInput($event)" class="char-name-input" placeholder="Nombre del personaje">
        <div class="char-meta">
          <span class="level-control">
            Nivel
            <button class="stat-btn" (click)="changeLevel(-1)">-</button>
            <input type="number" [value]="charSvc.character().level" min="1" [attr.max]="MAX_LEVEL" (input)="onLevelInput($event)" (change)="clampLevel()">
            <button class="stat-btn" (click)="changeLevel(1)">+</button>
          </span>
          <select [value]="charSvc.character().classKey" (change)="onClassChange($event)" class="class-select">
            @for (entry of classEntries; track entry[0]) {
              <option [value]="entry[0]">{{ entry[1].name }}</option>
            }
          </select>
        </div>
      </div>
      <div class="tp-badge" [class.has-points]="charSvc.availableTalentPoints() > 0"
           (click)="showTalentModal.set(true)" style="cursor: pointer;" title="Abrir arbol de talentos">
        <span>Puntos de Talento</span>
        <span class="tp-value">{{ charSvc.availableTalentPoints() }}</span>
      </div>
    </div>

    <div class="top-bar-row">
      <div class="resource-section">
        <div class="resource-bar">
          <div class="resource-label">
            <span>Vida@if (shieldValue() > 0) {<span class="shield-text"> shield {{ shieldValue() }}</span>}</span>
            <span>{{ charSvc.hpActual() }} / {{ charSvc.maxHP() }}</span>
          </div>
          <div class="resource-track">
            <div class="resource-fill hp" [style.width]="charSvc.hpPercent() + '%'"></div>
            @if (shieldValue() > 0) {
              <div class="resource-fill shield" [style.width]="shieldPercent() + '%'"></div>
            }
            <div class="resource-text">{{ charSvc.hpActual() }} / {{ charSvc.maxHP() }}@if (shieldValue() > 0) { +{{ shieldValue() }} }</div>
          </div>
        </div>

        <div class="resource-bar">
          <div class="resource-label">
            <span>{{ resourceLabel() }}</span>
            <span>{{ charSvc.resourceActual() }} / {{ charSvc.resourceMax() }}</span>
          </div>
          <div class="resource-track">
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

        <div class="quick-icons">
          <button class="quick-icon-btn" (click)="showStatsModal.set(true)" title="Atributos">
            <span>📊</span>
          </button>
          <button class="quick-icon-btn" (click)="showEquipment.set(true)" title="Equipo">
            <span>🛡️</span>
          </button>
          @if (charSvc.resourceConfig().type === 'energy' || charSvc.classConfig().comboConfig) {
            <div class="combo-inline">
              <div class="combo-points">
                @for (n of comboPointArray(charSvc.classConfig().comboConfig?.max || 5); track n) {
                  <div class="combo-point" [class.active]="n <= (charSvc.character().comboPoints || 0)"></div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div class="top-side-controls">
        @if (charSvc.character().classKey === 'warrior') {
          <div class="warrior-stance-row">
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'battle'" (click)="charSvc.warriorStance.set('battle')">
              <img src="img/talents/warrior/battle_stance.jpg" class="stance-icon" (error)="onImgErrorSimple($event)"> Battle
            </button>
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'fury'" (click)="charSvc.warriorStance.set('fury')">
              Fury
            </button>
            <button class="stance-btn" [class.active]="charSvc.warriorStance() === 'protection'" (click)="charSvc.warriorStance.set('protection')">
              <img src="img/talents/warrior/protection_stance.jpg" class="stance-icon" (error)="onImgErrorSimple($event)"> Prot
            </button>
          </div>
        }
        @if (charSvc.character().classKey === 'warrior' && charSvc.talentRank('master_of_weapons') > 0) {
          <div class="warrior-weapon-row">
            <button class="weapon-mode-btn" [class.active]="charSvc.warriorWeaponMode() === 'dualwield'" (click)="charSvc.warriorWeaponMode.set('dualwield')">1H + Off</button>
            <button class="weapon-mode-btn" [class.active]="charSvc.warriorWeaponMode() === 'twohanded'" (click)="charSvc.warriorWeaponMode.set('twohanded')">2H</button>
          </div>
        }
        <div class="turn-damage-box">
          <span class="turn-damage-label">Dano del Turno</span>
          <span class="turn-damage-value">{{ charSvc.turnDamage() }}</span>
        </div>
        <button class="action-btn end-turn-btn" (click)="endTurn()">Fin de Turno ({{ charSvc.turnNumber() }})</button>
        <div class="hp-action-row">
          <select [value]="hpActionType()" (change)="onHpActionTypeChange($event)" class="hp-loss-type">
            <option value="magical">Magico</option>
            <option value="physical">Fisico</option>
            <option value="heal">Curar</option>
            <option value="shield">Escudo</option>
          </select>
          <input type="number" [value]="hpLossAmount()" (input)="onHpLossInput($event)" class="hp-loss-input" placeholder="—" min="1">
          <button class="hp-loss-btn" (click)="hpAction(hpLossAmount() || 0, hpActionType())"
                  [class.heal-btn]="hpActionType() === 'heal' || hpActionType() === 'shield'">
            {{ hpActionType() === 'heal' ? 'Curar' : hpActionType() === 'shield' ? 'Escudo' : 'Recibir Dano' }}
          </button>
        </div>
      </div>
    </div>

    <div class="effects-section">
      <div class="effects-header" (click)="showEffectsPanel.set(!showEffectsPanel())" style="cursor: pointer;">
        <span class="effects-title">Efectos Activos</span>
        @if (charSvc.character().activeEffects && charSvc.character().activeEffects.length > 0) {
          <span class="effects-count">{{ charSvc.character().activeEffects.length }}</span>
        }
        <span class="effects-toggle">{{ showEffectsPanel() ? '▼' : '▶' }}</span>
      </div>
      @if (showEffectsPanel()) {
        <div class="effects-body">
          @if (charSvc.character().activeEffects && charSvc.character().activeEffects.length > 0) {
            <div class="effects-active-list">
              @for (eff of charSvc.character().activeEffects; track eff.id) {
                <div class="effect-chip" [style.--eff-color]="EFFECT_TYPES[eff.type].color">
                  <span class="effect-icon">{{ EFFECT_TYPES[eff.type].icon }}</span>
                  <span class="effect-name">{{ eff.name }}</span>
                  <span class="effect-value">{{ effectValueText(eff) }}</span>
                  <span class="effect-duration">{{ eff.duration }}t</span>
                  <button class="effect-remove" (click)="removeEffect(eff.id)">✕</button>
                </div>
              }
            </div>
          } @else {
            <div class="effects-empty">Sin efectos activos</div>
          }

          <div class="effect-add-form">
            <select [value]="newEffect().type" (change)="onNewEffectTypeChange($event)" class="effect-input">
              @for (entry of effectTypeEntries; track entry[0]) {
                <option [value]="entry[0]">{{ entry[1].label }}</option>
              }
            </select>

            @if (newEffect().type !== 'status') {
              <input type="text" [value]="newEffect().name" (input)="onNewEffectNameInput($event)"
                     class="effect-input effect-name-field" placeholder="Nombre">
            }

            @if (newEffect().type === 'status') {
              <select [value]="newEffect().target" (change)="onNewEffectTargetChange($event)" class="effect-input">
                @for (s of STATUS_OPTIONS; track s.key) {
                  <option [value]="s.key">{{ s.label }}</option>
                }
              </select>
            }

            @if (newEffect().type === 'buff' || newEffect().type === 'debuff') {
              <select [value]="newEffect().target" (change)="onNewEffectTargetChange($event)" class="effect-input">
                @for (s of BUFF_DEBUFF_STATS; track s.key) {
                  <option [value]="s.key">{{ s.label }}</option>
                }
              </select>
              <input type="number" [value]="newEffect().value" (input)="onNewEffectValueInput($event)"
                     class="effect-input effect-value-field" placeholder="Valor" min="0">
              <input type="number" [value]="newEffect().duration" (input)="onNewEffectDurationInput($event)"
                     class="effect-input effect-dur-field" placeholder="Turnos" min="1">
            }

            @if (newEffect().type === 'hot' || newEffect().type === 'dot') {
              <select [value]="newEffect().target" (change)="onNewEffectTargetChange($event)" class="effect-input">
                @for (t of HOT_DOT_TARGETS; track t.key) {
                  <option [value]="t.key">{{ t.label }}</option>
                }
              </select>
              <input type="number" [value]="newEffect().value" (input)="onNewEffectValueInput($event)"
                     class="effect-input effect-value-field" placeholder="Valor" min="0">
              <input type="number" [value]="newEffect().duration" (input)="onNewEffectDurationInput($event)"
                     class="effect-input effect-dur-field" placeholder="Turnos" min="1">
            }

            @if (newEffect().type === 'misc') {
              <input type="text" [value]="newEffect().target" (input)="onNewEffectMiscTargetInput($event)"
                     class="effect-input" placeholder="Target libre" style="min-width: 120px;">
              <input type="number" [value]="newEffect().value" (input)="onNewEffectValueInput($event)"
                     class="effect-input effect-value-field" placeholder="Valor" min="0">
              <input type="number" [value]="newEffect().duration" (input)="onNewEffectDurationInput($event)"
                     class="effect-input effect-dur-field" placeholder="Turnos" min="1">
            }

            <button class="effect-add-btn" (click)="addEffect()">Anadir</button>
          </div>
        </div>
      }
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
                 [class.ability-locked]="charSvc.resourceActual() < (ability.costRage || ability.scaledCost || 0)"
                 [class.ability-cd]="charSvc.getCooldown(ability.id) > 0">
              <div class="ability-icon" [class.on-cooldown]="charSvc.getCooldown(ability.id) > 0" [title]="ability.description">
                @if (ability.iconImg) {
                  <img [src]="ability.iconImg" class="ability-icon-img" (error)="onImgError($event)">
                  <span style="display:none">{{ ability.icon }}</span>
                } @else {
                  <span>{{ ability.icon }}</span>
                }
                <span class="ability-tooltip">{{ ability.name }} — {{ ability.description }}</span>
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
                  {{ ability.school }} · {{ ability.castType === 'instant' ? 'Inst.' : 'Cast.' }}
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
                    <span class="ability-stat cost">{{ ability.costEnergy || 0 }} en</span>
                  } @else {
                    <span class="ability-stat cost">{{ ability.scaledCost }} mp</span>
                  }
                </div>
                <div class="ability-cast-row">
                  <button class="cast-btn" (click)="castSpell(ability)"
                          [disabled]="charSvc.resourceActual() < (ability.costRage || ability.scaledCost || 0) || charSvc.getCooldown(ability.id) > 0">
                    {{ charSvc.getCooldown(ability.id) > 0 ? 'CD' : 'Lanzar' }}
                  </button>
                  @if (abilityRolls()[ability.id]) {
                    <span class="ability-roll-text" [class.crit-roll]="abilityRolls()[ability.id].crit">
                      {{ ability.type === 'heal' ? '+' : '-' }}{{ abilityRolls()[ability.id].roll }}{{ abilityRolls()[ability.id].crit ? '!' : '' }}
                    </span>
                  }
                </div>
              </div>
            </div>
          }
          </div>

          @if (charSvc.trainableAbilities().length > 0) {
            <div class="locked-abilities-section">
              <div class="locked-abilities-title">Disponibles para entrenar</div>
              @for (ability of charSvc.trainableAbilities(); track ability.id) {
                <div class="locked-ability trainable">
                  <span class="locked-ability-icon">{{ ability.icon }}</span>
                  <span class="locked-ability-name">{{ ability.name }}</span>
                  <span class="locked-ability-req">Rango {{ charSvc.trainedRank(ability.id) + 1 }} → {{ charSvc.maxAvailableRank(ability) }}</span>
                </div>
              }
            </div>
          }

          @if (lockedAbilities().length > 0) {
            <div class="locked-abilities-section">
              <div class="locked-abilities-title">Bloqueadas (nivel insuficiente)</div>
              @for (ability of lockedAbilities(); track ability.id) {
                <div class="locked-ability">
                  <span class="locked-ability-icon">{{ ability.icon }}</span>
                  <span class="locked-ability-name">{{ ability.name }}</span>
                  <span class="locked-ability-req">Nivel {{ ability.requiredLevel }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (charSvc.unlockedUtility().length > 0) {
        <div class="wow-panel">
          <div class="panel-title">Utilidad</div>
          <div class="panel-body">
            <div class="ability-grid">
            @for (ability of charSvc.unlockedUtility(); track ability.id) {
              <div class="ability-card"
                   [class.ability-locked]="charSvc.resourceActual() < (ability.scaledCost || 0)"
                   [class.ability-cd]="charSvc.getCooldown(ability.id) > 0">
                <div class="ability-icon" [class.on-cooldown]="charSvc.getCooldown(ability.id) > 0" [title]="ability.description">
                  @if (ability.iconImg) {
                    <img [src]="ability.iconImg" class="ability-icon-img" (error)="onImgError($event)">
                    <span style="display:none">{{ ability.icon }}</span>
                  } @else {
                    <span>{{ ability.icon }}</span>
                  }
                  <span class="ability-tooltip">{{ ability.name }} — {{ ability.description }}</span>
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
                    {{ ability.school }} · {{ ability.castType === 'instant' ? 'Inst.' : 'Cast.' }}
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
                  <div class="ability-cast-row">
                    <button class="cast-btn" (click)="castUtility(ability)"
                            [disabled]="charSvc.resourceActual() < (ability.scaledCost || 0) || charSvc.getCooldown(ability.id) > 0">
                      {{ charSvc.getCooldown(ability.id) > 0 ? 'CD' : 'Lanzar' }}
                    </button>
                    <span style="flex:1"></span>
                  </div>
                </div>
              </div>
            }
            </div>
          </div>
        </div>
      }

    </div>

    <div class="action-bar">
      <button class="action-btn" (click)="fullRest()">Full Rest</button>
      <button class="action-btn" (click)="saveChar()">Guardar</button>
      <button class="action-btn" (click)="loadChar()">Cargar</button>
      <button class="action-btn" (click)="openExport()">Exportar JSON</button>
      <button class="action-btn danger" (click)="resetCharacter()">Reiniciar</button>
    </div>

    <div class="xp-bottom-bar">
      <div class="xp-bar-wrapper" [class.xp-levelup-anim]="levelUpFlash()">
        <div class="xp-bar-header">
          <span class="xp-bar-label">Experiencia</span>
          <span class="xp-bar-value">{{ charSvc.character().currentXP || 0 }} / {{ charSvc.xpForNextLevel() }}</span>
        </div>
        <div class="xp-bar-track">
          <div class="xp-bar-fill" [style.width]="charSvc.xpProgressPercent() + '%'"></div>
          <div class="xp-bar-text">{{ charSvc.xpProgressPercent() }}%</div>
        </div>
        <div class="xp-controls">
          <input type="number" [value]="xpInputAmount()" (input)="onXpInput($event)" class="xp-input" placeholder="XP" min="1">
          <button class="xp-quick-btn" (click)="addXP(xpInputAmount() || 0)">Anadir XP</button>
          <div class="xp-quick-btns">
            <button class="xp-quick-btn" (click)="addXP(1000)">+1k</button>
            <button class="xp-quick-btn" (click)="addXP(5000)">+5k</button>
            <button class="xp-quick-btn" (click)="addXP(10000)">+10k</button>
          </div>
        </div>
      </div>
    </div>

    @if (showStatsModal()) {
      <div class="modal-overlay" (click)="showStatsModal.set(false)">
        <div class="modal-content stats-modal" (click)="$event.stopPropagation()">
          <div class="modal-title">Atributos</div>
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
              <div class="derived-row"><span class="derived-label">Poder de Hechizo</span><span class="derived-value">{{ charSvc.spellPower() }}</span></div>
              <div class="derived-row"><span class="derived-label">Prob. Critico Hechizo</span><span class="derived-value">{{ charSvc.spellCrit() }}%</span></div>
              <div class="derived-row"><span class="derived-label">Poder de Ataque</span><span class="derived-value">{{ charSvc.attackPower() }}</span></div>
              <div class="derived-row"><span class="derived-label">Prob. Critico Fisico</span><span class="derived-value">{{ charSvc.meleeCrit() }}%</span></div>
              <div class="derived-row"><span class="derived-label">Regen. de Mana</span><span class="derived-value">{{ charSvc.manaRegen() }}/5s</span></div>
              <div class="derived-row"><span class="derived-label">Armadura Fisica</span><span class="derived-value">{{ charSvc.armorTotal() }} (-{{ charSvc.physReduction() }}%)</span></div>
              <div class="derived-row"><span class="derived-label">Armadura Magica</span><span class="derived-value">{{ charSvc.magicResistTotal() }} (-{{ charSvc.magicReduction() }}%)</span></div>
              @if (charSvc.evasion() > 5) {
                <div class="derived-row"><span class="derived-label">Evasion</span><span class="derived-value">{{ charSvc.evasion() }}%</span></div>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn" (click)="showStatsModal.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showEquipment()) {
      <div class="modal-overlay" (click)="showEquipment.set(false)">
        <div class="modal-content equip-modal" (click)="$event.stopPropagation()">
          <div class="modal-title">Equipo</div>
          <div class="equip-modal-body">
            @for (slot of visibleEquipmentSlots(); track slot.key) {
              <div class="equip-slot">
                <div class="equip-slot-header">
                  <span class="equip-slot-icon">{{ slot.icon }}</span>
                  <span class="equip-slot-label">{{ slot.label }}</span>
                </div>
                <input type="text" [value]="getEquipItem(slot.key).name" (input)="onEquipNameInput($event, slot.key)"
                       class="equip-name-input" placeholder="Sin equipar">
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
            <button class="action-btn" (click)="showEquipment.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showExportModal()) {
      <div class="modal-overlay" (click)="showExportModal.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">Exportar Ficha (JSON)</div>
          <textarea class="modal-textarea" readonly [value]="exportedJson()"></textarea>
          <div class="modal-actions">
            <button class="action-btn" (click)="copyJson()">Copiar</button>
            <button class="action-btn" (click)="downloadJson()">Descargar</button>
            <button class="action-btn" (click)="showExportModal.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showTalentModal()) {
      <div class="modal-overlay" (click)="showTalentModal.set(false)">
        <div class="modal-content talent-modal" (click)="$event.stopPropagation()">
          <div class="talent-modal-header">
            <div class="modal-title">Arbol de Talentos — {{ charSvc.classConfig().name }}</div>
            <div class="tp-badge" [class.has-points]="charSvc.availableTalentPoints() > 0">
              <span>Disponibles</span>
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
                <div class="talent-info-rank">Rango {{ charSvc.talentRank(hoveredTalent().id) }} de {{ hoveredTalent().maxRank }}</div>
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
                <div class="talent-info-hint">Click: anadir · Click derecho: quitar</div>
              } @else {
                <div class="talent-info-empty">Pasa el raton sobre un talento para ver su informacion.</div>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button class="action-btn danger" (click)="resetTalents()">Resetear Talentos</button>
            <button class="action-btn" (click)="showTalentModal.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (charSvc.toastMessage()) {
      <div class="toast">{{ charSvc.toastMessage() }}</div>
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

    .class-icon {
      width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
      font-size: 28px; background: radial-gradient(circle, var(--bg-input) 60%, var(--bg-dark));
      border: 2px solid var(--class-color, #C79C6E); border-radius: 50%;
      box-shadow: 0 0 12px var(--class-glow, rgba(199,156,110,0.3)); flex-shrink: 0; overflow: hidden;
    }
    .class-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .header-info { flex: 1; }

    .char-name-input {
      font-family: 'Cinzel', serif; font-size: 24px; font-weight: 700;
      color: var(--gold-light); background: transparent; border: none;
      border-bottom: 1px solid transparent; outline: none; padding: 2px 4px;
      width: 100%; transition: var(--transition);
    }
    .char-name-input:hover, .char-name-input:focus { border-bottom-color: var(--gold-dark); }

    .char-meta {
      display: flex; align-items: center; gap: 16px; margin-top: 4px;
      font-size: 15px; color: var(--text-dim);
    }
    .level-control { display: flex; align-items: center; gap: 6px; }
    .level-control input {
      width: 40px; text-align: center; background: var(--bg-input);
      border: 1px solid var(--gold-dark); border-radius: 3px; color: var(--text);
      padding: 2px; font-family: 'EB Garamond', serif; font-size: 15px; outline: none;
    }

    .class-select {
      background: var(--bg-input); border: 1px solid var(--gold-dark); border-radius: 3px;
      color: var(--class-color, #C79C6E); padding: 3px 8px; font-family: 'Cinzel', serif;
      font-size: 14px; outline: none; cursor: pointer;
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
    .resource-label {
      display: flex; justify-content: space-between; font-size: 13px;
      margin-bottom: 4px; color: var(--text-dim);
    }
    .resource-track {
      height: 22px; background: var(--bg-input); border: 1px solid var(--gold-dark);
      border-radius: 4px; overflow: hidden; position: relative;
    }
    .resource-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; position: relative; }
    .resource-fill.hp {
      background: linear-gradient(180deg, var(--hp) 0%, var(--hp-dark) 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
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
      background: linear-gradient(180deg, var(--mana) 0%, var(--mana-dark) 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
    }
    .resource-text {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 12px; font-weight: 600; color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap;
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
      display: flex; align-items: center; margin-left: auto;
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
      display: flex; align-items: center; gap: 5px; padding: 4px 5px; margin-bottom: 0;
      background: var(--bg-input); border: 1px solid rgba(138,115,68,0.3);
      border-radius: 4px; transition: var(--transition);
    }
    .ability-card:hover { border-color: var(--gold-dark); background: var(--bg-panel-hover); }
    .ability-icon {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      font-size: 14px; background: radial-gradient(circle, var(--bg-panel) 50%, var(--bg-dark));
      border: 1px solid var(--gold-dark); border-radius: 4px; flex-shrink: 0;
      overflow: hidden; position: relative;
    }
    .ability-icon-img { width: 100%; height: 100%; object-fit: cover; }
    .ability-tooltip {
      display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      background: var(--bg-dark); border: 1px solid var(--gold-dark); border-radius: 4px;
      padding: 6px 10px; font-size: 11px; color: var(--text); white-space: normal; line-height: 1.3;
      width: 200px; z-index: 300; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      font-family: 'Segoe UI', sans-serif; text-align: left;
    }
    .ability-icon:hover .ability-tooltip { display: block; }
    .ability-info { flex: 1; min-width: 0; }
    .ability-name { font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ability-school {
      font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em;
    }
    .ability-req-tag { color: #9b59b6; font-weight: 600; }
    .ability-desc { display: none; }
    .ability-stats { display: flex; gap: 5px; margin-top: 1px; font-size: 10px; flex-wrap: nowrap; overflow: hidden; }
    .ability-stat { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
    .ability-stat.dmg { color: var(--danger); }
    .ability-stat.heal { color: var(--success); }
    .ability-stat.cost { color: var(--mana); }
    .ability-stat.bonus { color: var(--gold); font-size: 10px; }

    .ability-card.ability-locked { opacity: 0.5; }

    .ability-cast-row {
      display: flex; align-items: center; margin-top: 2px; gap: 4px;
    }
    .ability-roll-text {
      font-family: 'Cinzel', serif; font-size: 12px; color: var(--gold-light);
      font-weight: 700; margin-left: auto; min-width: 30px; text-align: right;
    }
    .ability-roll-text.crit-roll {
      color: #ff9c00; text-shadow: 0 0 6px rgba(255,156,0,0.5); font-size: 13px;
    }
    .cast-btn {
      padding: 2px 8px; font-family: 'Cinzel', serif; font-size: 10px; font-weight: 600;
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
    .end-turn-btn {
      background: linear-gradient(180deg, #2d4a1e 0%, #1a2d10 100%);
      border-color: #4a7c2e; color: #7cc44a;
    }
    .end-turn-btn:hover {
      background: linear-gradient(180deg, #3a5e26 0%, #234015 100%);
      border-color: #6ba83a; color: #a0e060; box-shadow: 0 0 12px rgba(108,168,58,0.4);
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

    .resource-section {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;
    }
    .quick-icons {
      display: flex; gap: 8px; margin-top: 4px;
    }
    .quick-icon-btn {
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      background: var(--bg-panel); border: 1px solid var(--gold-dark); border-radius: var(--radius);
      cursor: pointer; transition: var(--transition); font-size: 18px;
    }
    .quick-icon-btn:hover {
      border-color: var(--gold); box-shadow: 0 0 8px var(--gold-glow); transform: scale(1.05);
    }
    .xp-bottom-bar { margin-top: 20px; }
    .stats-modal { max-width: 500px; }
    .stats-modal-body { max-height: 60vh; overflow-y: auto; }
    .equip-modal { max-width: 600px; }
    .equip-modal-body { max-height: 60vh; overflow-y: auto; }

    .xp-section { margin-bottom: 0; flex: 1; min-width: 0; }

    .top-bar-row {
      display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-start; flex-wrap: wrap;
    }
    .top-side-controls {
      display: flex; flex-direction: column; gap: 10px; align-items: stretch; min-width: 220px;
    }

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
export class PlayerComponent implements OnInit {
  charSvc = inject(CharacterService);
  private classRegistry = inject(ClassRegistryService);

  MAX_LEVEL = MAX_LEVEL;
  STAT_ICONS = STAT_ICONS;
  EFFECT_TYPES = EFFECT_TYPES;
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
  }

  comboPointArray(max: number): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
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
  }

  endTurn() {
    const oldTurn = this.charSvc.turnNumber();
    this.processEffects();
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
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) roll = Math.round(roll * 1.5);
    if ((isRage || isEnergy) && this.charSvc.warriorStance() === 'battle') roll = Math.round(roll * 1.10);

    let comboSpent = 0;
    if (ability.spendsCombo) {
      comboSpent = this.charSvc.character().comboPoints || 0;
      if (comboSpent === 0) {
        this.charSvc.showToast('Sin puntos de combo');
        if (isEnergy) {
          this.charSvc.character.update(c => ({
            ...c,
            currentEnergy: Math.min(resourceMax, resourceActual + (ability.costEnergy || 0)),
          }));
        }
        return;
      }
      const equinoxRank = this.charSvc.talentRank('equinox');
      const fragMult = 1 + equinoxRank * 0.15;
      const aoeMult = ability.aoe ? 0.5 : 1.0;
      roll = Math.round(roll * (1 + (comboSpent - 1) * fragMult * aoeMult));
      this.charSvc.character.update(c => ({ ...c, comboPoints: 0 }));
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
              duration: 1,
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
      if (['sinister_strike', 'basic_attack'].includes(ability.id)) {
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

    if (ability.isHot) {
      let lunarText = '';
      const lhRank = this.charSvc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 6) {
        const comboMax = (this.charSvc.classConfig().comboConfig?.max) || 5;
        this.charSvc.character.update(c => ({
          ...c,
          comboPoints: Math.min(comboMax, (c.comboPoints || 0) + 1),
        }));
        lunarText = ' · +1 Fase Lunar';
      }
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + ability.hotTick + '/turno · ' +
        ability.hotDuration + 't (' + ability.hotTotal + ' total)' + lunarText +
        ' — aplicalo manualmente en Efectos'
      );
      this.charSvc.sendHealEvent(ability, ability.hotTotal);
    } else if (ability.isDot) {
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + ability.dotTick + '/turno · ' +
        ability.dotDuration + 't (' + ability.dotTotal + ' total) — aplicalo al enemigo'
      );
      this.charSvc.sendDamageEvent(ability, 0, 1, 1);
    } else if (ability.type === 'heal' && !ability.isHot) {
      let healBonus = 1 + this.charSvc.talentRank('healing_focus') * 0.02;
      let lunarText = '';
      const lhRank = this.charSvc.talentRank('lunar_healing');
      if (lhRank > 0 && Math.random() * 100 < lhRank * 6) {
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
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + ' — aplicalo al objetivo'
        );
        this.charSvc.sendHealEvent(ability, roll);
      } else {
        roll = Math.round(roll * healBonus);
        this.abilityRolls.update(r => ({ ...r, [ability.id]: { roll, crit: isCrit } }));
        this.charSvc.showToast(
          ability.name + ' R' + ability.currentRank + ': ' + roll + ' curacion' +
          (isCrit ? ' ¡CRITICO!' : '') + ccText + evText + lunarText + ' — aplicalo al objetivo'
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
          const smite = this.charSvc.classConfig().abilities.find(a => a.id === 'smite');
          if (smite && ability.currentMin) {
            const smiteAvg = (ability.currentMin + ability.currentMax) / 2;
            const holyDmg = Math.round(smiteAvg * belRank * 0.07);
            roll += holyDmg;
          }
        }
      }
      this.charSvc.turnDamage.update(d => d + roll);
      const dmgText = isCrit ? '¡CRITICO!' : ability.inflictsEffects ? '¡Aturde al enemigo!' : 'Lanzado';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + dmgText + ccText + rageText + comboText + evText
      );
      const hits = ability.multiHit || 1;
      for (let h = 0; h < hits; h++) {
        let hitRoll = roll;
        if (hits > 1 && h > 0) {
          hitRoll = (ability.currentMin || 0) + Math.floor(Math.random() * ((ability.currentMax || 0) - (ability.currentMin || 0) + 1));
          if (isCrit) hitRoll = Math.round(hitRoll * 1.5);
          if (isRage && this.charSvc.warriorStance() === 'battle') hitRoll = Math.round(hitRoll * 1.10);
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
        const rageGain = this.charSvc.getEffectiveRageGain(ability);
        this.charSvc.character.update(c => ({
          ...c,
          currentRage: Math.min(resourceMax, (c.currentRage || 0) + rageGain),
        }));
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida · +' + rageGain + ' ira');
      } else {
        this.charSvc.showToast(ability.name + ': -' + healthLost + ' vida');
      }
    } else if (ability.buff && ability.buff.applySelf) {
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
      this.charSvc.character.update(c => ({
        ...c,
        activeEffects: [
          ...(c.activeEffects || []).filter(e => e.name !== ability.name),
          {
            id: Date.now() + Math.random(),
            type: effectType as any,
            name: ability.name,
            target: ability.buff.isHot ? 'hp' : ability.currentBuffStat,
            value: buffValue,
            duration: ability.currentBuffDuration,
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
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': +' + buffValue +
        (ability.buff.isPercent ? '%' : '') + ' ' + ability.currentBuffStat
      );
    } else if (ability.buff) {
      const buffText = '+' + ability.currentBuffValue + ' ' + ability.currentBuffStat +
        ' (' + ability.currentBuffDuration + ' turnos)';
      this.charSvc.showToast(
        ability.name + ' R' + ability.currentRank + ': ' + buffText + ' — aplicalo manualmente en Efectos'
      );
    } else {
      this.charSvc.showToast(ability.name + ': Lanzado');
    }
  }

  fullRest() {
    const maxHP = this.charSvc.maxHP();
    const maxMana = this.charSvc.maxMana();
    const resourceMax = this.charSvc.resourceMax();
    this.charSvc.character.update(c => ({
      ...c,
      currentHP: maxHP,
      comboPoints: 0,
      currentCooldowns: {},
    }));
    if (this.charSvc.resourceConfig().type === 'rage') {
      this.charSvc.character.update(c => ({ ...c, currentRage: 0 }));
      this.charSvc.showToast('Full Rest: vida al maximo, ira reseteada');
    } else if (this.charSvc.resourceConfig().type === 'energy') {
      this.charSvc.character.update(c => ({ ...c, currentEnergy: resourceMax }));
      this.charSvc.showToast('Full Rest: vida y energia al maximo');
    } else {
      this.charSvc.character.update(c => ({ ...c, currentMana: maxMana }));
      this.charSvc.showToast('Full Rest: vida y mana al maximo');
    }
    this.charSvc.turnNumber.set(1);
    this.charSvc.turnDamage.set(0);
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
