import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { compile } from 'json-schema-to-typescript';

import { K8sService } from '../services/k8s/k8s.ts';
import { Services } from '../utils/service.ts';

const services = new Services();
const k8s = services.get(K8sService);

const manifests = await k8s.extensionsApi.listCustomResourceDefinition();
const root = join(import.meta.dirname, '..', '__generated__', 'resources');

await mkdir(root, { recursive: true });

const firstUpsercase = (input: string) => {
  const [first, ...rest] = input.split('');
  return [first.toUpperCase(), ...rest].join('');
};

for (const manifest of manifests.items) {
  for (const version of manifest.spec.versions) {
    try {
      const schema = version.schema?.openAPIV3Schema;
      if (!schema) {
        continue;
      }
      const cleanedSchema = JSON.parse(JSON.stringify(schema));
      const kind = manifest.spec.names.kind;
      const typeName = `K8S${kind}${firstUpsercase(version.name)}`;
      const jsonLocation = join(root, `${typeName}.json`);
      await writeFile(jsonLocation, JSON.stringify(schema, null, 2));
      const file = await compile(cleanedSchema, typeName, {
        declareExternallyReferenced: true,
        additionalProperties: false,
        $refOptions: {
          continueOnError: true,
        },
      });
      const fileLocation = join(root, `${typeName}.ts`);
      await writeFile(fileLocation, file, 'utf8');
    } catch (err) {
      console.error(err);
      console.error(`${manifest.metadata?.name} ${version.name} failed`);
    }
  }
}
