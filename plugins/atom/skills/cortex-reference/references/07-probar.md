# 7. Probar

## El simulador

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** un chat embebido para probar el flujo manualmente antes de exponerlo a clientes, con la posibilidad de arrancar la conversación desde un contexto ya cargado.
> 

## Qué versión se prueba

El simulador corre siempre sobre la **versión borrador**, nunca sobre la publicada.

Al presionar el botón de simular, si hay cambios sin guardar el sistema los guarda automáticamente antes de abrir el chat. No hace falta guardar a mano cada vez.

Si el guardado falla, se muestra el error y el simulador no se abre.

> 💡
> Esto permite iterar sin publicar: se edita, se simula, se corrige, se vuelve a simular. Lo que está en producción no se toca hasta presionar Publicar. Ver 8.1.

## Cómo se abre

**Canvas → botón de simulación**, en la esquina inferior derecha.

El botón solo compila si el flujo es válido. Si tiene errores de validación, los muestra en lugar de abrir el chat. Ver 7.2.

Al abrirlo, el sistema compila el flujo en un grafo ejecutable y verifica que pueda instanciarse. Si la compilación falla, se muestran los errores con detalle.

El panel se puede cerrar sin perder el flujo.

## Contexto inicial

Antes de iniciar la conversación se puede precargar contexto, para probar escenarios sin tener que reconstruirlos turno a turno.

Casos típicos: probar cómo responde el nodo si el cliente ya está identificado, si tiene un tier premium marcado en el CRM, o arrancar desde un punto avanzado del funnel sin recorrer los pasos previos.

### Cómo se configura

En la pantalla del simulador hay una sección colapsable **Contexto inicial**. Por defecto aparece cerrada con el mensaje "Contexto inicial: vacío (cliente nuevo)".

Al expandirla se ve el listado de todos los campos configurados en el flujo. Por cada uno se puede dejar vacío o precargar un valor.

También se puede configurar la **etapa inicial del funnel** y las **tipificaciones ya aplicadas**, útil para probar comportamientos condicionales.

### Presets

La configuración actual se puede guardar como preset y reutilizar en simulaciones futuras. Los presets se guardan a nivel flujo.

Ejemplos: "Cliente premium identificado", "Lead nuevo", "Cliente con reclamo previo".

### Qué pasa al iniciar

El nodo arranca con esos valores ya disponibles. En el prompt del turno inicial, el LLM los recibe como si hubieran sido capturados en turnos anteriores.

El panel de trazas muestra qué contexto se precargó.

## Comportamiento del chat

| Acción | Comportamiento |
| --- | --- |
| Enviar un mensaje | `Enter`. `Shift + Enter` agrega un salto de línea sin enviar. |
| Escribir mensajes largos | El campo crece automáticamente hasta unas 6 líneas, después aparece scroll interno. Al enviar vuelve a una línea. |
| Mientras el nodo procesa | Se muestra el indicador "Escribiendo…" |
| Al recibir un mensaje nuevo | La vista baja automáticamente hasta que el mensaje quede completamente visible |
| Al scrollear hacia arriba | El scroll automático se pausa. Aparece un botón flotante para volver al último mensaje y reanudarlo. |

Cada sesión de chat recibe un identificador único, lo que permite probar el comportamiento de memoria con estado.

## Qué renderiza el simulador

El simulador reproduce todos los tipos de mensaje que el nodo puede enviar y recibir en producción, con un aspecto coherente al canal seleccionado. WhatsApp es el canal por defecto.

Cada mensaje muestra su rol, timestamp y estado.

| Tipo | Cómo se renderiza |
| --- | --- |
| Texto | Respeta saltos de línea y el formato básico de WhatsApp: negrita, cursiva, tachado y monoespaciado. Las URLs se detectan como enlaces con vista previa. |
| Audio | Reproductor con play, pausa y duración. Diferencia nota de voz de archivo de audio. |
| Imagen | Miniatura inline con caption. Click expande a tamaño completo. |
| Video | Miniatura con overlay de reproducción y caption. Click reproduce inline. |
| Documento | Ícono según extensión, nombre de archivo, tamaño y botón de descarga. |
| Botones | Hasta 3 debajo del mensaje. Aviso si el texto excede los 20 caracteres. |
| Listas | Botón inicial que despliega la lista, con opciones agrupadas en secciones. |
| Botón CTA | Abre la URL configurada en una pestaña nueva. Soporta encabezado, cuerpo y pie. |

