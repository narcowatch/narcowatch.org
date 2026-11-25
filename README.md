# NarcoWatch

Observatorio independiente del narcotráfico en Centroamérica, el Caribe y Guyana, basado solo en fuentes abiertas. Sitio estático bilingüe (español / inglés) publicado en https://narcowatch.org.

Independent open-source observatory of drug trafficking in Central America, the Caribbean and Guyana. Static bilingual site (Spanish / English).

## Estructura

- `index.html`: la página.
- `assets/app.js`: dibuja mapa, gráficos, tablas y filtros a partir de `data/`.
- `assets/i18n.js`: textos de la interfaz en español e inglés.
- `assets/styles.css`: estilos (modo claro y oscuro).
- `assets/d3.v7.9.0.min.js`: D3 v7.9.0 (licencia ISC, ver `assets/d3-LICENSE.txt`).
- `data/*.json`: datos con su fuente. Cada registro lleva `url` y `fuente`.
- `data/region.geo.json`: contornos de países de Natural Earth 1:50m (dominio público), recortados a la región.

## Ver en local

```bash
python3 -m http.server 8000
```

Luego abrir http://localhost:8000.

## Actualización de datos

Los datos nuevos se proponen a diario mediante una búsqueda automática en fuentes abiertas y una persona los revisa antes de publicarlos.
