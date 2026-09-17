# 5. Herramientas e integraciones

## Aplicaciones externas con autenticación

> Estado en el manual original: **En revisión** · Tipo: Cómo se hace

> **En una línea:** servicios de terceros conectados por OAuth —Slack, Gmail, Google Calendar, HubSpot y más de cien toolkits— cuyas acciones el Nodo Cortex puede ejecutar sin gestionar claves de API.
> 

## Para qué sirve

Permite que el nodo haga cosas fuera de la conversación: crear un evento en un calendario, abrir un ticket, notificar a un canal, cargar un contacto en el CRM.

La ventaja frente a un HTTP Request es que la autenticación la resuelve la plataforma. No hay que gestionar tokens ni renovaciones.

## Dónde se configura

**Canvas → Nodo Cortex → panel derecho → tab Herramientas.**

## Cómo se conecta una aplicación

El proceso tiene tres pasos.

### 1. Seleccionar la aplicación

Se abre el modal de exploración, con más de cien toolkits disponibles. Se pueden buscar por nombre.

### 2. Conectar y verificar

El sistema verifica si la aplicación ya está conectada a la cuenta.

Si no lo está, se inicia el flujo de OAuth en una pestaña nueva del navegador. Al volver, el botón **Verificar de nuevo** vuelve a comprobar el estado de la conexión.

### 3. Seleccionar las acciones

Una vez conectada, se exploran todas las acciones disponibles de esa aplicación. Se pueden buscar por nombre o descripción, y seleccionar varias antes de agregarlas al nodo.

## Herramientas adjuntas

Cada herramienta adjunta se muestra con su nombre, descripción, aplicación de origen e identificador de la acción. Se pueden eliminar individualmente del nodo.

## Referenciar herramientas en el prompt

Al escribir `@` dentro del campo de instrucciones se despliega la lista de herramientas conectadas al nodo. El desplegable es filtrable.

Al seleccionar una, se inserta una referencia formateada, por ejemplo `@[Send Message - Slack]`. En runtime la referencia se resuelve como una instrucción vinculada a esa herramienta.

## Escribir buenas descripciones

La descripción de la herramienta es lo que lee el LLM para decidir cuándo usarla. Es el factor que más determina si el nodo la invoca en el momento correcto.

Una descripción completa cubre tres cosas:

1. **Qué hace** la herramienta, en una o dos oraciones.
2. **Cuándo usarla** — las situaciones del cliente que la disparan.
3. **Cuándo no usarla**, si hay riesgo de confusión con otra herramienta parecida.

| Conviene | Conviene evitar |
| --- | --- |
| "Consulta el stock de un vehículo específico en el CRM. Usar cuando el cliente pregunta si hay disponibilidad de un modelo puntual. No usar para preguntas generales sobre el catálogo." | "Consulta el sistema." |

### El esquema técnico va en el prompt

Además de la descripción, conviene detallar en el prompt del nodo qué entrada espera la herramienta y qué devuelve, con ejemplos concretos de cada parámetro.

Los modelos interpretan mejor un ejemplo que una explicación abstracta. Un parámetro documentado como `*attendees` (array de strings): correos de los asistentes. Ej: `["cliente@empresa.com"]`* evita el error clásico de pasar un objeto donde se espera un string.

También conviene enumerar los errores esperados y qué debe hacer el nodo ante cada uno. Por ejemplo: si falla la creación del evento, no comunicar el error al cliente, dejar nota interna y derivar a un asesor.

> 💡
> La división es la siguiente: la **descripción de la herramienta** dice qué hace y cuándo usarla; el **prompt del nodo** dice en qué momento del flujo de conversación invocarla, usando `@[nombre]`.
>
> Como queda el prompt de ejemplo para enviar un mensaje en slack:
>
>
>
> Como aparece el mensaje en el canal de slack mencionado en el prompt:

## Fuera de alcance

- Desvincular cuentas después de completado el OAuth.

## Relacionado

- 5.2 HTTP Request y Code Tool
- 5.3 MCP Servers
- 3.5 Escribir el prompt
- 7.1 El simulador

---

*Fuente: FRD base HU-11 · Buenas prácticas §12 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## HTTP Request y Code Tool

> Estado en el manual original: **En revisión** · Tipo: Cómo se hace

> **En una línea:** las dos formas de integrar lógica propia. HTTP Request llama a una API externa; Code Tool ejecuta un script en el entorno de Atom. Las dos pueden usar campos de la conversación como entrada y guardar la respuesta como campos.
> 

## Cuál usar

