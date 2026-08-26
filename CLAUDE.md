# CLAUDE.md

Contexto para Claude Code al trabajar en este repositorio.

## Qué es este proyecto

**wow_rpg_angular** es una aplicación Angular (standalone components, sin NgModules) que implementa
un juego de rol por turnos inspirado en World of Warcraft: personajes, clases, talentos, habilidades,
combate y un "master" (DM) que controla encuentros con NPCs. El estado de partida se persiste y
sincroniza vía Firebase Realtime Database. La UI está en español, con soporte de traducción a inglés.

## Stack

- Angular (standalone components + signals, sin NgModules)
- TypeScript
- Firebase (Realtime Database) para persistencia/sincronización de partidas
- npm como package manager (`angular.json` -> `cli.packageManager: npm`)

## Comandos habituales

- `ng serve` / `npm start` — servidor de desarrollo
- `ng build` — build de producción
- `ng test` — tests unitarios (builder `@angular/build:unit-test`)

## Estructura del proyecto

```
src/
├── index.html          # HTML de entrada
├── main.ts             # bootstrap de la app standalone
├── styles.css           # estilos globales
└── app/
    ├── app.routes.ts    # rutas: '' -> player, 'player', 'master', 'combat'
    ├── classes/         # definición de cada clase jugable
    ├── components/      # las 3 pantallas de la app
    ├── data/            # datos estáticos del juego
    ├── models/          # tipos/interfaces del dominio
    └── services/        # lógica de negocio (signals)

public/
└── img/                 # assets: iconos de clases, talentos, habilidades, enemigos
```

### `src/app/classes/`

Un archivo por clase jugable de WoW (`hunter.ts`, `mage.ts`, `warrior.ts`, `priest.ts`, `rogue.ts`,
`druid.ts`, `shaman.ts`, `bard.ts`, `warlock.ts`). Cada uno exporta un objeto `CharacterClass` con:

- fórmulas de stats derivados (HP, maná, spell power, attack power, regen de maná)
- stats base y su crecimiento por nivel
- tipo de recurso (rage / mana / energy / focus)
- listas de **talentos** y **capstones** (habilidad final del árbol), con icono, descripción y rangos

Es, en esencia, el balanceo/contenido del juego. Registrado centralmente en
`services/class-registry.service.ts`.

### `src/app/components/`

Las tres pantallas de la app (rutas en `app.routes.ts`):

- **`player/`** — hoja de personaje del jugador: stats, acciones, talentos.
- **`master/`** — vista del master/DM: gestión de NPCs, encuentros, control de partida.
- **`combat/`** — lógica y vista del combate por turnos.

### `src/app/data/`

- **`game-data.ts`** — constantes del juego: claves/labels/iconos de stats, sistema de "notas"
  musicales del bardo, tabla de XP por nivel, personaje por defecto, slots de equipo, etc.
- **`npc-registry.ts`** — catálogo de NPCs/enemigos (HP, armadura, ataques, imagen) usado por el
  master y el combate.

### `src/app/models/`

- **`game.models.ts`** — interfaces y tipos TypeScript del dominio (`Stats`, `Character`,
  `CharacterClass`, `Ability`, `Buff`, `InflictedEffect`, `Npc`, etc.). Es el contrato de datos
  compartido entre clases, servicios y componentes.

### `src/app/services/`

- **`character.service.ts`** (el más grande) — estado central del personaje: signals de HP/maná/
  turnos, cálculo de daño, uso de habilidades, gestión de acciones por turno.
- **`class-registry.service.ts`** — registro que mapea clave -> objeto de clase de `classes/`.
- **`firebase.service.ts`** — wrapper de Firebase Realtime Database (push/set/remove/onValue) para
  guardar y sincronizar partidas.
- **`translation.service.ts`** — diccionario es/en y signal de idioma activo.

## Flujo general

`classes/` + `data/npc-registry.ts` definen el contenido del juego → `models/` lo tipa →
`services/` (sobre todo `character.service.ts`) contiene la lógica y el estado reactivo →
`components/` renderiza las tres pantallas (jugador, master, combate) → `firebase.service.ts`
persiste/sincroniza la partida.

## Convenciones a respetar

- Añadir una clase nueva: crear `classes/<clase>.ts` exportando un `CharacterClass` y registrarla
  en `class-registry.service.ts`.
- Los textos de UI van en español; si se añade texto nuevo visible, considerar añadir su entrada
  correspondiente en `translation.service.ts` (es/en).
- Los iconos de talentos/habilidades referencian imágenes bajo `public/img/`.
