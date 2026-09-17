# 8. Publicar y operar

## Borrador vs publicado

> Estado en el manual original: **Borrador** · Tipo: Concepto

> **En una línea:** todo Flujo Cortex tiene dos versiones activas. La borrador es la que se edita y se prueba; la publicada es la que corre en producción.
> 

## Por qué existen las dos

Sin esta separación, cualquier cambio en el canvas llegaría de inmediato a los clientes reales. Con ella se puede iterar todo lo necesario sin tocar lo que está funcionando.

|  | Borrador | Publicada |
| --- | --- | --- |
| Qué contiene | La última versión guardada, con todos los cambios pendientes | La última versión publicada explícitamente |
| Quién la usa | El simulador y las evaluaciones | Flowbuilder, en producción |
| Cómo se actualiza | Guardado automático, con un segundo de retardo | Solo al presionar Publicar |

## El indicador de estado

En la barra superior del canvas hay un badge con el estado actual del flujo.

| Badge | Color | Significado |
| --- | --- | --- |
| Borrador con cambios sin publicar | Amarillo | Hay cambios que no están en producción |
| Sincronizado | Verde | Borrador y publicada son idénticas |
| Sin publicar | Gris | El flujo nunca se publicó, solo existe el borrador |

Al pasar el cursor, el badge muestra la fecha y hora de la última publicación.

## Simular sin publicar

Al presionar el botón de simulación, si hay cambios sin guardar el sistema los guarda automáticamente antes de compilar. No hace falta guardar a mano.

El simulador compila y ejecuta sobre la versión borrador. **No se requiere publicar para probar los cambios.**

> 💡
> La primera vez que se simula con cambios pendientes aparece un aviso aclaratorio: *"Estás simulando la versión borrador. Para que estos cambios lleguen a Flowbuilder, recordá Publicar."*

### Si el flujo tiene errores

Las validaciones siguen aplicando. Si el borrador tiene errores, no se permite simular y se muestran los errores.

El guardado ocurre **antes** de la validación de compilación, así que los cambios no se pierden aunque la simulación no pueda iniciarse.

## Publicar

El botón Publicar promueve la versión borrador a versión publicada. El badge pasa a Sincronizado.

Recién a partir de ese momento los cambios llegan a Flowbuilder y, por lo tanto, a los clientes.

Antes de publicar, el sistema corre las validaciones de publicación: nombre propio, componentes dentro de los límites del canal, Flows configurados y referencias de integraciones válidas. Ver 7.2.

> ⚠️
> Si el flujo está en uso por uno o más flows de Flowbuilder, aparece un modal de advertencia antes de publicar, con el detalle de qué automatizaciones se van a ver afectadas. Ver 8.3.

## Trazabilidad

Cada simulación queda asociada a la versión específica del borrador con la que se ejecutó, con una copia de la configuración y su timestamp.

Eso permite responder una pregunta que de otro modo es imposible: *qué versión del flujo generó esta respuesta en el simulador la semana pasada*.

## Al cargar un JSON

Si se carga un JSON sobre un flujo publicado, la configuración importada queda como **borrador**. No se publica automáticamente, y el badge refleja que hay cambios sin publicar. Ver 8.2.

## Fuera de alcance

- Comparación visual entre la versión borrador y la publicada.
- Varios borradores paralelos del mismo flujo.
- Publicación automática al simular. Queda excluida por el riesgo sobre producción.

## Relacionado

- 7.1 El simulador
- 7.2 Validaciones antes de publicar
- 8.2 Exportar e importar JSON
- 8.3 Publicar un flujo en uso

---

*Fuente: FRD Parte 4 HU-09 · FRD Parte 6 HU-04 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Exportar e importar la configuración de un flujo (JSON)

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

## Para qué sirve

Cuatro usos habituales:

- **Reutilizar configuraciones** entre flujos, sin rehacer todo desde cero.
- **Compartir con el equipo** una configuración para revisarla o replicarla.
- **Hacer respaldos manuales** antes de un cambio grande.
- **Versionar fuera de la plataforma** cuando el proceso interno lo requiere.

