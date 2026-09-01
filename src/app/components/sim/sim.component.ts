import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { SimCombatService } from '../../services/sim-combat.service';
import { TranslationService } from '../../services/translation.service';
import { PlayerComponent } from '../player/player.component';

@Component({
  selector: 'app-sim',
  standalone: true,
  imports: [PlayerComponent],
  templateUrl: './sim.component.html',
  styleUrls: ['./sim.component.css'],
})
export class SimComponent implements OnInit, OnDestroy {
  charSvc = inject(CharacterService);
  simCombat = inject(SimCombatService);
  trSvc = inject(TranslationService);

  enemyReady = signal(false);

  ngOnInit() {
    this.charSvc.enterSim();
    this.enemyReady.set(true);
  }

  ngOnDestroy() {
    this.charSvc.exitSim();
  }

  reset() {
    this.charSvc.resetSim();
  }

  enemy() {
    return this.simCombat.enemy();
  }

  log() {
    return this.simCombat.log();
  }

  hpPercent(): number {
    const e = this.simCombat.enemy();
    if (!e || e.maxHP <= 0) return 0;
    return Math.max(0, Math.round((e.currentHP / e.maxHP) * 100));
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }
}
