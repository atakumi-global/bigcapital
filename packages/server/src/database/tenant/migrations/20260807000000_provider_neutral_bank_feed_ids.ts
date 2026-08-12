exports.up = async function (knex) {
  await knex.schema.createTable('bank_feed_items', (table) => {
    table.increments('id');
    table.integer('tenant_id').unsigned().index();
    table.string('provider').notNullable();
    table.string('provider_item_id').notNullable();
    table.string('provider_institution_id').nullable();
    table.text('access_token').nullable();
    table.text('refresh_token').nullable();
    table.string('last_cursor').nullable();
    table.json('sync_state').nullable();
    table.string('status').nullable();
    table.datetime('paused_at').nullable();
    table.timestamps();
    table.unique(['provider', 'provider_item_id']);
  });

  await knex.schema.table('accounts', (table) => {
    table.string('bank_feed_provider').nullable();
    table.string('bank_feed_provider_item_id').nullable();
    table.string('bank_feed_provider_account_id').nullable();
    table.index(
      ['bank_feed_provider', 'bank_feed_provider_account_id'],
      'accounts_feed_provider_account_idx',
    );
  });

  await knex.schema.table('uncategorized_cashflow_transactions', (table) => {
    table.string('bank_feed_provider').nullable();
    table.string('bank_feed_provider_transaction_id').nullable();
    table.string('pending_bank_feed_provider_transaction_id').nullable();
    table.index(
      ['bank_feed_provider', 'bank_feed_provider_transaction_id'],
      'uct_feed_provider_tx_idx',
    );
  });

  // Backfill Plaid into provider-neutral columns. Keep plaid_* columns for
  // rollback/compatibility until all readers/writers are migrated.
  // NOTE: tenant/system knex uses upper-case identifier mappers, so raw SQL
  // must use upper-case table/column names on case-sensitive MySQL setups.
  await knex.raw(`
    INSERT INTO BANK_FEED_ITEMS (
      TENANT_ID,
      PROVIDER,
      PROVIDER_ITEM_ID,
      PROVIDER_INSTITUTION_ID,
      ACCESS_TOKEN,
      LAST_CURSOR,
      STATUS,
      PAUSED_AT,
      CREATED_AT,
      UPDATED_AT
    )
    SELECT
      TENANT_ID,
      'plaid',
      PLAID_ITEM_ID,
      PLAID_INSTITUTION_ID,
      PLAID_ACCESS_TOKEN,
      LAST_CURSOR,
      STATUS,
      PAUSED_AT,
      CREATED_AT,
      UPDATED_AT
    FROM PLAID_ITEMS
  `);

  await knex.raw(`
    UPDATE ACCOUNTS
    SET
      BANK_FEED_PROVIDER = 'plaid',
      BANK_FEED_PROVIDER_ITEM_ID = PLAID_ITEM_ID,
      BANK_FEED_PROVIDER_ACCOUNT_ID = PLAID_ACCOUNT_ID
    WHERE PLAID_ITEM_ID IS NOT NULL OR PLAID_ACCOUNT_ID IS NOT NULL
  `);

  await knex.raw(`
    UPDATE UNCATEGORIZED_CASHFLOW_TRANSACTIONS
    SET
      BANK_FEED_PROVIDER = 'plaid',
      BANK_FEED_PROVIDER_TRANSACTION_ID = PLAID_TRANSACTION_ID,
      PENDING_BANK_FEED_PROVIDER_TRANSACTION_ID = PENDING_PLAID_TRANSACTION_ID
    WHERE PLAID_TRANSACTION_ID IS NOT NULL OR PENDING_PLAID_TRANSACTION_ID IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE UNCATEGORIZED_CASHFLOW_TRANSACTIONS DROP INDEX IF EXISTS UCT_FEED_PROVIDER_TX_IDX');
  await knex.schema.table('uncategorized_cashflow_transactions', (table) => {
    table.dropColumn('bank_feed_provider');
    table.dropColumn('bank_feed_provider_transaction_id');
    table.dropColumn('pending_bank_feed_provider_transaction_id');
  });

  await knex.raw('ALTER TABLE ACCOUNTS DROP INDEX IF EXISTS ACCOUNTS_FEED_PROVIDER_ACCOUNT_IDX');
  await knex.schema.table('accounts', (table) => {
    table.dropColumn('bank_feed_provider');
    table.dropColumn('bank_feed_provider_item_id');
    table.dropColumn('bank_feed_provider_account_id');
  });

  await knex.schema.dropTableIfExists('bank_feed_items');
};
