import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const inr = n => `₹${Number(n || 0).toFixed(0)}`;
const REASON = {
  customer_absent: 'customer was not available', gate_closed: 'the gate was closed',
  wrong_address: 'the address could not be found', refused: 'the order was refused',
  vehicle_issue: 'a vehicle problem', other: 'an unexpected issue'
};
const ist = t => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

const templates = {
  order_confirmed: p => ({ subject: `Order confirmed for ${p.date}`,
    body: `Your GharFresh order for ${p.date} is confirmed (${inr(p.total)} paid from wallet). Delivery before 7:30 AM. You can change tomorrow's basket until 10 PM.` }),
  order_on_hold: p => ({ subject: `Action needed: delivery on ${p.date} is on hold`,
    body: `Your wallet balance (${inr(p.balance)}) is lower than the order amount (${inr(p.total)}), so we have put your delivery on ${p.date} on hold. Please add money to your wallet and contact support to release it. You have not been charged.` }),
  out_for_delivery: p => ({ subject: 'Your order is out for delivery',
    body: `Your GharFresh order for ${p.date} is on its way.` }),
  delivered: p => ({ subject: `Delivered at ${ist(p.at)}`,
    body: `Your GharFresh order was delivered at ${ist(p.at)}. You can view the delivery photo in My orders.` }),
  delivery_failed: p => ({ subject: 'We could not deliver your order',
    body: `Sorry, we could not deliver your order for ${p.date} because ${REASON[p.reason] || 'an issue'}.` +
      (p.paid ? ` Open My orders and tap "Refund to wallet" to get ${inr(p.total)} back instantly.` : '') }),
  refund_processed: p => ({ subject: `Refund of ${inr(p.amount)} processed`,
    body: `${inr(p.amount)} has been credited to your GharFresh wallet. Transaction ID: ${String(p.tx_id).slice(0, 8)}. New balance: ${inr(p.balance)}.` }),
  wallet_low: p => ({ subject: 'Your wallet balance is low',
    body: `Your GharFresh wallet balance is ${inr(p.balance)}. Please recharge so your daily deliveries are not held.` })
};

const html = (name, body) => `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
<div style="background:#0B5D3B;color:#fff;padding:14px 18px;font-weight:bold">GharFresh</div>
<div style="padding:18px"><p>Hi ${name || 'there'},</p><p>${body}</p>
<p style="color:#6b7280;font-size:12px">Fresh at your door, every morning.</p></div></div>`;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key,
          BREVO_API_KEY: brevo, BREVO_SENDER_EMAIL: from } = process.env;
  if (!url || !key || !brevo || !from) {
    return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows } = await db.from('notifications').select('*')
    .eq('status', 'pending').eq('channel', 'email').lt('attempts', 5)
    .order('created_at').limit(20);

  let sent = 0, failed = 0;
  for (const n of rows || []) {
    // claim the row so two runs never send the same email
    const { data: claimed } = await db.from('notifications')
      .update({ status: 'sending', attempts: n.attempts + 1 })
      .eq('id', n.id).eq('status', 'pending').select();
    if (!claimed?.length) continue;

    try {
      const tpl = templates[n.template];
      if (!tpl) throw new Error(`Unknown template ${n.template}`);
      const { data: prof } = await db.from('profiles').select('email, full_name').eq('id', n.user_id).single();
      if (!prof?.email) throw new Error('No email for user');
      const m = tpl(n.payload || {});
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevo, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: process.env.BREVO_SENDER_NAME || 'GharFresh', email: from },
          to: [{ email: prof.email, name: prof.full_name || undefined }],
          subject: m.subject, htmlContent: html(prof.full_name, m.body)
        })
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await db.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', n.id);
      sent++;
    } catch (e) {
      failed++;
      await db.from('notifications').update({
        status: n.attempts + 1 >= 5 ? 'failed' : 'pending', last_error: String(e.message).slice(0, 300)
      }).eq('id', n.id);
    }
  }
  return NextResponse.json({ sent, failed });
}

export const POST = handle;
export const GET = handle;
