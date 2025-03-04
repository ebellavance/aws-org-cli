// File: src/templates/rds-template.ts
// RDS HTML report template

import { RDSInstanceInfo } from '../types'

/**
 * Generate enhanced HTML output for RDS instances
 * @param instances The RDS instances to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateRDSHtml(
  instances: RDSInstanceInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group instances by account for visualization
  const accountGroups = new Map<string, RDSInstanceInfo[]>()
  //const accountMap = new Map<string, string>() // Map AccountId to AccountName

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')
        //accountMap.set(accountId, accountName)

        // Initialize empty array for accounts without instances
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all instances
  instances.forEach((instance) => {
    const accountId = instance.AccountId
    const accountName = instance.AccountName
    //accountMap.set(accountId, accountName) // Update map with any new accounts found

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    const group = accountGroups.get(key)
    if (group) {
      group.push(instance)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithRDS = Array.from(accountGroups.entries()).filter(([, instances]) => instances.length > 0).length
  const accountsWithoutRDS = totalAccounts - accountsWithRDS
  const totalRDSInstances = instances.length

  // Group instances by state
  const instancesByState = new Map<string, number>()
  instances.forEach((instance) => {
    const state = instance.State || 'Unknown'
    instancesByState.set(state, (instancesByState.get(state) || 0) + 1)
  })

  // Group instances by engine
  const instancesByEngine = new Map<string, number>()
  instances.forEach((instance) => {
    const engine = instance.Engine || 'Unknown'
    instancesByEngine.set(engine, (instancesByEngine.get(engine) || 0) + 1)
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
          <div class="summary-title">Accounts With RDS</div>
          <div class="summary-value">${accountsWithRDS}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without RDS</div>
          <div class="summary-value">${accountsWithoutRDS}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total RDS Instances</div>
          <div class="summary-value">${totalRDSInstances}</div>
        </div>
      </div>
      
      <h3>Instance States</h3>
      <div class="state-summary">
        ${Array.from(instancesByState.entries())
          .map(
            ([state, count]) => `
          <div class="state-card state-${state.toLowerCase()}">
            <div class="state-name">${state}</div>
            <div class="state-count">${count}</div>
          </div>
        `,
          )
          .join('')}
      </div>

      <h3>Database Engines</h3>
      <div class="engine-summary">
        ${Array.from(instancesByEngine.entries())
          .map(
            ([engine, count]) => `
          <div class="engine-card">
            <div class="engine-name">${engine}</div>
            <div class="engine-count">${count}</div>
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
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With RDS</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without RDS</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
    </div>
  `

  // Generate account sections
  let accountsHtml = ''

  // Convert the Map to an array and sort by account name
  const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  sortedAccounts.forEach(([accountKey, accountInstances]) => {
    const isEmpty = accountInstances.length === 0
    const accountClass = isEmpty ? 'empty-account' : 'has-resources'

    accountsHtml += `
      <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
        <div class="account-header" onclick="toggleAccount(this)">
          <h2>${accountKey} 
            <span class="instance-count">${accountInstances.length} RDS Instance${accountInstances.length !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No RDS Instances</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>RDS Instances (${accountInstances.length})</h3>
            ${
              accountInstances.length === 0
                ? '<p class="no-resources">No RDS instances found in this account.</p>'
                : generateRDSTable(accountInstances)
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
        .resource-available {
            color: green;
            font-weight: bold;
        }
        .resource-stopped {
            color: red;
        }
        .resource-backing-up, .resource-maintenance, .resource-modifying {
            color: orange;
        }
        .resource-creating, .resource-starting {
            color: blue;
        }
        .resource-deleting, .resource-stopping, .resource-failed {
            color: darkred;
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
        .state-summary, .engine-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 20px;
        }
        .state-card, .engine-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        .state-available {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .state-stopped {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .state-backing-up, .state-maintenance, .state-modifying {
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
        }
        .state-creating, .state-starting {
            background-color: #cce5ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .state-name, .engine-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .state-count, .engine-count {
            font-size: 1.5em;
        }
        .engine-card {
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
    <h1>AWS RDS Instances - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Generate RDS instances table HTML
 */
function generateRDSTable(instances: RDSInstanceInfo[]): string {
  // Sort instances by state and engine
  const sortedInstances = [...instances].sort((a, b) => {
    // First by state (available first)
    if (a.State === 'available' && b.State !== 'available') return -1
    if (a.State !== 'available' && b.State === 'available') return 1

    // Then by engine
    return a.Engine.localeCompare(b.Engine)
  })

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Instance ID</th>
          <th>Engine</th>
          <th>Version</th>
          <th>State</th>
          <th>Type</th>
          <th>Endpoint</th>
          <th>Multi-AZ</th>
          <th>Storage</th>
          <th>Region</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedInstances.forEach((instance) => {
    // Determine state CSS class
    let stateClass = ''
    switch (instance.State.toLowerCase()) {
      case 'available':
        stateClass = 'resource-available'
        break
      case 'stopped':
        stateClass = 'resource-stopped'
        break
      case 'backing-up':
      case 'maintenance':
      case 'modifying':
        stateClass = 'resource-backing-up'
        break
      case 'creating':
      case 'starting':
        stateClass = 'resource-creating'
        break
      case 'deleting':
      case 'stopping':
      case 'failed':
        stateClass = 'resource-deleting'
        break
      default:
        stateClass = ''
    }

    tableHtml += `
      <tr>
        <td>${instance.InstanceId}</td>
        <td>${instance.Engine}</td>
        <td>${instance.EngineVersion}</td>
        <td class="${stateClass}">${instance.State}</td>
        <td>${instance.Type}</td>
        <td>${instance.Endpoint}</td>
        <td>${instance.MultiAZ ? 'Yes' : 'No'}</td>
        <td>${instance.AllocatedStorage} GB (${instance.StorageType})</td>
        <td>${instance.Region}</td>
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return tableHtml
}
