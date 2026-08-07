#!/usr/bin/env node

/**
 * Printer Diagnostic Script
 * Checks Windows printer configuration and node-printer functionality
 */

const printer = require('node-printer');

console.log('\n🔍 PRINTER DIAGNOSTIC TOOL\n');
console.log('=' .repeat(60));

try {
  // 1. Get all printers
  console.log('\n📋 Available Printers:');
  console.log('-'.repeat(60));

  const printers = printer.getPrinters();
  console.log(`Total printers found: ${printers.length}\n`);

  if (printers.length === 0) {
    console.log('❌ No printers found! Please install a printer driver.');
    process.exit(1);
  }

  // Display all printers
  printers.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
  });

  // 2. Look for Epson printers
  console.log('\n\n🔎 Searching for Epson TM-T88V:');
  console.log('-'.repeat(60));

  const epsonPrinters = printers.filter(p =>
    p.name.toLowerCase().includes('epson') &&
    p.name.toLowerCase().includes('tm-t88v')
  );

  if (epsonPrinters.length === 0) {
    console.log('❌ No EPSON TM-T88V printer found!');
    console.log('\nPossible issues:');
    console.log('  1. Printer is not connected via USB');
    console.log('  2. Driver is not installed');
    console.log('  3. Printer name is different');
    console.log('\nTo install driver:');
    console.log('  1. Download from: https://epson.com/Support');
    console.log('  2. Or add via: Settings → Devices → Printers → Add printer');
    process.exit(1);
  }

  epsonPrinters.forEach(p => {
    console.log(`✓ Found: "${p.name}"`);
  });

  // 3. Test drawer command on first Epson printer
  console.log('\n\n🧪 Testing Drawer Command:');
  console.log('-'.repeat(60));

  const targetPrinter = epsonPrinters[0];
  const drawerCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);

  console.log(`\nUsing printer: "${targetPrinter.name}"`);
  console.log(`Sending ESC/POS command: [0x1B, 0x70, 0x00, 0x19, 0xFA]\n`);

  printer.printDirect({
    data: drawerCommand,
    printer: targetPrinter.name,
    type: 'RAW',
    success: () => {
      console.log('✓ Drawer command sent successfully!');
      console.log('\n✅ PRINTER READY FOR POS SYSTEM');
      console.log('\nUpdate server.ts line ~1173 with:');
      console.log(`  printer: "${targetPrinter.name}",`);
      console.log('\nThen restart: npm run dev');
      process.exit(0);
    },
    error: (err) => {
      console.error(`❌ Drawer command failed: ${err.message}`);
      console.log('\nTroubleshooting:');
      console.log('  1. Check printer is powered on');
      console.log('  2. Check USB cable is connected');
      console.log('  3. Try printing a test page from Windows');
      console.log('  4. Reinstall printer driver if needed');
      process.exit(1);
    }
  });

} catch (err) {
  console.error(`\n❌ Fatal Error: ${err.message}`);
  console.log('\nMake sure node-printer is installed:');
  console.log('  npm install node-printer');
  process.exit(1);
}
