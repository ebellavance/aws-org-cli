// File: src/templates/heni.ts
// HENI HTML report template

import { HENIInfo } from '../types'

/**
 * Generate enhanced HTML output for Hyperplane ENIs
 * @param heniInfos The HENI information to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateHENIHtml(
  heniInfos: HENIInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group HENI info by account for visualization
  const accountGroups = new Map<string, HENIInfo[]>()

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')

        // Initialize empty array for accounts
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all HENI info
  heniInfos.forEach((info) => {
    const accountId = info.AccountId
    const accountName = info.AccountName

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }

    const group = accountGroups.get(key)
    if (group) {
      group.push(info)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithHENIs = Array.from(accountGroups.entries()).filter(([, infos]) =>
    infos.some((info) => info.TotalHENIs > 0),
  ).length
  const accountsWithoutHENIs = totalAccounts - accountsWithHENIs

  // Calculate total counts across all accounts
  const totalENIs = heniInfos.reduce((sum, info) => sum + info.TotalENIs, 0)
  const availableENIs = heniInfos.reduce((sum, info) => sum + info.AvailableENIs, 0)
  const inUseENIs = heniInfos.reduce((sum, info) => sum + info.InUseENIs, 0)
  const totalHENIs = heniInfos.reduce((sum, info) => sum + info.TotalHENIs, 0)
  const totalLambdaHENIs = heniInfos.reduce((sum, info) => sum + info.TotalLambdaHENIs, 0)

  // Calculate percentages
  const heniPercentage = totalENIs > 0 ? ((totalHENIs / totalENIs) * 100).toFixed(1) : '0'
  const lambdaHeniPercentage = totalHENIs > 0 ? ((totalLambdaHENIs / totalHENIs) * 100).toFixed(1) : '0'

  // Create summary section
  const summaryHtml = `
    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-title">Total Accounts</div>
          <div class="summary-value">${totalAccounts}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts With HENIs</div>
          <div class="summary-value">${accountsWithHENIs}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without HENIs</div>
          <div class="summary-value">${accountsWithoutHENIs}</div>
        </div>
      </div>
      
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-title">Total ENIs</div>
          <div class="summary-value">${totalENIs}</div>
        </div>
        <div class="summary-card summary-card-available">
          <div class="summary-title">Available ENIs</div>
          <div class="summary-value">${availableENIs}</div>
          <div class="summary-subtitle">${totalENIs > 0 ? ((availableENIs / totalENIs) * 100).toFixed(1) : '0'}% of all ENIs</div>
        </div>
        <div class="summary-card summary-card-inuse">
          <div class="summary-title">In-Use ENIs</div>
          <div class="summary-value">${inUseENIs}</div>
          <div class="summary-subtitle">${totalENIs > 0 ? ((inUseENIs / totalENIs) * 100).toFixed(1) : '0'}% of all ENIs</div>
        </div>
      </div>
      
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-title">Hyperplane ENIs</div>
          <div class="summary-value">${totalHENIs}</div>
          <div class="summary-subtitle">${heniPercentage}% of all ENIs</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Lambda HENIs</div>
          <div class="summary-value">${totalLambdaHENIs}</div>
          <div class="summary-subtitle">${lambdaHeniPercentage}% of all HENIs</div>
        </div>
      </div>
    </div>

    <div class="filter-controls">
      <h3>Filters</h3>
      <div class="filter-buttons">
        <button class="filter-button" onclick="showAllAccounts()">Show All Accounts</button>
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With HENIs</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without HENIs</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
    </div>
  `

  // Generate account sections
  let accountsHtml = ''

  // Convert the Map to an array and sort by account name
  const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  sortedAccounts.forEach(([accountKey, accountInfos]) => {
    // Calculate account-specific totals
    const accountTotalENIs = accountInfos.reduce((sum, info) => sum + info.TotalENIs, 0)
    const accountAvailableENIs = accountInfos.reduce((sum, info) => sum + info.AvailableENIs, 0)
    const accountInUseENIs = accountInfos.reduce((sum, info) => sum + info.InUseENIs, 0)
    const accountTotalHENIs = accountInfos.reduce((sum, info) => sum + info.TotalHENIs, 0)
    const accountTotalLambdaHENIs = accountInfos.reduce((sum, info) => sum + info.TotalLambdaHENIs, 0)

    const isEmpty = accountTotalHENIs === 0
    const accountClass = isEmpty ? 'empty-account' : 'has-resources'

    // Calculate percentages for this account
    const accountHeniPercentage = accountTotalENIs > 0 ? ((accountTotalHENIs / accountTotalENIs) * 100).toFixed(1) : '0'
    const accountLambdaHeniPercentage =
      accountTotalHENIs > 0 ? ((accountTotalLambdaHENIs / accountTotalHENIs) * 100).toFixed(1) : '0'

    accountsHtml += `
      <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
        <div class="account-header" onclick="toggleAccount(this)">
          <h2>${accountKey} 
            <span class="resource-count">${accountTotalHENIs} Hyperplane ENI${accountTotalHENIs !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No Hyperplane ENIs</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>Account Summary</h3>
            <div class="account-summary">
              <div class="account-metric">
                <div class="metric-title">Total ENIs</div>
                <div class="metric-value">${accountTotalENIs}</div>
              </div>
              <div class="account-metric account-metric-available">
                <div class="metric-title">Available ENIs</div>
                <div class="metric-value">${accountAvailableENIs}</div>
                <div class="metric-subtitle">${accountTotalENIs > 0 ? ((accountAvailableENIs / accountTotalENIs) * 100).toFixed(1) : '0'}% of ENIs</div>
              </div>
              <div class="account-metric account-metric-inuse">
                <div class="metric-title">In-Use ENIs</div>
                <div class="metric-value">${accountInUseENIs}</div>
                <div class="metric-subtitle">${accountTotalENIs > 0 ? ((accountInUseENIs / accountTotalENIs) * 100).toFixed(1) : '0'}% of ENIs</div>
              </div>
            </div>
            <div class="account-summary">
              <div class="account-metric">
                <div class="metric-title">Hyperplane ENIs</div>
                <div class="metric-value">${accountTotalHENIs}</div>
                <div class="metric-subtitle">${accountHeniPercentage}% of ENIs</div>
              </div>
              <div class="account-metric">
                <div class="metric-title">Lambda HENIs</div>
                <div class="metric-value">${accountTotalLambdaHENIs}</div>
                <div class="metric-subtitle">${accountLambdaHeniPercentage}% of HENIs</div>
              </div>
            </div>
          </div>          
          ${
            // Only show the regions table if there are hyperplane ENIs
            !isEmpty
              ? generateRegionsTable(accountInfos)
              : '<p class="no-resources">No hyperplane ENIs found in this account.</p>'
          }
          
          ${
            // Only show the detailed ENIs table if there are hyperplane ENIs
            !isEmpty && accountTotalHENIs > 0 ? generateHENITable(accountInfos) : ''
          }
        </div>
      </div>
    `
  })

  // Create complete HTML with header, summary, and accounts
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Hyperplane ENIs - ${title}</title>
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
        .account-container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 15px;
            transition: all 0.3s ease;
        }
        .account-header {
            background-color: #e6f2ff;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 10px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .account-header h2 {
            margin: 0;
            color: #003366;
            font-size: 1.2em;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .resource-count {
            font-size: 0.8em;
            font-weight: normal;
            background-color: #0066cc;
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
        }
        .resource-section {
            margin-top: 15px;
            margin-bottom: 25px;
        }
        .account-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }
        .account-metric {
            background-color: #f0f7ff;
            border: 1px solid #cce5ff;
            border-radius: 5px;
            padding: 10px;
            min-width: 150px;
            flex: 1;
        }
        .metric-title {
            font-size: 0.9em;
            color: #0066cc;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #003366;
        }
        .metric-subtitle {
            font-size: 0.8em;
            color: #666;
            margin-top: 5px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 10px;
            margin-bottom: 20px;
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
        .no-resources {
            color: #666;
            font-style: italic;
            padding: 10px;
            background-color: #f9f9f9;
            border-radius: 4px;
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
        .summary-subtitle {
            font-size: 0.8em;
            opacity: 0.8;
            margin-top: 5px;
        }
        .summary-card-available {
            background-color: #4d94ff;
        }
        .summary-card-inuse {
            background-color: #47d147;
        }
        .account-metric-available {
            background-color: #e6f0ff;
            border-color: #99c2ff;
        }
        .account-metric-inuse {
            background-color: #e6ffe6;
            border-color: #99e699;
        }
        .heni-lambda {
            color: #00cc66;
        }
        .heni-other {
            color: #0066cc;
        }
        .account-content {
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .account-content.collapsed {
            display: none;
        }
        .empty-account-indicator {
            color: #999;
            font-size: 0.8em;
            background-color: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
        }
        .toggle-icon {
            margin-left: 10px;
            font-weight: bold;
            transition: transform 0.3s;
        }
        .collapsed .toggle-icon {
            transform: rotate(-90deg);
        }
        .filter-controls {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 15px;
        }
        .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        .filter-button {
            background-color: #0066cc;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .filter-button:hover {
            background-color: #004c99;
        }
        .account-container.empty-account {
            border-left: 3px solid #ffcc00;
        }
        .account-container.has-resources {
            border-left: 3px solid #00cc66;
        }
        .timestamp {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-style: italic;
        }
        .heni-lambda {
            color: #00cc66;
        }
        .heni-other {
            color: #0066cc;
        }
    </style>
    <script>
        function toggleAccount(header) {
            const container = header.parentElement;
            const content = container.querySelector('.account-content');
            content.classList.toggle('collapsed');
            
            // Update toggle icon
            const icon = header.querySelector('.toggle-icon');
            if (content.classList.contains('collapsed')) {
                icon.style.transform = 'rotate(-90deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        }
        
        function showAllAccounts() {
            document.querySelectorAll('.account-container').forEach(container => {
                container.style.display = 'block';
            });
        }
        
        function showAccountsWithResources() {
            document.querySelectorAll('.account-container').forEach(container => {
                container.style.display = container.dataset.hasResources === 'true' ? 'block' : 'none';
            });
        }
        
        function showEmptyAccounts() {
            document.querySelectorAll('.account-container').forEach(container => {
                container.style.display = container.dataset.hasResources === 'false' ? 'block' : 'none';
            });
        }
        
        function expandAllAccounts() {
            document.querySelectorAll('.account-content').forEach(content => {
                content.classList.remove('collapsed');
                
                // Reset toggle icon
                const header = content.parentElement.querySelector('.account-header');
                const icon = header.querySelector('.toggle-icon');
                icon.style.transform = 'rotate(0deg)';
            });
        }

        function collapseAllAccounts() {
            document.querySelectorAll('.account-content').forEach(content => {
                content.classList.add('collapsed');
                
                // Update toggle icon
                const header = content.parentElement.querySelector('.account-header');
                const icon = header.querySelector('.toggle-icon');
                icon.style.transform = 'rotate(-90deg)';
            });
        }
        
        // Run this function when the page loads to show only accounts with resources by default
        document.addEventListener('DOMContentLoaded', function() {
            showAccountsWithResources();
        });
    </script>
</head>
<body>
    <h1>AWS Hyperplane ENIs - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Generate a table showing HENI information by region
 */
