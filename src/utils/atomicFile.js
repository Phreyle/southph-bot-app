import fs from 'fs';

/**
 * Write JSON to disk via temp file + rename. A crash or kill mid-write only
 * ever leaves the .tmp file corrupt - the real file is untouched until the
 * rename (atomic at the OS level) completes.
 */
export function writeJsonAtomicSync(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
    throw error;
  }
}
