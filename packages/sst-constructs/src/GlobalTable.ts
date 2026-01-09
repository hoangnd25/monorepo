import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cr from 'aws-cdk-lib/custom-resources';
import { App, Stack, KinesisStream } from 'sst/constructs';
import {
  Function as Fn,
  FunctionProps,
  FunctionInlineDefinition,
  FunctionDefinition,
} from 'sst/constructs/Function.js';
import { SSTConstruct, getFunctionRef } from 'sst/constructs/Construct.js';
import { BindingResource, BindingProps } from 'sst/constructs/util/binding.js';
import { Permissions } from 'sst/constructs/util/permission.js';
import { removalPolicy } from '@lib/sst-helpers';

/////////////////////
// Interfaces
/////////////////////

type GlobalTableFieldType = Lowercase<keyof typeof dynamodb.AttributeType>;

/**
 * Used to define the consumer for the table stream.
 */
export interface GlobalTableConsumerProps {
  /**
   * Used to create the consumer function for the table.
   */
  function: FunctionDefinition;
  /**
   * Used to filter the records that are passed to the consumer function.
   * @example
   * ```js
   * const table = new GlobalTable(stack, "Table", {
   *   consumers: {
   *     myConsumer: {
   *       function: "src/consumer1.main",
   *       filters: [
   *         {
   *           dynamodb: {
   *             Keys: {
   *               Id: {
   *                 N: ["101"]
   *               }
   *             }
   *           }
   *         }
   *       ]
   *     }
   *   },
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: any[];
  cdk?: {
    /**
     * Override the settings of the internally created event source
     */
    eventSource?: lambdaEventSources.DynamoEventSourceProps;
  };
}

export interface GlobalTableGlobalIndexProps {
  /**
   * The field that's to be used as a partition key for the index.
   */
  partitionKey: string;
  /**
   * The field that's to be used as the sort key for the index.
   */
  sortKey?: string;
  /**
   * The set of attributes that are projected into the secondary index.
   * @default "all"
   */
  projection?:
    | Lowercase<keyof Pick<typeof dynamodb.ProjectionType, 'ALL' | 'KEYS_ONLY'>>
    | string[];
}

export interface GlobalTableLocalIndexProps {
  /**
   * The field that's to be used as the sort key for the index.
   */
  sortKey: string;
  /**
   * The set of attributes that are projected into the secondary index.
   * @default "all"
   */
  projection?:
    | Lowercase<keyof Pick<typeof dynamodb.ProjectionType, 'ALL' | 'KEYS_ONLY'>>
    | string[];
}

export interface GlobalTableReplicaProps {
  /**
   * The AWS region where the replica table will be created.
   */
  region: string;
  /**
   * Whether to enable Point-in-Time Recovery for this replica.
   * @default inherited from primary table
   */
  pointInTimeRecovery?: boolean;
  /**
   * Whether to enable deletion protection for this replica.
   * @default inherited from primary table
   */
  deletionProtection?: boolean;
  /**
   * The table class for this replica.
   * @default inherited from primary table
   */
  tableClass?: dynamodb.TableClass;
}

/**
 * Attributes for importing an existing GlobalTable.
 * Extends CDK's TableAttributesV2 for compatibility.
 */
export type GlobalTableAttributes = dynamodb.TableAttributesV2;

/**
 * Options for importing an existing GlobalTable.
 */
export interface GlobalTableImportOptions {
  /**
   * Whether to automatically look up missing table attributes (like tableStreamArn)
   * using a custom resource that calls DynamoDB describeTable at deploy time.
   *
   * When enabled, you can add stream consumers to an imported table without
   * explicitly providing the tableStreamArn.
   *
   * Note: This creates an AWS custom resource which adds some overhead to deployments.
   *
   * @default false
   */
  autoLookupAttributes?: boolean;
}

