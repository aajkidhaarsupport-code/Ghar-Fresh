'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { queue, syncQueue, compressImage, getPosition } from '@/lib/riderQueue';

const REASONS = [
  ['customer_absent', 'Customer absent'], ['gate_closed', 'Gate closed'], ['wrong_address', 'Wrong address'],
  ['refused', 'Refused'], ['vehicle_issue', 'Vehicle issue'], ['other', 'Other']
];

export default function Rider() {
  const [stops, setStops] = useState([]);
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState(null);   // { order_id, mode }
  const [photo, setPhoto] = useState('');
  const [reason, setReason] = useState('customer_absent');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('rider_my_route');
    if (error) {
      const cached = localStorage.getItem('gf_route_cache');
      if (cached) { setStops(JSON.parse(cached)); setMsg('Offline: showing saved route'); }
      else setMsg(error.message);
    } else {
      setStops(data || []);
      localStorage.setItem('gf_route_cache', JSON.stringify(data || []));
    }
    setPending(queue.get());
  }, []);

  const sync = useCallback(async () => {
    if (queue.get().length === 0) { await load(); return; }
    const r = await syncQueue(supabase);
    if (r.errors.length) setMsg(r.errors.join(' | '));
    else if (r.synced) setMsg(`${r.synced} update(s) synced`);
    await load();
  }, [load]);

  useEffect(() => {
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [sync]);

  const queuedStatus = id => pending.find(p => p.order_id === id)?.type;
  const statusOf = s => queuedStatus(s.order_id) || s.status;
  const delivered = stops.filter(s => statusOf(s) === 'delivered').length;
  const failed = stops.filter(s => statusOf(s) === 'failed').length;
  const left = stops.length - delivered - failed;

  async function startRoute() {
    const { error } = await supabase.rpc('rider_start_route');
    setMsg(error ? error.message : 'Route started'); load();
  }

  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (f) setPhoto(await compressImage(f));
  }

  async function confirmDelivered() {
    setBusy(true); setMsg('');
    try {
      if (!photo) throw new Error('Take a photo of the delivery first');
      const pos = await getPosition();
      queue.push({ type: 'delivered', order_id: active.order_id, photo, lat: pos.lat, lng: pos.lng, at: new Date().toISOString() });
      setActive(null); setPhoto('');
      await sync();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function confirmFailed() {
    setBusy(true); setMsg('');
    let pos = {};
    try { pos = await getPosition(); } catch { /* GPS optional for failures */ }
    queue.push({ type: 'failed', order_id: active.order_id, reason, notes, lat: pos.lat, lng: pos.lng });
    setActive(null); setNotes('');
    await sync();
    setBusy(false);
  }

  const navUrl = s => s.lat && s.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([s.house_no, s.line1, s.society].filter(Boolean).join(', '))}`;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
        {[['Stops', stops.length], ['Left', left], ['Done', delivered], ['Failed', failed]].map(([k, v]) => (
          <div key={k} className="bg-white rounded-xl p-2 shadow-sm"><div className="text-xs text-gray-500">{k}</div><div className="font-semibold text-brand">{v}</div></div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 text-sm flex justify-between items-center">
          <span>{pending.length} update(s) saved on phone, waiting to sync</span>
          <button className="text-brand font-medium" onClick={sync}>Sync now</button>
        </div>
      )}
      {msg && <p className="text-sm text-brand mb-3">{msg}</p>}

      {stops.length > 0 && stops.some(s => ['pending', 'packed'].includes(s.status)) && (
        <button className="w-full bg-brand text-white rounded-xl py-3 font-semibold mb-3" onClick={startRoute}>Start route</button>
      )}
      {stops.length === 0 && <p className="text-gray-500">No deliveries assigned for today.</p>}

      {stops.map(s => {
        const st = statusOf(s);
        const done = ['delivered', 'failed'].includes(st);
        return (
          <div key={s.order_id} className={`bg-white rounded-2xl p-4 mb-3 shadow-sm ${done ? 'opacity-70' : ''}`}>
            <div className="flex justify-between">
              <div className="font-semibold">#{s.sequence} · {s.customer}</div>
              <span className="text-xs bg-cream px-2 py-1 rounded-full">
                {st.replace(/_/g, ' ')}{queuedStatus(s.order_id) ? ' (saved offline)' : ''}
              </span>
            </div>
            <div className="text-sm text-gray-600">{s.house_no}, {s.line1}{s.line2 ? `, ${s.line2}` : ''}</div>
            {s.landmark && <div className="text-sm text-gray-500">Landmark: {s.landmark}</div>}
            {s.instructions && <div className="text-sm text-accent">Note: {s.instructions}</div>}
            {s.phone_masked && <div className="text-xs text-gray-500">Phone: {s.phone_masked}</div>}
            <div className="text-sm mt-2">{s.items?.map((i, k) => <div key={k}>{i.qty} × {i.name} {i.pack}</div>)}</div>

            {!done && active?.order_id !== s.order_id && (
              <div className="flex gap-2 mt-3">
                <a href={navUrl(s)} target="_blank" rel="noreferrer" className="flex-1 text-center border border-brand text-brand rounded-lg py-2 text-sm">Navigate</a>
                <button className="flex-1 bg-brand text-white rounded-lg py-2 text-sm" onClick={() => { setActive({ order_id: s.order_id, mode: 'delivered' }); setPhoto(''); }}>Delivered</button>
                <button className="flex-1 border border-red-300 text-red-600 rounded-lg py-2 text-sm" onClick={() => setActive({ order_id: s.order_id, mode: 'failed' })}>Failed</button>
              </div>
            )}

            {active?.order_id === s.order_id && active.mode === 'delivered' && (
              <div className="mt-3">
                <label className="block text-center border-2 border-dashed border-brand rounded-xl py-4 text-brand">
                  {photo ? 'Retake photo' : 'Take delivery photo'}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
                </label>
                {photo && <img src={photo} alt="proof" className="mt-2 rounded-xl max-h-48 mx-auto" />}
                <div className="text-xs text-gray-500 mt-2">GPS location and time are recorded automatically.</div>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 border rounded-lg py-2" onClick={() => setActive(null)}>Back</button>
                  <button disabled={busy || !photo} className="flex-1 bg-brand text-white rounded-lg py-2 disabled:opacity-50" onClick={confirmDelivered}>
                    {busy ? 'Saving…' : 'Confirm delivered'}
                  </button>
                </div>
              </div>
            )}

            {active?.order_id === s.order_id && active.mode === 'failed' && (
              <div className="mt-3">
                <select className="w-full border rounded-xl px-3 py-3 mb-2" value={reason} onChange={e => setReason(e.target.value)}>
                  {REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input className="w-full border rounded-xl px-3 py-3 mb-2" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
                <div className="flex gap-2">
                  <button className="flex-1 border rounded-lg py-2" onClick={() => setActive(null)}>Back</button>
                  <button disabled={busy} className="flex-1 bg-red-600 text-white rounded-lg py-2 disabled:opacity-50" onClick={confirmFailed}>Confirm failed</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {stops.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mt-4">
          <div className="font-medium mb-1">End-of-day summary</div>
          <div className="text-sm">Delivered: {delivered} · Failed: {failed} · Pending: {left}</div>
        </div>
      )}
      <button className="w-full mt-6 text-sm text-gray-500" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}>Logout</button>
    </div>
  );
}
