#!/usr/bin/env node
/**
 * Vtopmart: wrong ASIN (B0B9S5HZ26 = plastic-lid 8-pack).
 * No Amazon 8-pack bamboo listing found; use 5-pack bamboo B0FL7J1WC5.
 */
import { connectPgClient } from './lib/pg-connect.mjs'

const PRODUCT_ID = '43617aa8-6d1c-4c23-8fc1-f742710de80f'
const NEW_NAME = 'Vtopmart Glass Food Storage Containers with Bamboo Lids 5 Pack'
const NEW_AMAZON =
  'https://www.amazon.com/Vtopmart-Containers-Storage-Microwave-Dishwasher/dp/B0FL7J1WC5'

const client = await connectPgClient()
try {
  const del = await client.query(
    `delete from public.product_evidence where product_id = $1`,
    [PRODUCT_ID],
  )
  console.log('Deleted evidence rows:', del.rowCount)

  const { rows } = await client.query(
    `
    update public.products
    set
      product_name = $2,
      amazon_url = $3,
      affiliate_link = $3,
      agent_status = 'unscored',
      date_last_updated = now()
    where product_id = $1
    returning product_name, amazon_url, agent_status
    `,
    [PRODUCT_ID, NEW_NAME, NEW_AMAZON],
  )
  console.log('Product updated:', rows[0])
} finally {
  await client.end()
}
