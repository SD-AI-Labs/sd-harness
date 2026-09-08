import { realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
  sep,
} from "node:path";

/**
 * Resolve a caller-supplied path inside `rootDir` and return the real,
 * symlink-free absolute path that file operations should target.
 *
 * Throws a descriptive Error when the path is absolute, when resolving it
 * would leave the working directory (for example `../`), or when an
 * existing component is a symbolic link that points outside the working
 * directory.
 */
export async function resolveSafePath(
  rootDir: string,
  requestedPath: string,
): Promise<string> {
  if (isAbsolute(requestedPath)) {
    throw new Error(`Absolute paths are not allowed: "${requestedPath}"`);
  }

  const root = resolve(rootDir);

  const candidate = resolve(root, requestedPath);

  /*
   * Lexical containment check. path.resolve normalizes `..` segments, so
   * any traversal attempt lands outside `root` and is rejected here.
   */
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    throw new Error(
      `Path escapes the working directory: "${requestedPath}"`,
    );
  }

  let realRoot: string;

  try {
    realRoot = await realpath(root);
  } catch {
    throw new Error(`Working directory does not exist: ${root}`);
  }

  /*
   * Real-path containment check. Walk from the candidate towards the root
   * until an existing component is found, then resolve symbolic links. If
   * that real location lies outside the real root, the path escapes the
   * working directory through a symlink.
   */
  let probe = candidate;
  const missing: string[] = [];

  while (true) {
    let realProbe: string;

    try {
      realProbe = await realpath(probe);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      if (probe === root) {
        throw new Error(`Working directory does not exist: ${root}`);
      }

      missing.push(basename(probe));
      probe = dirname(probe);
      continue;
    }

    if (realProbe !== realRoot && !realProbe.startsWith(realRoot + sep)) {
      throw new Error(
        `Path escapes the working directory: "${requestedPath}"`,
      );
    }

    if (missing.length === 0) {
      return realProbe;
    }

    return join(realProbe, ...missing.reverse());
  }
}
