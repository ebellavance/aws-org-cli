// File: src/templates/ec2.ts
// EC2 HTML report template with pricing information and OS details

import { EC2InstanceInfo } from '../types'

/**
 * Generate enhanced HTML output for EC2 instances
 * @param instances The EC2 instances to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateEC2Html(
  instances: EC2InstanceInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group instances by account for visualization
  const accountGroups = new Map<string, EC2InstanceInfo[]>()

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')

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
  const accountsWithEC2 = Array.from(accountGroups.entries()).filter(([, instances]) => instances.length > 0).length
  const accountsWithoutEC2 = totalAccounts - accountsWithEC2
  const totalEC2Instances = instances.length

  // Group instances by state
  const instancesByState = new Map<string, number>()
  instances.forEach((instance) => {
    const state = instance.State || 'Unknown'
    instancesByState.set(state, (instancesByState.get(state) || 0) + 1)
  })

  // Group instances by OS
  const instancesByOS = new Map<string, number>()
  instances.forEach((instance) => {
    const os = instance.OS || 'Unknown'
    instancesByOS.set(os, (instancesByOS.get(os) || 0) + 1)
  })

  // Check if pricing data is available
  const hasPricing = instances.some((instance) => 'HourlyPrice' in instance)

  // Calculate pricing summary if pricing information is available
  let pricingSummaryHtml = ''

  if (hasPricing) {
    // Only calculate for running instances
    const runningInstances = instances.filter((instance) => instance.State.toLowerCase() === 'running')

    // Calculate estimated hourly cost
    let totalHourlyCost = 0

    runningInstances.forEach((instance) => {
      if (instance.HourlyPrice) {
        // Extract the numeric part from strings like "0.0416 USD/hr"
        const priceMatch = instance.HourlyPrice.match(/([0-9.]+)/)
        if (priceMatch && priceMatch[1]) {
          const price = parseFloat(priceMatch[1])
          if (!isNaN(price)) {
            totalHourlyCost += price
          }
        }
      }
    })

    // Calculate daily and monthly estimates (30-day month)
    const dailyCost = totalHourlyCost * 24
    const monthlyCost = dailyCost * 30

    // Create pricing summary section with 4 decimal places for hourly costs
    pricingSummaryHtml = `
      <h3>Cost Estimates (Running Instances Only)</h3>
      <div class="cost-summary">
        <div class="summary-card">
          <div class="summary-title">Hourly</div>
          <div class="summary-value">$${totalHourlyCost.toFixed(4)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Daily</div>
          <div class="summary-value">$${dailyCost.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Monthly (est.)</div>
          <div class="summary-value">$${monthlyCost.toFixed(2)}</div>
        </div>
      </div>
      <p class="cost-disclaimer">* Cost estimates are based on on-demand pricing for ${runningInstances.length} running instances and may not reflect actual costs including reserved instances, savings plans, or other discounts.</p>
    `
  }

  // Create OS distribution section
  const osDistributionHtml = `
    <h3>Operating System Distribution</h3>
    <div class="os-summary">
      ${Array.from(instancesByOS.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count, descending
        .map(
          ([os, count]) => `
        <div class="os-card">
          <div class="os-name">${os}</div>
          <div class="os-count">${count}</div>
          <div class="os-percentage">${((count / totalEC2Instances) * 100).toFixed(1)}%</div>
        </div>
      `,
        )
        .join('')}
    </div>
  `

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
          <div class="summary-title">Accounts With EC2</div>
          <div class="summary-value">${accountsWithEC2}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without EC2</div>
          <div class="summary-value">${accountsWithoutEC2}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total EC2 Instances</div>
          <div class="summary-value">${totalEC2Instances}</div>
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

      ${osDistributionHtml}

      ${hasPricing ? pricingSummaryHtml : ''}
    </div>
    
    <div class="filter-controls">
      <h3>Filters</h3>
      <div class="filter-buttons">
        <button class="filter-button" onclick="showAllAccounts()">Show All Accounts</button>
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With EC2</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without EC2</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
      <div class="filter-row">
        <div class="search-container">
          <input type="text" id="instanceSearch" placeholder="Search instances..." onkeyup="filterInstances()">
        </div>
        <div class="filter-dropdown">
          <select id="osFilter" onchange="filterByOS()">
            <option value="all">All Operating Systems</option>
            ${Array.from(instancesByOS.keys())
              .sort()
              .map((os) => `<option value="${os}">${os}</option>`)
              .join('')}
          </select>
        </div>
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
            <span class="instance-count">${accountInstances.length} EC2 Instance${accountInstances.length !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No EC2 Instances</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>EC2 Instances (${accountInstances.length})</h3>
            ${
              accountInstances.length === 0
                ? '<p class="no-resources">No EC2 instances found in this account.</p>'
                : generateEC2Table(accountInstances)
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
        .resource-running, .resource-available {
            color: green;
            font-weight: bold;
        }
        .resource-stopped {
            color: red;
        }
        .resource-backing-up, .resource-maintenance, .resource-modifying {
            color: orange;
        }
        .resource-creating, .resource-starting, .resource-pending {
            color: blue;
        }
        .resource-deleting, .resource-stopping, .resource-shutting-down, .resource-failed, .resource-terminated {
            color: darkred;
        }
        .summary {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 20px;
        }
        .summary-cards, .cost-summary {
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
        .state-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .state-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        .state-running {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .state-stopped {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .state-pending {
            background-color: #cce5ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .state-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .state-count {
            font-size: 1.5em;
        }
        .os-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 20px;
        }
        .os-card {
            background-color: #f0f7ff;
            border: 1px solid #b8daff;
            color: #004085;
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
            flex: 1;
        }
        .os-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .os-count {
            font-size: 1.5em;
        }
        .os-percentage {
            color: #666;
            font-size: 0.8em;
            margin-top: 3px;
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
            margin-bottom: 15px;
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
        .filter-row {
            display: flex;
            gap: 15px;
            margin-top: 15px;
        }
        .search-container {
            flex: 2;
        }
        .filter-dropdown {
            flex: 1;
        }
        #instanceSearch {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        #osFilter {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
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
        .cost-disclaimer {
            font-size: 0.8em;
            font-style: italic;
            color: #666;
            margin-top: 5px;
        }
        .hidden {
            display: none !important;
        }
        .os-icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 6px;
            vertical-align: middle;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
        }

        .os-windows {
            color: #0078D7;
        }

        .os-redhat {
            color: #EE0000;
        }

        .os-amazon {
            color: #FF9900;
        }

        .os-ubuntu {
            color: #E95420;
        }

        .os-centos {
            color: #9CBE3B;
        }

        .os-debian {
            color: #A81D33;
        }

        .os-suse {
            color: #0C322C;
        }

        .os-linux {
            color: #333333;
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
        
        function filterInstances() {
            const searchText = document.getElementById('instanceSearch').value.toLowerCase();
            const osFilter = document.getElementById('osFilter').value;
            
            // First make all accounts visible
            document.querySelectorAll('.account-container').forEach(container => {
                container.style.display = 'block';
            });
            
            // For each row in all tables
            document.querySelectorAll('table tr').forEach(row => {
                if (row.parentElement.tagName === 'THEAD') return; // Skip header rows
                
                let showRow = true;
                
                // Apply text search if any
                if (searchText) {
                    const rowText = row.textContent.toLowerCase();
                    showRow = rowText.includes(searchText);
                }
                
                // Apply OS filter if not "all"
                if (showRow && osFilter !== 'all') {
                    const osCell = Array.from(row.cells).find((cell, index) => {
                        // Assuming OS is in the 5th column (index 4)
                        return index === 4;
                    });
                    
                    if (osCell && osCell.textContent.trim() !== osFilter) {
                        showRow = false;
                    }
                }
                
                // Show or hide the row
                row.classList.toggle('hidden', !showRow);
            });
            
            // Hide accounts with no visible rows
            document.querySelectorAll('.account-container').forEach(container => {
                const table = container.querySelector('table');
                if (table) {
                    const visibleRows = table.querySelectorAll('tbody tr:not(.hidden)');
                    container.style.display = visibleRows.length > 0 ? 'block' : 'none';
                }
            });
            
            // If we hide all accounts with resources, show a message
            const visibleAccounts = document.querySelectorAll('.account-container[style="display: block;"]');
            if (visibleAccounts.length === 0) {
                // Could add a "no results" message here
                console.log('No matching instances found');
            }
        }
        
        function filterByOS() {
            // This will trigger the same filtering logic
            filterInstances();
        }
            
        // Run this function when the page loads to show only accounts with resources by default
        document.addEventListener('DOMContentLoaded', function() {
            showAccountsWithResources();
        });
    </script>
</head>
<body>
    <h1>AWS EC2 Instances - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Generate EC2 instances table HTML
 */
