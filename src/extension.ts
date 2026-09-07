import * as path from 'path';
import * as vscode from 'vscode';
import { getCommitsForFile, getRepoRoot, toGitPath } from './git';
import { HistoryPanel } from './historyPanel';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'historicmd.viewHistory',
    async (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;

      if (!fileUri) {
        vscode.window.showWarningMessage('HistoricMD: abrí un archivo Markdown primero.');
        return;
      }

      try {
        const repoRoot = await getRepoRoot(fileUri.fsPath);
        const relPath = toGitPath(path.relative(repoRoot, fileUri.fsPath));
        const commits = await getCommitsForFile(repoRoot, relPath);

        if (commits.length === 0) {
          vscode.window.showInformationMessage('HistoricMD: este archivo no tiene commits en git.');
          return;
        }

        await HistoryPanel.createOrShow(repoRoot, relPath, commits, path.basename(fileUri.fsPath));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`HistoricMD: ${message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // no-op
}
