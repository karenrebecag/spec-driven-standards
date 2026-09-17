# 6. Mensajería

## Formatos de respuesta enriquecidos

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** botones, listas, carruseles y tarjetas con imagen. El builder habilita qué formatos puede usar el nodo, y el LLM decide cuándo aplicar cada uno.
> 

## Para qué sirven

Dos motivos, y el segundo suele pesar más de lo esperado.

**Experiencia.** Un cliente que elige entre cuatro opciones tocando un botón se equivoca menos que uno que tiene que escribir el número.

**Costo.** Bajo el modelo de cobro por mensaje de WhatsApp, un carrusel con diez tarjetas cuenta como **un solo mensaje**. Enumerar esos diez ítems como texto puede costar cinco. Ver 10.5.

## Dónde se configura

**Canvas → Nodo Cortex → panel derecho → tab General → sección Formato de Mensaje.**

Son cinco toggles, todos desactivados por defecto.

## La descripción de ejecución

Cada formato habilitado muestra un campo de texto editable con una descripción por defecto. Esa descripción es lo que le indica al LLM **cuándo** usar ese formato.

Viene precargada con un comportamiento razonable, y el builder la ajusta a su caso.

| Formato | Cuándo lo usa el nodo, por defecto |
| --- | --- |
| Imagen con caption | Cuando la respuesta incluye una imagen y un texto descriptivo que aporta contexto, como una ficha de producto |
| Botones de respuesta | Cuando la respuesta ofrece pocas opciones excluyentes |
| Botón CTA con URL | Cuando hay que dirigir al cliente a un recurso externo: catálogo, formulario, mapa de sucursal |
| Lista de opciones | Cuando hay cuatro o más opciones, o cuando se agrupan naturalmente por categoría |
| Carrusel | Cuando hay que comparar varios ítems visuales, cada uno con imagen, título y descripción |

> 💡
> Si se activa un formato sin tocar la descripción, el nodo lo va a usar cuando le parezca que corresponde. Para controlar el momento exacto hay que ser específico en el prompt, indicando en qué situación usar cada formato y con qué contenido.

## Límites por formato

El sistema valida los límites de la plataforma antes de enviar. Cuando el LLM genera algo que los excede, el sistema trunca y lo registra.

| Formato | Límites |
| --- | --- |
| Imagen con caption | Caption hasta 1024 caracteres |
| Botones de respuesta | 2 o 3 botones. Texto de cada uno hasta 20 caracteres. Los identificadores los genera el sistema, no el LLM. |
| Botón CTA con URL | Un solo botón. Texto hasta 20 caracteres. La URL debe ser HTTPS. |
| Lista de opciones | Hasta 10 opciones en hasta 10 secciones. Título de cada fila hasta 24 caracteres, descripción hasta 72. |
| Carrusel | Entre 2 y 10 tarjetas. Cada una con imagen obligatoria, texto de hasta 160 caracteres y al menos un botón. Todas las tarjetas deben tener el mismo tipo de botón. |

### Qué pasa cuando algo excede el límite

| Situación | Comportamiento |
| --- | --- |
| Un texto supera el límite de caracteres | Se trunca y se registra la truncación |
| El LLM genera más de 3 botones | Fallback a lista si está habilitada, si no a texto plano. Se registra la degradación. |
| El LLM genera más de 10 filas de lista | Se incluyen las primeras 10 y se registra la omisión |
| La URL de un CTA no es HTTPS | Se rechaza, se envía texto plano y se registra |
| El carrusel queda con una sola tarjeta | Fallback a botón CTA o a texto plano |

## Validación antes de publicar

El sistema mantiene una tabla de límites por canal y por tipo de componente, y valida contra ella en el editor.

Si un componente excede el límite, aparece un aviso con una sugerencia concreta:

> El label del botón "Confirmar mi solicitud de préstamo hipotecario" excede el límite de 20 caracteres del canal WhatsApp. Sugerencia: "Confirmar solicitud".
> 

**El flujo no se puede publicar** mientras haya componentes que excedan los límites.

