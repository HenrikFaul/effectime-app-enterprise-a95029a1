import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ScheduledReportProps {
  reportName?: string
  reportDescription?: string | null
  columns?: string[]
  previewRows?: Record<string, unknown>[]
  rowCount?: number
  generatedAt?: string
}

const ScheduledReportEmail = ({
  reportName = 'Ütemezett riport',
  reportDescription,
  columns = [],
  previewRows = [],
  rowCount = 0,
  generatedAt,
}: ScheduledReportProps) => {
  const visibleColumns = columns.slice(0, 8)
  const visibleRows = previewRows.slice(0, 10)

  return (
    <Html lang="hu" dir="ltr">
      <Head />
      <Preview>{reportName} — Effectime</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>📊 Effectime</Text>
          <Heading style={heading}>{reportName}</Heading>
          {reportDescription ? <Text style={description}>{reportDescription}</Text> : null}
          <Text style={meta}>
            {rowCount} sor{generatedAt ? ` · ${generatedAt}` : ''}
          </Text>

          {visibleColumns.length > 0 ? (
            <Section style={tableWrap}>
              <table style={table} role="presentation">
                <thead>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th key={column} style={th}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {visibleColumns.map((column) => (
                        <td key={column} style={td}>{String(row[column] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : (
            <Text style={description}>A riport ebben a futásban nem adott vissza sorokat.</Text>
          )}

          {rowCount > visibleRows.length ? (
            <Text style={footnote}>
              Az e-mail az első {visibleRows.length} sort mutatja. A teljes riportot az Effectime riportfelületén érheted el.
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ScheduledReportEmail,
  subject: (data: Record<string, any>) => `📊 ${data.reportName || 'Ütemezett riport'} — Effectime`,
  displayName: 'Ütemezett riport',
  previewData: {
    reportName: 'Heti kapacitás',
    reportDescription: 'Automatikus heti összesítő',
    columns: ['Csapat', 'Kapacitás'],
    previewRows: [{ Csapat: 'Frontend', Kapacitás: '82%' }],
    rowCount: 1,
    generatedAt: '2026.07.17.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '28px', maxWidth: '720px', margin: '24px auto' }
const logo = { color: '#0f766e', fontSize: '16px', fontWeight: '700' as const }
const heading = { color: '#111827', fontSize: '24px', margin: '12px 0 8px' }
const description = { color: '#4b5563', fontSize: '14px', lineHeight: '1.5' }
const meta = { color: '#6b7280', fontSize: '12px', marginBottom: '16px' }
const tableWrap = { overflowX: 'auto' as const }
const table = { width: '100%', borderCollapse: 'collapse' as const }
const th = { borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '11px', padding: '7px', textAlign: 'left' as const }
const td = { borderBottom: '1px solid #f3f4f6', color: '#111827', fontSize: '12px', padding: '7px', verticalAlign: 'top' as const }
const footnote = { color: '#6b7280', fontSize: '11px', marginTop: '16px' }
