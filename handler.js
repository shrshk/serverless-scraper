const chromium = require('chrome-aws-lambda');
const MONTH_I_CARE = process.env.MONTH_I_CARE || 'April';

const daysICare = (input) => {
    if (!input) {
        return ['4', '5', '6', '7', '8'];
    }

    let days = [];

    const inputArray = input.toString().split(',');

    for (let i=0; i<inputArray.length; i++) {
        days.push(inputArray[i].toString());
    }

    return days;
}

const DAYS_I_CARE = daysICare(process.env.DAYS_I_CARE);

exports.ticketAlerter = async (event, context, callback) => {
    let result = null;

    try {
        result = await runPuppeteer();
    } catch (error) {
        return callback(error);
    }

    return callback(null, result);
};

const runPuppeteer = async () => {
    let puppeteerRun = null;
    let browser = null;

    try {
        browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();

        await page.goto('https://www.recreation.gov/ticket/253731/ticket/255');

        const datePicker = await page.$('.DateInput');

        await datePicker.focus();
        await datePicker.click();

        await page.waitForSelector('.DayPicker');

        const calendarMonthGrid = await page.$('.CalendarMonth');
        await calendarMonthGrid.focus();

        await page.waitForSelector('.DayPickerNavigation_button');

        await page.waitForSelector('.CalendarMonth');

        let month = '';
        let monthIdx = '';

        const monthArray = await page.$$('.CalendarMonth');

        for (let i=0; i<monthArray.length; i++) {
            month = await monthArray[i].evaluate(el => el.textContent);
            if (month.includes(MONTH_I_CARE)) {
                monthIdx = i;
            }
        }

        // TO DO
        // if monthIdx is empty click the calendarNavigator
        // let calendarNavigator = await page.$('.DayPickerNavigation_button');

        const tables = await page.$$('.CalendarMonth_table');

        const tds = await tables[monthIdx].$$('td');

        for (let i=0; i<tds.length; i++) {
            const data = await ( tds[i].$('div'));
            if (data == null) {
                continue;
            }
            const dateAvailability = await data.evaluate(el => el.textContent);
            const dateAvailabilitySplit = dateAvailability.match(/[a-zA-Z]+|[0-9]+/g);
            const resDays = getAvailableDaysICare(dateAvailabilitySplit[0].toString(), dateAvailabilitySplit[1].toString());

            if (resDays.length > 0) {
                const messageBody = `Hey! Haleakala National Park Summit Sunrise Reservations are now available for 
                    ${MONTH_I_CARE} ${resDays.toString()}`
                await sendMessage(messageBody);
            }
        }
        puppeteerRun = 'successfully ran puppeteer and alerter';
    } catch (e) {
        throw new Error(e);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
    return puppeteerRun;
}

const getAvailableDaysICare = (day, availability) => {
    let resDays = [];
    if (DAYS_I_CARE.includes(day) && availability === 'A') {
        resDays.push(day);
    }
    return resDays;
}

const sendMessage = async (body) => {
    const accountSid = process.env.ACCOUNT_SID;
    const authToken = process.env.AUTH_TOKEN;
    const messagingServiceSid = process.env.MESSAGE_SERVICE_SID;
    const to = process.env.PHONE_NUMBER;
    const client = require('twilio')(accountSid, authToken);

    try {
        const message = await client.messages
            .create({
                body,
                messagingServiceSid,
                to
            });
        console.log('successfully sent message from twilio');
    } catch (e) {
        console.log('failed to send message from twilio', e);
    }
}
