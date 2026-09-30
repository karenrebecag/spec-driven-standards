---
name: research
description: Investigacion tecnica antes de la spec — documentacion oficial, implementaciones de referencia y codigo propio, en un Reference Brief citado que fija el estandar de calidad antes de tocar codigo. Autoaprueba solo lo verificable, reversible y local; lo demas escala a Karen. Invocacion manual con /research.
disable-model-invocation: true
---

# /research — el estandar antes que el codigo

Entre `/discover` (el por que) y `/spec` (el que). Esta etapa establece **como** debe hacerse:
- que dicen las fuentes oficiales, en la version que usa el proyecto;
- como lo resuelven proyectos profesionales;
- que trampas hay.

Sin esto, la spec convierte suposiciones del modelo en Markdown ordenado.

**Regla central: ninguna decision tecnica entra al plan sin procedencia identificable.** Esa
procedencia es:
- el codigo propio;
- la documentacion oficial fijada a una version;
- una implementacion de referencia fijada a un commit;
- una restriccion de Karen;
- o una hipotesis marcada como tal, con la prueba que la resuelve.

## Nivel

| Nivel | Cuando | Brief |
|---|---|---|
| omitir | Menos de 20 lineas, sin API ni framework nuevo | Nada; la spec lo declara en una linea |
| `quick` | Una API o framework nuevo en un cambio acotado | Secciones 1, 3, 9 y 11 |
| `standard` | Una feature o un refactor de varios archivos | Completo, con 1-2 referencias |
| `deep` | Arquitectura, subsistema nuevo, patron nuevo o contrato entre modulos | Completo, una investigacion por decision gris |

Si dudas entre dos niveles, elige el mayor.

## Flujo

1. **Resuelve `${CLAUDE_SKILL_DIR}` a una ruta absoluta y guardala.** Los subagentes no tienen esa
   variable.
2. **Reusa antes de investigar.** Lee `docs/research/INDEX.md` del proyecto. Si un brief cubre la
   pregunta y sus `Versiones:` coinciden con las del proyecto, usalo. Si las versiones cambiaron,
   el brief caduco: reinvestiga solo lo que depende de ellas.
3. **Lanza `researcher`** con:
   - la pregunta;
   - el nivel;
   - el discovery, si existe;
   - la ruta del proyecto;
   - la ruta absoluta del skill.

   Escribe `docs/research/<slug>.md`, que tiene que pasar el linter.
4. **Lanza `research-verifier`**, un agente separado, con:
   - la ruta del brief;
   - la ruta del proyecto;
   - la ruta del skill.

   No le pases el razonamiento del researcher. Su ultima linea es
   `RESEARCH: AUTO|ESCALATE unverified=N contradictions=N`.

   **Falla cerrado.** Solo cuenta como AUTO si la ultima linea no vacia coincide exactamente
   con `^RESEARCH: AUTO unverified=0 contradictions=0$`. Una linea ausente, duplicada, con otro
   formato o con conteos distintos de cero es ESCALATE: un verificador que se cayo no aprobo nada.
5. **Registra el veredicto en el encabezado del brief:**
   - `Estado: AUTO` o `ESCALADO`;
   - `Verificador: research-verifier YYYY-MM-DD AUTO|ESCALATE` (en `quick` sin verificador,
     `Verificador: lint YYYY-MM-DD`).
6. **Segun el veredicto:**
   - **AUTO:** sigue a `/spec`. El brief queda registrado; Karen puede vetarlo despues.
   - **ESCALATE:** para **una sola vez** con todas las decisiones agrupadas, y sigue con el
     trabajo que no depende de ellas. Cuando Karen decide, `Estado: APROBADO`.
   - **`quick`:** con el linter en verde basta, **salvo** en dos casos, donde el verificador
     pasa a ser obligatorio:
     - el cambio podria tocar algo de la lista "Escala siempre" (esa lista la aplicas tu antes
       de aprobar);
     - la seccion 9 tiene algun `ASSUMPTION`: el linter no distingue si sostiene una decision.

     Sin verificador, A4-A6 no se comprueban. Por eso `quick` es solo para una API en un cambio
     acotado: si hace falta comparar patrones o chocar con la arquitectura, el nivel es mayor.

