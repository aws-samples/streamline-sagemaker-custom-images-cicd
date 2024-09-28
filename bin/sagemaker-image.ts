#!/usr/bin/env node
import "source-map-support/register";
import CONFIG from "../lib/config";
import * as cdk from "aws-cdk-lib";
import { SagemakerInfraStack } from "../lib/stacks/sagemakerStack";
import { PipelineStack } from "../lib/stacks/pipeline-stack";

const app = new cdk.App();

new PipelineStack(app, "PipelineStack", {});

const region: string =
  CONFIG.region ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "";
if (!region)
  throw Error(
    "Region must be provided either in config.js file or as environment variable."
  );
const accountId: string = CONFIG.accountId || process.env.AWS_DEFAULT_ACCOUNT|| process.env.AWS_ACCOUNT || "";
if (!accountId)
  throw Error(
    "Account ID must be provided either in config.js file or as environment variable."
  );

const env: cdk.Environment = {
  account: accountId,
  region: region,
};

const sagemakerStack: SagemakerInfraStack = new SagemakerInfraStack(
  app,
  "SagemakerImageStack",
  {
    env
  }
);