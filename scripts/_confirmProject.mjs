// Guard for scripts that change or delete data with serviceAccountKey.json:
// nothing runs until the operator names the project it points at, so a script
// meant for staging can't quietly hit production.
//
//   CONFIRM_PROJECT=<firebase-project-id> node scripts/<script>.mjs ...
export function confirmProject(sa) {
  if (process.env.CONFIRM_PROJECT !== sa.project_id) {
    console.error(
      `Refusing to run: this changes data in project "${sa.project_id}".\n` +
        `Re-run with CONFIRM_PROJECT=${sa.project_id} to confirm.`
    );
    process.exit(1);
  }
  console.log(`Target project: ${sa.project_id}`);
}
