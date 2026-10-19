'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('login');          // login | signup
  const [f, setF] = useState({ first: '', middle: '', last: '', email: '', phone: '' });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });

  async function sendCode() {
    setMsg('');
    const email = f.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg('Enter a valid email'); return; }
    if (mode === 'signup') {
      if (!f.first.trim() || !f.last.trim()) { setMsg('First name and last name are required'); return; }
      if (!/^[6-9]\d{9}$/.test(f.phone.trim())) { setMsg('Enter a valid 10-digit mobile number'); return; }
    }
    setBusy(true);
    const full_name = [f.first, f.middle, f.last].map(s => s.trim()).filter(Boolean).join(' ');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: mode === 'signup'
        ? { shouldCreateUser: true, data: { full_name, phone: f.phone.trim() } }
        : { shouldCreateUser: false }
    });
    setBusy(false);
    if (error) {
      setMsg(/signups? not allowed|not found/i.test(error.message)
        ? 'No account found with this email. Please sign up first.' : error.message);
    } else setSent(true);
  }

  async function verify() {
    setMsg(''); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: f.email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg(error.message); else window.location.href = '/';
  }

  const tab = on => `flex-1 py-2.5 rounded-lg text-sm font-semibold ${on ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`;
  return (
    <div className="mt-4">
      <h1 className="text-2xl font-bold mb-1">Welcome to GharFresh</h1>
      <p className="text-gray-500 text-sm mb-4">Fresh milk and dairy, delivered every morning.</p>

      {!sent ? (
        <div className="card p-4">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            <button className={tab(mode === 'login')} onClick={() => { setMode('login'); setMsg(''); }}>Login</button>
            <button className={tab(mode === 'signup')} onClick={() => { setMode('signup'); setMsg(''); }}>Sign up</button>
          </div>

          {mode === 'signup' && (
            <>
              <label className="label req">First name</label>
              <input className="input" value={f.first} onChange={set('first')} />
              <label className="label">Middle name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" value={f.middle} onChange={set('middle')} />
              <label className="label req">Last name</label>
              <input className="input" value={f.last} onChange={set('last')} />
            </>
          )}
          <label className="label req">Email</label>
          <input className="input" type="email" inputMode="email" value={f.email} onChange={set('email')} />
          {mode === 'signup' && (
            <>
              <label className="label req">Mobile number</label>
              <input className="input" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={f.phone} onChange={set('phone')} />
            </>
          )}
          <button className="btn" disabled={busy} onClick={sendCode}>{busy ? 'Please wait…' : 'Send OTP'}</button>
        </div>
      ) : (
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-3">We sent a code to <b>{f.email}</b>. Enter it below.</p>
          <input className="input text-center text-2xl tracking-widest" inputMode="numeric" placeholder="OTP" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn" disabled={busy || code.length < 4} onClick={verify}>{busy ? 'Checking…' : 'Verify & continue'}</button>
          <button className="w-full text-sm text-gray-500 mt-3" onClick={() => { setSent(false); setCode(''); }}>Change email</button>
        </div>
      )}
      {msg && <p className="text-red-600 text-sm mt-3">{msg}</p>}
    </div>
  );
}
