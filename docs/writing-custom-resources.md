# Writing Custom Resources

This guide explains how to create and implement custom resources in the
homelab-operator.

## Overview

Custom resources in this operator follow a structured pattern that includes:

- **Specification schemas** using Zod for runtime validation
- **Resource implementations** that extend the base `CustomResource` class
- **Manifest creation** helpers for generating Kubernetes resources
- **Reconciliation logic** to manage the desired state

## Project Structure

Each custom resource should be organized in its own directory under
`src/custom-resouces/` with the following structure:

```
src/custom-resouces/{resource-name}/
├── {resource-name}.ts              # Main definition file
├── {resource-name}.schemas.ts      # Zod validation schemas
├── {resource-name}.resource.ts     # Resource implementation
└── {resource-name}.create-manifests.ts # Manifest generation helpers
```

## Quick Start

This section walks through creating a complete custom resource from scratch.
We'll build a `MyResource` that manages a web application with a deployment and
service.

### 1. Define Your Resource

The main definition file registers your custom resource with the operator
framework. This file serves as the entry point that ties together your schemas,
implementation, and Kubernetes CRD definition.

Create the main definition file (`{resource-name}.ts`):

```typescript
import { createCustomResourceDefinition } from "../../services/custom-resources/custom-resources.ts";
import { GROUP } from "../../utils/consts.ts";

import { MyResourceResource } from "./my-resource.resource.ts";
import { myResourceSpecSchema } from "./my-resource.schemas.ts";

const myResourceDefinition = createCustomResourceDefinition({
  group: GROUP, // Uses your operator's API group (homelab.mortenolsen.pro)
  version: "v1", // API version for this resource
  kind: "MyResource", // The Kubernetes kind name (PascalCase)
  names: {
    plural: "myresources", // Plural name for kubectl (lowercase)
    singular: "myresource", // Singular name for kubectl (lowercase)
  },
  spec: myResourceSpecSchema, // Zod schema for validation
  create: (options) => new MyResourceResource(options), // Factory function
});

export { myResourceDefinition };
```

**Key Points:**

- The `group` should always use the `GROUP` constant to maintain consistency
- `kind` should be descriptive and follow Kubernetes naming conventions
  (PascalCase)
- `names.plural` is used in kubectl commands (`kubectl get myresources`)
- The `create` function instantiates your resource implementation when a CR is
  detected

### 2. Create Validation Schemas

Schemas define the structure and validation rules for your custom resource's
specification. Using Zod provides runtime type safety and automatic validation
of user input.

Define your spec schema (`{resource-name}.schemas.ts`):

```typescript
import { z } from "zod";

const myResourceSpecSchema = z.object({
  // Required fields - these must be provided by users
  hostname: z.string(), // Base hostname for the application
  port: z.number().min(1).max(65535), // Container port (validated range)

  // Optional fields with defaults - provide sensible fallbacks
  replicas: z.number().min(1).default(1), // Number of pod replicas

  // Enums - restrict to specific values with defaults
  protocol: z.enum(["http", "https"]).default("https"),

  // Nested objects - for complex configuration
  database: z.object({
    host: z.string(), // Database hostname
    port: z.number(), // Database port
    name: z.string(), // Database name
  }).optional(), // Entire database config is optional
});

// Additional schemas for secrets, status, etc.
// Separate schemas help organize different data types
const myResourceSecretSchema = z.object({
  apiKey: z.string(), // API key for external services
  password: z.string(), // Database or service password
});

export { myResourceSecretSchema, myResourceSpecSchema };
```

**Schema Design Best Practices:**

- **Required vs Optional**: Make fields required only when absolutely necessary
- **Defaults**: Provide sensible defaults to reduce user configuration burden
- **Validation**: Use Zod's built-in validators (`.min()`, `.max()`, `.email()`,
  etc.)
- **Enums**: Restrict values to prevent invalid configurations
- **Nested Objects**: Group related configuration together
- **Separate Schemas**: Create different schemas for different purposes (spec,
  secrets, status)

### 3. Implement the Resource

The resource implementation is the core of your custom resource. It contains the
business logic for managing Kubernetes resources and maintains the desired
state. This class extends `CustomResource` and implements the reconciliation
logic.

