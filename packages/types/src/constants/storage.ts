/**
 * Avatar media pipeline — single source of truth shared by API and web.
 *
 * Size is enforced on the application layer (client pre-check + server
 * `HeadObject` validation at commit time) because presigned PUT URLs cannot
 * carry an upper-bound `Content-Length` constraint (S3/R2 treat a signed
 * `ContentLength` as an exact match, and `Content-Length` is a forbidden
 * request header in the Fetch API). See docs/sprints/upload-media/README.md
 * for the full rationale.
 */
export const AVATAR = {
    /** Max size of the post-crop WebP blob that clients may upload (5 MB). */
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    /** Square canvas edge in pixels — clients crop to this, server resizes to this. */
    OUTPUT_SIZE: 512,
    /** Only output MIME allowed. Signed into presigned PUT URLs. */
    OUTPUT_FORMAT: 'image/webp',
    /** WebP quality used by `canvas.toBlob` on the client and `sharp.webp` on the server. */
    OUTPUT_QUALITY: 0.85,
    /** Input MIME types accepted by the file picker before cropping. HEIC is converted to JPEG on the client. */
    ALLOWED_MIME_TYPES: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
    ],
} as const;

export type AvatarOutputFormat = typeof AVATAR.OUTPUT_FORMAT;
export type AvatarAllowedMimeType = (typeof AVATAR.ALLOWED_MIME_TYPES)[number];
