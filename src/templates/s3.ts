// File: src/templates/s3.ts
// S3 HTML report template

import { S3BucketInfo } from '../types'

/**
 * Generate enhanced HTML output for S3 buckets
 * @param buckets The S3 buckets to display
 * @param title The title for the report
 * @param totalOrganizationAccounts The total number of accounts in the organization
 * @param allAccounts All accounts in the organization
 */
export function generateS3Html(
  buckets: S3BucketInfo[],
  title: string,
  totalOrganizationAccounts?: number,
  allAccounts?: Record<string, unknown>[],
): string {
  // Group buckets by account for visualization
  const accountGroups = new Map<string, S3BucketInfo[]>()

  // Initialize accounts map
  if (allAccounts && allAccounts.length > 0) {
    allAccounts.forEach((account) => {
      if (account.Id && (account.Status === 'ACTIVE' || !account.Status)) {
        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')

        // Initialize empty array for accounts without buckets
        const key = `${accountId} (${accountName})`
        if (!accountGroups.has(key)) {
          accountGroups.set(key, [])
        }
      }
    })
  }

  // Process all buckets
  buckets.forEach((bucket) => {
    const accountId = bucket.AccountId
    const accountName = bucket.AccountName

    const key = `${accountId} (${accountName})`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    const group = accountGroups.get(key)
    if (group) {
      group.push(bucket)
    }
  })

  // Calculate summary metrics
  const totalAccounts = totalOrganizationAccounts || accountGroups.size
  const accountsWithBuckets = Array.from(accountGroups.entries()).filter(([, buckets]) => buckets.length > 0).length
  const accountsWithoutBuckets = totalAccounts - accountsWithBuckets
  const totalBuckets = buckets.length

  const summaryCards = `
    <div class="summary-section">
      <div class="summary-card">
        <div class="summary-title">Total Buckets</div>
        <div class="summary-value">${totalBuckets}</div>
      </div>
      <div class="summary-card">
        <div class="summary-title">Accounts with Buckets</div>
        <div class="summary-value">${accountsWithBuckets}</div>
      </div>
    </div>
  `

  const accountSection = generateAccountSection(accountGroups, totalAccounts, accountsWithoutBuckets)
  const bucketsTable = generateS3Table(buckets)

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${getCommonStyles()}
        ${getS3Styles()}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🪣 ${title}</h1>
        
        ${summaryCards}
        
        ${accountSection}
        
        <h2>S3 Buckets</h2>
        <div class="table-wrapper">
          ${bucketsTable}
        </div>
        
        <div class="timestamp">
          Report generated on ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate the accounts section showing which accounts have buckets
 */
function generateAccountSection(
  accountGroups: Map<string, S3BucketInfo[]>,
  totalAccounts: number,
  accountsWithoutBuckets: number,
): string {
  if (totalAccounts <= 1) {
    return ''
  }

  let accountsHtml = `
    <h2>Account Summary</h2>
    <div class="account-grid">
  `

  // Show accounts with buckets
  const accountsWithBuckets = Array.from(accountGroups.entries()).filter(([, buckets]) => buckets.length > 0)
  accountsWithBuckets.sort((a, b) => b[1].length - a[1].length) // Sort by bucket count descending

  accountsWithBuckets.forEach(([accountKey, buckets]) => {
    const bucketCount = buckets.length

    accountsHtml += `
      <div class="account-card has-buckets">
        <div class="account-name">${accountKey}</div>
        <div class="account-stats">
          <span class="stat">📦 ${bucketCount} buckets</span>
        </div>
      </div>
    `
  })

  // Show accounts without buckets (if any)
  if (accountsWithoutBuckets > 0) {
    const accountsWithoutBucketsEntries = Array.from(accountGroups.entries()).filter(([, buckets]) => buckets.length === 0)
    accountsWithoutBucketsEntries.forEach(([accountKey]) => {
      accountsHtml += `
        <div class="account-card no-buckets">
          <div class="account-name">${accountKey}</div>
          <div class="account-stats">
            <span class="stat">📦 0 buckets</span>
          </div>
        </div>
      `
    })
  }

  accountsHtml += `
    </div>
  `

  return accountsHtml
}

/**
 * Generate the HTML table for S3 buckets
 */
function generateS3Table(buckets: S3BucketInfo[]): string {
  if (buckets.length === 0) {
    return '<p class="no-resources">No S3 buckets found in the specified accounts.</p>'
  }

  // Sort buckets by account name, then by bucket name
  const sortedBuckets = [...buckets].sort((a, b) => {
    const accountCompare = a.AccountName.localeCompare(b.AccountName)
    if (accountCompare !== 0) return accountCompare
    return a.BucketName.localeCompare(b.BucketName)
  })

  let tableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Bucket Name</th>
          <th>Account</th>
          <th>Region</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
  `

  sortedBuckets.forEach((bucket) => {
    // Format creation date
    let createdDate = bucket.CreationDate
    if (createdDate !== 'Unknown') {
      try {
        createdDate = new Date(createdDate).toLocaleDateString()
      } catch {
        // Keep original if parsing fails
      }
    }

    tableHtml += `
      <tr>
        <td><strong>${bucket.BucketName}</strong></td>
        <td>
          <div class="account-info">
            <div class="account-name">${bucket.AccountName}</div>
            <div class="account-id">${bucket.AccountId}</div>
          </div>
        </td>
        <td>${bucket.Region}</td>
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



/**
 * Get common styles used across all templates
 */
function getCommonStyles(): string {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      background-color: #f5f5f5;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #232f3e;
      border-bottom: 3px solid #ff9900;
      padding-bottom: 15px;
      margin-bottom: 30px;
      font-size: 2.2em;
    }
    
    h2 {
      color: #232f3e;
      margin-top: 40px;
      margin-bottom: 20px;
      font-size: 1.5em;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 0.9em;
    }
    
    .data-table th {
      background-color: #232f3e;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      border-right: 1px solid #3a4553;
    }
    
    .data-table th:last-child {
      border-right: none;
    }
    
    .data-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #f3f4f6;
      vertical-align: top;
    }
    
    .data-table td:last-child {
      border-right: none;
    }
    
    .data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    .data-table tr:hover {
      background-color: #e6f3ff;
    }
    
    .table-wrapper {
      overflow-x: auto;
      margin-bottom: 30px;
    }
    
    .summary-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .summary-card {
      background-color: #232f3e;
      color: white;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .summary-title {
      font-size: 0.9em;
      margin-bottom: 8px;
      color: #cbd5e1;
    }
    
    .summary-value {
      font-size: 2.2em;
      font-weight: bold;
      color: #ff9900;
    }
    
    .account-info .account-name {
      font-weight: 600;
      color: #1f2937;
    }
    
    .account-info .account-id {
      font-size: 0.8em;
      color: #6b7280;
      margin-top: 2px;
    }
    
    .no-resources {
      text-align: center;
      color: #6b7280;
      font-style: italic;
      padding: 40px;
      background-color: #f9fafb;
      border-radius: 8px;
    }
    
    .timestamp {
      color: #6b7280;
      font-size: 0.85em;
      margin-top: 40px;
      text-align: right;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
  `
}

/**
 * Get S3-specific styles
 */
function getS3Styles(): string {
  return `
    /* S3-specific styles */
    .s3-access-denied { 
      color: #9ca3af; 
      font-style: italic;
    }
    
    .account-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .account-card {
      border-radius: 8px;
      padding: 15px;
      border: 2px solid;
    }
    
    .account-card.has-buckets {
      background-color: #f0f9ff;
      border-color: #0ea5e9;
    }
    
    .account-card.no-buckets {
      background-color: #f9fafb;
      border-color: #d1d5db;
    }
    
    .account-card .account-name {
      font-weight: 600;
      margin-bottom: 8px;
      color: #1f2937;
    }
    
    .account-card .account-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .account-card .stat {
      font-size: 0.85em;
      color: #4b5563;
      background-color: rgba(255,255,255,0.7);
      padding: 2px 8px;
      border-radius: 12px;
    }
  `
}
