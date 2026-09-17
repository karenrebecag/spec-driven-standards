# 2. Configuración global

## El panel de Configuración Global

> Estado en el manual original: **Borrador** · Tipo: Referencia

> **En una línea:** el panel lateral izquierdo donde se definen los parámetros que aplican a todo el Flujo Cortex, sin importar por qué nodo pase la conversación.
> 

## Para qué sirve

Todo lo que se configura en este panel se hereda en cada Nodo Cortex del flujo. Sirve para dos cosas: garantizar que el comportamiento sea consistente entre nodos, y evitar repetir la misma configuración en cada uno.

El caso más claro es el tono. Si se define en Configuración Global, todos los nodos lo aplican y un cambio se hace en un solo lugar. Si se repite en el prompt de cada nodo, cada cambio hay que replicarlo.

## Dónde se configura

**Canvas → botón de Configuración Global** (panel lateral izquierdo).

El panel se despliega y se colapsa con un botón, y mantiene su estado de forma persistente.

## Secciones del panel

Cada sección es un bloque colapsable independiente, con un header clickeable que muestra ícono, título y chevron.

| Sección | Qué se define | Artículo |
| --- | --- | --- |
| **Instrucciones generales** | Tono, idioma, estilo y reglas que aplican a todos los nodos | — |
| **Etapas** | Etapas del funnel y la condición que determina el ingreso a cada una | 2.2 |
| **Campos** | Datos que el flujo captura de forma transversal, y creación de campos nuevos | 4.3 |
| **Tipificaciones** | Hitos de conversión que queremos que queden guardados | 2.3 |
| **Etiquetas** | Características del cliente o de la conversación, acumulables | 2.3 |
| **Anti-spam** | Detección de conversaciones sin valor y su salida dedicada | 2.5 |
| **Zona Horaria** | Contexto temporal de todo el flujo | — |

## Instrucciones generales

Campo de texto libre con guardado automático. Se inyecta en el prompt de todos los nodos del flujo.

Lo que corresponde poner acá:

- Tono y estilo de comunicación.
- Idioma con el que se atiende al cliente.
- Contexto del negocio: qué hace la empresa, a qué público atiende.
- Reglas que aplican siempre, independientemente del nodo.

Lo que no corresponde: instrucciones específicas de un momento de la conversación. Eso va en el prompt del nodo que corresponda.

## Comportamiento del panel

**Expansión y colapso**

- Click en el header expande o colapsa la sección.
- Pueden estar varias secciones abiertas a la vez.
- El estado de cada sección se persiste por usuario y por flujo: al volver a abrirlo, queda como se dejó.

**Estado por defecto**

- La primera vez que un usuario abre un flujo, solo "Instrucciones Generales" aparece expandida.
- Si una sección tiene errores de validación, se fuerza su expansión la primera vez que aparece el error.

**Accesibilidad**

- Cada header es navegable con Tab y se expande o colapsa con Enter o Espacio.

## Fuera de alcance

- Reordenar las secciones. El orden es fijo.
- Búsqueda dentro del panel para saltar a una configuración específica.

## Relacionado

- 2.2 Etapas del funnel
- 2.3 Tipificaciones y etiquetas
- 2.4 Reconocimiento de cliente y memoria
- 2.5 Módulo anti-spam
- 4.3 Campos de guardado

---

*Fuente: FRD base HU-15 · FRD Parte 4 HU-04 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Etapas del funnel

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** clasificación automática de cada conversación según hasta dónde llegó el cliente en el embudo comercial, con autocompletado de las etapas anteriores.
> 

## Para qué sirve

Las etapas responden una pregunta de negocio: hasta dónde avanzó el cliente. Se usan para medir conversión, detectar en qué punto se caen las conversaciones y enrutar en Flowbuilder según el resultado.

La clasificación es automática. El builder define una condición en lenguaje natural por etapa, y el sistema evalúa la conversación contra esas condiciones en cada turno.

## Dónde se configura

**Canvas → Configuración Global → sección Etapas.**

## El catálogo de etapas

Cortex parte de un catálogo estándar con orden jerárquico:

**Awareness → Lead → MQL → SQL → Opportunity**

Ese orden determina el comportamiento del autocompletado, así que no es solo visual.

Por cada etapa se configuran tres cosas:

