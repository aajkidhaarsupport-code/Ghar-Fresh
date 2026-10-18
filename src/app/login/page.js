'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  async function sendCode() {
    setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { full_name: name } }
    });
    if (error) setMsg(error.message); else setSent(true);
  }

  async function verify() {
    setMsg('');
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) setMsg(error.message); else window.location.href = '/';
  }

  const input = 'w-full border rounded-xl px-4 py-3 mb-3';
  const btn = 'w-full bg-brand text-white rounded-xl py-3 font-semibold';

  return (
    <div className="mt-8">
      <h1 className="text-xl font-semibold mb-4">Login / Sign up</h1>
      {!sent ? (
        <>
          <input className={input} placeholder="Full name *" value={name} onChange={e => setName(e.target.value)} />
          <input className={input} placeholder="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <button className={btn} onClick={sendCode} disabled={!name || !email}>Send OTP</button>
        </>
      ) : (
        <>
          <input className={input} placeholder="Enter OTP" value={code} onChange={e => setCode(e.target.value)} />
          <button className={btn} onClick={verify}>Verify</button>
        </>
      )}
      {msg && <p className="text-red-600 mt-3 text-sm">{msg}</p>}
    </div>
  );
}
