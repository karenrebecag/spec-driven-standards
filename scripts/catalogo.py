#!/usr/bin/env python3
"""Regenera catalogo/skills.json y catalogo/SKILLS.md leyendo ~/.claude/skills.

El catalogo existe porque solo una parte de las skills instaladas es redistribuible: lo propio
vive en plugins/ de este repo y lo de terceros se referencia con su origen. Sin este inventario
la unica forma de saber que hay instalado es un ls, y un ls no dice de quien es cada cosa.
"""

import json
import os
import re
from pathlib import Path

SKILLS = Path.home() / ".claude" / "skills"
REPO = Path(__file__).resolve().parent.parent
AGENTS_DIR = "../../.agents"

# Un area por skill. Las familias (offensive-*, flowstudio-*) se resuelven por prefijo.
AREA = {
    "lean-review": "standards",
    "cortex-implementation": "atom",
    "cortex-reference": "atom",
    "ui-ux-pro-max": "web",
    "transitions-dev": "web",
    "animate-text": "web",
    "exact_ascii-animations": "web",
    "i18n-expert": "web",
    "penpot-uiux-design": "web",
    "diagram-design": "web",
    "archify": "web",
    "motion-design": "web",
    "email-campaigns": "martech",
    "email-marketing-bible": "martech",
    "resend": "martech",
    "seo-audit": "martech",
    "seo-geo": "martech",
    "copywriting": "martech",
    "ux-copy": "martech",
    "linkedin-post-writer": "martech",
    "security-audit": "security",
    "clop-compress": "mac-ops",
    "use-spark": "mac-ops",
    "docs": "office-docs",
    "docx": "office-docs",
    "pdf": "office-docs",
    "pptx": "office-docs",
    "xlsx": "office-docs",
    "import-memory": "office-docs",
    "morning": "office-docs",
    "skill-creator": "office-docs",
}
PREFIJO_AREA = {"offensive-": "security", "flowstudio-": "automation"}

AREAS = ["standards", "atom", "web", "martech", "security", "automation", "mac-ops", "office-docs"]

# Todas las offensive-* trazan a SnailSploit/Claude-Red (MIT) y se incluyen en el plugin security
# con su LICENSE; `bootstrap-security.sh` las refresca desde ese upstream.

# Lo que vive en plugins/ de este repo: skill -> plugin.
PROPIAS = {
    "lean-review": "standards",
    "email-campaigns": "martech",
    "security-audit": "security",
    "clop-compress": "mac-ops",
    "cortex-implementation": "atom",
    "cortex-reference": "atom",
}
# Escritas por otra persona y sin licencia en el arbol: no se copian aqui.
SIN_DETERMINAR = {"linkedin-post-writer"}

ORIGEN_TEXTO = {
    "propia": "escrita por ti",
    "fork": "fork atribuido de un tercero",
    "terceros-mit": "de terceros, licencia MIT en el arbol",
    "terceros-agents": "de terceros, gestionada en ~/.agents/skills",
    "terceros-con-fuente": "de terceros, declara su repo de origen pero sin licencia en el arbol",
    "terceros": "de terceros, origen sin verificar",
    "synced-anthropic": "ejemplo de Anthropic, llega por sync de la cuenta",
    "propia-cuenta": "creada en tu cuenta Claude, llega por sync",
    "sin-determinar": "autoria sin determinar: revisala antes de publicarla",
}


def area_de(nombre: str, carpeta: str) -> str:
    # El `name` del frontmatter no siempre coincide con la carpeta (`flowstudio-power-automate-*`
    # se llama `power-automate-*`): se prueban los dos antes de darla por no clasificada.
    for clave in (nombre, carpeta):
        if clave in AREA:
            return AREA[clave]
        for pref, area in PREFIJO_AREA.items():
            if clave.startswith(pref):
                return area
    return "sin-clasificar"


def frontmatter(ruta: Path) -> dict:
    skill = ruta / "SKILL.md"
    if not skill.is_file():
        return {}
    texto = skill.read_text(encoding="utf-8", errors="replace")
    datos = {}
    m = re.match(r"^---\n(.*?)\n---", texto, re.S)
    if m:
        for linea in m.group(1).splitlines():
            if re.match(r"^[a-zA-Z_]+:", linea):
                k, _, v = linea.partition(":")
                datos[k.strip()] = v.strip().strip("\"'")
    # Varias skills de terceros (p. ej. las offensive-*) no traen LICENSE pero SÍ declaran su
    # repo de origen en un bloque `## Metadata` con una linea `**Source**: <url>`. Se rescata
    # para que el catalogo diga de donde salio cada una, no solo que es "de terceros".
    fuente = re.search(r"\*\*Source\*\*:\s*(\S+)", texto)
    if fuente:
        datos["source_url"] = fuente.group(1)
    return datos


def synced() -> dict:
    """skillId/nombre -> source, leyendo el manifest de cada carpeta sincronizada."""
    fuentes = {}
    for manifest in SKILLS.glob("synced/*/manifest.json"):
        try:
            datos = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for s in datos.get("skills", []):
            nombre = s.get("name") or s.get("skillId")
            if nombre:
                fuentes[nombre] = s.get("source", "")
    return fuentes


