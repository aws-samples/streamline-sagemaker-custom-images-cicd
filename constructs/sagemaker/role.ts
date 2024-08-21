import {
  CompositePrincipal,
  ManagedPolicy,
  PolicyDocument,
  Role,
  ServicePrincipal,
  PolicyStatement,
  Effect
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import userExecutionPolicy from "../../policies/iam/userExecutionPolicy.json";
import userExecutionSagemakerPolicy from "../../policies/iam/userExecutionPolicySagemaker.json";
import batchEc2Policy from "../../policies/iam/batchEc2Policy.json";
import ecrSagemakerPolicy from "../../policies/iam/smstudioEcrPolicy.json";

export interface SagemakerRoleProps {
  readonly accountId: string;
  readonly region: string;
  readonly roleName: string;
  readonly defaultDomainPolicyLocation?: string
  /**
   * allowedInstanceTypes for selecting in Jupyter Lab instance type while creating Jupyter Lab space
   * If user selects any instance type other than the allowed instance types, it will throw an error
   * Optional setting
   * @default - null
   */
  allowedInstanceTypes?: string[]
}

export class SagemakerRole extends Construct {
  readonly role: Role;
  readonly userExecutionRolePolicy: ManagedPolicy;
  readonly userExecutionSagemakerRolePolicy: ManagedPolicy;
  readonly batchPolicy: ManagedPolicy;
  readonly ecrSmPolicy: ManagedPolicy;
  readonly jupyterLabPolicy: ManagedPolicy;

  constructor(scope: Construct, id: string, props: SagemakerRoleProps) {
    super(scope, id);

    if (props.defaultDomainPolicyLocation && existsSync(props.defaultDomainPolicyLocation)) {
      let policyPath = props.defaultDomainPolicyLocation;
      let policyString: string = readFileSync(props.defaultDomainPolicyLocation, "utf-8");
      const defaultDomainPolicyJson = JSON.parse(JSON.stringify(policyString)
        .replaceAll("${accountId}", props.accountId)
        .replaceAll("${region}", props.region));
      const defaultDomainPolicy: ManagedPolicy = new ManagedPolicy(
        this,
        "SagemakerDomainExecutionPolicy",
        {
          managedPolicyName: `${props.roleName}-policy`,
          description: `Domain Specific SageMaker execution policy for ${props.roleName} user`,
          document: PolicyDocument.fromJson(JSON.parse(defaultDomainPolicyJson)),
        }
      );

      if(props.allowedInstanceTypes)
        defaultDomainPolicy.addStatements(this.getAllowedInstancesPolicyStatement(props.allowedInstanceTypes));

      this.role = new Role(this, "SagemakerUserExecutionRole", {
        roleName: `${props.roleName}`,
        description: `SageMaker execution role for default users`,
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("sagemaker.amazonaws.com"),
          new ServicePrincipal("lambda.amazonaws.com"),
          new ServicePrincipal("codebuild.amazonaws.com"),
          new ServicePrincipal("osis-pipelines.amazonaws.com")
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
          defaultDomainPolicy     
        ],
      });

    }
    else {
      // set policy
      // The policy mostly clones the AmazonSageMakerFullAccess and
      // AmazonSageMakerCanvasFullAccess policies, removing any redundancies
      // We split the policy into 3 due to character limits
      const hydratedUserExecutionPolicy = JSON.parse(
        JSON.stringify(userExecutionPolicy)
          .replaceAll("${accountId}", props.accountId)
          .replaceAll("${region}", props.region)
      );
      const userExecutionRolePolicy: ManagedPolicy = new ManagedPolicy(
        this,
        "SagemakerUserExecutionPolicy",
        {
          managedPolicyName: `${props.roleName}-policy`,
          description: `SageMaker execution policy for ${props.roleName} user`,
          document: PolicyDocument.fromJson(hydratedUserExecutionPolicy),
        }
      );
      this.userExecutionRolePolicy = userExecutionRolePolicy;

      const hydrateduserExecutionSagemakerPolicy = JSON.parse(
        JSON.stringify(userExecutionSagemakerPolicy)
          .replaceAll("${accountId}", props.accountId)
          .replaceAll("${region}", props.region)
      );
      const userExecutionSagemakerRolePolicy: ManagedPolicy = new ManagedPolicy(
        this,
        "SagemakeruserExecutionSagemakerPolicy",
        {
          managedPolicyName: `${props.roleName}-sagemaker-policy`,
          description: `SageMaker execution policy for ${props.roleName} user`,
          document: PolicyDocument.fromJson(hydrateduserExecutionSagemakerPolicy),
        }
      );
      if(props.allowedInstanceTypes)
        userExecutionSagemakerRolePolicy.addStatements(this.getAllowedInstancesPolicyStatement(props.allowedInstanceTypes));

      this.userExecutionSagemakerRolePolicy = userExecutionSagemakerRolePolicy;
      const hydrateduserBatchPolicy = JSON.parse(
        JSON.stringify(batchEc2Policy)
          .replaceAll("${accountId}", props.accountId)
          .replaceAll("${region}", props.region)
      );
      const batchPolicy: ManagedPolicy = new ManagedPolicy(
        this,
        "SagemakerUserExecutionBatchPolicy",
        {
          managedPolicyName: `${props.roleName}-batch-policy`,
          description: `SageMaker execution policy for ${props.roleName} user`,
          document: PolicyDocument.fromJson(hydrateduserBatchPolicy),
        }
      );
      this.batchPolicy = batchPolicy;

      const hydratedEcrSagemakerPolicy = JSON.parse(
        JSON.stringify(ecrSagemakerPolicy)
          .replaceAll("${accountId}", props.accountId)
          .replaceAll("${region}", props.region)
      );
      const ecrSmPolicy: ManagedPolicy = new ManagedPolicy(
        this,
        "ecrSagemakerPolicy",
        {
          managedPolicyName: `${props.roleName}-ecr-smstudio-policy`,
          description: `SageMaker execution policy for ${props.roleName} user`,
          document: PolicyDocument.fromJson(hydratedEcrSagemakerPolicy),
        }
      );
      this.ecrSmPolicy = ecrSmPolicy;

      // create role
      this.role = new Role(this, "SagemakerUserExecutionRole", {
        roleName: `${props.roleName}`,
        description: `SageMaker execution role for default users`,
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("sagemaker.amazonaws.com"),
          new ServicePrincipal("lambda.amazonaws.com"),
          new ServicePrincipal("codebuild.amazonaws.com"),
          new ServicePrincipal("osis-pipelines.amazonaws.com")
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
          userExecutionRolePolicy,
          userExecutionSagemakerRolePolicy,
          batchPolicy,
          ecrSmPolicy
        ],
      });
    }

  }

  //create allowed instances policy statement with allowed instance types input
  getAllowedInstancesPolicyStatement(allowedInstanceTypes: string[]): PolicyStatement {
     const allowedInstanceStatement = new PolicyStatement({
      "effect": Effect.DENY,
      "actions": [
        "sagemaker:CreateApp",
        "sagemaker:UpdateSpace"
      ],
      "resources": ["*"],
      "conditions": {
        "ForAllValues:StringNotLike": {
          "sagemaker:InstanceTypes": allowedInstanceTypes
        }
      }
    });
    return allowedInstanceStatement;
  }
}
