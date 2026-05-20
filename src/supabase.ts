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
    // Handle base64
    const base64Data = fileOrBase64.split(',')[1];
    const mimeMatch = fileOrBase64.match(/data:(.*?);base64/);
    if (mimeMatch) contentType = mimeMatch[1];
    
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    body = bytes.buffer;
  } else {
    body = fileOrBase64;
    contentType = fileOrBase64.type;
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, body, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return publicUrl;
};
