import type { TakeSixDocument } from '../src/index.js'

/**
 * top level:  web (A1:C1), api (D1:F1), db (A2:F2)
 * api:        auth (A1:B1), orders (C1:F1)
 * orders:     orders-svc (A1:C1), orders-queue (D1:F1)
 */
export function sampleDoc(): TakeSixDocument {
  return {
    takesix: '1.0',
    title: 'Shop',
    blocks: [
      { id: 'web', title: 'Web app', at: 'A1:C1' },
      {
        id: 'api',
        title: 'API',
        at: 'D1:F1',
        children: [
          { id: 'auth', title: 'Auth', at: 'A1:B1' },
          {
            id: 'orders',
            title: 'Orders',
            at: 'C1:F1',
            children: [
              { id: 'orders-svc', title: 'Service', at: 'A1:C1' },
              { id: 'orders-queue', title: 'Queue', at: 'D1:F1' },
            ],
          },
        ],
      },
      { id: 'db', title: 'Database', at: 'A2:F2' },
    ],
    links: [
      { id: 'l1', from: 'web', to: 'api', label: 'REST' },
      { id: 'l2', from: 'orders-svc', to: 'db', label: 'SQL' },
      { id: 'l3', from: 'auth', to: 'db' },
      { id: 'l4', from: 'orders-svc', to: 'orders-queue' },
      { id: 'l5', from: 'auth', to: 'orders' },
    ],
  }
}

/** `n` full-width rows, one block per row (at most 6 fit the grid). */
export function blocks(n: number, prefix = 'b') {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `Block ${i}`, at: `A${i + 1}:F${i + 1}` }))
}
