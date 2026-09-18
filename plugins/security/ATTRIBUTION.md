# Atribución — componentes de terceros (security)

Lo propio (sin import): la skill `security-audit` (fork atribuido de cyber-neo, ver su encabezado)
y el loop `pentest`.

Importado de terceros:

| Componente | Origen | Licencia |
|---|---|---|
| `skills/security-audit-deep/` | cloudflare/security-audit-skill | MIT |
| `skills/security-hardening/` | rohitg00/awesome-claude-code-toolkit | Apache-2.0 |

`security-audit-deep` es la auditoría rigurosa de Cloudflare (6 fases con verificación
independiente), complemento del scanner rápido `security-audit`. Se copió verbatim; solo se renombró
`name: security-audit` → `security-audit-deep` en su `SKILL.md` para no chocar. Requiere ejecución
en sandbox con red deshabilitada, como indica su documentación.

Las skills ofensivas (`offensive-*`) tienen su propia atribución en
`skills/ATTRIBUTION-offensive.md`. Licencias retenidas en `licenses/`.
