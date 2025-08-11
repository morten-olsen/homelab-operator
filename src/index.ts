import 'dotenv/config';
import { ApiException } from '@kubernetes/client-node';

import { Services } from './utils/service.ts';
import { CustomResourceService } from './services/custom-resources/custom-resources.ts';
import { WatcherService } from './services/watchers/watchers.ts';
import { customResources } from './custom-resouces/custom-resources.ts';
import { StorageProvider } from './storage-provider/storage-provider.ts';

process.on('uncaughtException', (error) => {
  console.log('UNCAUGHT EXCEPTION');
  if (error instanceof ApiException) {
    return console.error(error.body);
  }
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.log('UNHANDLED REJECTION');
  if (error instanceof Error) {
    console.error(error.stack);
  }
  if (error instanceof ApiException) {
    return console.error(error.body);
  }
  console.error(error);
  process.exit(1);
});

const services = new Services();
const watcherService = services.get(WatcherService);
const storageProvider = services.get(StorageProvider);
await storageProvider.start();
await watcherService
  .create({
    path: '/apis/apiextensions.k8s.io/v1/customresourcedefinitions',
    list: async (k8s) => {
      return await k8s.extensionsApi.listCustomResourceDefinition();
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      ...manifest,
    }),
  })
  .start();
await watcherService
  .create({
    path: '/api/v1/secrets',
    list: async (k8s) => {
      return await k8s.api.listSecretForAllNamespaces();
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'v1',
      kind: 'Secret',
      ...manifest,
    }),
  })
  .start();
await watcherService
  .create({
    path: '/apis/apps/v1/deployments',
    list: async (k8s) => {
      return await k8s.apps.listDeploymentForAllNamespaces({});
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      ...manifest,
    }),
  })
  .start();

const customResourceService = services.get(CustomResourceService);
customResourceService.register(...customResources);

await customResourceService.install(true);
await customResourceService.watch();
