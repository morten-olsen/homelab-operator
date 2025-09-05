import { CRD } from './crd/crd.ts';
import { Deployment } from './deployment/deployment.ts';
import { Namespace } from './namespace/namespace.ts';
import { PersistentVolume } from './pv/pv.ts';
import { PVC } from './pvc/pvc.ts';
import { Secret } from './secret/secret.ts';
import { Service } from './service/service.ts';
import { StatefulSet } from './stateful-set/stateful-set.ts';
import { StorageClass } from './storage-class/storage-class.ts';

const core = {
  namespace: Namespace,
  storageClass: StorageClass,
  pvc: PVC,
  pv: PersistentVolume,
  secret: Secret,
  crd: CRD,
  service: Service,
  deployment: Deployment,
  statefulSet: StatefulSet,
};

export { core };
