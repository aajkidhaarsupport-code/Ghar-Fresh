// Offline-first queue for rider actions. Saved on the phone, synced when network returns.
const KEY = 'gf_rider_queue';

export const queue = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } },
  set(q) { localStorage.setItem(KEY, JSON.stringify(q)); },
  push(item) { const q = this.get(); q.push({ ...item, queued_at: Date.now() }); this.set(q); }
};

const isNetworkError = (e) =>
  !navigator.onLine || /fetch|network|load failed/i.test(e?.message || '');

export async function syncQueue(supabase) {
  let q = queue.get();
  const errors = [];
  let synced = 0;
  for (const item of [...q]) {
    try {
      if (item.type === 'delivered') {
        const blob = await (await fetch(item.photo)).blob();
        const path = `${item.order_id}/proof.jpg`;
        const up = await supabase.storage.from('delivery-proofs')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.rpc('rider_mark_delivered', {
          p_order: item.order_id, p_photo: path, p_lat: item.lat, p_lng: item.lng, p_at: item.at
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('rider_mark_failed', {
          p_order: item.order_id, p_reason: item.reason, p_notes: item.notes || null,
          p_lat: item.lat ?? null, p_lng: item.lng ?? null
        });
        if (error) throw error;
      }
      q = q.filter(x => x.queued_at !== item.queued_at);
      queue.set(q);
      synced++;
    } catch (e) {
      if (isNetworkError(e)) break;                       // keep everything, try again later
      errors.push(`${item.order_id.slice(0, 8)}: ${e.message}`);
      q = q.filter(x => x.queued_at !== item.queued_at);  // business error: drop and report
      queue.set(q);
    }
  }
  return { synced, errors, left: queue.get().length };
}

// Shrink the photo so it is small to store and upload
export function compressImage(file, maxSide = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not supported on this phone')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Please turn on location (GPS) and allow it for this app')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  });
}
