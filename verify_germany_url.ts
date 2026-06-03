import * as fs from 'fs';

async function verifyURL() {
  console.log('='.repeat(80));
  console.log('CHECKING GERMANY NAVIGATION LOGO URL');
  console.log('='.repeat(80) + '\n');
  
  const url = 'https://assets.cdn.filesafe.space/By2ouDwVDtWabLH4FJkE/media/69c17b74e42c2de1c6768780.webp';
  
  console.log(`URL: ${url}\n`);
  
  try {
    console.log('1️⃣ Fetching URL...\n');
    const response = await fetch(url, { method: 'HEAD', timeout: 10000 });
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Content-Length: ${response.headers.get('content-length')} bytes`);
    
    if (response.ok) {
      console.log(`\n✅ URL IS ACCESSIBLE - Image exists on CDN`);
    } else {
      console.log(`\n❌ URL returned error - Image may have been deleted`);
    }
  } catch (err: any) {
    console.log(`❌ ERROR: ${err.message}`);
    console.log(`\n⚠️  CDN is unreachable or URL is broken`);
  }
  
  console.log('\n2️⃣ Checking backup for comparison...\n');
  
  const backup = JSON.parse(fs.readFileSync('data/backup-2026-05-02.json', 'utf8'));
  const backupNav = backup.settings.navigation;
  const backupNationalTeams = backupNav.navigationMenus.find((m: any) => m.label === 'NATIONAL TEAMS');
  const backupEurope = backupNationalTeams?.submenus?.find((s: any) => s.heading === 'Europe');
  const backupGermany = backupEurope?.items?.find((i: any) => i.label === 'Germany');
  
  console.log(`Backup Germany Logo:`);
  console.log(`  Format: ${backupGermany.logo.substring(0, 50)}`);
  console.log(`  Length: ${backupGermany.logo.length} bytes`);
  console.log(`  Full: ${backupGermany.logo}`);
  
  console.log('\n3️⃣ COMPARISON:\n');
  
  if (backupGermany.logo.startsWith('data:')) {
    console.log('✅ Backup has base64 SVG (embedded image data)');
  } else if (backupGermany.logo.startsWith('http')) {
    console.log('📌 Backup has external URL (CDN link)');
  }
  
  console.log(`\nCurrent in Supabase: ${url.substring(0, 60)}...`);
  console.log(`Backup has:          ${backupGermany.logo.substring(0, 60)}...`);
  
  const match = url === backupGermany.logo;
  console.log(`\nMatch: ${match ? '✅ YES - Same data' : '❌ NO - Different!'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  console.log('Issue: The Germany navigation logo is pointing to an external CDN');
  console.log(`URL: ${url}`);
  console.log(`Status: ${response?.ok ? '✅ URL is accessible' : '❌ URL is broken'}`);
  console.log(`\nSolution: Admin can upload a new image through admin panel.`);
  console.log(`OR: Restore base64 SVG logos from backup like other countries have.`);
  
}

verifyURL();