## Dónde está

**Canvas → barra superior de acciones**, junto a Publicar y Probar en chat. Si el espacio es limitado, las acciones viven en el menú de más opciones.

| Acción | Qué hace |
| --- | --- |
| Descargar JSON | Genera el archivo con la configuración completa |
| Cargar JSON | Abre el selector de archivo y las opciones de importación |
| Copiar JSON | Copia la configuración al portapapeles |

## Qué incluye el archivo

| Se exporta | No se exporta |
| --- | --- |
| Prompt y configuración de cada Nodo Cortex | Credenciales de OAuth y claves de API |
| Flujo completo: nodos, ramas y posiciones en el canvas | Datos privados de clientes |
| Herramientas adjuntas, con su metadata | Contenido binario de los archivos de la base de conocimiento |
| Referencias a documentos y tablas dinámicas |  |
| Campos de guardado configurados |  |
| Configuración global: tono, etapas, tipificaciones, etiquetas y switches |  |
| Modelo configurado y sus parámetros |  |
| Versión del esquema del JSON |  |

El archivo se descarga con el nombre del flujo y la fecha.

Al descargar aparece un aviso recordando que las credenciales de las herramientas no se exportan y hay que reconectarlas al cargar el JSON en otro flujo.

## Cargar un JSON

Al elegir el archivo, un modal ofrece dos opciones:

| Opción | Qué hace |
| --- | --- |
| Reemplazar flujo actual | Sobrescribe la configuración del flujo abierto, con confirmación explícita |
| Crear flujo nuevo | Crea un flujo nuevo en el mismo workspace con la configuración importada |

### Qué se valida antes de aplicar

1. **Compatibilidad del esquema.** Que la versión del JSON sea reconocida.
2. **Integridad de referencias.** Que nodos, ramas, herramientas y campos sean coherentes entre sí.
3. **Herramientas que requieren reconexión.** Se listan antes de continuar.
4. **Archivos de la base de conocimiento faltantes** en el workspace destino. Se listan, con la opción de cargarlos después.

Si la validación falla, aparece un modal con el detalle de los errores.

### El modal de confirmación

Antes de aplicar la carga se muestra un resumen del flujo a importar —nombre, cantidad de nodos, herramientas, campos y tipificaciones— junto con los avisos que correspondan.

| Botón | Qué hace |
| --- | --- |
| Cancelar | Cierra sin importar nada |
| Cargar igual | Importa dejando los pendientes sin resolver |
| Cargar y configurar pendientes | Importa y abre un recorrido que resuelve los avisos uno por uno |

## Qué pasa después de cargar

### Si se reemplazó el flujo actual

Se pide confirmación explícita: *"Esto reemplazará toda la configuración del agente actual. ¿Continuar?"*

Si el flujo estaba publicado, **la configuración importada no se publica automáticamente**: queda como borrador y hay que publicarla a mano. Ver 8.1.

### Si se creó un flujo nuevo

Se pide el nombre del flujo nuevo. Se crea en estado borrador.

Las herramientas que requerían autenticación quedan marcadas como pendientes de autenticar, y los archivos de la base de conocimiento faltantes quedan referenciados pero vacíos hasta que se carguen.

## Versión del esquema

El JSON incluye un campo con la versión de Cortex que lo generó.

- Las versiones anteriores se cargan con migración automática cuando es posible.
- Si la versión del JSON es más nueva que la de la plataforma, aparece un error con la sugerencia de actualizar.

## Permisos

| Acción | Quién puede |
| --- | --- |
| Descargar | Cualquier usuario con acceso de lectura al flujo |
| Cargar reemplazando | Editores del flujo con permisos de publicación |
| Cargar creando uno nuevo | Editores del workspace |

## Fuera de alcance

- Editar el JSON dentro de la plataforma. Siempre se descarga, se edita afuera y se vuelve a cargar.
- Importar JSON generado por herramientas de terceros.
- Sincronización bidireccional con repositorios externos.

