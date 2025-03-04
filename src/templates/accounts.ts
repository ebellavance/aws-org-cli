// File: src/templates/accounts-template.ts
// Accounts HTML report template

/**
 * Generate enhanced HTML output for AWS accounts
 * @param accounts The AWS accounts to display
 * @param title The title for the report
 */
export function generateAccountsHtml(accounts: Record<string, unknown>[], title: string): string {
  // Group accounts by status
  const accountsByStatus = new Map<string, Record<string, unknown>[]>()

  accounts.forEach((account) => {
    const status = String(account.Status || 'Unknown')
    if (!accountsByStatus.has(status)) {
      accountsByStatus.set(status, [])
    }
    const group = accountsByStatus.get(status)
    if (group) {
      group.push(account)
    }
  })

  // Calculate summary metrics
  const totalAccounts = accounts.length
  const activeAccounts = accounts.filter((a) => a.Status === 'ACTIVE').length
  const suspendedAccounts = accounts.filter((a) => a.Status === 'SUSPENDED').length
  const otherAccounts = totalAccounts - activeAccounts - suspendedAccounts

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
            <div class="summary-title">Active Accounts</div>
            <div class="summary-value">${activeAccounts}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Suspended Accounts</div>
            <div class="summary-value">${suspendedAccounts}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Other Status</div>
            <div class="summary-value">${otherAccounts}</div>
          </div>
        </div>
        
        <h3>Account Status Distribution</h3>
        <div class="status-summary">
          ${Array.from(accountsByStatus.entries())
            .map(
              ([status, accts]) => `
            <div class="status-card status-${status.toLowerCase()}">
              <div class="status-name">${status}</div>
              <div class="status-count">${accts.length}</div>
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
          <button class="filter-button" onclick="showActiveAccounts()">Show Active Accounts</button>
          <button class="filter-button" onclick="showSuspendedAccounts()">Show Suspended Accounts</button>
          <button class="filter-button" onclick="expandAllSections()">Expand All</button>
          <button class="filter-button" onclick="collapseAllSections()">Collapse All</button>
        </div>
      </div>
    `

  // Generate status sections
  let statusSectionsHtml = ''

  // Convert the Map to an array and sort by status (ACTIVE first)
  const sortedStatuses = Array.from(accountsByStatus.entries()).sort((a, b) => {
    if (a[0] === 'ACTIVE') return -1
    if (b[0] === 'ACTIVE') return 1
    return a[0].localeCompare(b[0])
  })

  sortedStatuses.forEach(([status, statusAccounts]) => {
    const statusClass = status.toLowerCase()
    const resourceClass = accountsByStatus.get(status)?.length ? 'has-resources' : 'empty-account'

    statusSectionsHtml += `
        <div class="account-container status-${statusClass} ${resourceClass}" data-status="${status.toLowerCase()}">
          <div class="account-header" onclick="toggleSection(this)">
            <h2>${status} Accounts 
              <span class="account-count">${statusAccounts.length} Account${statusAccounts.length !== 1 ? 's' : ''}</span>
            </h2>
            <span class="toggle-icon">▼</span>
          </div>
          <div class="account-content">
            <div class="resource-section">
              <h3>${status} Accounts (${statusAccounts.length})</h3>
              ${generateAccountsTable(statusAccounts)}
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
      <title>AWS Organizations - ${new Date().toISOString().split('T')[0]}</title>
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
            border-left: 3px solid #00cc66; /* Green left border */
        }
        .account-header {
            background-color: #e6f2ff; /* Light blue background to match EC2 */
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
        .account-count {
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
            font-weight: normal; /* Reset font weight to normal for all table cells */
            color: #333; /* Reset color to default for all table cells */
        }
        th {
            background-color: #0066cc;
            color: white;
            font-weight: bold;
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
        /* Only apply colored text to status values, not account names */
        .status-active {
            color: green;
            font-weight: bold;
        }
        .status-suspended {
            color: red; 
            font-weight: bold;
        }
        .status-pending {
            color: blue;
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
        .status-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        /* Status cards to match EC2 style */
        .status-card {
            padding: 10px;
            border-radius: 5px;
            min-width: 120px;
            text-align: center;
        }
        /* Status colors to match running/stopped in EC2 */
        .status-card.status-active {
            background-color: #d4edda; /* Light green for running */
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .status-card.status-suspended {
            background-color: #f8d7da; /* Light red for stopped */
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .status-card.status-pending {
            background-color: #cce5ff; /* Light blue for pending */
            border: 1px solid #b8daff;
            color: #004085;
        }
        .status-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .status-count {
            font-size: 1.5em;
        }
        .account-content {
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .account-content.collapsed {
            display: none;
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
        .empty-account-indicator {
            color: #999;
            font-size: 0.8em;
            background-color: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
        }
        .account-container.empty-account {
            border-left: 3px solid #ffcc00; /* Yellow left border for accounts without resources */
        }
        .timestamp {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-style: italic;
        }
      </style>
      <script>
          function toggleSection(header) {
              const container = header.parentElement;
              const content = container.querySelector('.account-content');
              content.classList.toggle('collapsed');
              
              // Toggle icon rotation
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
          
          function showActiveAccounts() {
              document.querySelectorAll('.account-container').forEach(container => {
                  container.style.display = container.dataset.status === 'active' ? 'block' : 'none';
              });
          }
          
          function showSuspendedAccounts() {
              document.querySelectorAll('.account-container').forEach(container => {
                  container.style.display = container.dataset.status === 'suspended' ? 'block' : 'none';
              });
          }
          
          function expandAllSections() {
              document.querySelectorAll('.account-content').forEach(content => {
                  content.classList.remove('collapsed');
                  
                  // Reset toggle icon
                  const header = content.parentElement.querySelector('.account-header');
                  const icon = header.querySelector('.toggle-icon');
                  icon.style.transform = 'rotate(0deg)';
              });
          }
          
          function collapseAllSections() {
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
      <h1>AWS Organization - ${title}</h1>
      ${summaryHtml}
      ${statusSectionsHtml}
      <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
  </body>
  </html>`
}

/**
 * Generate accounts table HTML
 */
function generateAccountsTable(accounts: Record<string, unknown>[]): string {
  // Sort accounts by name
  const sortedAccounts = [...accounts].sort((a, b) => {
    const nameA = String(a.Name || '').toLowerCase()
    const nameB = String(b.Name || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })

  let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Account Name</th>
            <th>Account ID</th>
            <th>Email</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
    `

  sortedAccounts.forEach((account) => {
    // Format the joined date if available
    let joinedDate = account.JoinedTimestamp || ''
    if (joinedDate && typeof joinedDate === 'string') {
      try {
        joinedDate = new Date(joinedDate).toLocaleDateString()
      } catch {
        // Keep original if parsing fails
      }
    }

    // Determine status class - only apply to the status cell
    let statusClass = ''
    const status = String(account.Status || '').toLowerCase()
    if (status === 'active') {
      statusClass = 'status-active'
    } else if (status === 'suspended') {
      statusClass = 'status-suspended'
    } else if (status === 'pending') {
      statusClass = 'status-pending'
    }

    tableHtml += `
        <tr>
          <td>${account.Name || ''}</td>
          <td>${account.Id || ''}</td>
          <td>${account.Email || ''}</td>
          <td class="${statusClass}">${account.Status || ''}</td>
          <td>${joinedDate}</td>
        </tr>
      `
  })

  tableHtml += `
        </tbody>
      </table>
    `

  return tableHtml
}