> 💡
> Los mensajes interactivos son **funcionales** en el simulador. Tocar un botón o elegir una opción de lista hace avanzar el flujo igual que lo haría un cliente real.

También se pueden enviar todos los tipos de mensaje desde el lado del cliente, para probar cómo reacciona el nodo.

Si un nodo envía un tipo de mensaje que el canal simulado no soporta, aparece un aviso visual indicando la incompatibilidad.

## Fuera de alcance

- Renderizado diferenciado por canal más allá de WhatsApp.
- Envío de WhatsApp Flows con captura real. El simulador muestra que se enviaría, pero no lo renderiza de forma interactiva.
- Editor de texto enriquecido en el campo de entrada.

## Relacionado

- 7.2 Validaciones antes de publicar
- 7.3 Guía de testing
- 8.1 Borrador vs publicado
- 6.1 Formatos de respuesta enriquecidos

---

*Fuente: FRD base HU-14 · FRD Parte 2 HU-10 · FRD Parte 4 HU-09 · FRD Parte 6 HU-06, HU-07 y HU-15 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Validaciones antes de publicar

> Estado en el manual original: **Borrador** · Tipo: Referencia

> **En una línea:** el sistema valida el flujo en segundo plano de forma continua, y bloquea la publicación cuando encuentra errores que romperían la ejecución.
> 

## Cómo funciona

La validación se ejecuta automáticamente en segundo plano, sin activación manual. No hay un botón de validar.

El resultado se ve en un botón flotante en la esquina inferior derecha del canvas:

| Estado del botón | Significado |
| --- | --- |
| Azul | El flujo es válido. Click compila y abre el simulador. |
| Rojo con badge | Hay errores. El badge muestra cuántos. Click los lista. |
| Cargando | Compilando |

## Errores que bloquean la compilación

Estas tres reglas impiden compilar el flujo y, por lo tanto, simularlo o publicarlo.

| Regla | Qué valida | Mensaje |
| --- | --- | --- |
| V-01 | Todo Nodo Cortex debe tener un prompt | El nodo '{etiqueta}' no tiene un objetivo de conversación |
| V-02 | Toda rama debe tener expresión de condición | La condición '{etiqueta}' no tiene expresión de condición |
| V-03 | Todo nodo hoja debe ser un Nodo Fin | El nodo '{etiqueta}' debe conectarse a un nodo End |

## Validaciones al publicar

Además de las anteriores, al presionar Publicar se verifican estas condiciones.

### Nombre del flujo

El flujo no se puede publicar con el nombre por defecto ni con menos de 3 caracteres.

> Antes de publicar, dale un nombre a tu agente que lo identifique claramente.
> 

El foco se mueve al campo de nombre para editarlo en el momento.

> 💡
> El motivo no es cosmético: un flujo llamado "Nuevo agente" es imposible de identificar después en el listado, en los reportes y en la trazabilidad.

### Componentes que exceden límites de canal

El flujo no se puede publicar si hay componentes enriquecidos que superan los límites de la plataforma —texto de botón, título de lista, cantidad de opciones. El aviso incluye una sugerencia concreta de reemplazo. Ver 6.1.

### WhatsApp Flows sin configurar

Si el formato está activo pero no hay ningún Flow agregado, o si algún Flow habilitado tiene la descripción de uso vacía, la publicación se bloquea. Ver 6.2.

### Referencias rotas en integraciones

Si un MCP Server referencia una variable de entorno o una conexión de autenticación que no existe o fue eliminada, la validación marca el error. Lo mismo si un parámetro de un Code Tool referencia un campo que no existe.

Suele pasar al importar un flujo desde otro workspace. Ver 5.4.

## Validación del lado de Flowbuilder

Un flujo puede estar impecable y aun así romper en producción si el nodo de Flowbuilder que lo invoca está mal configurado.

Al publicar un flow en Flowbuilder, el sistema valida que todos los Nodos Cortex tengan un flujo seleccionado y que ese flujo exista y esté publicado.

Si alguno está vacío, se bloquea la publicación con el detalle de cuáles:

> Los siguientes nodos no tienen agente seleccionado: {Nodo A}, {Nodo B}. Selecciona un agente en cada uno antes de publicar.
> 

Cada ítem del listado tiene un botón **Ir al nodo** que hace foco sobre él en el canvas.

La misma validación corre al guardar, pero como aviso no bloqueante, para poder seguir trabajando con el flow incompleto.

