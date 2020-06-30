export function getEnv(name: string): string {
  let val = process.env[name];
  if (!val) {
    console.error(name + " environment variable is not set");
    process.exit(1);
  }
  return val;
}

export function getSourceCommitId() {
  return getEnv('BUILD_SOURCEVERSION')
}

export function getSourceBranch() {
  return getEnv('BUILD_SOURCEBRANCH')
}
