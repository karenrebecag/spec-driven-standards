# 3. Construir el flujo

## El canvas: navegación, nodos y guardado

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** la superficie visual donde se componen los Nodos Cortex, y el dashboard desde el que se accede a todos los flujos.
> 

## El dashboard de flujos

Es la pantalla principal de Cortex. Muestra una tarjeta por cada Flujo Cortex guardado.

Cada tarjeta muestra el nombre del flujo, el tiempo relativo desde la última edición y quién fue la última persona que lo editó.

### Acciones disponibles

| Acción | Cómo |
| --- | --- |
| Crear un flujo | Botón **Crear.** Crea un flujo en blanco y abre el canvas. |
| Abrir un flujo | Click en la tarjeta. |
| Duplicar un flujo | Desde las acciones de la tarjeta. |
| Eliminar un flujo | Desde las acciones de la tarjeta, con diálogo de confirmación previo. |

El listado se actualiza en tiempo real cuando se crea o elimina un flujo.

## Navegación del canvas

| Acción | Cómo |
| --- | --- |
| Desplazar la vista | Click sostenido y arrastrar sobre un área vacía |
| Acercar y alejar | Scroll del mouse, o los botones **+** y **−** |
| Centrar todo el flujo | Botón de ajustar a pantalla |

El porcentaje de zoom se muestra junto a los controles.

## Trabajar con nodos

**Mover un nodo.** Se arrastra libremente por el canvas. La posición se guarda con el flujo.

**Conectar dos nodos.** Se arrastra desde el handle de salida de un nodo hacia el handle de entrada de otro.

**Crear un nodo conectado.** Al soltar una conexión sobre un área vacía del canvas, se crea automáticamente un Nodo Cortex ya conectado.

**Configurar un nodo o una rama.** Click sobre el elemento abre su configuración en el panel lateral derecho.

**Duplicar un nodo.** Copia su configuración completa: prompt, herramientas, base de conocimiento y campos.

**Eliminar un nodo.** Sus conexiones se eliminan automáticamente junto con él.

## Nombre del flujo

Se edita inline desde la barra superior. Click sobre el nombre lo vuelve editable.

> 💡
> El nombre por defecto no se puede publicar. Antes de publicar, el sistema valida que el flujo tenga un nombre propio de al menos 3 caracteres. Ver 7.2 Validaciones antes de publicar.

## Guardado

El guardado es automático. Cualquier cambio en el flujo se persiste con un retardo de un segundo desde la última modificación.

Eso incluye posiciones de nodos, conexiones, prompts y configuración. No hay que guardar manualmente.

> 💡
> El guardado automático escribe sobre la **versión borrador**. Los cambios no llegan a producción hasta publicar. Ver 8.1 Borrador vs publicado.

## Relacionado

- 3.2 El Nodo Cortex y su panel de configuración
- 3.4 Ramas con condiciones y enrutamiento multi-nodo
- 7.1 El simulador
- 8.1 Borrador vs publicado

---

*Fuente: FRD base HU-01 y HU-02 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## El Nodo Cortex y su panel de configuración

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** el bloque principal del flujo. Recibe el mensaje del cliente, razona con un LLM, consulta lo que necesita y responde o transfiere la conversación a otro nodo.
> 

## El Nodo Inicio

Todo flujo nuevo se crea con un Nodo Inicio. Es el punto de entrada obligatorio y hay exactamente uno por flujo.

- No se puede eliminar ni duplicar.
- No tiene configuración: al seleccionarlo no se abre panel de propiedades.
- Tiene un único handle de salida.
- Su botón **+** crea y conecta directamente el primer Nodo Cortex.

## El Nodo Cortex

Es donde se define el comportamiento. Cada nodo representa un momento de la conversación con su propio rol.

### Qué se configura

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Instrucciones del nodo | Sí | El prompt. Texto largo que define rol, alcance y comportamiento. Ver 3.5. |
| LLM | Sí | Modelo que ejecuta el nodo. Se elige entre modelos de Gemini, OpenAI y opciones más económicas. |
| Herramientas | No | Aplicaciones externas, HTTP Request, Code Tools y MCP Servers. Ver sección 5. |
| Bases de Conocimiento | No | Documentos y tablas dinámicas que el nodo puede consultar. Ver sección 4. |
| Guardado de Campos | No | Datos que el nodo captura durante la conversación. Ver 4.3. |

