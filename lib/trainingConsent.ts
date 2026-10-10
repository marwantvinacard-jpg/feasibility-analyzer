// Whether an account's analyses may be kept as model-training data.
//
// OPT-IN: only an explicit "yes" counts. The stored field is still called
// `trainingOptOut` (so no data migration is needed), but its meaning is now:
//   false      -> the user turned training ON in Settings  -> collect
//   true       -> the user turned it off                   -> don't
//   missing    -> never chose                              -> don't (default)
// It used to be collected unless the user opted out.
export function trainingAllowed(user: { trainingOptOut?: unknown } | undefined | null): boolean {
  return user?.trainingOptOut === false;
}