export interface GlobalTableProps {
  /**
   * Override the default table name.
   * By default, the table name is prefixed with the app's logical prefix.
   *
   * @example
   * ```js
   * new GlobalTable(stack, "Table", {
   *   tableName: "my-custom-table-name",
   *   fields: {
   *     pk: "string",
   *   },
   *   primaryIndex: { partitionKey: "pk" },
   * });
   * ```
   */
  tableName?: string;
  /**
   * An object defining the fields of the table. Key is the name of the field and the value is the type.
   *
   * @example
   * ```js
   * new GlobalTable(stack, "Table", {
   *   fields: {
   *     pk: "string",
   *     sk: "string",
   *   }
   * })
   * ```
   */
  fields?: Record<string, GlobalTableFieldType>;
  /**
   * Define the primary index for the table.
   */
  primaryIndex?: {
    /**
     * Define the Partition Key for the table's primary index
     *
     * @example
     *
     * ```js
     * new GlobalTable(stack, "Table", {
     *   fields: {
     *     pk: "string",
     *   },
     *   primaryIndex: { partitionKey: "pk" },
     * });
     * ```
     */
    partitionKey: string;
    /**
     * Define the Sort Key for the table's primary index
     *
     * @example
     *
     * ```js
     * new GlobalTable(stack, "Table", {
     *   fields: {
     *     pk: "string",
     *     sk: "string",
     *   },
     *   primaryIndex: { partitionKey: "pk", sortKey: "sk" },
     * });
     * ```
     */
    sortKey?: string;
  };
  /**
   * Configure the table's global secondary indexes
   *
   * @example
   *
   * ```js
   * new GlobalTable(stack, "Table", {
   *   fields: {
   *     pk: "string",
   *     sk: "string",
   *     gsi1pk: "string",
   *     gsi1sk: "string",
   *   },
   *   globalIndexes: {
   *     "GSI1": { partitionKey: "gsi1pk", sortKey: "gsi1sk" },
   *   },
   * });
   * ```
   */
  globalIndexes?: Record<string, GlobalTableGlobalIndexProps>;
  /**
   * Configure the table's local secondary indexes
   *
   * @example
   *
   * ```js
   * new GlobalTable(stack, "Table", {
   *   fields: {
   *     pk: "string",
   *     sk: "string",
   *     lsi1sk: "string",
   *   },
   *   localIndexes: {
   *     "lsi1": { sortKey: "lsi1sk" },
   *   },
   * });
   * ```
   */
  localIndexes?: Record<string, GlobalTableLocalIndexProps>;
  /**
   * The field that's used to store the expiration time for items in the table.
   *
   * @example
   * ```js
   * new GlobalTable(stack, "Table", {
   *   timeToLiveAttribute: "expireAt",
   * });
   * ```
   */
  timeToLiveAttribute?: string;
  /**
   * Configure DynamoDB Streams for the table.
   *
   * @example
   * ```js
   * new GlobalTable(stack, "Table", {
   *   stream: "new_and_old_images",
   * });
   * ```
   */
  stream?: Lowercase<keyof typeof dynamodb.StreamViewType>;
  /**
   * Configure replica tables for global table functionality.
   * Each replica will be created in the specified AWS region.
   *
   * Note: The primary table region is automatically included and should NOT
   * be specified in replicas.
   *
   * @example
   * ```js
   * new GlobalTable(stack, "Table", {
   *   fields: { pk: "string" },
   *   primaryIndex: { partitionKey: "pk" },
   *   replicas: [
   *     { region: "us-east-1" },
   *     { region: "eu-west-1" },
   *   ],
   * });
   * ```
   */
  replicas?: GlobalTableReplicaProps[];
  /**
   * Whether to enable Point-in-Time Recovery for the table.
   * @default true
   */
  pointInTimeRecovery?: boolean;
  /**
   * Whether to enable deletion protection for the table.
   * @default false
   */
  deletionProtection?: boolean;
  /**
   * The table class to use for the table.
   * @default dynamodb.TableClass.STANDARD
   */
  tableClass?: dynamodb.TableClass;
  /**
   * Configure the KinesisStream to capture item-level changes for the table.
   *
   * @example
   *
   * ```js
   * const stream = new KinesisStream(stack, "Stream");
   *
   * new GlobalTable(stack, "Table", {
   *   kinesisStream: stream,
   * });
   * ```
   */
  kinesisStream?: KinesisStream;
  /**
   * Configure DynamoDB stream consumers
   *
   * @example
   *
   * ```js
   * const table = new GlobalTable(stack, "Table", {
   *   consumers: {
   *     consumer1: "src/consumer1.main",
   *     consumer2: "src/consumer2.main",
   *   },
   * });
   * ```
   */
  consumers?: Record<
    string,
    FunctionInlineDefinition | GlobalTableConsumerProps
  >;
  defaults?: {
    /**
     * The default function props to be applied to all the consumers in the Table.
     * The `environment`, `permissions` and `layers` properties will be merged with
     * per route definitions if they are defined.
     *
     * @example
     *
     * ```js
     * new GlobalTable(stack, "Table", {
     *   defaults: {
     *     function: {
     *       timeout: 20,
     *       environment: { topicName: topic.topicName },
     *       permissions: [topic],
     *     }
     *   },
     * });
     * ```
     */
    function?: FunctionProps;
  };
  cdk?: {
    /**
     * Allows you to override default id for this construct.
     */
    id?: string;
    /**
     * Override the settings of the internally created CDK TableV2.
     * Cannot be used with `fields` and `primaryIndex`.
     */
    table?:
      | dynamodb.ITableV2
      | Omit<dynamodb.TablePropsV2, 'partitionKey' | 'sortKey' | 'replicas'>;
  };
}

