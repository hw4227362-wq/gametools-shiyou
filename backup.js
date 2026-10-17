((global) => {
  const FORMAT = 'shiyou-backup';
  const VERSION = 2;
  const REQUIRED_COLLECTIONS = ['games', 'videos', 'articles', 'resources', 'versions'];

  function assertData(data) {
    if (!data || typeof data !== 'object') throw new TypeError('Backup data is missing');
    for (const name of REQUIRED_COLLECTIONS) {
      if (!Array.isArray(data[name])) throw new TypeError(`Invalid backup collection: ${name}`);
    }
    if (!Array.isArray(data.favorites)) throw new TypeError('Invalid backup favorites');
    if (!data.settings || typeof data.settings !== 'object') throw new TypeError('Invalid backup settings');
  }

  function encodeBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    if (typeof btoa === 'function') return btoa(binary);
    return Buffer.from(bytes).toString('base64');
  }

  function decodeBase64(text) {
    if (typeof text !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
      throw new TypeError('Invalid file encoding in backup');
    }
    const bytes = typeof atob === 'function'
      ? Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
      : new Uint8Array(Buffer.from(text, 'base64'));
    if (encodeBase64(bytes) !== text) throw new TypeError('Non-canonical file encoding in backup');
    return bytes;
  }

  async function stringify(data, files) {
    assertData(data);
    const packedFiles = await Promise.all(files.map(async (file) => ({
      id: file.id,
      name: file.name,
      type: file.type || file.blob?.type || 'application/octet-stream',
      base64: encodeBase64(new Uint8Array(await file.blob.arrayBuffer())),
    })));
    return JSON.stringify({ format: FORMAT, version: VERSION, data, files: packedFiles });
  }

  function parse(text) {
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    const isCurrent = parsed?.format === FORMAT;
    if (isCurrent && parsed.version !== VERSION) throw new TypeError(`Unsupported backup version: ${parsed.version}`);
    const data = isCurrent ? parsed.data : parsed;
    assertData(data);
    const packedFiles = isCurrent ? parsed.files : [];
    if (!Array.isArray(packedFiles)) throw new TypeError('Invalid backup file list');
    const seen = new Set();
    const resources = new Map(data.resources.map((resource) => [resource.id, resource]));
    const files = packedFiles.map((file) => {
      if (!file || typeof file.id !== 'string' || !file.id || typeof file.name !== 'string' || !file.name) throw new TypeError('Invalid file metadata');
      if (seen.has(file.id)) throw new TypeError('Duplicate file ID in backup');
      const resource = resources.get(file.id);
      if (!resource || resource.hasLocalFile !== true) throw new TypeError('Backup file has no matching resource record');
      seen.add(file.id);
      return { id: file.id, name: file.name, type: file.type || 'application/octet-stream', blob: new Blob([decodeBase64(file.base64)], { type: file.type || 'application/octet-stream' }) };
    });
    if (isCurrent) for (const resource of data.resources) {
      if (resource.hasLocalFile === true && !seen.has(resource.id)) throw new TypeError(`Missing resource file: ${resource.title || resource.id}`);
    }
    return {
      data,
      files,
      version: isCurrent ? parsed.version : 1,
      legacy: !isCurrent,
      warnings: !isCurrent && data.resources.some((resource) => resource.localFile || resource.hasLocalFile)
        ? ['此旧版备份没有包含资源文件本体，文件无法恢复。']
        : [],
    };
  }

  async function restore(parsed, adapters) {
    assertData(parsed.data);
    const [previousData, previousFiles] = await Promise.all([adapters.readData(), adapters.readFiles()]);
    try {
      await adapters.writeFiles(parsed.files);
      await adapters.writeData(parsed.data);
    } catch (error) {
      const rollback = await Promise.allSettled([
        adapters.writeFiles(previousFiles),
        adapters.writeData(previousData),
      ]);
      if (rollback.some((result) => result.status === 'rejected')) {
        throw new AggregateError([error, ...rollback.filter((result) => result.status === 'rejected').map((result) => result.reason)], 'Restore failed and rollback was incomplete');
      }
      throw error;
    }
    return { records: REQUIRED_COLLECTIONS.reduce((sum, key) => sum + parsed.data[key].length, 0), files: parsed.files.length };
  }

  async function restoreIfConfirmed(parsed, confirmRestore, adapters) {
    if (!await confirmRestore()) return { cancelled: true };
    return { cancelled: false, ...(await restore(parsed, adapters)) };
  }

  const api = { FORMAT, VERSION, stringify, parse, restore, restoreIfConfirmed, assertData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ShiyouBackup = api;
})(globalThis);
