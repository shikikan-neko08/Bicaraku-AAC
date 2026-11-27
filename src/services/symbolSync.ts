import {
  ManifestEntry,
  SymbolItem,
  FitzgeraldCategory,
  ManifestMeta,
  SyncSummary,
  SyncErrorItem,
  SyncDiagnostics,
  SymbolUpdateDiffItem,
  LicenseDocs,
} from '../types';
import {
  MANIFEST_URL,
  BUNDLED_SYMBOLS_VERSION,
  isAllowedSymbolUrl,
  getManifestFetchUrls,
  buildSymbolFileUrl,
  getRepoDocUrls,
} from '../config/symbolSource';
import { sanitizeDownloadedAsset } from './svgSanitizer';
import {
  idbGetAllSymbols,
  idbPutSymbol,
  idbReplaceAllSymbols,
  idbPutBlob,
  idbDeleteSymbol,
  idbDeleteBlob,
  getManifestMeta,
  setManifestMeta,
  setLicenseDocs,
  getSyncDiagnostics,
  setSyncDiagnostics,
} from './indexedDb';
import { DEFAULT_SYMBOLS } from '../data/defaultSymbols';

const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const CONCURRENCY_LIMIT = 6;

export interface SyncProgress {
  phase: 'manifest' | 'images' | 'licenses' | 'done';
  completed: number;
  total: number;
  currentLabel?: string;
  usedMirror?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isProtectedCaregiverSymbol(sym: SymbolItem): boolean {
  return sym.userModified === true || sym.source === 'custom-photo';
}

async function computeSha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (window.crypto?.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Unduh URL dengan validasi host ketat, logging console per permintaan/galat,
 * timeout 15 detik, dan 3x percobaan dengan jeda bertambah.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
  maxAttempts = MAX_RETRIES
): Promise<Response> {
  if (!isAllowedSymbolUrl(url)) {
    const secErr = `URL ditolak oleh kebijakan keamanan sumber simbol: ${url}`;
    console.error('[BicaraKu Sync] Error:', url, secErr);
    throw new Error(secErr);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    console.info(`[BicaraKu Sync] Request (${attempt}/${maxAttempts}):`, url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      window.clearTimeout(timer);

      if (response.ok) {
        return response;
      }

      const httpErr = response.status === 404 ? 'HTTP 404 (Berkas tidak ditemukan)' : `HTTP ${response.status}`;
      console.error('[BicaraKu Sync] Error:', url, httpErr);

      if (response.status === 404) {
        throw new Error(httpErr);
      }

      lastError = new Error(httpErr);
    } catch (err: unknown) {
      window.clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('Timeout 15 detik terlampaui');
      } else {
        lastError = err;
      }

      const reasonStr = lastError instanceof Error ? lastError.message : 'Gagal jaringan';
      console.error('[BicaraKu Sync] Error:', url, reasonStr);

      if (lastError instanceof Error && lastError.message.includes('404')) {
        throw lastError;
      }
    }

    if (attempt < maxAttempts) {
      await sleep(attempt * 1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gagal mengunduh berkas dari jaringan');
}

function mapCategory(rawCategory?: string, fitzgeraldColor?: string): FitzgeraldCategory {
  const cat = (rawCategory || '').toLowerCase().trim();
  const color = (fitzgeraldColor || '').toLowerCase().trim();

  if (cat.includes('emerg') || cat.includes('darurat')) return 'emergency';
  if (cat.includes('orang') || cat.includes('people') || cat.includes('person') || cat.includes('pronoun')) {
    return 'people';
  }
  if (cat.includes('perasaan') || cat.includes('emosi') || cat.includes('feel') || cat.includes('emotion')) {
    return 'feelings';
  }
  if (cat.includes('kebutuhan') || cat.includes('kesehatan') || cat.includes('medis') || cat.includes('need')) {
    return 'needs';
  }
  if (cat.includes('sosial') || cat.includes('komunikasi') || cat.includes('soc')) {
    return 'social';
  }
  if (cat.includes('aktivitas') || cat.includes('tindakan') || cat.includes('activ')) {
    return 'activities';
  }
  if (cat.includes('verb') || cat.includes('kerja')) return 'verbs';
  if (cat.includes('tempat') || cat.includes('transportasi') || cat.includes('place')) return 'places';
  if (cat.includes('pertanyaan') || cat.includes('konsep') || cat.includes('sifat') || cat.includes('adj')) {
    return 'adjectives';
  }
  if (
    cat.includes('makanan') ||
    cat.includes('minuman') ||
    cat.includes('benda') ||
    cat.includes('sekolah') ||
    cat.includes('pakaian') ||
    cat.includes('noun')
  ) {
    return 'nouns';
  }

  if (color.includes('pink') || color.includes('magenta')) return 'social';
  if (color.includes('green') || color.includes('hijau')) return 'verbs';
  if (color.includes('blue') || color.includes('biru')) return 'adjectives';
  if (color.includes('yellow') || color.includes('kuning')) return 'people';
  if (color.includes('orange') || color.includes('oranye')) return 'nouns';
  if (color.includes('red') || color.includes('merah')) return 'emergency';

  return 'nouns';
}

function normalizeTagsEn(raw?: string | string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,]+/)
      .map(t => t.trim())
      .filter(Boolean);
  }
  return [];
}

