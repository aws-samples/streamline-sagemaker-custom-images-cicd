import { IConstruct } from "constructs";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { CfnDomain } from "aws-cdk-lib/aws-sagemaker";
import { IRole } from "aws-cdk-lib/aws-iam";

export interface ensureVpcProps {
  readonly vpcId?: string;
  readonly vpcCIDR?: string;
  readonly subnetSize?: number;
  readonly privateSubnets?: number;
  readonly publicSubnets?: number;
  readonly subnets?: string[];
  readonly scope: IConstruct;
  readonly accountId?: string;
  readonly region?: string;
}

export interface ensureVpcResponse {
  vpc?: IVpc;
  vpcId: string;
  subnetIds: string[];
}

export interface setUpUserProps {
  readonly user: string;
  readonly scope: IConstruct;
  readonly sagemakerDomain: CfnDomain;
  readonly roleArn: string;
  readonly region: string;
  readonly defaultKernelArn?: string;
  readonly pipelineRole: IRole;
  readonly accountId: string;
  readonly customResourceFnArn: string;
  readonly customResourceRole?: IRole;
}

export enum sagemakerAppType {
  JUPYTER_SERVER = "JupyterServer",
  KERNEL_GATEWAY = "KernelGateway",
  RSESSION_GATEWAY = "RSessionGateway",
  RSTUDIO_SERVER_PRO = "RStudioServerPro",
  TENSOR_BOARD = "TensorBoard",
  CANVAS = "Canvas",
  JUPYTERLAB = "JupyterLab",
}

/**
 * This list was compiled from a cloudformation error when an invalid type was
 * used.
 */