| Campo | Editable | Descripción |
| --- | --- | --- |
| Nombre en Atom | No | Nombre estándar de la etapa. Es el que permite comparar entre flujos y empresas. |
| Nombre de la etapa | Sí | Nombre propio del caso de uso. Es el que se ve en reportes, UI y trazabilidad. |
| Condición para guardar | Sí | Expresión en lenguaje natural que define cuándo la conversación cumple esa etapa. |

Una etapa sin condición definida queda inactiva y no se evalúa en runtime.

> ⚠️
> **Pendiente de definición.** El catálogo admite agregar y eliminar etapas, pero todavía no está definido dónde se ubica jerárquicamente una etapa nueva, si el autocompletado hacia atrás la incluye, ni qué nombre estándar recibe. Esta sección se completa cuando se cierre con el líder técnico.

## Autocompletado hacia atrás

Cuando la conversación se clasifica en una etapa, el sistema marca automáticamente como alcanzadas todas las etapas anteriores que no lo estuvieran.

El motivo es que un cliente puede llegar directo a una etapa avanzada sin pasar explícitamente por las previas. Si un lead cumple la condición de SQL en su primer mensaje, el funnel debe reflejar que también pasó por Lead y MQL. Sin esto, el reporte de conversión queda con huecos.

Las etapas autocompletadas reciben el mismo timestamp que la etapa que las disparó y quedan marcadas con un indicador que las distingue de las clasificadas explícitamente.

## Etapa máxima alcanzada

Cada conversación expone un valor derivado con la etapa más alta que logró durante todo el recorrido.

Este valor nunca retrocede. Si el cliente vuelve a una etapa anterior, la máxima queda registrada igual.

> 💡
> Los reportes de funnel deben usar la etapa máxima alcanzada y no la etapa al cierre. De lo contrario, un cliente que llegó a SQL y después se enfrió aparece contado en una etapa inferior, y la conversión medida queda por debajo de la real.

## Qué se persiste

Además de la etapa actual y la máxima, se guarda el historial completo de etapas alcanzadas. 

## Qué recibe Flowbuilder

El Nodo Cortex expone tres variables al flow:

| Variable | Contenido | Uso típico |
| --- | --- | --- |
| Etapa actual | La etapa en la que quedó la conversación al cerrarse | Enrutamiento inmediato |
| Etapa máxima alcanzada | La más alta del recorrido completo | Reportes de conversión |
| Etapas alcanzadas | Lista completa con el detalle de cada una | Condicionales del tipo "si pasó por MQL, activar campaña X" |

Las tres se persisten también en datos.

## Ejemplo

Una universidad configura el catálogo con nombres propios:

| Nombre en Atom | Nombre propio | Condición |
| --- | --- | --- |
| Awareness | Interesado | El cliente pregunta información general sobre la universidad o sus programas |
| Lead | Postulante | El cliente manifestó interés en un programa específico y compartió sus datos de contacto |
| MQL | Documentado | El cliente confirmó que tiene título de grado y está evaluando fechas de inscripción |
| SQL | Listo para inscribir | El cliente tiene título, presupuesto aprobado y quiere inscribirse el próximo semestre |

Un aspirante escribe: *"Hola, quiero inscribirme a la Maestría en Data Science para el próximo semestre, ya tengo mi título de grado y el presupuesto aprobado por mi empresa."*

El sistema clasifica la conversación como SQL y autocompleta MQL, Lead y Awareness con el mismo timestamp. En el reporte semanal, ese aspirante cuenta en las cuatro etapas y no solo en SQL.

## Casos borde

- **Cambio de nombre propio.** Las conversaciones históricas conservan el nombre vigente al momento del cierre.
- **Cambio de condición.** Las conversaciones históricas no se reclasifican.
- **Retroceso del cliente.** Se registra una entrada nueva con el timestamp del movimiento. La etapa máxima no cambia.

## Cómo escribir buenas condiciones

Cada etapa necesita un criterio que no se solape con el de las demás. Si dos condiciones son ambiguas entre sí, la clasificación resulta inconsistente y la reportería pierde valor.

Conviene que la condición describa un hecho observable en la conversación —"compartió sus datos de contacto", "confirmó fecha y hora"— y no un estado interno del cliente que el LLM tenga que inferir.

## Relacionado

