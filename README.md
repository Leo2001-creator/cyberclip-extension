# ⚡ CYBERCLIP // HUD Notes & Web Clipper (v1.1.0)

> **Extensión de Navegador Manifest V3** con interfaz HUD Cyberpunk de alta tecnología para el guardado rápido de fragmentos, citas y notas indexadas por URL, equipada con **resaltado neón in-page**, **botón flotante inteligente** y **atajos de teclado globales**.

![Cyberclip Banner](icons/icon128.png)

---

## 🚀 Resumen del Proyecto

**CYBERCLIP** es una extensión de navegador construida bajo la especificación moderna **Google Chrome Extensions Manifest V3**. Permite a desarrolladores, investigadores y analistas capturar fragmentos de texto seleccionados mediante **3 métodos ultrarrápidos**:
1. **Botón Flotante In-Page `[⚡ CLIP]`**: Al seleccionar cualquier texto en cualquier sitio web, aparece un botón biselado flotante con el corte a 45° de Carol para capturar con 1 solo clic.
2. **Atajo de Teclado Global (`Alt + C`)**: Captura la selección activa instantáneamente y muestra un HUD Toast en la esquina inferior.
3. **Menú Contextual del Ratón (Clic Derecho)**: Opción `⚡ Capturar fragmento a CyberClip`.

Todo se persiste en la base de datos asíncrona local `chrome.storage.local`. Además, cuando vuelves a visitar cualquier página web, el **Content Script** identifica tus fragmentos guardados y los resalta con un resplandor neón **Electric Cyan (`#00F0FF`)**, mostrando un **tooltip holográfico** con tus notas personales al pasar el ratón.

---

## ✨ Características Principales (v1.1.0)

1. **Content Script con Resaltador Neón & Quick-Action (`content.js` y `content.css`):**
   - **Botón Flotante Inmediato:** Aparece suavemente sobre cualquier selección con la directiva `clip-path` a 45°. Al pulsar, guarda el datapack y lanza una notificación HUD.
   - **Resaltado Neón Dinámico:** Los fragmentos previamente guardados se iluminan en la página con Electric Cyan y glow envolvente.
   - **Tooltip Holográfico:** Al hacer hover sobre el texto resaltado, se despliega un HUD tooltip con la nota de contexto, etiquetas y la marca de tiempo de captura.
2. **Atajos de Teclado Globales (`commands` en Manifest V3):**
   - `Alt + C` (Mac: `Option + C`): Captura inmediata del texto seleccionado sin abrir menús.
   - `Alt + N` (Mac: `Option + N`): Despliega al instante el Popup HUD Terminal.
3. **Popup Terminal HUD Interactivo:**
   - **Pestaña 01 // NOTA RÁPIDA:** Escanea la URL activa, permite extraer la selección de la página con un clic, redactar notas y añadir tags rápidos (`#DEV`, `#BUG`, `#RESEARCH`, `#SNIPPET`).
   - **Pestaña 02 // BANCO DE DATOS:** Lista de fragmentos guardados. Permite alternar entre **"ESTA PÁGINA"** (filtrado estricto por URL activa) y **"TODO EL BANCO"**, buscador en vivo y filtro por etiquetas. Acciones en cada item: `[COPIAR]`, `[IR A URL]`, `[MD]` y `[BORRAR]`.
   - **Pestaña 03 // TELEMETRÍA:** Estadísticas de nodos guardados, dominios únicos, consumo de bytes en `chrome.storage.local`, ranking de dominios más visitados, exportación masiva a Markdown (`.md`), exportación de copias de seguridad en JSON e importación de respaldos.
4. **Notificaciones y Badges Dinámicos:** Muestra badges luminosos en el icono de la barra de extensiones al capturar datos y un contador numérico en tiempo real.
5. **Exportación Estructurada a Markdown (.md):** Genera archivos Markdown limpios con bloques de código, metadatos, links a la fuente original y notas personales listos para Obsidian, Logseq, Notion o GitHub.
6. **Entorno de Pruebas Standalone (`demo.html`):** Banco de pruebas interactivo integrado para simular el comportamiento de páginas web, el menú contextual, el botón flotante y la sincronización con el Popup sin requerir herramientas externas.

---

## 🎨 Cumplimiento de Especificaciones de Diseño (DESIGN.md)

Siguiendo las directivas de `/home/antigravity/DESIGN.md` y las **Directivas Especiales para Carol**:

- **Paleta de Colores Cyberpunk:**
  - `Cyber Yellow` (`#FCEE0A`): Llamadas a la acción principales (CTA), botón flotante `[⚡ CLIP]`, alertas y resaltados.
  - `Electric Cyan` (`#00F0FF`): Resaltadores neón en el DOM, visualizadores de datos, bordes HUD y badges.
  - `Neon Crimson` (`#FF003C`): Acciones destructivas, purga de memoria y avisos críticos.
  - `Deep Void` (`#08090C`): Fondo principal del viewport y contraste extremo.
  - `Armor Plate` (`#12151D`): Placas y módulos contenedores de la interfaz HUD.
  - `Holo Amber` (`#FFA500`): Metadatos auxiliares, dominios y contadores secundarios.