export enum notebookInstanceTypes {
  DEFAULT = "system",
  SYSTEM = "system",
  ML_C4_XLARGE = "ml.c4.xlarge",
  ML_C4_2XLARGE = "ml.c4.2xlarge",
  ML_C4_4XLARGE = "ml.c4.4xlarge",
  ML_C4_8XLARGE = "ml.c4.8xlarge",
  ML_C5_XLARGE = "ml.c5.xlarge",
  ML_C5_2XLARGE = "ml.c5.2xlarge",
  ML_C5_4XLARGE = "ml.c5.4xlarge",
  ML_C5_9XLARGE = "ml.c5.9xlarge",
  ML_C5_18XLARGE = "ml.c5.18xlarge",
  ML_C5D_XLARGE = "ml.c5d.xlarge",
  ML_C5D_2XLARGE = "ml.c5d.2xlarge",
  ML_C5D_4XLARGE = "ml.c5d.4xlarge",
  ML_C5D_9XLARGE = "ml.c5d.9xlarge",
  ML_C5D_18XLARGE = "ml.c5d.18xlarge",
  ML_G4DN_XLARGE = "ml.g4dn.xlarge",
  ML_G4DN_2XLARGE = "ml.g4dn.2xlarge",
  ML_G4DN_4XLARGE = "ml.g4dn.4xlarge",
  ML_G4DN_8XLARGE = "ml.g4dn.8xlarge",
  ML_G4DN_12XLARGE = "ml.g4dn.12xlarge",
  ML_G4DN_16XLARGE = "ml.g4dn.16xlarge",
  ML_G5_XLARGE = "ml.g5.xlarge",
  ML_G5_2XLARGE = "ml.g5.2xlarge",
  ML_G5_4XLARGE = "ml.g5.4xlarge",
  ML_G5_8XLARGE = "ml.g5.8xlarge",
  ML_G5_12XLARGE = "ml.g5.12xlarge",
  ML_G5_16XLARGE = "ml.g5.16xlarge",
  ML_G5_24XLARGE = "ml.g5.24xlarge",
  ML_G5_48XLARGE = "ml.g5.48xlarge",
  ML_M4_XLARGE = "ml.m4.xlarge",
  ML_M4_2XLARGE = "ml.m4.2xlarge",
  ML_M4_4XLARGE = "ml.m4.4xlarge",
  ML_M4_10XLARGE = "ml.m4.10xlarge",
  ML_M4_X16LARGE = "ml.m4.16xlarge",
  ML_M5_XLARGE = "ml.m5.xlarge",
  ML_M5_2XLARGE = "ml.m5.2xlarge",
  ML_M5_4XLARGE = "ml.m5.4xlarge",
  ML_M5_12XLARGE = "ml.m5.12xlarge",
  ML_M5_24XLARGE = "ml.m5.24xlarge",
  ML_M5D_LARGE = "ml.m5d.large",
  ML_M5D_XLARGE = "ml.m5d.xlarge",
  ML_M5D_2XLARGE = "ml.m5d.2xlarge",
  ML_M5D_4XLARGE = "ml.m5d.4xlarge",
  ML_M5D_8XLARGE = "ml.m5d.8xlarge",
  ML_M5D_12XLARGE = "ml.m5d.12xlarge",
  ML_M5D_16XLARGE = "ml.m5d.16xlarge",
  ML_M5D_24XLARGE = "ml.m5d.24xlarge",
  ML_P2_XLARGE = "ml.p2.xlarge",
  ML_P2_8XLARGE = "ml.p2.8xlarge",
  ML_P2_16XLARGE = "ml.p2.16xlarge",
  ML_P3_16XLARGE = "ml.p3.16xlarge",
  ML_P3_2XLARGE = "ml.p3.2xlarge",
  ML_P3_8XLARGE = "ml.p3.8xlarge",
  ML_P3DN_24XLARGE = "ml.p3dn.24xlarge",
  ML_R5_LARGE = "ml.r5.large",
  ML_R5_XLARGE = "ml.r5.xlarge",
  ML_R5_2XLARGE = "ml.r5.2xlarge",
  ML_R5_4XLARGE = "ml.r5.4xlarge",
  ML_R5_8XLARGE = "ml.r5.8xlarge",
  ML_R5_12XLARGE = "ml.r5.12xlarge",
  ML_R5_16XLARGE = "ml.r5.16xlarge",
  ML_R5_24XLARGE = "ml.r5.24xlarge",
  ML_T2_MEDIUM = "ml.t2.medium",
  ML_T2_LARGE = "ml.t2.large",
  ML_T2_2XLARGE = "ml.t2.2xlarge",
  ML_T2_XLARGE = "ml.t2.xlarge",
  ML_T3_MEDIUM = "ml.t3.medium",
  ML_T3_LARGE = "ml.t3.large",
  ML_T3_XLARGE = "ml.t3.xlarge",
  ML_T3_2XLARGE = "ml.t3.2xlarge",
}

// source: https://docs.aws.amazon.com/sagemaker/latest/dg/studio-jl.html
export const sagemakerImageRegionAccountMapping: { [name: string]: string } = {
  "us-east-1": "081325390199",
  "us-east-2": "429704687514",
  "us-west-1": "742091327244",
  "us-west-2": "236514542706",
  "af-south-1": "559312083959",
  "ap-east-1": "493642496378",
  "ap-south-1": "394103062818",
  "ap-northeast-2": "806072073708",
  "ap-southeast-1": "492261229750",
  "ap-southeast-2": "452832661640",
  "ap-northeast-1": "102112518831",
  "ca-central-1": "310906938811",
  "eu-central-1": "936697816551",
  "eu-west-1": "470317259841",
  "eu-west-2": "712779665605",
  "eu-west-3": "615547856133",
  "eu-north-1": "243637512696",
  "eu-south-1": "592751261982",
  "sa-east-1": "782484402741",
};

// source: "https://docs.aws.amazon.com/sagemaker/latest/dg/notebooks-available-images.html"
export enum defaultSagemakerInstances {
  DATASCIENCE_10 = "datascience-1.0",
}
