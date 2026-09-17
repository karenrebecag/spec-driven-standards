# 10. Buenas prácticas

## Diseñar el flujo antes de construirlo

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** definir en papel el objetivo, el alcance y las salidas antes de tocar el canvas. Es el paso que más tiempo ahorra después.
> 

## Qué definir antes de empezar

Armar el flujo sin este trabajo previo lleva a flujos que crecen sin foco, con prompts ambiguos y transferencias innecesarias entre nodos.

| Definición | Pregunta que responde |
| --- | --- |
| **Objetivo** | Qué tiene que lograr el flujo: agendar una cita, cotizar, calificar un lead, responder consultas |
| **Alcance** | Qué SÍ hace y qué NO hace |
| **Escalamiento** | Cuándo hay que derivar a una persona |
| **Fuentes de información** | Qué necesita consultar: documentos, tablas, sistemas externos |
| **Campos a capturar** | Cuáles bloquean el avance y cuáles no |
| **Etapas del funnel** | Por dónde pasa una conversación y qué condición define cada punto |
| **Escenarios de salida** | De cuántas formas distintas puede terminar, y qué tiene que pasar después en cada una |

## Un nodo o varios

Un flujo multi-nodo tiene sentido cuando:

- Hay áreas claramente separadas: ventas, soporte, cobranzas.
- Cada área necesita documentos o herramientas distintas.
- Un solo prompt que cubriera todo superaría las 400 líneas.

**No** tiene sentido cuando:

- Se separa "por temas" pero un mismo nodo podría manejar todo.
- Las transferencias entre nodos son ambiguas o se solapan.
- Se genera ida y vuelta entre nodos hermanos sin que la conversación avance.

> 💡
> Regla práctica: mantener los flujos por debajo de cinco o seis nodos. Más que eso suele ser señal de que el alcance quedó mal definido, no de que el caso sea complejo.

## Guardar solo los campos necesarios

Cada campo capturado suma complejidad al flujo y, si es obligatorio, suma turnos a la conversación.

| Tipo | Criterio |
| --- | --- |
| Obligatorio | Solo lo que realmente bloquea el avance. Por ejemplo, el correo si sí o sí hay que enviarle algo. |
| Captura posterior | Todo lo demás. Se lee la conversación completa y se guarda si aparece, sin que el flujo tenga que preguntarlo. |

Menos campos obligatorios significa conversaciones más cortas, prompts más breves y mejor conversión.

## Elegir bien la fuente de información

Antes de cargar nada, decidir dónde vive cada cosa:

- **Documentos** para información que no cambia seguido: catálogos descriptivos, manuales, reglamentos.
- **Tablas dinámicas** para información que cambia: stock, precios, disponibilidad.

Ver 4.2 para el detalle de la decisión.

## Relacionado

- 1.3 Anatomía de un flujo Cortex
- 10.2 Escribir buenos prompts
- 10.3 Diseñar condiciones de salida
- 4.3 Campos de guardado

---

*Fuente: Buenas prácticas §1, §8 y §11 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Escribir buenos prompts

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** la estructura de siete secciones, las tres reglas que más impacto tienen sobre el resultado, y qué va en el prompt del nodo y qué en la Configuración Global.
> 

## La estructura de siete secciones

| Sección | Qué contiene |
| --- | --- |
| 1. Rol y objetivo | Qué es el nodo y para qué existe |
| 2. Contexto | Información del negocio, industria, público, tono de marca |
| 3. Capacidades y herramientas | Qué puede hacer y con qué herramientas cuenta |
| 4. Flujo de conversación | Pasos ordenados, si aplica, con sus condiciones |
| 5. Reglas y restricciones | Qué no hacer, límites, políticas |
| 6. Ejemplos | Casos concretos de mensaje del cliente y respuesta esperada |
| 7. Formato de respuesta | Cómo estructurar cada mensaje |

Conviene cerrar con una sección de **reglas globales** que reúna las tres a cinco restricciones más importantes.

## Las tres reglas que más impacto tienen

### Instrucciones concretas y verificables

Una instrucción sirve si se puede comprobar si se cumplió.

| Verificable | No verificable |
| --- | --- |
| "Respondé en máximo 3 oraciones" | "Sé cordial" |
| "Confirmá fecha, hora y lugar antes de agendar" | "Brindá una atención de calidad" |
| "Si el cliente pide hablar con una persona, derivá sin insistir" | "Sé empático con el cliente" |