> 💡
> Sin esta validación, el error solo aparece cuando un cliente real intenta interactuar. Es el caso más común de falla silenciosa.

## Avisos que no bloquean

Estos aparecen pero permiten seguir. Conviene atenderlos igual: son la causa más frecuente de comportamiento errático.

| Aviso | Por qué importa |
| --- | --- |
| Condiciones de rama con más de 80% de similitud | El LLM transfiere al nodo equivocado de forma inconsistente |
| Ramas de finalización muy similares entre sí | La conversación cierra por la salida equivocada |
| Descripciones de uso de WhatsApp Flows similares | El nodo envía el formulario que no corresponde |
| Condición que referencia un campo inexistente | La condición nunca se cumple |

## Fuera de alcance

- Validar que el flujo esté "bien configurado" más allá de lo estructural. Que el prompt tenga sentido o que las herramientas funcionen no se valida acá: eso se prueba en el simulador y con evaluaciones.

## Relacionado

- 7.1 El simulador
- 7.3 Guía de testing
- 8.1 Borrador vs publicado
- 3.4 Ramas con condiciones y enrutamiento multi-nodo

---

*Fuente: FRD base HU-13 · FRD Parte 6 HU-05 y HU-08 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Guía de testing: qué probar antes de publicar

> Estado en el manual original: **Borrador** · Tipo: Buenas prácticas

> **En una línea:** el checklist de lo que hay que probar en el simulador antes de publicar un flujo, y cómo interpretar lo que falla.
> 

## Por qué no alcanza con el camino feliz

Que el flujo funcione cuando el cliente responde lo esperado no dice mucho. Los problemas aparecen cuando el cliente se sale del guion, cambia de tema o responde algo ambiguo — que es la mayoría de las conversaciones reales.

Las validaciones automáticas cubren lo estructural. Que el flujo compile no significa que el nodo se comporte bien.

## Checklist antes de publicar

### Conversación

- [ ]  **Camino feliz.** El escenario típico, de punta a punta, termina donde corresponde.
- [ ]  **Pregunta ambigua.** El nodo ofrece la interpretación más probable junto con las alternativas, en el mismo mensaje.
- [ ]  **Cambio de tema a mitad de camino.** El nodo transfiere al nodo correcto o retoma sin perder lo capturado.
- [ ]  **Respuesta contradictoria.** El cliente se corrige a sí mismo. El nodo actualiza el dato y confirma el cambio.
- [ ]  **Consulta fuera de alcance.** El nodo declina sin inventar y deriva si corresponde.

### Cada salida por separado

Esto es lo que más se saltea y lo que más caro sale.

- [ ]  **Por cada Nodo Fin**, probar un caso que debería activarlo.
- [ ]  **Por cada Nodo Fin**, probar un caso que está cerca pero **no** debería activarlo.
- [ ]  **Escalamiento a humano.** Verificar que se dispara cuando corresponde y no antes.
- [ ]  **Sin respuesta.** Verificar el comportamiento cuando el cliente deja de contestar.

> 💡
> Si una salida se activa cuando no debería, la condición está mal escrita. Si no se activa cuando debería, o falta refuerzo en el prompt o la condición es demasiado estricta.

### Datos y clasificación

- [ ]  **Campos obligatorios.** Se piden en el momento configurado y el nodo no avanza sin ellos.
- [ ]  **Campos de captura posterior.** Se registran si el cliente los menciona, sin que el nodo pregunte.
- [ ]  **Cambios de etapa.** La conversación se clasifica en la etapa correcta según lo conversado.
- [ ]  **Tipificaciones y etiquetas.** Se aplican cuando la condición se cumple.

### Herramientas

- [ ]  **Se invoca la herramienta correcta** en el momento correcto.
- [ ]  **Los parámetros son los correctos.** Revisar en el panel de trazas qué argumentos se enviaron.
- [ ]  **Comportamiento ante fallo.** Simular el error y verificar que el nodo no le muestre el error crudo al cliente.

### Formatos y canal

- [ ]  **Los formatos enriquecidos se envían** cuando corresponde, no en cualquier momento.
- [ ]  **Los componentes no exceden los límites** de caracteres del canal.
- [ ]  **Los botones y listas son funcionales** y hacen avanzar el flujo.

## Qué hacer con lo que falla

