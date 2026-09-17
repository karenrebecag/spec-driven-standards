# Onboarding del equipo vibecoder

El stack en tres pasos. El primero da lo redistribuible; el segundo, la capa de seguridad desde
su fuente; el tercero es el mapa de todo lo demás.

## 1. Los plugins del stack (instalables)

```bash
/plugin marketplace add <url-de-este-repo>
/plugin install standards@spec-driven-standards   # agentes spec-driven + lean-review
/plugin install atom@spec-driven-standards         # Cortex de Atom
/plugin install martech@spec-driven-standards      # campañas de correo
/plugin install security@spec-driven-standards     # auditoría de proyecto (security-audit)
/plugin install mac-ops@spec-driven-standards      # compresión con Clop (solo macOS)
```

Las reglas de trabajo (`config/rules/`) no viajan en un plugin — no es una capacidad del
harness. Cada quien las copia una vez:

```bash
cp -R config/rules ~/.claude/rules
# y añade a ~/.claude/CLAUDE.md los @import que trae config/CLAUDE.md
```

## 2. La capa de seguridad ofensiva (desde origen)

Las skills `offensive-*` son de terceros y su repo de origen **no declara licencia**, así que no
se pueden redistribuir empaquetadas. Cada persona las trae de la fuente pública a su propia
máquina, que sí está permitido:

```bash
./scripts/bootstrap-security.sh
```

Clona `SnailSploit/offensive-checklist` en `~/.claude/skills-sources/` y genera ahí mismo 34
skills `offensive-*` (XSS, SQLi, SSRF, JWT, RCE, OSINT…). Son para **auditoría autorizada**:
pentesting con permiso, CTF, tu propio código.

Las otras ~44 skills ofensivas que hay en la máquina original (wireless, Active Directory, cloud,
k8s, bluetooth) tienen origen sin identificar y **no** las cubre el bootstrap: no hay una fuente
conocida a la que apuntar. Están listadas en `catalogo/SKILLS.md` por si alguien reconoce su
repo y lo añade.

> Alternativa más sólida: para seguridad con licencia real, el pack ECC (MIT) y el marketplace
> oficial (p. ej. 42crunch) traen skills de auditoría mantenidas. Si el equipo prefiere no
> depender de un repo sin licencia, esa es la vía.

## 3. El catálogo (mapa de las 114 skills)

`catalogo/SKILLS.md` lista todo lo instalado por área y por origen, con la URL de la fuente y
cómo se obtiene cada una. Es lo que consultas cuando no sabes de dónde salió una skill o cómo
dársela a alguien. Lo regenera `scripts/catalogo.py`.
