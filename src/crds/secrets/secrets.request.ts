import { Type } from '@sinclair/typebox';
import { ApiException, type V1Secret } from '@kubernetes/client-node';

import { CustomResource, type CustomResourceHandlerOptions } from '../../custom-resource/custom-resource.base.ts';
import { K8sService } from '../../services/k8s.ts';

const stringValueSchema = Type.String({
  key: Type.String(),
  chars: Type.Optional(Type.String()),
  length: Type.Optional(Type.Number()),
  encoding: Type.Optional(
    Type.String({
      enum: ['utf-8', 'base64', 'base64url', 'hex'],
    }),
  ),
  value: Type.Optional(Type.String()),
});

const secretRequestSpec = Type.Object({
  secretName: Type.Optional(Type.String()),
  data: Type.Array(stringValueSchema),
});

class SecretRequest extends CustomResource<typeof secretRequestSpec> {
  constructor() {
    super({
      kind: 'SecretRequest',
      spec: secretRequestSpec,
      names: {
        plural: 'secretrequests',
        singular: 'secretrequest',
      },
    });
  }

  #createSecret = async (options: CustomResourceHandlerOptions<typeof secretRequestSpec>) => {
    const { request, services } = options;
    const { apiVersion, kind, spec, metadata } = request;
    const { secretName = metadata.name } = spec;
    const { namespace = 'default' } = metadata;
    const k8sService = services.get(K8sService);
    let current: V1Secret | undefined;
    try {
      current = await k8sService.api.readNamespacedSecret({
        name: secretName,
        namespace,
      });
    } catch (error) {
      if (!(error instanceof ApiException && error.code === 404)) {
        throw error;
      }
    }
    if (current) {
      console.log('secret already exists', current);
      // TODO: Add update logic
      return;
    }
    await k8sService.api.createNamespacedSecret({
      namespace,
      body: {
        kind: 'Secret',
        metadata: {
          name: secretName,
          namespace,
          ownerReferences: [
            {
              apiVersion,
              kind,
              name: metadata.name,
              uid: metadata.uid,
            },
          ],
        },
        type: 'Opaque',
        data: {
          // TODO: generate data from spec
          test: 'test',
        },
      },
    });
  };

  public update = async (options: CustomResourceHandlerOptions<typeof secretRequestSpec>) => {
    const { request } = options;
    const status = await request.getStatus();
    try {
      await this.#createSecret(options);
      status.setCondition('Ready', {
        status: 'True',
        reason: 'SecretCreated',
        message: 'Secret created',
      });
      return await status.save();
    } catch {
      status.setCondition('Ready', {
        status: 'False',
        reason: 'SecretNotCreated',
        message: 'Secret not created',
      });
    }
  };
}

export { SecretRequest };
