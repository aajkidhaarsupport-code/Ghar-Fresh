'use client';
import { usePathname } from 'next/navigation';

// Narrow column for customer pages, wide area for admin
export default function Shell({ children }) {
  const path = usePathname();
  const wide = path.startsWith('/admin');
  return <main className={`${wide ? 'max-w-5xl' : 'max-w-md'} mx-auto p-4`}>{children}</main>;
}
