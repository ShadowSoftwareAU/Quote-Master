export const STANDARD_NCC_DISCLAIMER =
  "All specified works conform to the current Australian National Construction Code (NCC) and relevant Australian Standards (AS).";

export function complianceDisclaimerForTrade(tradeType: string): string {
  const classification = tradeType.trim();
  return classification
    ? `${STANDARD_NCC_DISCLAIMER} Primary trade classification: ${classification}.`
    : STANDARD_NCC_DISCLAIMER;
}