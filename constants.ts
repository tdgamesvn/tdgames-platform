
import { InvoiceData } from './types';

export const DEFAULT_INVOICE: InvoiceData = {
  invoiceNumber: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`,
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  currency: 'USD',
  taxRate: 0,
  discountType: 'percentage',
  discountValue: 0,
  theme: 'dark',
  status: 'pending',
  payment_method: 'TM/CK',
  studioInfo: {
    name: 'TD GAMES COMPANY LIMITED',
    address: 'Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam',
    email: 'tdgames.vn@gmail.com',
    taxCode: '0111386856'
  },
  clientInfo: {
    name: '',
    address: '',
    contactPerson: '',
    email: ''
  },
  bankingInfo: {
    alias: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    branchName: '',
    bankAddress: '',
    citadCode: '',
    swiftCode: ''
  },
  items: [
    { id: '1', description: 'Game Asset Production - Characters', quantity: 1, unitPrice: 2500 }
  ]
};
