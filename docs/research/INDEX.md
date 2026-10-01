# Reference Briefs

- lint-brief-node-fallback | standard | APROBADO | Versiones: node=22 | Justificar el fallback de readProjectVersions a process.versions.node en repos sin manifiesto
- release-gate-superficie-reportes | standard | APROBADO | Versiones: node=22 | Enfoque Node stdlib para comprobar existencia de reportes, resolver rutas relativas y mantener evaluateRelease pura cuando superficie_expuesta es true
- release-verifier | standard | APROBADO | Versiones: node=22 | Disenar un release-verifier que cierra hallazgos de pentest probando que su test de regresion fue rojo reconstruyendo el arbol pre-fix, con binding al SHA y al hash del reporte en el gate
- gate-work-repo | standard | APROBADO | Versiones: node=22 | Resolver a que repo git pertenece el trabajo para que review-gate y research-gate aten veredictos y el gate de commit al repo del trabajo y no al cwd de la sesion
