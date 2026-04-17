const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

/**
 * HEIC detection with two signals — MIME and extension.
 *
 * Safari/iOS sometimes hands the file picker a `File` with an empty `type`
 * for HEIC sources, so the extension check is load-bearing (not belt-and-
 * suspenders). The MIME-only path alone would silently miss iPhone uploads.
 */
export function isHeic(file: File): boolean {
    if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) {
        return true;
    }
    const lowerName = file.name.toLowerCase();
    return HEIC_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Convert a HEIC/HEIF file to JPEG on the client.
 *
 * `heic2any` is ~200 KB — dynamically imported so it lands in a separate
 * chunk, loaded only when a user actually selects a HEIC file.
 *
 * The library returns either a single `Blob` or `Blob[]` (multi-frame HEIC).
 * For avatars we take the first frame — multi-frame HEIC is rare and the
 * first frame is a well-defined default.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
    const heic2any = (await import('heic2any')).default;

    const result = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
    });

    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

    return new File([blob], newName, { type: 'image/jpeg' });
}
