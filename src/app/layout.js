import './globals.css';
import Nav from '@/components/Nav';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'GharFresh',
  description: 'Fresh at your door, every morning.',
  manifest: '/manifest.webmanifest'
};

export const viewport = { themeColor: '#0B5D3B' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-20">
        <header className="bg-brand text-white px-4 py-3 font-semibold">GharFresh</header>
        <Shell>{children}</Shell>
        <Nav />
      </body>
    </html>
  );
}
