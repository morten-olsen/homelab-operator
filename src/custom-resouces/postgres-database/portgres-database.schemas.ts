import { z } from 'zod';

const postgresDatabaseSpecSchema = z.object({
  cluster: z.string(),
});

export { postgresDatabaseSpecSchema };
