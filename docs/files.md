# File inputs

When a workflow input is a file, the SDK uploads it as `multipart/form-data` (the same shape as `curl -F`). No base64, no payload doubling.

## Browser

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const fileInput = document.querySelector<HTMLInputElement>('input[type=file]')!;
const client = new EigenpalClient({ apiKey });

await client.workflows.run('extract-invoice', {
  contract_document: fileInput.files![0], // File from <input type="file">
});
```

## Node — from disk

```ts
import { readFile } from 'node:fs/promises';

const buffer = await readFile('contract.pdf');
await client.workflows.run('extract-invoice', {
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
await client.workflows.run('extract-invoice', { contract_document: blob });
```

## Multiple files

```ts
await client.workflows.run('compare-versions', {
  original: file1,
  revised: file2,
  reference: file3,
});
```

Each file becomes a top-level form field. Mix files and scalar inputs freely; scalars ride along in a single `_json` text field automatically.

## Nested files aren't extracted

Only top-level file values become multipart fields. Files inside arrays or nested objects stay in the JSON sidecar and the server won't see them as uploads:

```ts
// DON'T — `documents` becomes a JSON array of `{}` objects, no upload.
await client.workflows.run('compare', { documents: [file1, file2] });

// DO — flatten to top-level keys, your workflow accepts them by name.
await client.workflows.run('compare', { document_0: file1, document_1: file2 });
```

## Don't base64 yourself

```ts
// Don't do this. Doubles the payload size and skips the optimised path.
await client.workflows.run('extract-invoice', {
  contract_document: btoa(buffer.toString('binary')),
});
```

The SDK picks multipart whenever it sees a `File`, `Blob`, or `{ content, filename, mimeType }`. Plain strings pass through as scalar inputs.
