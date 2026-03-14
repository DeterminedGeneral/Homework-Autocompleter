function shorten(str, maxLength) {
  if (maxLength < 0) throw new Error("maxLength must be non-negative");

  if (str.length <= maxLength) return str;

  // If adding "..." would exceed the limit, trim accordingly
  const ellipsis = "...";
  if (maxLength <= ellipsis.length) {
    return str.slice(0, maxLength); // can't fit ellipsis
  }

  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

module.exports = shorten;