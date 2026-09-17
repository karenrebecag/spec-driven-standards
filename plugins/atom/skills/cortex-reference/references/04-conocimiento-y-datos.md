# 4. Conocimiento y datos

## Base de conocimiento (RAG)

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** documentos cargados al Nodo Cortex que se consultan durante la conversación para responder con información propia de la empresa.
> 

## Para qué sirve

La base de conocimiento permite que el nodo responda preguntas basadas en documentación propia sin que esa información esté en el prompt.

El mecanismo es RAG, generación aumentada por recuperación: el sistema divide cada documento en fragmentos, busca los relevantes según la pregunta del cliente y los inyecta en el contexto antes de que el LLM responda.

> 💡
> La base de conocimiento sirve para información que **no cambia seguido**: catálogos, manuales, reglamentos, fichas técnicas, preguntas frecuentes. Para datos que cambian —stock, precios, disponibilidad— corresponde una tabla dinámica. Ver 4.2.

## Dónde se configura

**Canvas → Nodo Cortex → panel derecho → tab Base de Conocimiento.**

## Cargar y adjuntar archivos

**Formatos soportados:** `.pdf`, `.txt`, `.md`, `.doc`, `.docx`

Los archivos se suben desde el tab. La lista muestra nombre, tamaño y fecha, y se puede buscar por nombre.

Cada archivo se adjunta o desadjunta individualmente por nodo. Un mismo documento puede estar adjunto a varios nodos del flujo.

### Sincronización con Atom

La sincronización con el gestor de recursos de Atom es bidireccional:

- Un archivo cargado desde Cortex aparece automáticamente en el gestor de recursos.
- Un archivo que ya existe en el gestor se puede adjuntar sin volver a subirlo.

## Ver y descargar archivos

| Acción | Cómo | Detalle |
| --- | --- | --- |
| Vista previa | Ícono de ojo en la fila del archivo | Abre un visor inline sin salir de Cortex |
| Descargar | Ícono de descarga en la fila del archivo | Descarga el archivo original, sin transformaciones |

La vista previa soporta PDF con el visor nativo del navegador, DOCX renderizado como HTML —puede perder formato complejo— y XLSX como tabla con selector de hojas. Los formatos no soportados muestran un mensaje que sugiere descargar el archivo.

Cada descarga queda registrada con quién la hizo y cuándo.

## Qué pasa en runtime

Cuando el cliente hace una pregunta, el sistema busca los fragmentos relevantes en los documentos adjuntos al nodo y los agrega al contexto antes de que el LLM genere la respuesta.

**Recuperación inteligente.** El sistema omite la búsqueda para saludos, charla informal y confirmaciones. No tiene sentido consultar el reglamento académico para responder "hola".

## Log de consultas

Cada vez que el nodo consulta la base de conocimiento, queda registrado qué se buscó y qué se recuperó.

| Dato | Para qué sirve |
| --- | --- |
| Fragmentos recuperados | Ver exactamente qué texto se le pasó al LLM |
| Documento de origen de cada fragmento | Identificar de dónde salió la respuesta |
| Score de similitud | Medir qué tan pertinente era cada fragmento |
| Cuáles llegaron a la respuesta | Distinguir lo recuperado de lo efectivamente usado |

En la vista de detalle de la conversación, los turnos donde se consultó la base muestran un badge. Al expandirlos se ve la lista de fragmentos con su documento, score y preview del texto, y un botón para abrir el documento en el fragmento relevante.

> 💡
> Este log sirve para detectar dos problemas difíciles de ver de otra forma: cuando el nodo respondió bien sin consultar la base —usando conocimiento general del modelo, que puede estar desactualizado— y cuando respondió mal porque el fragmento correcto no se recuperó.

El registro es asíncrono y no bloquea la respuesta al cliente. Se persiste en BigQuery, lo que permite consultas agregadas: qué documentos se consultan más, cuál es el score promedio por documento, o si hay preguntas de clientes donde ningún fragmento supera un umbral razonable de similitud, señal de que falta información en la base.

