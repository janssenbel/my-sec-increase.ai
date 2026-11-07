// Philippine Peso Number-to-Words converter in standard legal / banking format

export function numberToWords(num: number): string {
  if (num === 0 || isNaN(num)) return "ZERO";
  const a = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const b = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];
  const g = ["", "THOUSAND", "MILLION", "BILLION", "TRILLION"];

  let str = "";
  let integerPart = Math.floor(Math.abs(num));

  let groupIdx = 0;
  while (integerPart > 0) {
    const rem = integerPart % 1000;
    if (rem > 0) {
      let groupStr = "";
      const hundreds = Math.floor(rem / 100);
      const tensUnits = rem % 100;
      if (hundreds > 0) groupStr += a[hundreds] + " HUNDRED ";
      if (tensUnits < 20) {
        if (tensUnits > 0) groupStr += a[tensUnits] + " ";
      } else {
        groupStr +=
          b[Math.floor(tensUnits / 10)] +
          (tensUnits % 10 > 0 ? "-" + a[tensUnits % 10] + " " : " ");
      }
      str = groupStr + (g[groupIdx] ? g[groupIdx] + " " : "") + str;
    }
    integerPart = Math.floor(integerPart / 1000);
    groupIdx++;
  }
  return str.trim();
}

export function formatPesos(amount: number): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const intVal = Math.floor(rounded);
  const cents = Math.round((rounded - intVal) * 100);
  const words = numberToWords(intVal);
  const centWords = cents > 0 ? ` AND ${cents}/100` : "";
  const numFormatted = rounded.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${words}${centWords} PESOS (Php ${numFormatted})`;
}

export function fmtNum(n: number | undefined | null): string {
  return (n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtShares(n: number | undefined | null): string {
  return (n || 0).toLocaleString("en-PH");
}