function generateRegionsTable(infos: HENIInfo[]): string {
  // Sort regions by total HENIs (descending)
  const sortedInfos = [...infos].sort((a, b) => b.TotalHENIs - a.TotalHENIs)

  let tableHtml = `
    <h3>Hyperplane ENIs by Region</h3>
    <table>
      <thead>
        <tr>
          <th>Region</th>
          <th>Total ENIs</th>
          <th>Available ENIs</th>
          <th>In-Use ENIs</th>
          <th>Hyperplane ENIs</th>
          <th>Lambda HENIs</th>
          <th>HENI %</th>
          <th>Lambda HENI %</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedInfos.forEach((info) => {
    // Calculate percentages
    const heniPercentage = info.TotalENIs > 0 ? ((info.TotalHENIs / info.TotalENIs) * 100).toFixed(1) : '0'
    const lambdaHeniPercentage =
      info.TotalHENIs > 0 ? ((info.TotalLambdaHENIs / info.TotalHENIs) * 100).toFixed(1) : '0'
    const availablePercentage = info.TotalENIs > 0 ? ((info.AvailableENIs / info.TotalENIs) * 100).toFixed(1) : '0'
    const inUsePercentage = info.TotalENIs > 0 ? ((info.InUseENIs / info.TotalENIs) * 100).toFixed(1) : '0'

    tableHtml += `
      <tr>
        <td>${info.Region}</td>
        <td>${info.TotalENIs}</td>
        <td>${info.AvailableENIs} (${availablePercentage}%)</td>
        <td>${info.InUseENIs} (${inUsePercentage}%)</td>
        <td>${info.TotalHENIs}</td>
        <td>${info.TotalLambdaHENIs}</td>
        <td>${heniPercentage}%</td>
        <td>${lambdaHeniPercentage}%</td>
      </tr>
    `
  })
  return tableHtml
}

/**
 * Generate a table showing detailed HENI information
 */
function generateHENITable(infos: HENIInfo[]): string {
  // Collect all hyperplane ENIs from all regions
  const allHENIs = infos.flatMap((info) =>
    info.HyperplaneENIs.map((eni) => ({
      region: info.Region,
      eni,
    })),
  )

  // If no HENIs, return empty string
  if (allHENIs.length === 0) {
    return ''
  }

  let tableHtml = `
    <h3>Hyperplane ENI Details</h3>
    <table>
      <thead>
        <tr>
          <th>Region</th>
          <th>ENI ID</th>
          <th>Attachment ID</th>
          <th>Type</th>
          <th>Is Lambda?</th>
          <th>Subnet ID</th>
          <th>VPC ID</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `

  allHENIs.forEach(({ region, eni }) => {
    // Determine if it's a Lambda ENI
    const isLambda = eni.InterfaceType?.toLowerCase().includes('lambda')
    const typeClass = isLambda ? 'heni-lambda' : 'heni-other'

    tableHtml += `
      <tr>
        <td>${region}</td>
        <td>${eni.NetworkInterfaceId || 'Unknown'}</td>
        <td>${eni.Attachment?.AttachmentId || 'Unknown'}</td>
        <td class="${typeClass}">${eni.InterfaceType || 'Unknown'}</td>
        <td>${isLambda ? 'Yes' : 'No'}</td>
        <td>${eni.SubnetId || 'Unknown'}</td>
        <td>${eni.VpcId || 'Unknown'}</td>
        <td>${eni.Status || 'Unknown'}</td>
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return tableHtml
}