## Fuera de alcance

- Descarga masiva de todos los archivos en un ZIP.
- Edición de archivos desde la vista previa.
- Vista previa de archivos protegidos con contraseña.
- Ajuste automático del chunking a partir del log de consultas.

## Relacionado

- 4.2 Tablas dinámicas
- 3.2 El Nodo Cortex y su panel de configuración
- 6.3 Multimedia y features de canal
- 10.1 Diseñar el flujo antes de construirlo

---

*Fuente: FRD base HU-08 · FRD Parte 6 HU-09, HU-10 y HU-12 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Tablas dinámicas: configuración, búsqueda y cuándo usarlas vs KB

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** fuentes de datos estructurados conectadas a una API o a Google Sheets, que el Nodo Cortex consulta en tiempo real durante la conversación.
> 

## Cuándo usar una tabla dinámica y cuándo la base de conocimiento

Es la primera decisión, y elegir mal tiene consecuencias concretas.

|  | Base de conocimiento | Tabla dinámica |
| --- | --- | --- |
| Tipo de información | No estructurada: texto, documentos | Estructurada: filas y columnas |
| Frecuencia de cambio | Baja | Alta |
| Ejemplos | Catálogos descriptivos, manuales, reglamentos, fichas técnicas, preguntas frecuentes | Stock, precios, disponibilidad de turnos, saldos |
| Cómo se consulta | Búsqueda semántica sobre fragmentos | Consulta a la fuente en cada turno |
| Frescura del dato | La del documento cargado | La del momento de la consulta |

Los dos errores más frecuentes:

- **Cargar un catálogo con precios como PDF** cuando los precios cambian todos los meses. El cliente recibe información desactualizada y nadie se entera hasta que reclama.
- **Usar una tabla dinámica para un manual técnico** que no cambió en dos años. Agrega latencia en cada turno sin ningún beneficio.

## Dónde se configura

Las tablas dinámicas se crean en el **gestor de recursos de Atom**, no en Cortex. Desde Cortex se seleccionan y se adjuntan.

**Canvas → Nodo Cortex → panel derecho → tab Base de Conocimiento → selector de tabla dinámica.**

La disponibilidad es bidireccional: una tabla creada en Atom aparece automáticamente en Cortex.

## Tipos de fuente

| Tipo | Qué se configura |
| --- | --- |
| API REST | URL, método y autenticación |
| Google Sheets | URL del sheet |

Los datos se obtienen frescos en cada consulta. No hay caché intermedia.

## Qué puede hacer el nodo

El nodo consulta la tabla durante la conversación para responder preguntas del cliente: *"¿está disponible el producto X?"*, *"¿cuánto cuesta Y?"*.

También puede cruzar la información de la tabla con los campos ya capturados en la conversación, para dar respuestas personalizadas.

## Configuración avanzada: el prompt de búsqueda

Cuando el comportamiento de búsqueda por defecto no alcanza, se puede escribir en lenguaje natural cómo debe buscar el nodo dentro de esa tabla.

Casos típicos: priorizar productos con stock disponible, filtrar precios por la moneda del cliente, devolver primero los productos en oferta, o restringir los resultados a ciertas columnas.

### Dónde está

Al seleccionar una tabla, debajo del selector aparece un desplegable **Configuración avanzada**, colapsado por defecto. Su estado se recuerda por usuario y por nodo.

Si el prompt fue modificado respecto del que hereda de la tabla, el header muestra un indicador de modificado.

### Qué contiene

| Elemento | Descripción |
| --- | --- |
| Información de la tabla | Columnas disponibles con su tipo de dato, en solo lectura. Se extraen automáticamente al adjuntar la tabla. |
| Prompt de búsqueda | Campo de texto multilínea, mínimo 6 líneas visibles, expandible. Máximo 2000 caracteres. |
| Helper de columnas | Al escribir `[` se despliega la lista de columnas de la tabla. Al seleccionar una, se inserta con su nombre exacto. |
| Restablecer al default | Vuelve al prompt original de la tabla, descartando las modificaciones. |