### Al menos dos ejemplos por comportamiento crítico

Un ejemplo muestra el patrón. Dos lo confirman y evitan que el modelo generalice mal desde un caso único.

Cada ejemplo es un par: mensaje del cliente y respuesta esperada.

### Instrucciones positivas antes que negativas

"Hacé una pregunta por mensaje" funciona mejor que "no hagas más de una pregunta por mensaje". Decir qué hacer es más efectivo que decir qué evitar.

## Mantener el prompt corto

Un prompt largo consume más tokens en cada turno, confunde al modelo cuando acumula demasiadas reglas, y aumenta la latencia de respuesta.

> 💡
> Si el prompt supera las 400 líneas, es probable que el nodo esté intentando hacer demasiadas cosas. Conviene dividirlo en varios nodos especializados con transferencias entre ellos.

## Qué NO va en el prompt del nodo

El tono, el idioma y el estilo van en **Instrucciones Generales** de la Configuración Global.

Ponerlos en cada nodo:

- Duplica tokens en todos los turnos de todas las conversaciones.
- Genera inconsistencias entre nodos cuando alguno queda desactualizado.
- Obliga a replicar cada cambio en varios lugares.

## Convención de variables

| Sintaxis | Referencia | Cuándo se resuelve |
| --- | --- | --- |
| `/[Campo]` | Un campo de guardado | En runtime, con el valor capturado en la conversación |
| `@[Herramienta]` | Una herramienta conectada al nodo | En runtime, como instrucción vinculada |
| `{{VARIABLE}}` | Una variable de entorno del workspace | Con el valor fijo de configuración |
| `[placeholder]` | Algo que una persona tiene que reemplazar antes de publicar | Nunca. Si queda, es un error. |

> ⚠️
> No dejar valores literales de datos del cliente en el prompt. Un nombre o un correo escritos a mano en el prompt se le van a mostrar a todos los clientes.

## Instrucciones que conviene incluir siempre

### Verificación de campos ya capturados

Sin esta instrucción, muchos modelos vuelven a preguntar datos que ya tienen en el contexto.

> Antes de preguntar un dato, verificá si ya está capturado. Si el cliente corrige un dato que ya tenías, actualizalo y confirmá el cambio en una sola oración.
> 

### Límites de mensajería

> Enviá como máximo 2 mensajes consecutivos sin esperar respuesta del cliente. Si necesitás dar mucha información, usá un carrusel, una lista o un formulario en un solo mensaje en vez de dividir en varios.
> 

### Cuándo terminar la conversación

Ver 10.3 para el detalle de cómo redactar las condiciones de finalización.

## Cómo iterar cuando algo falla

Cuando un comportamiento falla en una parte de los casos, la respuesta no es reescribir todo el prompt.

1. Identificar el patrón en los casos fallidos. ¿Qué tienen en común?
2. Localizar la sección del prompt que aborda ese comportamiento.
3. Agregar o ajustar **una** instrucción específica, o sumar un ejemplo concreto.
4. Reevaluar para confirmar que mejoró sin romper otros criterios.

## Relacionado

- 3.5 Escribir el prompt: Prompt Wizard y editor
- 10.1 Diseñar el flujo antes de construirlo
- 10.3 Diseñar condiciones de salida
- 7.6 Leer los resultados de una evaluación

---

*Fuente: Buenas prácticas §3, §4 y §5 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Diseñar condiciones de salida

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** cada Nodo Fin define un desenlace posible y se convierte en una salida de Flowbuilder. Diseñarlas bien es lo que permite que el resto del ecosistema actúe sobre los resultados.
> 

## La pregunta que define cada salida

**¿Qué tiene que pasar después?**

Si dos salidas llevan a la misma acción aguas abajo, probablemente son una sola.

| Salidas bien diferenciadas | Acción distinta en Flowbuilder |
| --- | --- |
| Cita agendada | Notificar al equipo comercial y programar recordatorio |
| Derivado a humano — Ventas | Asignar a la cola de ventas |
| Derivado a humano — Soporte | Asignar a la cola de soporte |
| No interesado | Etiquetar en CRM y sumar a campaña de nutrición |