| HTTP Request | Code Tool |
| --- | --- |
| Necesitas ejecutar **una llamada HTTP directa** a un endpoint. | Necesitas ejecutar **varias llamadas HTTP** dentro de una misma ejecución. |
| El endpoint ya recibe los datos en el formato esperado y devuelve la información necesaria. | Necesitas **transformar, combinar o preparar datos** antes o después de llamar a una API. |
| La operación puede resolverse con un `GET`, `POST`, `PATCH`, `PUT`, etc. sin lógica adicional relevante. | Necesitas **condicionales, cálculos, filtros, validaciones o lógica programática**. |
| Solo necesitas mapear datos del agente hacia el request y utilizar la respuesta. | La siguiente llamada depende del resultado de una llamada anterior. |
| Ej.: consultar un contacto, crear un ticket, actualizar un registro, consultar stock. | Ej.: buscar contacto → decidir si crear o actualizar → crear negocio → asociarlo → guardar IDs. |

### Cuatro preguntas para decidir

1. ¿La operación se resuelve con una sola llamada a un endpoint?
**Sí → HTTP Request.**
2. ¿Necesitas ejecutar varias llamadas y utilizar la respuesta de una para construir la siguiente?
**Sí → Code Tool.**
3. ¿Necesitas transformar, combinar, validar o calcular información durante la ejecución?
**Sí → Code Tool.**
4. ¿Solo necesitas enviar parámetros a una API y utilizar su respuesta?
**Sí → HTTP Request.**

**Regla práctica:** usa HTTP Request para integraciones directas y Code Tool cuando necesites construir una pequeña lógica de integración alrededor de una o varias APIs.

## HTTP Request

### Dónde se configura

**Canvas → Nodo Cortex → panel derecho → tab Herramientas → HTTP Request.**

### Qué se configura

| Campo | Descripción |
| --- | --- |
| Método | GET, POST, PUT, PATCH, DELETE |
| URL | Admite parámetros de ruta y de query dinámicos |
| Headers | Clave y valor, ambos admiten variables |
| Query params | Clave y valor, ambos admiten variables |
| Body | JSON, admite variables |

### Usar campos como variables

En cualquiera de esos campos, al escribir “:” se despliega la lista de campos de guardado del nodo. El desplegable es filtrable.

Las variables se pueden usar solas o concatenadas con texto fijo:

```
https://api.crm.com/customers//[ID Cliente]/vehicles?year=/[Año Preferido]
```

Los valores se codifican automáticamente para URL: los espacios pasan a `%20`.

También se admiten variables de entorno con `{{VARIABLE}}`, típicamente para tokens y URLs base.

> 💡
> Si una variable referenciada no tiene valor al momento de ejecutar, la petición no se ejecuta y el nodo pide el dato faltante al cliente antes de continuar.

### Vista previa

Antes de probar, la vista previa muestra cómo queda la URL y el body con valores de ejemplo. Sirve para verificar la construcción sin ejecutar nada.

### Guardar la respuesta

En la configuración avanzada está la sección **¿Cómo guardar las respuestas?**

1. El botón **Probar API desde aquí** ejecuta la petición con valores de ejemplo y muestra la respuesta completa.
2. Click sobre cualquier valor del JSON de respuesta abre el formulario de mapeo.
3. Por cada valor a guardar se configura:

| Campo | Descripción |
| --- | --- |
| Nombre de variable | Identificador interno del mapeo, para reconocerlo en la configuración |
| Valor a guardar | Ruta dentro del JSON de respuesta, por ejemplo `data.user.firstName`. Obligatorio. |
| Seleccionar campo | El campo de guardado donde se persiste. Incluye la opción de crear un campo nuevo sin salir del editor. |

Se pueden configurar varios mapeos por petición. Cada uno se puede colapsar o eliminar individualmente, y el resumen de la herramienta muestra cuántas variables se están guardando.

### Ejemplo

El nodo capturó el correo del cliente. Se configura una petición a:

```
?email=https://crm.empresa.com/api/contacts/[Email del cliente]
```

que devuelve `{ "id": "12345", "tier": "premium", "vehicles": 2 }`.

Se configuran tres mapeos: `id` al campo ID Cliente, `tier` al campo Tier del Cliente, y `vehicles` al campo Vehículos previos.

En los turnos siguientes, el prompt puede usar `/[Tier del Cliente]` para personalizar: *"Como cliente premium, te ofrecemos…"*.

### Manejo de errores

Los errores de red y las respuestas con códigos 4xx y 5xx se manejan con mensajes configurables. Cada llamada queda registrada en los logs con la petición, la respuesta y el tiempo de ejecución.

## Code Tool

### Qué es

