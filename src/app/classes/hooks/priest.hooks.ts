import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const priestAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    if (ability.id === 'holy_nova') {
      castHolyNova(ability, ctx);
      return true;
    }
    return false;
  },
};

function castHolyNova(ability: any, { svc, player }: ClassHooksContext) {
  const smite = svc.unlockedAbilities().find((a) => a.id === 'smite') as any;
  const healSpell = svc.unlockedAbilities().find((a) => a.id === 'heal') as any;
  const smiteMin = smite?.currentMin || 0;
  const smiteMax = smite?.currentMax || 0;
  const healMin = healSpell?.currentMin || 0;
  const healMax = healSpell?.currentMax || 0;
  const dmg = Math.max(1, Math.round((smiteMin + Math.random() * (smiteMax - smiteMin)) / 3));
  let heal = Math.max(1, Math.round((healMin + Math.random() * (healMax - healMin)) / 2));
  const hfRank = svc.talentRank('healing_focus');
  if (hfRank > 0) heal = Math.round(heal * (1 + hfRank * 0.05));
  const presRank = svc.talentRank('preservation');
  if (presRank > 0) heal = Math.round(heal * (1 + presRank * 0.10));
  let novaCrit = false;
  const novaCritChance = parseFloat(svc.spellCrit()) + svc.talentRank('illumination') * 2;
  if (Math.random() * 100 < novaCritChance) {
    novaCrit = true;
    heal = Math.round(heal * 1.5);
  }
  const myName = svc.character().name || 'Jugador';
  const turn = svc.turnNumber();
  const now = Date.now();
  const base = {
    player: myName,
    rank: ability.currentRank || 1,
    aoe: true,
    effects: null,
    turn,
    timestamp: now,
    assigned: false,
  };
  player.sendDamagePayload({
    ...base,
    ability: ability.name,
    damage: dmg,
    damageType: 'magical',
  });
  player.sendDamagePayload({
    ...base,
    ability: ability.name + ' (Cura)',
    damage: heal,
    damageType: 'heal',
    isHot: false,
    hotTick: 0,
    hotDuration: 0,
    isShield: false,
  });
  svc.showToast(ability.name + ': ' + dmg + ' dano a todos los enemigos (1/3 de Smite) y ' + heal + ' cura a todos los aliados (50% de Heal)' + (novaCrit ? ' ¡CRITICO!' : '') + ' — 2 eventos AOE al Master');
}
