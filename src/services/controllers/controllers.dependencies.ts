import type { ResourceInstance } from '../resources/resources.instance.ts';

type DependencyRef<T extends ResourceInstance<ExpectedAny>> = {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  instance: T;
};

class CustomResourceControllerDependencies {
  public get = <T extends ResourceInstance<ExpectedAny>>(name: string, ref: DependencyRef<T>) => { };
}

export { CustomResourceControllerDependencies };
