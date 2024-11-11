/**
 * Funções comuns que são exportadas para facilitar o uso no index.js.
 *
 * Dev Gui </>
 */
const { downloadContentFromMessage } = require("baileys");
const { TEMP_DIR, PREFIX, BOT_EMOJI } = require("../config");
const path = require("node:path");
const fs = require("node:fs");
const { writeFile } = require("node:fs/promises");
const axios = require("axios");

function loadLiteFunctions({ socket, data }) {
  if (!data?.messages?.length) {
    return null;
  }

  const lite = socket;

  const info = data.messages[0];

  const {
    args,
    body,
    command,
    from,
    fullArgs,
    isReply,
    prefix,
    replyJid,
    userJid,
  } = extractDataFromInfo(info);

  if (!from) {
    return null;
  }

  const isImage = baileysIs(info, "image");
  const isVideo = baileysIs(info, "video");
  const isSticker = baileysIs(info, "sticker");

  const downloadImage = async (info, fileName) => {
    return await download(info, fileName, "image", "png");
  };

  const downloadSticker = async (info, fileName) => {
    return await download(info, fileName, "sticker", "webp");
  };

  const downloadVideo = async (info, fileName) => {
    return await download(info, fileName, "video", "mp4");
  };

  const sendText = async (text, mentions) => {
    let optionalParams = {};

    if (mentions?.length) {
      optionalParams = { mentions };
    }

    return await lite.sendMessage(from, {
      text: `${BOT_EMOJI} ${text}`,
      ...optionalParams,
    });
  };

  const reply = async (text) => {
    return await lite.sendMessage(
      from,
      { text: `${BOT_EMOJI} ${text}` },
      { quoted: info }
    );
  };

  const react = async (emoji) => {
    return await lite.sendMessage(from, {
      react: {
        text: emoji,
        key: info.key,
      },
    });
  };

  const successReact = async () => {
    return await react("✅");
  };

  const waitReact = async () => {
    return await react("⏳");
  };

  const warningReact = async () => {
    return await react("⚠️");
  };

  const errorReact = async () => {
    return await react("❌");
  };

  const successReply = async (text) => {
    await successReact();
    return await reply(`✅ ${text}`);
  };

  const waitReply = async (text) => {
    await waitReact();
    return await reply(`⏳ Aguarde! ${text || waitMessage}`);
  };

  const warningReply = async (text) => {
    await warningReact();
    return await reply(`⚠️ Atenção! ${text}`);
  };

  const errorReply = async (text) => {
    await errorReact();
    return await reply(`❌ Erro! ${text}`);
  };

  const stickerFromFile = async (file) => {
    return await lite.sendMessage(
      from,
      {
        sticker: fs.readFileSync(file),
      },
      { quoted: info }
    );
  };

  const stickerFromURL = async (url) => {
    return await lite.sendMessage(
      from,
      {
        sticker: { url },
      },
      { url, quoted: info }
    );
  };

  const imageFromFile = async (file, caption = "") => {
    return await lite.sendMessage(
      from,
      {
        image: fs.readFileSync(file),
        caption: caption ? `${BOT_EMOJI} ${caption}` : "",
      },
      { quoted: info }
    );
  };

  const imageFromURL = async (url, caption = "") => {
    return await lite.sendMessage(
      from,
      {
        image: { url },
        caption: caption ? `${BOT_EMOJI} ${caption}` : "",
      },
      { url, quoted: info }
    );
  };

  const audioFromURL = async (url) => {
    return await lite.sendMessage(
      from,
      {
        audio: { url },
        mimetype: "audio/mp4",
      },
      { url, quoted: info }
    );
  };

  const videoFromURL = async (url) => {
    return await lite.sendMessage(
      from,
      {
        video: { url },
      },
      { url, quoted: info }
    );
  };

  return {
    args,
    body,
    command,
    from,
    fullArgs,
    info,
    isImage,
    isReply,
    isSticker,
    isVideo,
    lite,
    prefix,
    replyJid,
    userJid,
    audioFromURL,
    downloadImage,
    downloadSticker,
    downloadVideo,
    errorReact,
    errorReply,
    imageFromFile,
    imageFromURL,
    react,
    reply,
    sendText,
    stickerFromFile,
    stickerFromURL,
    successReact,
    successReply,
    videoFromURL,
    waitReact,
    waitReply,
    warningReact,
    warningReply,
  };
}