> **En una línea:** descargar la configuración completa de un Flujo Cortex como archivo JSON, y cargar uno exportado para reutilizarlo en otro flujo o en otro workspace.
> 

## Para qué sirve

Cuatro usos habituales:

- **Reutilizar configuraciones** entre flujos, sin rehacer todo desde cero.
- **Compartir con el equipo** una configuración para revisarla o replicarla.
- **Hacer respaldos manuales** antes de un cambio grande.
- **Versionar fuera de la plataforma** cuando el proceso interno lo requiere.

## Dónde está

**Canvas → barra superior de acciones**, junto a Publicar y Probar en chat. Si el espacio es limitado, las acciones viven en el menú de más opciones.

| Acción | Qué hace |
| --- | --- |
| Descargar JSON | Genera el archivo con la configuración completa |
| Cargar JSON | Abre el selector de archivo y las opciones de importación |
| Copiar JSON | Copia la configuración al portapapeles |

## Qué incluye el archivo

| Se exporta | No se exporta |
| --- | --- |
| Prompt y configuración de cada Nodo Cortex | Credenciales de OAuth y claves de API |
| Flujo completo: nodos, ramas y posiciones en el canvas | Datos privados de clientes |
| Herramientas adjuntas, con su metadata | Contenido binario de los archivos de la base de conocimiento |
| Referencias a documentos y tablas dinámicas |  |
| Campos de guardado configurados |  |
| Configuración global: tono, etapas, tipificaciones, etiquetas y switches |  |
| Modelo configurado y sus parámetros |  |
| Versión del esquema del JSON |  |

El archivo se descarga con el nombre del flujo y la fecha.

Al descargar aparece un aviso recordando que las credenciales de las herramientas no se exportan y hay que reconectarlas al cargar el JSON en otro flujo.

## Cargar un JSON

Al elegir el archivo, un modal ofrece dos opciones:

| Opción | Qué hace |
| --- | --- |
| Reemplazar flujo actual | Sobrescribe la configuración del flujo abierto, con confirmación explícita |
| Crear flujo nuevo | Crea un flujo nuevo en el mismo workspace con la configuración importada |

### Qué se valida antes de aplicar

1. **Compatibilidad del esquema.** Que la versión del JSON sea reconocida.
2. **Integridad de referencias.** Que nodos, ramas, herramientas y campos sean coherentes entre sí.
3. **Herramientas que requieren reconexión.** Se listan antes de continuar.
4. **Archivos de la base de conocimiento faltantes** en el workspace destino. Se listan, con la opción de cargarlos después.

Si la validación falla, aparece un modal con el detalle de los errores.

### El modal de confirmación

Antes de aplicar la carga se muestra un resumen del flujo a importar —nombre, cantidad de nodos, herramientas, campos y tipificaciones— junto con los avisos que correspondan.

| Botón | Qué hace |
| --- | --- |
| Cancelar | Cierra sin importar nada |
| Cargar igual | Importa dejando los pendientes sin resolver |
| Cargar y configurar pendientes | Importa y abre un recorrido que resuelve los avisos uno por uno |

## Qué pasa después de cargar

### Si se reemplazó el flujo actual

Se pide confirmación explícita: *"Esto reemplazará toda la configuración del agente actual. ¿Continuar?"*

Si el flujo estaba publicado, **la configuración importada no se publica automáticamente**: queda como borrador y hay que publicarla a mano. Ver 8.1.

### Si se creó un flujo nuevo

Se pide el nombre del flujo nuevo. Se crea en estado borrador.

Las herramientas que requerían autenticación quedan marcadas como pendientes de autenticar, y los archivos de la base de conocimiento faltantes quedan referenciados pero vacíos hasta que se carguen.

## Versión del esquema

El JSON incluye un campo con la versión de Cortex que lo generó.

- Las versiones anteriores se cargan con migración automática cuando es posible.
- Si la versión del JSON es más nueva que la de la plataforma, aparece un error con la sugerencia de actualizar.

## Permisos