def origen_de(nombre: str, ruta: Path, fm: dict, fuentes: dict) -> str:
    if nombre in SIN_DETERMINAR:
        return "sin-determinar"
    if nombre in PROPIAS:
        return "fork" if (ruta / "ATTRIBUTION.md").is_file() else "propia"
    if nombre.startswith("offensive-"):
        return "terceros-mit"  # claude-red (SnailSploit), MIT; LICENSE en el plugin security
    fuente = fuentes.get(nombre)
    if fuente:
        return "propia-cuenta" if fuente == "custom" else "synced-anthropic"
    if ruta.is_symlink() and AGENTS_DIR in os.readlink(ruta):
        return "terceros-agents"
    if fm.get("license", "").upper() == "MIT" or (ruta / "LICENSE").is_file():
        return "terceros-mit"
    # Trae repo de origen en la metadata pero ningun LICENSE en el arbol: se sabe de donde salio,
    # no bajo que terminos, asi que no es redistribuible tal cual.
    if fm.get("source_url"):
        return "terceros-con-fuente"
    return "terceros"


def cubierta_por_bootstrap(nombre: str) -> bool:
    return nombre.startswith("offensive-")  # todas vienen de claude-red (MIT)


def como_obtener(nombre: str, origen: str, ruta: Path) -> str:
    if origen in ("propia", "fork"):
        return f"/plugin install {PROPIAS[nombre]}@spec-driven-standards"
    if origen in ("synced-anthropic", "propia-cuenta"):
        return "sync de la cuenta Claude"
    if origen == "terceros-agents":
        return f"~/.agents/skills/{ruta.name}"
    if cubierta_por_bootstrap(nombre):
        return "/plugin install security@spec-driven-standards, o scripts/bootstrap-security.sh"
    return "instalada a mano en ~/.claude/skills"


def recolectar() -> list:
    entradas = []
    vistos = set()
    for ruta in sorted(SKILLS.iterdir()):
        if ruta.name.startswith(".") or ruta.name in ("synced", "learned"):
            continue
        if not (ruta.is_dir() or ruta.is_symlink()):
            continue
        fm = frontmatter(ruta)
        nombre = fm.get("name") or ruta.name
        vistos.add(nombre)
        entradas.append((ruta.name, nombre, ruta, fm))
    for ruta in sorted(SKILLS.glob("synced/*/*")):
        # `.staging` es area de trabajo del sync, no una skill.
        if ruta.name.startswith(".") or not ruta.is_dir():
            continue
        fm = frontmatter(ruta)
        nombre = fm.get("name") or ruta.name
        if nombre in vistos:
            continue
        vistos.add(nombre)
        entradas.append((ruta.name, nombre, ruta, fm))
    return entradas


def main() -> None:
    fuentes = synced()
    filas = []
    for carpeta, nombre, ruta, fm in recolectar():
        origen = origen_de(nombre, ruta, fm, fuentes)
        filas.append(
            {
                "nombre": nombre,
                "carpeta": carpeta,
                "area": area_de(nombre, carpeta),
                "origen": origen,
                "plugin": PROPIAS.get(nombre),
                "licencia": fm.get("license") or None,
                "fuente": fm.get("source_url") or None,
                "bootstrap": cubierta_por_bootstrap(nombre),
                "descripcion": " ".join((fm.get("description") or "").split())[:200],
                "obtener": como_obtener(nombre, origen, ruta),
            }
        )
    filas.sort(key=lambda f: (AREAS.index(f["area"]) if f["area"] in AREAS else 99, f["nombre"]))

    destino = REPO / "catalogo"
    destino.mkdir(exist_ok=True)
    (destino / "skills.json").write_text(
        json.dumps({"areas": AREAS, "skills": filas}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    por_area = {}
    for f in filas:
        por_area.setdefault(f["area"], []).append(f)
    propias = sum(1 for f in filas if f["origen"] in ("propia", "fork", "propia-cuenta"))

    md = [
        "# Catalogo de skills",
        "",
        f"{len(filas)} skills instaladas, {propias} de autoria propia. "
        "Generado por `scripts/catalogo.py`; no se edita a mano.",
        "",
        "Origen: " + " | ".join(f"`{k}` {v}" for k, v in ORIGEN_TEXTO.items()),
        "",
    ]
    for area in AREAS + ["sin-clasificar"]:
        if area not in por_area:
            continue
        md += [
            f"## {area} ({len(por_area[area])})",
            "",
            "| skill | origen | fuente | como obtenerla |",
            "|---|---|---|---|",
        ]
        for f in por_area[area]:
            fuente = f["fuente"] or "—"
            md.append(f"| `{f['nombre']}` | {f['origen']} | {fuente} | {f['obtener']} |")
        md.append("")
    (destino / "SKILLS.md").write_text("\n".join(md), encoding="utf-8")
    print(f"{len(filas)} skills, {propias} propias -> catalogo/SKILLS.md, catalogo/skills.json")


if __name__ == "__main__":
    main()
