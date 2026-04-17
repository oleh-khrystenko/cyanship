import { isHeic } from './convertHeic';

function makeFile(name: string, type: string): File {
    return new File([new Blob(['x'])], name, { type });
}

describe('isHeic', () => {
    it('detects HEIC by MIME type', () => {
        expect(isHeic(makeFile('photo.heic', 'image/heic'))).toBe(true);
    });

    it('detects HEIF by MIME type', () => {
        expect(isHeic(makeFile('photo.heif', 'image/heif'))).toBe(true);
    });

    it('detects HEIC by extension when MIME is empty (Safari/iOS)', () => {
        // Safari sometimes hands HEIC files to the file picker with type=''
        // — the extension check is the only signal that survives this.
        expect(isHeic(makeFile('IMG_0123.HEIC', ''))).toBe(true);
        expect(isHeic(makeFile('IMG_0123.heic', ''))).toBe(true);
    });

    it('detects HEIF by extension when MIME is empty', () => {
        expect(isHeic(makeFile('photo.HEIF', ''))).toBe(true);
    });

    it('returns false for non-HEIC MIME types', () => {
        expect(isHeic(makeFile('photo.jpg', 'image/jpeg'))).toBe(false);
        expect(isHeic(makeFile('photo.png', 'image/png'))).toBe(false);
        expect(isHeic(makeFile('photo.webp', 'image/webp'))).toBe(false);
    });

    it('returns false for non-HEIC extension with empty MIME', () => {
        expect(isHeic(makeFile('photo.jpg', ''))).toBe(false);
        expect(isHeic(makeFile('photo', ''))).toBe(false);
    });

    it('is case-insensitive on MIME type', () => {
        expect(isHeic(makeFile('photo.heic', 'IMAGE/HEIC'))).toBe(true);
    });
});