| Síntoma | Causa probable | Dónde mirar |
| --- | --- | --- |
| La conversación se transfiere al nodo equivocado | Condiciones de rama que se solapan | 3.4 · revisar el aviso de similitud |
| El nodo repite una pregunta que ya tenía respondida | Falta la instrucción de verificar campos capturados antes de preguntar | 3.5 · agregar la verificación al prompt |
| El nodo cierra por la salida equivocada | Ramas de finalización ambiguas entre sí | 3.3 · consolidar o diferenciar |
| El nodo responde bien pero sin consultar la base de conocimiento | Puede estar usando conocimiento general del modelo, que se desactualiza | 4.1 · revisar el log de consultas del turno |
| La tabla dinámica devuelve resultados inesperados | Falta un filtro en el prompt de búsqueda | 4.2 · revisar el SQL generado |
| El nodo envía varios mensajes seguidos | Falta el límite de mensajería en el prompt | 10.4 · 10.5 |
| El formato enriquecido aparece en momentos raros | Descripción de ejecución por defecto sin ajustar | 6.1 · precisar cuándo usarlo |

## Cuándo el simulador no alcanza

El simulador prueba de a un caso por vez, y depende de que se le ocurran los escenarios a quien lo usa.

Cuando hace falta medir con criterios objetivos sobre muchas conversaciones —o sobre tráfico real— corresponde una evaluación multi-turno. Ver 7.4.

> 💡
> Recomendación práctica: correr una evaluación sobre tráfico real durante las primeras dos semanas de cada flujo en producción. Es cuando aparecen los casos que nadie anticipó.

## Relacionado

- 7.1 El simulador
- 7.2 Validaciones antes de publicar
- 7.4 Evaluaciones: crear y ejecutar
- 10.3 Diseñar condiciones de salida

---

*Fuente: Buenas prácticas §13 y sección de condiciones de salida · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Evaluaciones: crear y ejecutar

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** pruebas automatizadas que corren muchas conversaciones contra el flujo y las puntúan según criterios definidos, con dos orígenes posibles: conversaciones generadas por IA o tráfico real de producción.
> 

## Los dos orígenes

|  | Simular con IA | Tráfico en vivo |
| --- | --- | --- |
| Qué evalúa | Conversaciones sintéticas generadas contra el flujo | Conversaciones reales ya cerradas |
| Cuándo usarlo | Antes de publicar, para validar cambios | En producción, para detectar problemas de calidad |
| Control sobre los casos | Alto: se define el comportamiento a evaluar y los perfiles de cliente | Ninguno: son las conversaciones que hubo |
| Costo | Consume tokens al generar cada conversación | Solo el costo de evaluar |

Los dos comparten la misma vista de resultados y los mismos criterios de evaluación.

## Dónde está

**Canvas → barra superior → ícono de Evaluaciones.**

Abre un panel lateral derecho con la tabla de todas las evaluaciones del flujo. Se cierra sin perder el contexto del canvas.

### La tabla

| Columna | Contenido |
| --- | --- |
| Nombre | El que le puso el builder |
| Origen | Simulado o En vivo |
| Casos | Cantidad total |
| Estado | Completado, Evaluando, Error o Cancelado |
| Puntaje | Global sobre 100. Vacío mientras evalúa. |
| Fecha de realización | Ordenadas por más reciente primero |

La tabla se actualiza en tiempo real cuando hay evaluaciones en curso.

### Acciones por fila

**Ver resultados**, **Duplicar configuración** —abre el formulario con los mismos parámetros precargados—, **Cancelar** si está corriendo, y **Eliminar** si no lo está. Las evaluaciones eliminadas no se recuperan.

**Permisos:** ver corresponde a cualquier usuario con acceso de lectura. Crear, cancelar y eliminar, a editores.

## Crear una evaluación con IA

1. Click en **+ Nueva evaluación**.
2. Elegir **Simular con IA**.
3. Completar el formulario.
4. Click en **Ejecutar evaluación**.

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Nombre | Sí | Mínimo 3 caracteres, único dentro del flujo |
| Qué comportamiento querés evaluar | Sí | Mínimo 20 caracteres. Describe el caso de uso; la IA genera conversaciones que ponen a prueba ese comportamiento. |
| Cantidad de conversaciones | Sí | 10, 20, 50, 100 u otro valor entre 1 y 500. Por defecto 50. |
| Personalidades | Al menos una | Perfiles de cliente simulado. Ver 7.5. |
| Criterios | Al menos uno | Dimensiones de calidad a medir. Ver 7.5. |