- 2.1 El panel de Configuración Global
- 2.3 Tipificaciones y etiquetas
- 9.1 El Nodo Cortex en Flowbuilder
- 10.1 Diseñar el flujo antes de construirlo

---

*Fuente: FRD Parte 5 HU-01 · FRD Parte 4 HU-10 · FRD base HU-15 · Buenas prácticas §6 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Tipificaciones y etiquetas

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** dos formas de clasificar automáticamente una conversación con condiciones en lenguaje natural. Las tipificaciones registran cómo avanza la autogestión; las etiquetas registran características del cliente.
> 

## Para qué sirven

Ambas funcionan igual por dentro: el builder escribe una condición en lenguaje natural, y un LLM-as-judge evalúa la conversación contra esa condición durante el runtime. Si se cumple, la clasificación se aplica y queda registrada.

Ninguna de las dos cambia el comportamiento del nodo ni genera salidas en Flowbuilder. Sirven para reportería y segmentación.

## En qué se diferencian

|  | Tipificación | Etiqueta |
| --- | --- | --- |
| Qué registra | El estado de avance de la autogestión | Una característica del cliente o de la conversación |
| Ejemplo | "Cliente agenda test drive" | "Cliente VIP" |
| Cuándo se evalúa | En cada salida de fin | En cada salida de fin |
| Acumulación | Todas las que se disparen quedan registradas, pero se muestra la última | Acumulativas |
| Reversibilidad | Cada disparo se registra por separado | Una vez aplicada, permanece aunque la condición deje de cumplirse |
| ¿Termina la conversación? | No | No |
| ¿Genera salida en Flowbuilder? | No | No |

> ⚠️
> Las tipificaciones solo existen del tipo **seguimiento de autogestión**. El tipo "fin de autogestión" que aparece en el FRD Parte 4 quedó sin efecto: las salidas del flujo las definen los Nodos Fin.

## Dónde se configuran

**Canvas → Configuración Global → sección Tipificaciones** o **sección Etiquetas**.

Las dos secciones están una debajo de la otra y funcionan igual: listado de lo configurado, botón para crear, y acciones por fila.

## Cómo se crea una tipificación

1. Abrir **Configuración Global → Tipificaciones**.
2. Click en **+ Nueva tipificación**.
3. Completar el formulario.
4. Guardar.

### Campos

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Nombre | Sí | Único dentro del flujo, mínimo 3 caracteres. No puede coincidir con el de una etiqueta. |
| Condición | Sí | Expresión en lenguaje natural que define cuándo se aplica. Admite `/` para insertar campos de guardado. |

La creación de una etiqueta usa los mismos dos campos. La diferencia es que la etiqueta no tiene tipo: toda etiqueta es descriptiva.

## Cómo escribir buenas condiciones

Una condición útil responde una pregunta concreta del negocio y no se solapa con otras.

| Conviene | Conviene evitar |
| --- | --- |
| "El cliente confirmó fecha y hora para el test drive" | "Cliente interesado" — ¿en qué? |
| "El cliente solicitó una cotización de un modelo específico" | "El cliente quiere algo" |
| "El cliente mencionó tener un equipo de más de 50 personas" | Más de 15 tipificaciones por flujo: el LLM pierde precisión al evaluarlas |

## Qué pasa en runtime

En cada evaluación, el sistema ejecuta un LLM-as-judge liviano que recibe el thread y las condiciones activas, y devuelve qué se cumple.

- El nodo tiene acceso a las tipificaciones ya aplicadas durante la conversación en curso. Eso le permite no repetir clasificaciones y ajustar el tono si ya hay señales de frustración o de interés alto.
- Si la misma tipificación se cumple más de una vez, cada disparo se registra por separado.
- El registro es asíncrono: no bloquea la respuesta al cliente. Si la persistencia falla, se registra el error y la conversación continúa.

Por cada tipificación disparada se persiste el nombre, la condición tal como estaba configurada en ese momento, el timestamp, el contexto que evaluó el judge y su score de confianza.

## Validaciones

- Nombre único dentro del flujo, sin colisión entre tipificaciones y etiquetas.
- Si dos condiciones superan el 80% de similitud semántica, aparece un aviso en rojo con alternativas sugeridas. Conviene atenderlo: la ambigüedad hace que el judge clasifique de forma inconsistente.
- Si una condición referencia un campo que no existe, aparece un warning amarillo no bloqueante.

