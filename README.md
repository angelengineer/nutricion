# Nutrición

Registro de calorías y macros. Minimalista, gratis, y con los datos en la nube.

**App:** https://claude.ai/artifact/U9xzuP1KrfULEJURhn1LaV (privada: solo la cuenta propietaria puede abrirla)

La app es un [Artifact de claude.ai](https://claude.ai). Este repo contiene el código fuente.

## Funciones

- **Foto → alimento.** Claude lee la etiqueta nutricional (UE, EE. UU., Japón…) o estima un plato a partir de la foto, incluida la ración. Siempre revisas los valores antes de guardar, y la app avisa si las kcal no cuadran con los macros (Atwater).
- **Describir con palabras.** «200 g de arroz con pollo al curry» → Claude estima los valores.
- **Objetivos** de kcal, proteínas, hidratos, grasas, fibra, azúcares y sal; calculadora Mifflin–St Jeor.
- **Diario** por comidas, copiar el día anterior, editar cantidades y corregir valores.
- **Historial**: calorías frente al objetivo, reparto medio de macros, adherencia y peso.

## Datos

Se guardan en la base de datos del Artifact (`db`). Las reglas de acceso solo dejan leer y escribir a la cuenta propietaria:

| Ruta | Contenido |
|---|---|
| `foods/<id>` | alimento guardado (valores por 100 g/ml) |
| `days/<YYYY-MM-DD>` | `{ date, entries[], weightKg, updatedAt }`, un documento por día |
| `settings/main` | `{ goals, profile }` |

Como Claude tiene acceso a esa base de datos, puedes pedírselo desde cualquier conversación de Claude Code: «¿cuánta proteína he comido de media esta semana?» o «corrige la cena de ayer».

Fuera de claude.ai (por ejemplo con `npm run dev`), la app usa `localStorage` y desactiva las funciones de Claude.

## Desarrollo

```bash
npm install
npm run dev      # vista local (modo localStorage)
npm test
npm run build    # → dist/nutricion.html (página única para el Artifact)
```

Para publicar una versión nueva, sube `dist/nutricion.html` con la herramienta Artifact de Claude Code y la misma URL. Capabilities: `db` (reglas `read/write: owner`), `sample` (`images: true`) y `downloads`.
