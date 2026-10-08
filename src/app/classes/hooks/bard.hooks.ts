import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';
import { NOTE_NAMES } from '../../data/game-data';

export const bardAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    if (ability.id === 'finale') {
      castFinale(ability, ctx);
      return true;
    }
    return false;
  },
};

function castFinale(ability: any, { svc, player, t }: ClassHooksContext) {
  const notes = svc.getNotes();
  const level = svc.character().level;
  const ranks = ability.damageRanges || [];
  const rnk = [...ranks].reverse().find((d: any) => d.level <= level) || ranks[0];
  const minD = rnk ? rnk.min : 18;
  const maxD = rnk ? rnk.max : 26;
  let roll = minD + Math.floor(Math.random() * (maxD - minD + 1));
  roll += Math.round(svc.spellPower() * (ability.spellPowerRatio || 0.8));
  const contribution = svc.noteContribution();
  roll = Math.round(roll * contribution);
  let isCrit = false;
  if (Math.random() * 100 < parseFloat(svc.spellCrit())) {
    isCrit = true;
    roll = Math.round(roll * 1.5);
  }
  svc.clearNotes();
  let noteText = ' · ' + notes.length + ' notas consumidas (×' + contribution.toFixed(1) + ')';
  const maestroRank = svc.talentRank('maestro');
  if (maestroRank > 0 && Math.random() * 100 < maestroRank * 35) {
    svc.actionsUsed.update(n => Math.max(0, n - 1));
    noteText += ' · ¡Maestro! +1 accion';
  }
  const improRank = svc.talentRank('impro');
  if (improRank > 0 && Math.random() * 100 < improRank * 20) {
    const maxNote = svc.classConfig().comboConfig?.max || 7;
    const newNote = 1 + Math.floor(Math.random() * maxNote);
    svc.addNote(newNote);
    noteText += ' · ¡Impro! Nueva nota: ' + NOTE_NAMES[newNote - 1];
  }
  svc.addTurnDamage(roll);
  player.sendDamagePayload({
    player: svc.character().name || 'Jugador',
    ability: ability.name,
    rank: rnk ? rnk.rank : 1,
    damage: roll,
    damageType: 'magical',
    aoe: false,
    effects: null,
    turn: svc.turnNumber(),
    timestamp: Date.now(),
    assigned: false,
  });
  svc.showToast(ability.name + ': ' + roll + ' danyo de magia' + (isCrit ? ' ¡CRITICO!' : '') + noteText + ' — ' + t('sent_to_master'));
}
