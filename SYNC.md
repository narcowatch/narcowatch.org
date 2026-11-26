# Sincronización diaria panel → sitio

Instrucciones para la tarea programada que publica en narcowatch.org lo aprobado en el panel privado de claude.ai.

1. Exporta lo aprobado con la herramienta ArtifactData (url del panel en el prompt de la tarea), acción `list` con `out_dir` en una carpeta temporal `EXPORT`, para cada colección:
   `data/registro/casos`, `data/registro/pistas`, `data/registro/operaciones`, `data/registro/informes_guyana`.
2. Desde la raíz del repositorio: `python3 -I scripts/sync.py pending EXPORT`.
   Si imprime `[]`, no hay nada nuevo: termina sin commit.
3. Escribe `TRAD.json` (fuera del repositorio) con un objeto por `id`, con los campos de `necesita` traducidos al inglés:
   - Traducción fiel, sin agregar ni quitar hechos, cifras, fechas ni nombres de instituciones.
   - `agencias_en` y `puntos_en` son listas del mismo largo que su original.
   - Si el texto en español está en primera persona o tiene notas internas ("solo vi resúmenes", "usé la cifra menor"), agrega también `desc_es`, `res_es` o `nota_es` con el mismo contenido en tono neutro ("Basado solo en resúmenes de prensa", "se usa la cifra menor").
4. `python3 -I scripts/sync.py merge EXPORT TRAD.json`. Si termina con `ERROR`, corrige `TRAD.json` y repite. Nunca edites a mano los archivos de `data/`.
5. Commit solo de `data/` con un mensaje como `Datos: 2 casos, 1 operación (AAAA-MM-DD)` y push a `main`. Cloudflare publica solo.
