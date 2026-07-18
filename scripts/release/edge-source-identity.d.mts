export const EDGE_FUNCTIONS_DIRECTORY: string;
export const GENERATED_EDGE_IDENTITY_PATH: string;

export interface EdgeSourceTreeIdentity {
  algorithm: "sha256";
  bytes: number;
  files: number;
  sha256: string;
}

export function verifyGeneratedEdgeSourceIdentity(options?: {
  repositoryRoot?: string;
  relativePaths?: string[];
}): EdgeSourceTreeIdentity;