## Gestión

Cada elemento del listado muestra nombre y preview de la condición. Las acciones por fila son editar, duplicar y archivar.

Las tipificaciones archivadas siguen visibles en reportes históricos, pero no se evalúan en conversaciones nuevas.

**Permisos:** crear, editar y archivar corresponde a editores del flujo. Ver, a cualquier usuario con acceso.

## Fuera de alcance

- Detección automática de tipificaciones nuevas a partir de patrones en conversaciones reales.
- Acciones automáticas asociadas a una clasificación, como derivar a un equipo cuando se aplica "Posible churn".
- Sincronización de etiquetas con el sistema de tags global de Atom.

## Relacionado

- 2.1 El panel de Configuración Global
- 2.2 Etapas del funnel
- 3.3 Nodos Fin y ramas de finalización
- 9.2 Mapa completo de salidas

---

*Fuente: FRD Parte 4 HU-01 y HU-03 · FRD Parte 5 HU-02 · Buenas prácticas §7 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Reconocimiento de cliente y memoria

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** cuando un cliente vuelve a escribir, el Nodo Cortex retoma desde donde quedó la conversación anterior en lugar de empezar de cero.
> 

## Dos cosas distintas

Conviene separar dos comportamientos que suelen confundirse.

|  | Memoria | Reconocimiento de cliente |
| --- | --- | --- |
| Qué hace | Cortex persiste en la conversacion con una memoria que le permite no perder contexto | Usa el historial de conversación del cliente para retomar desde donde quedó |
| Se puede desactivar | No | No |
| Alcance | Asociada a la sesión del cliente | Solo el primer turno de una sesión nueva |
| Activación | Activado por defecto | Activado por defecto |

La memoria siempre está activa. El reconocimiento es lo que decide como comenzar la conversación.

## Qué contexto recibe el nodo

Con el switch activado, en el **primer turno de una sesión nueva** —y solo en ese— el nodo recibe:

- **La conversación previa completa** del cliente, incluyendo mensajes con otros Nodos Cortex, con flujos de Flowbuilder y con asesores humanos en la bandeja.
- **Un resumen ejecutivo** generado por un LLM liviano, enfocado en el último punto donde quedó la conversación y la última intención detectada.
- **Las tipificaciones** aplicadas en la sesión anterior.
- **Los campos de guardado** ya capturados.
- **La etapa del pipeline** alcanzada.
- **El perfil del cliente**, que se va enriqueciendo con cada resumen y persiste entre sesiones.

En los turnos siguientes el nodo no vuelve a recibir este bloque.

## Cómo se comporta el nodo

El sistema provee el contexto y la instrucción de retomar. El tono y el formato exacto los dicta el prompt del nodo.

El primer mensaje debería:

1. Saludar al cliente por su nombre, si está disponible.
2. Referenciar el contexto previo de forma natural.
3. Preguntar si quiere continuar desde donde quedó o si tiene una consulta nueva.

**Ejemplo:** *"¡Hola, Pablo! La última vez que conversamos estábamos completando tus datos para una solicitud de crédito. ¿Querés continuar desde ahí o tenés otra consulta?"*

### Según lo que responda el cliente

- **Quiere continuar:** el nodo retoma usando los campos y la etapa ya capturados, sin volver a preguntar lo que ya sabe.
- **Tiene otra consulta:** el nodo abandona el contexto previo y atiende lo nuevo. El historial queda disponible por si lo necesita más adelante.

## Rendimiento

El resumen del historial se genera de forma asíncrona al cerrar cada gestión, no al iniciar la siguiente.

Si por algún motivo el resumen no está listo cuando llega el primer turno, el nodo arranca con un saludo genérico y el evento queda registrado.

## Trazabilidad

En los logs queda registrado si el reconocimiento se activó en esa sesión y qué resumen recibió el nodo. Eso permite entender por qué el nodo respondió de determinada manera cuando la causa está en el contexto previo y no en el mensaje actual.

## Fuera de alcance

- Reconocimiento entre canales sin identificación. Si el cliente escribe desde un canal nuevo y no se puede vincular, no se reconoce.
- Selección manual de qué partes del historial inyectar. Se inyecta el resumen completo y el nodo decide qué usar.
- Detección de suplantación de identidad.

