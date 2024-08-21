import { CfnUserProfile } from "aws-cdk-lib/aws-sagemaker";
import * as types from "./types";

/* Create users and set up their default profiles*/
export function setUpUser(props: types.setUpUserProps): void {
  const defaultStudioArn: string =
    props.defaultKernelArn ||
    `arn:aws:sagemaker:${props.region}:${
      types.sagemakerImageRegionAccountMapping[props.region]
    }:image/jupyter-server-3`;
  const defaultKernelArn: string = `arn:aws:sagemaker:${props.region}:${
    types.sagemakerImageRegionAccountMapping[props.region]
  }:image/${types.defaultSagemakerInstances.DATASCIENCE_10}`;
  const userName: string = props.user.replaceAll(".", "-").replaceAll("_", "-");

  const userProfile: CfnUserProfile = new CfnUserProfile(
    props.scope,
    `SagemakerUserProfile${userName.replaceAll("-", "")}`,
    {
      domainId: props.sagemakerDomain.attrDomainId,
      userProfileName: userName,
      userSettings: {
        executionRole: props.roleArn,
        jupyterServerAppSettings: {
          defaultResourceSpec: {
            instanceType: "system",
            sageMakerImageArn: defaultStudioArn,
          },
        },
        kernelGatewayAppSettings: {
          defaultResourceSpec: {
            instanceType: types.notebookInstanceTypes.ML_T3_MEDIUM,
            sageMakerImageArn: defaultKernelArn,
          },
        },
      },
      tags: [{ key: "ai:cost-allocation:CBWUser", value: userName }],
    }
  );

  userProfile.node.addDependency(props.sagemakerDomain);
}
