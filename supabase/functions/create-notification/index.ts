import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ data: null, error: { message: 'Authorization required' } }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ data: null, error: { message: 'Unauthorized' } }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { notifications } = await req.json();

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return new Response(JSON.stringify({ data: null, error: { message: 'Invalid payload' } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ensure all sender_ids match the authenticated user
  const invalidSender = notifications.find((n: { sender_id?: string }) => n.sender_id !== user.id);
  if (invalidSender) {
    return new Response(JSON.stringify({ data: null, error: { message: 'sender_id must match authenticated user' } }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(notifications)
    .select('id');

  return new Response(JSON.stringify({ data, error }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