## Autoaprobacion

Un brief se aprueba solo si se cumplen **todos** estos criterios:

| # | Criterio | Lo verifica |
|---|---|---|
| A1 | Toda afirmacion que sostiene una decision tiene marca de procedencia | linter |
| A2 | Cero `ASSUMPTION` en decisiones de carga; en detalles, solo con su `prueba:` | linter |
| A3 | Cada API o framework nuevo tiene al menos 1 fuente primaria oficial en la version instalada | linter (`Versiones:` contra el proyecto y un `[doc:]` en la seccion 3); verifier (la version de cada `[doc:]`) |
| A4 | Cada patron adoptado tiene al menos 2 referencias independientes que concuerdan; Context7 solo cuenta como secundaria | verifier |
| A5 | "Evidencia en contra" no esta vacia, y cada punto esta resuelto o aceptado | verifier |
| A6 | No contradice la arquitectura del proyecto ni `~/.claude/rules/` | verifier |
| A7 | Ninguna contradiccion entre fuentes queda sin resolver | verifier |

**Escala siempre**, aunque A1-A7 se cumplan:
- dependencia, MCP o servicio nuevo;
- config raiz, migracion, CI o deploy;
- contrato publico o entre modulos;
- seguridad o privacidad: permisos, secretos, frontera de confianza, datos de usuario;
- desviacion del estandar de la casa (se resuelve con un ADR que firma Karen);
- costo recurrente;
- nivel `deep`.

**Auditoria:** Karen revisa por muestreo los briefs aprobados solos. Cada veto que revele un
fallo del sistema se convierte en una regla nueva aqui, no en una advertencia.

Reglas que ya salieron de un fallo (piloto 2026-09-30, carga de recursos en companion-next):
- `[KAREN:<fuente>]` nombra donde lo dijo Karen; el researcher le habia atribuido herramientas
  que ella nunca menciono.
- Las URLs se verifican por defecto; el brief paso el linter con 6 links rotos.
- La seccion 2 lista los `Contextos:` de ejecucion; nadie noto que `swift test` rompia.
- El verificador comprueba que una cita `[repo:...]` diga lo que se afirma, no solo que exista.

## Linter

```bash
node "${CLAUDE_SKILL_DIR}/lint-brief.mjs" docs/research/<slug>.md --project . [--no-check-urls]
```

- La ultima linea es `LINT: PASS errors=0` o `LINT: FAIL errors=N`.
- Verifica las URLs citadas por defecto; `--no-check-urls` solo para correrlo sin red.
- Formato y marcas: `${CLAUDE_SKILL_DIR}/brief-template.md`.

## Dependencias

Los agentes `researcher` y `research-verifier` viven en el plugin `standards`. Sin ese plugin,
este skill no tiene a quien lanzar.

## Encaje

`/discover` → **`/research`** → `/spec` (cita el brief; su checklist pasa a los criterios de
aceptacion) → `/ship` (el planner lee el brief; code-reviewer marca como HIGH una divergencia de
los ejemplares que no tenga ADR) → `/release`.

## Origen del diseno

Ideas tomadas, no codigo copiado:
- **github/spec-kit** (MIT), `extensions/assess`: marcas `[source]`/`ASSUMPTION`, "Evidence
  Against" obligatoria, check contra la constitucion.
- **BMAD-METHOD**, `bmad-deep-recon`: no concluir desde el entrenamiento, cortafuegos, calidad de
  fuentes, niveles.
- **open-gsd/gsd-core** (MIT), `gsd-advisor-researcher`: una decision gris por investigacion, tabla
  de opciones.
- **Fission-AI/OpenSpec** (MIT), `/opsx:explore`: explorar antes de proponer.