En runtime, si un mensaje generado por el LLM excede el límite, el sistema aplica una reescritura semántica para que entre, sin bloquear el envío, y lo registra en trazabilidad.

## Fallback a texto plano

Cuando un componente enriquecido no se puede armar correctamente, el sistema lo reintenta hasta tres veces. Si sigue fallando, entrega una versión equivalente en texto plano.

El fallback incluye los datos principales de cada ítem —título, descripción, precio, URL— concatenados de forma legible. Si resulta demasiado largo para un solo mensaje, se divide en mensajes secuenciales.

El builder puede previsualizar el fallback en el editor antes de publicar, y personalizarlo si no le convence el generado automáticamente.

### Ejemplo

Un carrusel con tres modelos de auto, enviado a un canal que no soporta componentes enriquecidos, llega así:

> Tenemos estas opciones para vos:
> 

> 1. Toyota Corolla 2026 — USD 24.900. Ver más: [link]
> 

> 2. Honda Civic 2026 — USD 26.500. Ver más: [link]
> 

> 3. Chevrolet Cruze 2026 — USD 22.800. Ver más: [link]
> 

> ¿Cuál te interesa?
> 

## Comportamiento general

- Los formatos enriquecidos se adaptan al canal. En los canales donde no están soportados, degradan a texto simple.
- Todas las interacciones del cliente con botones, listas y tarjetas quedan registradas en el historial de la conversación.
- Cuando el cliente toca un botón o selecciona una opción de lista, el nodo lo procesa en su ciclo normal.
- Un botón CTA abre la URL en el navegador y no genera respuesta de vuelta al flujo.

> ⚠️
> En esta fase se priorizan tres formatos: **tarjetas, carruseles y botones rápidos**.

## Relacionado

- 6.2 WhatsApp Flows
- 6.3 Multimedia y features de canal
- 3.5 Escribir el prompt
- 10.5 Optimización de costos en WhatsApp

---

*Fuente: FRD Parte 2 HU-08 · FRD Parte 6 HU-01 y HU-03 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## WhatsApp Flows

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** formularios multi-paso de WhatsApp que el Nodo Cortex envía para capturar varios datos en un solo mensaje, en lugar de preguntarlos de a uno.
> 

## Para qué sirven

Un WhatsApp Flow es el formato más eficiente para captura de datos complejos.

- **Cuenta como un solo mensaje**, aunque contenga diez campos con validaciones.
- **Reduce fricción**: el cliente completa todo en una pantalla.
- **Mejora la calidad del dato**: validaciones nativas, desplegables cerrados, menos errores de tipeo.

Capturar ocho datos preguntando de a uno son ocho turnos. Con un Flow es uno.

> ⚠️
> Los Flows **no se crean en Cortex**. Se crean en el módulo de Flows de Atom. Desde Cortex solo se seleccionan de la lista de Flows ya publicados.

## Dónde se configura

**Canvas → Nodo Cortex → panel derecho → tab General → sección Formatos de respuesta → toggle WhatsApp Flow.**

Desactivado por defecto. Al activarlo aparece una lista vacía con el botón **+ Agregar Flow**.

## Varios Flows por nodo

Un nodo puede necesitar Flows distintos en momentos distintos de la conversación. Por ejemplo, en un banco:

- Un Flow de datos personales al iniciar el vínculo.
- Un Flow de solicitud de préstamo cuando el cliente confirmó interés.
- Un Flow de agendamiento cuando quiere cerrar con un asesor.
- Un Flow de reclamo si detecta insatisfacción.

Se pueden agregar hasta **10 Flows por nodo**. El orden se ajusta arrastrando, aunque no afecta la decisión del LLM: es solo organización visual.

## Configuración de cada Flow

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Flow seleccionado | Sí | Desplegable con los Flows publicados del workspace. Muestra nombre e identificador de la cuenta asociada. Tiene buscador. |
| Descripción de uso | Sí | Le indica al LLM cuándo enviar este Flow específico. |
| Vista previa | — | Abre un modal con el Flow tal como lo verá el cliente |

