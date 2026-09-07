import * as vscode from 'vscode';
import MarkdownIt = require('markdown-it');
import { Commit, getFileContentAt } from './git';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class HistoryPanel {
  public static currentPanel: HistoryPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly md: MarkdownIt;
  private index = 0;

  public static async createOrShow(
    repoRoot: string,
    relPath: string,
    commits: Commit[],
    fileName: string
  ): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (HistoryPanel.currentPanel) {
      HistoryPanel.currentPanel.panel.reveal(column);
      HistoryPanel.currentPanel.reset(repoRoot, relPath, commits, fileName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'historicmd.history',
      `Historial: ${fileName}`,
      column ?? vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    HistoryPanel.currentPanel = new HistoryPanel(panel, repoRoot, relPath, commits, fileName);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private repoRoot: string,
    private relPath: string,
    private commits: Commit[],
    private fileName: string
  ) {
    this.panel = panel;
    this.md = new MarkdownIt({ html: false, linkify: true, breaks: false });

    this.panel.webview.html = this.getHtmlShell();
    this.panel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'older') {
        this.navigate(1);
      } else if (message?.type === 'newer') {
        this.navigate(-1);
      }
    });
    this.panel.onDidDispose(() => {
      HistoryPanel.currentPanel = undefined;
    });

    void this.update();
  }

  private reset(repoRoot: string, relPath: string, commits: Commit[], fileName: string): void {
    this.repoRoot = repoRoot;
    this.relPath = relPath;
    this.commits = commits;
    this.fileName = fileName;
    this.index = 0;
    this.panel.title = `Historial: ${fileName}`;
    void this.update();
  }

  private navigate(delta: number): void {
    const newIndex = this.index + delta;
    if (newIndex < 0 || newIndex >= this.commits.length) {
      return;
    }
    this.index = newIndex;
    void this.update();
  }

  private async update(): Promise<void> {
    const commit = this.commits[this.index];
    let bodyHtml: string;

    try {
      const content = await getFileContentAt(this.repoRoot, commit.hash, this.relPath);
      bodyHtml = this.md.render(content);
    } catch {
      bodyHtml = `<p class="error">No se pudo leer el archivo en este commit (puede haber sido renombrado o no existir todavía).</p>`;
    }

    this.panel.webview.postMessage({
      type: 'update',
      html: bodyHtml,
      meta: {
        hash: commit.hash.slice(0, 7),
        date: commit.date,
        subject: commit.subject,
        position: `${this.index + 1} / ${this.commits.length}`,
        hasOlder: this.index < this.commits.length - 1,
        hasNewer: this.index > 0
      }
    });
  }

  private getHtmlShell(): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  :root {
    color-scheme: light dark;
  }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    padding: 0;
    margin: 0;
  }
  header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background-color: var(--vscode-editorWidget-background);
    border-bottom: 1px solid var(--vscode-widget-border, transparent);
    z-index: 1;
  }
  button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover:not(:disabled) {
    background-color: var(--vscode-button-hoverBackground);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }
  .meta .subject {
    color: var(--vscode-foreground);
    font-size: 13px;
    font-weight: 600;
  }
  .position {
    margin-left: auto;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }
  main {
    padding: 16px 24px 48px;
    max-width: 900px;
  }
  .error {
    color: var(--vscode-errorForeground);
  }
  code {
    font-family: var(--vscode-editor-font-family);
  }
  pre {
    background-color: var(--vscode-textCodeBlock-background);
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
</style>
</head>
<body>
  <header>
    <button id="btn-older" title="Commit anterior">&larr; Anterior</button>
    <button id="btn-newer" title="Commit siguiente">Siguiente &rarr;</button>
    <div class="meta">
      <span class="subject" id="meta-subject"></span>
      <span id="meta-hash-date"></span>
    </div>
    <span class="position" id="meta-position"></span>
  </header>
  <main id="content"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('btn-older').addEventListener('click', () => {
      vscode.postMessage({ type: 'older' });
    });
    document.getElementById('btn-newer').addEventListener('click', () => {
      vscode.postMessage({ type: 'newer' });
    });
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'update') {
        document.getElementById('content').innerHTML = message.html;
        document.getElementById('meta-subject').textContent = message.meta.subject;
        document.getElementById('meta-hash-date').textContent = message.meta.hash + ' · ' + message.meta.date;
        document.getElementById('meta-position').textContent = message.meta.position;
        document.getElementById('btn-older').disabled = !message.meta.hasOlder;
        document.getElementById('btn-newer').disabled = !message.meta.hasNewer;
      }
    });
  </script>
</body>
</html>`;
  }
}
