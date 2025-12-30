import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

const magicLinksTable = {
  TableName: 'MagicLinks',
  KeySchema: [
    {
      AttributeName: 'userNameHash',
      KeyType: 'HASH',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'userNameHash',
      AttributeType: 'B',
    },
  ],
  BillingMode: 'PAY_PER_REQUEST',
} satisfies CreateTableCommandInput;

export const tables = { magicLinksTable };
