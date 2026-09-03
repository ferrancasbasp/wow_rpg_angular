import { Component, OnInit, inject, signal } from '@angular/core';
import { FirebaseService } from '../../services/firebase.service';
import { symbolIcon as symbolIconOf, symbolImg as symbolImgOf } from '../../data/mob-symbols';

interface MonsterEffect {
  type: string;
  name: string;
  value: number;
  duration: number;
}

interface Monster {
  id: string;
  name: string;
  level: number;
  icon: string;
  imageUrl: string;
  currentHP: number;
  maxHP: number;
  lastAttackAt: number;
  effects: MonsterEffect[];
  symbol?: number | null;
}

interface FlashNumber {
  value: number;
  heal: boolean;
}

@Component({
  selector: 'app-combat',
  standalone: true,
  template: `
    <div class="combat-bg"></div>

    <div class="combat-header">
      <div class="combat-title">Combat</div>
      <div class="connection-status">
        <span class="status-dot" [class.connected]="connected()" [class.disconnected]="!connected()"></span>
        {{ connected() ? 'Conectado' : 'Sin conexión' }}
      </div>
    </div>

    @if (monsters().length > 0) {
      <div class="combat-grid">
        @for (monster of monsters(); track monster.id) {
          <div
            class="monster-card"
            [class.dead]="monster.currentHP <= 0"
            [class.damaged]="damagedIds()[monster.id] === 'damage'"
            [class.healed]="damagedIds()[monster.id] === 'heal'"
            [class.attacking]="!!attackingIds()[monster.id]"
          >
            <div class="monster-portrait">
              @if (monster.level) {
                <span class="monster-level-badge">Nv. {{ monster.level }}</span>
              }
              @if (monster.imageUrl) {
                <img
                  [src]="monster.imageUrl"
                  class="monster-portrait-img"
                  (error)="onImageError($event)"
                />
                <span class="monster-portrait-icon" style="display:none">{{ monster.icon || '⚔️' }}</span>
              } @else {
                <span class="monster-portrait-icon">{{ monster.icon || '⚔️' }}</span>
              }
              @if (flashNumbers()[monster.id]) {
                <div class="damage-flash" [class.heal]="flashNumbers()[monster.id]!.heal">
                  {{ flashNumbers()[monster.id]!.heal ? '+' : '-' }}{{ flashNumbers()[monster.id]!.value }}
                </div>
              }
            </div>

            <div class="monster-info">
              <div class="monster-name" [class.dead-name]="monster.currentHP <= 0">
                @if (symbolImg(monster.symbol)) {
                  <img class="monster-symbol" [class.dead-symbol]="monster.currentHP <= 0" [src]="symbolImg(monster.symbol)" alt="" />
                } @else {
                  <span class="monster-symbol">{{ symbolIcon(monster.symbol) }}</span>
                }{{ monster.name }}
              </div>
              <div class="hp-bar-wrapper">
                <div class="hp-bar-track">
                  <div
                    class="hp-bar-fill"
                    [class]="hpClass(monster)"
                    [style.width]="hpPercent(monster) + '%'"
                  ></div>
                  <div class="hp-bar-text">{{ hpPercent(monster) }}%</div>
                </div>
              </div>
              @if (monster.effects && monster.effects.length > 0) {
                <div class="monster-effects">
                  @for (eff of monster.effects; track $index) {
                    <span class="effect-chip" [class]="eff.type">
                      {{ eff.type === 'dot' ? '🩸' : eff.type === 'status' ? '⛔' : '📉' }} {{ eff.name }}
                      @if (eff.value > 0) {
                        <span> {{ eff.value }}</span>
                      }
                      <span class="effect-dur">{{ eff.duration }}t</span>
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="combat-empty">
        Esperando a que el master añada enemigos...
      </div>
    }
  `,
  styles: [`
    :host {
      --bg-dark: #0a0a0f;
      --bg-panel: #14141f;
      --bg-input: #1c1c2a;
      --gold: #c9b27e;
      --gold-light: #e8d5a3;
      --gold-dark: #8a7344;
      --gold-glow: rgba(201,178,126,0.15);
      --text: #d4c5a9;
      --text-dim: #8a8070;
      --text-muted: #5a554a;
      --danger: #c45151;
      --success: #5fa85f;
      --radius: 8px;
      --transition: all 0.2s ease;
      display: block;
      color: var(--text);
      font-family: 'EB Garamond', serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .combat-bg {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at 50% 70%, rgba(20,20,31,0.4) 0%, var(--bg-dark) 80%);
      z-index: -1;
    }

    .combat-header {
      text-align: center; padding: 30px 20px 10px;
    }
    .combat-title {
      font-family: 'Cinzel', serif; font-size: 32px; font-weight: 900;
      color: var(--gold-light); letter-spacing: 0.15em; text-transform: uppercase;
      text-shadow: 0 0 30px var(--gold-glow);
    }

    .connection-status {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 12px; color: var(--text-dim); margin-top: 8px;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.connected { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .status-dot.disconnected { background: var(--danger); }

    .combat-grid {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 24px;
      padding: 20px 30px 40px; max-width: 1400px; margin: 0 auto;
    }

    .monster-card {
      background: var(--bg-panel); border: 2px solid var(--gold-dark);
      border-radius: var(--radius); overflow: hidden; width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(138,115,68,0.1);
      transition: border-color 0.3s ease, transform 0.3s ease;
      position: relative;
    }
    .monster-card.dead {
      border-color: var(--danger); opacity: 0.4; filter: grayscale(0.8);
    }
    .monster-card.damaged {
      animation: shake 0.4s ease;
    }
    .monster-card.healed {
      animation: pulse-green 0.5s ease;
    }
    .monster-card.attacking {
      animation: combat-shake 0.4s ease;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-5px); }
      80% { transform: translateX(5px); }
    }
    @keyframes combat-shake {
      0%, 100% { transform: translateX(0) rotate(0deg); }
      15% { transform: translateX(-6px) rotate(-1deg); }
      30% { transform: translateX(6px) rotate(1deg); }
      45% { transform: translateX(-4px) rotate(-0.5deg); }
      60% { transform: translateX(4px) rotate(0.5deg); }
      75% { transform: translateX(-2px); }
    }
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
      50% { box-shadow: 0 8px 32px rgba(95,168,95,0.5), 0 0 20px rgba(95,168,95,0.3); }
    }

    .monster-portrait {
      width: 100%; background: var(--bg-dark);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
      border-bottom: 2px solid var(--gold-dark);
    }
    .monster-portrait::before {
      content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, rgba(201,178,126,0.05) 0%, transparent 70%);
    }
    .monster-portrait-icon {
      font-size: 80px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
      z-index: 1; min-height: 180px; display: flex; align-items: center; justify-content: center;
    }
    .monster-portrait-img {
      width: 100%; height: auto; display: block; z-index: 1;
    }
    .monster-level-badge {
      position: absolute; top: 8px; right: 8px;
      font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700;
      background: var(--bg-dark); border: 1px solid var(--gold-dark);
      border-radius: 4px; padding: 2px 10px; color: var(--gold-light); z-index: 2;
    }

    .monster-info {
      padding: 14px 16px 16px;
    }
    .monster-name {
      font-family: 'Cinzel', serif; font-size: 20px; font-weight: 700; color: var(--gold-light);
      text-align: center; margin-bottom: 12px; letter-spacing: 0.05em;
    }
    .monster-name.dead-name { color: var(--danger); text-decoration: line-through; }
    .monster-symbol {
      width: 20px; height: 20px; margin-right: 6px; font-size: 18px;
      vertical-align: middle; border-radius: 3px; object-fit: contain;
    }
    .monster-symbol.dead-symbol { filter: grayscale(1) opacity(0.5); }

    .hp-bar-wrapper {
      position: relative; margin-bottom: 8px;
    }
    .hp-bar-track {
      height: 28px; background: var(--bg-dark); border: 1px solid var(--gold-dark);
      border-radius: 4px; overflow: hidden; position: relative;
    }
    .hp-bar-fill {
      height: 100%; transition: width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      border-radius: 2px;
    }
    .hp-bar-fill.high { background: linear-gradient(180deg, #4a8e3a 0%, #2d6b1f 100%); }
    .hp-bar-fill.medium { background: linear-gradient(180deg, #c4a830 0%, #8a7a1e 100%); }
    .hp-bar-fill.low { background: linear-gradient(180deg, #c0392b 0%, #8b2e1e 100%); }
    .hp-bar-text {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 14px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      font-family: 'Cinzel', serif; white-space: nowrap;
    }

    .monster-effects {
      display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 8px;
    }
    .effect-chip {
      font-size: 12px; padding: 3px 10px; border-radius: 12px;
      display: flex; align-items: center; gap: 4px; font-weight: 600;
    }
    .effect-chip.dot {
      background: rgba(192,57,43,0.25); color: #ff7070; border: 1px solid rgba(192,57,43,0.4);
    }
    .effect-chip.debuff {
      background: rgba(155,89,182,0.25); color: #b388e0; border: 1px solid rgba(155,89,182,0.4);
    }
    .effect-chip.status {
      background: rgba(255,156,0,0.25); color: #ffb347; border: 1px solid rgba(255,156,0,0.4);
    }
    .effect-dur { font-size: 10px; background: rgba(0,0,0,0.4); padding: 0 4px; border-radius: 6px; }

    .damage-flash {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: 'Cinzel', serif; font-size: 42px; font-weight: 900; color: #c0392b;
      text-shadow: 0 0 20px rgba(192,57,43,0.8), 0 2px 8px rgba(0,0,0,0.9);
      pointer-events: none; z-index: 10; animation: float-up 1.2s ease-out forwards;
    }
    .damage-flash.heal { color: #5fa85f; text-shadow: 0 0 20px rgba(95,168,95,0.8); }
    @keyframes float-up {
      0% { opacity: 0; transform: translate(-50%, -30%) scale(0.5); }
      20% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
      60% { opacity: 1; transform: translate(-50%, -70%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -120%) scale(0.8); }
    }

    .combat-empty {
      text-align: center; padding: 80px 20px; color: var(--text-muted);
      font-style: italic; font-size: 18px;
    }

    .armor-row {
      display: flex; justify-content: center; gap: 12px; margin-top: 6px;
      font-size: 13px; color: var(--text-dim);
    }
    .armor-tag {
      background: var(--bg-dark); padding: 2px 10px; border-radius: 4px;
      border: 1px solid rgba(138,115,68,0.2);
    }

    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-dark); }
    ::-webkit-scrollbar-thumb { background: var(--gold-dark); border-radius: 4px; }

    @media (max-width: 768px) {
      .monster-card { width: 100%; max-width: 400px; }
      .combat-grid { padding: 10px; }
    }
  `],
})
export class CombatComponent implements OnInit {
  private firebase = inject(FirebaseService);

