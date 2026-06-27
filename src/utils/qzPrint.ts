/**
 * QZ Tray integration for silent thermal printing on Epson TM-T88V Receipt(1)
 * Requires QZ Tray to be running in system tray
 */

declare const qz: any;

/**
 * Connect to QZ Tray websocket if not already connected
 * Handles certificate setup for local development
 */
export const connectQZ = async (): Promise<void> => {
  if (qz.websocket.isActive()) return;

  // Set up null certificate for local development
  // This bypasses certificate requirement for localhost use
  qz.security.setCertificatePromise((resolve: any) => {
    resolve(); // Allow unsigned connections for local use
  });

  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise((toSign: any) => {
    return (resolve: any) => {
      resolve(); // No signature for local development
    };
  });

  await qz.websocket.connect();

  // Wait for connection to fully stabilize
  // Increases timeout to ensure sendData is available
  // and websocket is truly ready for print jobs
  await new Promise(resolve => setTimeout(resolve, 2500));
};

/**
 * Test QZ Tray connection and list available printers
 */
export const testQZConnection = async () => {
  try {
    console.log('Testing QZ Tray connection...');
    await connectQZ();
    const isActive = qz.websocket.isActive();
    console.log('✅ QZ Tray connected:', isActive);

    const printers = await qz.printers.find();
    console.log('✅ Available printers:', printers);

    return { connected: isActive, printers };
  } catch (err) {
    console.error('❌ QZ Tray connection failed:', err);
    return { connected: false, error: err };
  }
};

/**
 * Print receipt on Epson TM-T88V Receipt(1) with optional auto-cut
 * @param receiptHTML - HTML content to print
 * @param copies - Number of copies to print (default 1)
 */
export const printReceiptQZ = async (
  receiptHTML: string,
  copies: number = 1
): Promise<void> => {
  await connectQZ();

  const config = qz.configs.create('EPSON TM-T88V Receipt (1)', {
    scaleContent: false,
    colorType: 'blackwhite',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    size: { width: 80, height: null },
    units: 'mm',
  });

  // ESC/POS full cut command
  const cutCommand = '\x1B\x69';

  const data: any[] = [];

  for (let i = 0; i < copies; i++) {
    data.push({
      type: 'html',
      format: 'plain',
      data: receiptHTML,
    });
    // Add cut command after each copy
    data.push({
      type: 'raw',
      format: 'plain',
      data: cutCommand,
    });
  }

  await qz.print(config, data);
};
