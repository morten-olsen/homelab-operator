import { BootstrapService } from './bootstrap/bootstrap.ts';
import { customResources } from './custom-resouces/custom-resources.ts';
import { CustomResourceService } from './services/custom-resources/custom-resources.ts';
import { WatcherService } from './services/watchers/watchers.ts';
import { StorageProvider } from './storage-provider/storage-provider.ts';
import { Services } from './utils/service.ts';

const services = new Services();

const watcherService = services.get(WatcherService);
await watcherService.watchCustomGroup('source.toolkit.fluxcd.io', 'v1', ['helmrepositories', 'gitrepositories']);
await watcherService.watchCustomGroup('helm.toolkit.fluxcd.io', 'v2', ['helmreleases']);
await watcherService.watchCustomGroup('cert-manager.io', 'v1', ['certificates']);
await watcherService.watchCustomGroup('networking.k8s.io', 'v1', ['gateways', 'virtualservices']);

await watcherService
  .create({
    path: '/api/v1/namespaces',
    list: async (k8s) => {
      return await k8s.api.listNamespace();
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'v1',
      kind: 'Namespace',
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
    path: '/apis/apps/v1/statefulsets',
    list: async (k8s) => {
      return await k8s.apps.listStatefulSetForAllNamespaces({});
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
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
    path: '/apis/storage.k8s.io/v1/storageclasses',
    list: async (k8s) => {
      return await k8s.storageApi.listStorageClass();
    },
    verbs: ['add', 'update', 'delete'],
    transform: (manifest) => ({
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      ...manifest,
    }),
  })
  .start();

const storageProvider = services.get(StorageProvider);
await storageProvider.start();

const bootstrap = services.get(BootstrapService);
await bootstrap.ensure();

const customResourceService = services.get(CustomResourceService);
customResourceService.register(...customResources);

await customResourceService.install(true);
await customResourceService.watch();
