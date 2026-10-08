import type { CharacterService } from '../../services/character.service';
import type { PlayerLink } from './class-hooks';

/**
 * Pipeline de castSpell (esqueleto por etapas).
 *
 * Orden de ejecución en el driver:
 *   S0 init      → recursos/estado base
 *   S1 modifyCost→ coste final (descuentos por clase)
 *   S2 gates     → recurs/CD/acciones/stealth/shards/combo (validaciones)
 *   S3 valkyrie  → pool lanza/escudo + flujos completos con override castSpell()
 *   S4 spend     → gasto de recurso real + refunds
 *   S5 modifyRoll→ tirada base + mods planos (shield_bash, cone_of_cold)
 *   S6 crit      → critChance + early/genericos/late de critMult (orden NO conmutativo)
 *   S7 onRollReady → extras post-crítico (combo/sun/shards/notas, stances, charge)
 *   S8 gen       → generación de recursos tras el golpe
 *   S9 terminal  → Hot/Dot/Heal/Damage + payloads + toasts
 *
 * Los hooks de cada clase viven en {clase}.hooks.ts -> spell: SpellHooks.
 * Regla de oro: nunca dejes una rama inline Y en el hook (doble ejecución);
 * el orden dentro de un punto de inyección debe respetar el cómputo original.
 */
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
  // Override COMPLETO del cast (flujos autónomos con early-return):
  // p.ej. valk_mending, valk_lightning_bolt. Devuelve true si ya lo ha gestionado.
  castSpell?(ability: any, ctx: SpellCastContext): boolean;
  // S1 — muta ctx.cost tras el coste base y el descuento genérico de arcane_power.
  // Bard (vivace), druid (nature_guardian sunfall/starsurge), shaman (maelstorm).
  // Atención: la reducción genérica de inner_focus (=0) corre DESPUÉS del hook.
  modifyCost?: SpellHookFn;
  // S5 — muta ctx.roll tras la tirada min/max base. Valkyrie (shield_bash warded),
  // mage (cone_of_cold improved).
  modifyRoll?: SpellHookFn;
  // S6 — muta ctx.critChance (solo sumas conmutativas). Corren antes de los
  // bonus genéricos de efectos (combustion +50, inner_focus +25).
  modifyCritChance?: SpellHookFn;
  // S6 — muta ctx.critMult ANTES de los multiplicadores genéricos
  // (demonic_form x1.25, recklessness x1.20, arcane_power x1.25).
  // Solo warlock (chaos_bolt/rain_of_fire: resetea a 1.5 + bonus).
  critMultEarly?: SpellHookFn;
  // S6 — muta ctx.critMult DESPUÉS de los multiplicadores genéricos.
  // Valkyrie (hurtfull_lightning), hunter (mortal_shots), shaman (elemental_fury
  // luego ascendance x1.25, en ese orden), mage (frost_power, orbes), rogue (lethality).
  // Mantén += y *= en el mismo orden que la fórmula original.
  critMultLate?: SpellHookFn;
  // S7 — extras post-crítico sobre roll/recursos (charge, spends de combo/shards/
  // notas/sun, storm_strike, evangelism…). Aún en construcción.
  onRollReady?: SpellHookFn;
}

export const noopSpellHooks: SpellHooks = {};
