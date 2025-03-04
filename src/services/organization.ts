// File: src/services/organizations.ts
// Organizations service functions

import { Organizations } from '@aws-sdk/client-organizations'

/**
 * Get all accounts from the organization with pagination
 */
export async function getAllAccounts(client: Organizations): Promise<Record<string, unknown>[]> {
  let accounts: Record<string, unknown>[] = []
  let nextToken: string | undefined

  try {
    do {
      const response = await client.listAccounts({ NextToken: nextToken })
      if (response.Accounts) {
        accounts = accounts.concat(response.Accounts as Record<string, unknown>[])
      }
      nextToken = response.NextToken
    } while (nextToken)

    return accounts
  } catch (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }
}

/**
 * Get details about a specific account
 */
export async function getAccount(client: Organizations, accountId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await client.describeAccount({ AccountId: accountId })
    return (response.Account as Record<string, unknown>) || null
  } catch (error) {
    console.error(`Error fetching account ${accountId}:`, error)
    return null
  }
}

/**
 * Get organization details
 */
export async function getOrganizationDetails(client: Organizations): Promise<Record<string, unknown> | null> {
  try {
    const response = await client.describeOrganization({})
    return (response.Organization as Record<string, unknown>) || null
  } catch (error) {
    console.error('Error fetching organization details:', error)
    throw error
  }
}

/**
 * Get organization root
 */
export async function getOrganizationRoot(client: Organizations): Promise<string> {
  try {
    const rootsResponse = await client.listRoots({})

    if (!rootsResponse.Roots || rootsResponse.Roots.length === 0) {
      throw new Error('No organization roots found')
    }

    const rootId = rootsResponse.Roots[0].Id
    if (!rootId) {
      throw new Error('Root ID is undefined')
    }

    return rootId
  } catch (error) {
    console.error('Error fetching organization root:', error)
    throw error
  }
}

/**
 * Recursively get all organizational units
 */
export async function getAllOrganizationalUnits(
  client: Organizations,
  parentId: string,
): Promise<Array<Record<string, unknown>>> {
  let allOUs: Array<Record<string, unknown>> = []

  try {
    // Get OUs for this parent
    const response = await client.listOrganizationalUnitsForParent({
      ParentId: parentId,
    })

    if (!response.OrganizationalUnits || response.OrganizationalUnits.length === 0) {
      return allOUs
    }

    // For each OU, add it to our list and get its children
    for (const ou of response.OrganizationalUnits) {
      // Add parent ID for reference in the output
      const ouWithParent = { ...ou, ParentId: parentId }
      allOUs.push(ouWithParent as Record<string, unknown>)

      // Get children OUs recursively
      if (ou.Id) {
        const childOUs = await getAllOrganizationalUnits(client, ou.Id)
        allOUs = allOUs.concat(childOUs)
      }
    }

    return allOUs
  } catch (error) {
    console.error(`Error fetching OUs for parent ${parentId}:`, error)
    throw error
  }
}

/**
 * Get parent information for each account
 */
export async function getParentInfoForAccounts(
  client: Organizations,
  accounts: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const accountsWithParents = []

  for (const account of accounts) {
    if (account.Id) {
      try {
        const response = await client.listParents({ ChildId: String(account.Id) })

        if (response.Parents && response.Parents.length > 0) {
          accountsWithParents.push({
            ...account,
            ParentId: response.Parents[0].Id,
            ParentType: response.Parents[0].Type,
          })
        } else {
          accountsWithParents.push({
            ...account,
            ParentId: 'Unknown',
            ParentType: 'Unknown',
          })
        }
      } catch (error) {
        console.error(`Error fetching parent for account ${account.Id}:`, error)
        accountsWithParents.push({
          ...account,
          ParentId: 'Error',
          ParentType: 'Error',
        })
      }
    }
  }

  return accountsWithParents
}
