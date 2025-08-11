#!/usr/bin/env node

import { K8sService } from '../src/services/k8s/k8s.ts';
import { Services } from '../src/utils/service.ts';

const services = new Services();
const k8s = services.get(K8sService);

const manifests = await k8s.extensionsApi.listCustomResourceDefinition();

for (const manifest of manifests.items) {
  for (const version of manifest.spec.versions) {
    console.log(`group: ${manifest.spec.group}, plural: ${manifest.spec.names.plural}, version: ${version.name}`);
  }
}
