import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

function filesUnder(directory: string, extension: RegExp): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path, extension) : extension.test(path) ? [path] : [];
  });
}

describe('frontend/backend contract', () => {
  it('defines every literal RPC used by the production React app', () => {
    const source = filesUnder(join(root, 'src'), /\.(ts|tsx)$/)
      .filter((path) => !path.includes(`${join('src', 'dev')}`) && !path.endsWith('.test.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const sql = filesUnder(join(root, 'sql'), /\.sql$/)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    const names = new Set<string>();
    for (const match of source.matchAll(/rpc(?:<[^>]+>)?\(\s*['"`]([^'"`]+)['"`]/g)) names.add(match[1]);
    for (const match of source.matchAll(/(?:list|save|delete):\s*['"]([a-z][a-z0-9_]+)['"]/g)) names.add(match[1]);

    const definitions = new Set(
      [...sql.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)/gi)]
        .map((match) => match[1].toLowerCase()),
    );
    const missing = [...names].filter((name) => !definitions.has(name.toLowerCase())).sort();
    expect(missing).toEqual([]);
  });

  it('does not contain corrupted placeholder text in production source', () => {
    const source = filesUnder(join(root, 'src'), /\.(ts|tsx)$/)
      .filter((path) => !path.includes(`${join('src', 'dev')}`))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/\?{5,}/);
  });
});
