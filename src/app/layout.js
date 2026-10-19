import './globals.css';
import Nav from '@/components/Nav';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'GharFresh | Fresh at your door',
  description: 'Fresh milk, dairy and everyday essentials delivered to your door each morning.',
  manifest: '/manifest.webmanifest',
  applicationName: 'GharFresh',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GharFresh' },
};

export const viewport = { themeColor: '#0B5D3B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-24 antialiased md:pb-8">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B5D3B] text-white shadow-[0_4px_16px_rgba(11,50,32,.12)]">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
            <a href="/" aria-label="GharFresh home" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-base font-black tracking-tight text-brand shadow-sm">GF</span>
              <span className="min-w-0"><span className="block text-[17px] font-extrabold leading-5 tracking-tight">GharFresh</span><span className="mt-0.5 block text-[10px] font-medium tracking-wide text-green-100/80">FRESH AT YOUR DOOR</span></span>
            </a>
            <div className="ml-auto hidden items-center gap-2 text-right sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10" aria-hidden="true">☀️</span><span><span className="block text-xs font-semibold">A fresher start</span><span className="block text-[11px] text-green-100/75">Every morning, at home</span></span></div>
            <a href="/profile" className="ml-auto rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 sm:hidden">Account</a>
          </div>
        </header>
        <Shell>{children}</Shell>
        <Nav />
      </body>
    </html>
  );
}
