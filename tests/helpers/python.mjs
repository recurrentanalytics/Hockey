// Finds a working Python 3 interpreter for the tests that call the Python tools.
// On Windows `python3` is often only the Microsoft Store stub (exit code 9009), so every candidate
// is asked for its version. Set PYTHON to force a specific interpreter.
import { spawnSync } from 'node:child_process';

const CANDIDATES = [
  ...(process.env.PYTHON ? [[process.env.PYTHON]] : []),
  ['python3'], ['python'], ['py', '-3'],
];

/** { cmd, pre, version } of the first working Python 3, or null. */
export function findPython() {
  for (const [cmd, ...pre] of CANDIDATES) {
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
    const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    if (r.status === 0 && /^Python 3\./.test(text)) return { cmd, pre, version: text };
  }
  return null;
}

/** True where a missing tool must fail the run instead of skipping the test (CI, or REQUIRE_TOOLS=1). */
export const toolsRequired = () => !!process.env.CI || process.env.REQUIRE_TOOLS === '1';