function buildStableId(entry: ManifestEntry, index: number): string {
  if (entry.id && typeof entry.id === 'string') return entry.id;
  const sourceKey = entry.filename
    ? entry.filename
    : `ph-${entry.label || index}-${entry.category || ''}`;
  const base = sourceKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `mf-${base || index}`;
}

export async function manifestEntryToSymbolItem(
  entry: ManifestEntry,
  index: number
): Promise<SymbolItem> {
  const id = buildStableId(entry, index);
  const label = entry.label.trim();
  const spoken = entry.speechText.trim();
  const isPlaceholder = !entry.filename || entry.source === 'placeholder';
  const category = mapCategory(entry.category, entry.fitzgeraldColor);
  const tagsEn = normalizeTagsEn(entry.tagsEn);
  const fitzgeraldColor = entry.fitzgeraldColor?.trim().toLowerCase() || undefined;
  const boardCategory = entry.category?.trim() || undefined;
  const source = entry.source || (isPlaceholder ? 'placeholder' : 'mulberry');
  const license = isPlaceholder ? entry.license || '' : entry.license || 'CC BY-SA 4.0';
  const author = isPlaceholder ? entry.author || '' : entry.author || 'Steve Lee (mulberrysymbols.org)';

  const contentHash = await computeSha256Hex(
    JSON.stringify({
      filename: entry.filename,
      label,
      speechText: spoken,
      category: entry.category,
      fitzgeraldColor: entry.fitzgeraldColor,
      tagsEn: entry.tagsEn,
      source,
      license,
      author,
      commercialOk: entry.commercialOk,
      attributionRequired: entry.attributionRequired,
      variantGroup: entry.variantGroup,
      isDefault: entry.isDefault,
      variantNote: entry.variantNote,
      placeholderNote: entry.placeholderNote,
    })
  );

  return {
    id,
    filename: entry.filename ?? null,
    label,
    spokenText: spoken,
    speechText: spoken,
    category,
    boardCategory,
    fitzgeraldColor,
    iconName: 'Image',
    hasImageBlob: false,
    isEmergency: category === 'emergency',
    isCustom: source === 'custom',
    isPlaceholder,
    userModified: false,
    downloadStatus: isPlaceholder ? 'placeholder' : 'pending',
    contentHash,
    tagsEn,
    source,
    license,
    author,
    commercialOk: entry.commercialOk !== false,
    attributionRequired: entry.attributionRequired !== undefined ? entry.attributionRequired : !isPlaceholder,
    variantGroup: entry.variantGroup ?? null,
    isDefault: entry.isDefault !== false,
    variantNote: entry.variantNote || '',
    notes: entry.notes || '',
    placeholderNote: entry.placeholderNote || '',
    frequency: 0,
  };
}

export interface ParsedManifestResult {
  version: string;
  hash: string;
  entries: ManifestEntry[];
  usedMirror: boolean;
}

/**
 * Unduh dan validasi struktur manifest symbols.json.
 * Wajib berupa array dan setiap entri harus memiliki label dan speechText.
 * Mencoba raw.githubusercontent.com lebih dulu, lalu cermin cdn.jsdelivr.net jika jaringan gagal.
 */
