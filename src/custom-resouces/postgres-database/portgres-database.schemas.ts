import { z } from 'zod';

const postgresDatabaseSpecSchema = z.object({
  connection: z.string(),
});

export { postgresDatabaseSpecSchema };
