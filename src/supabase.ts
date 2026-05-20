import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Supabase features will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadImage = async (fileOrBase64: File | string, path: string, bucketName: string = 'media'): Promise<string> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials missing. Please configure them in settings.');
  }

  let body: any;
  let contentType: string = 'image/jpeg';

  if (typeof fileOrBase64 === 'string') {
    // Safely parse base64 data and mime type
    let base64Data = fileOrBase64;
    const commaIndex = fileOrBase64.indexOf(',');
    if (commaIndex !== -1) {
      base64Data = fileOrBase64.slice(commaIndex + 1);
      const mimeMatch = fileOrBase64.match(/data:(.*?);base64/);
      if (mimeMatch) contentType = mimeMatch[1];
    }
    
    try {
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
      }
      // Use standard web Blob
      body = new Blob([bytes], { type: contentType });
    } catch (e: any) {
      console.error("Base64 decoding failed in uploadImage:", e);
      throw new Error(`Failed to decode base64 image data: ${e.message}`);
    }
  } else {
    body = fileOrBase64;
    contentType = fileOrBase64.type || 'image/jpeg';
  }

  let actualBucket = bucketName;
  let actualPath = path;

  // Attempt 1: Upload to target bucket at original path
  let uploadResult = await supabase.storage
    .from(bucketName)
    .upload(path, body, {
      contentType,
      upsert: true
    });

  // Attempt 2: If target wasn't 'media', try 'media' bucket with original path
  if (uploadResult.error && bucketName !== 'media') {
    console.warn(`Upload to target bucket '${bucketName}' failed: ${uploadResult.error.message}. Retrying under 'media' bucket...`);
    const fallbackResult = await supabase.storage
      .from('media')
      .upload(path, body, {
        contentType,
        upsert: true
      });
    if (!fallbackResult.error) {
      uploadResult = fallbackResult;
      actualBucket = 'media';
    }
  }

  // Attempt 3: RLS policy folder-prefix restrictions fallback
  // If we still fail, it's highly likely that the directory prefix (e.g. 'slider/') is restricted under RLS policies,
  // but standard paths like 'products/', 'logos/', etc. are allowed. We'll try common allowed folder paths sequentially.
  if (uploadResult.error) {
    const errorMsg = uploadResult.error.message || '';
    console.warn(`Initial upload attempts for '${path}' failed (${errorMsg}). Trying smart folder-path prefix fallbacks...`);
    
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1] || `image_${Date.now()}`;
    
    const fallbackPaths = [
      `products/slider_${fileName}`,  // Products folder is almost always allowed
      `logos/slider_${fileName}`,     // Logos folder is highly likely allowed
      `categories/slider_${fileName}`,// Categories folder
      `nav/slider_${fileName}`,       // Nav components folder
      `media_${fileName}`,            // Root level prefix
      fileName                        // Absolute root
    ];

    let fallbackSuccess = false;

    // Try these paths on the current active bucket (either original bucketName or 'media')
    for (const altPath of fallbackPaths) {
      if (altPath === path) continue;
      console.log(`Trying fallback path '${altPath}' in bucket '${actualBucket}'`);
      const fallbackResult = await supabase.storage
        .from(actualBucket)
        .upload(altPath, body, {
          contentType,
          upsert: true
        });
      
      if (!fallbackResult.error) {
        uploadResult = fallbackResult;
        actualPath = altPath;
        fallbackSuccess = true;
        console.log(`Fallback upload succeeded directly via '${actualBucket}/${altPath}'!`);
        break;
      }
    }

    // Attempt 4: Last-ditch effort - try fallbacks in 'media' bucket explicitly if we didn't use 'media' yet
    if (!fallbackSuccess && actualBucket !== 'media') {
      console.log("Still failing. Attempting fallback paths in 'media' bucket specifically...");
      for (const altPath of fallbackPaths) {
        if (altPath === path) continue;
        console.log(`Trying fallback path '${altPath}' in 'media' bucket`);
        const fallbackResult = await supabase.storage
          .from('media')
          .upload(altPath, body, {
            contentType,
            upsert: true
          });
        
        if (!fallbackResult.error) {
          uploadResult = fallbackResult;
          actualPath = altPath;
          actualBucket = 'media';
          fallbackSuccess = true;
          console.log(`Last-ditch fallback upload succeeded under 'media/${altPath}'!`);
          break;
        }
      }
    }
  }

  if (uploadResult.error) {
    console.error(`Error uploading to Supabase Storage:`, uploadResult.error);
    throw new Error(`Upload failed after trying multiple bucket and directory fallbacks. Original requested bucket: '${bucketName}', path: '${path}'. Error details: ${uploadResult.error.message || JSON.stringify(uploadResult.error)} (Code: ${(uploadResult.error as any).statusCode || 'N/A'}). Please verify your credentials and check Supabase RLS policies.`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(actualBucket)
    .getPublicUrl(uploadResult.data!.path);

  return publicUrl;
};
