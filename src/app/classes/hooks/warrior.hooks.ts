import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const warriorAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'colossus_smash':
        castColossusSmash(ability, ctx);
        return true;
      case 'shield_wall':
        castShieldWall(ability, ctx);
        return true;
      case 'recklessness':
        castRecklessness(ability, ctx);
        return true;
      default:
        return false;
    }
  },
  spell: {
    onRollReady(ability, ctx) {
      if (ability.id === 'charge' && ctx.svc.character().classKey === 'warrior') {
        const icRank = ctx.svc.talentRank('improved_charge');
        if (icRank > 0) {
          const hs = ctx.svc.unlockedAbilities().find((a: any) => a.id === 'heroic_strike');
          const hsAvg = hs ? Math.round((((hs as any).currentMin || 0) + ((hs as any).currentMax || 0)) / 2) : 20;
          ctx.roll += Math.round(hsAvg * 0.15 * icRank);
        }
      }
    },
    onSpend(ability, ctx) {
      if (ability.id === 'basic_attack' && ctx.isRage) {
        const usRank = ctx.svc.talentRank('unyielding_strikes');
        if (usRank > 0 && Math.random() * 100 < usRank * 4) {
          ctx.svc.useAction(-1);
          ctx.texts['unyielding'] = ' · ¡Acción gratis!';
        }
      }
    },
    modifyCritChance(ability, ctx) {
      if (ability.id === 'basic_attack' && ctx.svc.character().classKey === 'warrior') {
        ctx.critChance += ctx.svc.talentRank('unyielding_strikes') * 1;
      }
    },
  },
};

function castColossusSmash(ability: any, { svc, player }: ClassHooksContext) {
  const weaponDmg = svc.totalWeaponDamage();
  const apBonus = Math.round(svc.attackPower() / 7);
  const base = Math.round(weaponDmg * 2) + apBonus;
  const min = Math.max(1, Math.round(base * 0.5));
  const max = Math.max(min + 1, Math.round(base * 1.5));
  let roll = min + Math.floor(Math.random() * (max - min + 1));
  let isCrit = false;
  if (Math.random() * 100 < parseFloat(svc.meleeCrit())) {
    isCrit = true;
    let critMult = 1.5;
    if (svc.hasEffect('recklessness')) critMult = critMult * 1.20;
    roll = Math.round(roll * critMult);
  }
  if (svc.inBattleStance()) {
    roll = Math.round(roll * (1.10 + svc.talentRank('improved_stances') * 0.02));
  }
  svc.addTurnDamage(roll);
  player.sendDamagePayload({
    player: svc.character().name || 'Jugador',
    ability: ability.name,
    rank: 1,
    damage: roll,
    damageType: 'physical',
    effects: [{ type: 'debuff', name: 'Colossus Smash', target: 'armor', value: 30, duration: 2, debuffType: 'none', stackable: false }],
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast(ability.name + ': 💥 ' + roll + ' Fisico' + (isCrit ? ' · CRITICO' : '') + ' · armadura −30 (2 turnos) — enviado al Master');
}

function castShieldWall(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'shield_wall'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Shield Wall', target: 'shield_wall', value: 60, duration },
    ],
  }));
  svc.showToast('🛡️ Shield Wall activa · -60% daño recibido e inmune a control de masas (' + duration + ' turnos)');
}

function castRecklessness(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'recklessness'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Recklessness', target: 'recklessness', value: 30, duration },
    ],
  }));
  svc.showToast('🔥 Recklessness activa · +30% critico y +20% danyo critico · -30% resistencia (' + duration + ' turnos)');
}