/////////////////////
// Construct
/////////////////////

/**
 * The `GlobalTable` construct is a higher level CDK construct that makes it easy to create
 * a DynamoDB Global Table using CDK's TableV2.
 *
 * @example
 *
 * ```js
 * import { GlobalTable } from "@lib/sst-constructs";
 *
 * new GlobalTable(stack, "Users", {
 *   fields: {
 *     userId: "string",
 *     email: "string",
 *   },
 *   primaryIndex: { partitionKey: "userId" },
 *   replicas: [
 *     { region: "us-east-1" },
 *     { region: "eu-west-1" },
 *   ],
 * });
 * ```
 */
export class GlobalTable extends Construct implements SSTConstruct {
  public readonly id: string;
  public readonly cdk: {
    /**
     * The internally created CDK `TableV2` instance.
     */
    table: dynamodb.ITableV2;
  };
  private dynamodbTableType?: 'CREATED' | 'IMPORTED';
  private functions: { [consumerName: string]: Fn } = {};
  private bindingForAllConsumers: BindingResource[] = [];
  private permissionsAttachedForAllConsumers: Permissions[] = [];
  private props: GlobalTableProps;
  private fields?: Record<string, GlobalTableFieldType>;
  /**
   * Tracks the attributes provided during import.
   * Used to determine which attributes need to be looked up via custom resource.
   */
  private importedAttributes?: GlobalTableAttributes;

  /**
   * Import an existing table from its name.
   *
   * Use this to import a replica table in a secondary region.
   *
   * @example
   * ```js
   * // In Region B, import the replica created by Region A
   * const table = GlobalTable.fromTableName(stack, "Table", "my-table-name");
   *
   * // With auto-lookup enabled for adding consumers without explicit streamArn
   * const table = GlobalTable.fromTableName(stack, "Table", "my-table-name", {
   *   autoLookupAttributes: true,
   * });
   * ```
   */
  public static fromTableName(
    scope: Construct,
    id: string,
    tableName: string,
    options?: GlobalTableImportOptions
  ): GlobalTable {
    return GlobalTable.fromTableAttributes(scope, id, { tableName }, options);
  }

  /**
   * Import an existing table from its ARN.
   *
   * Use this to import a replica table in a secondary region.
   *
   * @example
   * ```js
   * // In Region B, import the replica created by Region A
   * const table = GlobalTable.fromTableArn(
   *   stack,
   *   "Table",
   *   "arn:aws:dynamodb:us-west-2:123456789012:table/my-table"
   * );
   *
   * // With auto-lookup enabled for adding consumers without explicit streamArn
   * const table = GlobalTable.fromTableArn(
   *   stack,
   *   "Table",
   *   "arn:aws:dynamodb:us-west-2:123456789012:table/my-table",
   *   { autoLookupAttributes: true }
   * );
   * ```
   */
  public static fromTableArn(
    scope: Construct,
    id: string,
    tableArn: string,
    options?: GlobalTableImportOptions
  ): GlobalTable {
    return GlobalTable.fromTableAttributes(scope, id, { tableArn }, options);
  }

