import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ไทยอุดรเฟอร์นิเจอร์ | แคตตาล็อกสินค้าทางการและระบบจัดการราคากลาง',
  description: 'ระบบจัดการแคตตาล็อกสินค้าทางการ ไทยอุดรเฟอร์นิเจอร์ (ตู้โล และ น็อคดาวน์ Modern Luxury)',
  icons: {
    icon: 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png',
    apple: 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="icon" href="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png" type="image/png" />
        <link rel="shortcut icon" href="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png" type="image/png" />
        <link rel="apple-touch-icon" href="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#161B40] font-sans">{children}</body>
    </html>
  );
}
