import { TestBed } from '@angular/core/testing';
import { CharacterService } from './character.service';
import { ClassRegistryService } from './class-registry.service';
import { createDefaultCharacter } from '../data/game-data';

describe('Valkyrie train debug', () => {
  let svc: CharacterService;
  let registry: ClassRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(CharacterService);
    registry = TestBed.inject(ClassRegistryService);
  });

  function makeValk(level: number) {
    const c = createDefaultCharacter('valkyrie', registry.getAll());
    c.level = level;
    svc.character.set(c);
  }

  it('valkyrie muestra habilidades entrenables a varios niveles', () => {
    const out: string[] = [];
    let totalTrainable = 0;
    for (const lvl of [1, 5, 8, 12, 18, 25]) {
      makeValk(lvl);
      const trainable = svc.trainableAbilities();
      totalTrainable += trainable.length;
      out.push(lvl + ': [' + trainable.map((a: any) => a.id + '(r' + svc.trainedRank(a.id) + '->' + svc.maxAvailableRank(a) + ')').join(', ') + ']');
    }
    console.log('Valkyrie trainable:\n' + out.join('\n'));
    expect(totalTrainable).toBeGreaterThan(0);
    makeValk(25);
    expect(svc.trainableAbilities().length).toBeGreaterThan(0);
  });

  it('trainAll entrena todas las habilidades a maximo en nivel 25', () => {
    makeValk(25);
    let guard = 0;
    while (svc.canTrain() && guard < 200) {
      svc.trainAll();
      guard++;
    }
    const out = Object.entries(svc.character().trainedRanks || {}).map(([k, v]) => k + '=' + v).join(', ');
    console.log('trainedRanks after trainAll: ' + out);
    expect(guard).toBeLessThan(200);
    expect(svc.canTrain()).toBe(false);
    expect(Object.keys(svc.character().trainedRanks || {}).length).toBeGreaterThan(0);
  });
});