export async function fetchAndValidateManifest(): Promise<ParsedManifestResult> {
  const urls = getManifestFetchUrls();
  let lastError: unknown = null;
  let lastAttemptedUrl = MANIFEST_URL;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    lastAttemptedUrl = url;
    const usedMirror = url.includes('cdn.jsdelivr.net');
    try {
      const response = await fetchWithTimeoutAndRetry(url);
      const rawText = await response.text();
      const parsed: unknown = JSON.parse(rawText);

      if (!Array.isArray(parsed)) {
        throw new Error('Struktur JSON manifest tidak valid: isi manifest harus berupa array.');
      }

      if (parsed.length === 0) {
        throw new Error('Manifest symbols.json kosong.');
      }

      const validEntries: ManifestEntry[] = [];
      for (let idx = 0; idx < parsed.length; idx++) {
        const item = parsed[idx];
        if (!item || typeof item !== 'object') {
          throw new Error(`Entri manifest ke-${idx + 1} bukan objek yang valid.`);
        }
        const rec = item as Record<string, unknown>;
        if (typeof rec.label !== 'string' || !rec.label.trim()) {
          throw new Error(`Entri manifest ke-${idx + 1} tidak memiliki field label yang valid.`);
        }
        if (typeof rec.speechText !== 'string' || !rec.speechText.trim()) {
          throw new Error(`Entri manifest "${rec.label}" tidak memiliki field speechText yang valid.`);
        }
        const filename =
          rec.filename === null || rec.filename === undefined
            ? null
            : typeof rec.filename === 'string'
            ? rec.filename
            : null;

        validEntries.push({
          ...(rec as unknown as ManifestEntry),
          filename,
          label: rec.label.trim(),
          speechText: rec.speechText.trim(),
        });
      }

      const hash = await computeSha256Hex(rawText);
      const version = hash.slice(0, 12);

      return {
        version,
        hash,
        entries: validEntries,
        usedMirror,
      };
    } catch (err) {
      lastError = err;
    }
  }

  const msg =
    lastError instanceof Error
      ? `${lastError.message} (URL: ${lastAttemptedUrl})`
      : `Gagal mengunduh manifest symbols.json (${lastAttemptedUrl}).`;
  throw new Error(msg);
}

function isFileIntegrityOrMissingError(reason: string): boolean {
  return (
    reason.includes('404') ||
    reason.includes('500 KB') ||
    reason.includes('SVG') ||
    reason.includes('Format berkas') ||
    reason.includes('Berkas kosong') ||
    reason.includes('kebijakan keamanan')
  );
}

async function downloadSingleSymbolAsset(
  symbol: SymbolItem,
  preferMirrorFirst: boolean
): Promise<{ ok: true; usedMirror: boolean } | { ok: false; error: string; attemptedUrl?: string }> {
  if (!symbol.filename) {
    return { ok: true, usedMirror: false };
  }

  const primaryUrl = buildSymbolFileUrl(symbol.filename, preferMirrorFirst);
  const fallbackUrl = buildSymbolFileUrl(symbol.filename, !preferMirrorFirst);
  const candidates = Array.from(new Set([primaryUrl, fallbackUrl].filter(Boolean) as string[]));

  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'Nama berkas tidak valid atau ditolak kebijakan keamanan.',
      attemptedUrl: symbol.filename,
    };
  }

  let lastReason = 'Gagal mengunduh berkas';
  let lastAttemptedUrl = candidates[0];

  for (const url of candidates) {
    lastAttemptedUrl = url;
    try {
      const response = await fetchWithTimeoutAndRetry(url, FETCH_TIMEOUT_MS, 2);
      const result = await sanitizeDownloadedAsset(response, symbol.filename);
      if (!result.ok) {
        console.error('[BicaraKu Sync] Error:', url, result.error);
        return { ok: false, error: result.error, attemptedUrl: url };
      }

      await idbPutBlob(symbol.id, result.blob, result.mimeType);
      return { ok: true, usedMirror: url.includes('cdn.jsdelivr.net') };
    } catch (err) {
      lastReason = err instanceof Error ? err.message : 'Gagal mengunduh';
      if (lastReason.includes('404')) {
        continue;
      }
    }
  }

  return { ok: false, error: lastReason, attemptedUrl: lastAttemptedUrl };
}

export async function fetchAndStoreLicenseDocs(): Promise<LicenseDocs> {
  const fetchText = async (docName: 'LICENSE-MULBERRY.txt' | 'CREDITS.md'): Promise<string> => {
    const urls = getRepoDocUrls(docName);
    for (const url of urls) {
      try {
        const res = await fetchWithTimeoutAndRetry(url, FETCH_TIMEOUT_MS, 2);
        return await res.text();
      } catch {
        // Coba URL cermin berikutnya
      }
    }
    return '';
  };

  const [licenseMulberryText, creditsMdText] = await Promise.all([
    fetchText('LICENSE-MULBERRY.txt'),
    fetchText('CREDITS.md'),
  ]);

  const docs: LicenseDocs = {
    licenseMulberryText:
      licenseMulberryText ||
      'Mulberry Symbols — Copyright Steve Lee (mulberrysymbols.org).\nCreative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).',
    creditsMdText:
      creditsMdText ||
      'Kredit Simbol:\n- Mulberry Symbols oleh Steve Lee (https://mulberrysymbols.org) — CC BY-SA 4.0.',
    fetchedAt: Date.now(),
  };

  await setLicenseDocs(docs);
  return docs;
}