function extractDataFromInfo(info) {
  const textMessage = info.message?.conversation;
  const extendedTextMessage = info.message?.extendedTextMessage;
  const extendedTextMessageText = extendedTextMessage?.text;
  const imageTextMessage = info.message?.imageMessage?.caption;
  const videoTextMessage = info.message?.videoMessage?.caption;

  const body =
    textMessage ||
    extendedTextMessageText ||
    imageTextMessage ||
    videoTextMessage;

  if (!body) {
    return {
      args: [],
      body: "",
      command: "",
      from: "",
      fullArgs: "",
      isReply: false,
      prefix: "",
      replyJid: "",
      userJid: "",
    };
  }

  const isReply =
    !!extendedTextMessage && !!extendedTextMessage.contextInfo?.quotedMessage;

  const replyJid =
    !!extendedTextMessage && !!extendedTextMessage.contextInfo?.participant
      ? extendedTextMessage.contextInfo.participant
      : null;

  const userJid = info?.key?.participant?.replace(/:[0-9][0-9]|:[0-9]/g, "");

  const [command, ...args] = body.split(" ");

  const prefix = command.charAt(0);

  const commandWithoutPrefix = command.replace(new RegExp(`^[${PREFIX}]+`), "");

  return {
    args: splitByCharacters(args.join(" "), ["\\", "|", "/"]),
    body,
    command: formatCommand(commandWithoutPrefix),
    from: info?.key?.remoteJid,
    fullArgs: args.join(" "),
    isReply,
    prefix,
    replyJid,
    userJid,
  };
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function onlyLettersAndNumbers(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "");
}

function removeAccentsAndSpecialCharacters(text) {
  if (!text) {
    return "";
  }

  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function onlyNumbers(text) {
  return text.replace(/[^0-9]/g, "");
}

function formatCommand(text) {
  return onlyLettersAndNumbers(
    removeAccentsAndSpecialCharacters(text.toLocaleLowerCase().trim())
  );
}

function splitByCharacters(str, characters) {
  characters = characters.map((char) => (char === "\\" ? "\\\\" : char));
  const regex = new RegExp(`[${characters.join("")}]`);

  return str
    .split(regex)
    .map((str) => str.trim())
    .filter(Boolean);
}

function baileysIs(info, context) {
  return !!getContent(info, context);
}

function getContent(info, context) {
  return (
    info.message?.[`${context}Message`] ||
    info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[
      `${context}Message`
    ]
  );
}

async function download(info, fileName, context, extension) {
  const content = this.getContent(info, context);

  if (!content) {
    return null;
  }

  const stream = await downloadContentFromMessage(content, context);

  let buffer = Buffer.from([]);

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  const filePath = path.resolve(TEMP_DIR, `${fileName}.${extension}`);

  await writeFile(filePath, buffer);

  return filePath;
}

function toUserJid(number) {
  return `${onlyNumbers(number)}@s.whatsapp.net`;
}

function getBuffer(url, options) {
  return new Promise((resolve, reject) => {
    axios({
      method: "get",
      url,
      headers: {
        DNT: 1,
        "Upgrade-Insecure-Request": 1,
        range: "bytes=0-",
      },
      ...options,
      responseType: "arraybuffer",
      proxy: options?.proxy || false,
    })
      .then((res) => {
        resolve(res.data);
      })
      .catch(reject);
  });
}

function getRandomName(extension) {
  const fileName = getRandomNumber(0, 999999);

  if (!extension) {
    return fileName.toString();
  }

  return `${fileName}.${extension}`;
}

module.exports = {
  download,
  formatCommand,
  getBuffer,
  getContent,
  getRandomName,
  getRandomNumber,
  loadLiteFunctions,
  onlyLettersAndNumbers,
  onlyNumbers,
  removeAccentsAndSpecialCharacters,
  splitByCharacters,
  toUserJid,
};