Personalidades y criterios vienen premarcados con un conjunto recomendado. Se pueden desmarcar y agregar propios.

## Crear una evaluación sobre tráfico real

Mismo recorrido, eligiendo **Tráfico en vivo**.

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Nombre | Sí | Mínimo 3 caracteres, único dentro del flujo |
| Máximo de conversaciones | Sí | 10, 20, 50, 100 u otro valor entre 1 y 1000. Por defecto 50. |
| Máximo de tiempo | Sí | 1 día, 3 días, 1 semana, 2 semanas o 1 mes. Por defecto 1 semana. |
| Criterios | Al menos uno | Los mismos que en la evaluación simulada |

No hay personalidades —las conversaciones vienen de clientes reales— ni descripción del comportamiento a evaluar, porque las conversaciones ya existen.

### Cómo se seleccionan las conversaciones

Se toman conversaciones **ya cerradas** que hayan ocurrido dentro de la ventana temporal configurada, hasta alcanzar el máximo.

El muestreo es aleatorio dentro de la ventana, no cronológico, para evitar sesgo hacia las primeras conversaciones.

Si no hay suficientes conversaciones para llegar al máximo, la evaluación corre con las disponibles y lo informa en los resultados.

## Ejecución

Al presionar Ejecutar, el modal se cierra y aparece un aviso de que la evaluación arrancó. La fila nueva aparece en estado Evaluando.

**La evaluación corre en segundo plano.** Se puede seguir trabajando en el canvas, simular el flujo o navegar a otra parte del producto.

### Qué pasa con cada conversación simulada

Por cada conversación se inicia una simulación independiente:

- Un LLM con el perfil de la personalidad asignada actúa como cliente.
- El flujo real —en su versión borrador— responde con todas sus herramientas y su base de conocimiento.
- La conversación termina cuando se cumple una condición de cierre.

Cada turno se persiste con timestamp, rol, contenido, invocaciones de herramientas y latencia.

Una vez completadas todas las conversaciones, se ejecutan los criterios sobre cada una.

Las conversaciones se reparten de forma uniforme entre las personalidades activas. Con 50 conversaciones y 5 personalidades, van 10 por personalidad.

### Cómo terminan las conversaciones simuladas

Después de cada turno del cliente simulado, el motor evalúa cinco condiciones en orden. La primera que se cumple cierra la conversación.

| Condición | Cuándo se dispara | Cierre |
| --- | --- | --- |
| Error de runtime | Timeout de más de 40 segundos, error de herramienta no manejado, error de modelo | Error |
| Escalada a humano | El flujo deriva la conversación | Asistencia humana |
| Cliente satisfecho | Señales explícitas de cierre por satisfacción | Resuelta |
| Cliente abandona | Señales de frustración terminal o pérdida de interés | Abandono |
| Máximo de turnos | Se llega a 10 turnos del cliente sin que se cumpla nada anterior | Abandono |

En las evaluaciones sobre tráfico real no se aplica ninguna condición artificial: el cierre se toma de la rama de finalización con la que terminó la conversación en producción.

### Estados y notificaciones

Cuando la evaluación termina aparece una notificación con el puntaje y un enlace a los resultados.

Si una conversación individual falla, queda registrada con cierre de error y no rompe la evaluación completa. La tasa de error se expone como métrica en los resultados.

Al cancelar una evaluación en curso, las conversaciones ya completadas se conservan y quedan disponibles para revisión.

## Qué versión se evalúa

Al presionar Ejecutar, el motor toma una **copia inmutable de la versión borrador**: prompt, flujo del canvas, herramientas, base de conocimiento, tablas, configuración global, modelo y parámetros.

Si después se modifica el flujo, la evaluación en curso no se ve afectada: sigue corriendo contra la copia.

> 💡
> Esto es lo que permite comparar resultados entre versiones. Cada evaluación queda atada a la configuración exacta con la que se corrió, así que un resultado viejo sigue siendo interpretable meses después.

## Relacionado

- 7.5 Personalidades y criterios de evaluación
- 7.6 Leer los resultados de una evaluación
- 7.1 El simulador
- 8.1 Borrador vs publicado

---

*Fuente: FRD Evaluaciones Multi-turn HU-01 a HU-04, HU-07, HU-11 y HU-13 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Personalidades y criterios de evaluación

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** las personalidades definen cómo se comporta el cliente simulado; los criterios definen qué se mide de la respuesta del flujo.
> 

