import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

const shouldLoadForCoverage = (relativeFile: string): boolean => {
  if (relativeFile.endsWith('.spec.ts')) {
    return false;
  }
  if (relativeFile.endsWith('main.ts')) {
    return false;
  }
  if (relativeFile.endsWith('types/express.d.ts')) {
    return false;
  }
  if (relativeFile.endsWith('.module.ts')) {
    return true;
  }
  if (relativeFile.includes('/dto/') && relativeFile.endsWith('.ts')) {
    return true;
  }
  if (relativeFile.endsWith('.entity.ts')) {
    return true;
  }
  if (
    relativeFile.endsWith('public.decorator.ts') ||
    relativeFile.endsWith('jwt.strategy.ts') ||
    relativeFile.endsWith('app.module.ts')
  ) {
    return true;
  }
  return false;
};

const collectFiles = (rootDir: string): string[] => {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!absolutePath.endsWith('.ts')) {
        continue;
      }

      const relativeFile = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join('/');

      if (shouldLoadForCoverage(relativeFile)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
};

describe('Structure load smoke', () => {
  it('loads module/entity/dto files without runtime crash', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const files = collectFiles(srcRoot);
    const requireFn = createRequire(__filename);

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(() => {
        requireFn(file);
      }).not.toThrow();
    }
  });
});
