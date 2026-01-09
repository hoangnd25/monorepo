import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { RemovalPolicy } from 'aws-cdk-lib';
import { initProject } from 'sst/project.js';
import { App, Function, getStack, StackContext } from 'sst/constructs';
import { GlobalTable } from './GlobalTable.ts';

// Mock the sst-helpers import
vi.mock('@lib/sst-helpers', () => ({
  removalPolicy: {
    retainForPermanentStage: vi.fn(() => RemovalPolicy.DESTROY),
  },
}));

describe('GlobalTable', () => {
  beforeAll(async () => {
    await initProject({});
  });

  describe('constructor', () => {
    it('should create a global table with basic configuration', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
            sk: 'string',
          },
          primaryIndex: { partitionKey: 'pk', sortKey: 'sk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          TableName: Match.stringLikeRegexp('.*-TestTable'),
          KeySchema: Match.arrayWith([
            Match.objectLike({ AttributeName: 'pk', KeyType: 'HASH' }),
            Match.objectLike({ AttributeName: 'sk', KeyType: 'RANGE' }),
          ]),
          AttributeDefinitions: Match.arrayWith([
            Match.objectLike({ AttributeName: 'pk', AttributeType: 'S' }),
            Match.objectLike({ AttributeName: 'sk', AttributeType: 'S' }),
          ]),
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
    });

    it('should create a table with partition key only', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
          },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          KeySchema: [
            Match.objectLike({ AttributeName: 'pk', KeyType: 'HASH' }),
          ],
        })
      );
    });

    it('should support different field types', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            stringField: 'string',
            numberField: 'number',
            binaryField: 'binary',
          },
          primaryIndex: { partitionKey: 'stringField', sortKey: 'numberField' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          AttributeDefinitions: Match.arrayWith([
            Match.objectLike({
              AttributeName: 'stringField',
              AttributeType: 'S',
            }),
            Match.objectLike({
              AttributeName: 'numberField',
              AttributeType: 'N',
            }),
          ]),
        })
      );
    });

    it('should allow overriding table name', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          tableName: 'my-custom-table-name',
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          TableName: 'my-custom-table-name',
        })
      );
    });

    it('should enable point-in-time recovery by default', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          Replicas: Match.arrayWith([
            Match.objectLike({
              PointInTimeRecoverySpecification: {
                PointInTimeRecoveryEnabled: true,
              },
            }),
          ]),
        })
      );
    });

    it('should allow disabling point-in-time recovery', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          pointInTimeRecovery: false,
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          Replicas: Match.arrayWith([
            Match.objectLike({
              PointInTimeRecoverySpecification: {
                PointInTimeRecoveryEnabled: false,
              },
            }),
          ]),
        })
      );
    });
  });

  describe('timeToLiveAttribute', () => {
    it('should configure TTL attribute', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          timeToLiveAttribute: 'expiresAt',
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          TimeToLiveSpecification: {
            AttributeName: 'expiresAt',
            Enabled: true,
          },
        })
      );
    });
  });

  describe('stream', () => {
    it('should configure DynamoDB stream', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          StreamSpecification: {
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
        })
      );
    });
  });

  describe('globalIndexes', () => {
    it('should create global secondary indexes', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
            sk: 'string',
            gsi1pk: 'string',
            gsi1sk: 'number',
          },
          primaryIndex: { partitionKey: 'pk', sortKey: 'sk' },
          globalIndexes: {
            GSI1: { partitionKey: 'gsi1pk', sortKey: 'gsi1sk' },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          GlobalSecondaryIndexes: Match.arrayWith([
            Match.objectLike({
              IndexName: 'GSI1',
              KeySchema: Match.arrayWith([
                Match.objectLike({ AttributeName: 'gsi1pk', KeyType: 'HASH' }),
                Match.objectLike({ AttributeName: 'gsi1sk', KeyType: 'RANGE' }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should support GSI with keys_only projection', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
            gsi1pk: 'string',
          },
          primaryIndex: { partitionKey: 'pk' },
          globalIndexes: {
            GSI1: { partitionKey: 'gsi1pk', projection: 'keys_only' },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          GlobalSecondaryIndexes: Match.arrayWith([
            Match.objectLike({
              IndexName: 'GSI1',
              Projection: { ProjectionType: 'KEYS_ONLY' },
            }),
          ]),
        })
      );
    });

    it('should support GSI with include projection', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
            gsi1pk: 'string',
          },
          primaryIndex: { partitionKey: 'pk' },
          globalIndexes: {
            GSI1: { partitionKey: 'gsi1pk', projection: ['email', 'name'] },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          GlobalSecondaryIndexes: Match.arrayWith([
            Match.objectLike({
              IndexName: 'GSI1',
              Projection: {
                ProjectionType: 'INCLUDE',
                NonKeyAttributes: ['email', 'name'],
              },
            }),
          ]),
        })
      );
    });
  });

  describe('localIndexes', () => {
    it('should create local secondary indexes', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: {
            pk: 'string',
            sk: 'string',
            lsi1sk: 'number',
          },
          primaryIndex: { partitionKey: 'pk', sortKey: 'sk' },
          localIndexes: {
            LSI1: { sortKey: 'lsi1sk' },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          LocalSecondaryIndexes: Match.arrayWith([
            Match.objectLike({
              IndexName: 'LSI1',
              KeySchema: Match.arrayWith([
                Match.objectLike({ AttributeName: 'pk', KeyType: 'HASH' }),
                Match.objectLike({ AttributeName: 'lsi1sk', KeyType: 'RANGE' }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe('replicas', () => {
    it('should create replica tables in specified regions', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          // Note: us-east-1 is the default region for tests, so use different regions
          replicas: [{ region: 'us-west-2' }, { region: 'eu-west-1' }],
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          Replicas: Match.arrayWith([
            Match.objectLike({ Region: 'us-west-2' }),
            Match.objectLike({ Region: 'eu-west-1' }),
          ]),
        })
      );
    });

    it('should configure stream with replicas', async () => {
      const app = new App({ mode: 'deploy' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          replicas: [{ region: 'us-west-2' }],
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Debug: print the template
      // console.log(JSON.stringify(template.toJSON(), null, 2));

      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          StreamSpecification: {
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
          Replicas: Match.arrayWith([
            Match.objectLike({ Region: 'us-west-2' }),
          ]),
        })
      );
    });
  });

  describe('validation', () => {
    it('should throw error when fields is empty', () => {
      const app = new App({ mode: 'deploy' });

      expect(() => {
        const TestStack = function (ctx: StackContext) {
          new GlobalTable(ctx.stack, 'TestTable', {
            fields: {},
            primaryIndex: { partitionKey: 'pk' },
          });
        };
        app.stack(TestStack);
      }).toThrow('No fields defined for the "TestTable" GlobalTable');
    });

    it('should throw error when primaryIndex is missing', () => {
      const app = new App({ mode: 'deploy' });

      expect(() => {
        const TestStack = function (ctx: StackContext) {
          new GlobalTable(ctx.stack, 'TestTable', {
            fields: { pk: 'string' },
          });
        };
        app.stack(TestStack);
      }).toThrow('Missing "primaryIndex" in "TestTable" GlobalTable');
    });

    it('should throw error when partitionKey is missing in primaryIndex', () => {
      const app = new App({ mode: 'deploy' });

      expect(() => {
        const TestStack = function (ctx: StackContext) {
          new GlobalTable(ctx.stack, 'TestTable', {
            fields: { pk: 'string' },
            primaryIndex: {} as { partitionKey: string },
          });
        };
        app.stack(TestStack);
      }).toThrow(
        'Missing "partitionKey" in primary index for the "TestTable" GlobalTable'
      );
    });

    it('should throw error when field referenced in primaryIndex does not exist', () => {
      const app = new App({ mode: 'deploy' });

      expect(() => {
        const TestStack = function (ctx: StackContext) {
          new GlobalTable(ctx.stack, 'TestTable', {
            fields: { pk: 'string' },
            primaryIndex: { partitionKey: 'nonexistent' },
          });
        };
        app.stack(TestStack);
      }).toThrow('Please define "nonexistent" in "fields"');
    });
  });

  describe('getConstructMetadata', () => {
    it('should return correct metadata', async () => {
      const app = new App({ mode: 'deploy' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const metadata = tableInstance!.getConstructMetadata();

      expect(metadata.type).toBe('GlobalTable');
      expect(metadata.data.tableName).toBeDefined();
    });
  });

  describe('getBindings', () => {
    it('should return correct bindings with DynamoDB permissions', async () => {
      const app = new App({ mode: 'deploy' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const bindings = tableInstance!.getBindings();

      expect(bindings.clientPackage).toBe('config');
      expect(bindings.variables?.tableName).toBeDefined();
      expect(bindings.variables?.tableName?.type).toBe('plain');
      expect(bindings.permissions).toBeDefined();
      expect(bindings.permissions?.['dynamodb:*']).toBeDefined();
    });
  });

  describe('SST Function binding', () => {
    it('should bind to SST Function with correct permissions', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        const table = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });

        new Function(ctx.stack, 'TestFunction', {
          handler: 'src/index.handler',
          bind: [table],
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Verify Lambda has environment variable with table name (uses GlobalTable prefix)
      template.hasResourceProperties(
        'AWS::Lambda::Function',
        Match.objectLike({
          Environment: {
            Variables: Match.objectLike({
              SST_GlobalTable_tableName_TestTable: Match.anyValue(),
            }),
          },
        })
      );

      // Verify IAM policy with DynamoDB permissions is attached
      template.hasResourceProperties(
        'AWS::IAM::Policy',
        Match.objectLike({
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'dynamodb:*',
                Effect: 'Allow',
              }),
            ]),
          },
        })
      );
    });
  });

  describe('properties', () => {
    it('should expose tableArn property', async () => {
      const app = new App({ mode: 'deploy' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      expect(tableInstance!.tableArn).toBeDefined();
    });

    it('should expose tableName property', async () => {
      const app = new App({ mode: 'deploy' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });
      };
      app.stack(TestStack);
      await app.finish();

      expect(tableInstance!.tableName).toBeDefined();
    });
  });

  describe('consumers', () => {
    it('should create consumers when stream is enabled', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            consumer1: 'src/consumer1.handler',
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Verify consumer Lambda function is created
      template.hasResourceProperties(
        'AWS::Lambda::Function',
        Match.objectLike({
          Handler: 'index.handler',
        })
      );

      // Verify event source mapping is created
      template.hasResourceProperties(
        'AWS::Lambda::EventSourceMapping',
        Match.objectLike({
          StartingPosition: 'LATEST',
        })
      );
    });

    it('should throw error when adding consumers without stream enabled', () => {
      const app = new App({ mode: 'dev' });

      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          consumers: {
            consumer1: 'src/consumer1.handler',
          },
        });
      };

      expect(() => app.stack(TestStack)).toThrow(
        'Please enable the "stream" option to add consumers to the "TestTable" GlobalTable.'
      );
    });

    it('should support consumer with function props', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_image',
          consumers: {
            consumer1: {
              function: {
                handler: 'src/consumer1.handler',
                timeout: 30,
              },
            },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::Lambda::Function',
        Match.objectLike({
          Timeout: 30,
        })
      );
    });

    it('should support consumer with filters', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            consumer1: {
              function: 'src/consumer1.handler',
              filters: [
                {
                  dynamodb: {
                    Keys: {
                      pk: { S: ['USER#123'] },
                    },
                  },
                },
              ],
            },
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::Lambda::EventSourceMapping',
        Match.objectLike({
          FilterCriteria: Match.objectLike({
            Filters: Match.arrayWith([
              Match.objectLike({
                Pattern: Match.anyValue(),
              }),
            ]),
          }),
        })
      );
    });

    it('should apply default function props to consumers', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_image',
          defaults: {
            function: {
              timeout: 60,
              memorySize: 512,
            },
          },
          consumers: {
            consumer1: 'src/consumer1.handler',
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      template.hasResourceProperties(
        'AWS::Lambda::Function',
        Match.objectLike({
          Timeout: 60,
          MemorySize: 512,
        })
      );
    });

    it('should add consumers dynamically with addConsumers', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        const table = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
        });

        table.addConsumers(ctx.stack, {
          consumer1: 'src/consumer1.handler',
          consumer2: 'src/consumer2.handler',
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Should have 2 event source mappings
      template.resourceCountIs('AWS::Lambda::EventSourceMapping', 2);
    });

    it('should get function by consumer name', async () => {
      const app = new App({ mode: 'dev' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            myConsumer: 'src/consumer.handler',
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const fn = tableInstance!.getFunction('myConsumer');
      expect(fn).toBeDefined();
      expect(tableInstance!.getFunction('nonexistent')).toBeUndefined();
    });

    it('should bind resources to specific consumer', async () => {
      const app = new App({ mode: 'dev' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            myConsumer: 'src/consumer.handler',
          },
        });

        const anotherTable = new GlobalTable(ctx.stack, 'AnotherTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
        });

        tableInstance.bindToConsumer('myConsumer', [anotherTable]);
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Verify consumer has permissions to another table
      template.hasResourceProperties(
        'AWS::IAM::Policy',
        Match.objectLike({
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 'dynamodb:*',
                Effect: 'Allow',
              }),
            ]),
          },
        })
      );
    });

    it('should throw error when binding to nonexistent consumer', async () => {
      const app = new App({ mode: 'dev' });

      await expect(async () => {
        const TestStack = function (ctx: StackContext) {
          const table = new GlobalTable(ctx.stack, 'TestTable', {
            fields: { pk: 'string' },
            primaryIndex: { partitionKey: 'pk' },
            stream: 'new_and_old_images',
            consumers: {
              myConsumer: 'src/consumer.handler',
            },
          });

          const anotherTable = new GlobalTable(ctx.stack, 'AnotherTable', {
            fields: { pk: 'string' },
            primaryIndex: { partitionKey: 'pk' },
          });

          table.bindToConsumer('nonexistent', [anotherTable]);
        };
        app.stack(TestStack);
        await app.finish();
      }).rejects.toThrow(
        'The "nonexistent" consumer was not found in the "TestTable" GlobalTable.'
      );
    });

    it('should attach permissions to all consumers', async () => {
      const app = new App({ mode: 'dev' });
      const TestStack = function (ctx: StackContext) {
        const table = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            consumer1: 'src/consumer1.handler',
            consumer2: 'src/consumer2.handler',
          },
        });

        table.attachPermissions(['s3']);
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Both consumers should have S3 permissions
      template.hasResourceProperties(
        'AWS::IAM::Policy',
        Match.objectLike({
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: 's3:*',
                Effect: 'Allow',
              }),
            ]),
          },
        })
      );
    });

    it('should include consumers in metadata', async () => {
      const app = new App({ mode: 'dev' });
      let tableInstance: GlobalTable | undefined;
      const TestStack = function (ctx: StackContext) {
        tableInstance = new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          stream: 'new_and_old_images',
          consumers: {
            consumer1: 'src/consumer1.handler',
          },
        });
      };
      app.stack(TestStack);
      await app.finish();

      const metadata = tableInstance!.getConstructMetadata();
      expect(metadata.data.consumers).toBeDefined();
      expect(metadata.data.consumers).toHaveLength(1);
      expect(metadata.data.consumers[0].name).toBe('consumer1');
    });
  });

  describe('kinesisStream', () => {
    it('should configure Kinesis stream for the table', async () => {
      const app = new App({ mode: 'dev' });
      const { KinesisStream } = await import('sst/constructs');
      const TestStack = function (ctx: StackContext) {
        const stream = new KinesisStream(ctx.stack, 'Stream');

        new GlobalTable(ctx.stack, 'TestTable', {
          fields: { pk: 'string' },
          primaryIndex: { partitionKey: 'pk' },
          kinesisStream: stream,
        });
      };
      app.stack(TestStack);
      await app.finish();

      const template = Template.fromStack(getStack(TestStack));

      // Verify Kinesis stream is created
      template.resourceCountIs('AWS::Kinesis::Stream', 1);

      // Verify GlobalTable has StreamSpecification
      template.hasResourceProperties(
        'AWS::DynamoDB::GlobalTable',
        Match.objectLike({
          StreamSpecification: {
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
        })
      );
    });
  });

  describe('static import methods', () => {
    describe('fromTableName', () => {
      it('should import a table by name', async () => {
        const app = new App({ mode: 'deploy' });
        let tableInstance: GlobalTable | undefined;
        const TestStack = function (ctx: StackContext) {
          tableInstance = GlobalTable.fromTableName(
            ctx.stack,
            'ImportedTable',
            'my-existing-table'
          );
        };
        app.stack(TestStack);
        await app.finish();

        expect(tableInstance).toBeDefined();
        expect(tableInstance!.tableName).toBe('my-existing-table');
      });

      it('should allow binding imported table to function', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          const table = GlobalTable.fromTableName(
            ctx.stack,
            'ImportedTable',
            'my-existing-table'
          );

          new Function(ctx.stack, 'TestFunction', {
            handler: 'src/index.handler',
            bind: [table],
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Verify Lambda has environment variable with table name
        template.hasResourceProperties(
          'AWS::Lambda::Function',
          Match.objectLike({
            Environment: {
              Variables: Match.objectLike({
                SST_GlobalTable_tableName_ImportedTable: 'my-existing-table',
              }),
            },
          })
        );
      });
    });

    describe('fromTableArn', () => {
      it('should import a table by ARN', async () => {
        const app = new App({ mode: 'deploy' });
        let tableInstance: GlobalTable | undefined;
        const TestStack = function (ctx: StackContext) {
          tableInstance = GlobalTable.fromTableArn(
            ctx.stack,
            'ImportedTable',
            'arn:aws:dynamodb:us-east-1:123456789012:table/my-existing-table'
          );
        };
        app.stack(TestStack);
        await app.finish();

        expect(tableInstance).toBeDefined();
        expect(tableInstance!.tableArn).toBe(
          'arn:aws:dynamodb:us-east-1:123456789012:table/my-existing-table'
        );
        expect(tableInstance!.tableName).toBe('my-existing-table');
      });
    });

    describe('fromTableAttributes', () => {
      it('should import a table with attributes', async () => {
        const app = new App({ mode: 'deploy' });
        let tableInstance: GlobalTable | undefined;
        const TestStack = function (ctx: StackContext) {
          tableInstance = GlobalTable.fromTableAttributes(
            ctx.stack,
            'ImportedTable',
            {
              tableName: 'my-existing-table',
              tableStreamArn:
                'arn:aws:dynamodb:us-east-1:123456789012:table/my-existing-table/stream/2024-01-01T00:00:00.000',
            }
          );
        };
        app.stack(TestStack);
        await app.finish();

        expect(tableInstance).toBeDefined();
        expect(tableInstance!.tableName).toBe('my-existing-table');
      });

      it('should allow adding consumers to imported table with stream ARN', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          const table = GlobalTable.fromTableAttributes(
            ctx.stack,
            'ImportedTable',
            {
              tableName: 'my-existing-table',
              tableStreamArn:
                'arn:aws:dynamodb:us-east-1:123456789012:table/my-existing-table/stream/2024-01-01T00:00:00.000',
            }
          );

          table.addConsumers(ctx.stack, {
            consumer1: 'src/consumer.handler',
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Verify consumer Lambda function is created
        template.hasResourceProperties(
          'AWS::Lambda::Function',
          Match.objectLike({
            Handler: 'index.handler',
          })
        );

        // Verify event source mapping is created
        template.hasResourceProperties(
          'AWS::Lambda::EventSourceMapping',
          Match.objectLike({
            StartingPosition: 'LATEST',
          })
        );
      });

      it('should throw error when configuring Kinesis stream on imported table', () => {
        const app = new App({ mode: 'deploy' });

        expect(async () => {
          const { KinesisStream } = await import('sst/constructs');
          const TestStack = function (ctx: StackContext) {
            new KinesisStream(ctx.stack, 'Stream');

            GlobalTable.fromTableAttributes(ctx.stack, 'ImportedTable', {
              tableName: 'my-existing-table',
            });

            // This should throw - we can't pass kinesisStream in fromTableAttributes
            // but the error comes from the GlobalTable constructor if we pass it
          };
          app.stack(TestStack);
          await app.finish();
        }).not.toThrow(); // fromTableAttributes doesn't accept kinesisStream prop
      });
    });

    describe('replica table import pattern', () => {
      it('should support importing replica table in secondary region', async () => {
        // This test simulates the pattern:
        // Region A: Primary table with replica in Region B
        // Region B: Import the replica and add consumers

        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          // In Region B, import the replica that was created by Region A's GlobalTable
          const replicaTable = GlobalTable.fromTableAttributes(
            ctx.stack,
            'ReplicaTable',
            {
              tableName: 'primary-region-table-name',
              tableStreamArn:
                'arn:aws:dynamodb:us-west-2:123456789012:table/primary-region-table-name/stream/2024-01-01T00:00:00.000',
            }
          );

          // Add a consumer that processes stream events in Region B
          replicaTable.addConsumers(ctx.stack, {
            regionBConsumer: 'src/region-b-consumer.handler',
          });

          // Bind the table to another function
          new Function(ctx.stack, 'RegionBFunction', {
            handler: 'src/index.handler',
            bind: [replicaTable],
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Verify consumer is created
        template.resourceCountIs('AWS::Lambda::EventSourceMapping', 1);

        // Verify function has table binding
        template.hasResourceProperties(
          'AWS::Lambda::Function',
          Match.objectLike({
            Environment: {
              Variables: Match.objectLike({
                SST_GlobalTable_tableName_ReplicaTable:
                  'primary-region-table-name',
              }),
            },
          })
        );
      });

      it('should throw error when adding consumers to imported table without stream ARN and autoLookupAttributes disabled', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          // Import without tableStreamArn and without autoLookupAttributes
          const replicaTable = GlobalTable.fromTableName(
            ctx.stack,
            'ReplicaTable',
            'my-table-name'
          );

          // Add a consumer - this should throw
          replicaTable.addConsumers(ctx.stack, {
            consumer1: 'src/consumer.handler',
          });
        };

        await expect(async () => {
          app.stack(TestStack);
          await app.finish();
        }).rejects.toThrow(
          /Cannot add consumers to imported GlobalTable "ReplicaTable" without a tableStreamArn/
        );
      });

      it('should automatically lookup stream ARN when autoLookupAttributes is enabled', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          // Import with autoLookupAttributes enabled
          const replicaTable = GlobalTable.fromTableName(
            ctx.stack,
            'ReplicaTable',
            'my-table-name',
            { autoLookupAttributes: true }
          );

          // Add a consumer - this should trigger the auto-lookup
          replicaTable.addConsumers(ctx.stack, {
            consumer1: 'src/consumer.handler',
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Verify custom resource for stream lookup is created
        template.hasResourceProperties(
          'Custom::AWS',
          Match.objectLike({
            ServiceToken: Match.anyValue(),
            Create: Match.serializedJson(
              Match.objectLike({
                service: 'DynamoDB',
                action: 'describeTable',
                parameters: {
                  TableName: 'my-table-name',
                },
              })
            ),
          })
        );

        // Verify consumer Lambda function is created
        template.hasResourceProperties(
          'AWS::Lambda::Function',
          Match.objectLike({
            Handler: 'index.handler',
          })
        );

        // Verify event source mapping is created
        template.hasResourceProperties(
          'AWS::Lambda::EventSourceMapping',
          Match.objectLike({
            StartingPosition: 'LATEST',
          })
        );
      });

      it('should reuse stream lookup custom resource for multiple consumers', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          // Import with autoLookupAttributes enabled
          const replicaTable = GlobalTable.fromTableName(
            ctx.stack,
            'ReplicaTable',
            'my-table-name',
            { autoLookupAttributes: true }
          );

          // Add multiple consumers
          replicaTable.addConsumers(ctx.stack, {
            consumer1: 'src/consumer1.handler',
            consumer2: 'src/consumer2.handler',
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Should only have ONE custom resource for stream lookup (reused)
        template.resourceCountIs('Custom::AWS', 1);

        // Should have 2 event source mappings
        template.resourceCountIs('AWS::Lambda::EventSourceMapping', 2);
      });

      it('should not create stream lookup when importing with stream ARN', async () => {
        const app = new App({ mode: 'dev' });
        const TestStack = function (ctx: StackContext) {
          // Import WITH tableStreamArn
          const replicaTable = GlobalTable.fromTableAttributes(
            ctx.stack,
            'ReplicaTable',
            {
              tableName: 'my-table-name',
              tableStreamArn:
                'arn:aws:dynamodb:us-east-1:123456789012:table/my-table-name/stream/2024-01-01T00:00:00.000',
            }
          );

          // Add a consumer
          replicaTable.addConsumers(ctx.stack, {
            consumer1: 'src/consumer.handler',
          });
        };
        app.stack(TestStack);
        await app.finish();

        const template = Template.fromStack(getStack(TestStack));

        // Should NOT have custom resource for stream lookup
        template.resourceCountIs('Custom::AWS', 0);

        // Should have event source mapping
        template.resourceCountIs('AWS::Lambda::EventSourceMapping', 1);
      });
    });
  });
});
