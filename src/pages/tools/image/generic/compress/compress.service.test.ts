import { beforeEach, describe, expect, it, vi } from 'vitest';
import imageCompression from 'browser-image-compression';
import { compressImage } from './service';

vi.mock('browser-image-compression', () => ({
  default: vi.fn()
}));

describe('compressImage', () => {
  beforeEach(() => {
    vi.mocked(imageCompression).mockResolvedValue(
      new File(['compressed'], 'photo.jpg', { type: 'image/jpeg' })
    );
  });

  it('preserves JPEG EXIF metadata while compressing', async () => {
    const input = new File(['original'], 'photo.jpg', {
      type: 'image/jpeg'
    });

    await compressImage(input, { maxFileSizeInMB: 1, quality: 80 });

    expect(imageCompression).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ preserveExif: true })
    );
  });
});