/**
 * MIGRASI: Jika penanda `bundledSymbolsVersion` belum ada atau berbeda dengan versi saat ini,
 * tandai simbol lama non-caregiver sebagai `source: 'legacy-seed'` dan siapkan penggantian
 * oleh manifest GitHub tanpa menghapus perubahan caregiver (`userModified = true` / `source = 'custom-photo'`).
 */
export async function migrateLegacySymbolsIfNeeded(): Promise<{
  migrated: boolean;
  symbols: SymbolItem[];
  meta: ManifestMeta | null;
}> {
  const [existingSymbols, existingMeta] = await Promise.all([
    idbGetAllSymbols(),
    getManifestMeta(),
  ]);

  if (existingMeta?.bundledSymbolsVersion === BUNDLED_SYMBOLS_VERSION) {
    return { migrated: false, symbols: existingSymbols, meta: existingMeta };
  }

  if (existingSymbols.length > 0) {
    console.info(
      '[BicaraKu Migration] Penanda bundledSymbolsVersion belum sesuai. Menandai simbol lama sebagai legacy-seed untuk diganti manifest GitHub.'
    );
    const taggedSymbols: SymbolItem[] = existingSymbols.map(sym =>
      isProtectedCaregiverSymbol(sym)
        ? sym
        : {
            ...sym,
            source: 'legacy-seed',
          }
    );

    await idbReplaceAllSymbols(taggedSymbols);

    const nextMeta: ManifestMeta = {
      version: existingMeta?.version || 'legacy-migrating',
      bundledSymbolsVersion: undefined,
      hash: '',
      downloadedAt: existingMeta?.downloadedAt || Date.now(),
      completedInit: false,
      offlineTextFallback: false,
    };
    await setManifestMeta(nextMeta);
    return { migrated: true, symbols: taggedSymbols, meta: nextMeta };
  }

  return { migrated: false, symbols: existingSymbols, meta: existingMeta };
}

/**
 * Menjalankan sinkronisasi awal, migrasi seed lama ke manifest, atau MELANJUTKAN unduhan yang terputus.
 */