**Ejemplo de salidas redundantes:** Resuelto, Cita agendada y Cliente satisfecho. Las tres implican lo mismo. Conviene consolidarlas.

## Nombrar las salidas

Verbos o estados concretos, no adjetivos vagos.

| Conviene | Conviene evitar |
| --- | --- |
| Cita agendada · Cotización enviada · Derivado a asesor · No calificado | Exitoso · Correcto · Fallido |

Quien tenga que mapear cada salida a una acción concreta en Flowbuilder va a agradecer los nombres claros.

## Cubrir todos los escenarios

Todo flujo debería tener salida para estos cinco casos. Si uno no está cubierto, el flujo lo va a resolver como pueda, y generalmente mal.

| Escenario | Qué significa |
| --- | --- |
| Éxito | El objetivo se logró |
| Escalamiento a humano | Se detectó que hace falta intervención |
| No aplica | El cliente no cumple los requisitos o busca algo que no se ofrece |
| Abandono | El cliente dejó de responder |
| Estado inconsistente | El flujo entró en un error de contexto |

Los dos últimos están cubiertos por salidas operativas. Los tres primeros hay que definirlos.

## Diferenciar el escalamiento por razón

Una sola salida genérica de "derivado a humano" no le dice a Flowbuilder a qué equipo asignar.

- Derivado a humano — Ventas: cliente interesado en comprar.
- Derivado a humano — Soporte técnico: problema con el producto.
- Derivado a humano — Cobranzas: consulta sobre pagos.
- Derivado a humano — Reclamo: cliente insatisfecho.

Cada una va a una cola distinta, con tiempos de respuesta distintos.

## Instruir en el prompt cuándo salir

El flujo decide cuándo activar cada salida evaluando las condiciones de las ramas. Para que la decisión sea consistente, conviene reforzarlo en el prompt.

```
# CONDICIONES DE FINALIZACIÓN

Terminá la conversación por la salida `Cita agendada` cuando:
- El cliente confirmó explícitamente fecha, hora y lugar.
- Recibiste confirmación exitosa de la herramienta de agendamiento.
- Enviaste el mensaje de confirmación al cliente.

Terminá por `Derivado a humano - Soporte` cuando:
- El cliente reporta un problema técnico que no está cubierto por la
  base de conocimiento.
- El cliente lo pide explícitamente.
- Detectás frustración clara después de 3 intentos de resolver.

Terminá por `No calificado` cuando:
- El cliente busca algo que no ofrecemos.
- El cliente no cumple los requisitos mínimos.
```

## No abusar del cierre automático

Configurar el flujo para que cierre agresivamente puede matar conversaciones que estaban por convertir.

| Situación | Qué hacer |
| --- | --- |
| Se logró el objetivo | Cerrar. No seguir conversando. |
| Quedó claro que no hay match | Cerrar. No insistir. |
| Hay ambigüedad importante | Escalar a humano. No forzar la resolución. |
| La conversación se está poniendo larga | No cerrar solo por eso. |

## Prevenir salidas ambiguas

Si dos condiciones de salida son semánticamente similares, el sistema lo detecta y avisa. Conviene atender esos avisos: son la causa más común de que el flujo cierre por la salida equivocada.

**Ejemplo problemático:**

- *Derivado a humano — Ventas:* "Cuando el cliente pide hablar con alguien del equipo comercial."
- *Derivado a humano — Asesor:* "Cuando el cliente quiere que lo atienda un humano."

Las dos se solapan. Se resuelve consolidando o diferenciando mejor:

- *Derivado a humano — Ventas:* "Cuando el cliente manifestó interés de compra concreto y pide hablar con un vendedor."
- *Derivado a humano — Consulta general:* "Cuando el cliente pide hablar con un humano por motivos distintos a compra: consulta, reclamo o información."

## Testear cada salida

En el simulador, probar por cada salida:

- Casos que **deberían** activarla.
- Casos que están cerca pero **no** deberían activarla.

| Síntoma | Causa |
| --- | --- |
| La salida se activa cuando no debería | La condición está mal escrita o es demasiado amplia |
| La salida no se activa cuando debería | Falta refuerzo en el prompt, o la condición es demasiado estricta |

## Relacionado

- 3.3 Nodos Fin y ramas de finalización
- 9.2 Mapa completo de salidas
- 7.3 Guía de testing
- 10.2 Escribir buenos prompts