## Personalidades

Solo aparecen en las evaluaciones **Simular con IA**. En tráfico real las conversaciones vienen de clientes de verdad.

Cada conversación simulada usa una personalidad, que determina el tono y el comportamiento del cliente durante todo el intercambio.

### Las personalidades incluidas

| Personalidad | Comportamiento | Estado por defecto |
| --- | --- | --- |
| Cordial | Amable y cooperativo | Activa |
| Frustrado | Molesto, exige soluciones rápidas | Activa |
| Confundido | No entiende y pregunta varias veces | Activa |
| Técnico | Pregunta detalles y conoce el producto | Activa |
| Apresurado | Quiere respuestas cortas y directas | Activa |
| Manipulador | Inyecta prompt y busca el bypass | Inactiva |

> 💡
> La personalidad Manipulador viene desactivada porque no todos los flujos necesitan probar resistencia a manipulación. Conviene activarla en flujos que manejan datos sensibles, operaciones con dinero o información regulada, junto con el criterio de Inyección de prompt.

Las descripciones de las personalidades incluidas no se editan. Si hace falta un comportamiento distinto, se crea una propia.

### Crear una personalidad

Al final de la grilla hay una tarjeta **Otro**. Al abrirla se piden dos campos:

| Campo | Requisitos |
| --- | --- |
| Personalidad | Mínimo 3 caracteres. Único entre todas las personalidades de esa evaluación. |
| Descripción | Entre 10 y 200 caracteres. Es lo que el LLM usa como guía para generar los mensajes del cliente. |

La personalidad creada se marca como activa y queda disponible para crear más.

> ⚠️
> Las personalidades propias viven **a nivel de esa evaluación**, no en un catálogo reutilizable. Se pueden editar o eliminar mientras la evaluación no se haya ejecutado; después quedan inmutables para preservar la trazabilidad de los resultados.

### Cómo se distribuyen

Las conversaciones configuradas se reparten de forma uniforme entre las personalidades activas. Con 50 conversaciones y 5 personalidades, son 10 por cada una. Si la división no es exacta, el resto se distribuye al azar.

En los resultados, cada conversación muestra qué personalidad se usó.

## Criterios de evaluación

Aparecen en los dos tipos de evaluación. Definen qué dimensiones de calidad se miden sobre cada conversación.

El puntaje final de una conversación es el promedio de todos los criterios activos.

### Los criterios incluidos

| Criterio | Qué mide |
| --- | --- |
| Alucinaciones | Qué tan correctas son las respuestas |
| Relevancia contextual | Qué tanto se mantiene en el contexto de la conversación |
| Error percibido | Qué tanto error percibe el cliente en la conversación |
| Inyección de prompt | Qué tanto resiste los intentos de manipulación |
| Elección de herramientas | Qué tan adecuada es la elección entre las herramientas conectadas |

Todos vienen activos por defecto.

### Crear un criterio

Igual que con las personalidades, la tarjeta **Otro** abre el formulario:

| Campo | Requisitos |
| --- | --- |
| Criterio | Nombre único dentro de la evaluación |
| Descripción | Mínimo 10 caracteres, máximo 200 |
| Tipo de evaluación | Numérico o Booleano |

### Numérico o booleano

| Tipo | Qué devuelve | Cuándo conviene |
| --- | --- | --- |
| **Numérico (0–100)** | Un puntaje gradual | Dimensiones donde una respuesta puede ser parcialmente correcta: tono, relevancia, completitud |
| **Booleano (pasa / no pasa)** | Un veredicto binario | Presencia o ausencia de algo concreto: resistir un ataque, mencionar un descargo obligatorio, no filtrar datos sensibles |

### Cómo escribir un buen criterio

Los criterios funcionan mejor formulados como **preguntas cerradas**.

| Conviene | Conviene evitar |
| --- | --- |
| "¿El nodo confirmó explícitamente los datos capturados al cliente antes de agendar la cita?" | "Verificar que el nodo se comporte correctamente al agendar." |

La segunda es demasiado abierta y devuelve resultados inconsistentes entre corridas.

> 💡
> Con dos a cuatro criterios bien elegidos se obtiene la mayor parte del valor. Los que rara vez sirven son los que dependen de interpretaciones muy subjetivas —"la respuesta es simpática"— y los que evalúan cosas que ya se validaron en el prompt.

## Cómo se calculan los puntajes

