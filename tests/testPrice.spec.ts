import { test, Page } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BASE_URL =
  'https://backend.bam-karaokebox.com/index.php/login_backend?utm_source=bkb-website-tests&utm_medium=qa-bot&utm_campaign=monitoring';

interface Venue {
  name: string;
  id: number;
  floorPrice: number;
}

interface PriceErrorRecord {
  csv: string;
  message: string;
}

const START_DATE = new Date();
const DAYS = 60;
const VENUES: Venue[] = [
  {
    name: 'Richer',
    id: 2,
    floorPrice: 4.5,
  },
  {
    name: 'Sentier',
    id: 3,
    floorPrice: 4.5,
  },
  {
    name: 'Parmentier',
    id: 4,
    floorPrice: 4.5,
  },
  {
    name: 'Chartrons',
    id: 5,
    floorPrice: 3,
  },
  {
    name: 'Recoletos',
    id: 6,
    floorPrice: 4,
  },
  {
    name: 'Madeleine',
    id: 7,
    floorPrice: 4.5,
  },
  {
    name: 'Etoile',
    id: 8,
    floorPrice: 4.5,
  },
  {
    name: 'Luchana',
    id: 10,
    floorPrice: 4,
  },
];

const getData = async (page: Page, value: number): Promise<string[]> =>
  await page.evaluate(
    (data: number = value) =>
      Array.from(document.querySelectorAll('div.slot.available')).map((slot) =>
        (slot.childNodes[data].nodeValue || '').trim()
      ),
    value
  );

const checkPrice = async (page: Page, venue: Venue): Promise<PriceErrorRecord[]> => {
  // Create a list compose of the 'name' of room and date of each available slot
  const date: string = await page.evaluate(() => {
    /*
     * Extracts date from as yyyy/mm/dd string from a dd.?mm.?yyyy string
     * (e.g. '12/03/2022' -> '2022/03/12')
     */
    const extractDate = (date: string): string =>
      date.substring(6, 10) + '/' + date.substring(0, 2) + '/' + date.substring(3, 5);
    return extractDate(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      document.querySelectorAll('div.slot input')[0].dataset.bookingDate as string
    );
  });
  const rooms: string[] = await page.evaluate(() => {
    const rooms = [];
    const roomNumber = document.querySelectorAll('.screen').length;
    const capacities = document.querySelectorAll('div.capacity');
    const places = document.querySelectorAll('div.places');
    for (let j = 0; j < roomNumber; j++) {
      const roomName = (capacities[j].childNodes[0].nodeValue || '').replace('Salle', '').trim();
      const numberSlot = places[j].querySelectorAll('div.available').length;
      if (numberSlot !== 0) {
        for (let i = 0; i < numberSlot; i++) {
          rooms.push(`${roomName}`);
        }
      }
    }
    return rooms;
  });

  // Create a list compose of slot duration
  const sessions: string[] = await page.evaluate(() => {
    /*
     * Extracts time as Int from a HH:MM string
     * (e.g. '14:32' -> '1432')
     */
    const extractTimeAsInt = (time: string): number => parseInt(time[0] + time[1] + time[3] + time[4], 10);
    const sessionsList: string[] = [];
    const slotCounts = document.querySelectorAll('div.slot.available').length;
    const available = document.querySelectorAll('div.available input');
    for (let i = 0; i < slotCounts; i++) {
      const startTime: string = available[i].dataset.bookingFrom as string; // eslint-disable-line @typescript-eslint/no-unsafe-member-access
      const endTime: string = available[i].dataset.bookingTo as string; // eslint-disable-line @typescript-eslint/no-unsafe-member-access
      const startTimeInt: number = extractTimeAsInt(startTime);
      let endTimeInt: number = extractTimeAsInt(endTime);

      if (endTimeInt < 1000 && startTimeInt > 1400) {
        endTimeInt = endTimeInt + 2400;
      }
      sessionsList.push(JSON.stringify((endTimeInt - startTimeInt) / 100.0));
    }
    return sessionsList;
  });

  // Create a list compose of hours of each available slot
  const timeSlots = await getData(page, 0);

  // Create a list compose of price of each available slot
  const roomPrices = await getData(page, 2);

  // Create a list compose of price per person of each available slot
  const roomPricesPerPerson = await getData(page, 4);

  // Verify the price by person for all matching sessions and create a list of errors
  const errors: PriceErrorRecord[] = [];
  for (let i = 0; i < roomPricesPerPerson.length; i++) {
    const pricePerPerson: string = parseInt(roomPricesPerPerson[i], 10) as unknown as string;
    const sessionTime: number = parseFloat(sessions[i][0]);
    const expectedPricePerPerson: string = (venue.floorPrice * sessionTime) as unknown as string;

    if (pricePerPerson < expectedPricePerPerson) {
      errors.push({
        csv: `${venue.name},${rooms[i]},${date},${timeSlots[i]},${pricePerPerson},${expectedPricePerPerson},${roomPrices[i]}`,
        message: `${venue.name} - ${rooms[i]} (${date}) [${timeSlots[i]}] => got: ${pricePerPerson}€ per person / expected: > ${expectedPricePerPerson} per person (total: ${roomPrices[i]})`,
      });
    }
  }
  return errors;
};

