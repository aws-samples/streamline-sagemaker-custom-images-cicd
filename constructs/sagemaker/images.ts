import { SagemakerRole } from ".";
import { IRole } from "aws-cdk-lib/aws-iam";
import {
  CfnAppImageConfig,
  CfnImage,
  CfnImageVersion,
} from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";

export interface SagemakerImagesProps {
  /**
   * The region the batch environment is deployed in. Used in various
   * instances when setting defaults or constructing ARNs
   */
  readonly region: string;

  /**
   * The account ID of the account the batch environment is deployed in. Used
   * in various instances when setting defaults or constructing ARNs
   */
  readonly accountId: string;

  /**
   * The execution role used by the pipeline that deploys this domain. Needed
   * for ensuring any supporting resources (mainly KMS keys) can be managed
   * by the pipeline.
   */
  readonly pipelineRole: IRole;

  /**
   * The name of the ECR repo that contains the kernel images. MUST be in
   * same account and region
   */
  readonly repositoryName: string;

  /**
   * The tag of the default kernel image.
   *
   * @default - latest
   */
  readonly tag?: string;

  /**
   * The name of the image as it should appear in sagemaker, ex: numpy
   */
  readonly imageName?: string;

  /**
   * The execution role for the image.
   */
  readonly imageRole: SagemakerRole;

  /**
   * customResourceFnArn - Pass ARN for custom function so that
   * it can generate custom resource successfully
   *
   */
  readonly customResourceFnArn?: string;

  /**
   * customResourceFnArn - Pass ARN for custom function so that
   * it can generate custom resource successfully
   * @default - This property is ignored
   */
  readonly customResourceRole?: IRole;
}

export class SagemakerCustomImage extends Construct {
  readonly kernelArn: string;
  readonly imageName: string;
  readonly sagemakerImage?: CfnImage;
  readonly sagemakerImageVersion?: CfnImageVersion;
  readonly sagemakerImageConfig: CfnAppImageConfig;
  readonly imageDigest: string;

  constructor(scope: Construct, id: string, props: SagemakerImagesProps) {
    super(scope, id);
    let gitCommitHash =
      process.env.CODEBUILD_RESOLVED_SOURCE_VERSION?.substring(0, 7);
    this.kernelArn = `${props.accountId}.dkr.ecr.${props.region}.amazonaws.com/${props.repositoryName}:${props.tag}`;
    this.imageName = props.imageName || `${props.repositoryName}-${props.tag}`;

    this.sagemakerImage = new CfnImage(this, "CustomImage", {
      imageName: this.imageName,
      imageRoleArn: props.imageRole.role.roleArn,
      imageDisplayName: props.tag,
    });

    this.sagemakerImageVersion = new CfnImageVersion(
      this,
      `CustomImageVersion-${gitCommitHash}`,
      {
        baseImage: this.kernelArn,
        imageName: this.imageName,
      }
    );

    this.sagemakerImageVersion.addDependency(this.sagemakerImage);
    this.sagemakerImageConfig = new CfnAppImageConfig(
      this,
      `CustomImageConfig`,
      {
        appImageConfigName: this.imageName,
        jupyterLabAppImageConfig: {},
      }
    );
  }
}