El desplegable solo lista Flows en estado publicado, no borradores. El mismo Flow no se puede agregar dos veces al mismo nodo.

Si el workspace no tiene Flows creados, aparece un estado vacío con un enlace al módulo de Flows de Atom.

## Las descripciones de uso son lo crítico

Con varios Flows disponibles, la descripción de uso es lo único que le permite al LLM elegir el correcto. Deben ser **mutuamente excluyentes**: no debería haber dos Flows aplicables a la misma situación.

| Conviene | Conviene evitar |
| --- | --- |
| "Enviar cuando el cliente confirmó interés en solicitar un préstamo personal y aún no tenemos sus datos financieros. NO enviar si ya completó el Flow de solicitud antes." | "Enviar cuando el cliente quiere hacer algo." |

Una buena descripción cubre tres cosas: el momento de la conversación, la intención del cliente, y cuándo **no** enviarlo.

### Detección de descripciones similares

Si dos descripciones superan el 80% de similitud semántica, el sistema avisa:

> Las descripciones de uso de "Flow Datos Personales" y "Flow Registro Cliente" son muy parecidas. El nodo puede confundirse al elegir cuál enviar.
> 

Es el mismo mecanismo que detecta condiciones de rama ambiguas.

## Cómo decide el nodo cuál enviar

El LLM decide de forma autónoma según tres cosas: las descripciones de uso de todos los Flows habilitados, el contexto de la conversación, y las instrucciones explícitas del prompt si las hay.

### Referenciar Flows en el prompt

Al escribir `@` en el prompt se despliega el selector con los Flows habilitados. Al seleccionar uno se inserta una referencia, por ejemplo `@[Flow Solicitud de Préstamo]`.

Eso permite guiar al nodo con precisión:

> Al iniciar la conversación, si no tenemos los datos del cliente, enviá `@[Flow Datos Personales]`. Después, según el interés que manifieste:
> 

> — Si quiere un préstamo: enviá `@[Flow Solicitud de Préstamo]`.
> 

> — Si quiere agendar con un asesor: enviá `@[Flow Agendamiento]`.
> 

> — Si expresa un reclamo: enviá `@[Flow Reclamos]`.
> 

### Varios envíos en la misma conversación

Una conversación puede recibir varios Flows distintos a lo largo de sus turnos.

Por defecto, el nodo no envía el mismo Flow dos veces en la misma conversación, salvo que el prompt lo indique explícitamente.

## Captura de datos

Cuando el cliente completa un Flow y lo envía, los datos llegan como parte del siguiente mensaje entrante.

El mapeo a los campos de guardado del nodo es automático, según la configuración del Flow en Atom. Si se envían varios Flows, los datos se van sumando; un Flow posterior puede actualizar un campo que uno anterior ya había capturado.

Los campos capturados por Flow cumplen las mismas reglas de obligatoriedad que los campos regulares.

### Flows abandonados

Si el cliente cierra un Flow sin completarlo, el nodo lo detecta y puede intentar recuperarlo con un mensaje configurable en el prompt:

> Veo que no completaste el formulario de solicitud. ¿Querés que te lo mande de nuevo o preferís que te lo pregunte por chat?
> 

Este comportamiento aplica a cada Flow por separado.

## Ejemplo

Un cliente escribe *"Hola, quiero un préstamo"*. El nodo:

1. Envía el **Flow Datos Personales**, porque no lo tiene identificado. El cliente lo completa.
2. Envía el **Flow Solicitud de Préstamo**, ahora que ya tiene sus datos. El cliente lo completa.
3. Confirma la solicitud y envía el **Flow Agendamiento con Asesor** para cerrar con un humano.

Resultado: tres mensajes cobrados capturaron lo que por chat habría llevado entre doce y quince turnos.

## Trazabilidad

Por cada envío de Flow se registra el nombre e identificador, el timestamp de envío, el de respuesta si el cliente lo completó, el estado —completado, abandonado o en progreso—, los datos capturados y el tiempo transcurrido.

Si se enviaron varios, la vista los muestra en orden cronológico.

