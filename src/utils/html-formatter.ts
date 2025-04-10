// File: src/utils/html-formatter.ts
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawn } from 'child_process'
import {
  generateEC2Html as generateEC2Template,
  generateRDSHtml as generateRDSTemplate,
  generateOpenSearchHtml as generateOpenSearchTemplate,
  generateAccountsHtml as generateAccountsTemplate,
  generateELBHtml as generateELBTemplate,
  generatePolicyVerificationHtml as generatePolicyVerificationTemplate,
  generateEBSHtml as generateEBSTemplate,
  generateHENIHtml as generateHENITemplate,
} from '../templates'
import {
  EC2InstanceInfo,
  RDSInstanceInfo,
  OpenSearchDomainInfo,
  ELBInfo,
  PolicyDocument,
  PolicyVerificationResult,
  EBSVolumeInfo,
  HENIInfo,
} from '../types'

export function generateEC2Html(
  instances: EC2InstanceInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateEC2Template(instances, title, totalAccounts, allAccounts)
}

export function generateRDSHtml(
  instances: RDSInstanceInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateRDSTemplate(instances, title, totalAccounts, allAccounts)
}

export function generateOpenSearchHtml(
  domains: OpenSearchDomainInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateOpenSearchTemplate(domains, title, totalAccounts, allAccounts)
}

export function generateAccountsHtml(accounts: Record<string, unknown>[], title: string): string {
  return generateAccountsTemplate(accounts, title)
}

export function generateELBHtml(
  elbs: ELBInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateELBTemplate(elbs, title, totalAccounts, allAccounts)
}

// Update the function signature to accept PolicyDocument
export function generatePolicyVerificationHtml(
  results: PolicyVerificationResult[],
  policy: PolicyDocument | Record<string, unknown>,
  title: string,
): string {
  return generatePolicyVerificationTemplate(results, policy, title)
}

export function generateEBSHtml(
  volumes: EBSVolumeInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateEBSTemplate(volumes, title, totalAccounts, allAccounts)
}

export function generateHENIHtml(
  heniInfos: HENIInfo[],
  title: string,
  totalAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  return generateHENITemplate(heniInfos, title, totalAccounts, allAccounts)
}

/**
 * Generate HTML representation of data
 */
export function generateHtml(
  data: Record<string, unknown> | Array<Record<string, unknown>> | undefined,
  title: string,
): string {
  if (!data) {
    return generateErrorHtml('No data returned')
  }

  // Determine if we're working with an array or a single object
  const isArray = Array.isArray(data)
  const htmlContent = isArray
    ? generateTableHtml(data as Record<string, unknown>[], title)
    : generateObjectHtml(data as Record<string, unknown>, title)

  return htmlContent
}

/**
 * Generate HTML for a table of objects
 */