  /**
   * Import an existing table from its attributes.
   *
   * Use this to import a replica table in a secondary region with full control
   * over the attributes (e.g., tableStreamArn for consumers, encryptionKey, etc.).
   *
   * @example
   * ```js
   * // Import with explicit stream ARN for adding consumers
   * const table = GlobalTable.fromTableAttributes(stack, "Table", {
   *   tableName: "my-table-name",
   *   tableStreamArn: "arn:aws:dynamodb:...:table/my-table/stream/...",
   * });
   *
   * // Or with auto-lookup enabled (streamArn looked up at deploy time)
   * const table = GlobalTable.fromTableAttributes(
   *   stack,
   *   "Table",
   *   { tableName: "my-table-name" },
   *   { autoLookupAttributes: true }
   * );
   * ```
   */
  public static fromTableAttributes(
    scope: Construct,
    id: string,
    attrs: GlobalTableAttributes,
    options?: GlobalTableImportOptions
  ): GlobalTable {
    const stack = Stack.of(scope) as Stack;
    let finalAttrs = attrs;

    // If autoLookupAttributes is enabled and tableStreamArn is not provided,
    // create a custom resource to look up the stream ARN at deploy time
    if (options?.autoLookupAttributes && !attrs.tableStreamArn) {
      const tableName =
        attrs.tableName ??
        (attrs.tableArn ? attrs.tableArn.split('/').pop() : undefined);

      if (!tableName) {
        throw new Error(
          `Cannot auto-lookup attributes without tableName or tableArn`
        );
      }

      // Create custom resource to call describeTable
      const lookup = new cr.AwsCustomResource(scope, `${id}TableLookup`, {
        onCreate: {
          service: 'DynamoDB',
          action: 'describeTable',
          parameters: { TableName: tableName },
          physicalResourceId: cr.PhysicalResourceId.of(`${id}-table-lookup`),
        },
        onUpdate: {
          service: 'DynamoDB',
          action: 'describeTable',
          parameters: { TableName: tableName },
          physicalResourceId: cr.PhysicalResourceId.of(`${id}-table-lookup`),
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: [
            `arn:aws:dynamodb:${stack.region}:${stack.account}:table/${tableName}`,
          ],
        }),
      });

      // Merge looked-up attributes with provided attributes
      finalAttrs = {
        ...attrs,
        tableName,
        tableStreamArn: lookup.getResponseField('Table.LatestStreamArn'),
      };
    }

    const importedTable = dynamodb.TableV2.fromTableAttributes(
      scope,
      `${id}Import`,
      finalAttrs
    );

    const table = new GlobalTable(scope, id, {
      cdk: {
        table: importedTable,
      },
    });

    // Store the final attributes (including looked-up ones) for later use
    table.importedAttributes = finalAttrs;

