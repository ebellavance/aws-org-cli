// File: src/templates/role.ts
// Role count HTML report template

/**
 * Generate enhanced HTML output for IAM role counts
 * @param formattedResults The formatted role count results
 * @param accountRoleCounts The raw role count data by account
 * @param title The title for the report
 */
export function generateRoleCountHtml(
  formattedResults: Record<string, unknown>[],
  accountRoleCounts: Map<string, { counts: Record<string, number>; accountName: string }>,
  title: string,
): string {
  // Calculate organization totals
  const organizationTotals: Record<string, number> = {
    total: 0,
    awsService: 0,
    awsReserved: 0,
    custom: 0,
  }

  // Add up counts from all accounts
  accountRoleCounts.forEach(({ counts }) => {
    organizationTotals.total += counts.total
    organizationTotals.awsService += counts.awsService
    organizationTotals.awsReserved += counts.awsReserved
    organizationTotals.custom += counts.custom
  })

  // Create summary section
  const summaryHtml = `
      <div class="summary">
        <h2>Summary</h2>
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-title">Total Accounts</div>
            <div class="summary-value">${accountRoleCounts.size}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Total Roles</div>
            <div class="summary-value">${organizationTotals.total}</div>
          </div>
          <div class="summary-card summary-card-custom">
            <div class="summary-title">Custom Roles</div>
            <div class="summary-value">${organizationTotals.custom}</div>
            <div class="summary-percentage">${formatPercentage(organizationTotals.custom, organizationTotals.total)}</div>
          </div>
          <div class="summary-card summary-card-service">
            <div class="summary-title">AWS Service Roles</div>
            <div class="summary-value">${organizationTotals.awsService}</div>
            <div class="summary-percentage">${formatPercentage(organizationTotals.awsService, organizationTotals.total)}</div>
          </div>
        </div>
  
        ${createRoleDistributionChart(organizationTotals)}
      </div>
    `

  // Generate account results table
  const tableHtml = generateRoleCountTable(formattedResults)

  // Create complete HTML with header, summary, and accounts
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AWS IAM Role Counts - ${title}</title>
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
          .summary-title {
              font-size: 0.9em;
              margin-bottom: 8px;
          }
          .summary-value {
              font-size: 2em;
              font-weight: bold;
          }
          .summary-percentage {
              font-size: 0.9em;
              margin-top: 5px;
              opacity: 0.8;
          }
          .summary-card-custom {
              background-color: #28a745;
          }
          .summary-card-service {
              background-color: #17a2b8;
          }
          .chart-container {
              margin-top: 20px;
              margin-bottom: 30px;
          }
          .chart-title {
              text-align: center;
              margin-bottom: 15px;
              font-weight: bold;
          }
          .role-chart {
              display: flex;
              height: 40px;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 10px;
          }
          .chart-segment {
              display: flex;
              justify-content: center;
              align-items: center;
              color: white;
              font-weight: bold;
              transition: all 0.3s;
          }
          .chart-segment:hover {
              opacity: 0.9;
          }
          .chart-segment-custom {
              background-color: #28a745;
          }
          .chart-segment-service {
              background-color: #17a2b8;
          }
          .chart-segment-reserved {
              background-color: #6c757d;
          }
          .chart-legend {
              display: flex;
              justify-content: center;
              gap: 20px;
              margin-top: 10px;
          }
          .legend-item {
              display: flex;
              align-items: center;
              font-size: 0.9em;
          }
          .legend-color {
              width: 12px;
              height: 12px;
              border-radius: 3px;
              margin-right: 5px;
          }
          table {
              border-collapse: collapse;
              width: 100%;
              margin-top: 10px;
              margin-bottom: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow: hidden;
          }
          th, td {
              border: 1px solid #ddd;
              padding: 12px 8px;
              text-align: left;
          }
          th {
              background-color: #0066cc;
              color: white;
          }
          tr:nth-child(even) {
              background-color: #f2f2f2;
          }
          tr:hover {
              background-color: #e6f2ff;
          }
          .total-row {
              font-weight: bold;
              background-color: #e6f2ff;
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
      <h1>AWS IAM Role Counts - ${title}</h1>
      ${summaryHtml}
      ${tableHtml}
      <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
  </body>
  </html>`
}

/**
 * Format a percentage value
 */
function formatPercentage(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

/**
 * Create a visual chart showing the role distribution
 */
function createRoleDistributionChart(totals: Record<string, number>): string {
  const total = totals.total
  if (total === 0) return ''

  const customPercent = (totals.custom / total) * 100
  const servicePercent = (totals.awsService / total) * 100
  const reservedPercent = (totals.awsReserved / total) * 100

  return `
      <div class="chart-container">
        <div class="chart-title">Role Distribution</div>
        <div class="role-chart">
          <div class="chart-segment chart-segment-custom" style="width: ${customPercent}%">
            ${customPercent > 10 ? `${customPercent.toFixed(1)}%` : ''}
          </div>
          <div class="chart-segment chart-segment-service" style="width: ${servicePercent}%">
            ${servicePercent > 10 ? `${servicePercent.toFixed(1)}%` : ''}
          </div>
          <div class="chart-segment chart-segment-reserved" style="width: ${reservedPercent}%">
            ${reservedPercent > 10 ? `${reservedPercent.toFixed(1)}%` : ''}
          </div>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color chart-segment-custom"></div>
            Custom Roles (${totals.custom})
          </div>
          <div class="legend-item">
            <div class="legend-color chart-segment-service"></div>
            AWS Service Roles (${totals.awsService})
          </div>
          <div class="legend-item">
            <div class="legend-color chart-segment-reserved"></div>
            AWS Reserved Roles (${totals.awsReserved})
          </div>
        </div>
      </div>
    `
}

/**
 * Generate the role count results table
 */
function generateRoleCountTable(results: Record<string, unknown>[]): string {
  let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Account ID</th>
            <th>Account Name</th>
            <th>Total Roles</th>
            <th>Custom Roles</th>
            <th>AWS Service Roles</th>
            <th>AWS Reserved Roles</th>
          </tr>
        </thead>
        <tbody>
    `

  results.forEach((result) => {
    const isTotal = String(result.AccountId) === 'ALL'

    tableHtml += `
        <tr class="${isTotal ? 'total-row' : ''}">
          <td>${result.AccountId}</td>
          <td>${result.AccountName}</td>
          <td>${result.TotalRoles}</td>
          <td>${result.CustomRoles}</td>
          <td>${result.AwsServiceRoles}</td>
          <td>${result.AwsReservedRoles}</td>
        </tr>
      `
  })

  tableHtml += `
        </tbody>
      </table>
    `

  return tableHtml
}