function generateTableHtml(data: Record<string, unknown>[], title: string): string {
  if (data.length === 0) {
    return generateErrorHtml('No data items returned')
  }

  let summarySection = ''

  // Determine the type of data
  const dataType = detectDataType(data)

  // Process the data (sorting, column ordering)
  const { processedData, orderedColumns } = processTableData(data)

  // Create summary section based on data type
  if (dataType === 'accounts') {
    summarySection = `
      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-title">Total Accounts</div>
          <div class="summary-value">${data.length}</div>
        </div>
      </div>
    `
  } else if (dataType === 'ous') {
    summarySection = `
      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-title">Total OUs</div>
          <div class="summary-value">${data.length}</div>
        </div>
      </div>
    `

    // Add tree visualization for OUs
    const treeVisualization = generateOUTreeVisualization(data)
    summarySection = treeVisualization + summarySection
  }

  // Generate table header
  let tableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          ${orderedColumns.map((key) => `<th>${key}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `

  // Generate table rows
  processedData.forEach((item) => {
    tableHtml += '<tr>'
    orderedColumns.forEach((key) => {
      const value = item[key]
      tableHtml += `<td>${formatValue(value)}</td>`
    })
    tableHtml += '</tr>'
  })

  tableHtml += `
      </tbody>
    </table>
  `

  // Combine the content and wrap in HTML template
  const fullContent = summarySection + tableHtml
  return wrapInHtmlTemplate(fullContent, title)
}

/**
 * Detect the type of data we're working with
 */
function detectDataType(data: Record<string, unknown>[]): string {
  if (data.length === 0) return 'unknown'

  const firstItem = data[0]

  // Check for account fields
  const hasAccountFields =
    'Id' in firstItem &&
    ('Name' in firstItem || 'AccountName' in firstItem) &&
    ('Email' in firstItem || 'AccountEmail' in firstItem)

  if (hasAccountFields) return 'accounts'

  // Check for OU fields
  const hasOUFields =
    'Id' in firstItem &&
    'Name' in firstItem &&
    !('Email' in firstItem) &&
    ('ParentId' in firstItem || ('Arn' in firstItem && String(firstItem.Arn).includes('organizations')))

  if (hasOUFields) return 'ous'

  return 'unknown'
}

/**
 * Process organizational units data for better display
 */
function processOUData(data: Record<string, unknown>[]): {
  processedData: Record<string, unknown>[]
  orderedColumns: string[]
} {
  // Clone data to avoid modifying the original
  const processedData = [...data]

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key))
  })

  // Define preferred column order for OUs
  const ouPreferredOrder = ['Name', 'Id', 'ParentId', 'Arn']

  // Build a map of OU IDs to their names for easy reference
  const ouMap = new Map<string, string>()
  data.forEach((ou) => {
    if (ou.Id && ou.Name) {
      ouMap.set(String(ou.Id), String(ou.Name))
    }
  })

  // Add depth and full path information to each OU
  const enhancedOUs = processedData.map((ou) => {
    const enhancedOU = { ...ou }

    // Add OU Path if ParentId exists
    if (ou.ParentId && typeof ou.ParentId === 'string') {
      enhancedOU['ParentName'] = ouMap.get(ou.ParentId) || 'Unknown'
    }

    return enhancedOU
  })

  // Sort OUs by Name
  enhancedOUs.sort((a, b) => {
    const nameA = String(a['Name'] || '').toLowerCase()
    const nameB = String(b['Name'] || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })

  // Order columns appropriately
  const orderedColumns = [
    ...ouPreferredOrder.filter((key) => allKeys.has(key)),
    'ParentName',
    ...Array.from(allKeys).filter((key) => !ouPreferredOrder.includes(key) && key !== 'ParentName'),
  ]

  return { processedData: enhancedOUs, orderedColumns }
}

/**
 * Process table data - sort and order columns
 */