  monsters = signal<Monster[]>([]);
  connected = signal<boolean>(false);
  symbolIcon = (index: number | null | undefined) => symbolIconOf(index);
  symbolImg = (index: number | null | undefined) => symbolImgOf(index);
  prevHpMap = signal<Record<string, number>>({});
  prevAttackMap = signal<Record<string, number>>({});
  damagedIds = signal<Record<string, string | null>>({});
  attackingIds = signal<Record<string, boolean>>({});
  flashNumbers = signal<Record<string, FlashNumber | null>>({});

  ngOnInit() {
    this.firebase.onValue('.info/connected', (val) => {
      this.connected.set(val === true);
    });

    this.firebase.onValue('monsters', (data) => {
      if (data && data.list) {
        this.onMonstersUpdate(data.list);
      } else {
        this.monsters.set([]);
      }
    });
  }

  onMonstersUpdate(list: Monster[]) {
    const newHpMap: Record<string, number> = {};
    const newAttackMap: Record<string, number> = {};
    const prevHp = this.prevHpMap();
    const prevAttack = this.prevAttackMap();

    for (const m of list) {
      newHpMap[m.id] = m.currentHP;
      newAttackMap[m.id] = m.lastAttackAt || 0;

      if (prevHp[m.id] !== undefined && prevHp[m.id] !== m.currentHP) {
        const diff = m.currentHP - prevHp[m.id];
        if (diff < 0) {
          this.triggerDamage(m.id, Math.abs(diff));
        } else if (diff > 0) {
          this.triggerHeal(m.id, diff);
        }
      }

      if (prevAttack[m.id] !== undefined && newAttackMap[m.id] > prevAttack[m.id]) {
        this.triggerAttack(m.id);
      }
    }

    this.prevHpMap.set(newHpMap);
    this.prevAttackMap.set(newAttackMap);
    this.monsters.set(list);
  }