---

*Fuente: Buenas prácticas, sección de condiciones de salida · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Evitar loops y spam

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** los bucles y el envío excesivo de mensajes son las dos formas más frecuentes en que un flujo rompe la experiencia. Las dos se evitan con diseño consciente.
> 

## Los tres tipos de bucle

| Tipo | Qué pasa | Cómo se previene |
| --- | --- | --- |
| **Entre nodos hermanos** | Dos nodos se pasan la conversación de ida y vuelta sin que avance | Condiciones mutuamente excluyentes |
| **Dentro del mismo nodo** | El nodo pregunta lo mismo repetidamente porque no reconoce que ya lo tiene | Instrucción explícita de verificar campos |
| **Entre cliente y nodo** | El cliente pregunta, el nodo reformula, el cliente aclara, el nodo vuelve a reformular | Detección de frustración y escalamiento |

## Bucles entre nodos

Cada condición de rama tiene que ser específica y no solaparse con las demás.

El sistema detecta similitud semántica por encima del 80% y avisa. Conviene atender esos avisos: son la causa más frecuente de que la conversación circule entre nodos sin resolverse.

Si dos nodos tratan temas muy relacionados, la solución suele ser consolidarlos en uno.

> 💡
> Hay una guardia de runtime: después de más de cuatro traspasos consecutivos entre nodos hermanos sin respuesta efectiva al cliente, la conversación sale por la salida de error de contexto. Es una red de seguridad, no una solución. Si se dispara seguido, hay que revisar las condiciones.

## Bucles dentro del mismo nodo

Sin instrucción explícita, muchos modelos vuelven a preguntar datos que ya están en el contexto.

```
# VERIFICACIÓN DE CAMPOS CAPTURADOS

Antes de preguntar un dato, verificá si ya está capturado.
Si el cliente cambia un dato que ya tenías, actualizalo y confirmá
el cambio en una sola oración.
```

## Evitar el envío excesivo de mensajes

Varios mensajes consecutivos se perciben como spam y bajan la tasa de respuesta. Además, bajo el modelo de cobro por mensaje, cada uno tiene costo.

```
# LÍMITES DE MENSAJERÍA

- Enviá como máximo 2 mensajes consecutivos sin esperar respuesta
  del cliente.
- Si necesitás dar mucha información, priorizá un carrusel, una lista
  o un formulario en un solo mensaje en vez de dividir en varios.
- Nunca envíes 3 mensajes o más antes de que el cliente responda.
```

## Detectar frustración y salir del bucle

Conviene configurar una tipificación de seguimiento con una condición del tipo:

> El cliente repite la misma pregunta o pedido más de una vez, o expresa frustración con expresiones como "ya te dije", "no me estás entendiendo" o "quiero hablar con alguien".
> 

Cuando se dispara, el prompt debe instruir al nodo a reconocer explícitamente la fricción y escalar a una persona sin más preguntas:

> Perdón si no te di la respuesta que esperabas. Te derivo con un asesor que va a poder ayudarte mejor.
> 

## Señales a monitorear

Estas métricas, consultables en BigQuery, indican que algo está mal en el diseño.

| Señal | Qué suele significar |
| --- | --- |
| Conversaciones con más de 20 turnos | Probablemente hay un bucle |
| Más de 3 transferencias entre nodos | Bucle entre nodos |
| Conversaciones que terminan en error de contexto | Se disparó la guardia de runtime |
| Más de 2 mensajes consecutivos sin respuesta del cliente | Patrón de envío excesivo |

> 💡
> Si alguna de estas señales aparece en más del 5% de las conversaciones, conviene revisar el diseño del flujo.

## Priorizar la salida limpia

**Es mejor cerrar una conversación limpiamente que sostenerla artificialmente.**

Si el flujo no puede resolver el caso, escalar rápido a una persona en lugar de intentar cinco reformulaciones. Cada reformulación fallida degrada la experiencia y suma costo.

## Spam entrante

Además de evitar que el flujo genere spam, se puede detectar el que entra: conversaciones sin intención genuina que consumen mensajes sin retorno. Ver 2.5 Módulo anti-spam.

## Relacionado

- 3.4 Ramas con condiciones y enrutamiento multi-nodo
- 2.5 Módulo anti-spam
- 9.2 Mapa completo de salidas
- 10.5 Optimización de costos en WhatsApp

