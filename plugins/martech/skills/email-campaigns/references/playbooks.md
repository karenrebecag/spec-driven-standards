# Playbooks — recetas paso a paso

Todos desde `~/Desktop/SoftwareDevProjects/CampaignSender` con `.env` presente.
Los scripts operativos de alto nivel viven en el orquestador
`~/Desktop/SoftwareDevProjects/Email_Campaigns` (ver su README).

## <a name="importar"></a>1. Importar leads nuevos (CSV)

El CSV puede venir de Salesforce/Excel. Tolerante con los encabezados (mapea
`Email`/`Correo`, `FirstName`/`Nombre`, `LeadSource`/`utm_campaign__c`, `Id`,
`Do_Not_Email__c`/`blacklist`). Un lead con Do_Not_Email va a `suppression_list`
y NO se agrega como destinatario.

```bash
# Siempre --dry-run primero: muestra el mapeo de columnas sin escribir
pnpm import leads.csv --campaign <campaign-id> --dry-run
pnpm import leads.csv --campaign <campaign-id>
```

Reimportar el mismo archivo es seguro (upsert, sin duplicar). Los contactos se
ACUMULAN entre campañas; nunca borrar para resubir.

## <a name="programar"></a>2. Crear y programar una campaña

Programar = crear la campaña con `status='scheduled'` y `scheduled_at`, e importar
sus destinatarios. El dispatcher del VPS la dispara sola a esa hora.

- **Horas en timestamptz.** El usuario está en CDMX (America/Mexico_City, UTC-6,
  sin horario de verano). Guardar con offset explícito: `'2026-08-24 13:00:00-06'`.
- Usar el script del orquestador `Email_Campaigns` (crea template desde un HTML,
  la campaña programada, e importa el CSV en un paso), o a mano:

```sql
-- template desde el HTML (o via script para no escapar el HTML en SQL)
insert into templates (template_key, subject, html_body) values ('mi_camp','Asunto','<html>…{name}…{unsubscribe_url}…</html>');
insert into campaigns (name, template_key, status, scheduled_at)
  values ('Mi campaña','mi_camp','scheduled','2026-08-24 13:00:00-06') returning id;
-- luego: pnpm import leads.csv --campaign <id>
```

Verificar: `status='scheduled'`, `scheduled_at` correcto, nº de destinatarios.

## <a name="plantillas"></a>3. Plantillas

- Guardar el HTML completo en `templates.html_body`. Placeholders:
  `{name}` (nombre), `{source}` (origen/landing), `{unsubscribe_url}` (link de
  baja, se rellena por persona al enviar).
- **Toda plantilla de marketing debe incluir el pie de baja** con
  `{unsubscribe_url}`. Script para agregarlo antes de `</body>`:
  `tsx scratch/add-unsub-footer.ts <template_key…>` (en CampaignSender).
- Si la lista no trae `source`, usar copia genérica (no dejar `{source}` vacío).

## <a name="enviar"></a>4. Enviar una campaña AHORA (sin esperar al schedule)

```bash
pnpm run <campaign-id>              # corre completa, paceada, reanudable
pnpm run <campaign-id> --limit 50   # acota (para rampa/prueba)
```
Reanudable: si se corta, al reiniciar la query ya excluye lo enviado. Correrla
dos veces NO reenvía (idempotente).

## <a name="estado"></a>5. Revisar estado / destinatarios / bajas

Con el MCP `supabase` (`execute_sql`), proyecto `yfflfkbcydskruujcurw`:

```sql
-- campañas y su estado
select name, status,
  scheduled_at at time zone 'America/Mexico_City' as cdmx,
  (select count(*) from campaign_recipients r where r.campaign_id=c.id) as destinatarios,
  (select count(*) from send_log s where s.campaign_id=c.id and s.result='sent') as enviados,
  (select count(*) from send_log s where s.campaign_id=c.id and s.result='failed') as fallidos
from campaigns c where deleted_at is null order by created_at desc;

-- bajas de una campaña
select email, method, unsubscribed_at from campaign_unsubscribes where campaign_id=$1;

-- audiencia total única
select count(*) from contacts where deleted_at is null;
```

## <a name="pruebas"></a>6. Enviar un correo de prueba a una dirección

En CampaignSender: `scratch/send-html-file.ts <archivo.html> <destinatario> "<asunto>"`
o `pnpm send:test <destinatario>`. Confirmar que el remitente visible sea
`cs.latam@atfxgm.com`.

## Gotchas

- **`pnpm run <uuid>` choca** con el nombre de script de pnpm. Usar
  `node_modules/.bin/tsx scripts/run-campaign.ts <uuid>` si pasa.
- **El import de miles de filas es lento** (fila por fila sobre el pooler). Para
  4-5k tarda varios minutos; es una sola transacción (no aparece hasta terminar).
- **`campaign_id` ficticio** en un token de baja da error de FK — usar uno real.
- **No borres contactos** para reimportar: rompe el histórico y el sentido del
  modelo. El upsert ya evita duplicados.
