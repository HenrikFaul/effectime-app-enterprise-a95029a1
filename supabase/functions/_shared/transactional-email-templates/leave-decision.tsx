import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Syncfolk'

interface LeaveDecisionProps {
  employeeName?: string
  decision?: 'approved' | 'rejected'
  startDate?: string
  endDate?: string
  leaveType?: string
  reviewerName?: string
  reviewComment?: string
}

const decisionLabel = (d?: string) => d === 'approved' ? 'Jóváhagyva ✅' : 'Elutasítva ❌'
const decisionColor = (d?: string) => d === 'approved' ? 'hsl(172, 66%, 40%)' : 'hsl(0, 72%, 51%)'

const LeaveDecisionEmail = ({
  employeeName, decision, startDate, endDate, leaveType, reviewerName, reviewComment,
}: LeaveDecisionProps) => (
  <Html lang="hu" dir="ltr">
    <Head />
    <Preview>Szabadságkérelmed: {decisionLabel(decision)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>🗓️ {SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>
          Szabadságkérelem – {decisionLabel(decision)}
        </Heading>
        <Text style={text}>
          Kedves {employeeName || 'Kolléga'},
        </Text>
        <Text style={text}>
          A szabadságkérelmed az alábbi döntéssel zárult:
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}>
            <strong>Státusz:</strong>{' '}
            <span style={{ color: decisionColor(decision), fontWeight: 'bold' }}>
              {decisionLabel(decision)}
            </span>
          </Text>
          <Text style={detailRow}>
            <strong>Típus:</strong> {leaveType || 'Szabadság'}
          </Text>
          <Text style={detailRow}>
            <strong>Időszak:</strong> {startDate || '–'} – {endDate || '–'}
          </Text>
          {reviewerName && (
            <Text style={detailRow}>
              <strong>Döntéshozó:</strong> {reviewerName}
            </Text>
          )}
          {reviewComment && (
            <>
              <Hr style={hr} />
              <Text style={detailRow}>
                <strong>Megjegyzés:</strong> {reviewComment}
              </Text>
            </>
          )}
        </Section>
        <Text style={footer}>
          Üdvözlettel, a {SITE_NAME} csapat
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LeaveDecisionEmail,
  subject: (data: Record<string, any>) =>
    `Szabadságkérelem ${data.decision === 'approved' ? 'jóváhagyva' : 'elutasítva'} – ${SITE_NAME}`,
  displayName: 'Szabadságkérelem döntés',
  previewData: {
    employeeName: 'Szabó Péter',
    decision: 'approved',
    startDate: '2026.05.04',
    endDate: '2026.05.08',
    leaveType: 'Éves szabadság',
    reviewerName: 'Henrik',
    reviewComment: 'Jó pihenést!',
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
const hr = { borderColor: '#e2e8f0', margin: '12px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
