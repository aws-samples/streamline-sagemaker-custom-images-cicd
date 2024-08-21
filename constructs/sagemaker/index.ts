import { Construct } from "constructs";
import { CfnDomain, CfnUserProfile } from "aws-cdk-lib/aws-sagemaker";
import { IVpc, SecurityGroup, Port, Peer, IPeer } from "aws-cdk-lib/aws-ec2";
import { IRole } from "aws-cdk-lib/aws-iam";
import { SagemakerRole } from "./role";
import { SagemakerCustomImage } from "./images";
import * as types from "./types";
import { PlatformVpc } from "../vpc";
export { SagemakerCustomImage, SagemakerImagesProps } from "./images";
export { SagemakerRole } from "./role";
export interface SagemakerDomainProps {
  /**
   * The name of the sagemaker domain.
   */
  readonly domainName: string;

  /**
   * The VPC to create the domain in
   */
  readonly vpc: PlatformVpc;

  /**
   * If true, domain and notebooks will be created inside of public subnets
   * if appNetworkAccessType is PublicInternetOnly. If false, or if
   * appNetworkAccessType is VpcOnly, private subnets will be used.
   *
   * This property is ignored if appNetworkAccessType is set to VpcOnly.
   *
   * @default - false
   */
  readonly publicSubnets?: boolean;

  /**
   * IAM or SSO authentication. Only valid values are SSO | IAM. For our
   * configuration, only IAM is tested. Validation made in sagemaker.ts file.
   *
   * @see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sagemaker.CfnDomain.html#authmode
   *
   * @default - IAM
   */
  readonly authMode?: string;

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
   * The default exeuction role that users will run under in studio notebooks.
   *
   * For details on the default access, see lib/iam/policies/userExeuctionPolicy.json,
   * lib/iam/policies/userExeuctionPolicyCanvas.json and
   * lib/iam/policies/userExeuctionPolicySagemaker.json. The default execution
   * role gets all three policies.
   *
   * @default - a role with minimum access will be created.
   */
  readonly defaultExecutionRole?: SagemakerRole;

  /**
   * List of user names to create for the sagemaker domain. Case-insensitive.
   * Users will be created in all lowercase regardless of casing here.
   *
   * TROUBLESHOOTING: It may be necessary to create the domain in one pipeline
   * run before creating the users.
   *
   * @default - no users are created
   */
  readonly users?: string[];

  /**
   * The execution role used by the pipeline that deploys this domain. Needed
   * for ensuring any supporting resources (mainly KMS keys) can be managed
   * by the pipeline.
   */
  readonly pipelineRole: IRole;

  /**
   * Docker images (stored in ECR) to make available for the domain.
   * The FIRST item in the list will be the default. All subsequent images will be
   * selectable when running a new notebook.
   *
   * @default - No custom images are attached.
   */
  readonly customImages?: SagemakerCustomImage[];

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
  readonly appNetworkAccessType?: string;

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
}

export class SagemakerDomain extends Construct {
  readonly defaultExecutionRole: SagemakerRole;
  readonly domainId: string;
  readonly domain: CfnDomain;
  readonly vpc: IVpc;
  readonly subnetIds: string[];
  readonly vpcId: string;
  readonly domainName: string;
  readonly domainUsers: CfnUserProfile[];

