import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const valkyrieAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'valkyries_call':
        castValkyriesCall(ability, ctx);
        return true;
      case 'valk_call_from_valhalla':
        castCallFromValhalla(ability, ctx);
        return true;
      default:
        return false;
    }
  },
};

function castValkyriesCall(ability: any, { svc, player }: ClassHooksContext) {
  const myName = svc.character().name || 'Jugador';
  const turn = svc.turnNumber();
  const now = Date.now();
  const heal = Math.round(svc.maxHP() * 0.15);
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
    ability: ability.name + ' (Cura)',
    damage: heal,
    damageType: 'heal',
    isHot: false,
    hotTick: 0,
    hotDuration: 0,
    isShield: false,
  });
  player.sendDamagePayload({
    ...base,
    ability: ability.name + ' (Accion)',
    damage: 0,
    damageType: 'buff',
    buffStat: 'actions_per_turn',
    buffValue: 1,
    buffDuration: 1,
    isPercent: false,
  });
  svc.showToast("Valkyrie's Call: +1 accion a todos los aliados y cura de " + heal + ' HP — 2 eventos AOE al Master');
}

function castCallFromValhalla(ability: any, { svc, player }: ClassHooksContext) {
  if (svc.simMode()) {
    svc.showToast('Call from Valhalla no esta disponible en la simulacion');
    return;
  }
  const myName = svc.character().name || 'Jugador';
  player.sendDamagePayload({
    player: myName,
    ability: ability.name + ' (Revive)',
    rank: ability.currentRank || 1,
    damage: svc.maxHP(),
    damageType: 'rebirth',
    aoe: false,
    effects: null,
    buffAp: 50,
    buffSp: 50,
    buffDuration: 2,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast('⚔️ Call from Valhalla: revivira a un aliado muerto con ' + svc.maxHP() + ' HP y +50 AP/SP (2 turnos) — asigna el objetivo en el Master');
}
