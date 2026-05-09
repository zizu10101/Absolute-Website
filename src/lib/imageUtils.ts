/**
 * Resizes an image to a maximum width and height while maintaining aspect ratio.
 * Returns a base64 encoded string of the resized image.
 */
export async function resizeImage(base64Str: string, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.7): Promise<string> {
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

      ctx.drawImage(img, 0, 0, width, height);
      
      // Determine output format: preserve transparency for PNG/SVG
      const isTransparent = base64Str.startsWith('data:image/png') || base64Str.startsWith('data:image/svg');
      const format = isTransparent ? 'image/png' : 'image/jpeg';
      
      resolve(canvas.toDataURL(format, isTransparent ? undefined : quality));
    };
    img.onerror = (error) => reject(error);
  });
}
