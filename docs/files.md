# File inputs

When a workflow input is a file, the SDK uploads it as `multipart/form-data` (the same shape as `curl -F`). No base64, no payload doubling.

When the aggregate multipart payload (all file bytes plus form envelope headroom) would exceed ~4 MB, maintained `client.run(...)` helpers pre-upload enough files through the Files API (storage-direct on cloud, multipart fallback on-prem) with `purpose: "run-input"` and send `{ "$fileId": "file_..." }` so cloud deployments stay under Vercel's request-body limit. The server keeps those temporary pool files available for safe run-start retries and reaps them after 24 hours. Explicit `client.files.upload(...)` omits purpose and remains reusable. Remaining small files keep the single multipart round-trip.

## Browser

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const fileInput = document.querySelector<HTMLInputElement>('input[type=file]')!;
const client = new EigenpalClient({ apiKey });

await client.run('workflows.extract-invoice', {
  contract_document: fileInput.files![0], // File from <input type="file">
});
```

## Node — from disk

```ts
import { readFile } from 'node:fs/promises';

const buffer = await readFile('contract.pdf');
await client.run('workflows.extract-invoice', {
  contract_document: {
    content: buffer,
    filename: 'contract.pdf',
    mimeType: 'application/pdf',
  },
});
```

## Node — from a Blob

```ts
const blob = new Blob([buffer], { type: 'application/pdf' });
await client.run('workflows.extract-invoice', { contract_document: blob });
```

## Multiple files

```ts
await client.run('workflows.compare-versions', {
  original: file1,
  revised: file2,
  reference: file3,
});
```

Each file becomes a `files.<fieldName>` multipart part. Mix files and scalar inputs freely; scalars ride in the `input` JSON part automatically.

## Nested files are not extracted

Only top-level file values become multipart fields. Files inside arrays or nested objects stay in the `input` JSON part and the server will not see them as uploads:

```ts
// DON'T — `documents` becomes a JSON array of `{}` objects, no upload.
await client.run('workflows.compare', { documents: [file1, file2] });

// DO — flatten to top-level keys, your workflow accepts them by name.
await client.run('workflows.compare', { document_0: file1, document_1: file2 });
```

## Do not base64 yourself

```ts
// Don't do this. Doubles the payload size and skips the optimised path.
await client.run('workflows.extract-invoice', {
  contract_document: btoa(buffer.toString('binary')),
});
```

The SDK picks multipart whenever it sees a `File`, `Blob`, or `{ content, filename, mimeType }`. Plain strings pass through as scalar inputs.
