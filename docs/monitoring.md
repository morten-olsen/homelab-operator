# Home Kubernetes Cluster Setup: Monitoring & Security Quickstart

This guide provides a practical, lightweight setup for monitoring and security on your home Kubernetes cluster. It uses Helm for easy installation and focuses on essential features with minimal complexity.

## Overview

This setup includes:

*   **Monitoring:** Prometheus + node-exporter + kube-state-metrics + Grafana (via the `kube-prometheus-stack` Helm chart).
*   **Image Scanning & Supply-Chain:** Trivy (Trivy Operator) for automated in-cluster image vulnerability scanning.
*   **Policy / Admission Control / Pod Security:** Kyverno for policy enforcement and Kubernetes Pod Security Admission (PSA) for baseline security.
*   **Runtime Security / IDS:** Falco to detect suspicious syscalls and pod activity.
*   **Network Segmentation:** Calico (or Cilium) CNI with basic NetworkPolicy configuration.
*   **Ad-Hoc Checks:**  kube-bench (CIS benchmarks), kube-linter/kube-score (static analysis), and kube-hunter (penetration testing).

## Prerequisites

*   A functional Kubernetes cluster (managed or self-hosted).
*   `kubectl` installed and configured to connect to your cluster.
*   Helm v3 installed.

## Installation

These instructions assume you have `kubectl` and Helm set up and authenticated to your cluster.

### 1. Monitoring (Prometheus + Grafana)

*   Add the Prometheus community Helm repository:

    ```bash
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    ```

*   Create the `monitoring` namespace and install the `kube-prometheus-stack` chart:

    ```bash
    kubectl create ns monitoring
    helm install kube-prometheus prometheus-community/kube-prometheus-stack --namespace monitoring
    ```

    *Optional*: Customize the installation by creating a `values.yaml` file to configure persistence, resource limits, and scrape intervals.  See *Configuration* below for a potential `values.yaml` you can adapt.

*   Access Grafana:

    ```bash
    kubectl -n monitoring port-forward svc/kube-prometheus-grafana 3000:80
    ```

    Open `http://localhost:3000` in your browser. The default `admin` user password can be found in the chart's secrets (check the Helm chart documentation).

    This provides node-exporter, kube-state-metrics, a Prometheus server, Alertmanager, and pre-built dashboards for your cluster.

### 2. Image Scanning (Trivy Operator)

*   Add the Aqua Security Helm repository:

    ```bash
    helm repo add aqua https://aquasecurity.github.io/helm-charts
    helm repo update
    ```

*   Create the `trivy-system` namespace and install the `trivy-operator` chart:

    ```bash
    kubectl create ns trivy-system
    helm install trivy-operator aqua/trivy-operator --namespace trivy-system
    ```

    Trivy Operator creates `VulnerabilityReport` and `ConfigAuditReport` CRDs.  It scans images running in the cluster for vulnerabilities.

### 3. Policy Admission (Kyverno)

*   Create the `kyverno` namespace and install Kyverno:

    ```bash
    kubectl create ns kyverno
    kubectl apply -f https://github.com/kyverno/kyverno/releases/latest/download/install.yaml
    ```

*   Apply the example `ClusterPolicy` to deny privileged containers and hostPath mounts:

    ```yaml
    apiVersion: kyverno.io/v1
    kind: ClusterPolicy
    metadata:
      name: deny-privileged-and-hostpath
    spec:
      rules:
      - name: deny-privileged
        match:
          resources:
            kinds: ["Pod","PodTemplate","CronJob","Job","Deployment","StatefulSet"]
        validate:
          message: "Privileged containers are not allowed"
          deny:
            conditions:
            - key: "{{ request.object.spec.containers[].securityContext.privileged }}"
              operator: Equals
              value: true
      - name: deny-hostpath
        match:
          resources:
            kinds: ["Pod","PodTemplate","Deployment","StatefulSet"]
        validate:
          message: "hostPath volumes are not allowed"
          pattern:
            spec:
              volumes:
              - "*":
                  hostPath: null
    ```

    Save the above as `kyverno-policy.yaml` and apply it:

    ```bash
    kubectl apply -f kyverno-policy.yaml
    ```

    Adapt the `match` section to target specific workload types.  See *Example Kyverno Policy* below.

### 4. Pod Security Admission (PSA)

*   Apply the `baseline` Pod Security Standard to the `default` namespace:

    ```bash
    kubectl label ns default pod-security.kubernetes.io/enforce=baseline
    ```

*   For a stricter security posture, use the `restricted` profile:

    ```bash
    kubectl label ns default pod-security.kubernetes.io/enforce=restricted
    ```

    PSA provides controls like preventing privileged containers and restricting host networking.

### 5. Runtime Detection (Falco)

