import json


def transform_data(json_data):
    """Transforms the raw JSON data into a structured format for reporting."""
    reports = json.loads(json_data)
    all_vulnerabilities = []
    all_config_audit_issues = []

    for report in reports:
        if "vulnerabilities" in report["report"]:
            for vuln in report["report"]["vulnerabilities"]:
                all_vulnerabilities.append(
                    {
                        "namespace": report["namespace"],
                        "resource": report["name"],
                        "vulnerabilityID": vuln["vulnerabilityID"],
                        "severity": vuln["severity"],
                        "title": vuln["title"],
                        "packagePURL": vuln.get("packagePURL"),
                        "installedVersion": vuln.get("installedVersion"),
                        "fixedVersion": vuln.get("fixedVersion"),
                    }
                )
        elif "checks" in report["report"]:  # ConfigAuditReports have "checks"
            for check in report["report"]["checks"]:
                all_config_audit_issues.append(
                    {
                        "namespace": report["namespace"],
                        "resource": report["name"],
                        "checkID": check["checkID"],
                        "severity": check["severity"],
                        "title": check["title"],
                        "description": check["description"],
                        "remediation": check["remediation"],
                        "success": check["success"],
                    }
                )

    return {
        "vulnerabilities": all_vulnerabilities,
        "config_issues": all_config_audit_issues,
    }


# Load the JSON data
with open("all_data.json", "r") as f:
    raw_data = f.read()

transformed_data = transform_data(raw_data)

# Print the transformed data (for verification)
print(json.dumps(transformed_data, indent=2))  # print for check
# Save it for the next step:
with open("transformed_data.json", "w") as f:
    json.dump(transformed_data, f, indent=2)