En BigQuery se puede consultar qué porcentaje de Flows se completa por tipo, cuál es la combinación más común en conversaciones exitosas, y cuál tiene mayor tasa de abandono.

## Sincronización con Atom

| Qué pasa en Atom | Qué pasa en Cortex |
| --- | --- |
| Se elimina un Flow en uso | Se marca como no disponible y aparece un aviso para reemplazarlo o quitarlo |
| Se modifica un Flow, agregando o quitando campos | Se notifica al builder que revise el mapeo |

En runtime, si el nodo intenta enviar un Flow no disponible, se registra el error y el nodo responde con un fallback en texto o intenta otro Flow aplicable.

## Validaciones al publicar

- Si el formato está activo pero no hay ningún Flow agregado: bloquea la publicación.
- Si algún Flow tiene la descripción de uso vacía: bloquea la publicación.
- Si hay descripciones semánticamente similares: aviso no bloqueante.

## Fuera de alcance

- Crear o editar Flows desde Cortex.
- Personalizar dinámicamente el contenido del Flow según el contexto de la conversación.
- Enviar un Flow desde el simulador con captura real. El simulador muestra que se enviaría, pero no lo renderiza de forma interactiva.
- Mapeo manual de campos del Flow a campos del nodo.
- Encadenar Flows sin pasar por un turno del nodo.
- Flows en canales distintos de WhatsApp.

## Relacionado

- 6.1 Formatos de respuesta enriquecidos
- 4.3 Campos de guardado
- 3.4 Ramas con condiciones y enrutamiento multi-nodo
- 10.5 Optimización de costos en WhatsApp

---

*Fuente: FRD Parte 6 HU-18 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Multimedia y features de canal

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** qué archivos puede enviar y recibir el Nodo Cortex —imágenes, audio, documentos, video— y las funciones nativas de WhatsApp que hacen la conversación más parecida a una real.
> 

## Lo que el nodo puede enviar

| Tipo | Comportamiento |
| --- | --- |
| Imágenes | PNG, JPG y WEBP. Se muestran inline en el chat, no solo como descarga. Admiten caption. |
| PDF | Se muestran con vista previa y botón de descarga |
| Audio | Generado a partir de la respuesta de texto, si está habilitada la respuesta en audio |

Los archivos pueden provenir de tres lugares: la base de conocimiento del nodo, una URL externa, o generarse dinámicamente, como una cotización.

El envío se configura desde el prompt, referenciando los recursos disponibles.

## Lo que el nodo puede recibir

### Imágenes

El nodo acepta imágenes en PNG, JPG, JPEG y WEBP.

Usa un modelo con capacidad de visión para interpretar el contenido: puede describir lo que ve y responder preguntas sobre la imagen. Las imágenes quedan en el contexto de la conversación, así que el nodo puede referenciarlas en mensajes posteriores.

Casos típicos: capturas de error, fotos de productos, documentos escaneados.

### Audio

El nodo acepta mensajes de audio en MP3, OGG, WAV y M4A.

El audio se transcribe automáticamente a texto y se procesa como cualquier mensaje escrito.

**Responder en audio** es configurable desde el panel del nodo, con un switch y una descripción de cuándo hacerlo. Con la opción activa, el nodo genera un audio a partir de su respuesta de texto. Tanto la transcripción como el audio generado quedan registrados en el historial.

### PDFs

El nodo puede leer e interpretar un PDF que envíe el cliente, tratándolo como parte natural del mensaje y no como un adjunto opaco.

Casos que habilita:

- Un afiliado manda la orden médica y el nodo extrae los estudios prescriptos.
- Un aspirante manda su título escaneado y el nodo valida los datos.
- Un cliente manda una factura de servicios y el nodo evalúa monto y vencimiento.

| Límite | Valor |
| --- | --- |
| Páginas máximas | 10 |
| Tamaño máximo | 5 MB |
| PDFs por mensaje | 1. Si el cliente envía varios, se procesan en turnos sucesivos. |
| Canales soportados | WhatsApp |