Un script JavaScript que se ejecuta en un entorno aislado dentro de Atom. No requiere autenticación ni whitelisting de IP, y la latencia es mínima porque no sale a la red.

El editor incluye resaltado de sintaxis.

Un script JavaScript que se ejecuta dentro del entorno de Cortex. Permite realizar cálculos, validaciones, transformaciones de datos, aplicar lógica condicional y ejecutar llamadas HTTP a servicios externos mediante `http()`.

Es especialmente útil cuando una operación requiere lógica adicional que no resulta conveniente resolver únicamente con un HTTP Request.

El editor incluye resaltado de sintaxis.

### Parámetros de entrada

La sección **Parámetros de entrada** define la firma del script. Por cada parámetro:

| Campo | Descripción |
| --- | --- |
| Nombre del parámetro | El identificador con el que se accede dentro del script |
| Origen del valor | **Campo de información** — se elige cuál de los campos del nodo se pasa. **Valor fijo** — se ingresa un literal. |

Además del mapeo formal, dentro del cuerpo del script se puede escribir `/` para insertar una referencia a un campo, que se resuelve antes de ejecutar. Sirve para usos puntuales sin declarar un parámetro.

### Estructura de salida

En la sección **Estructura de salida** se declara qué devuelve el script, como un objeto JSON con claves y tipos:

```json
{ "resultado": "string", "monto_calculado": "number", "es_valido": "boolean" }
```

Esta declaración cumple dos funciones: le permite al LLM entender qué devuelve el script, y habilita el guardado de respuestas.

### Guardar el resultado

Funciona igual que en HTTP Request. El botón **Probar script desde aquí** ejecuta con valores de ejemplo, y desde el JSON de retorno se mapea cada propiedad a un campo de guardado.

### Descripción de ejecución

El Code Tool lleva una descripción que le indica al nodo cuándo ejecutarlo. Sin ella, el LLM no sabe en qué momento invocarlo.

### Ejemplo

El nodo capturó Precio del vehículo y Plazo en meses. El Code Tool recibe ambos como parámetros y devuelve:

```json
{ "cuota_mensual": 850.50, "interes_total": 2406.00, "tasa_aplicada": 0.18 }
```

Se mapean los tres a campos del nodo, y el prompt puede responder: *"Tu cuota mensual sería de $/[Cuota Mensual Calculada] con una tasa del /[Tasa Aplicada]%."*

### Manejo de errores

- Si la ruta del retorno no existe, el campo queda vacío, se genera un log y la conversación continúa.
- Si el script falla por excepción, timeout o error de sintaxis, se marca como error de herramienta y se dispara el manejo configurado.
- Los errores de ejecución se capturan y registran sin romper el flujo.

> 💡
> Un Code Tool no debería contener credenciales escritas en el código. Si necesita llamar a un servicio externo, esa parte corresponde a un HTTP Request separado, donde las credenciales viven en variables de entorno cifradas.

## Dónde quedan disponibles los campos guardados

Los campos que escriben estas herramientas quedan inmediatamente disponibles para:

- Referenciarlos con `/` en turnos siguientes del mismo nodo.
- Usarlos en otras peticiones HTTP o Code Tools del mismo flujo.
- Pasarlos a los nodos siguientes de Flowbuilder.

## Fuera de alcance

- Sintaxis de variables distinta a `/[Campo]`.
- Transformaciones en línea sobre el valor, del tipo `/[Email].toLowerCase()`. Si hace falta transformar, corresponde un Code Tool.
- Mapeo automático de toda la respuesta a campos. Hay que declarar explícitamente qué guardar.
- Persistir estructuras complejas —arrays anidados, objetos profundos— en un solo campo.

## Relacionado

- 4.3 Campos de guardado
- 5.1 Aplicaciones externas con autenticación
- 5.4 Variables de entorno y conexiones de autenticación
- 7.1 El simulador

---

*Fuente: FRD base HU-12 · FRD Parte 2 HU-2 · FRD HTTP Request y Code Tool HU-01 y HU-02 · FRD Parte 6 HU-13 · Buenas prácticas · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## MCP Servers

> Estado en el manual original: **Borrador** · Tipo: Cómo se hace

> **En una línea:** conexión a un servidor MCP propio o de terceros, que expone un conjunto de herramientas que el Nodo Cortex puede invocar durante la conversación.
> 

## Para qué sirve

Un MCP Server permite sumar capacidades que no están en el catálogo nativo de Cortex. Cualquier empresa con un servidor MCP —propio o de un proveedor— puede conectarlo por su cuenta, sin desarrollo del lado de Atom.

