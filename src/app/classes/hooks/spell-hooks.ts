import type { CharacterService } from '../../services/character.service';
import type { PlayerLink } from './class-hooks';

export interface SpellCastContext {
  svc: CharacterService;
  player: PlayerLink;
  t(key: string): string;
  ability: any;
  resType: string;
  isRage: boolean;
  isEnergy: boolean;
  isFocus: boolean;
  cost: number;
  resourceActual: number;
  resourceMax: number;
  manaActual: number;
  maelstormFree: boolean;
  lastWillRage: boolean;
  actionCost: number;
  clearcast: boolean;
  roll: number;
  critChance: number;
  critMult: number;
  isCrit: boolean;
  texts: Record<string, string>;
}

export type SpellHookFn = (ability: any, ctx: SpellCastContext) => void;

export interface SpellHooks {
  castSpell?(ability: any, ctx: SpellCastContext): boolean;
  modifyCost?: SpellHookFn;
  modifyRoll?: SpellHookFn;
  modifyCritChance?: SpellHookFn;
  critMultEarly?: SpellHookFn;
  critMultLate?: SpellHookFn;
  onRollReady?: SpellHookFn;
}

export const noopSpellHooks: SpellHooks = {};
