import { BuildEnvironmentVariable } from "aws-cdk-lib/aws-codebuild";
import { readFileSync } from "fs";
import { Port, Peer } from "aws-cdk-lib/aws-ec2";

/* 
    Import and rexport json file with a defined interface so that typescript can
    understand and enforce the properties.

    The exported default CONFIG will reflect the config for the deployed
    environment.
*/

export interface IImageConfig {
  /**
   * The name of the the ECR repository to pull images from. Must be in same
   * account and region as domains.
   */
  repositoryName: string;

  /**
   * List of tags form specified repo. Must include latest explicitly. The
   * FIRST item in the list will be the default. All subsequent images will be
   * selectable when running a new notebook.
   *
   * If no tags are provided, no images are made available or set as default.
   */
  tags: string[];
}

export interface IAppImageConfig {
  /**
   * Mountpath of default efs mapping in the kernel image
   */
  mountPath: string;

  /**
   * defaultGid for image runtime
   */
  defaultGid: number;

  /**
   * defaultUid for image runtime
   */
  defaultUid: number;
}

export interface IAppImageConfig {
  /**
   * Mountpath of default efs mapping in the kernel image
   */
  mountPath: string;

  /**
   * defaultGid for image runtime
   */
  defaultGid: number;

  /**
   * defaultUid for image runtime
   */
  defaultUid: number;
}

export interface IVpcConfig {
  /**
   * The VPC ID of an existing VPC to use for building dependent infrastructure.
   * If this parameter is provided, the following parameters are ignored:
   *   - vpcCIDR
   *   - subnetSize
   *   - privateSubnets
   *   - publicSubnets
   *   - publicSubnetIDs
   *   - privateSubnetIDs
   *   - isolatedSubnetIDs
   *
   * @default - a new VPC is created
   */
  vpcIdSsmParam?: string;

  /**
   * The CIDR range for the created VPC.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 10.0.0.0/16
   */
  vpcCIDR?: string;

  /**
   * The subnet size for the subnets created in the VPC. Note that no checks
   * are made in the code if the size is valid. Must be a valid range that
   * fits within the CIDR range for the VPC.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 24 (as in /24 CIDR)
   */
  subnetSize?: number;

  /**
   * Number of private subnets to create.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 2
   */
  privateSubnets?: number;

  /**
   * Number of public subnets to create.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 2
   */
  publicSubnets?: number;

  /**
   * Specific public subnet IDs to include in the created Vpc instance. This is
   * only really neded when importing and existing VPC. Unfortunately the CDK
   * is not good at importing additional related values such as these when
   * importing existing resources, so it's strongly recommended to provide this
   * value when using an existing VPC.
   *
   * This property is ignored if vpcId is NOT provided.
   *
   * @default - Empty list
   */
  publicSubnetIDs?: string[];

  /**
   * Specific private subnet IDs to include in the created Vpc instance. This is
   * only really neded when importing and existing VPC. Unfortunately the CDK
   * is not good at importing additional related values such as these when
   * importing existing resources, so it's strongly recommended to provide this
   * value when using an existing VPC.
   *
   * This property is ignored if vpcId is NOT provided.
   *
   * @default - Empty list
   */
  privateSubnetIDs?: string[];

  /**
   * Specific isolated subnet IDs to include in the created Vpc instance. This is
   * only really neded when importing and existing VPC. Unfortunately the CDK
   * is not good at importing additional related values such as these when
   * importing existing resources, so it's strongly recommended to provide this
   * value when using an existing VPC.
   *
   * This property is ignored if vpcId is NOT provided.
   *
   * @default - Empty list
   */
  isolatedSubnetIDs?: string[];

  /**
   * The number of availability zones to create for each subnet.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 1
   */
  maxAzs?: number;

  /**
   * List of VPC endpoints to create under the VPC. This property can be set
   * regardless of whether or not vpcId is provided, re: regardless of whether
   * or not an existing VPC is used or a VPC is created.
   *
   * @default - No endpoints are created
   */
  endpoints?: IVpcEndpointConfig[];
}

export interface IVpcEndpointSecurityGroupRule {
  /**
   * The port number to allow traffic for. For all ports, set this value to -1.
   *
   * @default - All ports
   */
  port?: number;

  /**
   * The traffic type to allow traffic for. Valid values are TCP | UDP | ALL.
   *
   * @default - ALL
   */
  type?: string;

  /**
   * The CIDR range to allow traffic for. Must in a string in format
   * "10.0.0.0/0".
   *
   * @default - CIDR of VPC
   */
  cidr?: string;
}

export interface ISagemakerDomainConfig {
  /**
   * The name of the sagemaker domain.
   */
  domainName: string;

  /**
   * List of user names to create for the sagemaker domain. Case-insensitive.
   * Users will be created in all lowercase regardless of casing here.
   *
   * @default - no users are created
   */
  users?: string[];

  /**
   * IAM Policy location for Domain Execution Role
   * This will override the Default Execution role created at account level and apply to this domain
   * Define policy json under policies directory as best practice
   * If not provided uses default execution role for Domain
   * @default - null
   */
  defaultExecutionPolicyLocation?: string;