La diferencia con un HTTP Request es el nivel de control. En un HTTP Request se configura una llamada específica: método, URL, body. En un MCP Server se conecta una interfaz completa, y el LLM decide qué herramienta invocar y con qué argumentos según el contexto de la conversación.

## Dónde se configura

**Canvas → Nodo Cortex → panel de Integraciones → MCP Server.**

Aparece junto a las integraciones nativas. Al hacer click se abre el modal de configuración.

## Cómo se configura

### Información básica

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| Nombre | Sí | Entre 3 y 60 caracteres, único dentro del nodo |
| Descripción | No | Hasta 500 caracteres. Le ayuda al LLM a entender para qué sirve el servidor. |

### Transporte y URL

| Campo | Opciones |
| --- | --- |
| Tipo de transporte | **SSE** (Server-Sent Events), por defecto, o **Streamable HTTP** |
| URL del servidor | Valor de texto libre, o una variable de entorno del workspace |

**La URL debe usar HTTPS.** Si se ingresa una URL HTTP, aparece el error correspondiente y no se puede guardar.

### Autenticación

El campo de autenticación lista las conexiones disponibles del workspace. Es opcional: se puede guardar y probar el servidor sin seleccionar ninguna.

Si el workspace todavía no tiene conexiones, el selector aparece deshabilitado con un aviso, y un enlace inline permite crear una sin salir del modal.

### Headers HTTP

Sección colapsable para agregar headers personalizados, de configuración o de autenticación adicional.

Por cada header se define el tipo —valor literal o variable de entorno—, el nombre y el valor. Límite recomendado: 20 headers por servidor.

## Probar la conexión y elegir herramientas

El botón **Probar conexión** se habilita cuando están completos los campos obligatorios. Ejecuta un handshake contra el servidor.

| Resultado | Qué muestra |
| --- | --- |
| Éxito | Estado conectado y la lista de herramientas que expone el servidor, con nombre y descripción de cada una |
| Error | Mensaje según el código —timeout, no autorizado, no encontrado, certificado inválido— con una sugerencia accionable |

Con la conexión establecida se avanza al paso de selección: se buscan las herramientas por nombre o descripción y se marcan con checkbox las que se quieren sumar. El botón de confirmar se habilita al seleccionar al menos una.

Cada herramienta seleccionada se suma como un ítem individual en el panel de Integraciones.

> 💡
> Si la prueba de conexión falló o no se hizo, el servidor se guarda igual pero queda en estado sin probar.

## Gestión de servidores conectados

El panel de Integraciones muestra los MCP Servers en una sección propia, con nombre, estado, cantidad de herramientas expuestas y cuándo se probó la conexión por última vez.

Los estados posibles son **Conectado**, **Error** y **Deshabilitado**.

| Acción | Qué hace |
| --- | --- |
| Editar | Abre el modal con los valores precargados |
| Probar conexión | Repite el handshake y actualiza el estado |
| Duplicar | Crea una copia con sufijo en el nombre |
| Habilitar / Deshabilitar | Evita que el nodo invoque sus herramientas, sin borrar la configuración |
| Eliminar | Con confirmación. No se puede deshacer. |

## Qué pasa en runtime

Cuando un servidor está conectado y habilitado, sus herramientas quedan disponibles para que el LLM las invoque durante la conversación, igual que las nativas.

Los argumentos se resuelven a partir del contexto, incluyendo los campos ya capturados. Las herramientas de un servidor deshabilitado no aparecen en el conjunto disponible, aunque la configuración siga guardada.

### Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| El servidor no responde en 15 segundos | La invocación se marca como error y el nodo continúa con un fallback razonable |
| Error de autenticación | Se registra el evento |
| Error de la herramienta, por parámetros inválidos | El LLM puede reintentar con argumentos corregidos o degradar a una respuesta neutra |
| Más de 10 errores en 5 minutos | Se activa un cortacircuitos que pausa temporalmente las invocaciones y notifica al admin |

### Trazabilidad

Cada invocación queda registrada con el servidor, la herramienta, los argumentos enviados —con los valores sensibles enmascarados—, la respuesta, la latencia y el estado.

El admin del workspace puede ver métricas agregadas por servidor: tasa de éxito, latencia promedio y volumen.

### Seguridad

Los headers y las conexiones de autenticación con valores sensibles se cifran en base de datos. Los valores nunca se registran en logs ni se exponen en trazabilidad en claro, y en la interfaz se muestran enmascarados después de guardar.

## Validaciones del flujo

- Si un MCP Server referencia una variable de entorno que no existe o fue eliminada, la validación del flujo marca el error.
- Si la conexión de autenticación referenciada fue eliminada, también se marca.

