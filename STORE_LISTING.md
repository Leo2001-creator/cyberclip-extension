# Ficha para la Chrome Web Store // Store Listing

## Título (Máx 45 caracteres)
`CYBERCLIP // HUD Notes & Clipper`

## Resumen corto (Máx 132 caracteres)
### Español (129 caracteres)
`High-Tech Cyberpunk HUD Web Clipper y notas por URL con favoritos ★, paleta neón, atajos y privacidad 100% local en tu navegador.`

### English (126 characters)
`High-Tech Cyberpunk HUD Web Clipper and URL-indexed notes with ★ favorites, neon palette, shortcuts, and 100% local privacy.`

---

## Descripción detallada (Español)

**CYBERCLIP** es un Web Clipper y gestor de notas rápidas de alta tecnología con estética cyberpunk HUD (Cyber Yellow, Electric Cyan, Neon Crimson) diseñado para desarrolladores, investigadores y power-users.

### ⚡ Características principales:
- **01. BANCO DE DATOS (Por defecto):** Navega por todos tus fragmentos indexados por URL o a nivel global. Búsqueda instantánea en tiempo real y filtros por etiqueta.
- **Barra flotante rápida [⚡ CLIP]:** Selecciona texto en cualquier web y guárdalo al instante con un solo clic asignándole el color y la etiqueta deseada.
- **Resaltado neón in-page:** Las frases guardadas se resaltan automáticamente en la página original con su color HUD y brillo neón, incluso en aplicaciones SPA modernas.
- **Sistema de favoritos blindados (★):** Marca fragmentos clave con estrella para protegerlos contra purgas masivas accidentales.
- **Atajos de teclado globales:**
  - `Alt + C`: Captura la selección activa sin abrir el popup.
  - `Alt + V`: Copia el último fragmento al portapapeles.
  - `Alt + N`: Abre el terminal HUD de CyberClip.
  - `/`: Enfoca el buscador dentro del HUD.
- **Edición en línea y deshacer:** Edita notas y etiquetas directamente desde las tarjetas o deshaz borrados accidentales con un clic.
- **Modo Standby (⏻ ONLINE / STANDBY):** Apaga la extensión temporalmente cuando necesites navegar sin interfaces flotantes ni menús.
- **Bilingüe (Español / Inglés):** Cambia de idioma desde la pestaña 04. CONFIG en cualquier momento.
- **Tope estricto de 100 MB:** Almacenamiento ampliado y controlado con telemetría en tiempo real.
- **Exportación e Importación:** Respaldo completo en JSON y exportación limpia a Markdown (.MD).
- **Lista de sitios bloqueados (Blocklist):** Desactiva CyberClip en sitios confidenciales o bancarios.

### 🛡️ Privacidad primero:
- 100% Local: Ningún dato se envía a servidores externos.
- Sin cuentas, sin rastreadores, sin telemetría invasiva.
- Código abierto disponible en GitHub.

---

## Detailed Description (English)

**CYBERCLIP** is a high-tech cyberpunk HUD Web Clipper and note-taking engine built for developers, researchers, and power users who need instant snippet capture with maximum local privacy.

### ⚡ Key Features:
- **01. DATA VAULT (Default Tab):** Browse your URL-indexed snippets or global vault with real-time fuzzy search and tag filters.
- **Floating Quick-Action Bar [⚡ CLIP]:** Highlight text anywhere on the web and save it with one click with your assigned color and tag.
- **Dynamic In-Page Neon Highlighter:** Saved phrases are automatically highlighted with glowing underline in their original context, fully compatible with SPAs.
- **Shielded Favorites (★):** Star important clips to make them immune to accidental bulk purges.
- **Global Keyboard Shortcuts:**
  - `Alt + C`: Capture current selection.
  - `Alt + V`: Copy latest clip to clipboard.
  - `Alt + N`: Open HUD Terminal.
  - `/`: Focus search within HUD.
- **Inline Editing & Undo:** Edit clips directly inside cards or undo accidental deletions with a 5-second toast action.
- **Master Power Switch (⏻ ONLINE / STANDBY):** Pause the extension instantly without uninstalling.
- **Bilingual (Spanish / English):** Switch UI language on the fly in tab 04. CONFIG.
- **Strict 100 MB Quota:** High-capacity local storage with live telemetry byte monitoring.
- **Markdown & JSON I/O:** Full JSON backup and clean Markdown export.
- **Site Blocklist:** Disable CyberClip on sensitive or banking websites.

### 🛡️ Privacy Guarantee:
- 100% Local: Zero data leaves your browser.
- No sign-in, no trackers, no external analytics.

---

## Justificación de Permisos (Declaración para la Store)

| Permiso | Justificación para los revisores de Google |
|---|---|
| `storage` / `unlimitedStorage` | Necesario para almacenar las notas y fragmentos del usuario hasta el tope de 100 MB en `chrome.storage.local`. |
| `contextMenus` | Permite capturar texto o indexar URLs mediante clic derecho sin abrir el popup. |
| `activeTab` | Necesario para obtener la URL y título de la pestaña activa en el popup. |
| `scripting` | Usado como respaldo para extraer la selección activa cuando se presiona el atajo `Alt+C`. |
| `offscreen` | Permite escribir texto en el portapapeles desde el Service Worker cuando el usuario presiona el atajo global `Alt+V`. |
| `host_permissions: <all_urls>` | Necesario para que el content script pueda resaltar texto y mostrar la barra flotante de captura en las páginas visitadas por el usuario. |

---

## Categoría recomendada
- **Categoría principal:** Herramientas de productividad (Productivity Tools)
- **Categoría secundaria:** Herramientas para desarrolladores (Developer Tools)
