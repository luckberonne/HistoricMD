import { execFile } from 'child_process';
import * as path from 'path';

export interface Commit {
  hash: string;
  date: string;
  subject: string;
}

const UNIT_SEP = '\x1f';
const MAX_BUFFER = 20 * 1024 * 1024;

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function getRepoRoot(filePath: string): Promise<string> {
  const stdout = await runGit(['rev-parse', '--show-toplevel'], path.dirname(filePath));
  return stdout.trim();
}

export function toGitPath(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

export async function getCommitsForFile(repoRoot: string, relPath: string): Promise<Commit[]> {
  const stdout = await runGit(
    ['log', '--follow', `--format=%H${UNIT_SEP}%ad${UNIT_SEP}%s`, '--date=short', '--', relPath],
    repoRoot
  );
  return stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [hash, date, subject] = line.split(UNIT_SEP);
      return { hash, date, subject };
    });
}

export async function getFileContentAt(repoRoot: string, hash: string, relPath: string): Promise<string> {
  return runGit(['show', `${hash}:${relPath}`], repoRoot);
}
