const chromium = require('chrome-aws-lambda');
const PRODUCT_URL = 'https://www.bestbuy.com/site/sony-playstation-5-console/6426149.p?skuId=6426149';

exports.stockAlerter = async (event, context, callback) => {
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

    await page.goto(PRODUCT_URL,
      {
        waitUntil: 'load',
        timeout: 0
      });

    const data = await page.$eval('*', el => el.innerText);
    const dataStr = JSON.stringify(data);

    if (isAvailable(dataStr)) {
      await sendMessage('hey best buy now has your ps5')
    }

    puppeteerRun = 'successfully ran puppeteer and alerter';
  } catch (e) {
    console.log(e);
    throw new Error(e);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
  return puppeteerRun;
}

const isAvailable = (dataStr) => {
  const newlinesRegex = /(?:\r\n|\r|\n)/;

  const lines = dataStr.split(newlinesRegex);
  for (const line of lines) {
    if (line.toLowerCase().includes('sold out')) {
      return false;
    }
  }
  return true;
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
    console.log('successfully sent message from twilio', message.sid);
  } catch (e) {
    console.log('failed to send message from twilio', e);
  }
}