  /**
   * Default EC2 instance type can be used in Jupyter Lab space while creating or updating the space
   * Instance type drop down will be selected with below instance type
   * Optional setting
   * @default - null
   */
  defaultJupyterLabInstanceType?: string;

  /**
   * allowedInstanceTypes for selecting in Jupyter Lab instance type while creating Jupyter Lab space
   * If user selects any instance type other than the allowed instance types, it will throw an error
   * Optional setting
   * @default - null
   */
  allowedInstanceTypes?: string[];

  /**
   * customImages for selecting custom image configs to be applied while creating sagemaker domain
   * If this list is empty, default image configs will be applied
   * Optional setting
   * @default - null
   */
  customImages?: string[];

   /**
   * IAM or SSO authentication. Only valid values are SSO | IAM. For our
   * configuration, only IAM is tested. Validation made in sagemaker.ts file.
   *
   * @see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sagemaker.CfnDomain.html#authmode
   *
   * @default - IAM
   */
   authMode?: string;

   /**
   * Defines whether or not sagemaker studio runs in VPC. Only valid values are
   * VpcOnly | PublicInternetOnly.
   *
   * VpcOnly is required for domains to be able to access some Vpc Resources.
   *
   * @see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sagemaker.CfnDomain.html#appnetworkaccesstype
   *
   * @default - PublicInternetOnly
   */
  appNetworkAccessType?: string;
}

export interface ISagemakerConfig {
  /**
   * Individual domain configuration. Allows for specifying users,
   * apps and lifecycle hooks for each domain.
   */
  domains: ISagemakerDomainConfig[];

  /**
   * Docker images (stored in ECR) to make available for ALL sagemaker
   * domains.
   */
  images?: IImageConfig[];
}


export interface IVpcEndpointConfig {
  /**
   *  The name of the service to create VPC endpoint for.
   *
   *  Valid values are the enum strings from the InterfaceVpcEndpointAwsService
   *  enum linked below. For example, for the enum value
   *  InterfaceVpcEndpointAwsService.APIGATEWAY, set the value of service to
   *  "APIGATEWAY".
   *
   *  source: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.InterfaceVpcEndpointAwsService.html#static-apigateway
   *
   *  In addition to the interface endpoint enum linked above, the values of
   *  "DYNAMODB" and "S3" can also be provided, creating instead Gateway
   *  VPC endpoints.
   *
   *  see also: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.GatewayVpcEndpointAwsService.html
   */
  service: string;

  /**
   * Account IDs of any external accounts that should have access to use the
   * VPC endpoint.
   */
  externalAccounts?: string[];

  /**
   * List of inbound rules to add to security group attached to endpoint.
   *
   * @default - One rule allowing all traffic within VPC is created
   */
  inboundSecurityGroupRules?: IVpcEndpointSecurityGroupRule[];
}

export interface IConfig {
  /**
   * Sets up vpc configuration for the infrastructure. Allows for both
   * specifying an existing VPC to use and for passing parameters for creating
   * as new one. In most higher environments, there should be a pre-existing
   * VPC.
   */
  vpcConfig: IVpcConfig;

  /**
   * The region the batch environment is deployed in. Used in various
   * instances when setting defaults or constructing ARNs
   */
  region?: string;

  /**
   * The account ID of the account the batch environment is deployed in. Used
   * in various instances when setting defaults or constructing ARNs
   */
  accountId?: string;

  /**
   * Sets up sagemaker configuration for the infrastructure and determines
   * how many domains and users to set up. Allows providing a list of domains
   * with individual configuration.
   */
  sagemakerConfig: ISagemakerConfig;
  /**
   * The name of the build environment, ex: "dev"
   */
  environment: string;

  /**
   * The name of the execution role for the ppelines
   */
  pipelineRoleName: string;

  /**
   * List of roles that should always have key admin access to any KMS keys
   * created in this build. Should at minimum contain any console admin roles.
   * Pipeline execution role is added automatically and doesn't need to be
   * entered here.
   *
   * @default - No additional roles are granted key admin access (the pipeline will
   * still be able to manage the keys)
   */
  defaultKeyAdmins?: string[];

  /*
   * Tags to add for all Platform resources configured
   */
  tags: [{ [name: string]: string }];
}

export interface ISagemakerSSOGroup {
  /**
   * SSO Group Name in AWS Identity Center
   * Optional, For metadata purpose
   */
  groupName: string;

  /**
   * principalId - An identifier for an object in IAM Identity Center, such as a user or group. PrincipalIds are GUIDs (For example, f81d4fae-7dec-11d0-a765-00a0c91e6bf6)
   */
  principalId: string;

  /**
   * PrincipalType: Specifies whether the PrincipalId is a user or group.
   */
  principalType: string;
}

// dynamically import correct config file
const CONFIG: IConfig = JSON.parse(
  readFileSync(
    `config/config.json`,
    "utf-8"
  )
);

export default CONFIG;