Cada criterio se evalúa una sola vez por conversación, **después del cierre del thread**, no turno por turno.

El evaluador recibe cuatro cosas: la conversación completa con sus invocaciones de herramientas, el nombre y descripción del criterio, el prompt del flujo evaluado, y el cierre con el que terminó la conversación. Devuelve un veredicto y una justificación textual.

### Los tres niveles de puntaje

| Nivel | Cómo se calcula |
| --- | --- |
| Puntaje de un caso | Promedio simple de todos los criterios activos, con los booleanos convertidos a 100 o 0. Todos pesan igual. |
| Puntaje global | Promedio de los casos completados |
| Puntaje por criterio | Numéricos: promedio de ese criterio en todos los casos. Booleanos: porcentaje de casos que pasaron. |

**Ejemplo.** Un caso con tres criterios: Alucinaciones 70, Relevancia 50, Inyección de prompt que pasó (equivale a 100). El puntaje del caso es (70+50+100)/3 = **73**.

### Casos que no se puntúan

Si la conversación cerró por **Error** o por **Asistencia humana**, los criterios no se ejecutan y el caso queda sin puntaje.

El motivo es no penalizar al flujo por situaciones donde la evaluación de calidad no aplica: derivar a un humano cuando corresponde es el comportamiento correcto, no una falla.

Estos casos tampoco entran en el promedio global, lo que queda reflejado en la métrica de casos completados.

### Si el evaluador falla

Se reintenta hasta tres veces con espera creciente. Si sigue fallando para un caso puntual, ese caso conserva los puntajes de los demás criterios y el fallido se marca como no evaluado, sin entrar en ningún promedio.

## Fuera de alcance

- Catálogo global reutilizable de personalidades y criterios entre evaluaciones.
- Criterios evaluados turno por turno en lugar de sobre la conversación completa.
- Pesos diferenciados por criterio en el promedio.
- Configuración avanzada del evaluador: elegir modelo, ejemplos de referencia, tipos de salida adicionales.
- Criterios de trayectoria, como verificar la secuencia exacta de herramientas invocadas.
- Generar personalidades o criterios con IA a partir del contexto del flujo.

## Relacionado

- 7.4 Evaluaciones: crear y ejecutar
- 7.6 Leer los resultados de una evaluación
- 7.3 Guía de testing

---

*Fuente: FRD Evaluaciones Multi-turn HU-05, HU-06 y HU-12 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Leer los resultados de una evaluación

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** la vista de resultados muestra el puntaje global, las métricas clave, el desglose por criterio y la lista completa de casos para profundizar en cualquiera.
> 

## Cómo se abre

Click en cualquier fila del panel de Evaluaciones. Funciona con evaluaciones completadas, en curso o canceladas.

La vista reemplaza al listado dentro del mismo panel lateral. El botón de retroceder vuelve al listado.

## El encabezado

### Puntaje global

Un medidor semicircular con el puntaje sobre 100, con color según el rango:

| Rango | Color | Lectura |
| --- | --- | --- |
| 80 o más | Verde | Saludable |
| Entre 50 y 79 | Amarillo | Mejorable |
| Menos de 50 | Rojo | Crítico |

### Métricas clave

| Métrica | Qué muestra |
| --- | --- |
| Casos completados | Cuántos de los evaluados llegaron a puntuarse |
| Resolución | Porcentaje de casos que cerraron como Resuelta |
| Tiempo de respuesta | Latencia promedio por turno |
| Tasa de error | Porcentaje de casos que cerraron por Error |

Cada una lleva un indicador cualitativo que ubica el valor sin tener que conocer los rangos de memoria.

## Puntaje por criterio

Lista con cada criterio activo y su puntaje agregado.

| Tipo de criterio | Qué muestra el número |
| --- | --- |
| Numérico | El promedio de ese criterio en todos los casos evaluados |
| Booleano | El porcentaje de casos que pasaron. Al pasar el cursor se ve el conteo absoluto. |

> 💡
> Los dos tipos se muestran sobre 100 para que se puedan comparar de un vistazo y para que el promedio global tenga una base consistente. Un criterio booleano en 80 significa que el 80% de los casos lo pasaron, no que hubo un aprobado parcial.

## Cierre de conversaciones

Una barra horizontal segmentada muestra cómo se distribuyeron los cierres, usando las ramas de finalización del flujo. Si hay más de cinco, se agrupan con opción de ver el resto.

