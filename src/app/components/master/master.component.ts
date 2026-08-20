import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ref, onChildAdded, onChildChanged, onChildRemoved, onValue, off, set, remove } from 'firebase/database';
import { FirebaseService } from '../../services/firebase.service';
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
}

@Component({
  selector: 'app-master',
  standalone: true,
  template: `
    <div class="app-header">
      <div class="app-title">Master Screen</div>
    </div>

    <div class="send-panel-wrap">
      <div class="wow-panel send-panel">
        <div class="panel-title">
          @if (isPlayerTargeting()) {
            <span class="targeting-hint">Clicka un jugador para asignar {{ targetingLabel() }}</span>
          } @else {
            Enviar a Jugadores
          }
          @if (knownPlayers().length > 0) {
            <button class="clear-btn small" (click)="clearPlayers()">Limpiar</button>
          }
        </div>
        <div class="panel-body">          @if (knownPlayers().length > 0) {
            <div class="player-chips" [class.targeting]="isPlayerTargeting()">
              @for (name of knownPlayers(); track name) {
                <button
                  class="player-chip"
                  [class.targeting-chip]="isPlayerTargeting()"
                  [class.active]="sendTargetName() === name"
                  (click)="onPlayerChipClick(name)"
                >{{ name }}</button>
              }
            </div>
          } @else {
            <div class="damage-empty" style="margin-bottom: 8px;">Los jugadores apareceran aqui al realizar acciones</div>
          }

          @if (!isPlayerTargeting() && sendTargetName()) {
            <div class="quick-effects">
              <div class="quick-effect-group">
                <span class="quick-label">Debuffs</span>
                <div class="quick-btns">
                  <button class="quick-btn debuff-btn" (click)="quickSendDebuff('Stun', 'stunned', 0, 2)">Stun</button>
                  <button class="quick-btn debuff-btn" (click)="quickSendDebuff('Silence', 'silenced', 0, 3)">Silence</button>
                  <button class="quick-btn debuff-btn" (click)="quickSendDebuff('Slow', 'slowed', 0, 4)">Slow</button>
                </div>
                <div class="debuff-type-row">
                  <span class="debuff-type-label">Tipo:</span>
                  <select class="debuff-type-select" [value]="selectedDebuffType()" (change)="onDebuffTypeChange($event)">
                    <option value="none">Sin tipo</option>
                    <option value="disease">Enfermedad</option>
                    <option value="poison">Veneno</option>
                    <option value="magic">Mágico</option>
                    <option value="curse">Maldición</option>
                  </select>
                </div>
              </div>
              <div class="quick-two-col">
                <div class="quick-effect-group">
                  <span class="quick-label">DoT</span>
                  <div class="quick-btns">
                    <input type="number" class="dot-input" placeholder="Danno/turno" min="1"
                      [value]="dotAmount() || ''" (input)="dotAmount.set($any($event.target).valueAsNumber || null)" />
                    <input type="number" class="dot-input small" placeholder="Turnos" min="1"
                      [value]="dotDuration() || ''" (input)="dotDuration.set($any($event.target).valueAsNumber || null)" />
                    <button class="quick-btn dot-btn" (click)="quickSendDot()">DoT</button>
                  </div>
                </div>
                <div class="quick-effect-group">
                  <span class="quick-label">Directo</span>
                  <div class="quick-btns">
                    <input type="number" class="dot-input" placeholder="Cantidad" min="1"
                      [value]="sendAmount() || ''" (input)="sendAmount.set($any($event.target).valueAsNumber || null)" />
                    <button class="quick-btn heal-btn" (click)="quickSendDirect('heal')">Curar</button>
                    <button class="quick-btn dmg-btn" (click)="quickSendDirect('damage')">Dannar</button>
                  </div>
                </div>
              </div>
              <div class="quick-effect-group">
                <span class="quick-label">XP / Nivel</span>
                <div class="quick-btns">
                  <input type="number" class="dot-input" placeholder="XP" min="1"
                    [value]="xpAmount() || ''" (input)="xpAmount.set($any($event.target).valueAsNumber || null)"
                    (keyup.enter)="sendXP()" />
                  <button class="quick-btn xp-btn" (click)="sendXP()">XP</button>
                  <button class="quick-btn xp-btn" (click)="sendLevel(1)">+1 Nivel</button>
                  <button class="quick-btn xp-btn" (click)="sendLevel(2)">+2 Niveles</button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      @if (sendLog().length > 0) {
        <div class="wow-panel send-log-panel">
          <div class="panel-title">Log Master</div>
          <div class="panel-body">
            <div class="send-log">
              @for (entry of sendLog(); track $index) {
                <div class="send-log-entry">{{ entry }}</div>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <div class="master-layout">
      <div class="wow-panel">
        <div class="panel-title">Monstruos ({{ monsters().length }})</div>
        <div class="panel-body">
          <div class="add-monster-row">
            <input
              type="text"
              [value]="newMonsterName()"
              class="add-monster-input"
              placeholder="Nombre del monstruo"
              (input)="newMonsterName.set($any($event.target).value)"
              (keyup.enter)="addMonster()"
            />
            <input
              type="number"
              [value]="newMonsterHP() || ''"
              class="add-monster-input"
              placeholder="HP"
              style="flex: 0 0 80px;"
              (input)="newMonsterHP.set($any($event.target).valueAsNumber || null)"
              (keyup.enter)="addMonster()"
            />
            <button class="add-monster-btn" (click)="addMonster()">Añadir</button>
          </div>

          <div class="npc-preset-row">
            <select
              [value]="selectedNpc()"
              (change)="onNpcSelect($event)"
              class="add-monster-input"
            >
              <option value="">+ Añadir pregenerado...</option>
              @for (zone of npcZones(); track zone) {
                <optgroup [label]="zone">
                  @for (entry of npcByZone()[zone]; track entry.key) {
                    <option [value]="entry.key">
                      {{ entry.npc.name }} (Nv. {{ entry.npc.level }})
                    </option>
                  }
                </optgroup>
              }
            </select>
          </div>

          @if (monsters().length > 0) {
            <div class="monster-list">
              @for (monster of monsters(); track monster.id) {
                <div
                  class="monster-card"
                  [class.targeting]="isTargeting()"
                  [class.dead]="monster.currentHP <= 0"
                  [class.attacking]="attackingId() === monster.id"
                  (click)="assignDamageToMonster(monster)"
                >
                  <div class="monster-header">
                    <span
                      class="monster-name"
                      [class.dead-name]="monster.currentHP <= 0"
                    >
                      {{ monster.icon ? monster.icon + ' ' : '' }}{{ monster.name }}
                      @if (monster.isElite) {
                        <span class="elite-badge">ELITE</span>
                      }
                      @if (monster.level) {
                        <span class="monster-level">Nv. {{ monster.level }}</span>
                      }
                    </span>
                    <div class="monster-actions">
                      <button
                        class="monster-btn"
                        (click)="$event.stopPropagation(); healMonster(monster)"
                        title="Curar"
                      >+</button>
                      <button
                        class="monster-btn danger"
                        (click)="$event.stopPropagation(); removeMonster(monster.id)"
                        title="Eliminar"
                      >✕</button>
                    </div>
                  </div>
                  <div class="monster-hp-bar">
                    <div
                      class="monster-hp-fill"
                      [class.low]="monsterHPPercent(monster) <= 50 && monsterHPPercent(monster) > 25"
                      [class.critical]="monsterHPPercent(monster) <= 25"
                      [style.width]="monsterHPPercent(monster) + '%'"
                    ></div>
                    <div class="monster-hp-text">{{ monster.currentHP }} / {{ monster.maxHP }}</div>
                  </div>
                  @if (monster.armor !== undefined || monster.magicResist !== undefined) {
                    <div class="monster-stats">
                      @if (monster.armor !== undefined) {
                        <span class="monster-stat">🛡️ {{ getEffectiveArmor(monster) }}</span>
                      }
                      @if (monster.magicResist !== undefined) {
                        <span class="monster-stat">✨ {{ getEffectiveMagicResist(monster) }}</span>
                      }
                    </div>
                  }
                  @if (monster.effects && monster.effects.length > 0) {
                    <div class="monster-effects">
                      @for (eff of monster.effects; track $index) {
                        <span
                          class="monster-effect-chip"
                          [class.dot]="eff.type === 'dot'"
                          [class.debuff]="eff.type === 'debuff'"
                          [class.status]="eff.type === 'status'"
                          [style.--debuff-color]="DEBUFF_TYPES[eff.debuffType || 'none']?.color || DEBUFF_TYPES['none'].color"
                        >
                          {{ eff.type === 'dot' ? '🩸' : eff.type === 'status' ? '⛔' : '📉' }}
                          {{ eff.name }}
                          @if (eff.debuffType && eff.debuffType !== 'none') {
                            <span class="effect-type-tag">{{ DEBUFF_TYPES[eff.debuffType]?.label }}</span>
                          }
                          @if (eff.value !== undefined && eff.value > 0) { {{ eff.value }} }
                          <span class="effect-dur">{{ eff.duration }}t</span>
                        </span>
                      }
                    </div>
                  }
                  @if (monster.attacks && monster.attacks.length > 0) {
                    <div class="monster-attacks">
                      @for (attack of monster.attacks; track $index) {
                        <button
                          class="monster-attack-btn"
                          (click)="$event.stopPropagation(); rollMonsterAttack(monster, attack)"
                        >
                          {{ attack.name }}
                          @if (attack.inflictsEffects && attack.inflictsEffects.length > 0) {
                            <span class="attack-effect-indicator">⚡</span>
                          }
                          <span class="monster-attack-dmg">{{ attack.min }}-{{ attack.max }}</span>
                        </button>
                      }
                    </div>
                  }
                  <div class="monster-hp-controls">
                    <input
                      type="number"
                      [value]="dmgInput()[monster.id] ?? ''"
                      class="monster-hp-input"
                      placeholder="Daño"
                      min="1"
                      (input)="onDmgInput(monster.id, $any($event.target).valueAsNumber || null)"
                      (keyup.enter)="applyManualDamage(monster)"
                    />
                    <button
                      class="monster-dmg-btn"
                      (click)="$event.stopPropagation(); applyManualDamage(monster)"
                    >Daño</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="damage-empty">No hay monstruos. Añade uno arriba.</div>
          }
        </div>
      </div>

      <div class="wow-panel damage-events-panel">
        <div class="panel-title">
          Eventos
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="connection-status">
              <span
                class="status-dot"
                [class.connected]="firebaseConnected()"
                [class.disconnected]="!firebaseConnected()"
              ></span>
              {{ firebaseConnected() ? 'On' : 'Off' }}
            </span>
            @if (pendingEvents().length > 0) {
              <button class="clear-btn small" (click)="clearAllEvents()">Limpiar</button>
            }
          </div>
        </div>
        <div class="panel-body">
          @if (pendingEvents().length > 0) {
            <div class="damage-log">
              @for (event of pendingEvents(); track event.id) {
                <div
                  class="damage-event"
                  [class.selected]="selectedEventId() === event.id"
                  [class.assigned]="event.assigned"
                  [class.buff-event]="event.damageType === 'buff'"
                  (click)="selectEvent(event.id)"
                >
                  <span class="damage-event-icon">{{
                    event.damageType === 'physical'
                      ? '⚔️'
                      : event.damageType === 'heal'
                        ? (event.isHot ? '🩹' : (event.isShield ? '🛡️' : '💚'))
                        : event.damageType === 'buff'
                          ? '🌟'
                          : '✨'
                  }}</span>
                  <div class="damage-event-info">
                    <div class="damage-event-player">{{ event.player }}</div>
                    <div class="damage-event-detail">
                      {{ event.ability }} R{{ event.rank }}
                      <span
                        class="damage-type-tag"
                        [class.magical]="event.damageType === 'magical'"
                        [class.physical]="event.damageType === 'physical'"
                        [class.heal-tag]="event.damageType === 'heal'"
                        [class.buff-tag]="event.damageType === 'buff'"
                        >{{
                          event.damageType === 'physical' ? 'Fís' :
                          event.damageType === 'heal' ? (event.isHot ? 'HoT' : (event.isShield ? '🛡' : 'Cura')) :
                          event.damageType === 'buff' ? 'Buff' : 'Mág'
                        }}</span>
                      @if (event.aoe) {
                        <span class="damage-type-tag aoe">AOE</span>
                      }
                      @if (event.effects) {
                        <span class="damage-type-tag effect">DoT</span>
                      }
                    </div>
                  </div>
                  <span
                    class="damage-event-value"
                    [class.heal-value]="event.damageType === 'heal' || event.damageType === 'buff'"
                    >{{
                      event.damageType === 'buff'
                        ? '+' + event.buffValue
                        : event.isHot
                          ? event.hotTick + '/t'
                          : event.damage
                    }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="damage-empty">Sin eventos</div>
          }
        </div>
      </div>
    </div>

    @if (toastMessage()) {
      <div class="toast">{{ toastMessage() }}</div>
    }
  `,
  styles: [`
    :host {
      --bg-dark: #0a0a0f;
      --bg-panel: #14141f;
      --bg-panel-hover: #1a1a28;
      --bg-input: #1c1c2a;
      --gold: #c9b27e;
      --gold-light: #e8d5a3;
      --gold-dark: #8a7344;
      --gold-glow: rgba(201, 178, 126, 0.15);
      --text: #d4c5a9;
      --text-dim: #8a8070;
      --text-muted: #5a554a;
      --danger: #c45151;
      --success: #5fa85f;
      --radius: 6px;
      --transition: all 0.2s ease;
      display: block;
      background: var(--bg-dark);
      color: var(--text);
      font-family: 'EB Garamond', serif;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .master-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    @media (max-width: 900px) {
      .master-layout {
        grid-template-columns: 1fr;
      }
    }

    .app-header {
      grid-column: 1 / -1;
      text-align: center;
      margin-bottom: 8px;
    }

    .app-title {
      font-family: 'Cinzel', serif;
      font-size: 28px;
      font-weight: 900;
      color: var(--gold-light);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-shadow: 0 0 20px var(--gold-glow);
    }

    .wow-panel {
      background: var(--bg-panel);
      border: 1px solid var(--gold-dark);
      border-radius: var(--radius);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }

    .panel-title {
      font-family: 'Cinzel', serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--gold);
      padding: 12px 16px;
      border-bottom: 1px solid rgba(138, 115, 68, 0.2);
      background: linear-gradient(180deg, rgba(138, 115, 68, 0.08) 0%, transparent 100%);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-body {
      padding: 14px 16px;
    }

    .damage-log {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 600px;
      overflow-y: auto;
    }

    .damage-events-panel .panel-body {
      padding: 8px 10px;
    }

    .damage-events-panel .damage-event {
      padding: 6px 8px;
      gap: 6px;
    }

    .damage-events-panel .damage-event-icon {
      font-size: 16px;
    }

    .damage-events-panel .damage-event-player {
      font-size: 12px;
    }

    .damage-events-panel .damage-event-detail {
      font-size: 11px;
    }

    .damage-events-panel .damage-event-value {
      font-size: 18px;
    }

    .damage-events-panel .damage-empty {
      padding: 20px 10px;
      font-size: 12px;
    }

    .damage-event {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--bg-input);
      border: 1px solid rgba(138, 115, 68, 0.2);
      border-radius: var(--radius);
      transition: var(--transition);
      cursor: pointer;
      animation: slide-in 0.3s ease;
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .damage-event:hover {
      border-color: var(--gold-dark);
      background: var(--bg-panel-hover);
    }

    .damage-event.selected {
      border-color: var(--gold);
      box-shadow: 0 0 8px var(--gold-glow);
    }

    .damage-event.assigned {
      opacity: 0.4;
      filter: grayscale(0.5);
    }

    .damage-event-icon {
      font-size: 22px;
    }

    .damage-event-info {
      flex: 1;
    }

    .damage-event-player {
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 600;
      color: var(--gold-light);
    }

    .damage-event-detail {
      font-size: 13px;
      color: var(--text-dim);
    }

    .damage-type-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      margin-left: 4px;
      text-transform: uppercase;
    }

    .damage-type-tag.magical {
      background: rgba(155, 89, 182, 0.25);
      color: #b388e0;
      border: 1px solid rgba(155, 89, 182, 0.4);
    }

    .damage-type-tag.physical {
      background: rgba(201, 178, 126, 0.2);
      color: #c9b27e;
      border: 1px solid rgba(201, 178, 126, 0.4);
    }

    .damage-type-tag.aoe {
      background: rgba(192, 57, 43, 0.25);
      color: #ff7070;
      border: 1px solid rgba(192, 57, 43, 0.4);
    }

    .damage-event-value {
      font-size: 24px;
      font-weight: 700;
      color: #c0392b;
      font-family: 'Cinzel', serif;
    }

    .damage-event-value.heal-value {
      color: #5fa85f;
    }

    .damage-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-style: italic;
      font-size: 14px;
    }

    .monster-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .monster-card {
      background: var(--bg-input);
      border: 1px solid rgba(138, 115, 68, 0.2);
      border-radius: var(--radius);
      padding: 12px;
      transition: var(--transition);
    }

    .monster-card.targeting {
      border-color: var(--gold);
      box-shadow: 0 0 12px var(--gold-glow);
      cursor: crosshair;
    }

    .monster-card.dead {
      opacity: 0.5;
      filter: grayscale(0.7);
    }

    .monster-card.attacking {
      animation: monster-attack-shake 0.4s ease;
    }

    @keyframes monster-attack-shake {
      0%,
      100% {
        transform: translateX(0) rotate(0deg);
      }
      15% {
        transform: translateX(-6px) rotate(-1deg);
      }
      30% {
        transform: translateX(6px) rotate(1deg);
      }
      45% {
        transform: translateX(-4px) rotate(-0.5deg);
      }
      60% {
        transform: translateX(4px) rotate(0.5deg);
      }
      75% {
        transform: translateX(-2px);
      }
    }

    .monster-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .monster-name {
      font-family: 'Cinzel', serif;
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
    }

    .monster-name.dead-name {
      color: var(--danger);
      text-decoration: line-through;
    }

    .monster-actions {
      display: flex;
      gap: 4px;
    }

    .monster-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border: 1px solid var(--gold-dark);
      border-radius: 3px;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 14px;
      transition: var(--transition);
    }

    .monster-btn:hover {
      border-color: var(--gold);
      color: var(--gold-light);
    }

    .monster-btn.danger:hover {
      border-color: var(--danger);
      color: var(--danger);
    }

    .monster-hp-bar {
      height: 22px;
      background: var(--bg-dark);
      border: 1px solid var(--gold-dark);
      border-radius: 3px;
      position: relative;
      overflow: hidden;
      margin-bottom: 6px;
    }

    .monster-hp-fill {
      height: 100%;
      background: linear-gradient(180deg, #4a8e3a 0%, #2d6b1f 100%);
      transition: width 0.4s ease;
      border-radius: 2px;
    }

    .monster-hp-fill.low {
      background: linear-gradient(180deg, #c4a830 0%, #8a7a1e 100%);
    }

    .monster-hp-fill.critical {
      background: linear-gradient(180deg, #c0392b 0%, #8b2e1e 100%);
    }

    .monster-hp-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      font-family: 'Cinzel', serif;
    }

    .monster-hp-controls {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .monster-hp-input {
      width: 60px;
      padding: 4px 6px;
      text-align: center;
      font-size: 13px;
      background: var(--bg-dark);
      border: 1px solid var(--gold-dark);
      border-radius: 3px;
      color: var(--text);
      outline: none;
    }

    .monster-hp-input:focus {
      border-color: var(--gold);
    }

    .monster-dmg-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      background: linear-gradient(180deg, #4a1a1a 0%, #2d0e0e 100%);
      border: 1px solid #8b2e2e;
      border-radius: 3px;
      color: #e07070;
      cursor: pointer;
      transition: var(--transition);
    }

    .monster-dmg-btn:hover {
      border-color: #c0392b;
      color: #ff9090;
    }

    .monster-dmg-btn:active {
      transform: scale(0.95);
    }

    .monster-attacks {
      display: flex;
      gap: 6px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .monster-attack-btn {
      padding: 5px 10px;
      font-family: 'Cinzel', serif;
      font-size: 12px;
      font-weight: 600;
      background: linear-gradient(180deg, #2d2a1a 0%, #1a1810 100%);
      border: 1px solid #8a7344;
      border-radius: 4px;
      color: #c9b27e;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .monster-attack-btn:hover {
      border-color: #e8d5a3;
      color: #e8d5a3;
      box-shadow: 0 0 8px rgba(201, 178, 126, 0.2);
      transform: scale(1.03);
    }

    .monster-attack-dmg {
      font-size: 11px;
      color: #c0392b;
      font-weight: 700;
    }

    .attack-effect-indicator {
      font-size: 10px;
      color: #e8d5a3;
    }

    .monster-effects {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .monster-effect-chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .monster-effect-chip.dot {
      background: color-mix(in srgb, var(--debuff-color, #c0392b) 15%, transparent);
      color: var(--debuff-color, #ff7070);
      border: 1px solid color-mix(in srgb, var(--debuff-color, #c0392b) 35%, transparent);
    }

    .monster-effect-chip.debuff {
      background: color-mix(in srgb, var(--debuff-color, #9b59b6) 15%, transparent);
      color: var(--debuff-color, #b388e0);
      border: 1px solid color-mix(in srgb, var(--debuff-color, #9b59b6) 35%, transparent);
    }

    .monster-effect-chip.status {
      background: color-mix(in srgb, var(--debuff-color, #ff9c00) 15%, transparent);
      color: var(--debuff-color, #ff9c00);
      border: 1px solid color-mix(in srgb, var(--debuff-color, #ff9c00) 35%, transparent);
    }

    .effect-type-tag {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.8;
      padding: 0 3px;
      border-radius: 3px;
      background: color-mix(in srgb, var(--debuff-color, #fff) 20%, transparent);
    }

    .effect-dur {
      font-size: 9px;
      background: rgba(0, 0, 0, 0.4);
      padding: 0 4px;
      border-radius: 6px;
    }

    .damage-type-tag.effect {
      background: rgba(192, 57, 43, 0.25);
      color: #ff8888;
      border: 1px solid rgba(192, 57, 43, 0.4);
    }

    .add-monster-row {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .add-monster-input {
      flex: 1;
      padding: 8px 10px;
      background: var(--bg-dark);
      border: 1px solid var(--gold-dark);
      border-radius: 3px;
      color: var(--text);
      font-size: 14px;
      outline: none;
    }

    .add-monster-input:focus {
      border-color: var(--gold);
    }

    .add-monster-input::placeholder {
      color: var(--text-muted);
    }

    .add-monster-btn {
      padding: 8px 16px;
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 600;
      background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-dark) 100%);
      border: 1px solid var(--gold-dark);
      border-radius: 3px;
      color: var(--gold);
      cursor: pointer;
      transition: var(--transition);
      text-transform: uppercase;
    }

    .add-monster-btn:hover {
      border-color: var(--gold);
      color: var(--gold-light);
      box-shadow: 0 0 8px var(--gold-glow);
    }

    .npc-preset-row {
      margin-bottom: 12px;
    }

    .monster-level {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 400;
      margin-left: 4px;
    }

    .elite-badge {
      font-size: 9px;
      font-weight: 700;
      color: #ffd700;
      background: linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(218,165,32,0.15) 100%);
      border: 1px solid rgba(255,215,0,0.4);
      border-radius: 3px;
      padding: 1px 5px;
      margin-left: 4px;
      letter-spacing: 0.05em;
      text-shadow: 0 0 4px rgba(255,215,0,0.3);
    }

    .monster-card:has(.elite-badge) {
      border-color: rgba(255,215,0,0.3);
      box-shadow: 0 0 8px rgba(255,215,0,0.1);
    }

    .monster-stats {
      display: flex;
      gap: 10px;
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--text-dim);
    }

    .monster-stat {
      background: var(--bg-dark);
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid rgba(138, 115, 68, 0.15);
    }

    .clear-btn {
      padding: 4px 12px;
      font-family: 'Cinzel', serif;
      font-size: 11px;
      font-weight: 600;
      background: linear-gradient(180deg, #4a1a1a 0%, #2d0e0e 100%);
      border: 1px solid #8b2e2e;
      border-radius: 3px;
      color: #e07070;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
    }

    .clear-btn:hover {
      border-color: #c0392b;
      color: #ff9090;
      box-shadow: 0 0 8px rgba(192, 57, 43, 0.3);
    }

    .toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: var(--bg-panel);
      border: 1px solid var(--gold);
      border-radius: var(--radius);
      color: var(--gold-light);
      font-family: 'Cinzel', serif;
      font-size: 14px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 12px var(--gold-glow);
      z-index: 200;
      animation: toast-in 0.3s ease, toast-out 0.3s ease 2.2s forwards;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translate(-50%, 20px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }

    @keyframes toast-out {
      to {
        opacity: 0;
        transform: translate(-50%, 20px);
      }
    }

    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-dark);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--gold-dark);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--gold);
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-dim);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-dot.connected {
      background: var(--success);
      box-shadow: 0 0 6px var(--success);
    }

    .status-dot.disconnected {
      background: var(--danger);
    }

    .damage-event.buff-event {
      border-left: 3px solid #e8d5a3;
    }

    .assign-player-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(201, 178, 126, 0.08);
      border-radius: 0 0 var(--radius) var(--radius);
      margin: -4px 0 4px 0;
    }

    .player-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .player-chip {
      background: var(--bg-input);
      border: 1px solid var(--gold-dark);
      border-radius: 12px;
      color: var(--text-dim);
      padding: 3px 12px;
      font-family: 'EB Garamond', serif;
      font-size: 12px;
      cursor: pointer;
      transition: var(--transition);
    }

    .player-chip:hover {
      border-color: var(--gold);
      color: var(--text);
    }

    .player-chip.active {
      background: linear-gradient(135deg, var(--gold-dark), var(--gold));
      color: var(--bg-dark);
      border-color: var(--gold);
      font-weight: 600;
    }

    .player-chips.targeting {
      gap: 6px;
    }

    .player-chip.targeting-chip {
      animation: pulse-glow 1.5s ease-in-out infinite;
      border-width: 2px;
      padding: 5px 14px;
      font-size: 13px;
    }

    .player-chip.targeting-chip:hover {
      background: linear-gradient(135deg, #2a6a2a, #4a9a4a);
      color: #fff;
      border-color: #4a9a4a;
      transform: scale(1.05);
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(95, 168, 95, 0.4); }
      50% { box-shadow: 0 0 8px 2px rgba(95, 168, 95, 0.3); }
    }

    .targeting-hint {
      color: #6fbf6f;
      font-size: 12px;
      font-family: 'EB Garamond', serif;
      font-style: italic;
    }

    .clear-btn.small {
      font-size: 11px;
      padding: 2px 8px;
    }

    .quick-effects {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
      border-top: 1px solid var(--gold-dark);
      padding-top: 10px;
    }

    .quick-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .quick-effect-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .debuff-type-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    .debuff-type-label { font-size: 11px; color: var(--text-dim); }
    .debuff-type-select {
      background: var(--bg-input); border: 1px solid var(--gold-dark); border-radius: 4px;
      color: var(--text); font-size: 11px; padding: 2px 6px; cursor: pointer;
    }
    .debuff-type-select:focus { border-color: var(--gold); }

    .quick-label {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      color: var(--gold);
      white-space: nowrap;
      width: 60px;
    }

    .quick-btns {
      display: flex;
      gap: 6px;
      align-items: center;
      flex: 1;
    }

    .quick-btn {
      border: none;
      border-radius: var(--radius);
      padding: 5px 14px;
      font-family: 'Cinzel', serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      white-space: nowrap;
      color: #fff;
    }

    .debuff-btn { background: linear-gradient(135deg, #8a2a2a, #c45151); }
    .debuff-btn:hover { background: linear-gradient(135deg, #a33a3a, #d46060); }

    .dot-btn { background: linear-gradient(135deg, #6a2a6a, #9a4a9a); }
    .dot-btn:hover { background: linear-gradient(135deg, #7a3a7a, #aa5aaa); }

    .heal-btn { background: linear-gradient(135deg, #2a6a2a, #4a9a4a); }
    .heal-btn:hover { background: linear-gradient(135deg, #3a7a3a, #5aaa5a); }

    .dmg-btn { background: linear-gradient(135deg, #6a3a1a, #c47a3a); }
    .dmg-btn:hover { background: linear-gradient(135deg, #7a4a2a, #d48a4a); }

    .xp-btn { background: linear-gradient(135deg, #6a2a8a, #9a4aba); }
    .xp-btn:hover { background: linear-gradient(135deg, #7a3a9a, #aa5aca); }

    .dot-input {
      width: 90px;
      background: var(--bg-input);
      border: 1px solid var(--gold-dark);
      border-radius: var(--radius);
      color: var(--text);
      padding: 4px 8px;
      font-family: 'EB Garamond', serif;
      font-size: 12px;
      outline: none;
    }

    .dot-input.small { width: 60px; }
    .dot-input:focus { border-color: var(--gold); }

    .assign-player-btn {
      background: linear-gradient(135deg, #2a6a2a, #4a9a4a);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 4px 14px;
      font-family: 'Cinzel', serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: var(--transition);
    }

    .assign-player-btn:hover {
      background: linear-gradient(135deg, #3a7a3a, #5aaa5a);
    }

    .damage-type-tag.heal-tag {
      background: rgba(95, 168, 95, 0.25);
      color: #6fbf6f;
    }

    .damage-type-tag.buff-tag {
      background: rgba(232, 213, 163, 0.25);
      color: var(--gold-light);
    }

    .send-panel-wrap {
      max-width: 1200px;
      margin: 0 auto 20px;
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 20px;
    }

    @media (max-width: 900px) {
      .send-panel-wrap {
        grid-template-columns: 1fr;
      }
    }

    .send-panel .panel-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .send-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .send-input {
      flex: 1;
      background: var(--bg-input);
      border: 1px solid var(--gold-dark);
      border-radius: var(--radius);
      color: var(--text);
      padding: 6px 10px;
      font-family: 'EB Garamond', serif;
      font-size: 14px;
      outline: none;
    }

    .send-input.small {
      flex: 0 0 100px;
    }

    .send-input:focus {
      border-color: var(--gold);
    }

    .send-select {
      background: var(--bg-input);
      border: 1px solid var(--gold-dark);
      border-radius: var(--radius);
      color: var(--text);
      padding: 6px 8px;
      font-family: 'EB Garamond', serif;
      font-size: 14px;
      outline: none;
      cursor: pointer;
    }

    .send-btn {
      background: linear-gradient(135deg, var(--gold-dark), var(--gold));
      color: var(--bg-dark);
      border: none;
      border-radius: var(--radius);
      padding: 6px 18px;
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      white-space: nowrap;
    }

    .send-btn:hover {
      background: linear-gradient(135deg, var(--gold), var(--gold-light));
    }

    .send-log-panel .panel-title {
      font-size: 13px;
      padding: 6px 10px;
    }

    .send-log-panel .panel-body {
      padding: 6px 10px;
    }

    .send-log {
      max-height: 200px;
      overflow-y: auto;
    }

    .send-log-entry {
      font-size: 11px;
      color: var(--text-dim);
      padding: 1px 0;
    }
  `],
})
export class MasterComponent implements OnInit {
  private firebase = inject(FirebaseService);

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
      this.showToast('Firebase no configurado');
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
      this.showToast('No hay monstruos vivos');
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
      this.showToast(monster.name + ' derrotado (-' + dmg + ')');
    } else {
      this.showToast('-' + dmg + ' a ' + monster.name);
    }
  }

  healMonster(monster: Monster) {
    monster.currentHP = monster.maxHP;
    this.saveMonsters();
    this.showToast(monster.name + ' curado al máximo');
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
    this.showToast('Monstruo añadido');
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
    this.showToast(npc.name + ' añadido');
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
    this.showToast('Eventos limpiados');
  }

  clearPlayers() {
    const db = this.firebase.getDb();
    for (const name of this.knownPlayers()) {
      remove(ref(db, 'players/' + name));
    }
    this.knownPlayers.set([]);
    this.showToast('Lista de jugadores limpiada');
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

  quickSendDebuff(name: string, targetStat: string, value: number, duration: number) {
    const target = this.sendTargetName().trim();
    if (!target) { this.showToast('Selecciona un jugador'); return; }
    this.firebase.pushData('playerEvents', {
      target,
      type: 'buff',
      effect: { type: 'debuff', name, target: targetStat, value, duration, debuffType: this.selectedDebuffType() },
      timestamp: Date.now(),
    });
    this.sendLog.update(log => [`${target}: ${name} (${duration}t)`, ...log].slice(0, 8));
    this.showToast(`${name} → ${target}`);
  }

  quickSendDot() {
    const target = this.sendTargetName().trim();
    if (!target) { this.showToast('Selecciona un jugador'); return; }
    const dmg = this.dotAmount();
    const dur = this.dotDuration() || 3;
    if (!dmg || dmg <= 0) { this.showToast('Introduce danno/turno'); return; }
    this.firebase.pushData('playerEvents', {
      target,
      type: 'buff',
      effect: { type: 'dot', name: 'DoT del Master', target: 'hp', value: dmg, duration: dur, debuffType: this.selectedDebuffType() },
      timestamp: Date.now(),
    });
    this.sendLog.update(log => [`${target}: DoT ${dmg}/t · ${dur}t`, ...log].slice(0, 8));
    this.showToast(`DoT ${dmg}/t · ${dur}t → ${target}`);
    this.dotAmount.set(null);
    this.dotDuration.set(null);
  }

  quickSendDirect(type: 'heal' | 'damage') {
    const target = this.sendTargetName().trim();
    if (!target) { this.showToast('Selecciona un jugador'); return; }
    const amount = this.sendAmount();
    if (!amount || amount <= 0) { this.showToast('Introduce una cantidad'); return; }
    this.firebase.pushData('playerEvents', {
      target,
      type,
      amount,
      timestamp: Date.now(),
    });
    const label = type === 'heal' ? '+' + amount : '-' + amount;
    this.sendLog.update(log => [`${target}: ${label} HP`, ...log].slice(0, 8));
    this.showToast(`${label} HP → ${target}`);
    this.sendAmount.set(null);
  }

  sendXP() {
    const target = this.sendTargetName().trim();
    if (!target) { this.showToast('Selecciona un jugador'); return; }
    const amount = this.xpAmount();
    if (!amount || amount <= 0) { this.showToast('Introduce XP'); return; }
    this.firebase.pushData('playerEvents', {
      target,
      type: 'xp',
      amount,
      timestamp: Date.now(),
    });
    this.sendLog.update(log => [`${target}: +${amount} XP`, ...log].slice(0, 8));
    this.showToast(`+${amount} XP → ${target}`);
    this.xpAmount.set(null);
  }

  sendLevel(levels: number) {
    const target = this.sendTargetName().trim();
    if (!target) { this.showToast('Selecciona un jugador'); return; }
    this.firebase.pushData('playerEvents', {
      target,
      type: 'levelup',
      amount: levels,
      timestamp: Date.now(),
    });
    this.sendLog.update(log => [`${target}: +${levels} nivel(es)`, ...log].slice(0, 8));
    this.showToast(`+${levels} nivel(es) → ${target}`);
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
        this.showToast(`${event.ability} → ${target}: +${event.damage} HP`);
      }
    }

    this.markEventAssigned(event);
    this.playerTargetName.set('');
    this.selectedEventId.set(null);
  }
}
