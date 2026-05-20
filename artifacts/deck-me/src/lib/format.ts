export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('en-AU').format(num);
}
