// ================================
// TELEGRAM NLP CALCULATOR + JOKE + QUOTE BOT (with APIs) + firebase integration
// ================================

const TelegramBot = require('node-telegram-bot-api');
const { NlpManager } = require('node-nlp');
require('dotenv').config();
const axios = require('axios'); // for API calls
// firebase..admin
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Firebase Service Account
const serviceAccount = require('./key.json');

// Initialize Firebase
initializeApp({
  credential: cert(serviceAccount)
});

// Firestore reference
const db = getFirestore();


// --- Replace with your real token ---
const token =process.env.BOT_TOKEN;

// --- Create bot instance ---
const bot = new TelegramBot(token, { polling: true });

// --- NLP Manager setup ---
const manager = new NlpManager({ languages: ['en'] });

// -----------------------------
// STEP 1: TRAIN NLP MODEL
// -----------------------------

// Math intents
manager.addDocument('en', 'add %number% and %number%', 'math.add');
manager.addDocument('en', 'what is %number% plus %number%', 'math.add');
manager.addDocument('en', '%number% + %number%', 'math.add');

manager.addDocument('en', 'subtract %number% from %number%', 'math.subtract');
manager.addDocument('en', 'what is %number% minus %number%', 'math.subtract');
manager.addDocument('en', '%number% - %number%', 'math.subtract');

manager.addDocument('en', 'multiply %number% and %number%', 'math.multiply');
manager.addDocument('en', '%number% times %number%', 'math.multiply');
manager.addDocument('en', '%number% * %number%', 'math.multiply');

manager.addDocument('en', 'divide %number% by %number%', 'math.divide');
manager.addDocument('en', 'what is %number% divided by %number%', 'math.divide');
manager.addDocument('en', '%number% / %number%', 'math.divide');

// Joke intents
manager.addDocument('en', 'tell me a joke', 'fun.joke');
manager.addDocument('en', 'make me laugh', 'fun.joke');
manager.addDocument('en', 'say something funny', 'fun.joke');

// Quote intents
manager.addDocument('en', 'give me a quote', 'fun.quote');
manager.addDocument('en', 'motivational quote', 'fun.quote');
manager.addDocument('en', 'inspire me', 'fun.quote');

// Named entity for numbers
for (let i = 0; i <= 100; i++) {
  manager.addNamedEntityText('number', i.toString(), ['en'], [i.toString()]);
}

// -----------------------------
// STEP 2: TRAIN AND START BOT
// -----------------------------
(async () => {
  console.log('⏳ Training NLP model...');
  await manager.train();
  manager.save();
  console.log('✅ NLP Bot trained!');

  startBot();
})();

// -----------------------------
// STEP 3: BOT LOGIC
// -----------------------------
function startBot() {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text === '/start') {
      return bot.sendMessage(
        chatId,
        "👋 Hi! I'm your Smart Bot 🤖\nI can:\n• Calculate math\n• Tell jokes\n• Send motivational quotes\nTry something like 'add 5 and 6' or 'tell me a joke'.\n * securely store user data and allow access using 'INSERT'and 'GET' commands."
      );
    }
    // firebase commands...
  const newMsg = text.split(" ");

  // INSERT command
  if (newMsg[0] === 'INSERT') {

    db.collection('personalData').add({
      key: newMsg[1],            // Example: aadhaar
      dataValue: newMsg[2],      // Example: 12345688246 (dummy)
      userID: msg.from.id
    })
    .then(() => {
      bot.sendMessage(
        msg.chat.id,
        newMsg[1] + " stored successfully"
      );
    })
    .catch((error) => {
      bot.sendMessage(msg.chat.id, "Error storing data");
      console.error(error);
    });
    return;
  }

  // GET command
   if (newMsg[0] === 'GET') {
      const requestedKey = newMsg[1];
    db.collection('personalData')
      .where('userID', '==', msg.from.id)
      .where('key','==',requestedKey)
      .get()
      .then((docs) => {
        if (docs.empty) {
           bot.sendMessage(msg.chat.id, "Data not found");
          return;
         }

    docs.forEach((doc) => {
    bot.sendMessage(
    msg.chat.id,
    newMsg[1] + " : " + doc.data().dataValue
  );
});
      })
      .catch((error) => {
        bot.sendMessage(msg.chat.id, "Error fetching data");
        console.error(error);
      });
    return;
  }

    try {
      const response = await manager.process('en', text);
      const intent = response.intent;
      const entities = response.entities;

      // --- MATH OPERATIONS ---
      if (intent.startsWith('math') && entities.length >= 2) {
        const num1 = parseFloat(entities[0].sourceText);
        const num2 = parseFloat(entities[1].sourceText);
        let result;

        switch (intent) {
          case 'math.add':
            result = num1 + num2;
            break;
          case 'math.subtract':
            result = num2 - num1;
            break;
          case 'math.multiply':
            result = num1 * num2;
            break;
          case 'math.divide':
            result = num2 / num1;
            break;
        }

        return bot.sendMessage(chatId, `🧮 Result: ${result}`);
      }

      // --- JOKE FROM API ---
      else if (intent === 'fun.joke') {
        try {
          const res = await axios.get('https://v2.jokeapi.dev/joke/Any');
          if (res.data.type === 'single') {
            bot.sendMessage(chatId, `😂 ${res.data.joke}`);
          } else {
            bot.sendMessage(chatId, `😂 ${res.data.setup}\n${res.data.delivery}`);
          }
        } catch (error) {
          bot.sendMessage(chatId, "😅 Couldn't fetch a joke right now. Try again later!");
        }
      }

      // --- QUOTE FROM API ---
      else if (intent === 'fun.quote') {
  try {
    const res = await axios.get('https://api.quotable.io/random');
    
    if (res.data && res.data.content) {
      const quote = res.data.content;
      const author = res.data.author || 'Unknown';
      bot.sendMessage(chatId, `💬 "${quote}"\n– ${author}`);
    } else {
      bot.sendMessage(chatId, "😅 Couldn't find a quote. Try again!");
    }

  } catch (error) {
    console.error("Quote API Error:", error.message);
    bot.sendMessage(chatId, "⚠️ Couldn't get a quote right now. Try again later!");
  }
}

      // --- DEFAULT REPLY ---
      else {
        bot.sendMessage(chatId, "🤖 Try asking me to calculate, tell a joke, or share a quote!");
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      bot.sendMessage(chatId, '⚠️ Something went wrong. Try again.');
    }
  });
}