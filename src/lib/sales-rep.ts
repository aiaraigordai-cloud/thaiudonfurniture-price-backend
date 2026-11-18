export interface SalesRepContact {
  username: string;
  name: string;
  lineId: string;
  lineUrl: string;
  qrCodeUrl: string;
  qrLocalPath: string;
  phone: string;
}

export const ADMIN01_SALES_REP: SalesRepContact = {
  username: 'admin01',
  name: 'ฝ่ายขายไทยอุดรเฟอร์นิเจอร์',
  lineId: '0930494178',
  lineUrl: 'https://line.me/ti/p/~0930494178',
  qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https%3A%2F%2Fline.me%2Fti%2Fp%2F~0930494178',
  qrLocalPath: '/images/qr-admin01.png',
  phone: '093-049-4178',
};

export const ADMIN02_SALES_REP: SalesRepContact = {
  username: 'admin02',
  name: 'เสาวลักษณ์ ทองสิทธิ์ (ฝ่ายขาย)',
  lineId: '0872228959',
  lineUrl: 'https://line.me/ti/p/~0872228959',
  qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https%3A%2F%2Fline.me%2Fti%2Fp%2F~0872228959',
  qrLocalPath: '/images/qr-admin02.png',
  phone: '087-222-8959',
};

export const DEFAULT_SALES_REP = ADMIN01_SALES_REP;

export function getSalesRepContact(identifier?: string | null): SalesRepContact {
  if (!identifier) return DEFAULT_SALES_REP;
  const clean = String(identifier).toLowerCase().trim();
  if (
    clean === 'admin02' ||
    clean === 'usr_fdaebc2f' ||
    clean.includes('0872228959') ||
    clean.includes('เสาวลักษณ์')
  ) {
    return ADMIN02_SALES_REP;
  }
  return DEFAULT_SALES_REP;
}
