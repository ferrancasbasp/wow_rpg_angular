import { TestBed } from '@angular/core/testing';
import { CharacterService } from './character.service';
import { ClassRegistryService } from './class-registry.service';
import { createDefaultCharacter } from '../data/game-data';

describe('CharacterService — mage frost orbs shield (sim)', () => {
  let svc: CharacterService;
  let registry: ClassRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CharacterService);
    registry = TestBed.inject(ClassRegistryService);
  });

  function makeMage(level: number) {
    const c = createDefaultCharacter('mage', registry.getAll());
    c.level = level;
    svc.character.set(c);
  }

  function frostShield() {
    return (svc.character().activeEffects || []).find(
      (e: any) => e.target === 'shield' && e.name === 'Orbes de Escarcha'
    );
  }

  it('grants a pooled shield of 2% maxHP per frost orb at end of turn', () => {
    makeMage(12);
    svc.enterSim();
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    const maxHP = svc.maxHP();
    svc.nextTurn();
    const shield = frostShield();
    expect(shield).toBeTruthy();
    expect(shield!.value).toBe(Math.max(1, Math.round(maxHP * 0.04)));
  });

  it('frost shield ticks as a single pool refreshed while orbs are held', () => {
    makeMage(12);
    svc.enterSim();
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    const maxHP = svc.maxHP();
    const expected = Math.max(1, Math.round(maxHP * 0.06));
    for (let t = 0; t < 6; t++) {
      svc.nextTurn();
      const shield = frostShield();
      expect(shield).toBeTruthy();
      expect(shield!.value).toBe(expected);
    }
  });

  it('Icy Veins doubles the frost orb shield', () => {
    makeMage(12);
    svc.enterSim();
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    svc.addElementalOrb('frost');
    svc.character.update(c => ({
      ...c,
      activeEffects: [...(c.activeEffects || []), { id: 1, type: 'buff' as const, name: 'Icy Veins', target: 'icy_veins' as const, value: 1, duration: 2 }],
    }));
    const maxHP = svc.maxHP();
    svc.nextTurn();
    const shield = frostShield();
    expect(shield).toBeTruthy();
    expect(shield!.value).toBe(Math.max(1, Math.round(maxHP * 0.12)));
  });

  it('shield expires when no frost orbs are held', () => {
    makeMage(12);
    svc.enterSim();
    svc.addElementalOrb('frost');
    svc.nextTurn();
    expect(frostShield()).toBeTruthy();
    svc.addElementalOrb('fire');
    svc.addElementalOrb('arcane');
    svc.addElementalOrb('fire');
    svc.nextTurn();
    expect(frostShield()).toBeTruthy();
    svc.nextTurn();
    expect(frostShield()).toBeUndefined();
  });
});

describe('CharacterService — rogue energy talents (sim)', () => {
  let svc: CharacterService;
  let registry: ClassRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CharacterService);
    registry = TestBed.inject(ClassRegistryService);
  });

  function makeRogue() {
    const c = createDefaultCharacter('rogue', registry.getAll());
    svc.character.set(c);
  }

  it('Shadow Dance raises max energy to +20 while active', () => {
    makeRogue();
    svc.enterSim();
    const base = svc.resourceMax();
    svc.character.update(c => ({
      ...c,
      activeEffects: [...(c.activeEffects || []), { id: 1, type: 'buff' as const, name: 'Shadow Dance', target: 'shadow_dance', value: 0, duration: 3 }],
    }));
    expect(svc.resourceMax()).toBe(base + 20);
  });
});
