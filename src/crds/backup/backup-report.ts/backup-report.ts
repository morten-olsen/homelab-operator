import { createCustomResource } from '../../../custom-resource/custom-resource.base.ts';

const backupReportSchema = z.object({
  spec: z.object({
    startedAt: z.string({
      format: 'date-time',
    }),
    finishedAt: z.string({
      format: 'date-time',
    }),
    status: z.enum(['success', 'failed']),
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
