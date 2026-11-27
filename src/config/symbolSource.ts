/**
 * Konfigurasi sumber simbol bawaan (satu berkas, mudah diubah).
 * Semua URL unduhan diturunkan dari MANIFEST_URL dan divalidasi ketat.
 */
export const MANIFEST_URL =
  'https://raw.githubusercontent.com/shikikan-neko08/mulberry-symbols/main/symbols.json';

export const BUNDLED_SYMBOLS_VERSION = '2.0.0-mulberry-273';

export const ALLOWED_DOWNLOAD_HOSTS = ['raw.githubusercontent.com', 'cdn.jsdelivr.net'] as const;

export interface ParsedRepoSource {
  owner: string;
  repo: string;
  branch: string;
  basePath: string; // Subfolder tanpa leading/trailing slash
  manifestFilename: string;
  rawBaseUrl: string;
  cdnBaseUrl: string;
}

function parseManifestSource(manifestUrl: string): ParsedRepoSource {
  let parsed: URL;
  try {
    parsed = new URL(manifestUrl);
  } catch {
    throw new Error('MANIFEST_URL tidak valid.');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  let owner = '';
  let repo = '';
  let branch = 'main';
  let subSegments: string[] = [];

  if (parsed.hostname === 'raw.githubusercontent.com') {
    owner = segments[0] || '';
    repo = segments[1] || '';
    branch = segments[2] || 'main';
    subSegments = segments.slice(3);
  } else if (parsed.hostname === 'cdn.jsdelivr.net' && segments[0] === 'gh') {
    owner = segments[1] || '';
    const repoAndBranch = segments[2] || '';
    const atIndex = repoAndBranch.indexOf('@');
    if (atIndex !== -1) {
      repo = repoAndBranch.slice(0, atIndex);
      branch = repoAndBranch.slice(atIndex + 1) || 'main';
    } else {
      repo = repoAndBranch;
    }
    subSegments = segments.slice(3);
  } else {
    throw new Error('Host MANIFEST_URL hanya boleh raw.githubusercontent.com atau cdn.jsdelivr.net.');
  }

  if (!owner || !repo) {
    throw new Error('MANIFEST_URL harus menyertakan owner dan nama repositori.');
  }

  let manifestFilename = 'symbols.json';
  if (subSegments.length > 0 && /\.json$/i.test(subSegments[subSegments.length - 1])) {
    manifestFilename = subSegments[subSegments.length - 1];
    subSegments = subSegments.slice(0, -1);
  }

  const basePath = subSegments.join('/');
  const pathSuffix = basePath ? `/${basePath}` : '';

  return {
    owner,
    repo,
    branch,
    basePath,
    manifestFilename,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${pathSuffix}`,
    cdnBaseUrl: `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}${pathSuffix}`,
  };
}

export const REPO_SOURCE: ParsedRepoSource = parseManifestSource(MANIFEST_URL);
export const BASE_URL: string = REPO_SOURCE.rawBaseUrl;
export const CDN_MIRROR_BASE_URL: string = REPO_SOURCE.cdnBaseUrl;

/**
 * Validasi ketat: hanya izinkan unduhan dari raw.githubusercontent.com atau cdn.jsdelivr.net
 * dan wajib berasal dari repositori owner/repo yang sama dengan MANIFEST_URL.
 */
export function isAllowedSymbolUrl(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== 'https:') {
      return false;
    }

    if (url.hostname === 'raw.githubusercontent.com') {
      const prefix = `/${REPO_SOURCE.owner}/${REPO_SOURCE.repo}/`.toLowerCase();
      return url.pathname.toLowerCase().startsWith(prefix);
    }

    if (url.hostname === 'cdn.jsdelivr.net') {
      const prefix = `/gh/${REPO_SOURCE.owner}/${REPO_SOURCE.repo}@`.toLowerCase();
      const exactPrefix = `/gh/${REPO_SOURCE.owner}/${REPO_SOURCE.repo}/`.toLowerCase();
      const lowerPath = url.pathname.toLowerCase();
      return lowerPath.startsWith(prefix) || lowerPath.startsWith(exactPrefix);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Bersihkan dan validasi nama berkas relatif dari manifest agar aman dari path traversal / URL luar.
 */
export function sanitizeManifestFilename(filename: string): string | null {
  const trimmed = filename.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null; // Tolak scheme URL (http:, data:, javascript:, dll)
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some(p => p === '.' || p === '..')) {
    return null;
  }
  return parts.join('/');
}

/**
 * Encode SETIAP segmen path dengan encodeURIComponent (mis. nama berkas mengandung koma),
 * tanpa meng-encode karakter "/".
 */
export function encodeRelativePath(relativePath: string): string {
  return relativePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export function getManifestFetchUrls(): string[] {
  const urls = [
    MANIFEST_URL,
    `${CDN_MIRROR_BASE_URL}/${encodeRelativePath(REPO_SOURCE.manifestFilename)}`,
  ];
  return Array.from(new Set(urls)).filter(isAllowedSymbolUrl);
}

/**
 * Bentuk URL persis sesuai filename di manifest: BASE_URL + "/" + encoded(filename).
 * Tidak pernah mengarang nama berkas atau menebak subfolder lain.
 */
export function buildSymbolFileUrl(filename: string, useCdnMirror = false): string | null {
  const cleanName = sanitizeManifestFilename(filename);
  if (!cleanName) return null;

  const base = useCdnMirror ? CDN_MIRROR_BASE_URL : BASE_URL;
  const fullUrl = `${base}/${encodeRelativePath(cleanName)}`;
  return isAllowedSymbolUrl(fullUrl) ? fullUrl : null;
}

export function getRepoDocUrls(docFilename: 'LICENSE-MULBERRY.txt' | 'CREDITS.md'): string[] {
  const encoded = encodeRelativePath(docFilename);
  const urls = [
    `${BASE_URL}/${encoded}`,
    `${CDN_MIRROR_BASE_URL}/${encoded}`,
  ];
  return urls.filter(isAllowedSymbolUrl);
}
