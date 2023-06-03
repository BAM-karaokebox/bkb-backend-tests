import { FullConfig } from '@playwright/test';
import fs from 'fs';

function globalSetup(config: FullConfig) {
  console.log('what');
  if (!fs.existsSync('./PriceCSV/')) {
    fs.mkdirSync('./PriceCSV/');
  }
  fs.writeFileSync(
    `./PriceCSV/backoffice-prices.csv`,
    'VENUE,ROOM,DATE,SLOT,PRICE_PER_PERSON,EXPECTED_PRICE_PER_PERSON,TOTAL_PRICE\n'
  );
}

export default globalSetup;