Create the resource implementation (`{resource-name}.resource.ts`):

```typescript
import type { KubernetesObject } from "@kubernetes/client-node";
import deepEqual from "deep-equal";

import {
  CustomResource,
  type CustomResourceOptions,
  type SubresourceResult,
} from "../../services/custom-resources/custom-resources.custom-resource.ts";
import {
  ResourceReference,
  ResourceService,
} from "../../services/resources/resources.ts";

import type { myResourceSpecSchema } from "./my-resource.schemas.ts";
import {
  createDeploymentManifest,
  createServiceManifest,
} from "./my-resource.create-manifests.ts";

class MyResourceResource extends CustomResource<typeof myResourceSpecSchema> {
  #deploymentResource = new ResourceReference();
  #serviceResource = new ResourceReference();

  constructor(options: CustomResourceOptions<typeof myResourceSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    // Initialize resource references
    this.#deploymentResource.current = resourceService.get({
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: this.name,
      namespace: this.namespace,
    });

    this.#serviceResource.current = resourceService.get({
      apiVersion: "v1",
      kind: "Service",
      name: this.name,
      namespace: this.namespace,
    });

    // Set up event handlers for reconciliation
    this.#deploymentResource.on("changed", this.queueReconcile);
    this.#serviceResource.on("changed", this.queueReconcile);
  }

  #reconcileDeployment = async (): Promise<SubresourceResult> => {
    const manifest = createDeploymentManifest({
      name: this.name,
      namespace: this.namespace,
      ref: this.ref,
      spec: this.spec,
    });

    if (!this.#deploymentResource.current?.exists) {
      await this.#deploymentResource.current?.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: "Creating",
        message: "Creating deployment",
      };
    }

    if (!deepEqual(this.#deploymentResource.current.spec, manifest.spec)) {
      await this.#deploymentResource.current.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: "Updating",
        message: "Deployment needs updates",
      };
    }

    // Check if deployment is ready
    const deployment = this.#deploymentResource.current;
    const isReady =
      deployment.status?.readyReplicas === deployment.status?.replicas;

    return {
      ready: isReady,
      reason: isReady ? "Ready" : "Pending",
      message: isReady ? "Deployment is ready" : "Waiting for pods to be ready",
    };
  };

  #reconcileService = async (): Promise<SubresourceResult> => {
    const manifest = createServiceManifest({
      name: this.name,
      namespace: this.namespace,
      ref: this.ref,
      spec: this.spec,
    });

    if (!deepEqual(this.#serviceResource.current?.spec, manifest.spec)) {
      await this.#serviceResource.current?.patch(manifest);
      return {
        ready: false,
        syncing: true,
        reason: "Updating",
        message: "Service needs updates",
      };
    }

    return { ready: true };
  };

  public reconcile = async () => {
    if (!this.exists || this.metadata.deletionTimestamp) {
      return;
    }

    // Reconcile subresources
    await this.reconcileSubresource("Deployment", this.#reconcileDeployment);
    await this.reconcileSubresource("Service", this.#reconcileService);

    // Update overall ready condition
    const deploymentReady =
      this.conditions.get("Deployment")?.status === "True";
    const serviceReady = this.conditions.get("Service")?.status === "True";

    await this.conditions.set("Ready", {
      status: deploymentReady && serviceReady ? "True" : "False",
      reason: deploymentReady && serviceReady ? "Ready" : "Pending",
      message: deploymentReady && serviceReady
        ? "All resources are ready"
        : "Waiting for resources to be ready",
    });
  };
}

export { MyResourceResource };
```

**Resource Implementation Breakdown:**

**Constructor Setup:**

- **Resource References**: Create `ResourceReference` objects to track managed
  Kubernetes resources
- **Service Access**: Use dependency injection to access operator services
  (`ResourceService`)
- **Event Handlers**: Listen for changes in managed resources to trigger
  reconciliation
- **Resource Registration**: Register references for Deployment and Service that
  will be managed

**Reconciliation Methods:**

- **`#reconcileDeployment`**: Manages the application's Deployment resource
  - Creates manifests using helper functions
  - Checks if resource exists and creates/updates as needed
  - Uses `deepEqual` to avoid unnecessary updates
  - Returns status indicating readiness state
