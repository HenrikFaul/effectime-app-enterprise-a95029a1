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
import type { TemplateEntry } from './registry.ts'

interface EnterpriseInviteProps {
  workspaceName?: string
  inviteeEmail?: string
  roleLabel?: string
  signInUrl?: string
  expiresAt?: string
}

const SITE_NAME = 'Effectime'

const EnterpriseInviteEmail = ({
  workspaceName,
  inviteeEmail,
  roleLabel,
  signInUrl,
  expiresAt,
}: EnterpriseInviteProps) => (
  <Html lang="hu" dir="ltr">
    <Head />
    <Preview>Meghívó a {workspaceName || 'Effectime Enterprise'} munkaterületre</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>🗓️ {SITE_NAME}</Text>
        </Section>

        <Heading style={h1}>Meghívót kaptál egy munkaterületre</Heading>

        <Text style={text}>
          Meghívtak a <strong>{workspaceName || 'Effectime Enterprise'}</strong> munkaterületre.
        </Text>

        <Text style={text}>
          A folytatáshoz jelentkezz be vagy regisztrálj ezzel az email címmel:{' '}
          <strong>{inviteeEmail || 'a meghívott címeddel'}</strong>.
        </Text>

        {(roleLabel || expiresAt) && (
          <Section style={detailsBox}>
            {roleLabel && (
              <Text style={detailRow}>
                <strong>Szerepkör:</strong> {roleLabel}
              </Text>
            )}
            {expiresAt && (
              <Text style={detailRow}>
                <strong>Lejárat:</strong> {expiresAt}
              </Text>
            )}
          </Section>
        )}

        <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
          <Button style={button} href={signInUrl || 'https://effectime.app/auth'}>
            Bejelentkezés / regisztráció
          </Button>
        </Section>

        <Text style={footer}>
          Ha nem vártad ezt a meghívót, nyugodtan figyelmen kívül hagyhatod ezt az e-mailt.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EnterpriseInviteEmail,
  subject: (data: Record<string, any>) =>
    `Meghívó a ${data.workspaceName || 'Effectime Enterprise'} munkaterületre – ${SITE_NAME}`,
  displayName: 'Enterprise meghívó',
  previewData: {
    workspaceName: 'Genisys',
    inviteeEmail: 'kollega@ceg.hu',
    roleLabel: 'Tag',
    signInUrl: 'https://effectime.app/auth',
    expiresAt: '2026.04.18.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '20px' }
const logoText = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(230, 25%, 12%)',
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
  margin: '0 0 16px',
}
const detailsBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '16px 20px',
  marginBottom: '24px',
  border: '1px solid #e2e8f0',
}
const detailRow = {
  fontSize: '14px',
  color: 'hsl(230, 25%, 12%)',
  lineHeight: '1.6',
  margin: '4px 0',
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
