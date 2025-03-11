// File: src/templates/ebs.ts
// EBS HTML report template

import { EBSVolumeInfo } from '../types'

/**
 * Generate enhanced HTML output for EBS volumes
 * @param volumes The EBS volumes to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateEBSHtml(
  volumes: EBSVolumeInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group volumes by account for visualization
  const accountGroups = new Map<string, EBSVolumeInfo[]>()

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')

        // Initialize empty array for accounts without volumes
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all volumes
  volumes.forEach((volume) => {
    const accountId = volume.AccountId
    const accountName = volume.AccountName

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    const group = accountGroups.get(key)
    if (group) {
      group.push(volume)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithEBS = Array.from(accountGroups.entries()).filter(([, volumes]) => volumes.length > 0).length
  const accountsWithoutEBS = totalAccounts - accountsWithEBS
  const totalEBSVolumes = volumes.length

  // Calculate total storage size
  const totalStorageGB = volumes.reduce((sum, volume) => sum + (volume.Size || 0), 0)

  // Group volumes by state
  const volumesByState = new Map<string, number>()
  volumes.forEach((volume) => {
    const state = volume.State || 'Unknown'
    volumesByState.set(state, (volumesByState.get(state) || 0) + 1)
  })

  // Group volumes by type
  const volumesByType = new Map<string, number>()
  volumes.forEach((volume) => {
    const type = volume.Type || 'Unknown'
    volumesByType.set(type, (volumesByType.get(type) || 0) + 1)
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
          <div class="summary-title">Accounts With EBS</div>
          <div class="summary-value">${accountsWithEBS}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Accounts Without EBS</div>
          <div class="summary-value">${accountsWithoutEBS}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total EBS Volumes</div>
          <div class="summary-value">${totalEBSVolumes}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Total Storage (GB)</div>
          <div class="summary-value">${totalStorageGB.toLocaleString()}</div>
        </div>
      </div>
      
      <h3>Volume States</h3>
      <div class="state-summary">
        ${Array.from(volumesByState.entries())
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

      <h3>Volume Types</h3>
      <div class="type-summary">
        ${Array.from(volumesByType.entries())
          .map(
            ([type, count]) => `
          <div class="type-card type-${type.toLowerCase()}">
            <div class="type-name">${type}</div>
            <div class="type-count">${count}</div>
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
        <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With EBS</button>
        <button class="filter-button" onclick="showEmptyAccounts()">Show Accounts Without EBS</button>
        <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
        <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
      </div>
      <div class="filter-row">
        <div class="search-container">
          <input type="text" id="volumeSearch" placeholder="Search volumes..." onkeyup="filterVolumes()">
        </div>
        <div class="filter-dropdown">
          <select id="typeFilter" onchange="filterByType()">
            <option value="all">All Volume Types</option>
            ${Array.from(volumesByType.keys())
              .sort()
              .map((type) => `<option value="${type}">${type}</option>`)
              .join('')}
          </select>
        </div>
        <div class="filter-dropdown">
          <select id="stateFilter" onchange="filterByState()">
            <option value="all">All States</option>
            ${Array.from(volumesByState.keys())
              .sort()
              .map((state) => `<option value="${state}">${state}</option>`)
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

  sortedAccounts.forEach(([accountKey, accountVolumes]) => {
    const isEmpty = accountVolumes.length === 0
    const accountClass = isEmpty ? 'empty-account' : 'has-resources'

    accountsHtml += `
      <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
        <div class="account-header" onclick="toggleAccount(this)">
          <h2>${accountKey} 
            <span class="volume-count">${accountVolumes.length} EBS Volume${accountVolumes.length !== 1 ? 's' : ''}</span>
            ${isEmpty ? '<span class="empty-account-indicator">No EBS Volumes</span>' : ''}
          </h2>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="account-content ${isEmpty ? 'collapsed' : ''}">
          <div class="resource-section">
            <h3>EBS Volumes (${accountVolumes.length})</h3>
            ${
              accountVolumes.length === 0
                ? '<p class="no-resources">No EBS volumes found in this account.</p>'
                : generateEBSTable(accountVolumes)
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
    <title>AWS EBS Volumes - ${title}</title>
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
        .volume-count {
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
            color: #0066cc;
            font-weight: bold;
        }
        .resource-in-use {
            color: green;
            font-weight: bold;
        }
        .resource-creating {
            color: blue;
            font-weight: bold;
        }
        .resource-deleting, .resource-error {
            color: red;
            font-weight: bold;
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
        .state-summary, .type-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
            margin-bottom: 20px;
        }
        .state-card, .type-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        .state-available {
            background-color: #cce5ff; /* Light blue background */
            border: 1px solid #b8daff;
            color: #004085; /* Dark blue text */
        }
        .state-in-use {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .state-creating {
            background-color: #cce5ff;
            border: 1px solid #b8daff;
            color: #004085;
        }
        .state-deleting, .state-error {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .type-gp2, .type-gp3 {
            background-color: #d1e7dd;
            border: 1px solid #badbcc;
            color: #0f5132;
        }
        .type-io1, .type-io2 {
            background-color: #cfe2ff;
            border: 1px solid #b6d4fe;
            color: #084298;
        }
        .type-st1, .type-sc1 {
            background-color: #fff3cd;
            border: 1px solid #ffe69c;
            color: #664d03;
        }
        .type-standard {
            background-color: #f8d7da;
            border: 1px solid #f5c2c7;
            color: #842029;
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
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 15px;
        }
        .search-container {
            flex: 2;
        }
        .filter-dropdown {
            flex: 1;
        }
        #volumeSearch, #typeFilter, #stateFilter {
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
        .hidden {
            display: none !important;
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
        
        function filterVolumes() {
            const searchText = document.getElementById('volumeSearch').value.toLowerCase();
            const typeFilter = document.getElementById('typeFilter').value;
            const stateFilter = document.getElementById('stateFilter').value;
            
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
                
                // Apply type filter if not "all"
                if (showRow && typeFilter !== 'all') {
                    const typeCell = Array.from(row.cells).find((cell, index) => {
                        // Assuming Type is in the 3rd column (index 2)
                        return index === 2;
                    });
                    
                    if (typeCell && typeCell.textContent.trim() !== typeFilter) {
                        showRow = false;
                    }
                }
                
                // Apply state filter if not "all"
                if (showRow && stateFilter !== 'all') {
                    const stateCell = Array.from(row.cells).find((cell, index) => {
                        // Assuming State is in the 7th column (index 6)
                        return index === 6;
                    });
                    
                    if (stateCell && stateCell.textContent.trim() !== stateFilter) {
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
        }
        
        function filterByType() {
            // This will trigger the same filtering logic
            filterVolumes();
        }
        
        function filterByState() {
            // This will trigger the same filtering logic
            filterVolumes();
        }
            
        // Run this function when the page loads to show only accounts with resources by default
        document.addEventListener('DOMContentLoaded', function() {
            showAccountsWithResources();
        });
    </script>
</head>
<body>
    <h1>AWS EBS Volumes - ${title}</h1>
    ${summaryHtml}
    ${accountsHtml}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/**
 * Generate EBS volumes table HTML
 */
function generateEBSTable(volumes: EBSVolumeInfo[]): string {
  // Sort volumes by state and name
  const sortedVolumes = [...volumes].sort((a, b) => {
    // First by state (in-use first)
    if (a.State === 'in-use' && b.State !== 'in-use') return -1
    if (a.State !== 'in-use' && b.State === 'in-use') return 1

    // Then by name
    return a.Name.localeCompare(b.Name)
  })

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Volume ID</th>
          <th>Type</th>
          <th>Size (GB)</th>
          <th>IOPS</th>
          <th>Throughput</th>
          <th>State</th>
          <th>Availability Zone</th>
          <th>Attached Resources</th>
          <th>Encrypted</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedVolumes.forEach((volume) => {
    // Determine state CSS class
    let stateClass = ''
    switch (volume.State.toLowerCase()) {
      case 'in-use':
        stateClass = 'resource-in-use'
        break
      case 'available':
        stateClass = 'resource-available'
        break
      case 'creating':
        stateClass = 'resource-creating'
        break
      case 'deleting':
        stateClass = 'resource-deleting'
        break
      case 'error':
        stateClass = 'resource-error'
        break
      default:
        stateClass = ''
    }

    // Format creation date
    let createdDate = volume.CreateTime
    if (createdDate !== 'Unknown') {
      try {
        createdDate = new Date(createdDate).toLocaleDateString()
      } catch {
        // Keep original if parsing fails
      }
    }

    // Format throughput
    const throughput = volume.Throughput > 0 ? `${volume.Throughput} MiB/s` : 'N/A'

    tableHtml += `
      <tr>
        <td>${volume.Name}</td>
        <td>${volume.VolumeId}</td>
        <td>${volume.Type}</td>
        <td>${volume.Size}</td>
        <td>${volume.IOPS > 0 ? volume.IOPS : 'N/A'}</td>
        <td>${throughput}</td>
        <td class="${stateClass}">${volume.State}</td>
        <td>${volume.AvailabilityZone}</td>
        <td>${volume.AttachedResources}</td>
        <td>${volume.Encrypted ? 'Yes' : 'No'}</td>
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
