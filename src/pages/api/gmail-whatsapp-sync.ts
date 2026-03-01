import type { APIRoute } from 'astro';

export const prerender = false;

type GmailTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessageResponse = {
  id: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

const requiredEnvVars = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_USER',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TO'
] as const;

function getMissingEnvVars() {
  return requiredEnvVars.filter((name) => !import.meta.env[name]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSnippet(snippet?: string) {
  if (!snippet) return 'Sin extracto disponible.';
  return snippet.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function buildWhatsAppText(message: GmailMessageResponse) {
  const headers = message.payload?.headers ?? [];
  const subject = headers.find((header) => header.name.toLowerCase() === 'subject')?.value ?? '(sin asunto)';
  const from = headers.find((header) => header.name.toLowerCase() === 'from')?.value ?? 'Desconocido';
  const date = headers.find((header) => header.name.toLowerCase() === 'date')?.value ?? 'Sin fecha';

  return [
    '📬 Nuevo correo en Gmail',
    `De: ${from}`,
    `Asunto: ${subject}`,
    `Fecha: ${date}`,
    '',
    `Extracto: ${normalizeSnippet(message.snippet)}`
  ].join('\n');
}

async function getGmailAccessToken() {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: import.meta.env.GMAIL_CLIENT_ID,
      client_secret: import.meta.env.GMAIL_CLIENT_SECRET,
      refresh_token: import.meta.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`No se pudo obtener token de Gmail: ${errorText}`);
  }

  const tokenJson = (await tokenResponse.json()) as GmailTokenResponse;
  return tokenJson.access_token;
}

async function listUnreadMessages(accessToken: string) {
  const query = import.meta.env.GMAIL_QUERY ?? 'is:unread in:inbox';
  const maxResults = Number(import.meta.env.GMAIL_MAX_RESULTS ?? '5');
  const user = encodeURIComponent(import.meta.env.GMAIL_USER);

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`No se pudieron listar correos: ${errorText}`);
  }

  const listJson = (await listResponse.json()) as GmailListResponse;
  return listJson.messages ?? [];
}

async function getMessageDetails(accessToken: string, messageId: string) {
  const user = encodeURIComponent(import.meta.env.GMAIL_USER);
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`No se pudo obtener detalle del correo ${messageId}: ${errorText}`);
  }

  return (await response.json()) as GmailMessageResponse;
}

async function sendWhatsAppMessage(text: string) {
  const url = `https://graph.facebook.com/v22.0/${import.meta.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: import.meta.env.WHATSAPP_TO,
      type: 'text',
      text: {
        body: text,
        preview_url: false
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falló envío a WhatsApp: ${errorText}`);
  }
}

async function markAsRead(accessToken: string, messageId: string) {
  const shouldMarkAsRead = (import.meta.env.GMAIL_MARK_AS_READ ?? 'true').toLowerCase() === 'true';
  if (!shouldMarkAsRead) return;

  const user = encodeURIComponent(import.meta.env.GMAIL_USER);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD']
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`No se pudo marcar como leído ${messageId}: ${errorText}`);
  }
}

function isAuthorizedRequest(request: Request) {
  const expectedToken = import.meta.env.CRON_SECRET;
  if (!expectedToken) return true;

  const authHeader = request.headers.get('authorization');
  const match = authHeader?.match(new RegExp(`^Bearer\\s+${escapeRegExp(expectedToken)}$`, 'i'));
  return Boolean(match);
}

async function runSync() {
  const accessToken = await getGmailAccessToken();
  const messages = await listUnreadMessages(accessToken);

  const deliveredIds: string[] = [];

  for (const message of messages) {
    const detail = await getMessageDetails(accessToken, message.id);
    await sendWhatsAppMessage(buildWhatsAppText(detail));
    await markAsRead(accessToken, message.id);
    deliveredIds.push(message.id);
  }

  return {
    processed: messages.length,
    deliveredIds
  };
}

async function handler(request: Request) {
  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Faltan variables de entorno: ${missingEnvVars.join(', ')}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  if (!isAuthorizedRequest(request)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await runSync();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const GET: APIRoute = async ({ request }) => handler(request);
export const POST: APIRoute = async ({ request }) => handler(request);
