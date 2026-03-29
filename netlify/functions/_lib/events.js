const { getContent } = require('./content');

async function loadEvents() {
  const result = await getContent('/content/events.json');
  if (!result?.payload) throw new Error('Could not load events content');
  return Array.isArray(result.payload?.items) ? result.payload.items : [];
}

module.exports = { loadEvents };
