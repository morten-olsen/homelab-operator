#!/bin/bash

# Data Extraction Function
extract_data() {
  crd_type="$1"

  kubectl get "$crd_type" -A -o json | jq -r '.items[] | {
    namespace: .metadata.namespace,
    name: .metadata.name,
    report: .report
  }'
}

# Vulnerability Reports
vulnerability_data=$(extract_data vulnerabilityreports)

# Example of capturing ConfigAuditReports (adjust jq filter as needed)
config_audit_data=$(extract_data configauditreports)

# Combine the data into a proper JSON array using jq
{
  echo "$vulnerability_data"
  echo "$config_audit_data"
} | jq -s '.' > all_data.json