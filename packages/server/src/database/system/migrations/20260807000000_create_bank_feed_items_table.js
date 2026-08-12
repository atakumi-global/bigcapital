exports.up = async function (knex) {
  await knex.schema.createTable('bank_feed_items', (table) => {
    table.bigIncrements('id');
    table
      .bigInteger('tenant_id')
      .unsigned()
      .index()
      .references('id')
      .inTable('tenants');
    table.string('provider').notNullable();
    table.string('provider_item_id').notNullable();
    table.timestamps();
    table.unique(['provider', 'provider_item_id']);
  });

  // NOTE: system knex uses upper-case identifier mappers, so raw SQL must use
  // upper-case table/column names on case-sensitive MySQL setups.
  await knex.raw(`
    INSERT INTO BANK_FEED_ITEMS (TENANT_ID, PROVIDER, PROVIDER_ITEM_ID, CREATED_AT, UPDATED_AT)
    SELECT TENANT_ID, 'plaid', PLAID_ITEM_ID, CREATED_AT, UPDATED_AT
    FROM PLAID_ITEMS
  `);
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('bank_feed_items');
};
