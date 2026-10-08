import type { ClassAbilityHooks } from './class-hooks';
import { warlockAbilityHooks } from './warlock.hooks';
import { warriorAbilityHooks } from './warrior.hooks';
import { mageAbilityHooks } from './mage.hooks';
import { shamanAbilityHooks } from './shaman.hooks';
import { hunterAbilityHooks } from './hunter.hooks';
import { rogueAbilityHooks } from './rogue.hooks';
import { priestAbilityHooks } from './priest.hooks';
import { druidAbilityHooks } from './druid.hooks';
import { valkyrieAbilityHooks } from './valkyrie.hooks';

export const classAbilityHooks: ClassAbilityHooks[] = [warlockAbilityHooks, warriorAbilityHooks, mageAbilityHooks, shamanAbilityHooks, hunterAbilityHooks, rogueAbilityHooks, priestAbilityHooks, druidAbilityHooks, valkyrieAbilityHooks];
