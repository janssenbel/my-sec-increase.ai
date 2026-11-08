import { SecFormData } from '../types';

export const initialFormData: SecFormData = {
  corpName: 'ACME ENTERPRISES PHILIPPINES INC.',
  formerCorpName: '',
  principalAddress: 'Unit 1802, One Ayala Tower, Ayala Avenue, Makati City, Metro Manila',
  execCity: '',
  execDate: '',
  execYear: String(new Date().getFullYear()),

  parValue: 100.0,
  oldShares: 10000,
  newShares: 50000,

  currentStockholders: [
    {
      id: 'cs-1',
      nameAndNationality: 'JUAN DELA CRUZ (Filipino)',
      shareClass: 'Common',
      shares: 5000,
      amountSubscribed: 500000,
      amountPaid: 500000,
    },
    {
      id: 'cs-2',
      nameAndNationality: 'MARIA SANTOS (Filipino)',
      shareClass: 'Common',
      shares: 5000,
      amountSubscribed: 500000,
      amountPaid: 500000,
    },
  ],
  treasuryShares: 0,
  treasurySubscribed: 0,
  treasuryPaid: 0,

  shMeetingDate: new Date().toISOString().split('T')[0],
  bodMeetingDate: new Date().toISOString().split('T')[0],
  meetingFormat:
    'at the principal office',
  amendedArticle: 'Article VII – Authorized Capital Stock',
  chkSec37: false,
  chkSec38: false,
  chkSec42: false,

  presName: 'JUAN DELA CRUZ',
  presTIN: '123-456-789-000',
  treasName: 'MARIA SANTOS',
  treasTIN: '234-567-890-000',
  secName: 'ATTY. JOSE RIZAL',
  secTIN: '345-678-901-000',
  chairName: 'JUAN DELA CRUZ',
  meetingSecName: 'ATTY. JOSE RIZAL',

  directors: [
    {
      id: 'dir-1',
      name: 'JUAN DELA CRUZ',
      tin: '123-456-789-000',
      evidenceId: 'TIN: 123-456-789-000',
    },
    {
      id: 'dir-2',
      name: 'MARIA SANTOS',
      tin: '234-567-890-000',
      evidenceId: 'TIN: 234-567-890-000',
    },
    {
      id: 'dir-3',
      name: 'PEDRO PENDUKO',
      tin: '345-678-901-000',
      evidenceId: 'TIN: 345-678-901-000',
    },
  ],

  subscribers: [
    {
      id: 'sub-1',
      name: 'JUAN DELA CRUZ',
      nationality: 'Filipino',
      residentialAddress: '123 Pine St., Forbes Park, Makati City',
      sharesSubscribed: 10000,
      subscriptionPricePerShare: 100,
      amountPaid: 1000000,
      modeOfPayment: 'Cash',
      tin: '123-456-789-000',
      evidenceId: 'TIN: 123-456-789-000',
    },
    {
      id: 'sub-2',
      name: 'MARIA SANTOS',
      nationality: 'Filipino',
      residentialAddress: '456 Oak St., Bonifacio Global City, Taguig City',
      sharesSubscribed: 5000,
      subscriptionPricePerShare: 100,
      amountPaid: 500000,
      modeOfPayment: 'Conversion',
      tin: '234-567-890-000',
      evidenceId: 'TIN: 234-567-890-000',
      liabilityDescription: '',
    },
  ],
};

export function createBlankFormData(): SecFormData {
  const today = new Date().toISOString().split('T')[0];
  return {
    corpName: '',
    formerCorpName: '',
    principalAddress: '',
    execCity: '',
    execDate: '',
    execYear: String(new Date().getFullYear()),

    parValue: 100.0,
    oldShares: 0,
    newShares: 0,

    currentStockholders: [
      {
        id: `cs-${Date.now()}`,
        nameAndNationality: '',
        shareClass: 'Common',
        shares: 0,
        amountSubscribed: 0,
        amountPaid: 0,
      },
    ],
    treasuryShares: 0,
    treasurySubscribed: 0,
    treasuryPaid: 0,

    shMeetingDate: today,
    bodMeetingDate: today,
    meetingFormat: 'at the principal office',
    amendedArticle: 'Article VII – Authorized Capital Stock',
    chkSec37: false,
    chkSec38: false,
    chkSec42: false,

    presName: '',
    presTIN: '',
    treasName: '',
    treasTIN: '',
    secName: '',
    secTIN: '',
    chairName: '',
    meetingSecName: '',

    directors: [
      {
        id: `dir-${Date.now()}`,
        name: '',
        tin: '',
        evidenceId: '',
      },
    ],

    subscribers: [
      {
        id: `sub-${Date.now()}`,
        name: '',
        nationality: 'Filipino',
        residentialAddress: '',
        sharesSubscribed: 0,
        subscriptionPricePerShare: 100,
        amountPaid: 0,
        modeOfPayment: 'Cash',
        tin: '',
        evidenceId: '',
        liabilityDescription: '',
      },
    ],
  };
}

