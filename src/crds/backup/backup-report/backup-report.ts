import { z } from 'zod';

import { createCustomResource } from '../../../custom-resource/custom-resource.base.ts';

const backupReportSchema = z.object({
  spec: z.object({
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    status: z.enum(['success', 'failed', 'in-progress']),
    error: z.string().optional(),
    message: z.string().optional(),
  }),
});

const BackupReport = createCustomResource({
  kind: 'BackupReport',
  spec: backupReportSchema,
  names: {
    plural: 'backupreports',
    singular: 'backupreport',
  },
});

export { BackupReport };