function processTableData(data: Record<string, unknown>[]): {
  processedData: Record<string, unknown>[]
  orderedColumns: string[]
} {
  const dataType = detectDataType(data)

  if (dataType === 'ous') {
    return processOUData(data)
  }

  // Clone data to avoid modifying the original
  const processedData = [...data]

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key))
  })

  // Define column ordering for accounts
  const accountPreferredOrder = ['Name', 'Id', 'Email', 'JoinedTimestamp', 'Status']

  // Sort accounts by name if applicable
  if (dataType === 'accounts') {
    processedData.sort((a, b) => {
      // Use Name if available, otherwise fall back
      const nameA = String(a['Name'] || a['AccountName'] || '').toLowerCase()
      const nameB = String(b['Name'] || b['AccountName'] || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  // Order columns appropriately
  let orderedColumns: string[]
  if (dataType === 'accounts') {
    // For accounts, use preferred order and exclude ARN
    orderedColumns = [
      ...accountPreferredOrder.filter((key) => allKeys.has(key)),
      ...Array.from(allKeys).filter((key) => !accountPreferredOrder.includes(key) && key !== 'Arn' && key !== 'ARN'),
    ]
  } else {
    // For other data, use default ordering
    orderedColumns = Array.from(allKeys)
  }

  return { processedData, orderedColumns }
}

/**
 * Generate a tree visualization for organizational units
 */
function generateOUTreeVisualization(data: Record<string, unknown>[]): string {
  if (data.length === 0) {
    return ''
  }

  // Build a map of parent IDs to their children
  const parentChildMap = new Map<string, Array<Record<string, unknown>>>()

  // Find all unique parent IDs
  const allParentIds = new Set<string>()
  data.forEach((ou) => {
    if (ou.ParentId) {
      allParentIds.add(String(ou.ParentId))

      // Initialize parent's children array if it doesn't exist
      if (!parentChildMap.has(String(ou.ParentId))) {
        parentChildMap.set(String(ou.ParentId), [])
      }

      // Add this OU to its parent's children
      const children = parentChildMap.get(String(ou.ParentId))
      if (children) {
        children.push(ou)
      }
    }
  })

  // Find the root(s) - parent IDs that are not also OU IDs
  let rootParentIds = Array.from(allParentIds).filter((parentId) => {
    return !data.some((ou) => ou.Id === parentId)
  })

  // If no roots found, just use the first parent ID
  if (rootParentIds.length === 0 && allParentIds.size > 0) {
    rootParentIds = [Array.from(allParentIds)[0]]
  }

  // Generate the tree HTML
  let treeHtml = `
    <div class="ou-visualization">
      <h2>Organization Structure</h2>
      <div class="tree-container">
  `

  // Generate tree for each root
  rootParentIds.forEach((rootId) => {
    treeHtml += `
      <ul class="tree">
        <li>
          <span class="root-node">${rootId} (Organization Root)</span>
          ${generateTreeNodeHtml(rootId, parentChildMap, 1)}
        </li>
      </ul>
    `
  })

  treeHtml += `
      </div>
    </div>
  `

  return treeHtml
}

/**
 * Recursively generate HTML for a tree node and its children
 */
function generateTreeNodeHtml(
  parentId: string,
  parentChildMap: Map<string, Array<Record<string, unknown>>>,
  depth: number,
): string {
  const children = parentChildMap.get(parentId)

  if (!children || children.length === 0) {
    return ''
  }

  let html = '<ul>'

  children.forEach((ou) => {
    const ouId = String(ou.Id || '')
    const ouName = String(ou.Name || '')

    html += `
      <li>
        <span class="tree-node depth-${depth}">${ouName} (${ouId})</span>
        ${generateTreeNodeHtml(ouId, parentChildMap, depth + 1)}
      </li>
    `
  })

  html += '</ul>'
  return html
}

/**
 * Generate HTML for a single object
 */
function generateObjectHtml(data: Record<string, unknown>, title: string): string {
  const keys = Object.keys(data)

  // Generate a key-value table
  let tableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
  `

  keys.forEach((key) => {
    const value = data[key]
    tableHtml += `
      <tr>
        <td class="key-column">${key}</td>
        <td>${formatValue(value)}</td>
      </tr>
    `
  })

  tableHtml += `
      </tbody>
    </table>
  `

  return wrapInHtmlTemplate(tableHtml, title)
}

/**
 * Generate HTML for error message
 */
function generateErrorHtml(message: string): string {
  const html = `
    <div class="error-message">
      <h2>Error</h2>
      <p>${message}</p>
    </div>
  `

  return wrapInHtmlTemplate(html, 'Error')
}

/**
 * Format a value for HTML display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '<em>null</em>'
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleString() + ' (' + value.toISOString() + ')'
    }
    return `<pre>${JSON.stringify(value, null, 2)}</pre>`
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

/**
 * Wrap content in complete HTML document
 */
function wrapInHtmlTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AWS Organizations - ${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      background-color: #f5f5f5;
    }
    
    h1 {
      color: #232f3e;
      border-bottom: 2px solid #ff9900;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .data-table th {
      background-color: #232f3e;
      color: white;
      padding: 10px;
      text-align: left;
    }
    
    .data-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .data-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .data-table tr:hover {
      background-color: #f0f7ff;
    }
    
    .key-column {
      font-weight: bold;
      width: 200px;
    }
    
    .error-message {
      color: #d13212;
      background-color: #fdf3f1;
      padding: 15px;
      border-radius: 5px;
      border-left: 5px solid #d13212;
      margin-bottom: 20px;
    }
    
    .summary-section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .summary-card {
      background-color: #232f3e;
      color: white;
      border-radius: 5px;
      padding: 15px 25px;
      min-width: 150px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .summary-title {
      font-size: 0.9em;
      margin-bottom: 5px;
    }
    
    .summary-value {
      font-size: 2em;
      font-weight: bold;
      color: #ff9900;
    }
    
    .timestamp {
      color: #666;
      font-size: 0.9em;
      margin-top: 20px;
      text-align: right;
    }

    .ou-visualization {
      margin-top: 30px;
      margin-bottom: 30px;
    }
    
    .tree-container {
      overflow-x: auto;
    }
    
    .tree {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    
    .tree ul {
      margin-left: 20px;
      padding-left: 0;
      list-style-type: none;
    }
    
    .tree li {
      margin: 10px 0;
      position: relative;
    }
    
    .tree li::before {
      content: "";
      position: absolute;
      top: -10px;
      left: -20px;
      border-left: 1px solid #ccc;
      border-bottom: 1px solid #ccc;
      width: 20px;
      height: 20px;
    }
    
    .tree li:last-child::before {
      border-left: none;
    }
    
    .tree-node, .root-node {
      display: inline-block;
      padding: 5px 10px;
      border: 1px solid #ddd;
      border-radius: 3px;
    }
    
    .root-node {
      background-color: #232f3e;
      color: white;
    }
    
    .tree-node {
      background-color: #f0f7ff;
    }
    
    .depth-1 {
      background-color: #e3f2fd;
    }
    
    .depth-2 {
      background-color: #bbdefb;
    }
    
    .depth-3 {
      background-color: #90caf9;
    }
    
    .depth-4 {
      background-color: #64b5f6;
    }
    
    .depth-5 {
      background-color: #42a5f5;
      color: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AWS Organizations - ${title}</h1>
    ${content}
    <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`
}

/**
 * Save HTML content to a temporary file and open in default browser
 */
export function openInBrowser(htmlContent: string, commandName: string): void {
  // Create a temporary file
  const tempDir = path.join(os.tmpdir(), 'aws-org')
  fs.mkdirSync(tempDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `aws-org-${commandName}-${timestamp}.html`
  const filePath = path.join(tempDir, fileName)

  // Write the HTML content to the file
  fs.writeFileSync(filePath, htmlContent)

  console.log(`Opening HTML report in browser: ${filePath}`)

  // Detect platform and open the browser
  const platform = process.platform
  let command: string
  let args: string[]

  switch (platform) {
    case 'darwin': // macOS
      command = 'open'
      args = [filePath]
      break
    case 'win32': // Windows
      command = 'cmd'
      args = ['/c', 'start', '', filePath]
      break
    default: // Linux and others
      command = 'xdg-open'
      args = [filePath]
      break
  }

  // Open the file in the default browser
  spawn(command, args, { detached: true }).unref()
}

/**
 * Generate HTML for the organization tree
 * Function signature exported for use in index.ts
 */
export function generateOrganizationTreeHtml(
  _treeData: {
    rootId: string
    ous: Record<string, unknown>[]
    accounts: Record<string, unknown>[]
  },
  title: string,
): string {
  // This is just a stub to export the function
  // The actual implementation is in index.ts
  return wrapInHtmlTemplate(`<div>See implementation in index.ts</div>`, title)
}

/**
 * Generate enhanced HTML output for EC2 instances
 */
// function generateEC2Html(instances: EC2InstanceInfo[], title: string): string {
//   // Group instances by account for better visualization
//   const accountGroups = new Map<string, EC2InstanceInfo[]>()

//   instances.forEach((instance) => {
//     const key = `${instance.AccountId} (${instance.AccountName})`
//     if (!accountGroups.has(key)) {
//       accountGroups.set(key, [])
//     }
//     const group = accountGroups.get(key)
//     if (group) {
//       group.push(instance)
//     }
//   })

//   // Create summary section
//   const summaryHtml = `
//     <div class="summary">
//       <h2>Summary</h2>
//       <p>Total Accounts: <strong>${accountGroups.size}</strong></p>
//       <p>Total EC2 Instances: <strong>${instances.length}</strong></p>
//     </div>

//     <div class="filter-controls">
//       <h3>Filters</h3>
//       <div class="filter-buttons">
//         <button class="filter-button" onclick="showAllAccounts()">Show All Accounts</button>
//         <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With Resources</button>
//         <button class="filter-button" onclick="showEmptyAccounts()">Show Empty Accounts</button>
//         <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
//         <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
//       </div>
//     </div>
//   `

//   // Generate account sections
//   let accountsHtml = ''

//   // Convert the Map to an array and sort by account name
//   const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

//   sortedAccounts.forEach(([accountKey, accountInstances]) => {
//     const isEmpty = accountInstances.length === 0
//     const accountClass = isEmpty ? 'empty-account' : 'has-resources'

//     accountsHtml += `
//       <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
//         <div class="account-header" onclick="toggleAccount(this)">
//           <h2>${accountKey}
//             ${isEmpty ? '<span class="empty-account-indicator">No Resources</span>' : ''}
//           </h2>
//           <span class="toggle-icon">▼</span>
//         </div>
//         <div class="account-content">
//           <div class="resource-section">
//             <h3>EC2 Instances (${accountInstances.length})</h3>
//             ${
//               accountInstances.length === 0
//                 ? '<p class="no-resources">No EC2 instances found in this account.</p>'
//                 : generateEC2Table(accountInstances)
//             }
//           </div>
//         </div>
//       </div>
//     `
//   })

//   // Create complete HTML with header, summary, and accounts
//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>AWS Resources Report - ${new Date().toISOString().split('T')[0]}</title>
//     <style>
//         body {
//             font-family: Arial, sans-serif;
//             margin: 20px;
//             background-color: #f5f5f5;
//         }
//         h1, h2, h3 {
//             color: #0066cc;
//         }
//         h1 {
//             text-align: center;
//         }
//         .account-container {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .account-header {
//             background-color: #e6f2ff;
//             padding: 10px;
//             border-radius: 5px;
//             margin-bottom: 10px;
//             cursor: pointer;
//             display: flex;
//             justify-content: space-between;
//             align-items: center;
//         }
//         .account-header h2 {
//             margin: 0;
//             color: #003366;
//         }
//         .resource-section {
//             margin-top: 15px;
//             margin-bottom: 25px;
//         }
//         table {
//             border-collapse: collapse;
//             width: 100%;
//             margin-top: 10px;
//             margin-bottom: 20px;
//         }
//         th, td {
//             border: 1px solid #ddd;
//             padding: 12px 8px;
//             text-align: left;
//         }
//         th {
//             background-color: #0066cc;
//             color: white;
//         }
//         tr:nth-child(even) {
//             background-color: #f2f2f2;
//         }
//         tr:hover {
//             background-color: #e6f2ff;
//         }
//         .no-resources {
//             color: #666;
//             font-style: italic;
//             padding: 10px;
//         }
//         .resource-running, .resource-available {
//             color: green;
//             font-weight: bold;
//         }
//         .resource-stopped {
//             color: red;
//         }
//         .resource-backing-up, .resource-maintenance, .resource-modifying {
//             color: orange;
//         }
//         .resource-creating, .resource-starting {
//             color: blue;
//         }
//         .resource-deleting, .resource-stopping, .resource-failed {
//             color: darkred;
//         }
//         .summary {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .account-content {
//             overflow: hidden;
//         }
//         .account-content.collapsed {
//             display: none;
//         }
//         .empty-account-indicator {
//             color: #999;
//             font-size: 0.8em;
//             background-color: #f0f0f0;
//             padding: 2px 8px;
//             border-radius: 10px;
//             margin-left: 10px;
//         }
//         .toggle-icon {
//             margin-left: 10px;
//             font-weight: bold;
//             transition: transform 0.3s;
//         }
//         .collapsed .toggle-icon {
//             transform: rotate(-90deg);
//         }
//         .filter-controls {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .filter-buttons {
//             display: flex;
//             gap: 10px;
//             margin-top: 10px;
//         }
//         .filter-button {
//             background-color: #0066cc;
//             color: white;
//             border: none;
//             padding: 8px 15px;
//             border-radius: 4px;
//             cursor: pointer;
//         }
//         .filter-button:hover {
//             background-color: #004c99;
//         }
//         .account-container.empty-account {
//             border-left: 3px solid #ffcc00;
//         }
//         .account-container.has-resources {
//             border-left: 3px solid #00cc66;
//         }
//     </style>
//     <script>
//         function toggleAccount(header) {
//             const container = header.parentElement;
//             const content = container.querySelector('.account-content');
//             content.classList.toggle('collapsed');
//         }

//         function showAllAccounts() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = 'block';
//             });
//         }

//         function showAccountsWithResources() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = container.dataset.hasResources === 'true' ? 'block' : 'none';
//             });
//         }

//         function showEmptyAccounts() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = container.dataset.hasResources === 'false' ? 'block' : 'none';
//             });
//         }

//         function expandAllAccounts() {
//             document.querySelectorAll('.account-content').forEach(content => {
//                 content.classList.remove('collapsed');
//             });
//         }

//         function collapseAllAccounts() {
//             document.querySelectorAll('.account-content').forEach(content => {
//                 content.classList.add('collapsed');
//             });
//         }
//     </script>
// </head>
// <body>
//     <h1>AWS EC2 Instances - ${title}</h1>
//     ${summaryHtml}
//     ${accountsHtml}
//     <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
// </body>
// </html>`
// }

/**
 * Generate EC2 instances table HTML
 */
// function generateEC2Table(instances: EC2InstanceInfo[]): string {
//   // Sort instances by state and name
//   const sortedInstances = [...instances].sort((a, b) => {
//     // First by state (running first)
//     if (a.State === 'running' && b.State !== 'running') return -1
//     if (a.State !== 'running' && b.State === 'running') return 1

//     // Then by name
//     return a.Name.localeCompare(b.Name)
//   })

//   let tableHtml = `
//     <table>
//       <thead>
//         <tr>
//           <th>Name</th>
//           <th>Instance ID</th>
//           <th>State</th>
//           <th>Type</th>
//           <th>Private IP</th>
//           <th>Public IP</th>
//           <th>Region</th>
//         </tr>
//       </thead>
//       <tbody>
//   `

//   sortedInstances.forEach((instance) => {
//     // Determine state CSS class
//     let stateClass = ''
//     switch (instance.State.toLowerCase()) {
//       case 'running':
//         stateClass = 'resource-running'
//         break
//       case 'stopped':
//         stateClass = 'resource-stopped'
//         break
//       case 'stopping':
//       case 'shutting-down':
//       case 'terminated':
//         stateClass = 'resource-stopping'
//         break
//       case 'pending':
//         stateClass = 'resource-creating'
//         break
//       default:
//         stateClass = ''
//     }

//     tableHtml += `
//       <tr>
//         <td>${instance.Name}</td>
//         <td>${instance.InstanceId}</td>
//         <td class="${stateClass}">${instance.State}</td>
//         <td>${instance.Type}</td>
//         <td>${instance.PrivateIp}</td>
//         <td>${instance.PublicIp}</td>
//         <td>${instance.Region}</td>
//       </tr>
//     `
//   })

//   tableHtml += `
//       </tbody>
//     </table>
//   `

//   return tableHtml
// }

/**
 * Generate enhanced HTML output for RDS instances
 */
// function generateRDSHtml(instances: RDSInstanceInfo[], title: string): string {
//   // Group instances by account for better visualization
//   const accountGroups = new Map<string, RDSInstanceInfo[]>()

//   instances.forEach((instance) => {
//     const key = `${instance.AccountId} (${instance.AccountName})`
//     if (!accountGroups.has(key)) {
//       accountGroups.set(key, [])
//     }
//     const group = accountGroups.get(key)
//     if (group) {
//       group.push(instance)
//     }
//   })

//   // Create summary section
//   const summaryHtml = `
//     <div class="summary">
//       <h2>Summary</h2>
//       <p>Total Accounts: <strong>${accountGroups.size}</strong></p>
//       <p>Total RDS Instances: <strong>${instances.length}</strong></p>
//     </div>

//     <div class="filter-controls">
//       <h3>Filters</h3>
//       <div class="filter-buttons">
//         <button class="filter-button" onclick="showAllAccounts()">Show All Accounts</button>
//         <button class="filter-button" onclick="showAccountsWithResources()">Show Accounts With Resources</button>
//         <button class="filter-button" onclick="showEmptyAccounts()">Show Empty Accounts</button>
//         <button class="filter-button" onclick="expandAllAccounts()">Expand All</button>
//         <button class="filter-button" onclick="collapseAllAccounts()">Collapse All</button>
//       </div>
//     </div>
//   `

//   // Generate account sections
//   let accountsHtml = ''

//   // Convert the Map to an array and sort by account name
//   const sortedAccounts = Array.from(accountGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

//   sortedAccounts.forEach(([accountKey, accountInstances]) => {
//     const isEmpty = accountInstances.length === 0
//     const accountClass = isEmpty ? 'empty-account' : 'has-resources'

//     accountsHtml += `
//       <div class="account-container ${accountClass}" data-has-resources="${!isEmpty}">
//         <div class="account-header" onclick="toggleAccount(this)">
//           <h2>${accountKey}
//             ${isEmpty ? '<span class="empty-account-indicator">No Resources</span>' : ''}
//           </h2>
//           <span class="toggle-icon">▼</span>
//         </div>
//         <div class="account-content">
//           <div class="resource-section">
//             <h3>RDS Instances (${accountInstances.length})</h3>
//             ${
//               accountInstances.length === 0
//                 ? '<p class="no-resources">No RDS instances found in this account.</p>'
//                 : generateRDSTable(accountInstances)
//             }
//           </div>
//         </div>
//       </div>
//     `
//   })

//   // Create complete HTML with header, summary, and accounts
//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>AWS Resources Report - ${new Date().toISOString().split('T')[0]}</title>
//     <style>
//         body {
//             font-family: Arial, sans-serif;
//             margin: 20px;
//             background-color: #f5f5f5;
//         }
//         h1, h2, h3 {
//             color: #0066cc;
//         }
//         h1 {
//             text-align: center;
//         }
//         .account-container {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .account-header {
//             background-color: #e6f2ff;
//             padding: 10px;
//             border-radius: 5px;
//             margin-bottom: 10px;
//             cursor: pointer;
//             display: flex;
//             justify-content: space-between;
//             align-items: center;
//         }
//         .account-header h2 {
//             margin: 0;
//             color: #003366;
//         }
//         .resource-section {
//             margin-top: 15px;
//             margin-bottom: 25px;
//         }
//         table {
//             border-collapse: collapse;
//             width: 100%;
//             margin-top: 10px;
//             margin-bottom: 20px;
//         }
//         th, td {
//             border: 1px solid #ddd;
//             padding: 12px 8px;
//             text-align: left;
//         }
//         th {
//             background-color: #0066cc;
//             color: white;
//         }
//         tr:nth-child(even) {
//             background-color: #f2f2f2;
//         }
//         tr:hover {
//             background-color: #e6f2ff;
//         }
//         .no-resources {
//             color: #666;
//             font-style: italic;
//             padding: 10px;
//         }
//         .resource-running, .resource-available {
//             color: green;
//             font-weight: bold;
//         }
//         .resource-stopped {
//             color: red;
//         }
//         .resource-backing-up, .resource-maintenance, .resource-modifying {
//             color: orange;
//         }
//         .resource-creating, .resource-starting {
//             color: blue;
//         }
//         .resource-deleting, .resource-stopping, .resource-failed {
//             color: darkred;
//         }
//         .summary {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .account-content {
//             overflow: hidden;
//         }
//         .account-content.collapsed {
//             display: none;
//         }
//         .empty-account-indicator {
//             color: #999;
//             font-size: 0.8em;
//             background-color: #f0f0f0;
//             padding: 2px 8px;
//             border-radius: 10px;
//             margin-left: 10px;
//         }
//         .toggle-icon {
//             margin-left: 10px;
//             font-weight: bold;
//             transition: transform 0.3s;
//         }
//         .collapsed .toggle-icon {
//             transform: rotate(-90deg);
//         }
//         .filter-controls {
//             background-color: white;
//             border-radius: 8px;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//             margin-bottom: 20px;
//             padding: 15px;
//         }
//         .filter-buttons {
//             display: flex;
//             gap: 10px;
//             margin-top: 10px;
//         }
//         .filter-button {
//             background-color: #0066cc;
//             color: white;
//             border: none;
//             padding: 8px 15px;
//             border-radius: 4px;
//             cursor: pointer;
//         }
//         .filter-button:hover {
//             background-color: #004c99;
//         }
//         .account-container.empty-account {
//             border-left: 3px solid #ffcc00;
//         }
//         .account-container.has-resources {
//             border-left: 3px solid #00cc66;
//         }
//     </style>
//     <script>
//         function toggleAccount(header) {
//             const container = header.parentElement;
//             const content = container.querySelector('.account-content');
//             content.classList.toggle('collapsed');
//         }

//         function showAllAccounts() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = 'block';
//             });
//         }

//         function showAccountsWithResources() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = container.dataset.hasResources === 'true' ? 'block' : 'none';
//             });
//         }

//         function showEmptyAccounts() {
//             document.querySelectorAll('.account-container').forEach(container => {
//                 container.style.display = container.dataset.hasResources === 'false' ? 'block' : 'none';
//             });
//         }

//         function expandAllAccounts() {
//             document.querySelectorAll('.account-content').forEach(content => {
//                 content.classList.remove('collapsed');
//             });
//         }

//         function collapseAllAccounts() {
//             document.querySelectorAll('.account-content').forEach(content => {
//                 content.classList.add('collapsed');
//             });
//         }
//     </script>
// </head>
// <body>
//     <h1>AWS RDS Instances - ${title}</h1>
//     ${summaryHtml}
//     ${accountsHtml}
//     <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
// </body>
// </html>`
// }

/**
 * Generate RDS instances table HTML
 */
// function generateRDSTable(instances: RDSInstanceInfo[]): string {
//   // Sort instances by state and engine
//   const sortedInstances = [...instances].sort((a, b) => {
//     // First by state (available first)
//     if (a.State === 'available' && b.State !== 'available') return -1
//     if (a.State !== 'available' && b.State === 'available') return 1

//     // Then by engine
//     return a.Engine.localeCompare(b.Engine)
//   })

//   let tableHtml = `
//     <table>
//       <thead>
//         <tr>
//           <th>Instance ID</th>
//           <th>Engine</th>
//           <th>Version</th>
//           <th>State</th>
//           <th>Type</th>
//           <th>Endpoint</th>
//           <th>Multi-AZ</th>
//           <th>Storage</th>
//           <th>Region</th>
//         </tr>
//       </thead>
//       <tbody>
//   `

//   sortedInstances.forEach((instance) => {
//     // Determine state CSS class
//     let stateClass = ''
//     switch (instance.State.toLowerCase()) {
//       case 'available':
//         stateClass = 'resource-available'
//         break
//       case 'stopped':
//         stateClass = 'resource-stopped'
//         break
//       case 'backing-up':
//       case 'maintenance':
//       case 'modifying':
//         stateClass = 'resource-backing-up'
//         break
//       case 'creating':
//       case 'starting':
//         stateClass = 'resource-creating'
//         break
//       case 'deleting':
//       case 'stopping':
//       case 'failed':
//         stateClass = 'resource-deleting'
//         break
//       default:
//         stateClass = ''
//     }

//     tableHtml += `
//       <tr>
//         <td>${instance.InstanceId}</td>
//         <td>${instance.Engine}</td>
//         <td>${instance.EngineVersion}</td>
//         <td class="${stateClass}">${instance.State}</td>
//         <td>${instance.Type}</td>
//         <td>${instance.Endpoint}</td>
//         <td>${instance.MultiAZ ? 'Yes' : 'No'}</td>
//         <td>${instance.AllocatedStorage} GB (${instance.StorageType})</td>
//         <td>${instance.Region}</td>
//       </tr>
//     `
//   })

//   tableHtml += `
//       </tbody>
//     </table>
//   `

//   return tableHtml
// }
