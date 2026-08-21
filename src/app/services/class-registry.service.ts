import { Injectable } from '@angular/core';
import { CharacterClass } from '../models/game.models';
import { WARRIOR } from '../classes/warrior';
import { ROGUE } from '../classes/rogue';
import { MAGE } from '../classes/mage';
import { PRIEST } from '../classes/priest';
import { SHAMAN } from '../classes/shaman';
import { DRUID } from '../classes/druid';
import { BARD } from '../classes/bard';
import { WARLOCK } from '../classes/warlock';

@Injectable({ providedIn: 'root' })
export class ClassRegistryService {
  private classes: Record<string, CharacterClass> = {
    warrior: WARRIOR,
    rogue: ROGUE,
    mage: MAGE,
    priest: PRIEST,
    shaman: SHAMAN,
    druid: DRUID,
    bard: BARD,
    warlock: WARLOCK,
  };

  getAll(): Record<string, CharacterClass> {
    return this.classes;
  }

  get(key: string): CharacterClass | undefined {
    return this.classes[key];
  }

  getClassKeys(): string[] {
    return Object.keys(this.classes);
  }

  getClassByName(name: string): CharacterClass | undefined {
    return Object.values(this.classes).find(c => c.name === name);
  }
}