*   Add the Falco Helm repository:

    ```bash
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    ```

*   Create the `falco` namespace and install the `falco` chart:

    ```bash
    kubectl create ns falco
    helm install falco falcosecurity/falco --namespace falco
    ```

    Falco detects suspicious container behavior and system calls.

### 6. Network Policy & CNI

*   If you haven't already, install a CNI that supports NetworkPolicy, such as Calico:

    ```bash
    kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
    ```

    Alternatively, consider Cilium.

*   Implement a default-deny NetworkPolicy:

    ```yaml
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: default-deny
      namespace: my-namespace
    spec:
      podSelector: {}
      policyTypes:
      - Ingress
      - Egress
    ```

    Save the above as `default-deny.yaml` and apply it to your namespace:

    ```bash
    kubectl apply -f default-deny.yaml
    ```

    Follow this up with explicit `allow` policies for necessary services.

### 7. Cluster Hardening & Scans

*   **kube-bench (CIS Benchmarks):**

    ```bash
    kubectl run --rm -it --image aquasec/kube-bench:latest kube-bench -- /kube-bench --version 1.23
    ```

    Refer to the kube-bench documentation for running as a Job or Pod.

*   **kube-linter / kube-score (Static Manifest Checks):**

    Install the CLI tool locally and analyze your Kubernetes manifests.

*   **kube-hunter (Penetration Testing):**

    ```bash
    docker run aquasec/kube-hunter:latest --remote <K8S_API_ENDPOINT>
    ```

## Configuration

This section provides example configuration files and tips to customize the setup for a home Kubernetes cluster.

### Example `values.yaml` for `kube-prometheus-stack`

This reduces resource usage and avoids the need for external object storage for Alertmanager, which is not needed at home.  It disables default dashboards you might not need initially and cuts down some Prometheus retention.

```yaml
# values.yaml for kube-prometheus-stack

prometheus:
  prometheusSpec:
    # reduce resource rqts / limits
    resources:
       requests:
         memory: 1Gi
         cpu: 200m
       limits:
         memory: 2Gi
         cpu: 500m

    # Reduce storage retention
    retention: 7d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: "local-path" # Or your storage class
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi # adjust as needed

alertmanager:
  enabled: false # for quick home setup, send directly to telegram etc.
grafana:
  enabled: true
  defaultDashboardsEnabled: false   # Disable default dashboards
  sidecar:
    dashboards:
      enabled: true
      provider:
        folders:
          fromConfigMap: true # Load custom dashboards from ConfigMaps

kube-state-metrics:
 enabled: true

nodeExporter:
  enabled: true
```

To use this configuration, save it as `values.yaml` and run:

```bash
helm install kube-prometheus prometheus-community/kube-prometheus-stack --namespace monitoring -f values.yaml
```

Adapt the `storageClassName` and storage amounts to your environment.

### Example Kyverno Policy - Disallow Root User / Require Distroless

This example expands on the previous policy.  It requires images not run as UID 0 and suggests distroless images.  It still requires privilege escalation to be forbidden:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root-user-and-distroless
  annotations:
    policies.kyverno.io/title: Require Non-Root User and Distroless Images
    policies.kyverno.io/category: Security
    policies.kyverno.io/severity: medium
    policies.kyverno.io/subject: Pod
    policies.kyverno.io/description: >-
      Containers should not run as root, and ideally, be based on Distroless
      images where possible. This policy requires that containers define
      `runAsUser`, and that `runAsUser` is not `0`.  It also generates a warning
      if the image is not based on a distroless image, although does not reject
      the deployment.

spec:
  validationFailureAction: Enforce
  rules:
    - name: check-runasnonroot
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Containers must not run as root. Specify a non-zero runAsUser in securityContext."
        pattern:
          spec:
            containers:
              - securityContext:
                  runAsUser: "!0" # not equal to zero
    - name: check-allowprivilegeescalation
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Containers must set allowPrivilegeEscalation to false."
        pattern:
          spec:
            containers:
              - securityContext:
                  allowPrivilegeEscalation: "false"
    - name: warn-distroless
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "*"  # all images
          attestations:
            - policy:
                subjects:
                  - name: distroless
                conditions:
                  all:
                    - key: "ghcr.io/distroless/static:latest"  # Example -  Check if the image is distroless.  You can use wildcards
                      operator: In
                      value: "{{ image.repoDigests }}"
                  # You can add other keys and values to check

      mutate:
        overlay:
          metadata:
            annotations:
              "image.distroless.warn": "This image isn't distroless -- see https://github.com/GoogleContainerTools/distroless"