- **Directiva Especial de Bordes Biselados (Carol):**
  - Implementación estricta del corte a 45 grados mediante CSS:
    ```css
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    ```
  - Aplicado en: botón flotante `[⚡ CLIP]`, botón principal de guardado, tarjetas de fragmentos, escáner de URL activa, tooltip holográfico, botones de acción y pestañas del HUD.
- **Efectos Visuales:** Scanlines CRT horizontales, rejilla holográfica de fondo, destellos al pasar el ratón (`hover flash` + 2px neon cyan glow) y tipografía técnica (`Orbitron`, `Rajdhani` y `Share Tech Mono`).

---

## 📁 Estructura del Proyecto

```text
cyberclip-extension/
├── manifest.json         # Configuración Manifest V3 (v1.1.0, comandos, content scripts)
├── background.js        # Service Worker: menús contextuales, comandos y telemetría
├── content.js           # Content Script: inyector de botón flotante y resaltador neón
├── content.css          # Estilos del resaltador, tooltip HUD y botón [⚡ CLIP]
├── popup.html           # Interfaz HUD del Popup con arquitectura modular
├── popup.css            # Estilos Cyberpunk de alto contraste con clip-path a 45°
├── popup.js             # Lógica reactiva, filtrado, exportación MD/JSON y fallback demo
├── demo.html            # Banco interactivo de pruebas v1.1.0 y simulador contextual
├── create_icons.py      # Generador autónomo de iconos PNG y SVG
├── README.md            # Documentación completa y manual de instalación
└── icons/
    ├── icon16.png       # Icono 16x16 px para la barra de herramientas
    ├── icon48.png       # Icono 48x48 px para el administrador de extensiones
    ├── icon128.png      # Icono 128x128 px para la Chrome Web Store y diálogos
    └── icon.svg         # Vector maestro escalable con efectos de glow
```

---

## 💻 Instrucciones Paso a Paso para Instalar en Chrome / Edge

### Paso 1: Abrir la página de extensiones del navegador
- **En Google Chrome / Chromium / Brave:**
  Escribe en la barra de direcciones:
  ```text
  chrome://extensions/
  ```
- **En Microsoft Edge:**
  Escribe en la barra de direcciones:
  ```text
  edge://extensions/
  ```

### Paso 2: Activar el Modo Desarrollador
- En la esquina superior derecha de la página, activa el interruptor que dice **"Modo de desarrollador"** (o *"Developer mode"*).
- Al activarlo, verás aparecer una nueva barra de herramientas con botones adicionales.

### Paso 3: Cargar la extensión descomprimida
1. Haz clic en el botón **"Cargar descomprimida"** (*"Load unpacked"*).
2. En el explorador de archivos que se abrirá, navega y selecciona la carpeta del proyecto:
   ```text
   /home/antigravity/cyberclip-extension
   ```
3. Haz clic en **"Seleccionar carpeta"** (*"Select folder"*).

*(También dispones del archivo empaquetado `cyberclip-extension.zip` en `/home/antigravity/` si deseas distribuirlo directamente).*

### Paso 4: Fijar la extensión para fácil acceso
1. En la barra de herramientas de tu navegador, haz clic en el icono de la pieza de rompecabezas (Extensiones).
2. Busca **"CYBERCLIP // HUD Notes & Clipper"**.
3. Haz clic en el icono de la chincheta (Pin) para fijar el icono amarillo y cian en tu barra.

---

## 🧪 Atajos de Teclado y Pruebas

| Atajo | Acción | Descripción |
| :--- | :--- | :--- |
| `Alt + C` | **⚡ Captura Instantánea** | Guarda el texto seleccionado en la página web actual en segundo plano con notificación HUD. |
| `Alt + N` | **Abrir HUD Terminal** | Despliega instantáneamente el Popup de CyberClip sin mover el ratón. |
| `Selección` | **Botón Flotante `[⚡ CLIP]`** | Al seleccionar texto con el cursor, pulsa el botón flotante para guardar en 1 clic. |
| `Clic Derecho` | **Menú Contextual** | Opción clásica *"Capturar fragmento a CyberClip"*. |

---

## 🔒 Privacidad y Rendimiento

- **100% Local (Offline-first):** CYBERCLIP no envía ningún dato a servidores externos. Todo el contenido reside de manera privada en tu navegador a través de `chrome.storage.local`.
- **Cero dependencias pesadas:** Construido enteramente en JavaScript moderno ES6+, HTML5 semántico y CSS3 puro con aceleración por hardware.
- **Sin fugas de memoria:** El Service Worker entra en estado de suspensión cuando no está procesando eventos de captura.

---

> Desarrollado por **Carol** // Frontend & Chrome Extension Architecture // *High-Tech Cyberpunk HUD Design v1.1.0*