export async function runInitialOrResumeSync(
  onProgress: (progress: SyncProgress) => void
): Promise<{ symbols: SymbolItem[]; summary: SyncSummary; diagnostics: SyncDiagnostics }> {
  await setSyncDiagnostics({
    manifestUrl: MANIFEST_URL,
    status: 'running',
    succeeded: 0,
    failed: 0,
    placeholders: 0,
    errors: [],
    usedMirror: false,
    updatedAt: Date.now(),
  });

  try {
    const migration = await migrateLegacySymbolsIfNeeded();
    let existingSymbols = migration.symbols;
    let existingMeta = migration.meta;
    let usedMirror = false;

    const hasLegacySeed = existingSymbols.some(
      s => s.source === 'legacy-seed' || s.source === 'builtin-offline'
    );
    const needsManifestFetch =
      existingSymbols.length === 0 || !existingMeta?.hash || hasLegacySeed;

    if (needsManifestFetch) {
      onProgress({
        phase: 'manifest',
        completed: 0,
        total: 1,
        currentLabel: 'Mengunduh daftar simbol (symbols.json)...',
      });
      const manifest = await fetchAndValidateManifest();
      usedMirror = manifest.usedMirror;

      const manifestMapped = await Promise.all(
        manifest.entries.map((entry, idx) => manifestEntryToSymbolItem(entry, idx))
      );

      // Pertahankan hanya simbol/perubahan buatan caregiver (userModified = true atau source = 'custom-photo').
      // Seluruh simbol seed lama ('legacy-seed' / 'builtin-offline') digantikan versi manifest
      // sehingga tidak ada kartu berlabel ganda.
      const preservedCaregiver = existingSymbols.filter(isProtectedCaregiverSymbol);
      const preservedById = new Map(preservedCaregiver.map(s => [s.id, s]));

      const mergedList: SymbolItem[] = manifestMapped.map(item => {
        const caregiverVersion = preservedById.get(item.id);
        if (caregiverVersion) {
          preservedById.delete(item.id);
          return caregiverVersion;
        }
        return item;
      });

      // Tambahkan simbol custom/foto pribadi baru buatan caregiver yang tidak berasal dari ID manifest
      for (const extra of preservedById.values()) {
        mergedList.unshift(extra);
      }

      await idbReplaceAllSymbols(mergedList);
      existingSymbols = mergedList;

      existingMeta = {
        version: manifest.version,
        bundledSymbolsVersion: BUNDLED_SYMBOLS_VERSION,
        hash: manifest.hash,
        downloadedAt: Date.now(),
        completedInit: false,
        offlineTextFallback: false,
      };
      await setManifestMeta(existingMeta);
    }

    const total = existingSymbols.length;
    const runErrors: SyncErrorItem[] = [];
    let runSucceeded = 0;
    let completedCount = existingSymbols.filter(
      s => s.downloadStatus === 'done' || s.downloadStatus === 'placeholder'
    ).length;

    onProgress({
      phase: 'images',
      completed: completedCount,
      total,
      currentLabel: 'Menyiapkan gambar simbol...',
      usedMirror,
    });

    // Antrean hanya untuk simbol dari manifest yang belum selesai (bisa dilanjutkan bila sempat terputus)
    const queue = existingSymbols.filter(
      s => !s.isPlaceholder && s.filename && s.downloadStatus !== 'done'
    );

    let queueIndex = 0;
    let consecutiveNetworkFailures = 0;
    let networkAbortedEarly = false;

    const worker = async () => {
      while (queueIndex < queue.length && !networkAbortedEarly) {
        const idx = queueIndex++;
        const sym = queue[idx];

        const res = await downloadSingleSymbolAsset(sym, usedMirror);
        if (res.ok) {
          if (res.usedMirror) usedMirror = true;
          consecutiveNetworkFailures = 0;
          sym.downloadStatus = 'done';
          sym.downloadError = undefined;
          sym.hasImageBlob = true;
          runSucceeded++;
        } else {
          sym.downloadStatus = 'failed';
          sym.downloadError = res.error;
          sym.hasImageBlob = false;
          runErrors.push({
            id: sym.id,
            label: sym.label,
            filename: sym.filename ?? null,
            attemptedUrl: res.attemptedUrl,
            reason: res.error,
            timestamp: Date.now(),
          });
          if (!isFileIntegrityOrMissingError(res.error)) {
            consecutiveNetworkFailures++;
            if (consecutiveNetworkFailures >= 12) {
              networkAbortedEarly = true;
            }
          }
        }

        // Simpan status per simbol secara langsung ke IndexedDB agar progres selalu dapat dilanjutkan
        await idbPutSymbol(sym);

        completedCount++;
        onProgress({
          phase: 'images',
          completed: Math.min(completedCount, total),
          total,
          currentLabel: sym.label,
          usedMirror,
        });
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, Math.max(1, queue.length)) },
      () => worker()
    );
    await Promise.all(workers);

    const networkErrors = runErrors.filter(e => !isFileIntegrityOrMissingError(e.reason));
    const totalNetworkDrop =
      networkAbortedEarly ||
      (queue.length > 0 &&
        networkErrors.length > 0 &&
        (runSucceeded === 0 || networkErrors.length >= 10 || networkErrors.length >= queue.length / 2));

    if (totalNetworkDrop) {
      const dropMsg =
        'Koneksi terputus sebelum unduhan simbol selesai. Simbol yang sudah berhasil tetap tersimpan di perangkat — tekan "Coba lagi" untuk melanjutkan sisanya.';
      const currentAll = await idbGetAllSymbols();
      await setSyncDiagnostics({
        manifestUrl: MANIFEST_URL,
        status: 'failed',
        succeeded: currentAll.filter(s => !s.isPlaceholder && s.downloadStatus === 'done').length,
        failed: runErrors.length,
        placeholders: currentAll.filter(s => s.isPlaceholder || !s.filename).length,
        errors: runErrors,
        usedMirror,
        lastErrorMessage: dropMsg,
        updatedAt: Date.now(),
      });
      throw new Error(dropMsg);
    }

    onProgress({
      phase: 'licenses',
      completed: total,
      total,
      currentLabel: 'Mengunduh berkas lisensi & kredit...',
      usedMirror,
    });

    await fetchAndStoreLicenseDocs();

    const updatedAll = await idbGetAllSymbols();
    const placeholders = updatedAll.filter(s => s.isPlaceholder || !s.filename).length;
    const doneAssets = updatedAll.filter(s => !s.isPlaceholder && s.downloadStatus === 'done');
    const succeeded = doneAssets.length;
    const customSucceeded = doneAssets.filter(s => s.source === 'custom' || s.isCustom).length;
    const mulberrySucceeded = succeeded - customSucceeded;
    const failedItems = updatedAll.filter(s => !s.isPlaceholder && s.downloadStatus === 'failed');
    const failed = failedItems.length;

    const allErrors: SyncErrorItem[] =
      runErrors.length > 0
        ? runErrors
        : failedItems.map(s => ({
            id: s.id,
            label: s.label,
            filename: s.filename ?? null,
            attemptedUrl: s.filename ? buildSymbolFileUrl(s.filename, usedMirror) || undefined : undefined,
            reason: s.downloadError || 'Gagal mengunduh berkas',
            timestamp: Date.now(),
          }));

    const summary: SyncSummary = {
      total: updatedAll.length,
      succeeded,
      mulberrySucceeded,
      customSucceeded,
      failed,
      placeholders,
      errors: allErrors,
      usedMirror,
      finishedAt: Date.now(),
    };

    const diagnostics: SyncDiagnostics = {
      manifestUrl: MANIFEST_URL,
      status: 'completed',
      succeeded,
      failed,
      placeholders,
      errors: allErrors,
      usedMirror,
      updatedAt: Date.now(),
    };

    await Promise.all([
      setManifestMeta({
        ...(existingMeta || { version: '1', hash: '', downloadedAt: Date.now() }),
        bundledSymbolsVersion: BUNDLED_SYMBOLS_VERSION,
        completedInit: true,
        offlineTextFallback: false,
        lastSummary: summary,
      }),
      setSyncDiagnostics(diagnostics),
    ]);

    onProgress({
      phase: 'done',
      completed: total,
      total,
      usedMirror,
    });

    return { symbols: updatedAll, summary, diagnostics };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Gagal mengunduh simbol.';
    const prevDiag = await getSyncDiagnostics();
    if (!prevDiag || prevDiag.status !== 'failed' || prevDiag.lastErrorMessage !== errMsg) {
      await setSyncDiagnostics({
        manifestUrl: MANIFEST_URL,
        status: 'failed',
        succeeded: prevDiag?.succeeded || 0,
        failed: prevDiag?.failed || 0,
        placeholders: prevDiag?.placeholders || 0,
        errors:
          prevDiag?.errors && prevDiag.errors.length > 0
            ? prevDiag.errors
            : [
                {
                  id: 'manifest-fetch',
                  label: 'Manifest symbols.json',
                  filename: 'symbols.json',
                  attemptedUrl: MANIFEST_URL,
                  reason: errMsg,
                  timestamp: Date.now(),
                },
              ],
        usedMirror: prevDiag?.usedMirror || false,
        lastErrorMessage: errMsg,
        updatedAt: Date.now(),
      });
    }
    throw err;
  }
}

