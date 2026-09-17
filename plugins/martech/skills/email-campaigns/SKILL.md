---
name: email-campaigns
description: >-
  Operar el pipeline de campañas de correo de ATFX (CampaignSender): subir/importar
  nuevas listas de leads, crear y PROGRAMAR envíos, escribir plantillas, gestionar
  bajas (unsubscribe), y consultar el estado. El estado vive en Supabase (Postgres),
  el envío es por Microsoft Graph como cs.latam@ (Send As de Felipe), y un dispatcher
  en un VPS de Azure dispara las campañas programadas. Cargar esta skill cuando el
  usuario quiera enviar una campaña nueva, importar contactos/leads, programar un
  correo para después, agregar una plantilla, revisar destinatarios/estado, o
  entender/depurar el pipeline de emails. Español.
metadata:
  project: CampaignSender
  repo: github.com/karenrebecag/CampaignSender
---

# Pipeline de campañas de correo — ATFX

Operas **CampaignSender**: importar leads → cola en Postgres → envío paceado por
Graph como `cs.latam@` → programación automática. Reemplazó el flujo de Power
Automate + SharePoint.

> **Antes de tocar nada, lee el estado real.** No asumas: consulta Supabase con
> el MCP `supabase` (proyecto `yfflfkbcydskruujcurw`) y el proyecto local en
> `~/Desktop/SoftwareDevProjects/CampaignSender`. Los detalles de conexión,
> esquema y recetas están en `references/`.

## Piezas y dónde viven

| Pieza | Dónde |
|---|---|
| Estado (audiencia, campañas, log, bajas) | Supabase Postgres `yfflfkbcydskruujcurw` |
| Código (import, runner, dispatcher, envío) | `~/Desktop/SoftwareDevProjects/CampaignSender` |
| Orquestador agéntico | `~/Desktop/SoftwareDevProjects/Email_Campaigns` |
| Envío en producción | VPS Azure `atfxmcp.westus2.cloudapp.azure.com`, systemd timer |
| Endpoint de baja | Edge Function `unsubscribe` en Supabase |

## Las tareas más comunes

1. **Importar leads nuevos** → `references/playbooks.md#importar`
2. **Crear y programar una campaña** → `references/playbooks.md#programar`
3. **Escribir/actualizar una plantilla** → `references/playbooks.md#plantillas`
4. **Revisar estado / destinatarios / bajas** → `references/playbooks.md#estado`
5. **Desplegar cambios de código al VPS** → `references/connection.md#deploy`

## Reglas que no se rompen

- **Idempotencia en la base, no en la confianza.** El índice único `citext`
  sobre `contacts.email` y `send_log_sent_once` hacen imposible el doble envío.
  Reimportar es seguro (upsert). Nunca borres contactos para "resubir" — se
  acumulan.
- **Suppression y bajas se respetan solas.** La query de pendientes ya excluye
  `suppression_list` (global) y `campaign_unsubscribes` (por campaña). No hay que
  filtrar a mano.
- **El envío está aislado en `src/send.ts`.** Cambiar de proveedor (Graph → ESP
  para volumen alto) se hace SOLO ahí.
- **Las fuentes de datos son adaptadores** (`src/import/`). Hoy CSV; el día que
  Salesforce habilite el API, un `salesforce-adapter` produce el mismo
  `NormalizedLead[]` y el resto no se toca.

## Límites reales (Exchange, no de la arquitectura)

~9.000 correos/día (colchón bajo los 10k), 25/min. El runner respeta el ritmo por
minuto pero NO el tope diario: campañas de >9.000 se reparten en días. Antes de
volumen alto, hacer una rampa (200-300) para confirmar a qué buzón se atribuye el
límite diario (Felipe vs cs.latam@ — sin verificar).

## Compromisos conocidos

- Baja **por campaña** (decisión del usuario; el estándar de cumplimiento es
  global — fácil de cambiar si Marketing lo pide).
- Unsubscribe **Nivel 1** (link + header `List-Unsubscribe`). El one-click nativo
  de Gmail (Nivel 2, RFC 8058) necesita envío MIME — pendiente.
- **Rotar el password de la DB** — pasó por un chat una vez.

Ver `references/schema.md` (modelo de datos), `references/connection.md`
(conexiones y secretos), `references/playbooks.md` (recetas paso a paso).