- **`#reconcileService`**: Manages the Service resource for network access
  - Similar pattern to deployment but typically simpler
  - Services are usually ready immediately after creation

**Main Reconcile Loop:**

- **Deletion Check**: Early return if resource is being deleted
- **Subresource Management**: Calls individual reconciliation methods
- **Condition Updates**: Aggregates status from all subresources
- **Status Reporting**: Updates the overall "Ready" condition

**Key Design Patterns:**

- **Private Methods**: Use `#` for private reconciliation methods
- **Async/Await**: All reconciliation is asynchronous
- **Resource References**: Track external resources with type safety
- **Condition Management**: Provide clear status through Kubernetes conditions
- **Event-Driven**: React to changes in managed resources automatically

### 4. Create Manifest Helpers

Manifest helpers are pure functions that generate Kubernetes resource
definitions. They transform your custom resource's specification into standard
Kubernetes objects. This separation keeps your reconciliation logic clean and
makes manifests easy to test and modify.

Define manifest creation functions (`{resource-name}.create-manifests.ts`):

```typescript
type CreateDeploymentManifestOptions = {
  name: string;
  namespace: string;
  ref: any; // Owner reference
  spec: {
    hostname: string;
    port: number;
    replicas: number;
  };
};

const createDeploymentManifest = (
  options: CreateDeploymentManifestOptions,
) => ({
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: {
    name: options.name,
    namespace: options.namespace,
    ownerReferences: [options.ref],
  },
  spec: {
    replicas: options.spec.replicas,
    selector: {
      matchLabels: {
        app: options.name,
      },
    },
    template: {
      metadata: {
        labels: {
          app: options.name,
        },
      },
      spec: {
        containers: [
          {
            name: options.name,
            image: "nginx:latest",
            ports: [
              {
                containerPort: options.spec.port,
              },
            ],
            env: [
              {
                name: "HOSTNAME",
                value: options.spec.hostname,
              },
            ],
          },
        ],
      },
    },
  },
});

type CreateServiceManifestOptions = {
  name: string;
  namespace: string;
  ref: any;
  spec: {
    port: number;
  };
};

const createServiceManifest = (options: CreateServiceManifestOptions) => ({
  apiVersion: "v1",
  kind: "Service",
  metadata: {
    name: options.name,
    namespace: options.namespace,
    ownerReferences: [options.ref],
  },
  spec: {
    selector: {
      app: options.name,
    },
    ports: [
      {
        port: 80,
        targetPort: options.spec.port,
      },
    ],
  },
});

export { createDeploymentManifest, createServiceManifest };
```

**Manifest Helper Patterns:**

**Type Definitions:**

- **Options Types**: Define clear interfaces for function parameters
- **Structured Input**: Group related parameters in nested objects
- **Type Safety**: Leverage TypeScript to catch configuration errors at compile
  time

**Deployment Manifest:**

- **Owner References**: Ensures garbage collection when parent resource is
  deleted
- **Labels & Selectors**: Consistent labeling for pod selection and organization
- **Container Configuration**: Maps custom resource spec to container settings
- **Environment Variables**: Passes configuration from spec to running
  containers
- **Port Configuration**: Exposes application ports based on spec

**Service Manifest:**

- **Service Discovery**: Creates stable network endpoint for the deployment
- **Port Mapping**: Routes external traffic to container ports
- **Selector Matching**: Uses same labels as deployment for proper routing
- **Owner References**: Links service lifecycle to custom resource

**Best Practices for Manifest Helpers:**

- **Pure Functions**: No side effects, same input always produces same output
- **Immutable Objects**: Return new objects rather than modifying inputs
- **Validation**: Let TypeScript catch type mismatches
- **Consistent Naming**: Use predictable patterns for resource names
- **Owner References**: Always set for proper cleanup
- **Documentation**: Comment non-obvious configuration choices

### 5. Register Your Resource

Add your resource to `src/custom-resouces/custom-resources.ts`:

```typescript
import { myResourceDefinition } from "./my-resource/my-resource.ts";

const customResources = [
  // ... existing resources
  myResourceDefinition,
];
```

