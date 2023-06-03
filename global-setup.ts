import { FullConfig } from '@playwright/test';
import fs from 'fs';

function globalSetup(config: FullConfig) {
  console.log('what');
  if (!fs.existsSync('./PriceCSV/')) {
    fs.mkdirSync('./PriceCSV/');
  }
  fs.writeFileSync(`./PriceCSV/backoffice-prices.csv`, '');
}

export default globalSetup;
