import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://backend.bam-karaokebox.com/index.php/login_backend?utm_source=bkb-website-tests&utm_medium=qa-bot&utm_campaign=monitoring';

const VENUES = [{
  name: 'Richer',
  id: 2,
  floorPrice: 5,
}, {
  name: 'Sentier',
  id: 3,
  floorPrice: 5,
}, {
  name: 'Parmentier',
  id: 4,
  floorPrice: 5,
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
  floorPrice: 5,
},
{
  name: 'Etoile',
  id: 8,
  floorPrice: 5,
}];

let listdata: any = [];
const Erreur: any = [];
let Creneau: string[];
let PrixSalle: string[];
let PrixPerson: string[];

const getdata = async (page: any, value: number) => {
  const getCreneau = await page.evaluate((data: number = value) => {
    const ListeSeance = [];
    const NumberSlot = document.querySelectorAll('div.slot.available').length;
    for (let i = 0; i < NumberSlot; i++) {
      ListeSeance.push(document.querySelectorAll('div.slot.available')[i].childNodes[data].nodeValue);
    }
    return (ListeSeance);
    }, value);
  return (listdata = getCreneau);
};

const checkPrice = async (page: any, venuePath: any) => {

  await page.waitForSelector('.booking .calendar .screen');

  // Create a list compose of the "name" of room and date of each available slot
  const RoomSlot = await page.evaluate(() => {
    const ListeSalle = [];
    const NumberRoom = document.querySelectorAll('.screen').length;
    let date;
    date = document.querySelectorAll('div.slot input')[0].dataset.bookingDate;
    date = date.substring(6, 10) + '/' + date.substring(0, 2) + '/' + date.substring(3, 5);
    for (let j = 0; j < NumberRoom; j++) {
      const RoomName = document.querySelectorAll('div.capacity')[j].childNodes[0].nodeValue;
      const NumberSlot = document.querySelectorAll('div.places')[j].querySelectorAll('div.available').length;
      if (NumberSlot !== 0) {
        for (let i = 0; i < NumberSlot; i++) {
          ListeSalle.push(RoomName + date);
        }
      }
    }
    return ListeSalle;
  });

  // Create a list compose of slot duration
  const HourSlot = await page.evaluate(() => {
    const ListeTime = [];
    const NumberSlot = document.querySelectorAll('div.slot.available').length;
    for (let i = 0; i < NumberSlot; i++) {
      let StartHours = document.querySelectorAll('div.available input')[i].dataset.bookingFrom;
      let EndHours = document.querySelectorAll('div.available input')[i].dataset.bookingTo;
      StartHours = parseInt(StartHours[0] + StartHours[1] + StartHours[3] + StartHours[4] , 10);
      EndHours = parseInt(EndHours[0] + EndHours[1] + EndHours[3] + EndHours[4] , 10);
      if (EndHours < 1000 && parseInt(StartHours, 10) > 1400) {
        EndHours = EndHours + 2400;
      }
      ListeTime.push(JSON.stringify((EndHours - StartHours) / 100));
    }
    return (ListeTime);
    });

  // Create a list compose of hours of each available slot
  await getdata(page, 0);
  Creneau = listdata;

  // Create a list compose of price of each available slot
  await getdata(page, 2);
  PrixSalle = listdata;

  // Create a list compose of price per person of each available slot
  await getdata(page, 4);
  PrixPerson = listdata;

  // Verify the price by person between 14 hours and 3 hours then it create the list Erreur
  for (let i = 0; i < PrixPerson.length; i++) {
    const Result = [RoomSlot, Creneau, PrixSalle, PrixPerson];
    const pricePerPerson = parseInt(PrixPerson[i], 10);
    const venueFloorPrice = parseInt(venuePath.floorPrice, 10);
    const sessionTime = HourSlot[i][0];
    if (pricePerPerson < venueFloorPrice * sessionTime) {
      Erreur.push(`\n Error detected at ${venuePath.name} : ${Result[0][i]} ${Result[1][i]} for ${Result[2][i]} and ${Result[3][i]}
       we expect to have a price superior at ${venueFloorPrice * sessionTime}€ per person \n`);
    }
  }
};

const checkPriceforeachVenues = async (page: any, venuePath: any) => {
    { test.setTimeout(180000); }

    await page.locator('select[name="calendar_place"]').selectOption(JSON.stringify(venuePath.id));
    await page.waitForSelector('.booking .calendar .screen');

    // browse the calendar
    for (let day = 0; day < 31; day++) {
      await page.waitForSelector('.booking .calendar .screen');

      // dedicated to site where there only one page of reservation
      if (await page.isHidden('.btn-prev-room', {strict: true}) && await page.isHidden('.btn-next-room', {strict: true})) {
        checkPrice(page, venuePath);
        await page.click('.col-md-5 .btn-next');
      }

      // browse reservation page from the left to the right
      if (await page.isVisible('.btn-next-room', {strict: true})) {
        while (await page.isVisible('.btn-next-room', {strict: true})) {

          checkPrice(page, venuePath);

          await page.click('.btn-next-room');
          await page.waitForSelector('.booking .calendar .screen');
        }
      }

      // browse reservation page from the right to the left and change the day
      if (await page.isVisible('.btn-prev-room', {strict: true})) {

        checkPrice(page, venuePath);

        await page.click('.col-md-5 .btn-next');
        await page.waitForSelector('.btn-prev-room');

        while (await page.isVisible('.btn-prev-room', {strict: true})) {
          await page.waitForSelector('.btn-prev-room');
          await page.click('.btn-prev-room');
          await page.waitForSelector('.booking .calendar .screen , .booking .calendar a');
        }
      }
    }
    if (Erreur.length !== 0) {
      throw new Error(
        Erreur,
      );
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