---

*Fuente: Buenas prácticas, sección de spam y loops · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Optimización de costos en WhatsApp

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** bajo el modelo de cobro por mensaje, la métrica que importa es cuántos mensajes salientes hacen falta para resolver una conversación. Un flujo que resuelve en 4 cuesta la mitad que uno que resuelve en 8.
> 

## El cambio de modelo

WhatsApp migró del modelo por conversación —una ventana de 24 horas a precio fijo, sin importar cuántos mensajes se intercambiaran— al **modelo por mensaje**, donde cada mensaje enviado por el flujo se cobra individualmente.

La mayoría de las decisiones de construcción impactan directamente en el costo. Un prompt que hace hablar de más, un formato enriquecido mal usado, un flujo con transferencias innecesarias: todo se traduce en más mensajes.

> 💡
> Un flujo bien construido no solo funciona mejor, también cuesta menos. Las prácticas que siempre fueron buenas —respuestas concisas, uso inteligente de componentes enriquecidos, evitar redundancias— ahora tienen impacto medible.

## Lo que cuenta como un solo mensaje

Este es el dato que cambia el diseño.

| Componente | Capacidad | Cuenta como |
| --- | --- | --- |
| Mensaje de texto | Hasta 4096 caracteres | 1 mensaje |
| Carrusel | Hasta 10 tarjetas con imagen, título, descripción, precio y botones | 1 mensaje |
| Lista interactiva | Hasta 10 ítems agrupables en secciones | 1 mensaje |
| Botones de respuesta | Hasta 3 botones | 1 mensaje |
| Formulario de WhatsApp | Multi-paso, con validaciones y lógica | 1 mensaje |
| Multimedia con texto | Imagen, video o documento con descripción | 1 mensaje |
| Texto con vista previa de enlace | URL con preview enriquecido | 1 mensaje |

Antes daba lo mismo mandar un carrusel o un texto largo. Ahora, concentrar información en componentes enriquecidos es directamente menos costo.

## Las estrategias, por impacto

### 1. Consolidar en un solo mensaje

**Antes — 3 mensajes:**

> Tenemos disponible el Toyota Corolla.
> 

> El precio es USD 24.900.
> 

> ¿Querés más info?
> 

**Después — 1 mensaje:**

> Tenemos disponible el Toyota Corolla 2026 en USD 24.900. ¿Querés que te pase la ficha completa o coordinamos un test drive?
> 

Instrucción para el prompt: *"Consolidá toda la información relacionada en un solo mensaje. No dividas en múltiples mensajes cortos consecutivos salvo que sea estrictamente necesario para la comprensión."*

### 2. Carruseles para catálogos

**Antes — 5 mensajes:** un mensaje de introducción, uno por cada modelo, uno de cierre.

**Después — 1 mensaje:** carrusel con tres tarjetas, cada una con foto, precio y botón, más el texto de cierre.

**Reducción del 80%** en ese turno.

### 3. Listas y botones para opciones cerradas

**Antes — 2 mensajes:** la pregunta y después las opciones numeradas en texto.

**Después — 1 mensaje:** lista interactiva con las opciones tocables.

Además del ahorro, el cliente responde con un toque: mejor experiencia y menos error.

### 4. Formularios para captura de datos

Cuando hay que capturar varios datos —una solicitud de crédito con ocho campos— un formulario reemplaza ocho turnos por uno.

También mejora la calidad del dato: menos errores de tipeo, validaciones nativas.

Regla práctica: más de cinco o seis datos, formulario. Menos que eso, varias preguntas en un mismo mensaje.

### 5. Eliminar los mensajes de relleno

Cada mensaje de confirmación de recibido cuesta.

Instrucción para el prompt: *"No envíes mensajes de confirmación de recibido como 'claro', 'entendido' o 'un momento'. Respondé directamente con la información solicitada."*

### 6. Saludo y cierre estratégicos

**Antes — 2 mensajes:**

> ¡Hola! Soy Fer, el asistente de Hansa.
> 

> ¿En qué puedo ayudarte?
> 

**Después — 1 mensaje:**

> ¡Hola! Soy Fer, el asistente de Hansa. ¿Buscás cotizar un vehículo, agendar un test drive o consultar por servicio técnico?
> 

