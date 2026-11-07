export interface Director {
  id: string;
  name: string;
  tin: string;
  evidenceId: string;
}

export interface CurrentStockholder {
  id: string;
  nameAndNationality: string;
  shareClass: string;
  shares: number;
  amountSubscribed: number;
  amountPaid: number;
}

export type PaymentMode = 'Cash' | 'Conversion' | 'Both';

export interface Subscriber {
  id: string;
  name: string;
  nationality: string;
  residentialAddress: string;
  sharesSubscribed: number;
  subscriptionPricePerShare: number;
  amountPaid: number;
  modeOfPayment: PaymentMode;
  tin?: string;
  evidenceId: string;
  // Detail for conversion
  liabilityDescription?: string; // e.g. "Advances from Stockholder"
  // Breakdown when modeOfPayment === 'Both'
  cashShares?: number;
  cashAmountPaid?: number;
  conversionShares?: number;
  conversionAmountPaid?: number;
}

export interface SecFormData {
  // 1. Corporate Details
  corpName: string;
  formerCorpName: string;
  principalAddress: string;
  execCity: string;
  execDate: string;

  // 2. Capital Stock Details
  parValue: number;
  oldShares: number;
  newShares: number;

  // 3. Current Stockholders (Item 3 Table)
  currentStockholders: CurrentStockholder[];
  treasuryShares: number;
  treasurySubscribed: number;
  treasuryPaid: number;

  // 4. Meetings & Item 6 Statutory Compliance
  shMeetingDate: string;
  bodMeetingDate: string;
  meetingFormat: string;
  amendedArticle: string;
  chkSec37: boolean;
  chkSec38: boolean;
  chkSec42: boolean;

  // 5. Officers & Signatories
  presName: string;
  presTIN: string;
  treasName: string;
  treasTIN: string;
  secName: string;
  secTIN: string;
  chairName: string;
  meetingSecName: string;

  // 6. Directors
  directors: Director[];

  // 7. Subscribers
  subscribers: Subscriber[];
}
