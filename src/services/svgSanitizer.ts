export const MAX_SYMBOL_FILE_BYTES = 500 * 1024; // 500 KB

const DANGEROUS_SVG_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'audio',
  'video',
  'handler',
  'listener',
]);

const URL_BEARING_ATTRS = new Set([
  'href',
  'xlink:href',
  'src',
  'action',
  'formaction',
  'poster',
  'data',
]);

function isUnsafeReference(value: string): boolean {
  const normalized = value.trim().replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!normalized) return false;
  // Hanya izinkan fragment internal (#id)
  if (normalized.startsWith('#')) return false;
  // Izinkan data:image/* non-svg jika aman, tolak seluruh URL eksternal, javascript:, vbscript:, data:text/html, dll
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(normalized)) {
    return false;
  }
  return true;
}

function sanitizeStyleText(cssText: string): string {
  // Hapus @import dan url(...) eksternal atau javascript:/expression()
  return cssText
    .replace(/@import\b[^;]*(;|$)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (_match, _q, ref) => {
      const cleaned = String(ref || '').trim();
      if (cleaned.startsWith('#')) {
        return `url(${cleaned})`;
      }
      return 'none';
    });
}

export type SanitizeImageResult =
  | { ok: true; blob: Blob; mimeType: string; sanitizedText?: string }
  | { ok: false; error: string };

/**
 * Sanitasi konten SVG mentah: hapus <script>, event handler on*, <foreignObject>,
 * dan semua referensi eksternal sebelum disimpan ke IndexedDB sebagai Blob.
 */
export function sanitizeSvgText(rawSvgText: string): SanitizeImageResult {
  const byteSize = new TextEncoder().encode(rawSvgText).byteLength;
  if (byteSize > MAX_SYMBOL_FILE_BYTES) {
    return { ok: false, error: `Ukuran berkas SVG melebihi batas 500 KB (${Math.round(byteSize / 1024)} KB).` };
  }

  const trimmed = rawSvgText
    .replace(/<\?xml-stylesheet\b[^?]*\?>/gi, '')
    .trim();
  if (!trimmed.includes('<svg')) {
    return { ok: false, error: 'Berkas bukan SVG yang valid.' };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return { ok: false, error: 'SVG rusak atau gagal diparsing.' };
  }

  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') {
    return { ok: false, error: 'Elemen akar SVG tidak valid.' };
  }

  // Hapus semua elemen berbahaya (termasuk nested)
  const allElements = Array.from(root.querySelectorAll('*'));
  for (const el of allElements) {
    const tag = el.localName.toLowerCase();
    if (DANGEROUS_SVG_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (tag === 'style' && el.textContent) {
      el.textContent = sanitizeStyleText(el.textContent);
    }
  }

  // Bersihkan atribut di root dan semua elemen tersisa
  const remainingElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of remainingElements) {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const nameLower = attr.name.toLowerCase();
      const val = attr.value || '';

      // Hapus seluruh event handler on*
      if (nameLower.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      // Periksa atribut URL / href / xlink:href / src
      if (URL_BEARING_ATTRS.has(nameLower) || nameLower.endsWith(':href')) {
        if (isUnsafeReference(val)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      // Sanitasi atribut style inline
      if (nameLower === 'style') {
        const cleanedStyle = sanitizeStyleText(val);
        if (cleanedStyle.trim()) {
          el.setAttribute(attr.name, cleanedStyle);
        } else {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      // Tolak atribut lain yang menyisipkan javascript: atau url(http...)
      if (/javascript:|vbscript:|url\s*\(\s*['"]?\s*(https?:|\/\/)/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  // Pastikan xmlns tetap ada agar Blob image/svg+xml selalu valid dirender <img>
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const serialized = new XMLSerializer().serializeToString(root);
  const sanitizedBytes = new TextEncoder().encode(serialized).byteLength;
  if (sanitizedBytes > MAX_SYMBOL_FILE_BYTES) {
    return { ok: false, error: 'Ukuran SVG setelah sanitasi melebihi 500 KB.' };
  }

  const blob = new Blob([serialized], { type: 'image/svg+xml' });
  return { ok: true, blob, mimeType: 'image/svg+xml', sanitizedText: serialized };
}

export async function sanitizeDownloadedAsset(
  response: Response,
  filename: string
): Promise<SanitizeImageResult> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_SYMBOL_FILE_BYTES) {
      return { ok: false, error: `Ukuran berkas melebihi 500 KB (${Math.round(declaredBytes / 1024)} KB).` };
    }
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_SYMBOL_FILE_BYTES) {
    return { ok: false, error: `Ukuran berkas melebihi 500 KB (${Math.round(buffer.byteLength / 1024)} KB).` };
  }
  if (buffer.byteLength === 0) {
    return { ok: false, error: 'Berkas kosong (0 byte).' };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const isSvg = /\.svg$/i.test(filename) || contentType.includes('image/svg');

  if (isSvg) {
    const text = new TextDecoder().decode(buffer);
    return sanitizeSvgText(text);
  }

  // Validasi gambar raster aman
  const allowedRasterTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  let resolvedMime = allowedRasterTypes.find(t => contentType.includes(t)) || '';
  if (!resolvedMime) {
    if (/\.png$/i.test(filename)) resolvedMime = 'image/png';
    else if (/\.jpe?g$/i.test(filename)) resolvedMime = 'image/jpeg';
    else if (/\.webp$/i.test(filename)) resolvedMime = 'image/webp';
    else if (/\.gif$/i.test(filename)) resolvedMime = 'image/gif';
  }

  if (!resolvedMime) {
    return { ok: false, error: `Format berkas tidak didukung (${contentType || filename}).` };
  }

  const normalizedMime = resolvedMime === 'image/jpg' ? 'image/jpeg' : resolvedMime;
  const blob = new Blob([buffer], { type: normalizedMime });
  return { ok: true, blob, mimeType: normalizedMime };
}