  triggerAttack(monsterId: string) {
    this.attackingIds.update((map) => ({ ...map, [monsterId]: true }));
    setTimeout(() => {
      this.attackingIds.update((map) => ({ ...map, [monsterId]: false }));
    }, 400);
  }

  triggerDamage(monsterId: string, amount: number) {
    this.damagedIds.update((map) => ({ ...map, [monsterId]: 'damage' }));
    this.flashNumbers.update((map) => ({ ...map, [monsterId]: { value: amount, heal: false } }));
    setTimeout(() => {
      this.damagedIds.update((map) => ({ ...map, [monsterId]: null }));
    }, 400);
    setTimeout(() => {
      this.flashNumbers.update((map) => ({ ...map, [monsterId]: null }));
    }, 1200);
  }

  triggerHeal(monsterId: string, amount: number) {
    this.damagedIds.update((map) => ({ ...map, [monsterId]: 'heal' }));
    this.flashNumbers.update((map) => ({ ...map, [monsterId]: { value: amount, heal: true } }));
    setTimeout(() => {
      this.damagedIds.update((map) => ({ ...map, [monsterId]: null }));
    }, 500);
    setTimeout(() => {
      this.flashNumbers.update((map) => ({ ...map, [monsterId]: null }));
    }, 1200);
  }

  hpPercent(monster: Monster): number {
    if (monster.maxHP === 0) return 0;
    return Math.max(0, Math.floor((monster.currentHP / monster.maxHP) * 100));
  }

  hpClass(monster: Monster): string {
    const pct = this.hpPercent(monster);
    if (pct > 50) return 'high';
    if (pct > 25) return 'medium';
    return 'low';
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const sibling = img.nextElementSibling as HTMLElement;
    if (sibling) {
      sibling.style.display = 'flex';
    }
  }
}
