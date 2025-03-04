// File: src/templates/opensearch-template.ts
// OpenSearch HTML report template

import { OpenSearchDomainInfo } from '../types'

/**
 * Generate enhanced HTML output for OpenSearch domains
 * @param domains The OpenSearch domains to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateOpenSearchHtml(
  domains: OpenSearchDomainInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group domains by account for visualization
  const accountGroups = new Map<string, OpenSearchDomainInfo[]>()
  //const accountMap = new Map<string, string>() // Map AccountId to AccountName

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')
        //accountMap.set(accountId, accountName)

        // Initialize empty array for accounts without domains
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all domains
  domains.forEach((domain) => {
    const accountId = domain.AccountId
    const accountName = domain.AccountName
    //accountMap.set(accountId, accountName) // Update map with any new accounts found

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    const group = accountGroups.get(key)
    if (group) {
      group.push(domain)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithOpenSearch = Array.from(accountGroups.entries()).filter(([, domains]) => domains.length > 0).length
  const accountsWithoutOpenSearch = totalAccounts - accountsWithOpenSearch
  const totalOpenSearchDomains = domains.length

  // Group domains by status
  const domainsByStatus = new Map<string, number>()
  domains.forEach((domain) => {
    const status = domain.Status || 'Unknown'
    domainsByStatus.set(status, (domainsByStatus.get(status) || 0) + 1)
  })

  // Group domains by engine version
  const domainsByVersion = new Map<string, number>()
  domains.forEach((domain) => {
    const version = domain.EngineVersion || 'Unknown'
    domainsByVersion.set(version, (domainsByVersion.get(version) || 0) + 1)
  })

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
          <div class="summary-title">Accounts With OpenSearch</div>
          <div class="summary-value">${accountsWithOpenSearch}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without OpenSearch</div>
          <div class="summary-value">${accountsWithoutOpenSearch}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total OpenSearch Domains</div>
          <div class="summary-value">${totalOpenSearchDomains}</div>
        </div>
      </div>
      
      <h3>Domain Status</h3>
      <div class="status-summary">
        ${Array.from(domainsByStatus.entries())
          .map(
            ([status, count]) => `
          <div class="status-card status-${status.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
            <div class="status-name">${status}</div>
            <div class="status-count">${count}</div>
          </div>
        `,
          )
          .join('')}
      </div>

      <h3>Engine Versions</h3>
      <div class="version-summary">
        ${Array.from(domainsByVersion.entries())
          .map(
            ([version, count]) => `
          <div class="version-card">
            <div class="version-name">${version}</div>
            <div class="version-count">${count}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
    
    <div class="filter-controls">
      <h3>Filters</h3>
      <div class="filter-buttons">
        <button class="filter-button" onclick="showAllAccounts()">Show All Accounts</button>
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With OpenSearch</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without OpenSearch</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
    </div>
  `

  // Generate account sections
  let accountsHtml = ''

  // Convert the Map to an array and sort by account name
  const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  sortedAccounts.forEach(([accountKey, accountDomains]) => {
    const isEmpty = accountDomains.length === 0
    const accountClass = isEmpty ? 'empty-account' : 'has-resources'

    accountsHtml += `
      <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
        <div class="account-header" onclick="toggleAccount(this)">
          <h2>${accountKey} 
            <span class="instance-count">${accountDomains.length} OpenSearch Domain${accountDomains.length !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No OpenSearch Domains</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>OpenSearch Domains (${accountDomains.length})</h3>
            ${
              accountDomains.length === 0
                ? '<p class="no-resources">No OpenSearch domains found in this account.</p>'
                : generateOpenSearchTable(accountDomains)
            }
          </div>
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
    <title>AWS Resources Report - ${new Date().toISOString().split('T')[0]}</title>
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
        .instance-count {
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
        .resource-active {
            color: green;
            font-weight: bold;
        }
        .resource-processing {
            color: blue;
        }
        .resource-upgrade-in-progress {
            color: blue;
        }
        .resource-deleted {
            color: red;
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
        .status-summary, .version-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 20px;
        }
        .status-card, .version-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        .status-active {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .status-processing, .status-upgrade-in-progress {
            background-color: #cce5ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .status-deleted {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .status-name, .version-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .status-count, .version-count {
            font-size: 1.5em;
        }
        .version-card {
            background-color: #e6f2ff;
            border: 1px solid #b8daff;
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
    <h1>AWS OpenSearch Domains - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Generate OpenSearch domains table HTML
 */
function generateOpenSearchTable(domains: OpenSearchDomainInfo[]): string {
  // Sort domains by status and name
  const sortedDomains = [...domains].sort((a, b) => {
    // First by status (active first)
    if (a.Status.toLowerCase() === 'active' && b.Status.toLowerCase() !== 'active') return -1
    if (a.Status.toLowerCase() !== 'active' && b.Status.toLowerCase() === 'active') return 1

    // Then by domain name
    return a.DomainName.localeCompare(b.DomainName)
  })

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Domain Name</th>
          <th>Engine Version</th>
          <th>Data Node Type</th>
          <th>Data Node Count</th>
          <th>Master Node Type</th>
          <th>Master Node Count</th>
          <th>Status</th>
          <th>Endpoint</th>
          <th>Region</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedDomains.forEach((domain) => {
    // Determine status CSS class
    let statusClass = ''
    const statusLower = domain.Status.toLowerCase()

    if (statusLower.includes('active')) {
      statusClass = 'resource-active'
    } else if (statusLower.includes('process') || statusLower.includes('upgrade')) {
      statusClass = 'resource-processing'
    } else if (statusLower.includes('delet')) {
      statusClass = 'resource-deleted'
    }

    tableHtml += `
      <tr>
        <td>${domain.DomainName}</td>
        <td>${domain.EngineVersion}</td>
        <td>${domain.InstanceType}</td>
        <td>${domain.InstanceCount}</td>
        <td>${domain.MasterType || 'N/A'}</td>
        <td>${domain.MasterCount !== null ? domain.MasterCount : 'N/A'}</td>
        <td class="${statusClass}">${domain.Status}</td>
        <td>${domain.Endpoint}</td>
        <td>${domain.Region}</td>
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return tableHtml
}
