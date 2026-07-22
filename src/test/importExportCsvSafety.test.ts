import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  downloadFile,
  generateCSV,
  parseCSV,
} from '@/components/enterprise/import-export/utils/file-parser';

afterEach(() => {
  vi.restoreAllMocks();
});

function generatedDataCell(value: string): string {
  return parseCSV(generateCSV(['value'], [[value]])).rows[0][0];
}

describe('import/export CSV spreadsheet safety', () => {
  it.each([
    '=HYPERLINK("https://attacker.example")',
    '+cmd|calc',
    '-2+3',
    '@SUM(1,2)',
    '\t=1+1',
    '\r=1+1',
    '   =1+1',
  ])('forces a dangerous cell to text: %s', (value) => {
    expect(generatedDataCell(value)).toBe(`'${value}`);
  });

  it.each(['42', '0', 'plain text', "'already-safe", 'user@example.com'])(
    'preserves a non-formula cell byte-for-byte: %s',
    (value) => {
      expect(generatedDataCell(value)).toBe(value);
    },
  );

  it('neutralizes before RFC 4180 quoting without losing content', () => {
    expect(generateCSV(['value'], [['=SUM(1,2)']]))
      .toBe('\uFEFFvalue\r\n"\'=SUM(1,2)"');
  });

  it('revokes the object URL when the browser download click throws', () => {
    const objectUrl = 'blob:effectime-export';
    const anchor = document.createElement('a');
    const clickFailure = new Error('download click failed');
    const createObjectUrl = vi.fn(() => objectUrl);
    const revokeObjectUrl = vi.fn();
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    vi.spyOn(anchor, 'click').mockImplementation(() => {
      throw clickFailure;
    });
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);

    try {
      expect(() => downloadFile('content', 'export.csv', 'text/csv')).toThrow(clickFailure);
      expect(createObjectUrl).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl);
    } finally {
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });
});
