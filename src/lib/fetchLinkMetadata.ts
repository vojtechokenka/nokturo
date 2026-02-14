/**
 * Fetches link metadata (title) from fetch-link-metadata Edge Function.
 * Non-blocking: on 401, 500, or any error returns empty object – UI should fallback to URL/name.
 * Never throws – avoids blocking UI.
 */
import { supabase } from './supabase';

export interface LinkMetadataResult {
  title: string;
}

const emptyResult: LinkMetadataResult = { title: '' };

/**
 * Fetches metadata for a URL. On error (401, 500, timeout, etc.) returns empty object.
 * Caller should display URL or name as fallback when title is empty.
 * Never throws – explicitly passes JWT from current Supabase session for auth.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadataResult> {
  if (!url?.trim() || !url.startsWith('http')) return emptyResult;

  try {
    new URL(url);
  } catch {
    return emptyResult;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
      body: { url },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (error) return emptyResult;
    if (data?.title && typeof data.title === 'string') return { title: data.title };
    return emptyResult;
  } catch {
    return emptyResult;
  }
}