### Indicadores visuales

El nodo muestra badges con la cantidad de herramientas, bases de conocimiento y campos configurados.

Si falta el prompt, aparece un badge de error en rojo con una aclaración en el borde inferior derecho. Un flujo con un nodo sin prompt no se puede compilar.

## Cómo decide el nodo a dónde transferir

Cada Nodo Cortex conoce automáticamente las condiciones de enrutamiento de los nodos conectados a él: hermanos e hijos.

Cuando detecta que no puede resolver la consulta del cliente, transfiere la conversación al nodo que corresponda según esas condiciones. No hace falta un nodo intermedio que decida.

La regla de fallback es la siguiente: si el nodo no encuentra un hermano al que enrutar, o no tiene hermanos, la conversación vuelve al nodo padre.

Cada transferencia incluye un campo **Razón** que justifica el traspaso y queda registrado en la trazabilidad.

> 💡
> Esta capacidad es lo que evita que una conversación quede atrapada en un nodo inadecuado. Depende directamente de qué tan bien escritas estén las condiciones de las ramas. Ver 3.4.

## El panel de configuración

El panel lateral derecho muestra la configuración del elemento seleccionado en el canvas. El contenido cambia automáticamente al cambiar la selección.

| Qué está seleccionado | Qué muestra el panel |
| --- | --- |
| Un Nodo Cortex | Tres tabs: **General**, **Base de Conocimiento** y **Herramientas** |
| Un Nodo Fin | El campo de rama de finalización |
| Una rama | La configuración de su condición |
| Nada | La Configuración Global, con el toggle de prevención de bucles infinitos |

## Ejecución de herramientas

El nodo puede ejecutar acciones en servicios externos directamente desde su propia configuración, sin nodos intermedios. El LLM decide cuándo invocar cada herramienta según el contexto de la conversación y la descripción de cada una.

## Relacionado

- 3.1 El canvas: navegación, nodos y guardado
- 3.3 Nodos Fin y ramas de finalización
- 3.4 Ramas con condiciones y enrutamiento multi-nodo
- 3.5 Escribir el prompt
- 10.2 Escribir buenos prompts

---

*Fuente: FRD base HU-03, HU-04 y HU-07 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Nodos Fin y ramas de finalización

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** los puntos donde termina la conversación. Cada uno lleva una etiqueta que identifica el escenario de salida y se convierte en una salida del Nodo Cortex dentro de Flowbuilder.
> 

## Para qué sirven

Un Nodo Fin no es solo el final del recorrido. Es la forma en que el flujo le comunica a Flowbuilder **qué pasó** con la conversación, para que el resto del ecosistema actúe en consecuencia.

Un flujo puede tener tantos Nodos Fin como escenarios de salida distintos necesite.

> 💡
> La pregunta que define si dos Nodos Fin deben ser uno o dos es: ¿Flowbuilder tiene que hacer algo diferente en cada caso? Si la acción posterior es la misma, sobra uno. Ver 10.3 Diseñar condiciones de salida.

## Dónde se configura

Click sobre el Nodo Fin en el canvas abre el panel derecho con su campo de rama de finalización.

## La rama de finalización

Es el único campo configurable del nodo. Identifica el escenario de salida y se expone en runtime.

Ejemplos de ramas bien nombradas:

- Cita agendada
- Cotización enviada
- Derivado a asesor de ventas
- No calificado

Ejemplos a evitar: "Exitoso", "Correcto", "Fallido". No le dicen a Flowbuilder qué acción tomar.

## Nombre heredado de la condición

Cuando se crea un Nodo Fin conectado a una rama que ya tiene condición definida, el sistema autocompleta la rama de finalización con un resumen corto de esa condición.

El resumen lo genera un LLM liviano al momento de crear el nodo: máximo 40 caracteres, primera letra en mayúscula, sin punto final.

| Condición de la rama | Rama de finalización sugerida |
| --- | --- |
| El usuario está molesto y solicita hablar con un humano | Cliente molesto solicita humano |
| El cliente confirmó la compra | Compra confirmada |

### Edición manual

El nombre autocompletado se puede editar libremente.

