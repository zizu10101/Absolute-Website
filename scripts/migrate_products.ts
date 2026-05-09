import fs from 'fs/promises';
import path from 'path';

async function migrate() {
  try {
    const backupPath = path.join(process.cwd(), 'data', 'backup-2026-05-02.json');
    const productsPath = path.join(process.cwd(), 'data', 'products.json');
    
    console.log(`Reading backup from ${backupPath}...`);
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf-8'));
    
    const rawProducts = Array.isArray(backupData) ? backupData : (backupData.products || []);
    
    console.log(`Found ${rawProducts.length} products in backup.`);

    const allowedFields = [
      'id', 'name', 'price', 'category', 'submenu', 'submenus',
      'image', 'images', 'description', 'isNewArrival', 
      'isOnSale', 'isFeatured', 'salePrice', 'colors'
    ];

    const sanitizedProducts = rawProducts.map((p: any) => {
      const sanitized: any = {};
      allowedFields.forEach(field => {
        if (p[field] !== undefined) {
          sanitized[field] = p[field];
        }
      });
      return sanitized;
    });

    console.log(`Writing ${sanitizedProducts.length} products...`);
    const jsonContent = JSON.stringify(sanitizedProducts, null, 2);
    await fs.writeFile(productsPath, jsonContent);
    console.log(`Successfully migrated ${sanitizedProducts.length} products to ${productsPath}.`);
    
    // Also update products_exported.json
    const exportedPath = path.join(process.cwd(), 'data', 'products_exported.json');
    await fs.writeFile(exportedPath, jsonContent);
    console.log(`Also updated ${exportedPath}`);

  } catch (e) {
    console.error('Migration failed:', e);
  }
}

migrate();
