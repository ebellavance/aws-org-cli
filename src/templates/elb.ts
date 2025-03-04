// File: src/templates/elb-template.ts
// ELB HTML report template

import { ELBInfo } from '../types'

/**
 * Generate enhanced HTML output for Elastic Load Balancers
 * @param elbs The ELBs to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateELBHtml(
  elbs: ELBInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group ELBs by account for visualization
  const accountGroups = new Map<string, ELBInfo[]>()

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')

        // Initialize empty array for accounts without ELBs
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all ELBs
  elbs.forEach((elb) => {
    const accountId = elb.AccountId
    const accountName = elb.AccountName

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    const group = accountGroups.get(key)
    if (group) {
      group.push(elb)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithELB = Array.from(accountGroups.entries()).filter(([, elbs]) => elbs.length > 0).length
  const accountsWithoutELB = totalAccounts - accountsWithELB
  const totalELBs = elbs.length

  // Group ELBs by type
  const elbsByType = new Map<string, number>()
  elbs.forEach((elb) => {
    const type = elb.Type || 'unknown'
    elbsByType.set(type, (elbsByType.get(type) || 0) + 1)
  })

  // Group ELBs by state
  const elbsByState = new Map<string, number>()
  elbs.forEach((elb) => {
    const state = elb.State || 'Unknown'
    elbsByState.set(state, (elbsByState.get(state) || 0) + 1)
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
          <div class="summary-title">Accounts With ELBs</div>
          <div class="summary-value">${accountsWithELB}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without ELBs</div>
          <div class="summary-value">${accountsWithoutELB}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total ELBs</div>
          <div class="summary-value">${totalELBs}</div>
        </div>
      </div>
      
      <h3>ELB Types</h3>
      <div class="type-summary">
        ${Array.from(elbsByType.entries())
          .map(
            ([type, count]) => `
          <div class="type-card type-${type.toLowerCase()}">
            <div class="type-name">${formatELBType(type)}</div>
            <div class="type-count">${count}</div>
          </div>
        `,
          )
          .join('')}
      </div>

      <h3>ELB States</h3>
      <div class="state-summary">
        ${Array.from(elbsByState.entries())
          .map(
            ([state, count]) => `
          <div class="state-card state-${state.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
            <div class="state-name">${state}</div>
            <div class="state-count">${count}</div>
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
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With ELBs</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without ELBs</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
    </div>
  `

  // Generate account sections
  let accountsHtml = ''

  // Convert the Map to an array and sort by account name
  const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  sortedAccounts.forEach(([accountKey, accountElbs]) => {
    const isEmpty = accountElbs.length === 0
    const accountClass = isEmpty ? 'empty-account' : 'has-resources'

    accountsHtml += `
      <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
        <div class="account-header" onclick="toggleAccount(this)">
          <h2>${accountKey} 
            <span class="instance-count">${accountElbs.length} ELB${accountElbs.length !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No ELBs</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>Elastic Load Balancers (${accountElbs.length})</h3>
            ${
              accountElbs.length === 0
                ? '<p class="no-resources">No Elastic Load Balancers found in this account.</p>'
                : generateELBTable(accountElbs)
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
        .resource-active, .resource-available {
            color: green;
            font-weight: bold;
        }
        .resource-provisioning, .resource-updating {
            color: blue;
        }
        .resource-failed {
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
        .type-summary, .state-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 20px;
        }
        .type-card, .state-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        .type-card {
            background-color: #e6f2ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .type-classic {
            background-color: #d1ecf1;
            border-color: #bee5eb;
            color: #0c5460;
        }
        .type-application {
            background-color: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
        }
        .type-network {
            background-color: #fff3cd;
            border-color: #ffeeba;
            color: #856404;
        }
        .type-gateway {
            background-color: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
        .state-active {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .state-provisioning, .state-updating {
            background-color: #cce5ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .state-name, .type-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .state-count, .type-count {
            font-size: 1.5em;
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
        
        /* ELB-specific styles */
        .elb-scheme-internet-facing {
            color: #0066cc;
            font-weight: bold;
        }
        .elb-scheme-internal {
            color: #555;
        }
        .elb-type {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
            font-weight: bold;
            text-transform: capitalize;
        }
        .elb-type-classic {
            background-color: #d1ecf1;
            color: #0c5460;
        }
        .elb-type-application {
            background-color: #d4edda;
            color: #155724;
        }
        .elb-type-network {
            background-color: #fff3cd;
            color: #856404;
        }
        .elb-type-gateway {
            background-color: #f8d7da;
            color: #721c24;
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
    <h1>AWS Elastic Load Balancers - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Format the display of ELB type
 */
function formatELBType(type: string): string {
  switch (type.toLowerCase()) {
    case 'classic':
      return 'Classic ELB'
    case 'application':
      return 'ALB'
    case 'network':
      return 'NLB'
    case 'gateway':
      return 'GWLB'
    default:
      return `${type} LB`
  }
}

/**
 * Generate ELB table HTML
 */
function generateELBTable(elbs: ELBInfo[]): string {
  // Sort ELBs by type and name
  const sortedElbs = [...elbs].sort((a, b) => {
    // First by type
    if (a.Type !== b.Type) {
      return a.Type.localeCompare(b.Type)
    }

    // Then by name
    return a.LoadBalancerName.localeCompare(b.LoadBalancerName)
  })

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Scheme</th>
          <th>State</th>
          <th>DNS Name</th>
          <th>Private IPs</th>
          <th>Public IPs</th>
          <th>Region</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedElbs.forEach((elb) => {
    // Determine state CSS class
    let stateClass = ''
    if (elb.State.toLowerCase().includes('active') || elb.State.toLowerCase().includes('available')) {
      stateClass = 'resource-active'
    } else if (
      elb.State.toLowerCase().includes('provisioning') ||
      elb.State.toLowerCase().includes('creating') ||
      elb.State.toLowerCase().includes('updating')
    ) {
      stateClass = 'resource-provisioning'
    } else if (elb.State.toLowerCase().includes('failed')) {
      stateClass = 'resource-failed'
    }

    // Determine scheme class
    const schemeClass = elb.Scheme.toLowerCase().includes('internet')
      ? 'elb-scheme-internet-facing'
      : 'elb-scheme-internal'

    // Format creation date
    let createdDate = elb.CreatedTime
    if (createdDate !== 'Unknown') {
      try {
        createdDate = new Date(createdDate).toLocaleDateString()
      } catch {
        // Keep original if parsing fails
      }
    }

    tableHtml += `
      <tr>
        <td>${elb.LoadBalancerName}</td>
        <td><span class="elb-type elb-type-${elb.Type.toLowerCase()}">${formatELBType(elb.Type)}</span></td>
        <td class="${schemeClass}">${elb.Scheme}</td>
        <td class="${stateClass}">${elb.State}</td>
        <td>${elb.DNSName}</td>
        <td>${elb.PrivateIpAddresses}</td>
        <td>${elb.PublicIpAddresses}</td>
        <td>${elb.Region}</td>
        <td>${createdDate}</td>
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return tableHtml
}
