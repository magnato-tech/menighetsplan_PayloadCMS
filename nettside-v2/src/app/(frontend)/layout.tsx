import React from 'react'
import Nav from '@/components/Nav'
import DemoLinje from '@/components/DemoLinje'
import './styles.css'

export const metadata = {
  description: 'Lillesand Misjonskirke – nettside, Min side og admin i én løsning.',
  title: 'Lillesand Misjonskirke',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="no">
      <body>
        <DemoLinje />
        <Nav />
        <main className="side-innhold">{children}</main>
      </body>
    </html>
  )
}