/**
 * Fallback lokal ketika pengguna secara eksplisit memilih mode teks sementara saat offline.
 * Tidak menandai completedInit = true agar pembukaan berikutnya tetap mencoba mengunduh manifest.
 */
export async function activateOfflineTextFallback(): Promise<SymbolItem[]> {
  const existing = await idbGetAllSymbols();
  if (existing.length > 0) {
    const meta = await getManifestMeta();
    await setManifestMeta({
      version: meta?.version || 'offline-fallback',
      bundledSymbolsVersion: meta?.bundledSymbolsVersion,
      hash: meta?.hash || '',
      downloadedAt: meta?.downloadedAt || Date.now(),
      completedInit: false,
      offlineTextFallback: true,
    });
    return existing;
  }

  const offlineItems: SymbolItem[] = DEFAULT_SYMBOLS.map(sym => ({
    ...sym,
    filename: null,
    speechText: sym.spokenText || sym.label,
    isPlaceholder: false,
    isDefault: true,
    downloadStatus: 'failed',
    source: 'legacy-seed',
    license: 'Built-in Fallback',
    author: 'BicaraKu',
    commercialOk: true,
    attributionRequired: false,
    hasImageBlob: false,
  }));

  await idbReplaceAllSymbols(offlineItems);
  await setManifestMeta({
    version: 'offline-fallback',
    hash: '',
    downloadedAt: Date.now(),
    completedInit: false,
    offlineTextFallback: true,
  });

  return offlineItems;
}