Es la lectura más rápida de si el flujo está terminando donde debería. Un flujo de agendamiento donde la mayoría de las conversaciones cierran por abandono tiene un problema, aunque el puntaje global sea aceptable.

## Lista de casos

Tabla con todas las conversaciones evaluadas.

| Columna | Contenido |
| --- | --- |
| Chat | Vista previa del primer mensaje del cliente |
| Personalidad | Solo en evaluaciones simuladas. Cuál se usó. |
| Origen | Solo en evaluaciones sobre tráfico real. El canal de la conversación. |
| Cierre | Con qué terminó |
| Puntaje | Sobre 100, o vacío si el caso no se completó |

> 💡
> La tabla viene ordenada por puntaje ascendente: **los peores casos aparecen primero**. Es deliberado. El valor de una evaluación no está en el promedio sino en los casos que fallaron.

## Detalle de un caso

Click en una fila abre la conversación completa.

### La conversación

Se renderiza como un chat, con los mensajes del cliente de un lado y los del flujo del otro, cada uno con su timestamp.

Cuando el flujo envió opciones —botones o listas— se renderizan como tarjetas numeradas dentro del mensaje, replicando el formato real del canal.

Cuando el flujo ejecutó una herramienta, aparece un bloque colapsable con el nombre. Se expande para ver los argumentos y la respuesta.

### El resumen del caso

Debajo de la conversación:

- **Puntaje del caso**, en el mismo formato de medidor.
- **Personalidad** u origen, según el tipo de evaluación.
- **Cierre** con el que terminó.
- **Puntaje por criterio** para ese caso puntual.

Los criterios numéricos muestran el puntaje sobre 100. Los booleanos muestran un indicador de **Pasa** o **No pasa**, para que quede claro que es binario. Al pasar el cursor se ve la justificación del evaluador.

### Casos sin puntaje

Si el caso cerró por Error o por Asistencia humana, el medidor y los criterios aparecen vacíos, y un aviso arriba de la conversación explica el motivo del cierre.

La conversación visible llega hasta el último turno antes del error o de la derivación.

## Mientras la evaluación corre

La vista se puede abrir con la evaluación en curso. Muestra los datos parciales disponibles con un indicador de que sigue actualizándose, y refresca sola cada pocos segundos hasta completarse.

Si la evaluación fue cancelada, muestra los casos completados hasta ese momento. Si falló por completo, ofrece reintentar con la misma configuración.

## Cómo leer los resultados

Un orden que funciona:

1. **Mirar la distribución de cierres antes que el puntaje global.** Dice si el flujo está terminando donde debería.
2. **Buscar el criterio con peor puntaje.** Concentra el problema principal.
3. **Abrir los tres o cuatro peores casos** y buscar qué tienen en común. El patrón suele ser más informativo que cualquier caso individual.
4. **Localizar la sección del prompt** que aborda ese comportamiento y ajustarla, en lugar de reescribir todo.
5. **Volver a evaluar** para confirmar que mejoró sin romper otros criterios.

> 💡
> Antes de publicar cambios, conviene correr el mismo conjunto de criterios y comparar contra la evaluación anterior. Si el puntaje bajó, vale entender por qué antes de publicar.

## Qué se conserva

Una vez completada, los resultados son **inmutables**. No se modifican puntajes, conversaciones ni configuración.

Cada evaluación queda asociada a la copia exacta del flujo con la que se corrió, así que un resultado viejo sigue siendo interpretable aunque el flujo haya cambiado varias veces desde entonces.

Para volver a evaluar con cambios hay que lanzar una evaluación nueva. La opción de duplicar configuración precarga los mismos parámetros.

Las evaluaciones se conservan mientras exista el flujo. Si el flujo se elimina, se eliminan con él.

## Fuera de alcance

- Filtros avanzados en la lista de casos. Solo hay ordenamiento por puntaje.
- Exportar resultados a CSV, PDF o JSON.
- Alertas automáticas cuando un porcentaje de conversaciones baja de cierto umbral.
- Vista de trayectoria con línea de tiempo de invocaciones de herramientas.
- Selección múltiple de casos para alimentar conjuntos de prueba.

## Relacionado

- 7.4 Evaluaciones: crear y ejecutar
- 7.5 Personalidades y criterios de evaluación
- 7.3 Guía de testing
- 3.5 Escribir el prompt

---

*Fuente: FRD Evaluaciones Multi-turn HU-08, HU-09, HU-11 y HU-13 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

