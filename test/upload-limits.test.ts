import { describe, expect, test } from 'bun:test';
import {
  DIRECT_UPLOAD_BYTE_THRESHOLD,
  MULTIPART_ENVELOPE_HEADROOM_BYTES,
  keysRequiringPreUpload,
  multipartFileByteBudget,
} from '../src/lib/upload-limits';

describe('keysRequiringPreUpload', () => {
  test('keeps files when aggregate fits under the multipart budget', () => {
    const keys = keysRequiringPreUpload([
      { key: 'a', size: 1024 },
      { key: 'b', size: 2048 },
    ]);
    expect([...keys]).toEqual([]);
  });

  test('pre-uploads a single file that alone exceeds the budget', () => {
    const keys = keysRequiringPreUpload([
      { key: 'big', size: multipartFileByteBudget() + 1 },
      { key: 'small', size: 1024 },
    ]);
    expect([...keys]).toEqual(['big']);
  });

  test('pre-uploads enough files when two mid-size files exceed the aggregate budget', () => {
    // Two 3 MiB files each fit alone but together blow past Vercel's ~4.5 MB limit.
    const threeMiB = 3 * 1024 * 1024;
    expect(threeMiB).toBeLessThan(multipartFileByteBudget());
    expect(threeMiB * 2 + MULTIPART_ENVELOPE_HEADROOM_BYTES).toBeGreaterThan(
      DIRECT_UPLOAD_BYTE_THRESHOLD
    );

    const keys = keysRequiringPreUpload([
      { key: 'primary', size: threeMiB },
      { key: 'secondary', size: threeMiB },
    ]);
    expect(keys.size).toBe(1);
    expect(keys.has('primary') || keys.has('secondary')).toBe(true);
  });

  test('keeps every file on multipart when the maximum is disabled', () => {
    const keys = keysRequiringPreUpload([{ key: 'large', size: 100 * 1024 * 1024 }], null);
    expect([...keys]).toEqual([]);
  });
});