/**
 * Siapkan ulang unduhan penuh dari MANIFEST_URL tanpa menghapus perubahan caregiver.
 */
export async function prepareRestartSymbolDownload(): Promise<void> {
  const existing = await idbGetAllSymbols();
  const resetQueue = existing.map(sym => {
    if (isProtectedCaregiverSymbol(sym)) {
      return sym;
    }
    return {
      ...sym,
      downloadStatus: sym.isPlaceholder ? ('placeholder' as const) : ('pending' as const),
      downloadError: undefined,
    };
  });
  await idbReplaceAllSymbols(resetQueue);
  const meta = await getManifestMeta();
  await setManifestMeta({
    version: meta?.version || '1',
    bundledSymbolsVersion: meta?.bundledSymbolsVersion,
    hash: '', // Kosongkan hash agar manifest terbaru diunduh ulang
    downloadedAt: Date.now(),
    completedInit: false,
    offlineTextFallback: false,
  });
}

/**
 * Reset simbol bawaan dari IndexedDB (menghapus simbol non-caregiver & blob bawaannya)
 * sebelum mengunduh ulang bersih dari MANIFEST_URL.
 */
export async function prepareResetBundledSymbols(keepCaregiverSymbols = true): Promise<void> {
  const existing = await idbGetAllSymbols();
  const kept: SymbolItem[] = [];

  for (const sym of existing) {
    if (keepCaregiverSymbols && isProtectedCaregiverSymbol(sym)) {
      kept.push(sym);
    } else {
      await idbDeleteBlob(sym.id);
    }
  }

  await idbReplaceAllSymbols(kept);
  await setManifestMeta({
    version: '',
    bundledSymbolsVersion: undefined,
    hash: '',
    downloadedAt: 0,
    completedInit: false,
    offlineTextFallback: false,
  });
}

/**
 * Periksa pembaruan manifest dari GitHub (dipicu manual oleh Caregiver).
 * Membandingkan hash isi manifest lalu menyusun daftar perubahan.
 */
export async function checkForManifestUpdates(currentSymbols: SymbolItem[]): Promise<{
  hasChanges: boolean;
  manifestHashMatched: boolean;
  manifest: ParsedManifestResult;
  diffs: SymbolUpdateDiffItem[];
}> {
  const [manifest, existingMeta] = await Promise.all([
    fetchAndValidateManifest(),
    getManifestMeta(),
  ]);

  const manifestHashMatched = !!existingMeta?.hash && existingMeta.hash === manifest.hash;
  const incomingItems = await Promise.all(
    manifest.entries.map((entry, idx) => manifestEntryToSymbolItem(entry, idx))
  );

  const currentMap = new Map(currentSymbols.map(s => [s.id, s]));
  const incomingMap = new Map(incomingItems.map(s => [s.id, s]));
  const diffs: SymbolUpdateDiffItem[] = [];

  for (const incoming of incomingItems) {
    const existing = currentMap.get(incoming.id);
    if (!existing) {
      diffs.push({
        id: incoming.id,
        label: incoming.label,
        type: 'added',
        incoming,
        userModified: false,
        resolution: 'use_new',
      });
    } else if (existing.contentHash !== incoming.contentHash) {
      const isModifiedByUser = isProtectedCaregiverSymbol(existing);
      diffs.push({
        id: incoming.id,
        label: existing.label,
        type: 'changed',
        incoming,
        existing,
        userModified: isModifiedByUser,
        resolution: isModifiedByUser ? 'keep_mine' : 'use_new',
      });
    }
  }

  for (const existing of currentSymbols) {
    if (
      !existing.isCustom &&
      existing.source !== 'builtin-offline' &&
      existing.source !== 'legacy-seed' &&
      existing.source !== 'custom-photo' &&
      !incomingMap.has(existing.id)
    ) {
      const isModifiedByUser = isProtectedCaregiverSymbol(existing);
      diffs.push({
        id: existing.id,
        label: existing.label,
        type: 'removed',
        existing,
        userModified: isModifiedByUser,
        resolution: isModifiedByUser ? 'keep_mine' : 'use_new',
      });
    }
  }

  return {
    hasChanges: !manifestHashMatched || diffs.length > 0,
    manifestHashMatched,
    manifest,
    diffs,
  };
}

/**
 * Terapkan pembaruan yang disetujui caregiver dengan menghormati userModified = true / source = 'custom-photo'.
 */
