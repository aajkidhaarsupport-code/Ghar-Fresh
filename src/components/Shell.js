'use client';
import { usePathname } from 'next/navigation';

// Wide area for the shop home and admin, narrow column for the other customer pages
export default function Shell({ children }) {
  const path = usePathname();
  const wide = path === '/' || path.startsWith('/admin');
  return <main className={`${wide ? 'max-w-5xl' : 'max-w-md'} mx-auto p-4`}>{children}</main>;
}
