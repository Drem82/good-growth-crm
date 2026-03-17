import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Good Growth CRM',
  description: 'Good Growth Foundation CRM',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #e5e7eb',
            background: 'white',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, color: '#0b1f44' }}>
            Good Growth CRM
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <a href="/contacts" style={{ fontWeight: 600, color: '#0b1f44', textDecoration: 'none' }}>
              Contacts
            </a>
            <a href="/ai-search" style={{ fontWeight: 600, color: '#0b1f44', textDecoration: 'none' }}>
              AI Search
            </a>
          </div>
        </nav>

        {children}
      </body>
    </html>
  )
}