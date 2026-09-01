import { Routes } from '@angular/router';
import { PlayerComponent } from './components/player/player.component';
import { MasterComponent } from './components/master/master.component';
import { CombatComponent } from './components/combat/combat.component';
import { SimComponent } from './components/sim/sim.component';

export const routes: Routes = [
  { path: '', redirectTo: 'player', pathMatch: 'full' },
  { path: 'player', component: PlayerComponent },
  { path: 'master', component: MasterComponent },
  { path: 'combat', component: CombatComponent },
  { path: 'sim', component: SimComponent },
];