El procesamiento se elige automáticamente según el modelo del nodo. Los modelos con soporte nativo de PDF interpretan texto, tablas y layout directamente. Los que no lo tienen reciben el texto extraído, con OCR si el documento está escaneado.

> 💡
> Esto es distinto de la base de conocimiento. La base son documentos precargados por el builder que sirven para todas las conversaciones. Un PDF entrante es un input de un cliente puntual, se procesa en el momento y se guarda como parte de esa conversación. No hay fragmentación ni base vectorial.

El nodo puede guardar información extraída del PDF en campos de guardado, cambiar de etapa o disparar tipificaciones, igual que con cualquier otro input.

**Casos borde:** un PDF protegido con contraseña, corrupto o con un escaneo ilegible no se procesa. El nodo recibe una señal explícita del motivo y le pide al cliente que lo reenvíe o comparta la información de otra forma. Lo mismo si excede los límites.

> ⚠️
> Procesar un PDF suma tokens al contexto del turno. Los documentos con imágenes densas o layout complejo consumen más. El consumo por PDF procesado se puede ver en trazabilidad.

## Límites de WhatsApp por tipo

| Tipo | Formatos | Tamaño máx. | Caption |
| --- | --- | --- | --- |
| Audio | AAC, AMR, MP3, M4A, OGG | 16 MB | No |
| Documento | PDF, DOC(X), XLS(X), PPT(X), TXT | 100 MB | Sí |
| Imagen | JPEG, PNG | 5 MB | Sí |
| Video | MP4, 3GPP con códec H.264 y audio AAC | 16 MB | Sí |

Cada archivo recibido se descarga y se guarda en el almacenamiento propio, porque los identificadores de media de la plataforma expiran a los 30 días.

Los mensajes multimedia entrantes activan los mismos disparadores que un mensaje de texto.

## Funciones nativas de WhatsApp

Tres funciones que hacen la conversación más natural. Las tres son transparentes para el builder: no requieren configuración por nodo.

### Responder a un mensaje citado

Cuando el cliente responde citando un mensaje anterior —una foto, una cotización, una opción de un carrusel— el nodo recibe esa referencia como parte del contexto del turno.

Según el tipo de mensaje citado:

- **Imagen:** el nodo accede al archivo y razona sobre el contenido visual junto con el mensaje nuevo.
- **Texto:** lo recibe como bloque adicional de contexto.
- **Interactivo:** recibe la opción específica que el cliente citó.

El nodo también puede enviar respuestas citando un mensaje del cliente, cuando la respuesta es directa a algo puntual.

Si la cita apunta a un mensaje que ya no existe en el almacenamiento, el nodo procesa el turno solo con el mensaje nuevo y registra el aviso.

### Indicador de escritura

Cuando el nodo empieza a generar una respuesta, el cliente ve "escribiendo…". El indicador se libera al enviar el mensaje, o a los 25 segundos.

Solo se dispara si efectivamente se va a responder. Si falla, no bloquea el envío del mensaje.

### Vista previa de enlaces

Los mensajes que contienen una URL se envían con vista previa enriquecida —título, descripción, imagen— en lugar de mostrar la URL pelada.

La detección es automática. Es un switch a nivel canal, habilitado por defecto, que vive en la configuración del canal de WhatsApp.

Si el sitio de destino no cumple los requisitos para generar vista previa, el mensaje llega igual con la URL como texto. No se considera un error.

## Fuera de alcance

- Stickers animados y WebP.
- Reacciones con emoji.
- Mensajes editados o eliminados.
- Formatos de documento distintos de PDF para lectura entrante.
- Configuración granular por nodo de las funciones nativas: son globales del canal.
- Funciones nativas en canales distintos de WhatsApp.

## Relacionado

- 6.1 Formatos de respuesta enriquecidos
- 4.1 Base de conocimiento (RAG)
- 4.3 Campos de guardado
- 7.1 El simulador

---

*Fuente: FRD Parte 2 HU-00, HU-07 y HU-9 · FRD Parte 3 HU-01 a HU-04 · FRD Parte 5 HU-03 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

