/**
 * Resizes an image to a maximum width/height and encodes it as compressed WebP.
 * By default flattens onto a white background (fixes transparent PNGs turning
 * black on product/banner photos). Pass preserveTransparency=true for assets like
 * logos that need to keep their alpha channel so they work on any background color.
 * Returns a base64 encoded WebP data URL. Browsers without WebP encoding support
 * fall back to PNG automatically (native `canvas.toDataURL` behavior).
 */
export async function compressToWebP(base64Str: string, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.85, preserveTransparency: boolean = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      if (!preserveTransparency) {
        // Fill canvas with white background for transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = (error) => reject(error);
  });
}
