#!/usr/bin/env python3
"""Envuelve cada checklist .md de una carpeta en una skill SKILL.md, en el sitio.

Lo corre `bootstrap-security.sh` en la maquina de cada persona, sobre el repo de origen que esa
persona acaba de clonar. El derivado se genera local, por cada quien, desde la fuente publica: no
lo redistribuye este repo. Por eso el convertidor vive aqui pero el contenido convertido nunca se
commitea.

Uso: convertir-checklist.py <dir-fuente> <dir-skills> <url-fuente-base>
"""

# Las anotaciones como texto: el equipo corre esto con su propio Python y `str | None` pide 3.10+.
from __future__ import annotations

import re
import sys
from pathlib import Path

# Nombre de archivo del repo -> slug de skill (cuando no coinciden). Lo demas usa el nombre tal cual.
ALIAS = {
    "sql-injection": "sqli",
    "req-smuggle": "request-smuggling",
    "insecure-deserialization": "deserialization",
    "osint-method": "osint-methodology",
}
# Archivos del repo que no son checklists.
OMITIR = {"readme", "course"}


def slug(nombre: str) -> str:
    base = re.sub(r"\.md$", "", nombre).strip().lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    base = re.sub(r"^\d+-", "", base)  # los checklists van numerados en el repo; el slug no
    return ALIAS.get(base, base)


def descripcion(texto: str, titulo: str) -> str:
    """Primera frase util del cuerpo, o un fallback con el titulo."""
    for linea in texto.splitlines():
        linea = linea.strip()
        if linea and not linea.startswith(("#", "-", "*", "|", "`", ">")):
            frase = re.split(r"(?<=[.!?])\s", linea)[0]
            return " ".join(frase.split())[:280]
    return f"Checklist ofensivo: {titulo}."


def convertir(md: Path, destino: Path, url_base: str) -> str | None:
    nombre = slug(md.name)
    if nombre in OMITIR or not nombre:
        return None
    texto = md.read_text(encoding="utf-8", errors="replace")
    titulo = re.sub(r"[-_]+", " ", nombre).title()
    desc = descripcion(texto, titulo).replace('"', "'")
    url = f"{url_base.rstrip('/')}/{md.name}"
    carpeta = destino / f"offensive-{nombre}"
    carpeta.mkdir(parents=True, exist_ok=True)
    skill = (
        "---\n"
        f"name: offensive-{nombre}\n"
        f'description: "{desc} Usar para pruebas de seguridad autorizadas."\n'
        "---\n\n"
        f"# {titulo}\n\n"
        "> Derivado local del checklist de origen; generado por `bootstrap-security.sh` en esta\n"
        f"> maquina. Fuente: {url}\n"
        "> El repo de origen no declara licencia: uso interno para auditoria autorizada, no se\n"
        "> redistribuye.\n\n"
        "---\n\n"
        f"{texto}\n"
    )
    (carpeta / "SKILL.md").write_text(skill, encoding="utf-8")
    return f"offensive-{nombre}"


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    fuente, destino, url_base = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    if not fuente.is_dir():
        print(f"No existe la carpeta de fuente: {fuente}")
        sys.exit(1)
    hechas = [convertir(md, destino, url_base) for md in sorted(fuente.glob("*.md"))]
    hechas = [h for h in hechas if h]
    print(f"{len(hechas)} skills generadas en {destino}")


if __name__ == "__main__":
    main()
