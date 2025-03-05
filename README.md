# AWS Organization CLI Tool

A command-line interface tool to retrieve and analyze information from AWS Organizations and services across multiple AWS accounts.

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Commands](#commands)
  - [Organization Commands](#organization-commands)
    - [list-accounts](#list-accounts)
  - [Resource Commands](#resource-commands)
    - [list-ec2](#list-ec2)
    - [list-rds](#list-rds)
    - [list-opensearch](#list-opensearch)
    - [list-elb](#list-elb)
  - [Policy Commands](#policy-commands)
    - [verify-principals](#verify-principals)
- [Output Formats](#output-formats)
- [Examples](#examples)
- [Cross-Account Access](#cross-account-access)

## Installation

```bash
git clone https://github.com/ebellavance/aws-org-cli.git

# Copy contants.example.ts to constants.ts than adjust constants value
copy constants.example.ts constants.ts

# Using npm
npm install
npm run build
npm link

# On Macos/Linux you need to make the built script executable
chmod +x ./dist/index.js

```

## Authentication

The tool uses AWS credentials to authenticate. You can provide credentials in several ways:

1. **AWS Environment Variables**: Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_SESSION_TOKEN`.

2. **AWS Profile**: Specify a profile from your AWS credentials file using the `--profile` option.

```bash
aws-org list-accounts --profile myprofile
```

## Commands

The CLI tool provides the following commands:

### Organization Commands

#### list-accounts

List all accounts in the AWS Organization.

```bash
aws-org list-accounts [options]
```

Options:

- `-p, --profile <profile>` - AWS profile to use
- `-o, --output <format>` - Output format (json, table, html) (default: "table")

Example:

```bash
aws-org list-accounts --output html
```

### Resource Commands

#### list-ec2

List EC2 instances across all accounts in the organization.

```bash
aws-org list-ec2 [options]
```

Options:

- `--profile <profile>` - AWS profile to use
- `-r, --role-name <roleName>` - Role to assume in target accounts (default: "OrganizationAccountAccessRole")
- `-o, --output <format>` - Output format (json, table, html) (default: "table")
- `-a, --account-id <accountId>` - Specific account ID to check
- `--region <region>` - AWS region to check (can be specified multiple times) (default: ["ca-central-1"])

Example:

```bash
aws-org list-ec2 --region us-east-1 --region us-west-2 --output html
```

#### list-rds

List RDS database instances across all accounts in the organization.

```bash
aws-org list-rds [options]
```

Options:

- `--profile <profile>` - AWS profile to use
- `-r, --role-name <roleName>` - Role to assume in target accounts (default: "OrganizationAccountAccessRole")
- `-o, --output <format>` - Output format (json, table, html) (default: "table")
- `-a, --account-id <accountId>` - Specific account ID to check
- `--region <region>` - AWS region to check (can be specified multiple times) (default: ["ca-central-1"])

Example:

```bash
aws-org list-rds --account-id 123456789012
```

#### list-opensearch

List OpenSearch domains across all accounts in the organization.

```bash
aws-org list-opensearch [options]
```

Options:

- `--profile <profile>` - AWS profile to use
- `-r, --role-name <roleName>` - Role to assume in target accounts (default: "OrganizationAccountAccessRole")
- `-o, --output <format>` - Output format (json, table, html) (default: "table")
- `-a, --account-id <accountId>` - Specific account ID to check
- `--region <region>` - AWS region to check (can be specified multiple times) (default: ["ca-central-1"])

Example:

```bash
aws-org list-opensearch --region us-east-1
```

#### list-elb

List Elastic Load Balancers (Classic, Application, Network) across all accounts in the organization.

```bash
aws-org list-elb [options]
```

Options:

- `--profile <profile>` - AWS profile to use
- `-r, --role-name <roleName>` - Role to assume in target accounts (default: "OrganizationAccountAccessRole")
- `-o, --output <format>` - Output format (json, table, html) (default: "table")
- `-a, --account-id <accountId>` - Specific account ID to check
- `--region <region>` - AWS region to check (can be specified multiple times) (default: ["ca-central-1"])

Example:

```bash
aws-org list-elb --output html
```

### Policy Commands

#### verify-principals

Verify if principals in a policy document exist in your AWS Organization.

```bash
aws-org verify-principals [options]
```

Options:

- `-f, --file <filePath>` - Path to JSON policy file (required)
- `-p, --profile <profile>` - AWS profile to use
- `-o, --output <format>` - Output format (json, table, html) (default: "table")
- `-r, --role-name <roleName>` - Role to assume for cross-account verification (default: "OrganizationAccountAccessRole")
- `--cross-account` - Enable cross-account verification of principals (default: false)

Example:

```bash
aws-org verify-principals --file policy.json --cross-account
```

## Output Formats

The CLI tool supports multiple output formats:

1. **table** - Default format, displays results in a formatted table
2. **json** - Outputs raw JSON data
3. **html** - Generates an HTML report and opens it in your default browser

For HTML output, reports include:

- Summary statistics
- Filtering options
- Expandable/collapsible sections by account
- Color-coded status indicators
- Timestamp of report generation

Example:

```bash
aws-org list-ec2 --output html
```

## Examples

List all accounts in the organization:

```bash
aws-org list-accounts
```

List EC2 instances in multiple regions for a specific account:

```bash
aws-org list-ec2 --account-id 123456789012 --region us-east-1 --region eu-west-1
```

Generate an HTML report of all RDS instances:

```bash
aws-org list-rds --output html
```

Verify principals in a policy file with cross-account verification:

```bash
aws-org verify-principals -f my-policy.json --cross-account
```

## Cross-Account Access

To access resources in member accounts, the tool uses IAM role assumption. By default, it attempts to assume the `OrganizationAccountAccessRole` role in each account.

Requirements:

1. The role must exist in member accounts
2. The role must have appropriate read permissions for the resources being queried
3. The role must trust the account running the CLI tool

To use a different role, specify it with the `--role-name` option:

```bash
aws-org list-ec2 --role-name MyCustomReadOnlyRole
```

## License

[MIT](LICENSE)
