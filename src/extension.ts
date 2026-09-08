import * as path from 'path';
import * as vscode from 'vscode';
import { getCommitsForFile, getRepoRoot, toGitPath } from './git';
import { HistoryPanel } from './historyPanel';

function getConfiguredExtensions(): string[] {
  const config = vscode.workspace.getConfiguration('historicmd');
  const raw = config.get<string[]>('fileExtensions', ['md']);
  return raw.map((ext) => ext.trim().replace(/^\./, '').toLowerCase()).filter((ext) => ext.length > 0);
}

function isSupportedDocument(document: vscode.TextDocument): boolean {
  if (document.uri.scheme !== 'file') {
    return false;
  }
  const ext = path.extname(document.uri.fsPath).slice(1).toLowerCase();
  return getConfiguredExtensions().includes(ext);
}

async function openHistoryForUri(fileUri: vscode.Uri, preserveFocus: boolean): Promise<boolean> {
  const repoRoot = await getRepoRoot(fileUri.fsPath);
  const relPath = toGitPath(path.relative(repoRoot, fileUri.fsPath));
  const commits = await getCommitsForFile(repoRoot, relPath);

  if (commits.length === 0) {
    return false;
  }

  await HistoryPanel.createOrShow(fileUri.fsPath, repoRoot, relPath, commits, path.basename(fileUri.fsPath), {
    preserveFocus
  });
  return true;
}

async function tryAutoOpen(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;

  if (!isSupportedDocument(document)) {
    return;
  }
  if (HistoryPanel.isShowingFile(document.uri.fsPath)) {
    return;
  }

  const config = vscode.workspace.getConfiguration('historicmd');
  if (!config.get<boolean>('autoOpen', true)) {
    return;
  }

  try {
    await openHistoryForUri(document.uri, /* preserveFocus */ true);
  } catch {
    // Not a git repo, or the file has no history yet: stay silent for auto-open.
  }
}

function updateSupportedFileContext(editor: vscode.TextEditor | undefined): void {
  const supported = !!editor && isSupportedDocument(editor.document);
  void vscode.commands.executeCommand('setContext', 'historicmd.supportedFile', supported);
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'historicmd.viewHistory',
    async (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;

      if (!fileUri) {
        vscode.window.showWarningMessage('HistoricMD: abrí un archivo primero.');
        return;
      }

      try {
        const opened = await openHistoryForUri(fileUri, /* preserveFocus */ false);
        if (!opened) {
          vscode.window.showInformationMessage('HistoricMD: este archivo no tiene commits en git.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`HistoricMD: ${message}`);
      }
    }
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateSupportedFileContext(editor);
      if (editor) {
        void tryAutoOpen(editor);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('historicmd.fileExtensions')) {
        updateSupportedFileContext(vscode.window.activeTextEditor);
      }
    })
  );

  updateSupportedFileContext(vscode.window.activeTextEditor);
  if (vscode.window.activeTextEditor) {
    void tryAutoOpen(vscode.window.activeTextEditor);
  }
}

export function deactivate(): void {
  // no-op
}
