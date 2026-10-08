# Firebase Realtime Database — Reglas recomendadas

Documento de cómo deberían estar configuradas las reglas del proyecto `rpgwow-118f7`
(URL pública en el bundle: `https://rpgwow-118f7-default-rtdb.europe-west1.firebasedatabase.app`).

## Situación actual y riesgo

Las reglas están en modo **abierto total**:

```json
{ "rules": { ".read": true, ".write": true } }
```

Esto significa que **cualquiera** con la URL de la base de datos (que es pública, está en el
JS del cliente) puede leer y modificar **todo** el árbol: personajes, jugadores, eventos y
próximamente los items. Es aceptable para una partida privada de amigos, pero no es lo que
debería quedar escrito en la consola. Hay que reducirlo al **set de paths que la app usa**.

## Por qué no se puede securizar por usuario (todavía)

La app **no usa Firebase Auth**: los clientes escriben como anónimos. Las reglas por usuario
(`auth != null`, `auth.uid == ...`) romperían la lectura en tiempo real que necesita el juego.
Hasta que se decida meter login (Auth con modo anónimo + reglas por uid), el nivel de
protección alcanzable es **por path**: autorizar solo los paths que el juego toca y denegar
el resto.

## Reglas recomendadas (listas para pegar)

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "items": {
      ".read": true,
      ".write": true
    },
    "characters": {
      ".read": true,
      ".write": true
    },
    "players": {
      ".read": true,
      ".write": true
    },
    "damageEvents": {
      ".read": true,
      ".write": true
    },
    "playerEvents": {
      ".read": true,
      ".write": true
    },
    "monsters": {
      ".read": true,
      ".write": true
    },
    "wallet": {
      ".read": true,
      ".write": true
    }
  }
}
```

> Mantén `monsters` con `".write": true` aunque hoy la app solo lo lea de Firebase: el master
> guarda el estado en localStorage y puede que pronto persista monstruos en esta rama. Cerrar
> el write aquí rompería ese futuro cambio sin dar ninguna ventaja.

Resumen de las reglas:

| Path             | Leer | Escribir | Operación de la app |
|------------------|:----:|:--------:|---------------------|
| `items`          | ✅   | ✅       | Generador de items (`push`); futuro equipo/transacciones (`items/<id>`) |
| `characters`     | ✅   | ✅       | Guardar/cargar fichas (`characters/<key>`), borrar |
| `players`        | ✅   | ✅       | `syncPlayerStatus` escribe `players/<nombre>`; el master limpia |
| `damageEvents`   | ✅   | ✅       | Jugadores envían daño/curas/buffs (`push`); el master marca `assigned` |
| `playerEvents`   | ✅   | ✅       | El master envía eventos; los jugadores los borran al consumirlos |
| `monsters`       | ✅   | ✅       | El master y combat leen enemigos |
| `wallet`         | ✅   | ✅       | Bolsa del grupo (`wallet/copper`, transacción al vender) |
| (resto)          | ❌   | ❌       | Denegado: `/.read`, `/.write` en falso |

Notas importantes:

- **`damageEvents` y `playerEvents` necesitan write en la raíz del path** porque los clientes
  hacen `push` (crear hijo) y también modifican/borran hijos concretos. En RTDB no se puede
  distinguir "el master marca assigned" de "el jugador borra su evento" sin auth, por eso el
  path entero queda con write.
- **`.info/connected`** (usado por los clientes para saber si están conectados) es metadatos de
  Realtime Database y **siempre es legible**, no hace falta regla.
- **`owner: null` en items se borra**: Realtime Database interpreta un `null` como "eliminar
  clave". Al generar un ítem con `owner: null`, la propiedad `owner` no existe en el nodo como
  tal. Eso es intencionado: *ausencia de `owner` = está en el stash*. La lógica lo trata con
  `val.owner` (falsy → stash) en lugar de `=== 'null'`.

## Cómo aplicarlas

1. Firebase Console → proyecto `rpgwow-118f7` → **Realtime Database** → pestaña **Reglas**.
2. Sustituye todo el contenido del editor por el JSON recomendado.
3. Pulsa **Publish**.
4. Verificación rápida desde tu máquina:
   ```
   curl "https://rpgwow-118f7-default-rtdb.europe-west1.firebasedatabase.app/items/.json"
   ```
   Debe devolver `null` o `{...}` con los items, y **nunca** `Permission denied`.

> Nota: este `curl` y el funcionamiento del juego solo deben comprobarse **fuera del sandbox**;
> en el entorno sin red a Firebase dará `HTTP 000` aunque las reglas estén bien.

## Endurecimiento opcional (avanzado)

Con Auth (modo anónimo) se podría cerrar por usuario, p. ej.:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "items": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$itemId": {
        ".read": true,
        ".write": "auth != null && (!data.exists() || data.child('owner').val() === null || data.child('owner').val() === auth.uid)"
      }
    }
  }
}
```

Esto limitaría el desequipe/equipe del item únicamente a su dueño. **Implica tocar la app**
(login anónimo en los clientes) y no se debe activar hasta que se decida hacer ese cambio.

## Historial de contexto

- 2026-10: la app pasó a un modelo de items en base de datos (`items/<pushId>`, owner única).
  `items` es un path nuevo que NO existía en sets de reglas previos por-path — por eso la
  generación daba "No se pudo guardar — revisa Firebase" hasta abrir este path.
- 2026-10: se añadió `wallet` (bolsa del grupo) con venta fija de items; también es un path
  nuevo que hay que añadir al set por-path publicado.
