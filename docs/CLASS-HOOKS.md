# Arquitectura de hooks por clase (pipeline de `castSpell`)

Documento de referencia para **cualquier agente IA (Claude, opencode) o persona** que vaya a tocar
el diseño de clases, habilidades o talentos. Léelo completo (y lee `CAST_SPELL` antes de editar
`player.component.ts`) si tu cambio afecta al casting de habilidades.

## 1. Qué es esto

`castSpell` (en `components/player/player.component.ts`) era una función monolítica de >700 líneas
con decenas de ramas por habilidad/clase. Se ha refactorizado a un **esqueleto genérico por etapas
(S0→S9)** que delega la lógica específica de cada clase en **hooks** ubicados en
`src/app/classes/hooks/`.

Regla del proyecto: **el esqueleto solo contiene lógica genérica (flags de datos, flujo, recursos).
Toda rama que dependa de identidad de clase o talento de una clase vive en el hook de esa clase.**

## 2. Archivos

| Archivo | Responsabilidad |
|---|---|
| `classes/hooks/spell-hooks.ts` | Contrato de `castSpell`: `SpellCastContext` + `SpellHooks` + **mapa documentado del pipeline S0→S9** (fuente canónica del orden). |
| `classes/hooks/class-hooks.ts` | Contrato de utilidades: `ClassAbilityHooks` (`castUtility`), `ClassHooksContext`, `PlayerLink`. |
| `classes/hooks/registry.ts` | Registro **con el orden de las 10 clases**: `warlock, warrior, mage, shaman, hunter, rogue, priest, druid, valkyrie, bard`. |
| `classes/hooks/<clase>.hooks.ts` | Un archivo por clase con `castUtility` y `spell: SpellHooks`. |
| `classes/hooks/spell-crit-parity.spec.ts` | Spec de paridad: 18 escenarios de roll/crit + escenarios de coste (29 tests en total). Tras cambiar hooks, debe seguir verde. |

El driver (esqueleto) vive en `player.component.ts`:
- `castSpell(ability)` → construye `SpellCastContext`, ejecuta S0→S9 llamando a `runSpellHooks()`.
- `runSpellHooks(method, ability, ctx)` → itera TODOS los hooks de todas las clases en orden de
  registro. **Los hooks de una clase corren siempre; por eso cada hook debe guardar por `classKey`.**
- `runSpellHooksCast('castSpell', …)` / `dispatchClassAbility(...)` → iteran hasta que un hook
  devuelve `true` (override completo con early-return).

## 3. El pipeline S0→S9 (orden exacto de `castSpell`)

El orden NO es conmutativo. Antes de mover una rama a un hook, mira en qué etapa corre y respeta el
orden del cómputo original.

| Etapa | Hook / mecanismo | Qué hace | Ejemplos |
|---|---|---|---|
| **S0/S1** | contexto + `modifyCost` | Inicializa ctx, coste base, descuento genérico `arcane_power`. `modifyCost` muta `ctx.cost` | bard vivace, druid nature_guardian (sunfall/starsurge), shaman maelstorm |
| **S2** | gates (genérico) | CD, acciones, instantes (flags `instant`), stealth, shards, combo — validaciones | — (flag-driven) |
| **S3** | `castSpell` override | Flujos completos de valkyrie con early-return (pool lanza/escudo, valk_mending, valk_lightning_bolt, gates odins/vuelo). Devuelve `true` para frenar el pipeline | valkyrie |
| **S4** | `onSpend` + gasto real | Tras `useAction` tomado; gasta recurso real y aplica refunds/tipos. `onSpend` corre **antes** del gasto | shaman reset combo, warrior unyielding_strikes |
| **S5** | `modifyRoll` | Tirada min/max base + mods planos por clase (muta `ctx.roll`) | valkyrie shield_bash warded, mage cone_of_cold |
| **S6** | `modifyCritChance` / `critMultEarly` / genéricos / `critMultLate` | → `ctx.isCrit`. `modifyCritChance` = solo sumas. `critMultEarly` antes de los multipl. genéricos (demonic_form x1.25, recklessness x1.20, arcane_power x1.25). `critMultLate` después y **en el orden `+=`/`*=` original** | rogue improve_backstab/lethality, warlock chaos_bolt, valkyrie hurtfull_lightning, hunter mortal_shots, shaman elemental_fury/ascendance, mage frost_power/orbes |
| **S7** | `onCrit` → postura genérica → `onRollReady` | Extras justo al crit (antes de postura), multiplicador de postura genérico, y extras después | shaman elemental_focus, warrior improved_charge |
| **S7** | `modifyComboSpend` + spends | Bloque genérico spendsCombo/sun_shards/shards/notas; `modifyComboSpend` ajusta `ctx.roll` con `ctx.comboSpent` | rogue x combo, druid equinox |
| **S8** | generación (genérico) | `focusGain`, efectos genéricos, evangelism (gestión de efecto por `ability.category`) | — |
| **S9** | `onHot` / `onDot` / `onHeal` / `onDamage` / `onHit` | Cálculo y textos por tipo de hechizo | ver §4 |

