const faqs = [
  {
    requiredKeywords: ['free trial'],
    anyKeywords: ['how', 'get', 'where'],
    rejectedKeywords: [],
    response: 'To get a free-trial, use the </account:1448725316322332799> command.'
  },
  {
    requiredKeywords: ['lifetime'],
    anyKeywords: ['buy', 'get', 'purchase'],
    rejectedKeywords: [],
    response: 'To get a Lifetime, open a license purchase [ticket](https://discord.com/channels/1351338824759906345/1467505173697007843).'
  },
  {
    requiredKeywords: ['bot'],
    anyKeywords: ['off', 'down', 'offline'],
    rejectedKeywords: [],
    response: 'The bot is not down, please try again if you are having issues.\nIf the issue persists, please open a [ticket](https://discord.com/channels/1351338824759906345/1467505173697007843).'
  },
  {
    requiredKeywords: [],
    anyKeywords: ['interaction', 'application did not respond', "doesn't work"],
    rejectedKeywords: ['it works'],
    skipRequiredCheck: true,
    response: 'Please try again if you are having issues.\nIf the issue persists, please open a [ticket](https://discord.com/channels/1351338824759906345/1467505173697007843).'
  },
  {
    requiredKeywords: ['lifetime'],
    anyKeywords: ['how much', 'price', 'cost'],
    rejectedKeywords: ['slots'],
    response: 'Lifetime costs £6 and it lasts forever. You can open a [ticket](https://discord.com/channels/1351338824759906345/1467505173697007843) to purchase Lifetime.'
  },
  {
    requiredKeywords: ['how'],
    anyKeywords: ['work', 'homework', 'this', 'account'],
    rejectedKeywords: ['are you', 'can you'],
    response: 'Please read https://discord.com/channels/1351338824759906345/1353117334021210325 and search in https://discord.com/channels/1351338824759906345/1447632966426558536 first and if you still need help, open a [ticket](https://discord.com/channels/1351338824759906345/1467505173697007843).'
  }

  // Example template (disabled):
  // {
  //   requiredKeywords: ['bot'],
  //   anyKeywords: ['not working', 'down', 'offline'],
  //   rejectedKeywords: [],
  //   response: "We're aware of the issue and are working to resolve it as quickly as possible.\nThank you for your patience!"
  // }
];

function cleanKeywords(arr) {
  // Defensive: remove empty strings / non-strings
  return (arr ?? []).filter(k => typeof k === 'string' && k.trim().length > 0).map(k => k.toLowerCase());
}

function handleFAQ(message) {
  const messageContent = (message.content ?? '').toLowerCase();

  for (const rawFaq of faqs) {
    const faq = {
      skipRequiredCheck: !!rawFaq.skipRequiredCheck,
      requiredKeywords: cleanKeywords(rawFaq.requiredKeywords),
      anyKeywords: cleanKeywords(rawFaq.anyKeywords),
      rejectedKeywords: cleanKeywords(rawFaq.rejectedKeywords),
      response: rawFaq.response
    };

    // Required keywords check (unless skipped)
    const requiredPass = faq.skipRequiredCheck
      ? true
      : faq.requiredKeywords.every(k => messageContent.includes(k));

    if (!requiredPass) continue;

    // Any-keyword check (if none provided, treat as pass)
    const anyPass = faq.anyKeywords.length === 0
      ? true
      : faq.anyKeywords.some(k => messageContent.includes(k));

    if (!anyPass) continue;

    // Rejected keywords check (if any present, fail)
    const rejectedHit = faq.rejectedKeywords.some(k => messageContent.includes(k));
    if (rejectedHit) continue;

    message.reply(faq.response);
    return true;
  }

  return false;
}

module.exports = { handleFAQ };
