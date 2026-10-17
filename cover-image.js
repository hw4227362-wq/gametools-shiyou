((global) => {
  const MAX_INPUT_BYTES = 10 * 1024 * 1024;
  const MAX_DATA_URL_LENGTH = 1_500_000;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  function validateImageFile(file) {
    if (!file || !ALLOWED_TYPES.has(file.type)) throw new TypeError('请选择 JPG、PNG 或 WebP 图片。');
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_INPUT_BYTES) throw new TypeError('图片必须大于 0 且不超过 10 MB。');
    return true;
  }

  function isCoverDataUrl(value) {
    return typeof value === 'string' && value.length <= MAX_DATA_URL_LENGTH && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  async function createCoverDataUrl(file) {
    validateImageFile(file);
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1400 / bitmap.width, 700 / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.52]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        if (isCoverDataUrl(result)) return result;
      }
      throw new TypeError('压缩后的图片仍然过大，请选择尺寸较小的图片。');
    } finally {
      bitmap.close?.();
    }
  }

  const api = { MAX_INPUT_BYTES, MAX_DATA_URL_LENGTH, validateImageFile, isCoverDataUrl, createCoverDataUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ShiyouCoverImage = api;
})(globalThis);
