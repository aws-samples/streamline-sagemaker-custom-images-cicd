import { Construct } from "constructs";
import {
  Vpc,
  IpAddresses,
  IIpAddresses,
  SubnetType,
  SubnetConfiguration,
  IVpc
} from "aws-cdk-lib/aws-ec2";
import {
  Role,
  IRole,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
} from "aws-cdk-lib/aws-iam";
import { IVpcEndpointConfig } from "../../lib/config";
import flowLogsPolicy from "../../policies/iam/flowLogsPolicy.json";

export interface VpcProps {
  /**
   * The CIDR range for the created VPC.
   *
   * This property is ignored if vpcId is provided.
   *
   * Passed to Vpc construct direclty.
   *
   * @see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html#ipaddresses
   *
   * @default - 10.0.0.0/16
   */
  readonly cidr?: string;

  /**
   * Number of private subnets to create.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 2
   */
  readonly privateSubnets?: number;

  /**
   * Number of public subnets to create.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 2
   */
  readonly publicSubnets?: number;

  /**
   * The subnet size for the subnets created in the VPC. Note that no checks
   * are made in the code if the size is valid. Must be a valid range that
   * fits within the CIDR range for the VPC.
   *
   * This property is ignored if vpcId is provided.
   *
   * @default - 24 (as in /24 CIDR)
   */
  readonly subnetSize?: number;

  /**
   * The account ID of the account the batch environment is deployed in. Used
   * in various instances when setting defaults or constructing ARNs
   */
  readonly accountId: string;

  /**
   * The region the batch environment is deployed in. Used in various
   * instances when setting defaults or constructing ARNs
   */
  readonly region: string;

  /**
   * Explicitly pass a key policy for the KMS key used to encrypt the VPC flow
   * logs. Make sure to allow management to the pipeline role as well as any
   * admin or power user roles used in the console. Must also allow access to
   * VPC.
   *
   * @defatul - Default policy used providing minimum access to VPC, S3 bucket,
   * pipeline role and console admin roles.
   */
  readonly flowLogsKeyPolicy?: any;

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
  readonly vpcId?: string; // allow for importing existing vpc

  /**
   * List of VPC endpoints to create under the VPC. This property can be set
   * regardless of whether or not vpcId is provided, re: regardless of whether
   * or not an existing VPC is used or a VPC is created.
   *
   * @default - No endpoints are created
   */
  readonly endpoints?: IVpcEndpointConfig[];

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
  readonly publicSubnetIDs?: string[];

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
  readonly privateSubnetIDs?: string[];

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
  readonly isolatedSubnetIDs?: string[];

  /**
   * The ARN of the role assumed by the pipeline in deploying the VPC. Mainly
   * used for KMS policies in any KMS key created to ensure the pipeline can
   * manage the created keys. This is generally not required as arn is
   * extrapolated from config file by default.
   *
   * @default - Pipeline role name is extrapolated from config file
   */
  readonly pipelineRoleArn?: string;

  /**
   * VPC Name to create VPC
   *
   * @default - ResearchPlatformVPC
   */
  readonly vpcName?: string;
}

export class PlatformVpc extends Construct {
  readonly id: string;
  readonly arn: string;
  readonly subnetIds: string[];
  readonly publicSubnetIds: string[];
  readonly privateSubnetIds: string[];
  readonly isolatedSubnetIds: string[];
  readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id);

    let vpc: IVpc;
    if (props.vpcId !== "") {
      /**
       * Import existing VPC
       */
      vpc = Vpc.fromLookup(this, "PlatformVpc", {
        vpcId: props.vpcId,
      });
    } else {
      /**
       * Create new VPC from configuration
       */

      let hydratedFlowLogsPolicy: any = JSON.parse(
        JSON.stringify(flowLogsPolicy)
          .replaceAll("${accountId}", props.accountId)
          .replaceAll("${region}", props.region)
      );
      const role: IRole = new Role(this, "VPCFlowLogsRole", {
        roleName: "vpc-flow-logs-role",
        description: `Role for managing vpc flow logs`,
        assumedBy: new ServicePrincipal("vpc-flow-logs.amazonaws.com"),
        managedPolicies: [
          new ManagedPolicy(this, "SagemakerUserExecutionPolicy", {
            managedPolicyName: `flow-logs-policy`,
            description: "Execution policy for vpc flow logs",
            document: PolicyDocument.fromJson(hydratedFlowLogsPolicy),
          }),
        ],
      });

      // parse VPC CIDR range and subnets
      const cidr: IIpAddresses = IpAddresses.cidr(props?.cidr || "10.0.0.0/16");
      const privateSubnets = props?.privateSubnets || 2;
      const publicSubnets = props?.publicSubnets || 2;
      const subnetSize = props?.subnetSize || 24;

      // define subnets
      const subnets: SubnetConfiguration[] = [];
      for (let i = 0; i < privateSubnets; i++)
        subnets.push({
          cidrMask: subnetSize,
          name: `private${i + 1}`,
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        });
      for (let i = 0; i < publicSubnets; i++)
        subnets.push({
          cidrMask: subnetSize,
          name: `public${i + 1}`,
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        });

      /**
       * MAIN - Create VPC
       */
      vpc = new Vpc(this, "PlatformVpc", {
        vpcName: props.vpcName || "ResearchPlatformVpc",
        ipAddresses: cidr,
        subnetConfiguration: subnets,
        maxAzs: 2, // Default is all AZs in region
        natGateways: 1,
      });
    }

    // Parse PlatformVpc properties. Mainly to provide easy access to things
    // like list of public or private subnets, VPC ID, etc.
    const publicSubnetIDs: string[] = props.publicSubnetIDs || [];
    const privateSubnetIDs: string[] = props.privateSubnetIDs || [];
    const isolatedSubnetIDs: string[] = props.isolatedSubnetIDs || [];
    this.id = vpc.vpcId;
    this.arn = vpc.vpcArn;
    // include Sets to ensure no duplicates
    this.publicSubnetIds = [
      ...new Set([
        ...vpc.publicSubnets.map(({ subnetId }) => subnetId),
        ...publicSubnetIDs,
      ]),
    ];
    this.privateSubnetIds = [
      ...new Set([
        ...vpc.privateSubnets.map(({ subnetId }) => subnetId),
        ...privateSubnetIDs,
      ]),
    ];
    this.isolatedSubnetIds = [
      ...new Set([
        ...vpc.privateSubnets.map(({ subnetId }) => subnetId),
        ...isolatedSubnetIDs,
      ]),
    ];
    this.subnetIds = [
      ...new Set([
        ...this.publicSubnetIds,
        ...this.privateSubnetIds,
        ...this.isolatedSubnetIds,
      ]),
    ];
    this.vpc = vpc;
  }
}
