import type { CharacterService } from '../../services/character.service';

export interface PlayerLink {
  sendDamagePayload(payload: Record<string, unknown>): void;
}

export interface ClassHooksContext {
  svc: CharacterService;
  player: PlayerLink;
  t(key: string): string;
}

export interface ClassAbilityHooks {
  castUtility?(ability: any, ctx: ClassHooksContext): boolean;
}

export const noopAbilityHooks: ClassAbilityHooks = {};
