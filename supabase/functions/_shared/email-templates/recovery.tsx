/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  token,
}: RecoveryEmailProps) => (
  <Html lang="hu" dir="ltr">
    <Head />
    <Preview>Jelszó visszaállítása – Syncfolk</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table><tr>
            <td style={logoIcon}>S</td>
            <td style={logoText}>Syncfolk</td>
          </tr></table>
        </Section>
        <Heading style={h1}>Jelszó visszaállítása</Heading>
        <Text style={text}>
          Kaptunk egy kérést a Syncfolk-fiókod jelszavának visszaállítására.
        </Text>
        {token && (
          <>
            <Text style={text}>
              Használd az alábbi kódot a jelszó visszaállításához:
            </Text>
            <Text style={codeStyle}>{token}</Text>
          </>
        )}
        <Text style={text}>
          Vagy kattints az alábbi gombra az új jelszó beállításához:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            Jelszó visszaállítása
          </Button>
        </Section>
        <Text style={footer}>
          Ha nem te kérted a jelszó visszaállítást, nyugodtan figyelmen kívül hagyhatod
          ezt az e-mailt. A jelszavad nem fog megváltozni.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '28px' }
const logoIcon = {
  width: '36px', height: '36px', borderRadius: '10px',
  background: 'linear-gradient(135deg, hsl(172, 66%, 40%), hsl(172, 80%, 50%))',
  color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  textAlign: 'center' as const, verticalAlign: 'middle' as const,
}
const logoText = {
  fontSize: '20px', fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(230, 25%, 12%)', paddingLeft: '10px', verticalAlign: 'middle' as const,
}
const h1 = {
  fontSize: '22px', fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(230, 25%, 12%)', margin: '0 0 20px',
}
const text = { fontSize: '14px', color: 'hsl(220, 10%, 46%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: "'Space Grotesk', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(172, 66%, 40%)',
  letterSpacing: '4px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const button = {
  backgroundColor: 'hsl(172, 66%, 40%)', color: '#ffffff',
  fontSize: '14px', fontWeight: '600' as const, borderRadius: '16px',
  padding: '14px 24px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