Una vez editado a mano, deja de actualizarse automáticamente aunque después cambie la condición de la rama. Se respeta la intención explícita del builder.

Un ícono discreto indica si el nombre fue autogenerado o editado manualmente.

### Si la condición cambia después

- **Nombre todavía autogenerado:** aparece un aviso sutil — *"La condición cambió. ¿Querés actualizar el nombre del Nodo Fin para que coincida?"* — con las opciones Actualizar y Mantener.
- **Nombre ya editado a mano:** no aparece el aviso y el nombre queda intacto.

### Si el nodo se crea sin condición previa

Si el Nodo Fin se arrastra libremente al canvas sin una rama conectada, recibe el valor por defecto y se edita a mano.

Si después se le conecta una rama con condición, el nombre existente no se sobrescribe.

## El Nodo Fin por inactividad

Al crear un Nodo Cortex, el sistema genera automáticamente un Nodo Fin con la rama de finalización **Sin respuesta**, asociado a un tiempo configurable en minutos.

Su función es evitar que una conversación sin respuesta del cliente quede en un bucle sin salida. Al dispararse, Flowbuilder puede retomarla mediante asignación.

> 💡
> El cierre por inactividad corre **después** del proceso de recupero, no en lugar de él. Ver 9.3 Recupero por inactividad.

## Qué pasa al compilar

Al compilar el flujo, cada Nodo Fin se convierte en un punto de terminación del grafo ejecutable.

Cada rama de finalización se expone como una salida independiente del Nodo Cortex dentro de Flowbuilder. Si un flujo tiene tres Nodos Fin, el nodo en Flowbuilder muestra esas tres salidas más las operativas estándar.

## Validaciones

- **Todo nodo hoja debe ser un Nodo Fin.** Si un Nodo Cortex no tiene salida hacia un Nodo Fin, la validación falla con el mensaje *"El nodo debe conectarse a un nodo End"*.
- **La rama de finalización no puede quedar vacía.** Si el autocompletado falla, se asigna un valor genérico hasta que el builder lo configure.
- **Detección de ambigüedad.** Si dos ramas de finalización del mismo nodo superan el 80% de similitud semántica, aparece un aviso en rojo. La ambigüedad hace que el LLM cierre por la salida equivocada.

## Fuera de alcance

- Regenerar el nombre autogenerado a pedido.
- Sugerencias múltiples de nombre.

## Relacionado

- 3.2 El Nodo Cortex y su panel de configuración
- 3.4 Ramas con condiciones y enrutamiento multi-nodo
- 9.2 Mapa completo de salidas
- 10.3 Diseñar condiciones de salida

---

*Fuente: FRD base HU-05 · FRD Parte 4 HU-08 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Ramas con condiciones y enrutamiento multi-nodo

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** las conexiones entre nodos llevan una condición escrita en lenguaje natural, y el LLM decide en runtime cuál corresponde tomar.
> 

## Para qué sirven

Las ramas son lo que permite que un flujo multi-nodo funcione sin nodos intermedios que decidan. Cada Nodo Cortex conoce las condiciones de las ramas que salen de él y de sus hermanos, y usa esa información para transferir la conversación al nodo adecuado.

Esto significa que la calidad del enrutamiento depende casi por completo de qué tan bien escritas estén las condiciones.

## Cómo se crea

Al conectar dos Nodos Cortex, el sistema asigna automáticamente el tipo de condición evaluada por LLM. No hay que elegirlo.

Click sobre la rama abre el panel derecho, donde se escribe la expresión de condición.

## La expresión de condición

Describe en lenguaje natural cuándo se activa la transición.

**Ejemplos:**

- "El usuario está molesto y pide hablar con una persona"
- "El cliente manifiesta interés concreto en probar un vehículo específico y menciona el modelo"
- "El cliente pregunta por el estado de un pedido que ya realizó"

Una rama sin expresión de condición se marca como error de validación y bloquea la compilación.

## Cómo escribir buenas condiciones

Tres criterios, en orden de importancia.

**Mutuamente excluyentes.** Dos condiciones no deberían aplicar a la misma situación. Es la causa más frecuente de que el LLM transfiera al nodo equivocado.

**Concretas.** Mencionar la intención del cliente o el tema, no estados vagos.

**Testeables.** Que se pueda escribir un mensaje de ejemplo del cliente que la dispare. Si no se puede, la condición es demasiado abstracta.