> ⚠️
> El contexto que recibe el nodo cuando arranca **después de una plantilla o un webhook** —típico de campañas salientes— se configura aparte y se documenta en 9.4.

## Relacionado

- 2.1 El panel de Configuración Global
- 2.2 Etapas del funnel
- 4.3 Campos de guardado
- 9.4 Cortex en campañas salientes y contexto de origen

---

*Fuente: FRD Parte 4 HU-02 · FRD Parte 2 HU-3 · FRD Outbound HU-03 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Módulo de Seguridad

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** detección automática de conversaciones sin valor, definida en lenguaje natural, que las cierra por una salida dedicada antes de generar mensajes cobrables.
> 

## Para qué sirve

Bajo el modelo de cobro por mensaje de WhatsApp, cada respuesta del nodo tiene costo. Una conversación que nunca va a convertir —un número automatizado, un competidor probando, alguien ofreciendo productos no relacionados— genera gasto sin retorno.

El módulo evalúa cada mensaje entrante contra las instrucciones de detección que define el builder. Si detecta spam, el nodo no responde y la conversación sale por una rama específica en Flowbuilder.

Casos que este módulo cubre:

- Números que envían mensajes automatizados o hacen scraping.
- Consultas totalmente fuera del alcance del negocio.
- Insultos, mensajes sin sentido, contenido ofensivo.
- Contenido comercial de terceros.

Al ser parte de Configuración Global, aplica a todos los nodos del flujo sin configurarlo en cada uno.

## Dónde se configura

**Canvas → Configuración Global → sección Anti-spam.**

La sección aparece colapsada y desactivada por defecto.

## Cómo se configura

1. Expandir la sección **Reglas de seguridad**.
2. Activar el toggle **Reglas de seguridad.**
3. Escribir las **instrucciones de detección**.
4. Elegir el **momento de evaluación**.

### Campos

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Activar detección de spam | — | Toggle. Desactivado por defecto. |
| Instrucciones de detección | Sí, si está activo | Descripción en lenguaje natural de qué se considera spam en el contexto del negocio. Admite `/` para campos capturados y `{{VARIABLE}}` para variables de entorno. |
| Momento de evaluación | Sí | **Cada turno del cliente:** evalúa desde el primer mensaje, solo para casos evidentes como cadenas o promociones. **Después del turno N:** espera dos turnos antes de evaluar, para dar lugar a que el cliente se contextualice. |

## Qué pasa en runtime

En cada turno donde corresponda evaluar, un LLM-as-judge liviano compara el mensaje contra las instrucciones. Si el resultado supera el umbral:

1. La conversación se marca con el campo de spam en verdadero.
2. Se guarda el motivo detectado, con el razonamiento del judge.
3. La conversación sale por la rama Error de contexto en Flowbuilder con una etiqueta de “spam” para cerrar la conversación.
4. **El nodo no responde el mensaje que gatilló la detección.** La conversación termina sin generar más mensajes cobrables.

> 💡
> La detección corre antes que la evaluación de tipificaciones y etapas. Si una conversación se clasifica como spam, esas evaluaciones no se ejecutan en ese turno. Tampoco se ejecuta el prompt principal del nodo.

## La salida en Flowbuilder

Al activar el módulo, el sistema crea automáticamente una rama de salida llamada **Error de contexto** en el Nodo Cortex dentro de Flowbuilder.

Desde ahí se conecta la acción que corresponda: agregar el número a una blacklist, notificar al equipo, o cerrar la conversación en silencio.

Si el módulo se desactiva, el sistema avisa que la rama dejará de dispararse. La rama no se elimina automáticamente, para no romper el flow.

## Fuera de alcance

- Blacklist automática de números. La clasificación no agrega el número a ninguna lista; eso se configura desde Flowbuilder en la rama de salida.
- Detección por IP, dispositivo u otras señales técnicas. Solo se evalúa el contenido de los mensajes.
- Ajuste automático de las instrucciones a partir de los falsos positivos registrados.
- Configuración por nodo individual. El módulo es a nivel flujo.

## Relacionado

- 2.1 El panel de Configuración Global
- 9.2 Mapa completo de salidas
- 10.4 Evitar loops y spam
- 10.5 Optimización de costos en WhatsApp

---

*Fuente: FRD Parte 6 HU-19 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