> ⚠️
> Las herramientas de un MCP Server pueden cambiar si el servidor las modifica del otro lado. Conviene probar la conexión periódicamente y revisar qué herramientas quedan expuestas después de cambios en el servidor.

## Fuera de alcance

- Marketplace de MCP Servers verificados. Todos se tratan como servidores propios no verificados.
- Servidores a nivel workspace reutilizables entre nodos. La configuración es por nodo.
- Mapear la respuesta de una herramienta MCP a campos de guardado, como sí se puede con HTTP Request. Las respuestas viven en el contexto del LLM; para persistirlas hay que usar un Code Tool o instrucciones en el prompt.
- Elegir qué herramientas del servidor exponer una vez conectado.
- Transportes distintos de SSE y Streamable HTTP.

## Relacionado

- 5.2 HTTP Request y Code Tool
- 5.4 Variables de entorno y conexiones de autenticación
- 7.1 El simulador

---

*Fuente: FRD MCP en Integraciones HU-01, HU-02 y HU-03 · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

## Variables de entorno y conexiones de autenticación

> Estado en el manual original: **Borrador** · Tipo: Referencia

> **En una línea:** valores guardados a nivel workspace —tokens, URLs base, credenciales— que se referencian desde la configuración sin escribirlos en claro ni repetirlos en cada lugar.
> 

## Para qué sirven

Dos problemas que resuelven.

**No exponer credenciales.** Un token escrito directamente en el header de un HTTP Request queda visible para cualquiera con acceso al flujo, y viaja en el JSON al exportarlo.

**No repetir configuración.** Una URL base usada en cinco herramientas distintas se cambia en un solo lugar y no en cinco.

## Variables de entorno

### Dónde se gestionan

Desde la sección **Variables de entorno** en la configuración del servidor o de la herramienta, con el enlace **Gestionar variables de entorno** que abre el modal.

### Cómo se crea una variable

| Campo | Descripción |
| --- | --- |
| Nombre | Identificador con el que se referencia |
| Tipo | El tipo de dato del valor |
| Valores por entorno | Un valor por cada entorno. Los entornos sin valor propio usan el de producción. |

> 💡
> Los valores por entorno permiten que el mismo flujo apunte a un endpoint de pruebas mientras se desarrolla y al productivo una vez publicado, sin tocar la configuración de las herramientas.

### Dónde se usan

| Lugar | Cómo se referencia |
| --- | --- |
| URL de un MCP Server | Selector de origen: valor literal o variable de entorno |
| Headers de un MCP Server | Selector de tipo por header |
| URL, headers y body de un HTTP Request | Sintaxis `{{VARIABLE}}` |
| Prompt de un nodo | Sintaxis `{{VARIABLE}}` |

> ⚠️
> No confundir las dos sintaxis. `{{VARIABLE}}` referencia una variable de entorno del workspace, con un valor fijo definido por configuración. `/[Campo]` referencia un campo de guardado, con un valor capturado durante la conversación.

## Conexiones de autenticación

Guardan la configuración de autenticación contra un servicio externo, para reutilizarla en varias integraciones.

### Cómo se crea

Desde el campo de autenticación de un MCP Server, el enlace **Crear nueva conexión de autenticación** abre el modal correspondiente.

Para una conexión de tipo OAuth2 JWT se configuran:

| Campo | Obligatorio |
| --- | --- |
| Secret Key | Sí |
| Token URL | Sí |
| Scopes | No |
| Token type | Sí |
| Algorithm | Sí |
| Key ID | No |
| Expiration | Sí |

Una vez creada, la conexión queda disponible para seleccionarse desde cualquier integración del workspace.

## Seguridad

- Los valores sensibles se cifran en base de datos.
- No se registran en logs ni se exponen en trazabilidad en claro.
- En la interfaz se muestran enmascarados después de guardar.
- No se incluyen al exportar el flujo como JSON. Al importarlo en otro workspace hay que reconectarlas.

## Validaciones del flujo

Si una integración referencia una variable de entorno o una conexión de autenticación que no existe o fue eliminada, la validación del flujo marca el error e impide compilar.

Esto suele pasar al importar un flujo desde otro workspace, donde esas variables no están definidas.

## Relacionado

- 5.2 HTTP Request y Code Tool
- 5.3 MCP Servers
- 8.2 Exportar e importar JSON
- 7.2 Validaciones antes de publicar

---

*Fuente: FRD MCP en Integraciones · transversal a las herramientas · Última revisión: 06/08/2026 · Responsable: Constanza Molina*

---

