import { Construct } from "constructs";
import {
  Effect,
  Role,
  PolicyDocument,
  PolicyStatement,
  ManagedPolicy,
  AccountRootPrincipal,
} from "aws-cdk-lib/aws-iam";
import { Key, Alias, IAlias } from "aws-cdk-lib/aws-kms";
import { RemovalPolicy } from "aws-cdk-lib";
import defaultKeyPolicy from "../../policies/kms/defaultKeyPolicy.json";
import defaultKeyUserPolicy from "../../policies/kms/defaultKeyUser.json";
import defaultKeyServicePolicy from "../../policies/kms/defaultKeyServicePolicy.json";
import defaultKeyServiceUserPolicy from "../../policies/kms/defaultKeyServiceUserPolicy.json";

import CONFIG from "../../lib/config";

export interface KmsKeyProps {
  readonly keyName?: string;
  readonly description?: string;
  readonly kmsPolicy?: any;
  readonly accountId: string;
  readonly region: string;
  readonly removalPolicy?: RemovalPolicy;
  readonly trustAccountIdentities?: boolean;
  readonly keyAdmins?: string[];
  readonly keyUsers?: string[];
  readonly keyServices?: string[];
}

export class KmsKey extends Construct {
  // make Key instead of IKey available, as IKey does not include all grant*
  // methods that lets us work around circular dependencies and add access to
  // the key later
  readonly key: Key;
  readonly keyName: string;
  readonly #trustAccountIdentities?: boolean;
  private readonly accountId: string;
  private readonly region: string;

  constructor(scope: Construct, id: string, props: KmsKeyProps) {
    super(scope, id);

    this.accountId = props.accountId;
    this.region = props.region;

    let keyPolicy: any | undefined = props.kmsPolicy;
    if (!keyPolicy) keyPolicy = defaultKeyPolicy;

    // Create KMS key
    const services: string[] = props.keyServices || [];
    const rootArn: string = `arn:aws:iam::${props.accountId}:root`;
    let keyAdmins: string[] = CONFIG.defaultKeyAdmins || [rootArn];

    if (props.keyAdmins) keyAdmins = [...keyAdmins, ...props.keyAdmins];
    if (props.trustAccountIdentities !== false && !keyAdmins.includes(rootArn))
      keyAdmins.push(rootArn);

    if (keyAdmins.length > 0 && services.length > 0)
      keyPolicy.Statement = [
        ...keyPolicy.Statement,
        ...defaultKeyServiceUserPolicy,
      ];
    else if (services.length > 0 && services.join('","') !== '[[""]]')
      // 2nd part of condition is to work around services array containing empty strings
      keyPolicy.Statement = [
        ...keyPolicy.Statement,
        ...defaultKeyServicePolicy,
      ];
    else
      keyPolicy.Statement = [...keyPolicy.Statement, ...defaultKeyUserPolicy];

    const hydratedKmsPolicy = JSON.parse(
      JSON.stringify(keyPolicy)
        .replaceAll("${keyAdmins}", keyAdmins.join('", "'))
        .replaceAll("${accountId}", props.accountId)
        .replaceAll("${region}", props.region)
        .replaceAll("${roleArn}", rootArn)
        .replaceAll("${roleName}", CONFIG.pipelineRoleName)
        .replaceAll('"${service}"', `["${services.join('","')}"]`)
        .replaceAll(',"Service":[[""]]', "")
    );
    const kmsKey: Key = new Key(this, "KmsKey", {
      description: props.description,
      enabled: true,
      enableKeyRotation: true,
      policy: PolicyDocument.fromJson(hydratedKmsPolicy),
      removalPolicy: props.removalPolicy || RemovalPolicy.RETAIN,
    });

    let kmsAlias: IAlias;
    if (props.keyName) {
      kmsAlias = new Alias(this, "KmsKeyAlias", {
        aliasName: props.keyName,
        targetKey: kmsKey,
      });
      this.keyName = props.keyName;
    }

    this.key = kmsKey;
    this.#trustAccountIdentities = props.trustAccountIdentities;
  }

  public grantIamAccess(
    iamEntity: Role | ManagedPolicy,
    scope?: Construct
  ): void {
    let useStatement: PolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncryptFrom",
        "kms:ReEncryptTo",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
      ],
      resources: [this.key.keyArn],
    });
    let attachStatement: PolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["kms:CreateGrant", "kms:ListGrants", "kms:RevokeGrant"],
      resources: [this.key.keyArn],
      conditions: { Bool: { "kms:GrantIsForAWSResource": true } },
    });

    if (iamEntity instanceof Role) {
      const role: Role = <Role>iamEntity;
      if (scope) {
        const kmsPolicy: ManagedPolicy = new ManagedPolicy(
          scope,
          "KmsAccessPolicy",
          {
            description: `Grants KMS access to specific key`,
            statements: [useStatement, attachStatement],
          }
        );
        kmsPolicy.attachToRole(role);
      } else {
        role.addToPolicy(useStatement);
        role.addToPolicy(attachStatement);
      }

      this.addToKeyPolicy(role);
    } else {
      const policy: ManagedPolicy = <ManagedPolicy>iamEntity;
      policy.addStatements(useStatement);
      policy.addStatements(attachStatement);
    }
  }

  public addToKeyPolicy(role: Role): void {
    let useStatement: any = {
      effect: Effect.ALLOW,
      actions: [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncryptFrom",
        "kms:ReEncryptTo",
        "kms:GenerateDataKey*",
        "kms:DescribeKey",
      ],
      resources: ["*"],
      principals: [role],
    };
    let attachStatement: any = {
      effect: Effect.ALLOW,
      actions: ["kms:CreateGrant", "kms:ListGrants", "kms:RevokeGrant"],
      resources: ["*"],
      conditions: { Bool: { "kms:GrantIsForAWSResource": true } },
      principals: [role],
    };

    if (this.#trustAccountIdentities !== false) {
      useStatement.principals.push(new AccountRootPrincipal());
      attachStatement.principals.push(new AccountRootPrincipal());
    }

    this.key.addToResourcePolicy(new PolicyStatement(useStatement));
    this.key.addToResourcePolicy(new PolicyStatement(attachStatement));
  }
}
export interface grantEncryptDecryptCustomResourceProps {
  scope: Construct;
  id: string;
  roleArn: string;
  keyId: string;
  accountId: string;
  region: string;
  /**
   * customResourceFnArn - Pass ARN for custom function so that
   * it can generate custom resource successfully
   *
   */
  readonly customResourceFnArn: string;
}
