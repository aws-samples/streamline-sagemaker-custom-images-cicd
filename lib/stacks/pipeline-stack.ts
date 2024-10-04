import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Repository, IRepository, RepositoryEncryption } from "aws-cdk-lib/aws-ecr";
import {
  PipelineProject,
  ComputeType,
  BuildSpec,
  LinuxBuildImage,
  Cache,
  LocalCacheMode
} from "aws-cdk-lib/aws-codebuild";
import {
  Role,
  ServicePrincipal,
  CompositePrincipal,
  ManagedPolicy,
  PolicyDocument,
} from "aws-cdk-lib/aws-iam";
import { RemovalPolicy } from "aws-cdk-lib";
import {
  Pipeline,
  IPipeline,
  Artifact,
  StageProps,
  Action,
} from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  ManualApprovalAction,
  CodeStarConnectionsSourceAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import pipelineExecutionPolicy from "../../policies/iam/pipelineExecutionPolicy.json";
import { LogGroup, ILogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class PipelineStack extends cdk.Stack {
  readonly repo: IRepository;
  readonly logGroup: ILogGroup;
  readonly pipeline?: IPipeline;
  readonly executionRole: Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //create a new kms key
    const kmsKey = new cdk.aws_kms.Key(this, "KmsKey", {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,

    });
    kmsKey.grantEncryptDecrypt(new ServicePrincipal("logs.amazonaws.com"));
    kmsKey.grantEncryptDecrypt(new ServicePrincipal("ecr.amazonaws.com"));

    // Create SSM parameter with VPC id value in env variable
    const vpcIdSsmParam = new ssm.StringParameter(this, "VpcIdSsmParam", {
      parameterName: "/sagemaker/vpc/id",
      stringValue: process.env.VPC_ID ? process.env.VPC_ID : "NOT_PROVIDED",
    });

    const removalPolicy: RemovalPolicy = RemovalPolicy.DESTROY;
    const pipelineName = "sagemaker-custom-image-pipeline";
    const accountId = this.account;
    const region = this.region;
    const pipelineAccount = this.account;
    const environment = "dev";
    const pipelineRoleName: string = `${pipelineName}-role`;
    //create

    // Create ECR repository for pipeline images, This repo holds a custom docker image used for pipelines
    this.repo = new Repository(this, "EcrRepository", {
      repositoryName: "sagemakerkernels-image-repo",
      imageScanOnPush: true,
      removalPolicy: removalPolicy,
      encryption: RepositoryEncryption.KMS,
      encryptionKey: kmsKey
    });

    let pipelineRole: Role;
    // Create Pipeline Role
    const hydratedPipelineExecutionPolicy: any = JSON.parse(
      JSON.stringify(pipelineExecutionPolicy)
        .replaceAll("${accountId}", accountId)
        .replaceAll("${region}", region)
        .replaceAll("${pipelinerole}", pipelineRoleName)
    );
    pipelineRole = new Role(this, "PipelineRole", {
      roleName: pipelineRoleName,
      description: `Execution role for ${pipelineName} pipeline`,
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("codepipeline.amazonaws.com"),
        new ServicePrincipal("codebuild.amazonaws.com")
      ),
      managedPolicies: [
        new ManagedPolicy(this, "CompositePipelineExecutionPolicy", {
          managedPolicyName: `${pipelineName}-pipeline-managed-policy`,
          description: `Execution policy for ${pipelineName} pipeline`,
          document: PolicyDocument.fromJson(hydratedPipelineExecutionPolicy),
        }),
      ],
    });

    let envVars: { [name: string]: { value: string } } = {
      CREATE_ALL_CONSTRUCTS: { value: "true" },
      ENVIRONMENT: { value: environment },
      AWS_ACCOUNT: { value: accountId },
      AWS_REGION: { value: region },
      PIPELINE_ACCOUNT: { value: pipelineAccount },
      PIPELINE_ROLE: { value: pipelineRole.roleArn },
    };

    // Create CloudWatch Log Group
    this.logGroup = new LogGroup(this, "LogGroup", {
      //logGroupName: `/${pipelineName}-pipeline-logs`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: removalPolicy,
      encryptionKey: kmsKey
    });

    this.logGroup.node.addDependency(kmsKey)

    const ecrBuildProject: PipelineProject = new PipelineProject(
      this,
      "ContainerBuildProjectECR",
      {
        description: `CDK Stage ECR Build Project for Container pipeline ${pipelineName} `,
        cache: Cache.local(LocalCacheMode.DOCKER_LAYER),
        environment: {
          computeType: ComputeType.MEDIUM,
          privileged: true,
          buildImage: LinuxBuildImage.STANDARD_6_0,
        },
        environmentVariables: envVars,
        role: pipelineRole,
        buildSpec: BuildSpec.fromSourceFilename("buildspecs/ecr.yaml"),
        logging: {
          cloudWatch: {
            logGroup: this.logGroup,
            enabled: true,
            prefix: "ECR",
          },
        },
        timeout: cdk.Duration.minutes(120),
      }
    );

    const deployBuildProject: PipelineProject = new PipelineProject(
      this,
      "SagemakerBuildProjectDeploy",
      {
        description: `CDK Stage Deploy Build Project for Sagemaker pipeline ${pipelineName}`,
        cache: Cache.local(LocalCacheMode.DOCKER_LAYER),
        environment: {
          computeType: ComputeType.SMALL,
          privileged: true,
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
        },
        environmentVariables: envVars,
        role: pipelineRole,
        buildSpec: BuildSpec.fromSourceFilename("buildspecs/deploy.yaml"),
        logging: {
          cloudWatch: {
            logGroup: this.logGroup,
            enabled: true,
            prefix: "Deploy",
          },
        },
      }
    );

    const sourceArtifact: Artifact = new Artifact("SourceOutput");
    const ecrArtifact: Artifact = new Artifact("EcrOutput");
    const deployArtifact: Artifact = new Artifact("DeployOutput");
    const sourceAction = new CodeStarConnectionsSourceAction({
      actionName: `checkout_sourcecode`,
      owner: process.env.REPOSITORY_OWNER
        ? process.env.REPOSITORY_OWNER
        : "owner",
      runOrder: 1,
      output: sourceArtifact,
      branch: "main",
      repo: "streamline-sagemaker-custom-images-cicd",
      connectionArn: process.env.CODESTAR_CONNECTION_ARN
        ? process.env.CODESTAR_CONNECTION_ARN
        : "codestar",
    });

    let manualApprovalAction = new ManualApprovalAction({
      actionName: "Confirm",
      runOrder: 5,
      role: pipelineRole,
    });

    let stages: StageProps[] = [
      {
        stageName: "Source",
        actions: [sourceAction],
      },
      {
        stageName: "BuildCustomKernelImages",
        actions: [
          new CodeBuildAction({
            actionName: "PushImageAndScan",
            runOrder: 2,
            input: sourceArtifact,
            outputs: [ecrArtifact],
            project: ecrBuildProject,
            role: pipelineRole,
          }),
        ],
      },
      {
        stageName: "DeploySageMaker",
        actions: [
          manualApprovalAction,
          new CodeBuildAction({
            actionName: "CdkDeploy",
            runOrder: 7,
            input: sourceArtifact,
            outputs: [deployArtifact],
            project: deployBuildProject,
            role: pipelineRole,
          }),
        ],
      },
    ];
    this.pipeline = new Pipeline(this, "SageMakerPipeline", {
      pipelineName: pipelineName,
      role: pipelineRole,
      stages: stages,
    });

    // Outputs
    this.executionRole = pipelineRole;
  }
}
