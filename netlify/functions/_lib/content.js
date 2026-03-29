const fs = require('fs/promises');
const path = require('path');
const { getSupabaseAdmin } = require('./supabase');

const ALLOWED_PATHS = new Set([
  '/content/settings.json',
  '/content/homepage.json',
  '/content/events.json',
  '/content/music.json',
  '/content/media.json',
  '/content/theme.json'
]);

function isAllowedContentPath(contentPath) {
  return ALLOWED_PATHS.has(contentPath);
}

async function readStaticContent(contentPath) {
  const relativePath = String(contentPath || '').replace(/^\/+/, '');
  const filePath = path.resolve(process.cwd(), relativePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function getContent(contentPath) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('site_content')
    .select('payload,updated_at')
    .eq('path', contentPath)
    .maybeSingle();

  if (data?.payload) {
    return { payload: data.payload, updatedAt: data.updated_at || null, source: 'db' };
  }

  try {
    const payload = await readStaticContent(contentPath);
    return { payload, updatedAt: null, source: 'static' };
  } catch {
    return { payload: null, updatedAt: null, source: 'none' };
  }
}

async function upsertContent(contentPath, payload) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('site_content').upsert({
    path: contentPath,
    payload,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

module.exports = { isAllowedContentPath, readStaticContent, getContent, upsertContent };
