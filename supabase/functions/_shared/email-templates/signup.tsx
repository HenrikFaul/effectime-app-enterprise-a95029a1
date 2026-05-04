/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="hu" dir="ltr">
    <Head />
    <Preview>Erősítsd meg az e-mail címedet – Syncfolk</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table><tr>
            <td style={logoIcon}>S</td>
            <td style={logoText}>Syncfolk</td>
          </tr></table>
        </Section>
        <Heading style={h1}>Üdvözlünk a Syncfolknál! 🎉</Heading>
        <Text style={text}>
          Köszönjük, hogy regisztráltál a{' '}
          <Link href={siteUrl} style={link}>
            <strong>Syncfolk</strong>
          </Link>
          -ra!
        </Text>
        <Text style={text}>
          Kérjük, erősítsd meg az e-mail címedet (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) az alábbi kóddal:
        </Text>
        {token && (
          <Text style={codeStyle}>{token}</Text>
        )}
        <Text style={text}>
          Vagy kattints az alábbi gombra:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            E-mail megerősítése
          </Button>
        </Section>
        <Text style={footer}>
          Ha nem te hoztad létre ezt a fiókot, nyugodtan figyelmen kívül hagyhatod ezt az e-mailt.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '28px' }
const logoIcon = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, hsl(172, 66%, 40%), hsl(172, 80%, 50%))',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  paddingRight: '0',
}
const logoText = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(230, 25%, 12%)',
  paddingLeft: '10px',
  verticalAlign: 'middle' as const,
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(230, 25%, 12%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(220, 10%, 46%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: 'hsl(172, 66%, 40%)', textDecoration: 'underline' }
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
  backgroundColor: 'hsl(172, 66%, 40%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