```

### Alertmanager to Telegram

1.  **Create a Telegram Bot:** Search for `@BotFather` on Telegram. Use the `/newbot` command. Give your bot a name and a unique username.  BotFather will give you the bot's API token.

2.  **Get your Telegram Chat ID:** Send a message to your bot.  Then, in a browser, go to  `https://api.telegram.org/bot<YOUR_BOT_API_TOKEN>/getUpdates` (replace `<YOUR_BOT_API_TOKEN>`). The `chat.id` value in the JSON response is your chat ID.

3.  **Create a Secret in Kubernetes:**

    ```bash
    kubectl create secret generic telegram-secrets \
      --from-literal=bot_token="<YOUR_BOT_API_TOKEN>" \
      --from-literal=chat_id="<YOUR_CHAT_ID>"
    ```

    Replace the placeholders with the correct values.

4.  **Add Alertmanager Configuration:**

    You'll need to patch the default Alertmanager configuration provided by `kube-prometheus-stack`.  Because we disabled the Alertmanager component from the chart for simplicitly's sake, we'll instead rely on defining an additional prometheusRule that sends alerts to a webhook (and have a small sidecar container forward them to telegram).

Example:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  labels:
    prometheus: k8s
    role: alert-rules
  name: promethus-to-telegram
  namespace: monitoring
spec:
  groups:
    - name: kubernetes-home-cluster
      rules:
        - alert: PrometheusToTelegramAlert
          annotations:
            description: 'Alert sent from Prometheus goes to telegram'
          expr: vector(1)
          labels:
            severity: critical
          for: 1s
          actions:
            - name: SendToTelegramAction
              url: 'http://localhost:8080/message'
              parameters:
                text: Alert from Prometheus: {{ .Alerts.Firing | len }} firing alert{{ if gt (len .Alerts.Firing) 1 }}s{{ end }}.\nSeverity: {{ .CommonLabels.severity }}\nDescription: {{ .CommonAnnotations.description }}
```

Now you will create a deployment that runs a small webhook server forwarding these alerts to telegram:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus-telegram
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: prometheus-telegram
  replicas: 1
  template:
    metadata:
      labels:
        app: prometheus-telegram
    spec:
      containers:
      - name: webhook
        image: nginx
        ports:
        - containerPort: 8080
      - name: telegram-forwarder
        image: alpine/curl
        command: ["/bin/sh"]
        args:
        - "-c"
        - |
          while true; do
            nc -l -p 8080 | sed 's/text=/text=Alert from Prometheus: /g' | curl -sS --fail -X POST "https://api.telegram.org/bot$(TELEGRAM_BOT_TOKEN)/sendMessage" -d chat_id=$(TELEGRAM_CHAT_ID) -d "$$(cat)"
            sleep 1;
          done
        env:
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: telegram-secrets
              key: bot_token
        - name: TELEGRAM_CHAT_ID
          valueFrom:
            secretKeyRef:
              name: telegram-secrets
              key: chat_id
```

**Explanation:**

*   It creates an Nginx pod for a HTTP listener to avoid unnecessary security errors in Promethues,
*   The `telegram-forwarder` container uses `curl` and `nc` to forward the POST from Prometheus to the Telegram API, using the secrets for authentication.

## Operational Tips

*   **Resource Management:**  Set resource limits and requests for components, especially Prometheus and Grafana. Adjust scrape intervals for Prometheus to reduce load.
*   **Persistence:**  Use persistent volumes for Grafana and Prometheus to preserve dashboards and historical data.
*   **Alerting:**  Configure Alertmanager with a Telegram or Discord webhook for notifications. This is *simpler* than email for home setups.
*   **Trivy & Image Blocking:** To automatically block vulnerable images, integrate Trivy with admission webhooks (using Kyverno to reject deployments based on Trivy reports).
*   **Backups:** Regularly back up etcd (if self-hosting the control plane) and potentially Prometheus/Grafana data.

## Getting Started Quickly

Follow this installation order:

1.  Install your `CNI`.
2.  Install `kube-prometheus-stack`, using `values.yaml` to reduce resources.
3.  Install Grafana and import dashboards.
4.  Enable PSA on namespaces.
5.  Install Kyverno and create deny policies.
6.  Install Trivy Operator for image scanning visibility.
7.  Install Falco for runtime detection.
8.  Run `kube-bench` and `kube-linter` for initial assessment.

## Useful Resources

*   [kube-prometheus-stack (Helm)](https://github.com/prometheus-community/helm-charts)
*   [trivy-operator](https://github.com/aquasecurity/trivy-operator)
*   [Kyverno](https://kyverno.io/)
*   [Falco](https://falco.org/)
*   [Calico CNI](https://www.tigera.io/project-calico/)
*  [Aqua kube-hunter, kube-bench, kube-linter](https://www.aquasec.com/)

This README provides a solid foundation for setting up monitoring and security on your home Kubernetes cluster.  Adapt the configurations and policies to your specific needs and experiment!