| Acción | Quién puede |
| --- | --- |
| Descargar | Cualquier usuario con acceso de lectura al flujo |
| Cargar reemplazando | Editores del flujo con permisos de publicación |
| Cargar creando uno nuevo | Editores del workspace |

## Fuera de alcance

- Editar el JSON dentro de la plataforma. Siempre se descarga, se edita afuera y se vuelve a cargar.
- Importar JSON generado por herramientas de terceros.
- Sincronización bidireccional con repositorios externos.

## Relacionado

- 8.1 Borrador vs publicado
- 5.4 Variables de entorno y conexiones de autenticación
- 7.2 Validaciones antes de publicar

---

*Fuente: FRD Parte 4 HU-06 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Publicar un flujo en uso

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** cuando se publica un flujo que ya está siendo usado por automatizaciones de Flowbuilder, el sistema advierte cuáles se van a ver afectadas antes de aplicar el cambio.
> 

## Para qué sirve

Un mismo Flujo Cortex puede estar invocado desde varios flows de Flowbuilder al mismo tiempo. Publicar un cambio —agregar una rama de finalización, modificar un prompt, quitar un campo— impacta en todas esas automatizaciones a la vez.

Sin esta advertencia, el efecto solo se descubre cuando algo deja de funcionar en producción.

## Cuándo aparece

Al presionar **Publicar** sobre un flujo que está en uso por uno o más flows de Flowbuilder, se abre un modal antes de ejecutar la publicación.

Si el flujo no está siendo usado por ningún flow, el modal no aparece y la publicación se ejecuta directamente.

## Qué muestra el modal

**Título:** Publicar

**Mensaje principal:** Los cambios que estás por publicar afectarán todas las automatizaciones que usan este agente actualmente.

**Mensaje secundario:** Revisa cada uso para validar compatibilidad antes de continuar.

### La lista de flows afectados

Cada ítem incluye:

- Ícono
- Nombre del flow de Flowbuilder
- Estado: activo o pausado
- Enlace que abre ese flow en una pestaña nueva

Si hay más de cinco, se muestran los primeros cinco con un botón para expandir el resto.

> 💡
> El listado se obtiene en tiempo real al abrir el modal, sin caché. Refleja el estado actual, no el de la última vez que se publicó.

### Acciones

| Botón | Qué hace |
| --- | --- |
| Cancelar | Cierra el modal sin publicar |
| Publicar | Continúa con la publicación |
| Cerrar (×) | Equivalente a Cancelar |

## Si la consulta falla

Si no se puede verificar dónde se está usando el flujo, aparece un mensaje genérico:

> No pudimos verificar dónde se está usando este agente. ¿Continuar con la publicación?
> 

Los botones de Cancelar y Publicar siguen disponibles. El fallo de la consulta no bloquea la publicación.

## Qué queda registrado

El evento de publicación se registra con el usuario, la fecha y la lista de flows afectados en ese momento.

En el registro de cambios del flujo, la versión publicada queda con un campo que indica a cuántos flows afectó, y que se puede abrir para ver el detalle.

## Qué revisar antes de confirmar

Los cambios que más suelen romper automatizaciones existentes:

| Cambio | Qué puede romper |
| --- | --- |
| Eliminar o renombrar una rama de finalización | La salida correspondiente en Flowbuilder deja de existir, y lo que estaba conectado ahí queda huérfano |
| Eliminar un campo de guardado | Los nodos siguientes del flow que usaban esa variable dejan de recibirla |
| Cambiar las etapas del funnel | Los condicionales del flow que evalúan etapas pueden dejar de cumplirse |
| Desactivar el módulo anti-spam | La rama de spam deja de dispararse, aunque siga existiendo en el flow |

> 💡
> Agregar cosas es seguro: una rama de finalización nueva suma una salida sin afectar las existentes. Quitar o renombrar es lo que rompe.

## Relacionado

- 8.1 Borrador vs publicado
- 9.1 El Nodo Cortex en Flowbuilder
- 9.2 Mapa completo de salidas
- 3.3 Nodos Fin y ramas de finalización

---

*Fuente: FRD Parte 3 HU-06 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

