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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="hu" dir="ltr">
    <Head />
    <Preview>E-mail cím módosítás megerősítése – Syncfolk</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table><tr>
            <td style={logoIcon}>S</td>
            <td style={logoText}>Syncfolk</td>
          </tr></table>
        </Section>
        <Heading style={h1}>E-mail cím módosítása</Heading>
        <Text style={text}>
          Kérted az e-mail címed módosítását a Syncfolk-fiókodon:{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>
          {' → '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Kattints az alábbi gombra a módosítás megerősítéséhez:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            E-mail módosítás megerősítése
          </Button>
        </Section>
        <Text style={footer}>
          Ha nem te kérted ezt a módosítást, kérjük, védd meg a fiókodat azonnal.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: 'hsl(172, 66%, 40%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(172, 66%, 40%)', color: '#ffffff',
  fontSize: '14px', fontWeight: '600' as const, borderRadius: '16px',
  padding: '14px 24px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
