# Nutrición

Registro calórico y de macronutrientes. Minimalista, offline-first, sin servidor y gratis.

**App:** https://angelengineer.github.io/nutricion/

## Funciones

- **Foto de la etiqueta → alimento.** OCR en el dispositivo (Tesseract.js, sin claves) con un parser para etiquetas UE, EE. UU. y Japón (ES/EN/FR/DE/IT/PT/JA). Opcionalmente, Gemini (API key gratuita) para lectura mucho más robusta. Siempre se revisa antes de guardar, con aviso si las kcal no cuadran con los macros (Atwater).
- **Código de barras / búsqueda** en Open Food Facts.
- **Objetivos** de kcal, proteínas, hidratos, grasas, fibra, azúcares y sal; calculadora Mifflin–St Jeor.
- **Diario** por comidas, copiar el día anterior, edición de cantidades y corrección de valores.
- **Historial**: calorías vs objetivo, reparto medio de macros, adherencia, peso.
- **PWA** instalable (Añadir a pantalla de inicio) y funcional sin conexión.

## Arquitectura

| Capa | Elección | Coste |
|---|---|---|
| Frontend | Vite + React + TypeScript | — |
| Hosting | GitHub Pages (Actions) | gratis |
| Datos | IndexedDB (Dexie) en el dispositivo | gratis |
| Sincronización (opcional) | Gist privado en tu cuenta de GitHub, merge por registro (last-writer-wins + tombstones) | gratis |
| Lectura de etiquetas | Tesseract.js (local) · Gemini (opcional, tier gratuito) | gratis |
| Base de productos | Open Food Facts | gratis |

Las claves (Gemini, token de GitHub) se guardan solo en `localStorage` del dispositivo y nunca se sincronizan.

## Configuración

1. **Gemini (recomendado):** crea una API key en <https://aistudio.google.com/apikey> → Ajustes → *Lectura de etiquetas*.
2. **Sincronización entre dispositivos:** crea un token clásico con *solo* el scope `gist` (<https://github.com/settings/tokens/new?scopes=gist>) → Ajustes → *Sincronización*. Repite en cada dispositivo.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/nutricion/
npm test         # tests del parser de etiquetas
npm run build
```
