'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const blank = { name: '', pack_size: '', mrp: '', selling_price: '', stock: '', image_url: '', category_id: '' };

export default function Products() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(blank);
  const [newCat, setNewCat] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order')
    ]);
    setRows(p.data || []); setCats(c.data || []);
  }
  useEffect(() => { load(); }, []);

  async function update(id, patch) {
    setMsg('');
    const { error } = await supabase.from('products').update(patch).eq('id', id);
    setMsg(error ? error.message : 'Saved'); load();
  }

  async function add() {
    setMsg('');
    if (!form.name || !form.selling_price) { setMsg('Name and selling price are required'); return; }
    const row = {
      name: form.name, pack_size: form.pack_size, image_url: form.image_url || null,
      mrp: Number(form.mrp || form.selling_price), selling_price: Number(form.selling_price),
      stock: Number(form.stock || 0), category_id: form.category_id || null
    };
    const { error } = await supabase.from('products').insert(row);
    if (error) setMsg(error.message); else { setForm(blank); load(); }
  }

  async function addCategory() {
    if (!newCat) return;
    const slug = newCat.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    const { error } = await supabase.from('categories').insert({ name: newCat, slug });
    setMsg(error ? error.message : 'Category added'); setNewCat(''); load();
  }

  const inp = 'border rounded-lg px-3 py-2 bg-white text-sm';
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Products</h1>
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="font-medium mb-2">Add product</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className={inp} placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className={inp} placeholder="Pack size (1 L)" value={form.pack_size} onChange={e => setForm({ ...form, pack_size: e.target.value })} />
          <input className={inp} placeholder="MRP" type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} />
          <input className={inp} placeholder="Selling price *" type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} />
          <input className={inp} placeholder="Stock" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <input className={inp} placeholder="Image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
          <select className={inp} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Category</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="bg-brand text-white rounded-lg" onClick={add}>Add</button>
        </div>
        <div className="flex gap-2 mt-3">
          <input className={`${inp} flex-1`} placeholder="New category name" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <button className="border border-brand text-brand rounded-lg px-3" onClick={addCategory}>Add category</button>
        </div>
      </div>

      {msg && <p className="text-sm text-brand mb-2">{msg}</p>}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-3">Product</th><th>Price ₹</th><th>Stock</th><th>Active</th><th>Subscription</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name} <span className="text-gray-500">{r.pack_size}</span></td>
                <td><input className="border rounded px-2 py-1 w-20" type="number" defaultValue={r.selling_price}
                  onBlur={e => Number(e.target.value) !== Number(r.selling_price) && update(r.id, { selling_price: Number(e.target.value) })} /></td>
                <td><input className="border rounded px-2 py-1 w-20" type="number" defaultValue={r.stock}
                  onBlur={e => Number(e.target.value) !== r.stock && update(r.id, { stock: Number(e.target.value) })} /></td>
                <td><input type="checkbox" checked={r.is_active} onChange={e => update(r.id, { is_active: e.target.checked })} /></td>
                <td><input type="checkbox" checked={r.is_subscription_allowed} onChange={e => update(r.id, { is_subscription_allowed: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">Every price change is recorded automatically in the price audit log.</p>
    </div>
  );
}
