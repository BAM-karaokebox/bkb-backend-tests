import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://backend.bam-karaokebox.com/index.php/login_backend?utm_source=bkb-website-tests&utm_medium=qa-bot&utm_campaign=monitoring';

const VENUES = [{
  name: 'Richer',
  id: 2,
  floorPrice: 4.5,
}, {
  name: 'Sentier',
  id: 3,
  floorPrice: 4.5,
}, {
  name: 'Parmentier',
  id: 4,
  floorPrice: 4.5,
}, {
  name: 'Chartrons',
  id: 5,
  floorPrice: 3,
}, {
  name: 'Recoletos',
  id: 6,
  floorPrice: 4,
}, {
  name: 'Madeleine',
  id: 7,
  floorPrice: 4.5,
}, {
  name: 'Etoile',
  id: 8,
  floorPrice: 4.5,
}];

const Errors: any = [];

const getdata = async (page: any, value: number) => {
  return await page.evaluate((data: number = value) => {
    return Array
      .from(document.querySelectorAll('div.slot.available'))
      .map(slot => (slot.childNodes[data].nodeValue || '').trim());
  }, value);
};

const checkPrice = async (page: any, venuePath: any) => {
  await page.waitForSelector('.booking .calendar .screen');

  // Create a list compose of the "name" of room and date of each available slot
  const roomSlots = await page.evaluate(() => {
    const rooms = [];
    const roomNumber = document.querySelectorAll('.screen').length;
    let date;
    date = document.querySelectorAll('div.slot input')[0].dataset.bookingDate;
    date = date.substring(6, 10) + '/' + date.substring(0, 2) + '/' + date.substring(3, 5);
    const capacities = document.querySelectorAll('div.capacity');
    const places = document.querySelectorAll('div.places');
    for (let j = 0; j < roomNumber; j++) {
      const roomName = (capacities[j].childNodes[0].nodeValue || '').replace('Salle', '').trim();
      const numberSlot = places[j].querySelectorAll('div.available').length;
      if (numberSlot !== 0) {
        for (let i = 0; i < numberSlot; i++) {
          rooms.push(`${roomName} (${date})`);
        }
      }
    }
    return rooms;
  });

  // Create a list compose of slot duration
  const sessions = await page.evaluate(() => {
    const sessionsList = [];
    const slotCounts = document.querySelectorAll('div.slot.available').length;
    const available = document.querySelectorAll('div.available input');
    for (let i = 0; i < slotCounts; i++) {
      const startTime = available[i].dataset.bookingFrom;
      const endTime = available[i].dataset.bookingTo;
      const startTimeInt = parseInt(startTime[0] + startTime[1] + startTime[3] + startTime[4] , 10);
      let endTimeInt = parseInt(endTime[0] + endTime[1] + endTime[3] + endTime[4] , 10);

      if (endTimeInt < 1000 && parseInt(startTime, 10) > 1400) {
        endTimeInt = endTimeInt + 2400;
      }
      sessionsList.push(JSON.stringify((endTimeInt - startTimeInt) / 100.00));
    }
    return (sessionsList);
  });

  // Create a list compose of hours of each available slot
  const timeSlots = await getdata(page, 0);

  // Create a list compose of price of each available slot
  const roomPrices = await getdata(page, 2);

  // Create a list compose of price per person of each available slot
  const roomPricesPerPerson = await getdata(page, 4);

  // Verify the price by person between 14 hours and 3 hours then it create the list Errors
  for (let i = 0; i < roomPricesPerPerson.length; i++) {
    const pricePerPerson = parseInt(roomPricesPerPerson[i], 10);
    const sessionTime = sessions[i][0];
    const expectedPricePerPerson = venuePath.floorPrice * sessionTime;

    if (pricePerPerson < expectedPricePerPerson) {
      Errors.push(`${venuePath.name} - ${roomSlots[i]} [${timeSlots[i]}] => got: ${pricePerPerson}€ per person / expected: > ${expectedPricePerPerson} per person (total: ${roomPrices[i]})`);
    }
  }
};

const checkPriceforeachVenues = async (page: any, venuePath: any) => {
    await page.locator('select[name="calendar_place"]').selectOption(JSON.stringify(venuePath.id));
    await page.waitForSelector('.booking .calendar .screen');

    // browse the calendar
    for (let day = 0; day < 31; day++) {
      await page.waitForSelector('.booking .calendar .screen');

      // dedicated to site where there only one page of reservation
      if (await page.isHidden('.btn-prev-room', {strict: true}) && await page.isHidden('.btn-next-room', {strict: true})) {
        await checkPrice(page, venuePath);
        await page.click('.col-md-5 .btn-next');
      }

      // browse reservation page from the left to the right
      if (await page.isVisible('.btn-next-room', {strict: true})) {
        while (await page.isVisible('.btn-next-room', {strict: true})) {

          await checkPrice(page, venuePath);

          await page.click('.btn-next-room');
          await page.waitForSelector('.booking .calendar .screen');
        }
      }

      // browse reservation page from the right to the left and change the day
      if (await page.isVisible('.btn-prev-room', {strict: true})) {

        await checkPrice(page, venuePath);

        await page.click('.col-md-5 .btn-next');
        await page.waitForSelector('.btn-prev-room');

        while (await page.isVisible('.btn-prev-room', {strict: true})) {
          await page.waitForSelector('.btn-prev-room');
          await page.click('.btn-prev-room');
          await page.waitForSelector('.booking .calendar .screen , .booking .calendar a');
        }
      }
    }
    if (Errors.length !== 0) {
      throw new Error('\n' + Errors.join('\n'));
    }
};

VENUES.forEach(venue => {
  test(`Venue: ${venue.name}`, async ({ page }) => checkPriceforeachVenues(page, venue));
});

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.type('input[name=_username]', process.env.AUTH_USER_BACK);
  await page.type('input[name=_password]', process.env.AUTH_PASS_BACK);
  await page.keyboard.press('Enter');
});