Para el cierre, un solo mensaje de despedida alcanza. Conviene poner una condición de cierre para no entrar en un intercambio de agradecimientos.

### 7. Evitar reformulaciones innecesarias

Ante un mensaje ambiguo, el flujo tiende a preguntar antes de responder.

**Antes — 2 turnos:** el flujo pregunta si quiere el modelo 2025 o 2026, el cliente responde, el flujo contesta.

**Después — 1 turno:** el flujo ofrece la interpretación más probable junto con la alternativa: *"Te paso la ficha del Corolla 2026, el más reciente. Si necesitás info del 2025, avisame."*

### 8. Aprovechar el contexto de origen

Si el cliente viene de un anuncio, el flujo puede arrancar sabiendo qué vio y evitar dos o tres preguntas de calificación. Ver 9.4.

**Sin contexto:** 5 turnos hasta entregar la información.

**Con contexto:** 3 turnos.

### 9. Optimizar la derivación a humano

**Antes:** el flujo anuncia que va a derivar, el asesor arranca preguntando en qué puede ayudar.

**Después:** el flujo deriva con un solo mensaje que incluye una estimación de tiempo, y el asesor arranca con el contexto ya cargado.

### 10. Diseñar como embudo, no como escalera

Un embudo achica la conversación en pocos turnos; una escalera la alarga.

| Escalera — 8 turnos | Embudo — 4 turnos |
| --- | --- |
| Saludo genérico | Saludo con pregunta específica |
| Consulta genérica sobre la necesidad | Respuesta del cliente |
| Confirmación | Propuesta con opciones concretas y llamado a la acción |
| Primera pregunta específica | Cierre o avance |
| Segunda pregunta específica |  |
| Propuesta |  |
| Confirmación de la propuesta |  |
| Cierre |  |

Regla mental al escribir el prompt: *¿este mensaje me acerca al objetivo o solo mantiene la conversación?*

### 11. Cuidar los mensajes automáticos

Algunos mensajes se disparan por reglas del flow: la derivación a humano, el cierre por inactividad, el aviso de que el cliente no califica. Todos se cobran. Conviene revisarlos para que cada uno aporte valor real.

## La métrica que importa

No es "cuántos mensajes envío" sino **cuánto cuesta resolver una conversación exitosamente**.

Un flujo que envía 12 mensajes pero resuelve el 90% de los casos es más eficiente que uno que envía 6 y resuelve el 40%.

Métricas a monitorear:

- Cantidad promedio de mensajes salientes por conversación.
- Cantidad promedio en conversaciones que llegaron a etapas avanzadas del funnel.
- Cantidad promedio en conversaciones que terminaron en derivación a humano.
- Distribución de mensajes salientes por canal y por flujo.

> 💡
> Un flujo con muchas conversaciones de más de 15 mensajes que no llegan a etapas avanzadas es candidato claro a optimización.

## Checklist de auditoría

Para revisar un flujo ya publicado.

- [ ]  ¿Envía mensajes de confirmación de recibido? → Eliminar.
- [ ]  ¿Divide información relacionada en varios mensajes? → Consolidar, cuidando que la experiencia no empeore.
- [ ]  ¿Manda listas de opciones como texto? → Reemplazar por listas interactivas o botones.
- [ ]  ¿Manda catálogos como texto? → Reemplazar por carruseles.
- [ ]  ¿Captura varios datos preguntando de a uno? → Reemplazar por formulario.
- [ ]  ¿Tiene saludo separado del primer mensaje útil? → Consolidar.
- [ ]  ¿El promedio de mensajes por conversación resuelta supera 8? → Investigar.
- [ ]  ¿Hay derivaciones donde el flujo manda varios mensajes de aviso? → Simplificar a uno.
- [ ]  ¿El prompt fomenta respuestas cortas y directas? → Si no, agregarlo.
- [ ]  ¿El prompt hace que reformule preguntas en vez de responder? → Ajustar.
- [ ]  ¿El prompt obliga a recorrer un proceso paso a paso de forma lineal? → Ajustar.

## Relacionado

- 6.1 Formatos de respuesta enriquecidos
- 6.2 WhatsApp Flows
- 10.4 Evitar loops y spam
- 9.4 Cortex en campañas salientes y contexto de origen

---

*Fuente: Buenas prácticas, Parte 2 y checklist de auditoría · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