  constructor(scope: Construct, id: string, props: SagemakerDomainProps) {
    super(scope, id);

    const authMode = "IAM";
    this.domainName = props.domainName;
    const users = props.users || [];
    const customImages: SagemakerCustomImage[] = props.customImages || [];

    // ensure default user role
    this.defaultExecutionRole =
      props.defaultExecutionRole ||
      new SagemakerRole(this, "DefaultRole", {
        accountId: props.accountId,
        region: props.region,
        roleName: `${this.domainName}-default-execution-role`,
        defaultDomainPolicyLocation: props.defaultExecutionPolicyLocation,
        allowedInstanceTypes: props.allowedInstanceTypes,
      });

    // ensure network config
    this.vpc = props.vpc.vpc;
    this.subnetIds = props.vpc.subnetIds; // MUSt be all subnet IDs until VPC is moved out of sagemaker stack
    this.vpcId = props.vpc.id;
    // if custom images passed, create array of image configs to attach to
    // domain
    let customImageConfigs: CfnDomain.CustomImageProperty[] = [];
    for (let i = 0; i < customImages.length; i++)
      customImageConfigs.push({
        appImageConfigName:
          customImages[i].sagemakerImageConfig.appImageConfigName,
        imageName: customImages[i].imageName,
      });

    // for network types of vpc only, we need to provide a security group
    // that allows traffic for port 443
    let secGrps: string[] | undefined = undefined;

    let secGrp: SecurityGroup = new SecurityGroup(
      this,
      "SagemakerSecurityGroup",
      {
        vpc: this.vpc,
        securityGroupName: `${props.domainName}-sec-grp`,
        description: `Security Group for sagemaker domain ${props.domainName}`,
        allowAllOutbound: true,
      }
    );

    // allow https traffic - default public
    secGrp.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    secGrp.addIngressRule(secGrp, Port.tcp(2049), "NFS traffic to EFS volume");
    secGrp.addIngressRule(
      secGrp,
      Port.tcpRange(8192, 65535),
      "Ephemeral ports to allow traffic between Jupyter Server and Kernel Gateway"
    );
    secGrps = [secGrp.securityGroupId];
    //}

    // create the actual domain
    this.domain = new CfnDomain(this, "SagemakerDomain", {
      ...{
        authMode: authMode,
        domainName: this.domainName,
        vpcId: props.vpc.id,
        subnetIds: props.vpc.subnetIds,
        domainSettings: {
          securityGroupIds: secGrps,
        },
        defaultUserSettings: {
          //New Sagemaker studio experience
          studioWebPortal: "ENABLED",
          defaultLandingUri: "studio::",
          executionRole: this.defaultExecutionRole.role.roleArn,
          //attaching custom images to jupyterlab
          jupyterLabAppSettings: {
            customImages: customImageConfigs,
            defaultResourceSpec: {
              instanceType: props.defaultJupyterLabInstanceType,
            },
          },
          securityGroups: secGrps,
        },
        tags: [{ key: "sagemaker:domain", value: this.domainName }],
      },
    });

    // explicitly set dependencies to image configs
    for (let i = 0; i < customImages.length; i++)
      this.domain.node.addDependency(customImages[i]);
    this.domainId = this.domain.attrDomainId;

    // create any provided users
    const domainUsers: CfnUserProfile[] = [];
    const defaultStudioArn: string = `arn:aws:sagemaker:${props.region}:${
      types.sagemakerImageRegionAccountMapping[props.region]
    }:image/jupyter-server-3`;
    const defaultKernelArn: string = `arn:aws:sagemaker:${props.region}:${
      types.sagemakerImageRegionAccountMapping[props.region]
    }:image/${types.defaultSagemakerInstances.DATASCIENCE_10}`;

    for (let i = 0; i < users.length; i++) {
      const userName: string = users[i]
        .replaceAll(".", "-")
        .replaceAll("_", "-");
      const userProfile: CfnUserProfile = new CfnUserProfile(
        this,
        `SagemakerUserProfile${userName.replaceAll("-", "")}`,
        {
          domainId: this.domain.attrDomainId,
          userProfileName: userName,
          userSettings: {
            executionRole: this.defaultExecutionRole.role.roleArn,
            jupyterServerAppSettings: {
              defaultResourceSpec: {
                instanceType: "system",
                sageMakerImageArn: defaultStudioArn,
              },
            },
            jupyterLabAppSettings: {
              defaultResourceSpec: {
                instanceType: props.defaultJupyterLabInstanceType,
              },
            },
            kernelGatewayAppSettings: {
              defaultResourceSpec: {
                instanceType: types.notebookInstanceTypes.ML_T3_MEDIUM,
                sageMakerImageArn: defaultKernelArn,
              },
            },
          },
          tags: [
            { key: "sagemaker:DomainUser", value: userName },
            { key: "sagemaker:Domain", value: this.domainId },
          ],
        }
      );
      //userProfile.node.addDependency(this.domain);
      domainUsers.push(userProfile);
    }

    this.domainUsers = domainUsers;

    const appType = types.sagemakerAppType.JUPYTERLAB;
  }
}
