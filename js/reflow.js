/**
 * Reflows a message from its original format to fit a target grid.
 * Handles word-wrap, attribution separation, and vertical centering.
 */
export function reflowMessage(lines, targetCols, targetRows) {
  // Extract non-empty content
  const content = lines.filter(l => l && l.trim() !== '');

  // Separate body from attribution
  // Once we find a line starting with -, everything from there is attribution
  const bodyParts = [];
  const attrParts = [];
  let foundAttr = false;
  for (const line of content) {
    if (!foundAttr && line.trim().startsWith('-')) {
      foundAttr = true;
    }
    if (foundAttr) {
      attrParts.push(line.trim());
    } else {
      bodyParts.push(line.trim());
    }
  }

  // Join attribution parts into one string
  const attribution = attrParts.length > 0 ? attrParts.join(' ') : null;

  // Word-wrap body to target width
  const allWords = bodyParts.join(' ').split(/\s+/).filter(w => w);
  const wrapped = [];
  let currentLine = '';

  for (const word of allWords) {
    if (currentLine === '') {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= targetCols) {
      currentLine += ' ' + word;
    } else {
      wrapped.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) wrapped.push(currentLine);

  // Wrap attribution if present
  const attrLines = [];
  if (attribution) {
    const attrWords = attribution.split(/\s+/);
    let attrCurrent = '';
    for (const w of attrWords) {
      if (attrCurrent === '') {
        attrCurrent = w;
      } else if (attrCurrent.length + 1 + w.length <= targetCols) {
        attrCurrent += ' ' + w;
      } else {
        attrLines.push(attrCurrent);
        attrCurrent = w;
      }
    }
    if (attrCurrent) attrLines.push(attrCurrent);
  }

  // Combine with blank separator before attribution
  const allContent = attrLines.length > 0
    ? [...wrapped, '', ...attrLines]
    : [...wrapped];

  // Center vertically in target rows
  const topPad = Math.max(1, Math.floor((targetRows - allContent.length) / 2));

  const result = [];
  for (let i = 0; i < targetRows; i++) {
    const idx = i - topPad;
    result.push(idx >= 0 && idx < allContent.length ? allContent[idx] : '');
  }

  return result;
}
