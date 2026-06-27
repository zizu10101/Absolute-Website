/**
 * QZ Tray Integration for Silent Thermal Printing
 * Enables direct printing to Epson TM-T88IV without browser print dialog
 * Requires QZ Tray application to be running on user's machine
 */

import qz from 'qz-tray';

// Connection status
let isConnected = false;

/**
 * Connect to QZ Tray websocket
 * QZ Tray must be running on localhost:8383
 */
export const connectQZ = async (): Promise<boolean> => {
  try {
    if (isConnected && qz.websocket.isActive()) {
      return true;
    }

    await qz.websocket.connect();
    isConnected = true;
    return true;
  } catch (error) {
    console.error('QZ Tray connection error:', error);
    isConnected = false;
    return false;
  }
};

/**
 * Check if QZ Tray is connected
 */
export const isQZConnected = (): boolean => {
  return isConnected && qz.websocket.isActive();
};

/**
 * Disconnect from QZ Tray
 */
export const disconnectQZ = async (): Promise<void> => {
  try {
    if (isConnected && qz.websocket.isActive()) {
      await qz.websocket.disconnect();
      isConnected = false;
    }
  } catch (error) {
    console.error('QZ Tray disconnection error:', error);
  }
};

/**
 * Get list of available printers
 */
export const getPrinterList = async (): Promise<string[]> => {
  try {
    const connected = await connectQZ();
    if (!connected) {
      throw new Error('Failed to connect to QZ Tray');
    }

    const printers = await qz.printers.find();
    return printers;
  } catch (error) {
    console.error('QZ Tray printer list error:', error);
    return [];
  }
};

/**
 * Print receipt HTML on specified printer
 * @param receiptHTML - HTML content to print
 * @param printerName - Exact printer name (must match Windows printer name)
 */
export const printReceipt = async (receiptHTML: string, printerName: string): Promise<boolean> => {
  try {
    const connected = await connectQZ();
    if (!connected) {
      throw new Error('Failed to connect to QZ Tray');
    }

    // Create printer config
    const config = qz.configs.create(printerName, {
      scaleContent: false,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      paperThickness: 0.0038,
      units: 'mm',
      size: { width: 80, height: null },
    });

    // Print the receipt
    const data = [
      {
        type: 'html',
        format: 'plain',
        data: receiptHTML,
      },
    ];

    await qz.print(config, data);
    return true;
  } catch (error) {
    console.error('QZ Tray print error:', error);
    return false;
  }
};

/**
 * Print receipt with auto-cut command for Epson TM-T88IV
 * @param receiptHTML - HTML content to print
 * @param printerName - Exact printer name
 */
export const printWithCut = async (receiptHTML: string, printerName: string): Promise<boolean> => {
  try {
    const connected = await connectQZ();
    if (!connected) {
      throw new Error('Failed to connect to QZ Tray');
    }

    // Create printer config optimized for Epson thermal
    const config = qz.configs.create(printerName, {
      scaleContent: false,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      paperThickness: 0.0038,
      units: 'mm',
      size: { width: 80, height: null },
      rasterize: false,
    });

    // ESC/POS full cut command
    const cutCommand = 'GBwA';

    const data = [
      {
        type: 'html',
        format: 'plain',
        data: receiptHTML,
      },
      {
        type: 'raw',
        format: 'base64',
        data: cutCommand,
      },
    ];

    await qz.print(config, data);
    return true;
  } catch (error) {
    console.error('QZ Tray print with cut error:', error);
    return false;
  }
};

/**
 * Print dual-copy receipt with auto-cut between copies
 * @param receiptHTML - HTML containing both copies separated by page-break
 * @param printerName - Exact printer name
 */
export const printDualCopyWithCut = async (receiptHTML: string, printerName: string): Promise<boolean> => {
  try {
    const connected = await connectQZ();
    if (!connected) {
      throw new Error('Failed to connect to QZ Tray');
    }

    // Config for Epson TM-T88IV dual-copy printing
    const config = qz.configs.create(printerName, {
      scaleContent: false,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      paperThickness: 0.0038,
      units: 'mm',
      size: { width: 80, height: null },
      rasterize: false,
    });

    // ESC/POS full cut command (0x1D 0x56 0x00)
    const cutCommand = 'HVwA';

    const data = [
      {
        type: 'html',
        format: 'plain',
        data: receiptHTML,
      },
      {
        type: 'raw',
        format: 'base64',
        data: cutCommand,
      },
    ];

    await qz.print(config, data);
    return true;
  } catch (error) {
    console.error('QZ Tray dual-copy print error:', error);
    return false;
  }
};

/**
 * Get status of QZ Tray connection
 */
export const getQZStatus = (): string => {
  if (!isConnected) {
    return 'Not connected';
  }
  if (!qz.websocket.isActive()) {
    return 'Disconnected';
  }
  return 'Connected';
};
