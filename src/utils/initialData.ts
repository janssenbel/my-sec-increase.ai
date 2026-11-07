import { SecFormData } from '../types';

export const initialFormData: SecFormData = {
  corpName: 'ACME ENTERPRISES PHILIPPINES INC.',
  formerCorpName: '',
  principalAddress: 'Unit 1802, One Ayala Tower, Ayala Avenue, Makati City, Metro Manila',
  execCity: 'Makati City',
  execDate: new Date().toISOString().split('T')[0],

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
  chkSec38: true,
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
      evidenceId: 'Philippine Passport P1234567B',
    },
    {
      id: 'dir-2',
      name: 'MARIA SANTOS',
      tin: '234-567-890-000',
      evidenceId: "Driver's License N01-12-345678",
    },
    {
      id: 'dir-3',
      name: 'PEDRO PENDUKO',
      tin: '345-678-901-000',
      evidenceId: 'UMID CRN-0011-2233445-6',
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
      evidenceId: 'Philippine Passport P1234567B',
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
      evidenceId: "Driver's License N01-12-345678",
      liabilityDescription: 'Deposits for Future Stock Subscriptions',
    },
  ],
};
