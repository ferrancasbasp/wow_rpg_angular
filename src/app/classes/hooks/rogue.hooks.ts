import type { ClassAbilityHooks, ClassHooksContext } from './class-hooks';

export const rogueAbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {
    switch (ability.id) {
      case 'shadow_dance':
        castShadowDance(ability, ctx);
        return true;
      case 'blade_flurry':
        castBladeFlurry(ability, ctx);
        return true;
      case 'poison_mastery':
        castPoisonMastery(ability, ctx);
        return true;
      default:
        return false;
    }
  },
};

function castShadowDance(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'shadow_dance'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Shadow Dance', target: 'shadow_dance', value: 0, duration },
    ],
  }));
  svc.showToast('🩶 Shadow Dance activa · habilidades de sigilo sin Stealth (' + duration + ' turnos)');
}

function castBladeFlurry(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'blade_flurry'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Blade Flurry', target: 'blade_flurry', value: 0, duration },
    ],
  }));
  svc.showToast('🌪️ Blade Flurry activa · tu daño directo impacta a otro enemigo, +10 energía extra por turno (' + duration + ' turnos)');
}

function castPoisonMastery(ability: any, { svc }: ClassHooksContext) {
  const duration = 3;
  svc.character.update(c => ({
    ...c,
    activeEffects: [
      ...(c.activeEffects || []).filter(e => e.target !== 'poison_mastery'),
      { id: Date.now() + Math.random(), type: 'buff' as const, name: 'Poison Mastery', target: 'poison_mastery', value: 0, duration },
    ],
  }));
  const hasWound = svc.hasEffect('woundPoison');
  const hasMortal = svc.hasEffect('poisonDamage');
  const hasVamp = svc.hasEffect('leechPoison');
  let effectText: string;
  if (hasWound) {
    effectText = 'Wound: tus ataques además reducen un 25% el daño del enemigo';
  } else if (hasMortal) {
    effectText = 'Veneno Mortal x1.5';
  } else if (hasVamp) {
    effectText = 'Veneno Vampírico x1.5';
  } else {
    effectText = 'envenena antes tus armas para potenciar el veneno';
  }
  svc.showToast('☠️ Poison Mastery activa · ' + effectText + ' (' + duration + ' turnos)');
}