## Core Concepts

These fundamental patterns are used throughout the operator framework.
Understanding them is essential for building robust custom resources.

### Resource References

`ResourceReference` objects provide a strongly-typed way to track and manage
Kubernetes resources that your custom resource creates or depends on. They
automatically handle resource watching, caching, and change notifications.

Use `ResourceReference` to manage related Kubernetes resources:

```typescript
import {
  ResourceReference,
  ResourceService,
} from "../../services/resources/resources.ts";

class MyResource extends CustomResource<typeof myResourceSpecSchema> {
  #deploymentResource = new ResourceReference();

  constructor(options: CustomResourceOptions<typeof myResourceSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    this.#deploymentResource.current = resourceService.get({
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: this.name,
      namespace: this.namespace,
    });

    // Listen for changes
    this.#deploymentResource.on("changed", this.queueReconcile);
  }
}
```

**Why Resource References Matter:**

- **Automatic Watching**: Changes to referenced resources trigger reconciliation
- **Type Safety**: Get compile-time checking for resource properties
- **Lifecycle Management**: Easily check if resources exist and their current
  state
- **Event Handling**: React to external changes without polling
- **Caching**: Avoid repeated API calls for the same resource data

### Conditions

Kubernetes conditions provide a standardized way to communicate resource status.
They follow the Kubernetes convention of expressing current state, reasons for
that state, and human-readable messages. Conditions are crucial for operators
and users to understand what's happening with resources.

Use conditions to track the status of your resource:

```typescript
// Set a condition
await this.conditions.set("Ready", {
  status: "True",
  reason: "AllResourcesReady",
  message: "All subresources are ready",
});

// Get a condition
const isReady = this.conditions.get("Ready")?.status === "True";
```

**Condition Best Practices:**

- **Standard Names**: Use common condition types like "Ready", "Available",
  "Progressing"
- **Clear Status**: Use "True", "False", or "Unknown" following Kubernetes
  conventions
- **Descriptive Reasons**: Provide specific reason codes for troubleshooting
- **Helpful Messages**: Include actionable information for users
- **Consistent Updates**: Always update conditions during reconciliation

### Subresource Reconciliation

The `reconcileSubresource` method provides a standardized way to manage
individual components of your custom resource. It automatically handles
condition updates, error management, and status aggregation. This pattern keeps
your main reconciliation loop clean and ensures consistent error handling.

Use `reconcileSubresource` to manage individual components:

```typescript
public reconcile = async () => {
  // This automatically manages conditions and error handling
  await this.reconcileSubresource("Deployment", this.#reconcileDeployment);
  await this.reconcileSubresource("Service", this.#reconcileService);
};
```

**Subresource Reconciliation Benefits:**

- **Automatic Condition Management**: Sets conditions based on reconciliation
  results
- **Error Isolation**: Failures in one subresource don't stop others
- **Status Aggregation**: Combines individual component status into overall
  status
- **Consistent Patterns**: Same error handling and retry logic across all
  components
- **Observability**: Clear visibility into which components are having issues

### Deep Equality Checks

Deep equality checks prevent unnecessary API calls and resource churn.
Kubernetes resources should only be updated when their desired state actually
differs from their current state. This improves performance and reduces cluster
load.

Use `deepEqual` to avoid unnecessary updates:

```typescript
import deepEqual from "deep-equal";

if (!deepEqual(currentResource.spec, desiredManifest.spec)) {
  await currentResource.patch(desiredManifest);
}
```

**Deep Equality Benefits:**

- **Performance**: Avoids unnecessary API calls to Kubernetes
- **Reduced Churn**: Prevents resource version conflicts and unnecessary events
- **Stability**: Reduces reconciliation loops and system noise
- **Efficiency**: Lets you focus compute on actual changes
- **Observability**: Cleaner audit logs with only meaningful changes

**When to Use Deep Equality:**

- **Spec Comparisons**: Before updating any Kubernetes resource
- **Status Updates**: Only update status when values actually change
- **Metadata Updates**: Check labels and annotations before patching
- **Complex Objects**: Especially useful for nested configuration objects

## Advanced Patterns

