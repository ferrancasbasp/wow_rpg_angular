import type { CharacterService } from '../../services/character.service';
import type { SpellHooks } from './spell-hooks';

export interface PlayerLink {
  sendDamagePayload(payload: Record<string, unknown>): void;
  setValkFallen(active: boolean): void;
  updateAbilityRoll(id: string, roll: number, crit: boolean): void;
}

export interface ClassHooksContext {
  svc: CharacterService;
  player: PlayerLink;
  t(key: string): string;
}

export interface ClassAbilityHooks {
  castUtility?(ability: any, ctx: ClassHooksContext): boolean;
  spell?: SpellHooks;
}

export const noopAbilityHooks: ClassAbilityHooks = {};
