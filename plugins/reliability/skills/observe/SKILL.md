---
name: observe
description: Define la instrumentación y las consultas operativas — eventos de producto, métricas técnicas, logs estructurados y trazas. Invocación manual con /observe.
disable-model-invocation: true
---

# /observe — instrumentar antes de necesitarlo

Define qué se mide y cómo se consulta, para que cuando algo falle la respuesta sea un query, no una
adivinanza. Alimenta `/production-readiness` y `/incident`.

## Las cuatro capas

1. **Eventos de producto** — qué hace el usuario (signup, checkout, activación). Responden "¿la
   funcionalidad cumple su propósito?".
2. **Métricas técnicas** — latencia, error rate, throughput, saturación (los cuatro golden signals).
3. **Logs estructurados** — JSON con contexto (request id, user id, ruta), no `console.log` suelto.
   Los caminos de error primero.
4. **Trazas** — el recorrido de una request entre servicios, para ubicar dónde se va el tiempo.

## Proceso

1. Para el cambio en cuestión: nombra el evento/métrica/log/traza que hace falta y **la pregunta
   operativa que responde**. Si una instrumentación no responde una pregunta real, no la agregues.
2. Escribe las consultas base: la que muestra salud, la que muestra el fallo más probable.
3. Apóyate en el agente `sre-engineer` para SLO/alertas y en `monitoring-setup` para la config.
4. Entrega: qué instrumentar, dónde, y las queries para leerlo.

## Boundary
Diseña la instrumentación; implementarla pasa por `/ship`. Cambios en dashboards/alertas de infra
van por PR, en modo lectura por defecto.
