import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const druidAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    if (ability.id === 'rebirth') {
      castRebirth(ability, ctx);
      return true;
    }
    return false;
  },
  spell: {
    modifyComboSpend(_ability, ctx) {
      if (ctx.svc.character().classKey === 'druid') {
        const equinoxRank = ctx.svc.talentRank('equinox');
        const fragPower = 0.30 * (1 + equinoxRank * 0.15);
        const aoeMult = ctx.ability.aoe ? 0.5 : 1.0;
        ctx.roll = Math.round(ctx.roll * (1 + ctx.comboSpent * fragPower * aoeMult));
      }
    },
    modifyCost(ability, ctx) {
      const svc = ctx.svc;
      if (svc.character().classKey === 'druid' && svc.selectedCapstone() === 'nature_guardian' && (ability.id === 'sunfall' || ability.id === 'starsurge')) {
        ctx.cost = 0;
      }
    },
  },
};

function castRebirth(ability: any, { svc, player }: ClassHooksContext) {
  if (svc.simMode()) {
    svc.showToast('Rebirth no esta disponible en la simulacion');
    return;
  }
  const flatHp = ability.currentMin || 200;
  const myName = svc.character().name || 'Jugador';
  player.sendDamagePayload({
    player: myName,
    ability: ability.name + ' (Revive)',
    rank: ability.currentRank || 1,
    damage: flatHp,
    damageType: 'rebirth',
    aoe: false,
    effects: null,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast('🌿 Rebirth R' + (ability.currentRank || 1) + ': avisado al Master (' + flatHp + ' HP) — debe revivirte con el botón 🌿');
}
