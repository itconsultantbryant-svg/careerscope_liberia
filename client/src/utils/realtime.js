import api from './api';

// Socket-compatible surface so chat/community can use a serverless, durable
// Neon cursor without maintaining an unsupported WebSocket server on Vercel.
export function createRealtimeClient() {
  const handlers = new Map();
  let cursor;
  let closed = false;
  let timer;
  let connected = false;
  const dispatch = (name, data) => handlers.get(name)?.forEach((handler) => handler(data));
  const poll = async () => {
    if (closed) return;
    try {
      if (!document.hidden) {
        const response = await api.get('/realtime/events', { params: cursor === undefined ? {} : { after: cursor } });
        if (closed) return;
        cursor = response.data.cursor;
        if (!connected) { connected = true; dispatch('connect'); }
        response.data.events.forEach(({ event, payload }) => dispatch(event, payload));
      }
    } catch {
      if (connected) { connected = false; dispatch('disconnect'); }
    } finally {
      if (!closed) timer = setTimeout(poll, document.hidden ? 15000 : 2000);
    }
  };
  const client = {
    on(name, handler) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(handler); return client; },
    off(name, handler) { if (handler) handlers.get(name)?.delete(handler); else handlers.delete(name); return client; },
    emit(event, data) {
      // Saved messages and community changes are published atomically by the
      // server; clients only publish ephemeral typing/call signals.
      if (closed || ['join_conversation', 'leave_conversation', 'send_message', 'new_post', 'post_liked', 'new_comment'].includes(event)) return;
      api.post('/realtime/publish', { event, data }).catch(() => dispatch('delivery_error', { event }));
    },
    close() { closed = true; clearTimeout(timer); handlers.clear(); },
  };
  timer = setTimeout(poll, 0);
  return client;
}
