((global) => {
  const COLLECTIONS = ['games', 'videos', 'articles', 'resources', 'versions'];
  const FAVORITABLE = new Set(['videos', 'articles', 'resources']);

  function makeId(prefix = 'x') {
    const suffix = global.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function timestampFromDate(date, fallback) {
    if (!date) return fallback;
    const parsed = new Date(`${date}T12:00:00.000Z`);
    return Number.isNaN(parsed.valueOf()) ? fallback : parsed.toISOString();
  }

  function normalize(input, seed, now = new Date().toISOString()) {
    const result = { ...structuredClone(seed), ...input, settings: { ...seed.settings, ...(input?.settings || {}) } };
    for (const collection of COLLECTIONS) {
      const seen = new Set();
      result[collection] = (Array.isArray(result[collection]) ? result[collection] : []).map((record, index) => {
        const copy = { ...record };
        if (!copy.id || seen.has(copy.id)) copy.id = `legacy-${collection}-${index + 1}`;
        seen.add(copy.id);
        const oldDate = timestampFromDate(copy.date, now);
        copy.createdAt ||= copy.updatedAt || oldDate;
        copy.updatedAt ||= copy.createdAt;
        return copy;
      });
    }
    const existing = new Set(result.favorites.map((item) => `${item.type}:${item.id}`));
    for (const collection of FAVORITABLE) {
      for (const record of result[collection]) {
        if (record.favorite && !existing.has(`${collection}:${record.id}`)) {
          result.favorites.push({ type: collection, id: record.id, createdAt: record.updatedAt });
          existing.add(`${collection}:${record.id}`);
        }
        delete record.favorite;
      }
    }
    return result;
  }

  function upsert(data, collection, fields, id = null, now = new Date().toISOString()) {
    if (!COLLECTIONS.includes(collection)) throw new TypeError(`Unknown collection: ${collection}`);
    const list = data[collection] || [];
    const existing = id ? list.find((item) => item.id === id) : null;
    const record = {
      ...(existing || {}),
      ...fields,
      id: existing?.id || id || makeId(collection.slice(0, 1)),
      createdAt: existing?.createdAt || fields.createdAt || now,
      updatedAt: now,
    };
    return { ...data, [collection]: existing ? list.map((item) => item.id === record.id ? record : item) : [record, ...list] };
  }

  function removeGameCover(data, gameId) {
    return {
      ...data,
      games: (data.games || []).map((game) => {
        if (game.id !== gameId) return game;
        const { coverImage, ...withoutCover } = game;
        return withoutCover;
      }),
    };
  }

  function removeItem(data, collection, id) {
    if (!COLLECTIONS.includes(collection)) throw new TypeError(`Unknown collection: ${collection}`);
    const record = (data[collection] || []).find((item) => item.id === id);
    if (!record) return { data, removed: null, fileIds: [] };
    return {
      data: {
        ...data,
        [collection]: data[collection].filter((item) => item.id !== id),
        favorites: data.favorites.filter((item) => !(item.type === collection && item.id === id)),
      },
      removed: record,
      fileIds: collection === 'resources' && record.localFile ? [record.id] : [],
    };
  }

  function deleteGame(data, gameId) {
    const gameRecord = data.games.find((item) => item.id === gameId);
    if (!gameRecord) return { data, removedCounts: {}, fileIds: [] };
    const removedCounts = {};
    const removedKeys = new Set();
    const fileIds = [];
    const next = { ...data };
    for (const collection of ['videos', 'articles', 'resources', 'versions']) {
      const removed = data[collection].filter((item) => item.gameId === gameId);
      removedCounts[collection] = removed.length;
      for (const item of removed) {
        removedKeys.add(`${collection}:${item.id}`);
        if (collection === 'resources' && item.localFile) fileIds.push(item.id);
      }
      next[collection] = data[collection].filter((item) => item.gameId !== gameId);
    }
    next.games = data.games.filter((item) => item.id !== gameId);
    next.favorites = data.favorites.filter((item) => !removedKeys.has(`${item.type}:${item.id}`));
    return { data: next, removedCounts, fileIds };
  }

  function toggleFavorite(data, type, id, now = new Date().toISOString()) {
    if (!FAVORITABLE.has(type)) throw new TypeError(`Not favoritable: ${type}`);
    if (!data[type].some((item) => item.id === id)) throw new RangeError(`Missing ${type} record: ${id}`);
    const exists = data.favorites.some((item) => item.type === type && item.id === id);
    return {
      data: { ...data, favorites: exists
        ? data.favorites.filter((item) => !(item.type === type && item.id === id))
        : [...data.favorites, { type, id, createdAt: now }] },
      isFavorite: !exists,
    };
  }

  function filterRecords(records, { query = '', gameId = 'all', category = 'all', status = 'all' } = {}) {
    const needle = query.trim().toLocaleLowerCase();
    return records.filter((record) => {
      if (gameId !== 'all' && record.gameId !== gameId) return false;
      if (category !== 'all' && record.category !== category && record.kind !== category) return false;
      if (status !== 'all' && record.status !== status) return false;
      if (needle && !Object.values(record).filter((value) => typeof value === 'string').join(' ').toLocaleLowerCase().includes(needle)) return false;
      return true;
    });
  }

  function searchLibrary(data, query) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle) return [];
    const gameById = new Map(data.games.map((item) => [item.id, item]));
    const results = [];
    for (const item of data.games) {
      const searchable = [item.name, item.short, item.type, item.version, item.description].filter(Boolean).join(' ').toLocaleLowerCase();
      if (searchable.includes(needle)) results.push({ type: 'games', id: item.id, gameId: item.id, title: item.name, detail: `${item.version || '版本未填写'} · 游戏分区` });
    }
    for (const type of ['videos', 'articles', 'resources', 'versions']) {
      for (const item of data[type]) {
        const owner = gameById.get(item.gameId);
        const values = Object.values(item).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => typeof value === 'string');
        const searchable = [owner?.name, ...values].filter(Boolean).join(' ').toLocaleLowerCase();
        if (!searchable.includes(needle)) continue;
        results.push({
          type,
          id: item.id,
          gameId: item.gameId,
          title: item.title,
          detail: [owner?.name, item.category || item.kind || item.creator || item.version, item.status].filter(Boolean).join(' · '),
        });
      }
    }
    return results;
  }

  function stats(data) {
    return {
      games: data.games.length,
      guides: data.videos.length + data.articles.length,
      videos: data.videos.length,
      articles: data.articles.length,
      resources: data.resources.length,
      versions: data.versions.length,
      favorites: data.favorites.length,
    };
  }

  function recentRecords(data, limit = 5) {
    return [...data.videos, ...data.articles, ...data.resources, ...data.versions]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, limit);
  }

  const api = { COLLECTIONS, FAVORITABLE, makeId, normalize, upsert, removeGameCover, removeItem, deleteGame, toggleFavorite, filterRecords, searchLibrary, stats, recentRecords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ShiyouDomain = api;
})(globalThis);
