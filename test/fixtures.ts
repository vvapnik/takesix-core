import type { TakeSixDocument } from '../src/index.js'

/**
 * top level:  web, api, db
 * api:        auth, orders
 * orders:     orders-svc, orders-queue
 */
export function sampleDoc(): TakeSixDocument {
  return {
    takesix: '1.0',
    title: 'Shop',
    blocks: [
      { id: 'web', title: 'Web app' },
      {
        id: 'api',
        title: 'API',
        children: [
          { id: 'auth', title: 'Auth' },
          {
            id: 'orders',
            title: 'Orders',
            children: [
              { id: 'orders-svc', title: 'Service' },
              { id: 'orders-queue', title: 'Queue' },
            ],
          },
        ],
      },
      { id: 'db', title: 'Database' },
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

export function blocks(n: number, prefix = 'b') {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `Block ${i}` }))
}
