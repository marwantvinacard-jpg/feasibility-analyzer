// Which deployment this is. APP_ENV is set in apphosting.yaml (Firebase App
// Hosting); VERCEL_ENV still works if the app is run on Vercel. NODE_ENV is
// deliberately NOT used: a local `next start` is "production" to Node but not
// a real deployment.
export function deploymentEnv(): string {
  return process.env.APP_ENV ?? process.env.VERCEL_ENV ?? "development";
}

/** True only on the live production deployment. Guards like "never serve mock reports" key off this. */
export const isProductionDeployment = () => deploymentEnv() === "production";