    return table;
  }

  constructor(scope: Construct, id: string, props: GlobalTableProps) {
    super(scope, props.cdk?.id || id);

    this.id = id;
    this.props = props;
    const { fields, globalIndexes, localIndexes, kinesisStream } = this.props;
    this.cdk = {} as { table: dynamodb.ITableV2 };
    this.fields = fields;

    // Input Validation
    this.validateFieldsAndIndexes(id, props);

    // Create Table
    this.createTable();

    // Create Secondary Indexes
    if (globalIndexes) this.addGlobalIndexes(globalIndexes);
    if (localIndexes) this.addLocalIndexes(localIndexes);

    // Create Consumers
    if (props.consumers) {
      for (const consumerName in props.consumers) {
        this.addConsumer(this, consumerName, props.consumers[consumerName]);
      }
    }

    // Create Kinesis Stream
    this.buildKinesisStreamSpec(kinesisStream);

    const app = this.node.root as App;
    app.registerTypes(this);
  }

  /**
   * The ARN of the internally created DynamoDB Table.
   */
  public get tableArn(): string {
    return this.cdk.table.tableArn;
  }

  /**
   * The name of the internally created DynamoDB Table.
   */
  public get tableName(): string {
    return this.cdk.table.tableName;
  }

  /**
   * The ARN of the DynamoDB Table stream, if enabled.
   * Returns undefined if stream is not configured.
   */
  public get tableStreamArn(): string | undefined {
    return this.cdk.table.tableStreamArn;
  }

  /**
   * Add additional global secondary indexes where the `key` is the name of the global secondary index
   *
   * @example
   * ```js
   * table.addGlobalIndexes({
   *   gsi1: {
   *     partitionKey: "pk",
   *     sortKey: "sk",
   *   }
   * })
   * ```
   */
  public addGlobalIndexes(
    secondaryIndexes: NonNullable<GlobalTableProps['globalIndexes']>
  ) {
    if (!this.fields)
      throw new Error(
        `Cannot add secondary indexes to "${this.node.id}" GlobalTable without defining "fields"`
      );

    for (const [
      indexName,
      { partitionKey, sortKey, projection },
    ] of Object.entries(secondaryIndexes)) {
      (this.cdk.table as dynamodb.TableV2).addGlobalSecondaryIndex({
        indexName,
        partitionKey: this.buildAttribute(this.fields, partitionKey),
        sortKey: sortKey
          ? this.buildAttribute(this.fields, sortKey)
          : undefined,
        ...this.buildProjection(projection),
      });
    }
  }

  /**
   * Add additional local secondary indexes where the `key` is the name of the local secondary index
   *
   * @example
   * ```js
   * table.addLocalIndexes({
   *   lsi1: {
   *     sortKey: "sk",
   *   }
   * })
   * ```
   */
  public addLocalIndexes(
    secondaryIndexes: NonNullable<GlobalTableProps['localIndexes']>
  ) {
    if (!this.fields)
      throw new Error(
        `Cannot add local secondary indexes to "${this.node.id}" GlobalTable without defining "fields"`
      );

    for (const [indexName, { sortKey, projection }] of Object.entries(
      secondaryIndexes
    )) {
      (this.cdk.table as dynamodb.TableV2).addLocalSecondaryIndex({
        indexName,
        sortKey: this.buildAttribute(this.fields, sortKey),
        ...this.buildProjection(projection),
      });
    }
  }

  /**
   * Define additional consumers for table events
   *
   * @example
   * ```js
   * table.addConsumers(stack, {
   *   consumer1: "src/consumer1.main",
   *   consumer2: "src/consumer2.main",
   * });
   * ```
   */
  public addConsumers(
    scope: Construct,
    consumers: {
      [consumerName: string]:
        | FunctionInlineDefinition
        | GlobalTableConsumerProps;
    }
  ): void {
    Object.keys(consumers).forEach((consumerName: string) => {
      this.addConsumer(scope, consumerName, consumers[consumerName]);
    });
  }

  /**
   * Binds the given list of resources to all consumers of this table.
   *
   * @example
   * ```js
   * table.bind([STRIPE_KEY, bucket]);
   * ```
   */
  public bindToAllConsumers(constructs: BindingResource[]) {
    Object.values(this.functions).forEach((fn) => fn.bind(constructs));
    this.bindingForAllConsumers.push(...constructs);
  }

  /**
   * Binds the given list of resources to a specific consumer of this table.
   *
   * @example
   * ```js
   * table.bindToConsumer("consumer1", [STRIPE_KEY, bucket]);
   * ```
   */
  public bindToConsumer(
    consumerName: string,
    constructs: BindingResource[]
  ): void {
    if (!this.functions[consumerName]) {
      throw new Error(
        `The "${consumerName}" consumer was not found in the "${this.node.id}" GlobalTable.`
      );
    }

    this.functions[consumerName].bind(constructs);
  }

  /**
   * Grant permissions to all consumers of this table.
   *
   * @example
   * ```js
   * table.attachPermissions(["s3"]);
   * ```
   */
  public attachPermissions(permissions: Permissions) {
    Object.values(this.functions).forEach((fn) =>
      fn.attachPermissions(permissions)
    );
    this.permissionsAttachedForAllConsumers.push(permissions);
  }

  /**
   * Grant permissions to a specific consumer of this table.
   *
   * @example
   * ```js
   * table.attachPermissionsToConsumer("consumer1", ["s3"]);
   * ```
   */
  public attachPermissionsToConsumer(
    consumerName: string,
    permissions: Permissions
  ): void {
    if (!this.functions[consumerName]) {
      throw new Error(
        `The "${consumerName}" consumer was not found in the "${this.node.id}" GlobalTable.`
      );
    }

    this.functions[consumerName].attachPermissions(permissions);
  }

  /**
   * Get the instance of the internally created Function, for a given consumer.
   *
   * @example
   * ```js
   *  const table = new GlobalTable(stack, "Table", {
   *    consumers: {
   *      consumer1: "./src/function.handler",
   *    }
   *  })
   * table.getFunction("consumer1");
   * ```
   */
  public getFunction(consumerName: string): Fn | undefined {
    return this.functions[consumerName];
  }

  /**
   * Add a replica table in the specified region.
   *
   * @example
   * ```js
   * table.addReplica({ region: "eu-west-1" });
   * ```
   */
  public addReplica(props: GlobalTableReplicaProps): void {
    if (this.dynamodbTableType === 'IMPORTED') {
      throw new Error(
        `Cannot add replicas to imported GlobalTable "${this.node.id}"`
      );
    }

    (this.cdk.table as dynamodb.TableV2).addReplica({
      region: props.region,
      pointInTimeRecoverySpecification:
        props.pointInTimeRecovery !== undefined
          ? { pointInTimeRecoveryEnabled: props.pointInTimeRecovery }
          : undefined,
      deletionProtection: props.deletionProtection,
      tableClass: props.tableClass,
    });
  }

  /**
   * Get a reference to a replica table in the specified region.
   *
   * @example
   * ```js
   * const euReplica = table.replica("eu-west-1");
   * ```
   */
  public replica(region: string): dynamodb.ITableV2 {
    return (this.cdk.table as dynamodb.TableV2).replica(region);
  }

  /** @internal */
  public getConstructMetadata() {
    return {
      type: 'GlobalTable' as const,
      data: {
        tableName: this.cdk.table.tableName,
        consumers: Object.entries(this.functions).map(([name, fun]) => ({
          name,
          fn: getFunctionRef(fun),
        })),
      },
    };
  }

  /** @internal */
  public getBindings(): BindingProps {
    return {
      clientPackage: 'config',
      variables: {
        tableName: {
          type: 'plain',
          value: this.tableName,
        },
      },
      permissions: {
        'dynamodb:*': [this.tableArn, `${this.tableArn}/*`],
      },
    };
  }

  private createTable() {
    const {
      fields,
      primaryIndex,
      stream,
      timeToLiveAttribute,
      replicas,
      pointInTimeRecovery,
      deletionProtection,
      tableClass,
      cdk,
    } = this.props;
    const app = this.node.root as App;
    const stack = Stack.of(this) as Stack;
    const id = this.node.id;

    if (this.isCDKConstruct(cdk?.table)) {
      // Validate "fields" is not configured
      if (fields !== undefined) {
        throw new Error(
          `Cannot configure the "fields" when "cdk.table" is a construct in the "${id}" GlobalTable`
        );
      }

      // Validate "stream" is not configured
      if (stream !== undefined) {
        throw new Error(
          `Cannot configure the "stream" when "cdk.table" is a construct in the "${id}" GlobalTable`
        );
      }

      // Validate "replicas" is not configured
      if (replicas !== undefined) {
        throw new Error(
          `Cannot configure the "replicas" when "cdk.table" is a construct in the "${id}" GlobalTable`
        );
      }

      this.dynamodbTableType = 'IMPORTED';
      this.cdk.table = cdk.table;
    } else {
      const dynamodbTableProps = (cdk?.table || {}) as Omit<
        dynamodb.TablePropsV2,
        'partitionKey' | 'sortKey' | 'replicas'
      >;

      // Validate "fields" is configured
      if (fields === undefined) {
        throw new Error(`Missing "fields" in the "${id}" GlobalTable`);
      }

      // Build replica configurations
      const replicaConfigs: dynamodb.ReplicaTableProps[] | undefined =
        replicas?.map((replica) => ({
          region: replica.region,
          pointInTimeRecoverySpecification:
            replica.pointInTimeRecovery !== undefined
              ? { pointInTimeRecoveryEnabled: replica.pointInTimeRecovery }
              : undefined,
          deletionProtection: replica.deletionProtection,
          tableClass: replica.tableClass,
        }));

      this.dynamodbTableType = 'CREATED';
      this.cdk.table = new dynamodb.TableV2(this, 'Table', {
        ...dynamodbTableProps,
        tableName: this.props.tableName ?? app.logicalPrefixedName(id),
        partitionKey: this.buildAttribute(fields, primaryIndex!.partitionKey),
        sortKey: primaryIndex?.sortKey
          ? this.buildAttribute(fields, primaryIndex.sortKey)
          : undefined,
        billing: dynamodbTableProps.billing ?? dynamodb.Billing.onDemand(),
        dynamoStream: this.buildStreamConfig(stream),
        timeToLiveAttribute,
        pointInTimeRecoverySpecification: {
          pointInTimeRecoveryEnabled: pointInTimeRecovery ?? true,
        },
        deletionProtection,
        tableClass,
        removalPolicy: removalPolicy.retainForPermanentStage({ app, stack }),
        replicas: replicaConfigs,
      });
    }
  }

  private buildAttribute(
    fields: Record<string, GlobalTableFieldType>,
    name: string
  ): dynamodb.Attribute {
    // Ensure the key is specified in "fields"
    if (!fields[name]) {
      throw new Error(
        `Please define "${name}" in "fields" to create the index in the "${this.node.id}" GlobalTable.`
      );
    }

    return {
      name,
      type: dynamodb.AttributeType[
        fields[name].toUpperCase() as keyof typeof dynamodb.AttributeType
      ],
    };
  }

  private buildStreamConfig(
    stream?: Lowercase<keyof typeof dynamodb.StreamViewType>
  ): dynamodb.StreamViewType | undefined {
    if (!stream) {
      return undefined;
    }

    return dynamodb.StreamViewType[
      stream.toUpperCase() as keyof typeof dynamodb.StreamViewType
    ];
  }

  private buildProjection(
    projection?:
      | Lowercase<
          keyof Pick<typeof dynamodb.ProjectionType, 'ALL' | 'KEYS_ONLY'>
        >
      | string[]
  ): { projectionType?: dynamodb.ProjectionType; nonKeyAttributes?: string[] } {
    if (!projection) {
      return {};
    }

    if (Array.isArray(projection)) {
      return {
        projectionType: dynamodb.ProjectionType.INCLUDE,
        nonKeyAttributes: projection,
      };
    }

    return {
      projectionType:
        dynamodb.ProjectionType[
          projection.toUpperCase() as keyof typeof dynamodb.ProjectionType
        ],
    };
  }

  private validateFieldsAndIndexes(id: string, props: GlobalTableProps): void {
    const { fields, primaryIndex } = props;

    // Validate "fields"
    if (fields && Object.keys(fields).length === 0) {
      throw new Error(`No fields defined for the "${id}" GlobalTable`);
    }

    // Validate "primaryIndex"
    if (primaryIndex && !primaryIndex.partitionKey) {
      throw new Error(
        `Missing "partitionKey" in primary index for the "${id}" GlobalTable`
      );
    }

    // Validate "fields" and "primaryIndex" co-exists
    if (fields) {
      if (!primaryIndex) {
        throw new Error(`Missing "primaryIndex" in "${id}" GlobalTable`);
      }
    } else if (!this.isCDKConstruct(props.cdk?.table)) {
      if (primaryIndex) {
        throw new Error(
          `Cannot configure the "primaryIndex" without setting the "fields" in "${id}" GlobalTable`
        );
      }
    }
  }

  private addConsumer(
    scope: Construct,
    consumerName: string,
    consumer: FunctionInlineDefinition | GlobalTableConsumerProps
  ): Fn {
    // validate stream enabled
    // note: if table is imported, we skip the check because we want to allow ppl to
    //       import without specifying the "tableStreamArn". And let them add
    //       consumers to it.
    // note: we check this.props.stream instead of tableStreamArn because in SST dev
    //       mode, tableStreamArn can return a synthetic value even when no stream
    //       is configured.
    if (this.dynamodbTableType === 'CREATED' && !this.props.stream) {
      throw new Error(
        `Please enable the "stream" option to add consumers to the "${this.node.id}" GlobalTable.`
      );
    }

    // For imported tables, verify stream ARN is available
    // (either provided explicitly or looked up via autoLookupAttributes)
    if (
      this.dynamodbTableType === 'IMPORTED' &&
      !this.importedAttributes?.tableStreamArn
    ) {
      throw new Error(
        `Cannot add consumers to imported GlobalTable "${this.node.id}" without a tableStreamArn. ` +
          `Either provide tableStreamArn when importing, or enable autoLookupAttributes: ` +
          `GlobalTable.fromTableName(scope, id, name, { autoLookupAttributes: true })`
      );
    }

    // parse consumer
    let consumerFunction, eventSourceProps, filters;
    if ((consumer as GlobalTableConsumerProps).function) {
      consumer = consumer as GlobalTableConsumerProps;
      consumerFunction = consumer.function;
      eventSourceProps = consumer.cdk?.eventSource;
      filters = consumer.filters;
    } else {
      consumerFunction = consumer as FunctionInlineDefinition;
    }

    // create function
    const fn = Fn.fromDefinition(
      scope,
      `Consumer_${this.node.id}_${consumerName}`,
      consumerFunction,
      this.props.defaults?.function,
      `The "defaults.function" cannot be applied if an instance of a Function construct is passed in. Make sure to define all the consumers using FunctionProps, so the GlobalTable construct can apply the "defaults.function" to them.`
    );
    this.functions[consumerName] = fn;

    // create event source
    fn.addEventSource(
      new lambdaEventSources.DynamoEventSource(
        this.cdk.table as dynamodb.TableV2,
        {
          startingPosition: lambda.StartingPosition.LATEST,
          filters: filters?.map((filter) => ({
            pattern: JSON.stringify(filter),
          })),
          ...(eventSourceProps || {}),
        }
      )
    );

    // attach permissions
    this.permissionsAttachedForAllConsumers.forEach((permissions) => {
      fn.attachPermissions(permissions);
    });
    fn.bind(this.bindingForAllConsumers);

    return fn;
  }

  private buildKinesisStreamSpec(kinesisStream?: KinesisStream): void {
    if (!kinesisStream) {
      return;
    }

    // Cannot configure Kinesis stream on imported tables
    if (this.dynamodbTableType === 'IMPORTED') {
      throw new Error(
        `Cannot configure "kinesisStream" on imported GlobalTable "${this.node.id}". ` +
          `Kinesis stream must be configured on the primary table in its source region.`
      );
    }

    const cfTable = this.cdk.table.node.defaultChild as dynamodb.CfnGlobalTable;
    cfTable.addPropertyOverride(
      'StreamSpecification.StreamViewType',
      'NEW_AND_OLD_IMAGES'
    );

    // For GlobalTable (TableV2), Kinesis stream is configured per replica
    // We need to add it to the primary replica
    const replicas = cfTable.replicas;
    if (replicas && Array.isArray(replicas) && replicas.length > 0) {
      // Add Kinesis stream to the first replica (primary)
      cfTable.addPropertyOverride(
        'Replicas.0.KinesisStreamSpecification.StreamArn',
        kinesisStream.streamArn
      );
    }
  }

  private isCDKConstruct(
    table:
      | dynamodb.ITableV2
      | Omit<dynamodb.TablePropsV2, 'partitionKey' | 'sortKey' | 'replicas'>
      | undefined
  ): table is dynamodb.ITableV2 {
    return table !== undefined && 'tableArn' in table;
  }
}
