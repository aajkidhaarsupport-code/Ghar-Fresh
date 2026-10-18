import RiderGuard from '@/components/RiderGuard';

export const metadata = { title: 'GharFresh Rider', manifest: '/rider.webmanifest' };

export default function RiderLayout({ children }) {
  return <RiderGuard>{children}</RiderGuard>;
}
