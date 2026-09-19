import { TestBed } from '@angular/core/testing';
import { PlayerComponent } from './player.component';
import { CharacterService } from '../../services/character.service';
import { ClassRegistryService } from '../../services/class-registry.service';
import { SimCombatService } from '../../services/sim-combat.service';
import { createDefaultCharacter } from '../../data/game-data';

describe('PlayerComponent — mage frost orbs absorb damage in sim', () => {
  let svc: CharacterService;
  let registry: ClassRegistryService;
  let simCombat: SimCombatService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CharacterService);
    registry = TestBed.inject(ClassRegistryService);
    simCombat = TestBed.inject(SimCombatService);
  });

  function makeMage(level: number) {
    const c = createDefaultCharacter('mage', registry.getAll());
    c.level = level;
    svc.character.set(c);
  }

  it('frost orb shield absorbs an incoming dummy hit', () => {
    makeMage(12);
    svc.enterSim();
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    const maxHP = svc.maxHP();
    const perPiece = Math.max(1, Math.round(maxHP * 0.02));

    const comp = TestBed.createComponent(PlayerComponent).componentInstance;
    svc.nextTurn();

    const piecesBefore = (svc.character().activeEffects || []).filter((e: any) => e.name === 'Orbes de Escarcha');
    expect(piecesBefore.length).toBe(1);
    expect(piecesBefore[0].value).toBe(Math.max(1, Math.round(maxHP * 0.06)));

    const hit = perPiece - 1;
    comp.hpAction(hit, 'magical');

    const piecesAfter = (svc.character().activeEffects || []).filter((e: any) => e.name === 'Orbes de Escarcha');
    expect(piecesAfter.length).toBe(1);
    expect(piecesAfter[0].value).toBe(piecesBefore[0].value - hit);
    expect(svc.hpActual()).toBe(maxHP);
  });

  it('full sim turn: shield granted then dummy hit reduces shield, not HP', () => {
    makeMage(12);
    svc.enterSim();
    simCombat.reset({ attacks: [{ name: 'Golpe', minDamage: 500, maxDamage: 500 }] });
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    const maxHP = svc.maxHP();

    const comp = TestBed.createComponent(PlayerComponent).componentInstance;
    svc.nextTurn();
    const shieldTotal = (svc.character().activeEffects || [])
      .filter((e: any) => e.name === 'Orbes de Escarcha')
      .reduce((a: number, p: any) => a + p.value, 0);
    expect(shieldTotal).toBe(Math.max(1, Math.round(maxHP * 0.06)));

    comp.endTurn();
    const hpLoss = maxHP - svc.hpActual();
    expect(hpLoss).toBeGreaterThan(0);
    expect(hpLoss).toBeLessThanOrEqual(500 - shieldTotal);
  });
});
