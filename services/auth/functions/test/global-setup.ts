import {
  setup as setupDynamoDb,
  teardown as teardownDynamoDb,
} from '@test/local-dynamodb';
import { tables } from './dynamodb-tables.ts';

export async function setup() {
  await setupDynamoDb({ tables: [tables.magicLinksTable] });
  process.env.DYNAMODB_SECRETS_TABLE = tables.magicLinksTable.TableName;
}

export async function teardown() {
  await teardownDynamoDb();
}
