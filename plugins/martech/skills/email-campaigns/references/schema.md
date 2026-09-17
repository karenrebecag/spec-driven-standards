# Esquema de la base (Supabase Postgres `yfflfkbcydskruujcurw`)

Modelo canónico de plataforma de email (como Resend/Mailchimp). Muchos-a-muchos
entre contactos y campañas: los leads se acumulan, no se borran.

```
contacts ──< campaign_recipients >── campaigns ──→ templates
(audiencia)    (quién recibe qué)      (envío)      (contenido, {name})
    │
    ├──→ send_log              (idempotencia: un 'sent' por campaña+email)
    ├──→ suppression_list      (bajas globales: rebotes/quejas)
    └──→ campaign_unsubscribes (bajas POR campaña: clic en el correo)
```

## Tablas

### contacts — la audiencia (un lead por email, único global)
- `id uuid pk`, `email citext` (único parcial `where deleted_at is null`)
- `first_name`, `last_name`, `salesforce_lead_id`, `source`
- `source_system` (`excel`/`salesforce`/`manual`), `last_imported_at`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

### templates — contenido guardado una vez, referenciado por clave
- `template_key text pk`, `subject`, `html_body`, timestamps
- Placeholders en subject/html: `{name}`, `{source}`, `{unsubscribe_url}`

### campaigns — un envío, referencia un template
- `id uuid pk`, `name`, `template_key` (fk)
- `status campaign_status` enum: `draft` `queued` `scheduled` `running`
  `completed` `completed_with_errors` `failed`
- `batch_size int` (def 100), `pacing_ms int` (def 2400 = 25/min)
- `scheduled_at timestamptz` (null = manual), `status_message`
- timestamps, `deleted_at`

### campaign_recipients — muchos-a-muchos
- `(campaign_id, contact_id)` pk, `added_at`

### send_log — registro de envíos
- `id`, `campaign_id`, `contact_id`, `email citext`, `result` enum(`sent`,`failed`)
- `attempt`, `error`, `sent_at`
- Índice único `send_log_sent_once (campaign_id, email) where result='sent'`
  → **el doble envío es imposible por construcción**

### suppression_list — bajas GLOBALES (rebotes/quejas)
- `email citext pk`, `reason` enum(`unsubscribed`,`bounced`,`complained`,`manual`)
- `campaign_id`, `note`, `created_at`

### campaign_unsubscribes — bajas POR CAMPAÑA (clic en el correo)
- `(campaign_id, email)` pk, `method` (`link`/`one-click`), `unsubscribed_at`

## La consulta central (pendientes de una campaña)

Es la cola. Reemplaza cursor + paginación + dedupe manual de SharePoint. Excluye
lo ya enviado, lo suprimido global, y las bajas de esa campaña:

```sql
select c.id, c.email::text, c.first_name, c.last_name, c.source
from campaign_recipients r
join contacts c on c.id = r.contact_id
where r.campaign_id = $1
  and c.deleted_at is null
  and not exists (select 1 from send_log s
    where s.campaign_id=r.campaign_id and s.email=c.email and s.result='sent')
  and not exists (select 1 from suppression_list sup where sup.email=c.email)
  and not exists (select 1 from campaign_unsubscribes u
    where u.campaign_id=r.campaign_id and u.email=c.email)
order by c.id limit $2;
```

## Notas de diseño

- **UUID v7-style** (`gen_random_uuid`), `timestamptz` siempre, `snake_case`.
- **RLS activo** en toda tabla; el runner usa la connection string directa
  (rol postgres), que salta RLS. Hay un event-trigger `rls_auto_enable` de la org
  que activa RLS en toda tabla nueva (benigno, no lo toques).
- `citext` hace los correos case-insensitive nativamente.