## 4. Terminales S9 (detalle)

- **`onHot`** — tras el tick del HoT. Drúida: lunar_healing, germination (usa `ctx.hotTotal`).
- **`onDot`** — tras el daño directo inicial del DoT. Warlock immolate (mitad directa), shaman
  flame_shock (directo completo). Los bump de ev/contagion/dot_master son genéricos inline.
- **`onHeal`** — corre **al inicio** de la rama heal: `ctx.healBonus` compuesto por clase + textos.
  Priest (preservation, improved_shield), shaman (tidal_waves, spirit_link, healing_grace), bard
  (resonance, improved_vivace), druid (lunar_healing). El fragmente de `dark_mending`/`healthstone`
  está inline (flujos data-driven).
- **`onDamage` (pre-toast)** — corre antes del toast de daño, con `ctx.roll` y `ctx.sendAbility`
  disponibles para mutar: imbues, generación de recursos, ignite/deep_wounds, transformación de
  `sendAbility` (serpent/rend/sunder), valk charge/taunt, orbes elementales, hope_and_grace,
  `ctx.extraHitCritMult` (multiHit), static/storm buffs, sforzando.
- **`onHit` (post-payload)** — corre tras la cadena de multiHit y chain: hits extra con su propio
  toast (shaman windfury, hunter double_tap). Aquí **sí** se llama `showToast` porque el hit extra
  es una acción completa, no un fragmento.
- Los kill/payload (`sendDamageEvent`,`turnDamage`) y la **fusión de toasts** los hace el esqueleto
  leyendo `ctx.texts['<clave>']` **en el orden exacto** y con " · " separando fragmentos.

## 5. Contratos

### `SpellCastContext`
```ts
{ svc, player, t, ability, resType, isRage, isEnergy, isFocus,
  cost, resourceActual, resourceMax, manaActual,
  maelstormFree, lastWillRage, actionCost, clearcast,
  roll, critChance, critMult, isCrit,
  comboSpent, sunShardsSpent, hotTotal, dotTotal, dotTick, dotDuration, healBonus,
  sendAbility, extraHitCritMult, texts }
```
Campos mutables por los hooks: `cost`, `roll`, `critChance`, `critMult`, `healBonus`,
`dotTick/dotDuration`, `extraHitCritMult`, `sendAbility`, `texts[...]`.

### `PlayerLink` (puente hacia el componente; no mutar el servicio directamente)
```ts
{ sendDamagePayload(payload), setValkFallen(active), updateAbilityRoll(id, roll, crit) }
```

## 6. Reglas de oro

1. **Nunca dupliques.** Una rama vive en el driver inline O en el hook, jamás en ambos (doble
   ejecución). Al migrar algo, elimina la rama inline del driver.
2. **Guarda por `classKey`.** Todos los hooks de todas las clases corren en cada cast. Si tu hook
   es de clase, empieza por `if (ctx.svc.character().classKey !== '<clase>') return;` o matchea el
   `ability.id` exacto.
3. **Respeta el orden no conmutativo** del cómputo original dentro de cada etapa (especialmente S6:
   `+=` y `*=` en el mismo orden que la fórmula original).
4. **Toasts:** los hooks de S9 añaden fragmentos a `ctx.texts['<clave>']`; el esqueleto los fusiona.
   Solo un hook que sea dueño de una acción completa (v.gr. un hit extra en `onHit`, flujos
   autónomos de valkyrie en `castSpell`) llama a `svc.showToast(...)` con su propio mensaje.
5. **`sendAbility`** es la ability que se envía al master; si una rama la transforma
   (tarjetas `inflictsEffects`, etc.), muta `ctx.sendAbility`, nunca `ctx.ability`.
6. **Nunca laves el pipeline por tienda:** `castSpell`/`castUtility` de un hook devuelve
   `true` solo cuando el hook gestiona el flujo completo con early-return; `false`/`undefined`
   deja que el esqueleto siga.
