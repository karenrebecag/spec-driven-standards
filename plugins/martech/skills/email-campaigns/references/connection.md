# Guía de conexión y secretos

**Ningún secreto vive en esta skill ni en el repo.** Aquí se dice DÓNDE están.

## Supabase (estado)

- Proyecto: `yfflfkbcydskruujcurw` · región us-west-2 · Postgres 17
- Org: `karenrebecag` (autenticar el MCP `supabase` sobre esa org)
- MCP `supabase` para DDL/consultas (`apply_migration`, `execute_sql`,
  `list_tables`, `get_advisors`, `deploy_edge_function`).
- Connection string directa (para el runner): en
  `~/Desktop/SoftwareDevProjects/CampaignSender/.env` → `DATABASE_URL`
  (pooler de transacciones, puerto 6543, SSL sin verificación de cadena —
  el pooler presenta un cert fuera del bundle de Node; la conexión SÍ va cifrada).

## Envío (Microsoft Graph, como cs.latam@)

- **Identidad del sender = Felipe** (`felipe.trejo@atfxgm.com`), que tiene Send As
  sobre `cs.latam@`. NO es la cuenta del operador.
- Cliente público **Graph CLI** `14d82eec-204b-4c2f-b7e8-296a70dab67e` — único
  preautorizado por Microsoft para Graph en este tenant (Azure CLI/Office dan
  AADSTS65002). Scopes: `Mail.Send.Shared` + `Mail.Send`, ya consentidos.
- Refresh token de Felipe: archivo `.sender-token` (0600) en el proyecto y en el
  VPS. Se regenera con `pnpm login` (lo firma Felipe en incógnito).
- Tenant: `265236f7-2209-439f-9846-5423e4ae0ded`.

## VPS de producción (Azure, siempre encendido)

```
ssh ubuntu@atfxmcp.westus2.cloudapp.azure.com     # IP 20.94.205.78, llave id_ed25519
```
- App en `/opt/campaign-sender`. Corre el MCP de Salesforce también.
- Node 20, pnpm 9 (global vía npm; corepack falla ahí).
- systemd timer `campaign-dispatch.timer` → cada 10 min corre el dispatcher.
  - `systemctl list-timers campaign-dispatch.timer` (próxima corrida)
  - `journalctl -u campaign-dispatch.service -n 20` (logs)
  - tick manual: `sudo systemctl start campaign-dispatch.service`

## Unsubscribe (Edge Function)

- URL: `https://yfflfkbcydskruujcurw.supabase.co/functions/v1/unsubscribe`
- Secreto `UNSUB_SECRET` (HMAC) en TRES lados, mismo valor: `.env` local, `.env`
  del VPS, y como secret de la Edge Function en el dashboard de Supabase.
- La función valida el token, escribe en `campaign_unsubscribes`, muestra página
  (GET) o 200 (POST one-click).

## <a name="deploy"></a>Desplegar cambios de código al VPS

Desde `~/Desktop/SoftwareDevProjects/CampaignSender`:

```bash
VPS=ubuntu@atfxmcp.westus2.cloudapp.azure.com
rsync -az --exclude node_modules --exclude dist --exclude .git \
  --exclude .env --exclude .sender-token --exclude scratch --exclude supabase \
  ./ "$VPS:/tmp/campaign-sender/"
ssh "$VPS" 'sudo cp -r /tmp/campaign-sender/. /opt/campaign-sender/ \
  && sudo chown -R ubuntu:ubuntu /opt/campaign-sender \
  && cd /opt/campaign-sender && pnpm install --prod=false'
```
El timer toma el nuevo código en el próximo tick; no hace falta reiniciar nada.
Los secretos (`.env`, `.sender-token`) NO se copian por rsync — ya están en el VPS.

## Legacy — Power Automate (conservado, desconectado)

El pipeline **anterior** vivía en Power Automate + SharePoint. Se sacó por
completo del camino de envío (ver el techo de 6.000 acciones/día que lo
invalidaba). **No se borró: se conserva desconectado como legacy infra**, por
decisión del usuario.

- Flujo **"Email Campaign Runner — v1.4"** · `aef8e8d4-50dc-4fca-a456-28bb7eafd0d1`
  · env `Default-265236f7-2209-439f-9846-5423e4ae0ded` (ABS Group Limited).
- Estado: **`Stopped`** (permanente). NO reactivar.
- Inerte por doble motivo: (1) está detenido; (2) su trigger leía la lista
  `Campaigns` de SharePoint, que ya no se alimenta.
- Cero envíos pasan por aquí. Coexiste apagado sólo como referencia/rollback
  histórico. Si alguna vez se decide eliminarlo, es un borrado manual desde el
  portal o vía MCP `power-automate` — pero la decisión vigente es **conservarlo**.
- Backups de la definición en `~/Desktop/flowstudio-backups/` (rollback:
  `Campaign-Runner_PRE-v1.4-patch_20260821-095555.json`).

## Pendiente de seguridad

Rotar el password de la DB (pasó por un chat): Supabase → Settings → Database →
Reset password, luego actualizar `DATABASE_URL` en `.env` local y del VPS.