### Cómo se hereda

El prompt por defecto se define **a nivel de la tabla**, en el gestor de recursos de Atom. Cada vez que la tabla se adjunta a un nodo, ese prompt aparece precargado.

- Si el builder no toca nada, el nodo sigue usando el default heredado. Si el default cambia a futuro, el nodo hereda la versión nueva.
- Si el builder lo edita, el prompt custom queda asociado a esa combinación de nodo y tabla. Un cambio posterior en el default no lo sobrescribe.
- Si la misma tabla se adjunta a varios nodos, cada uno parte del mismo default pero puede tener sus propias modificaciones.

**Permisos:** ver la configuración avanzada corresponde a cualquier usuario con acceso al flujo. Editar y restablecer, a editores.

## Qué pasa en runtime

Cuando el nodo decide consultar la tabla:

1. El sistema envía a un modelo de texto a SQL el esquema de la tabla, el prompt de búsqueda configurado, la consulta del cliente y las variables de contexto.
2. El modelo genera una consulta SQL.
3. La consulta se ejecuta sobre la tabla, vía API REST o Google Sheets según el tipo de fuente.
4. Los resultados vuelven al nodo como contexto para responder.

## Ver el SQL generado

La traducción a SQL es automática, pero no opaca. Tanto en el simulador como en la trazabilidad de conversaciones reales se puede ver la consulta exacta que se ejecutó.

| Elemento | Dónde |
| --- | --- |
| Instrucción original en lenguaje natural | Panel de trazas |
| SQL generado | Panel de trazas, colapsable |
| Resultado devuelto | Filas, columnas y cantidad |
| Parámetros dinámicos usados | Los valores capturados en la conversación que entraron a la consulta |
| Latencia y estado | Panel de trazas |

Dos botones acompañan al SQL: **Copiar SQL**, para pegarlo en un cliente de base de datos y probarlo, y **Explicar SQL**, que describe en lenguaje natural qué hace la consulta.

> 💡
> Este es el camino para debuggear una tabla dinámica que devuelve resultados inesperados. Ver el SQL suele mostrar que falta un filtro en el prompt de búsqueda, no que la tabla esté mal.

Los valores dinámicos que son datos sensibles se muestran enmascarados, y el SQL que se persiste en BigQuery no incluye datos personales en claro.

## Fuera de alcance

- Botón de probar la búsqueda con resultado en pantalla.
- Edición manual del SQL generado.
- Optimización automática de la consulta.
- Caché de resultados.
- Uniones entre múltiples tablas dinámicas.

## Relacionado

- 4.1 Base de conocimiento (RAG)
- 4.3 Campos de guardado
- 3.2 El Nodo Cortex y su panel de configuración
- 7.1 El simulador

---

*Fuente: FRD base HU-10 · FRD Parte 3 HU-12 · FRD Parte 6 HU-14 · Buenas prácticas §10 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Campos de guardado

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** los datos estructurados que el Nodo Cortex captura del cliente durante la conversación, como un formulario conversacional.
> 

## Para qué sirven

Un campo de guardado define qué información hay que obtener del cliente y cómo obtenerla. Ejemplos: nombre, correo electrónico, número de pedido, producto de interés, presupuesto.

Los campos capturados quedan disponibles para:

- Referenciarlos en el prompt del nodo, escribiendo `/`.
- Usarlos como variables en herramientas: URL, headers y body de un HTTP Request, o parámetros de un Code Tool.
- Pasarlos a los nodos siguientes de Flowbuilder.
- Persistirlos en BigQuery para reportería.

## Dónde se configuran

Los campos se pueden crear desde dos lugares, y son el mismo objeto en ambos.

| Lugar | Ruta |
| --- | --- |
| Desde el nodo | **Canvas → Nodo Cortex → panel derecho → Guardado de Campos** |
| Desde la configuración del flujo | **Canvas → Configuración Global → sección Campos → + Crear campo nuevo** |

