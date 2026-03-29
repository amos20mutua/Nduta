const { json } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { loadEvents } = require('./_lib/events');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const events = await loadEvents();
    const candidates = events
      .map((item) => ({
        eventId: String(item?.id || '').trim(),
        capacity: Math.max(0, Number(item?.ticketing?.capacity || 0))
      }))
      .filter((item) => item.eventId);

    const supabase = getSupabaseAdmin();
    const items = [];

    for (const item of candidates) {
      if (item.capacity <= 0) {
        items.push({ eventId: item.eventId, capacity: 0, sold: 0, remaining: null });
        continue;
      }

      const { count } = await supabase
        .from('tickets')
        .select('id', { head: true, count: 'exact' })
        .eq('event_id', item.eventId);

      const sold = Number(count || 0);
      items.push({
        eventId: item.eventId,
        capacity: item.capacity,
        sold,
        remaining: Math.max(0, item.capacity - sold)
      });
    }

    return json(200, { items });
  } catch (error) {
    return json(500, { error: 'Failed to load availability', detail: error.message });
  }
};