These patterns handle more complex scenarios like secret management, resource
dependencies, and sophisticated error handling. Use these when building
production-ready operators that need to handle real-world complexity.

### Working with Secrets

Many resources need to manage secrets. Here's a pattern for secret management:

```typescript
import { SecretService } from "../../services/secrets/secrets.ts";

class MyResource extends CustomResource<typeof myResourceSpecSchema> {
  constructor(options: CustomResourceOptions<typeof myResourceSpecSchema>) {
    super(options);
    const secretService = this.services.get(SecretService);

    // Get or create a secret
    this.secretRef = secretService.get({
      name: `${this.name}-secret`,
      namespace: this.namespace,
    });
  }

  #ensureSecret = async () => {
    const secretData = {
      apiKey: generateApiKey(),
      password: generatePassword(),
    };

    if (!this.secretRef.current?.exists) {
      await this.secretRef.current?.patch({
        apiVersion: "v1",
        kind: "Secret",
        metadata: {
          name: this.secretRef.current.name,
          namespace: this.secretRef.current.namespace,
          ownerReferences: [this.ref],
        },
        data: secretData,
      });
    }
  };
}
```

### Cross-Resource Dependencies

When your resource depends on other custom resources:

```typescript
class MyResource extends CustomResource<typeof myResourceSpecSchema> {
  #dependentResource = new ResourceReference();

  constructor(options: CustomResourceOptions<typeof myResourceSpecSchema>) {
    super(options);
    const resourceService = this.services.get(ResourceService);

    // Reference another custom resource
    this.#dependentResource.current = resourceService.get({
      apiVersion: "homelab.mortenolsen.pro/v1",
      kind: "PostgresDatabase",
      name: this.spec.database,
      namespace: this.namespace,
    });

    this.#dependentResource.on("changed", this.queueReconcile);
  }

  #reconcileApp = async (): Promise<SubresourceResult> => {
    // Check if dependency is ready
    const dependency = this.#dependentResource.current;
    if (!dependency?.exists) {
      return {
        ready: false,
        failed: true,
        reason: "MissingDependency",
        message: `PostgresDatabase ${this.spec.database} not found`,
      };
    }

    const dependencyReady = dependency.status?.conditions?.find(
      (c) => c.type === "Ready" && c.status === "True",
    );

    if (!dependencyReady) {
      return {
        ready: false,
        reason: "WaitingForDependency",
        message:
          `Waiting for PostgresDatabase ${this.spec.database} to be ready`,
      };
    }

    // Continue with reconciliation...
  };
}
```

### Error Handling

Proper error handling in reconciliation:

```typescript
#reconcileDeployment = async (): Promise<SubresourceResult> => {
  try {
    // Reconciliation logic...
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      failed: true,
      reason: 'ReconciliationError',
      message: `Failed to reconcile deployment: ${error.message}`,
    };
  }
};
```

## Example Usage

Once your custom resource is implemented and registered, users can create
instances using standard Kubernetes manifests. The operator will automatically
detect new resources and begin reconciliation based on your implementation
logic.

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: MyResource
metadata:
  name: my-app
  namespace: default
spec:
  hostname: my-app.example.com
  port: 8080
  replicas: 3
  protocol: https
  database:
    host: postgres.default.svc.cluster.local
    port: 5432
    name: myapp
```

**What happens when this resource is created:**

1. **Validation**: The operator validates the spec against your Zod schema
2. **Resource Creation**: Your `MyResourceResource` class is instantiated
3. **Reconciliation**: The operator creates a Deployment with 3 replicas and a
   Service
4. **Status Updates**: Conditions are set to track deployment and service
   readiness
5. **Event Handling**: The operator watches for changes and re-reconciles as
   needed

Users can then monitor the resource status with:

```bash
kubectl get myresources my-app -o yaml
kubectl describe myresource my-app
```

## Real Examples

These examples show how the patterns described above are used in practice within
the homelab-operator.

### Simple Resource: Domain

The `Domain` resource demonstrates a straightforward custom resource that
manages external dependencies. It creates and manages TLS certificates through
cert-manager and configures Istio gateways for HTTPS traffic routing.

**What it does:**

- Creates a cert-manager Certificate for TLS termination
- Configures an Istio Gateway for traffic routing
- Manages the lifecycle of both resources through owner references
- Provides wildcard certificate support for subdomains

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: Domain
metadata:
  name: homelab
  namespace: homelab
spec:
  hostname: local.olsen.cloud # Domain for certificate and gateway
  issuer: letsencrypt-prod # cert-manager ClusterIssuer to use
```

