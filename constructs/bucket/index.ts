import { Construct } from "constructs";
import {
  Bucket,
  IBucket,
  BlockPublicAccess,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { RemovalPolicy, Tags } from "aws-cdk-lib";
import { KmsKey } from "../kms";
import defaultKeyPolicy from "../../policies/kms/defaultKeyPolicy.json";
import defaultBucketPolicy from "../../policies/bucket/defaultBucketPolicy.json";
import { StringParameter, ParameterTier } from "aws-cdk-lib/aws-ssm";

export interface PlatformBucketProps {
  readonly bucketName: string;
  readonly bucketPolicy?: any;
  readonly RemovalPolicy?: RemovalPolicy;
  readonly autoDeleteObjects?: boolean;
  readonly accountId: string;
  readonly region: string;
  readonly keyPolicy?: any;
  readonly keyAdmins?: string[];
  readonly keyUsers?: string[];
  readonly keyServices?: string[];
  readonly kmsKey?: KmsKey;
  readonly policyStatements?: any[];
  readonly cors?: any;
}

export class PlatformBucket extends Construct {
  readonly bucket: IBucket;
  readonly bucketKey: KmsKey;
  readonly bucketName: string;
  readonly #accountId: string;
  readonly #region: string;

  constructor(scope: Construct, id: string, props: PlatformBucketProps) {
    super(scope, id);

    let bucketPolicy: any = props.bucketPolicy || defaultBucketPolicy;

    const removalPolicy: RemovalPolicy =
      props.RemovalPolicy || RemovalPolicy.RETAIN;
    const autoDelete: boolean =
      props.autoDeleteObjects !== undefined
        ? props.autoDeleteObjects
        : props.RemovalPolicy === RemovalPolicy.DESTROY
        ? true
        : false;

    const keyPolicy: any = props.keyPolicy || defaultKeyPolicy;

    const kmsKey =
      props.kmsKey ||
      new KmsKey(this, "BucketKey", {
        description: `KMS key for s3 bucket ${props.bucketName}`,
        accountId: props.accountId,
        region: props.region,
        kmsPolicy: keyPolicy,
        keyName: `${props.bucketName}-key`,
        keyAdmins: props.keyAdmins,
        keyUsers: props.keyUsers,
        keyServices: props.keyServices,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    const bucketKeyIdSSMParam = new StringParameter(
      this,
      `${props.bucketName}-kms-key-id`,
      {
        allowedPattern: ".*",
        description: `KMS key id of bucket - ${props.bucketName}`,
        parameterName: `/research/platform/dev/infra/${props.bucketName}`,
        stringValue: kmsKey.key.keyId,
        tier: ParameterTier.STANDARD,
      }
    );

    const bucket: IBucket = new Bucket(this, "S3Bucket", {
      bucketName: props.bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: autoDelete,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: BucketEncryption.KMS,
      encryptionKey: kmsKey.key,
      enforceSSL: true,
      cors: props.cors || [],
    });
    const hydratedBucketPolicy = JSON.parse(
      JSON.stringify(bucketPolicy).replaceAll(
        "${bucketArn}",
        `arn:aws:s3:::${props.bucketName}`
      )
    );
    for (let i = 0; i < hydratedBucketPolicy.Statement.length; i++)
      bucket.addToResourcePolicy(
        PolicyStatement.fromJson(hydratedBucketPolicy.Statement[i])
      );
    const additionalStatements: any[] = props.policyStatements || [];
    for (let i = 0; i < additionalStatements.length; i++)
      bucket.addToResourcePolicy(
        PolicyStatement.fromJson(additionalStatements[i])
      );

    this.bucket = bucket;
    this.bucketKey = kmsKey;
    this.bucketName = props.bucketName;
    this.#accountId = props.accountId;
    this.#region = props.region;
  }

  public grantReadAccess(iamEntity: Role | ManagedPolicy): void {
    const statement: PolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:GetBucketCORS",
        "s3:ListBucket",
        "s3:GetBucketAcl",
        "s3:GetBucketLocation",
      ],
      resources: [
        // constructing arn helps prevent circular dependencies
        `arn:aws:s3:::${this.bucketName}`,
        `arn:aws:s3:::${this.bucketName}/*`,
      ],
    });

    this.grantAccess(iamEntity, statement);
  }

  public grantWriteAccess(iamEntity: Role | ManagedPolicy): void {
    const statement: PolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:PutBucketCORS",
        "s3:DeleteObject",
        "s3:PutObjectAcl",
      ],
      resources: [
        // constructing arn helps prevent circular dependencies
        `arn:aws:s3:::${this.bucketName}/*`,
      ],
    });

    this.grantAccess(iamEntity, statement);
  }

  public grantReadWriteAccess(
    iamEntity: Role | ManagedPolicy,
    scope?: Construct
  ): void {
    const statement: PolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:AbortMultipartUpload",
        "s3:GetBucketCORS",
        "s3:ListBucket",
        "s3:PutBucketCORS",
        "s3:DeleteObject",
        "s3:GetBucketAcl",
        "s3:GetBucketLocation",
        "s3:PutObjectAcl",
      ],
      resources: [
        // constructing arn helps prevent circular dependencies
        `arn:aws:s3:::${this.bucketName}`,
        `arn:aws:s3:::${this.bucketName}/*`,
      ],
    });

    this.grantAccess(iamEntity, statement, scope);
  }

  public grantAccess(
    iamEntity: Role | ManagedPolicy,
    statement: PolicyStatement,
    scope?: Construct
  ): void {
    if (iamEntity instanceof Role) {
      const role: Role = <Role>iamEntity;
      if (scope) {
        // const id: string = `${this.bucketName}${role.roleName}S3AccessPolicy`.replace("-", "").replace("_", "");
        const s3Policy: ManagedPolicy = new ManagedPolicy(
          scope,
          "S3AccessPolicy",
          {
            description: `Grants access to ${this.bucketName} S3 bucket`,
            statements: [statement],
          }
        );
        s3Policy.attachToRole(role);
      } else {
        role.addToPolicy(statement);
      }
    } else {
      const policy: ManagedPolicy = <ManagedPolicy>iamEntity;
      policy.addStatements(statement);
    }
  }
}
