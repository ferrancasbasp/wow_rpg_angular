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
 *   S4 onSpend   → gasto de recurso real + refunds/tipos por clase
 *   S5 modifyRoll→ tirada base + mods planos (shield_bash, cone_of_cold)
 *   S6 crit      → critChance + early/genericos/late de critMult (orden NO conmutativo)
 *   S7 onCrit    → extras justo tras el crítico (shaman elemental_focus)
 *   S7 stance    → multiplicador de postura (genérico)
 *   S7 onRollReady → extras post-postura (warrior improved_charge)
 *   S7 spends    → combo (modifyComboSpend) / sun_shards / shards / notas (genéricos flag-driven)
 *   S8 gen       → generación de recursos tras el golpe
 *   S9 terminal  → onHot/onDot/onHeal/onDamage + payloads + toasts
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
  comboSpent: number;
  sunShardsSpent: number;
  hotTotal: number;
  dotTotal: number;
  dotTick: number;
  dotDuration: number;
  healBonus: number;
  // Ability que se envia al master (serpent/rend/sunder/wound la transforman).
  sendAbility: any;
  // Crit multiplier de los impactos extra de multiHit (valkyrie hurtfull_lightning).
  extraHitCritMult: number;
  texts: Record<string, string>;
}

export type SpellHookFn = (ability: any, ctx: SpellCastContext) => void;

export interface SpellHooks {
  // Override COMPLETO del pipeline (flujos autónomos con early-return):
  // valkyrie (valk_mending, valk_lightning_bolt, gates odins/vuelo, gasto del
  // pool para abilities con energyCost). Devuelve true si ya ha quedado gestionado;
  // false (o undefined) para que el pipeline continúe normalmente.
  castSpell?(ability: any, ctx: SpellCastContext): boolean;
  // S1 — muta ctx.cost tras el coste base y el descuento genérico de arcane_power.
  // Bard (vivace), druid (nature_guardian sunfall/starsurge), shaman (maelstorm).
  // Atención: la reducción genérica de inner_focus (=0) corre DESPUÉS del hook.
  modifyCost?: SpellHookFn;
  // S4 — corre justo tras useAction/consumo real de acción, antes del gasto de
  // recurso por resType. Shaman (reset combo + texto maelstorm), warrior
  // (unyielding_strikes: acción gratuita en basic_attack).
  onSpend?: SpellHookFn;
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
  // S7 — primeros extras tras determinar isCrit, ANTES del multiplicador genérico
  // de postura. Shaman (elemental_focus: +1 Maelstorm en crit de lightning/chain).
  onCrit?: SpellHookFn;
  // S7 — extras tras el multiplicador genérico de postura y antes de los spends.
  // Warrior (improved_charge sobre charge).
  onRollReady?: SpellHookFn;
  // S7 — dentro del bloque genérico spendsCombo: calcula el multiplicador sobre
  // ctx.roll con ctx.comboSpent. Rogue (x combo), druid (equinox/fragmented).
  modifyComboSpend?: SpellHookFn;
  // S9 terminal — delegan el cálculo específico de cada tipo de hechizo.
  onHot?: SpellHookFn;
  onDot?: SpellHookFn;
  onHeal?: SpellHookFn;
  // S9 damage (pre-toast): imbues, generacion de recursos, ignite/deep_wounds,
  // transformacion de sendAbility (serpent/rend/sunder), valk charge/taunt,
  // orbes elementales, hope_and_grace, extraHitCritMult, static/storm buffs.
  onDamage?: SpellHookFn;
  // S9 damage (post-payload): hits extra tras la cadena de multiHit y chain
  // (shaman windfury, hunter double_tap).
  onHit?: SpellHookFn;
}

export const noopSpellHooks: SpellHooks = {};
