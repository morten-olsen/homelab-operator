import type { Static, TSchema } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

const isSchemaValid = <T extends TSchema>(schema: T, data: unknown): data is Static<T> => {
  const compiler = TypeCompiler.Compile(schema);
  return compiler.Check(data);
};

export { isSchemaValid };
