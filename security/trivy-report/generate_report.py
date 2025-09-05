import json
from jinja2 import Environment, FileSystemLoader
import weasyprint


def generate_pdf_report(transformed_data, template_file, output_file):
    """Generates a PDF report from the transformed data and Jinja2 template."""

    env = Environment(
        loader=FileSystemLoader(".")
    )  # Load templates from the current directory
    template = env.get_template(template_file)
    html_output = template.render(transformed_data)  # Render the template with the data

    # Generate PDF using WeasyPrint
    weasyprint.HTML(string=html_output).write_pdf(output_file)


# Load the already transformed JSON data
with open("transformed_data.json", "r") as f:
    raw_data = json.load(f)

# Sort by severity (CRITICAL, HIGH, MEDIUM, LOW)
severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

# Group vulnerabilities by CVE ID
vuln_groups = {}
for vuln in raw_data["vulnerabilities"]:
    cve_id = vuln["vulnerabilityID"]
    if cve_id not in vuln_groups:
        vuln_groups[cve_id] = {
            "vulnerabilityID": vuln["vulnerabilityID"],
            "severity": vuln["severity"],
            "title": vuln["title"],
            "packagePURL": vuln.get("packagePURL"),
            "installedVersion": vuln.get("installedVersion"),
            "fixedVersion": vuln.get("fixedVersion"),
            "affected_resources": [],
        }

    vuln_groups[cve_id]["affected_resources"].append(
        {"namespace": vuln["namespace"], "resource": vuln["resource"]}
    )

# Convert to list and sort by severity
grouped_vulnerabilities = sorted(
    list(vuln_groups.values()), key=lambda x: severity_order.get(x["severity"], 4)
)

# Group config issues by checkID
config_groups = {}
for issue in raw_data["config_issues"]:
    check_id = issue["checkID"]
    if check_id not in config_groups:
        config_groups[check_id] = {
            "checkID": issue["checkID"],
            "severity": issue["severity"],
            "title": issue["title"],
            "description": issue["description"],
            "remediation": issue["remediation"],
            "affected_resources": [],
        }

    config_groups[check_id]["affected_resources"].append(
        {"namespace": issue["namespace"], "resource": issue["resource"]}
    )

# Convert to list and sort by severity
grouped_config_issues = sorted(
    list(config_groups.values()), key=lambda x: severity_order.get(x["severity"], 4)
)

transformed_data = {
    "vulnerabilities": grouped_vulnerabilities,
    "config_issues": grouped_config_issues,
}


# Generate the PDF report
generate_pdf_report(transformed_data, "report_template.html", "security_report.pdf")

print("PDF report generated successfully: security_report.pdf")