**Key Implementation Features:**

- **CRD Dependency Checking**: Validates that cert-manager and Istio CRDs exist
- **Cross-Namespace Resources**: Certificate is created in the istio-ingress
  namespace
- **Status Aggregation**: Combines certificate and gateway readiness into
  overall status
- **Wildcard Support**: Automatically configures `*.hostname` for subdomains

### Complex Resource: AuthentikServer

The `AuthentikServer` resource showcases a complex custom resource with multiple
dependencies and sophisticated reconciliation logic. It deploys a complete
identity provider solution with database and Redis dependencies.

**What it does:**

- Deploys Authentik identity provider with proper configuration
- Manages database schema and user creation
- Configures Redis connection for session storage
- Sets up domain integration for SSO endpoints
- Handles secret generation and rotation

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: AuthentikServer
metadata:
  name: homelab
  namespace: homelab
spec:
  domain: homelab # References a Domain resource
  database: test2 # References a PostgresDatabase resource
  redis: redis # References a Redis connection
```

**Key Implementation Features:**

- **Resource Dependencies**: Waits for Domain, PostgresDatabase, and Redis
  resources
- **Secret Management**: Generates and manages API keys, passwords, and tokens
- **Service Configuration**: Creates comprehensive Kubernetes manifests
  (Deployment, Service, Ingress)
- **Health Checking**: Monitors application readiness and database connectivity
- **Cross-Resource Communication**: Uses other custom resources' status and
  outputs

### Database Resource: PostgresDatabase

The `PostgresDatabase` resource illustrates how to manage stateful resources and
external system integration. It creates databases within an existing PostgreSQL
instance and manages user permissions.

**What it does:**

- Creates a new database in an existing PostgreSQL server
- Generates dedicated database user with appropriate permissions
- Manages connection secrets for applications
- Handles database cleanup and user removal

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: PostgresDatabase
metadata:
  name: test2
  namespace: homelab
spec:
  connection: homelab/db # References PostgreSQL connection (namespace/name)
```

**Key Implementation Features:**

- **External System Integration**: Connects to existing PostgreSQL instances
- **User Management**: Creates database-specific users with minimal required
  permissions
- **Secret Generation**: Provides connection details to consuming applications
- **Cleanup Handling**: Safely removes databases and users when resource is
  deleted
- **Connection Validation**: Verifies connectivity before marking as ready

**Common Patterns Across Examples:**

- **Owner References**: All managed resources have proper ownership for garbage
  collection
- **Condition Management**: Consistent status reporting through Kubernetes
  conditions
- **Resource Dependencies**: Graceful handling of missing or unready
  dependencies
- **Secret Management**: Secure generation and storage of credentials
- **Cross-Resource Integration**: Resources reference and depend on each other
  appropriately

## Best Practices

1. **Validation**: Always use Zod schemas for comprehensive spec validation
2. **Idempotency**: Use `deepEqual` checks to avoid unnecessary updates
3. **Conditions**: Provide clear status information through conditions
4. **Owner References**: Always set owner references for created resources
5. **Error Handling**: Provide meaningful error messages and failure reasons
6. **Dependencies**: Handle missing dependencies gracefully
7. **Cleanup**: Leverage Kubernetes garbage collection through owner references
8. **Testing**: Create test manifests in `test-manifests/` for your resources

## Troubleshooting

- **Resource not reconciling**: Check if the resource is properly registered in
  `custom-resources.ts`
- **Validation errors**: Ensure your Zod schema matches the expected spec
  structure
- **Missing dependencies**: Verify that referenced resources exist and are ready
- **Owner reference issues**: Make sure `ownerReferences` are set correctly for
  garbage collection
- **Condition not updating**: Ensure you're calling `this.conditions.set()` with
  proper status values

For more examples, refer to the existing custom resources in
`src/custom-resouces/`.
