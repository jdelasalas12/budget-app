export type Currency = {
  code: string;
  name: string;
  symbol: string;
};

export const CURRENCIES: Currency[] = [
  {
    code: "SAR",
    name: "Saudi Riyal",
    symbol: "SAR",
  },
  {
    code: "PHP",
    name: "Philippine Peso",
    symbol: "₱",
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
  },
];

export const DEFAULT_CURRENCY = "PHP";

export function getCurrency(currencyCode: string): Currency {
  return (
    CURRENCIES.find((currency) => currency.code === currencyCode) ??
    CURRENCIES.find((currency) => currency.code === DEFAULT_CURRENCY)!
  );
}

export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY,
) {
  const currency = getCurrency(currencyCode);

  return `${currency.symbol} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
