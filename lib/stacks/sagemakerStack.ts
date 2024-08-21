import { Construct } from "constructs";
import { StackProps, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { PlatformVpc } from "../../constructs/vpc";
import {
  SagemakerCustomImage,
  SagemakerDomain,
  SagemakerRole,
} from "../../constructs/sagemaker";
import { PlatformBucket } from "../../constructs/bucket";
import CONFIG, { IImageConfig, ISagemakerDomainConfig } from "../config";
import * as ec2 from "aws-cdk-lib/aws-ec2";
export interface IDomainMappingConfig {
  readonly domainMappingConfig: { [key: string]: string[] };
}
import * as ssm from "aws-cdk-lib/aws-ssm";

export class SagemakerInfraStack extends Stack {
  readonly vpc: PlatformVpc;
  readonly domains: SagemakerDomain[];
  readonly sagemakerDefaultRole: SagemakerRole;
  readonly dataBucket: PlatformBucket;
  readonly customResourceRole: iam.IRole;
  readonly pipelineRole: iam.IRole;
  readonly stagingBucket?: PlatformBucket;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const pipelineRoleName = "sagemaker-custom-image-pipeline-role";
    this.pipelineRole = iam.Role.fromRoleArn(
      this,
      "PipelineRole",
      `arn:aws:iam::${this.account}:role/${pipelineRoleName}`
    );

    this.stagingBucket = new PlatformBucket(this, "StagingBucket", {
      bucketName: `${this.account}-sagemaker-staging`,
      accountId: this.account,
      region: this.region,
      keyUsers: [this.pipelineRole.roleArn],
    });

    this.sagemakerDefaultRole = new SagemakerRole(this, "DefaultRole", {
      accountId: this.account,
      region: this.region,
      roleName: `platform-sagemaker-execution-${CONFIG.environment}-role`,
    });
    // get AWS SSM parameter to get VPC ID
    const vpcId = ssm.StringParameter.valueFromLookup(
      this,
      "/sagemaker/vpc/id"
    );

    // if vpc id is set in Environment variable use it to extract vpc
    const defaultVpc = ec2.Vpc.fromLookup(this, "DefaultVPC", {
      vpcId: vpcId,
    });

    const publicSubnetIds = defaultVpc.publicSubnets.map(
      (subnet) => subnet.subnetId
    );
    const privateSubnetIds = defaultVpc.privateSubnets.map(
      (subnet) => subnet.subnetId
    );

    this.vpc = new PlatformVpc(this, "ResearchPlatformVpc", {
      accountId: this.account,
      region: this.region,
      cidr: CONFIG.vpcConfig?.vpcCIDR,
      subnetSize: CONFIG.vpcConfig?.subnetSize,
      privateSubnets: CONFIG.vpcConfig?.privateSubnets,
      publicSubnets: CONFIG.vpcConfig?.publicSubnets,
      vpcId: defaultVpc.vpcId,
      publicSubnetIDs: publicSubnetIds,
      privateSubnetIDs: privateSubnetIds,
    });

    let customImageConfigs: IImageConfig[] =
      CONFIG.sagemakerConfig.images || [];
    let customImageMap: { [key: string]: SagemakerCustomImage } = {};
    let images: SagemakerCustomImage[] = [];
    for (let i = 0; i < customImageConfigs.length; i++) {
      let imageConfig: IImageConfig = customImageConfigs[i];

      for (let j = 0; j < imageConfig.tags.length; j++) {
        let tagName: string = imageConfig.tags[j];
        let imageName: string = `${imageConfig.repositoryName}-${tagName}`;
        let id: string = imageName.replace("-", "");
        let image: SagemakerCustomImage = new SagemakerCustomImage(this, id, {
          accountId: this.account,
          region: this.region,
          repositoryName: imageConfig.repositoryName,
          tag: tagName,
          imageRole: this.sagemakerDefaultRole,
          pipelineRole: this.pipelineRole,
          customResourceRole: this.customResourceRole
            ? this.customResourceRole
            : undefined,
        });
        customImageMap[tagName] = image;
      }
    }

    let domains: SagemakerDomain[] = [];
    if (CONFIG.sagemakerConfig.domains) {
      for (let i = 0; i < CONFIG.sagemakerConfig.domains.length; i++) {
        let domainConfig: ISagemakerDomainConfig =
          CONFIG.sagemakerConfig.domains[i];

        let customImages = [];
        if (domainConfig.customImages) {
          for (let j = 0; j < domainConfig.customImages.length; j++) {
            let tagName: string = domainConfig.customImages[j];
            customImages.push(customImageMap[tagName]);
          }
        }
        let id: string = domainConfig.domainName.replace("-", "");

        let domain = new SagemakerDomain(this, id, {
          domainName: domainConfig.domainName,
          vpc: this.vpc,
          authMode: domainConfig.authMode,
          accountId: this.account,
          region: this.region,
          users: domainConfig.users,
          pipelineRole: this.pipelineRole,
          customImages: customImages,
          defaultExecutionRole: domainConfig.defaultExecutionPolicyLocation
            ? undefined
            : this.sagemakerDefaultRole,
          defaultExecutionPolicyLocation:
            domainConfig.defaultExecutionPolicyLocation
              ? domainConfig.defaultExecutionPolicyLocation
              : undefined,
          appNetworkAccessType: domainConfig.appNetworkAccessType,
          defaultJupyterLabInstanceType:
            domainConfig.defaultJupyterLabInstanceType,
          allowedInstanceTypes: domainConfig.allowedInstanceTypes,
        });
        domains.push(domain);
      }
    }
    this.domains = domains;
  }
}