function generateEC2Table(instances: EC2InstanceInfo[]): string {
  // Sort instances by state and name
  const sortedInstances = [...instances].sort((a, b) => {
    // First by state (running first)
    if (a.State === 'running' && b.State !== 'running') return -1
    if (a.State !== 'running' && b.State === 'running') return 1

    // Then by name
    return a.Name.localeCompare(b.Name)
  })

  // Check if pricing data is available for any instance
  const hasPricing = sortedInstances.some((instance) => 'HourlyPrice' in instance)

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Instance ID</th>
          <th>State</th>
          <th>Type</th>
          <th>Operating System</th>
          <th>Private IP</th>
          <th>Public IP</th>
          <th>Region</th>
          ${hasPricing ? '<th>Hourly Price</th>' : ''}
        </tr>
      </thead>
      <tbody>
  `

  sortedInstances.forEach((instance) => {
    // Determine state CSS class
    let stateClass = ''
    switch (instance.State.toLowerCase()) {
      case 'running':
        stateClass = 'resource-running'
        break
      case 'stopped':
        stateClass = 'resource-stopped'
        break
      case 'stopping':
      case 'shutting-down':
      case 'terminated':
        stateClass = 'resource-stopping'
        break
      case 'pending':
        stateClass = 'resource-pending'
        break
      default:
        stateClass = ''
    }

    // Add OS-specific styling
    let osClass = ''
    const os = instance.OS.toLowerCase()

    if (os.includes('windows')) {
      osClass = 'os-windows'
    } else if (os.includes('red hat') || os.includes('rhel')) {
      osClass = 'os-redhat'
    } else if (os.includes('amazon linux')) {
      osClass = 'os-amazon'
    } else if (os.includes('ubuntu')) {
      osClass = 'os-ubuntu'
    } else if (os.includes('centos')) {
      osClass = 'os-centos'
    } else if (os.includes('debian')) {
      osClass = 'os-debian'
    } else if (os.includes('suse')) {
      osClass = 'os-suse'
    } else if (os.includes('linux')) {
      osClass = 'os-linux'
    }

    // Format the price display if available
    let formattedPrice = instance.HourlyPrice || 'N/A'
    if (
      instance.HourlyPrice &&
      instance.HourlyPrice !== 'N/A' &&
      instance.HourlyPrice !== 'Price not available' &&
      instance.HourlyPrice !== 'Error retrieving price'
    ) {
      // Try to extract and reformat the numeric part
      const priceMatch = instance.HourlyPrice.match(/([0-9.]+)\s+([A-Z]{3})\/hr\s+\(([^)]+)\)/)
      if (priceMatch) {
        const [, price, currency, os] = priceMatch
        formattedPrice = `${parseFloat(price).toFixed(4)} ${currency}/hr (${os})`
      }
    }

    tableHtml += `
      <tr>
        <td>${instance.Name}</td>
        <td>${instance.InstanceId}</td>
        <td class="${stateClass}">${instance.State}</td>
        <td>${instance.Type}</td>
        <td class="${osClass}"><div class="os-icon ${osClass}"></div>${instance.OS}</td>
        <td>${instance.PrivateIp}</td>
        <td>${instance.PublicIp}</td>
        <td>${instance.Region}</td>
        ${hasPricing ? `<td>${formattedPrice}</td>` : ''}
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return tableHtml
}
