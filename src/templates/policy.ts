// File: src/templates/policy-template.ts
// Policy verification HTML report template
import { PolicyDocument, PolicyVerificationResult } from '../types'
/**
 * Generate enhanced HTML output for policy verification results
 * @param results The policy verification results to display
 * @param policy The original policy document
 * @param title The title for the report
 */
export function generatePolicyVerificationHtml(
  results: PolicyVerificationResult[],
  policy: PolicyDocument | Record<string, unknown>,
  title: string,
): string {
  // Group results by existence status
  const validPrincipals = results.filter((r) => r.Exists)
  const invalidPrincipals = results.filter((r) => !r.Exists)

  // Create summary section
  const summaryHtml = `
    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-title">Total Principals</div>
          <div class="summary-value">${results.length}</div>
        </div>
        <div class="summary-card summary-card-valid">
          <div class="summary-title">Valid Principals</div>
          <div class="summary-value">${validPrincipals.length}</div>
        </div>
        <div class="summary-card summary-card-invalid">
          <div class="summary-title">Invalid Principals</div>
          <div class="summary-value">${invalidPrincipals.length}</div>
        </div>
      </div>
    </div>
  `

  // Create results section
  let resultsHtml = `
    <div class="results-section">
      <h2>Verification Results</h2>
  `

  if (validPrincipals.length > 0) {
    resultsHtml += `
      <h3>Valid Principals (${validPrincipals.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Principal</th>
            <th>Type</th>
            <th>Account ID</th>
          </tr>
        </thead>
        <tbody>
    `

    validPrincipals.forEach((principal) => {
      resultsHtml += `
        <tr class="valid-principal">
          <td>${principal.Principal}</td>
          <td>${principal.Type}</td>
          <td>${principal.AccountId || 'N/A'}</td>
        </tr>
      `
    })

    resultsHtml += `
        </tbody>
      </table>
    `
  }

  if (invalidPrincipals.length > 0) {
    resultsHtml += `
      <h3>Invalid Principals (${invalidPrincipals.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Principal</th>
            <th>Type</th>
            <th>Account ID</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
    `

    invalidPrincipals.forEach((principal) => {
      resultsHtml += `
        <tr class="invalid-principal">
          <td>${principal.Principal}</td>
          <td>${principal.Type}</td>
          <td>${principal.AccountId || 'N/A'}</td>
          <td>${principal.Error || 'Not found'}</td>
        </tr>
      `
    })

    resultsHtml += `
        </tbody>
      </table>
    `
  }

  resultsHtml += `
    </div>
  `

  // Create policy section
  const policyHtml = `
    <div class="policy-section">
      <h2>Policy Document</h2>
      <pre class="policy-json">${JSON.stringify(policy, null, 2)}</pre>
    </div>
  `

  // Combine all sections - CHANGED ORDER HERE: summaryHtml + resultsHtml + policyHtml
  const content = summaryHtml + resultsHtml + policyHtml

  // Create complete HTML with header, summary, and accounts
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Policy Verification - ${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        h1, h2, h3 {
            color: #0066cc;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 2px solid #0066cc;
        }
        .summary {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 20px;
        }
        .summary-cards {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }
        .summary-card {
            background-color: #0066cc;
            color: white;
            border-radius: 8px;
            padding: 15px;
            min-width: 180px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            flex: 1;
        }
        .summary-card-valid {
            background-color: #28a745; /* Green for valid principals */
        }
        .summary-card-invalid {
            background-color: #dc3545; /* Red for invalid principals */
        }
        .summary-title {
            font-size: 0.9em;
            margin-bottom: 8px;
        }
        .summary-value {
            font-size: 2em;
            font-weight: bold;
        }
        .policy-section, .results-section {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 20px;
        }
        .policy-json {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
            font-family: monospace;
            border: 1px solid #e0e0e0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 10px;
            border: 1px solid #ddd;
            text-align: left;
        }
        th {
            background-color: #0066cc;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .valid-principal {
            background-color: #d4edda;
        }
        .invalid-principal {
            background-color: #f8d7da;
        }
        .timestamp {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-style: italic;
        }
    </style>
</head>
<body>
    <h1>AWS Policy Verification - ${title}</h1>
    ${content}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}
