'use client';
import { usePathname } from 'next/navigation';

const items = [
  ['/', 'Home'], ['/basket', 'Basket'], ['/subscriptions', 'Plans'],
  ['/wallet', 'Wallet'], ['/profile', 'Profile']
];
export default function Nav() {
  const path = usePathname();
  if (path.startsWith('/admin') || path.startsWith('/rider')) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-3 text-sm">
      {items.map(([href, label]) => (
        <a key={href} href={href} className="text-brand font-medium">{label}</a>
      ))}
    </nav>
  );
}
