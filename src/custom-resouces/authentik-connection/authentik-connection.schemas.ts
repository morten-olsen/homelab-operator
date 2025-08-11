import { z } from 'zod';

import { valueReferenceInfoSchema } from '../../services/value-reference/value-reference.instance.ts';

const authentikConnectionSpecSchema = z.object({
  name: valueReferenceInfoSchema,
  url: valueReferenceInfoSchema,
  token: valueReferenceInfoSchema,
});

export { authentikConnectionSpecSchema };
