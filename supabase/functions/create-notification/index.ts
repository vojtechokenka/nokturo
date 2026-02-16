import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      recipient_id,
      sender_id,
      type,
      title,
      message,
      link,
      reference_type,
      reference_id,
      metadata,
    } = await req.json();

    // Validate required fields
    if (!recipient_id || !type || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_id, type, title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplication: check if a non-dismissed notification with same recipient + link exists (last hour)
    if (link) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipient_id)
        .eq('link', link)
        .eq('dismissed', false)
        .gte('created_at', oneHourAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ message: 'Notification already exists', id: existing[0].id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create notification
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        recipient_id,
        sender_id: sender_id || null,
        type,
        title,
        message: message || null,
        link: link || null,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        metadata: metadata || {},
        read: false,
        dismissed: false,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create notification error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