| Conviene | Conviene evitar |
| --- | --- |
| "El cliente manifiesta interés concreto en probar un vehículo específico y menciona el modelo" | "Cuando corresponde transferir a test drive" |
| "El cliente reporta un problema técnico con un producto ya comprado" | "El cliente tiene un problema" |

## Detección de condiciones similares

El sistema analiza automáticamente la similitud semántica entre condiciones cada vez que se agrega o edita una. La comparación se hace entre las ramas que salen de un mismo nodo.

Si dos condiciones superan el **80% de similitud**, se marcan como conflictivas y aparece una notificación en rojo en la sección de errores del panel:

> Detectamos {N} condiciones de handoff muy similares entre subnodos. El LLM puede traspasar al nodo equivocado.
> 

### Ejemplo de conflicto

| Rama A | Rama B | Problema |
| --- | --- | --- |
| "El usuario tiene una consulta sobre cobranza" | "El usuario pregunta sobre pagos pendientes" | Similitud superior al 80%. El LLM no va a elegir de forma consistente. |

El error no desaparece hasta que la similitud baje del umbral. La forma de resolverlo es diferenciar mejor los casos, o consolidar los dos nodos en uno.

> 💡
> La misma detección aplica a las ramas de finalización de los Nodos Fin, donde la ambigüedad genera problemas de enrutamiento en Flowbuilder.

## Qué pasa en runtime

Las condiciones de todas las ramas conectadas a un Nodo Cortex se inyectan en su contexto, junto con las condiciones de sus nodos hermanos. Con esa información, el nodo sabe qué rutas tiene disponibles.

Cuando detecta que la consulta no le corresponde, transfiere directamente al nodo adecuado. Cada transferencia incluye una razón que justifica el traspaso.

Si no encuentra un hermano al que enrutar, o no tiene hermanos, la conversación vuelve al nodo padre.

## Prevención de bucles

Un flujo mal diseñado puede generar transferencias infinitas entre nodos hermanos. El sistema detecta esa situación en runtime.

Si se producen más de cuatro traspasos consecutivos entre nodos del mismo nivel sin que ninguno haya producido una respuesta efectiva al cliente, la ejecución se detiene y la conversación sale por la salida operativa **Error de contexto** en Flowbuilder.

> 💡
> Esta guardia existe para que un cliente no quede atrapado en una conversación rota. Que se dispare seguido es señal de que las condiciones se solapan y hay que revisar el diseño del flujo, no de que el límite esté mal calibrado.

## Fuera de alcance

- Detección de similitud entre condiciones de nodos que no sean padre-hijo o hermanos directos.
- Corrección automática de condiciones sin intervención del builder.
- Detección de contradicciones entre condiciones que se anulen entre sí.

## Relacionado

- 3.2 El Nodo Cortex y su panel de configuración
- 3.3 Nodos Fin y ramas de finalización
- 9.2 Mapa completo de salidas
- 10.4 Evitar loops y spam

---

*Fuente: FRD base HU-06 · FRD Parte 3 HU-07 y HU-08 · Buenas prácticas §9 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Escribir el prompt: Prompt Wizard y editor

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** el prompt define el comportamiento del Nodo Cortex. Se escribe en el panel derecho, se puede expandir a un editor grande, y hay un asistente que genera una primera versión estructurada.
> 

## Dónde se escribe

**Canvas → Nodo Cortex → panel derecho → tab General → campo de instrucciones.**

## El editor

### Textarea inline

El campo del panel se puede agrandar y achicar verticalmente desde el handle de la esquina inferior derecha.

- Altura mínima: unas 6 líneas. Altura máxima: unas 20 líneas, con scroll interno a partir de ahí.
- El tamaño elegido se recuerda por nodo.

### Modal de edición

Los prompts suelen ser largos, y el panel lateral queda incómodo. El modal abre un editor grande, de al menos el 70% del alto de la pantalla.

| Acción | Cómo |
| --- | --- |
| Abrir el modal | Ícono de expandir en la esquina superior derecha del campo, o `Cmd/Ctrl + Shift + E` con el cursor dentro |
| Buscar y reemplazar | `Cmd/Ctrl + F` dentro del modal |
| Guardar y cerrar | `Cmd/Ctrl + S` |
| Cerrar | `Esc`, con confirmación si hay cambios sin guardar |

