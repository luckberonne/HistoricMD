# HistoricMD

Extensión de VS Code para ver el historial de commits de un archivo Markdown,
navegando de a un commit por vez con botones **◀ Anterior** / **Siguiente ▶**.

## Uso

1. Abrí un archivo `.md` que esté versionado en un repo git.
2. Ejecutá el comando **HistoricMD: Ver historial de commits** (paleta de comandos,
   el ícono de historial en la barra de título del editor, o el atajo
   `Ctrl+Alt+H` / `Cmd+Alt+H` en Mac). Si `historicmd.autoOpen` está activado
   (por defecto), el panel también se abre solo al abrir el archivo.
3. Se abre un panel con el contenido del archivo renderizado tal como estaba en
   cada commit. Usá los botones para moverte al commit anterior o siguiente
   que tocó ese archivo (se sigue el historial con `git log --follow`).

## Configuración

- `historicmd.fileExtensions` (`string[]`, default `["md"]`): extensiones de
  archivo (sin el punto) donde aparece el botón/atajo y se puede auto-abrir el
  historial. Por ejemplo `["md", "markdown", "mdx"]`.
- `historicmd.autoOpen` (`boolean`, default `true`): abre el panel
  automáticamente al abrir un archivo con alguna de esas extensiones, si está
  versionado en git.

## Desarrollo

```bash
npm install
npm run compile
```

Luego presioná `F5` en VS Code para lanzar una ventana de "Extension
Development Host" con la extensión cargada.

## Cómo funciona

- `src/git.ts`: obtiene la raíz del repo, la lista de commits que tocaron el
  archivo (`git log --follow`) y el contenido del archivo en un commit puntual
  (`git show <hash>:<path>`).
- `src/historyPanel.ts`: webview que renderiza el markdown (con `markdown-it`)
  y maneja la navegación entre commits.
- `src/extension.ts`: registra el comando `historicmd.viewHistory`.

## Limitaciones conocidas

- Si el archivo fue renombrado, `git show` puede fallar para commits previos
  al rename (se muestra un mensaje en el panel en ese caso).
- Pensada para repos locales; no soporta ver historial de archivos abiertos
  desde fuera de un workspace con git.