7. **Registrar y declarar:** un archivo nuevo de clase se añade a `registry.ts` **en el mismo orden**
   que las clases (`warlock…bard`); un punto de inyección nuevo se documenta en el mapa de
   `spell-hooks.ts` y en los comentarios `// S<n>` del driver.
8. **Estado del personaje:** muta siempre inmutable vía `svc.character.update(c => ({...c, ...}))`
   y usa los helpers del servicio (`svc.useAction`, `svc.spendValkyriePool`, `svc.sendDamageEvent`,
   `svc.sendHealEvent`, `svc.turnDamage.update`, `svc.syncPlayerStatus`, `svc.showToast`).
9. **TS4111:** `ctx.texts` es index signature; accede SIEMPRE con corchetes `ctx.texts['clave']`.
10. **UI en español:** advertencias/toasts nuevos en español; añade entrada en
    `translation.service.ts` (es/en) si es un texto general (usa `ctx.t('clave')`).

## 7. Cómo añadir una clase nueva

1. Crea `classes/<clase>.ts` con un `CharacterClass` (stats, recurso, talentos, capstones) y
   regístrala en `services/class-registry.service.ts`.
2. Crea `classes/hooks/<clase>.hooks.ts` con `export const <clase>AbilityHooks: ClassAbilityHooks = {
  castUtility(ability, ctx) {...}, spell: {...} }`. Los flujos de utilidad (botones con efecto
  inmediato: buffs, summons, poisons) van en `castUtility`; el casting de daño/heal en `spell`.
3. Regístrala en `classes/hooks/registry.ts` **en el orden canónico de las clases**.
4. Cuando definas abilities en `<clase>.ts`, **no** escribas lógica por clase ahí: usa flags/
   campos de datos (`instant`, `spendsCombo`, `buff.applySelf`, `dotRanges`, `school`, `type`,
   `category`…). La lógica condicional va en el hook.
5. Ejecuta `npx ng build --configuration development` y `npx ng test --watch=false`.

## 8. Cómo añadir una habilidad o talento

- Si la ability necesita un comportamiento de casting propio: añade la rama en el hook de su clase
  dentro del punto del pipeline adecuado (ver tabla §3). Comprueba si hay un hook que ya cubre esa
  etapa; si NO existe un punto de inyección correcto, añádelo **al contrato** (`SpellHooks`),
  **al mapa** de `spell-hooks.ts`, **al driver** donde toque y **llámalo con `runSpellHooks`** en el
  mismo orden que quieras que corra.
- Si la ability es una utilidad (botón): cúbrela en `castUtility` devolviendo `true` tras
  gestionarla.
- Tras cada cambio: build + tests. Si cambias números de paridad de roll/crit, actualiza o amplía
  `spell-crit-parity.spec.ts`.

## 9. Qué está INLINE por diseño (no migrado)

No intentes "completar" estas ramas sin revisar primero: son genéricas (data-driven) o flujos
autónomos pendientes de una etapa S10:

- **castSpell:** gastos genéricos por recurso, instants/stealth/shards/combo gates, `focusGain`,
  efectos genéricos (`damage_boost`, `nature_boost`, `inner_focus`, `arcane_power`), evangelism
  (gestión de efecto por `ability.category`, sin identidad de clase), multiHit/chain genéricos,
  wound poison genérico, refund de deathliness (dentro del gasto de energía).
- **castUtility (S10 pendiente):** valk_angel_jump, valk_divine_protection, valk_take_flight,
  valk_luminous_cone, valk_last_will, hunters_mark, frost_trap, stealth, nature_guardian,
  inner_fire, slice_and_dice, shout, bloodrage, power_word_shield/dark_mending, healthstone,
  mana gem (genérico), pet summon/unsummon.

Si migras alguna, respeta §6 y elimina la rama inline equivalente.

## 10. Verificación

```bash
npx ng build --configuration development   # build de desarrollo
npx ng test --watch=false                   # 29 tests (spec de paridad de hooks + resto)
```

- Los 29 tests incluyen la spec `spell-crit-parity` (paridad del pipeline S1/S5/S6) y los specs de
  la sim de combate. Un fallo RNG intermitente (~1/20) en la spec de la sim `player.component` es
  **preexistente** y no debe maquillarse; re-ejecuta la suite para descartarlo.
- Antes de abrir PR o entregar: build + suite verde, y revisión de que no hayas introducido ramas
  duplicadas (inline + hook) ni hooks sin guard de clase.
