'use client';
// Shows a message in green normally, red when it looks like an error
export default function Msg({ msg }) {
  if (!msg) return null;
  const bad = /violat|permission|denied|not allowed|error|invalid|required|failed|cannot|could not|row-level|policy|not found|unauthor|duplicate|already/i.test(msg);
  return <p className={`text-sm mb-2 ${bad ? 'text-red-600 font-medium' : 'text-brand'}`}>{msg}</p>;
}