export async function applyManifestUpdates(
  diffs: SymbolUpdateDiffItem[],
  manifestMeta: { version: string; hash: string; usedMirror: boolean },
  currentSymbols: SymbolItem[]
): Promise<{ symbols: SymbolItem[]; summary: SyncSummary }> {
  const symbolMap = new Map(currentSymbols.map(s => [s.id, s]));
  const errors: SyncErrorItem[] = [];
  let succeeded = 0;
  let failed = 0;
  let placeholders = 0;

  const toDownload: SymbolItem[] = [];

  for (const diff of diffs) {
    if (diff.type === 'added' && diff.incoming && diff.resolution === 'use_new') {
      symbolMap.set(diff.id, diff.incoming);
      if (diff.incoming.isPlaceholder) placeholders++;
      else toDownload.push(diff.incoming);
    } else if (diff.type === 'changed' && diff.incoming) {
      if ((diff.existing && isProtectedCaregiverSymbol(diff.existing)) || diff.resolution === 'keep_mine') {
        continue;
      }
      const existing = diff.existing;
      const merged: SymbolItem = {
        ...diff.incoming,
        frequency: existing?.frequency || 0,
        lastUsed: existing?.lastUsed,
        userModified: false,
      };
      symbolMap.set(diff.id, merged);
      if (merged.isPlaceholder) placeholders++;
      else toDownload.push(merged);
    } else if (diff.type === 'removed') {
      if ((diff.existing && isProtectedCaregiverSymbol(diff.existing)) || diff.resolution === 'keep_mine') {
        continue;
      }
      symbolMap.delete(diff.id);
      await idbDeleteSymbol(diff.id);
    }
  }

  let idx = 0;
  const worker = async () => {
    while (idx < toDownload.length) {
      const sym = toDownload[idx++];
      const res = await downloadSingleSymbolAsset(sym, manifestMeta.usedMirror);
      if (res.ok) {
        sym.downloadStatus = 'done';
        sym.downloadError = undefined;
        sym.hasImageBlob = true;
        succeeded++;
      } else {
        sym.downloadStatus = 'failed';
        sym.downloadError = res.error;
        sym.hasImageBlob = false;
        failed++;
        errors.push({
          id: sym.id,
          label: sym.label,
          filename: sym.filename ?? null,
          attemptedUrl: res.attemptedUrl,
          reason: res.error,
          timestamp: Date.now(),
        });
      }
      symbolMap.set(sym.id, sym);
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, Math.max(1, toDownload.length)) },
    () => worker()
  );
  await Promise.all(workers);

  const rawUpdatedList = Array.from(symbolMap.values());
  const hasRealManifestItems = rawUpdatedList.some(
    s => s.source !== 'builtin-offline' && s.source !== 'legacy-seed' && !s.isCustom
  );
  const updatedList = hasRealManifestItems
    ? rawUpdatedList.filter(s => s.source !== 'builtin-offline' && s.source !== 'legacy-seed')
    : rawUpdatedList;

  await idbReplaceAllSymbols(updatedList);
  await fetchAndStoreLicenseDocs();

  const totalPlaceholders = updatedList.filter(s => s.isPlaceholder || !s.filename).length;
  const doneAssets = updatedList.filter(s => !s.isPlaceholder && s.downloadStatus === 'done');
  const customSucceeded = doneAssets.filter(s => s.source === 'custom' || s.isCustom).length;

  const summary: SyncSummary = {
    total: updatedList.length,
    succeeded: doneAssets.length,
    mulberrySucceeded: doneAssets.length - customSucceeded,
    customSucceeded,
    failed: updatedList.filter(s => !s.isPlaceholder && s.downloadStatus === 'failed').length,
    placeholders: totalPlaceholders,
    errors,
    usedMirror: manifestMeta.usedMirror,
    finishedAt: Date.now(),
  };

  await Promise.all([
    setManifestMeta({
      version: manifestMeta.version,
      bundledSymbolsVersion: BUNDLED_SYMBOLS_VERSION,
      hash: manifestMeta.hash,
      downloadedAt: Date.now(),
      completedInit: true,
      offlineTextFallback: false,
      lastSummary: summary,
    }),
    setSyncDiagnostics({
      manifestUrl: MANIFEST_URL,
      status: 'completed',
      succeeded: doneAssets.length,
      failed: summary.failed,
      placeholders: totalPlaceholders,
      errors,
      usedMirror: manifestMeta.usedMirror,
      updatedAt: Date.now(),
    }),
  ]);

  return { symbols: updatedList, summary };
}