> 💡
> La fuente de verdad es única. Un campo es un solo objeto, no dos copias sincronizadas: cualquier edición hecha en un lugar se refleja en el otro en tiempo real. Lo que sí es independiente es la asignación — eliminar un campo de un nodo no lo elimina de la Configuración Global, ni al revés.

## Tipos de captura

El tipo define cómo debe obtener el nodo la información. Es la decisión más importante al crear un campo.

| Tipo | Comportamiento del nodo | Cuándo usarlo |
| --- | --- | --- |
| **Obligatorio** | Pregunta explícitamente y no avanza sin obtenerlo | Datos que bloquean el proceso, como el correo si hay que enviar algo |
| **Captura posterior** | No pregunta. Solo lo registra si el cliente lo menciona espontáneamente | Datos de enriquecimiento, como producto de interés o presupuesto |

> 💡
> Cada campo obligatorio suma turnos a la conversación. Conviene reservarlos para lo que realmente bloquea el avance y dejar el resto en captura posterior: el nodo los registra igual si aparecen, sin costo conversacional.

## Cómo se crea un campo

1. Abrir el lugar que corresponda: el panel del nodo o la Configuración Global.
2. Agregar un campo nuevo.
3. Completar los datos.
4. Guardar.

### Campos del formulario

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Etiqueta | Sí | Nombre del campo, por ejemplo "Correo electrónico". Único dentro del flujo. |
| Descripción | Sí | Cómo identificar o validar el dato. Es lo que le permite al nodo reconocerlo correctamente. |
| Tipo de captura | Sí | Obligatorio, Opcional o Captura posterior. |

Los campos se pueden eliminar individualmente. Si el nodo tiene más de diez configurados, la lista muestra los primeros diez con un botón para expandir el resto.

## Sincronización con Atom

Los campos de información definidos a nivel empresa en Atom aparecen automáticamente disponibles en Cortex para asignarlos a los nodos.

A la inversa, los campos creados en Cortex se sincronizan con Atom y quedan disponibles en el sistema central de la empresa.

Los campos heredados de Atom son de solo lectura en su estructura. Lo único que se puede ajustar por nodo es el tipo de captura.

## Usar campos en el prompt

Al escribir `/` dentro del campo de instrucciones se despliega la lista de campos configurados. El desplegable es filtrable: al seguir escribiendo, la lista se reduce.

Al seleccionar uno, se inserta como referencia, por ejemplo `/[Correo electrónico]`. En runtime la referencia se resuelve con el valor capturado.

> 💡
> Para los campos obligatorios, el prompt es donde se define **en qué momento** de la conversación el nodo debe pedirlos. Sin esa instrucción, el nodo elige por su cuenta y suele preguntar antes de tiempo.

## Qué pasa en runtime

Las definiciones de los campos se incluyen en el prompt del nodo como instrucciones estructuradas, diferenciando el comportamiento según el tipo de captura.

- Los **obligatorios** generan validación: el nodo insiste hasta obtener la información, respetando el momento configurado en el prompt.
- Los de **captura posterior** no generan preguntas. Solo registran si el dato aparece.

Los campos capturados quedan disponibles para los turnos siguientes y para los nodos posteriores del flujo, sin que el cliente tenga que repetir nada.

## Validaciones

- El nombre debe ser único dentro del flujo, sea el campo creado en Atom o local.
- No se permite crear un campo con el mismo nombre que uno ya asignado.

## Fuera de alcance

- Reasignar el origen de un campo, de local del flujo a global de empresa o al revés.
- Editar la estructura de campos heredados de Atom desde Cortex.

## Relacionado

- 3.5 Escribir el prompt
- 2.1 El panel de Configuración Global
- 5.2 HTTP Request y Code Tool
- 4.2 Tablas dinámicas

---

*Fuente: FRD base HU-09 · FRD Parte 4 HU-05 · Buenas prácticas §11 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