El modal incluye resaltado de sintaxis para variables y referencias, contador de caracteres al pie, y acceso al Prompt Wizard.

El contenido se guarda como borrador cada 30 segundos para no perder trabajo ante un cierre accidental.

## Insertar campos y herramientas

Dentro del prompt hay dos atajos.

| Atajo | Qué despliega | Qué inserta |
| --- | --- | --- |
| `/` | Los campos de guardado configurados en el nodo | Una referencia al campo, por ejemplo `/[Correo electrónico]` |
| `@` | Las herramientas conectadas al nodo | Una referencia a la herramienta, por ejemplo `@[Send Message - Slack]` |

Los dos desplegables son filtrables: al seguir escribiendo después del símbolo, la lista se reduce.

En runtime, las referencias se resuelven con el valor capturado o con la instrucción vinculada a la herramienta.

## Cómo estructurar el prompt

La estructura recomendada tiene siete secciones:

1. **Rol y objetivo** — qué es el nodo y para qué existe.
2. **Contexto** — información del negocio, industria, público, tono de marca.
3. **Capacidades y herramientas** — qué puede hacer y con qué cuenta.
4. **Flujo de conversación** — pasos ordenados, si aplica, con sus condiciones.
5. **Reglas y restricciones** — qué no hacer, límites, políticas.
6. **Ejemplos** — casos concretos de mensaje del cliente y respuesta esperada.
7. **Formato de respuesta** — cómo estructurar cada mensaje.

Las tres reglas que más impacto tienen sobre el resultado:

- **Instrucciones concretas y verificables.** "Respondé en máximo 3 oraciones" se puede verificar; "sé cordial" no.
- **Al menos dos ejemplos por comportamiento crítico.**
- **Instrucciones positivas antes que negativas.** "Hacé una pregunta por mensaje" funciona mejor que "no hagas más de una pregunta por mensaje".

> 💡
> Si el prompt supera las 400 líneas, es probable que el nodo esté intentando hacer demasiadas cosas. En ese caso conviene dividirlo en varios nodos especializados. Ver 10.2 Escribir buenos prompts.

> ⚠️
> El tono, el idioma y las reglas que aplican a todo el flujo van en **Configuración Global**, no en el prompt de cada nodo. Repetirlos consume tokens en todos los turnos y obliga a replicar cada cambio.

## El Asistente de AI

Toma una descripción en lenguaje natural de lo que se necesita y genera un prompt estructurado siguiendo las buenas prácticas.

### Cómo se usa

1. Click en el botón **Asistente IA**, accesible desde el campo de instrucciones.
2. Escribir en lenguaje natural qué debe hacer el nodo. Por ejemplo: *"que atienda clientes de soporte técnico y escale si no puede resolver"*.
3. Revisar el prompt generado. Lo nuevo aparece marcado visualmente para distinguirlo de lo que ya estaba.
4. Aceptar, editar a mano, revertir o regenerar con instrucciones adicionales.

### Qué tiene en cuenta

El Wizard usa el contexto del nodo para generar algo más preciso:

- **Herramientas conectadas.** Incluye instrucciones sobre cuándo y cómo usarlas, considerando los inputs que necesitan y su formato.
- **Campos de guardado.** Agrega instrucciones de recolección.
- **Bases de conocimiento.** Ajusta el prompt para que las consulte cuando corresponda.

### Guardrails

El Wizard genera automáticamente restricciones en el prompt: temas prohibidos, instrucciones para mantenerse dentro del alcance definido, y directrices para evitar respuestas fuera de contexto o alucinaciones.

Se pueden indicar temas o preguntas que el nodo debe declinar responder, y el Wizard los incluye como restricciones explícitas.

## Fuera de alcance

- Vista previa en vivo del prompt aplicado a un mensaje de prueba.
- Edición colaborativa en tiempo real.

## Relacionado

- 3.2 El Nodo Cortex y su panel de configuración
- 4.3 Campos de guardado
- 10.2 Escribir buenos prompts
- 2.1 El panel de Configuración Global

---

*Fuente: FRD Parte 2 HU-4 · FRD Parte 3 HU-11 · Buenas prácticas §3 y §4 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