const checkPricesForVenue = async (page: Page, venue: Venue, date: Date): Promise<PriceErrorRecord[]> => {
  const errors: PriceErrorRecord[] = [];

  // select the desired venue
  await page.selectOption('#calendar_place', venue.id.toString(10));
  await page.waitForSelector('.booking .calendar .screen');

  // select the desired date
  await page.locator('#date').evaluate((el) => el.removeAttribute('readonly'));
  await page.fill('#date', `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`);
  await page.keyboard.press('Enter');

  // wait for calendar view refresh
  await page.waitForSelector('.booking .calendar .screen');

  // dedicated to site where there only one page of reservation
  if (await page.isHidden('.btn-next-room', { strict: true })) {
    errors.push(...(await checkPrice(page, venue)));
  } else {
    // browse reservation page from the left to the right
    while (await page.isVisible('.btn-next-room', { strict: true })) {
      errors.push(...(await checkPrice(page, venue)));
      await page.click('.btn-next-room');
      await page.waitForSelector('.booking .calendar .screen');
      await checkPrice(page, venue);
    }
  }
  return errors;
};

const getFutureDate = (givenDate: Date, increment: number): Date =>
  new Date(givenDate.getTime() + increment * 24 * 60 * 60 * 1000);

/*
 * A simpler helper to get a yyyy-mm-dd local short date string.
 *
 * As Date.toISOString outputs in UTC / Zulu time, we create a modified
 * date where we cancel out the timezone offset, so we can't have a
 * timezone issue.
 * ie if you try to call new Date().toISOString() between 00:00
 * and 02:00 in France during summer time (meaning in GMT+2), it'd
 * return yesterday's date. This method fixes that.
 */
const dateToLocalISOShortDate = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().substring(0, 10);
};

test.describe('Backoffice Price Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.type('input[name=_username]', process.env.AUTH_USER_BACK || '');
    await page.type('input[name=_password]', process.env.AUTH_PASS_BACK || '');
    await page.keyboard.press('Enter');
  });

  [...Array(DAYS).keys()].forEach((day) => {
    const testDay: Date = getFutureDate(START_DATE, day);

    VENUES.forEach((venue) => {
      test(`${dateToLocalISOShortDate(testDay)} - ${venue.name}`, async ({ page }) => {
        const errors = await checkPricesForVenue(page, venue, testDay);
        const invalidPriceRows: string[] = [];

        if (errors.length !== 0) {
          invalidPriceRows.push(...errors.map((e) => e.csv));
          fs.appendFileSync(`./PriceCSV/backoffice-prices.csv`, invalidPriceRows.join('\n') + '\n');
          throw new Error(`\n${errors.map((e) => e.message).join('\n')}'\n`);
        }
      });
    });
  });
});
